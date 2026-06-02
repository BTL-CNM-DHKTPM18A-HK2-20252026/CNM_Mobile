import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import emojiPack from '../constants/emoji-pack.json';

const S3_BASE_URL = process.env.EXPO_PUBLIC_S3_BASE_URL || 'https://fruvia-asset.s3.ap-southeast-2.amazonaws.com/public';

interface StickerItem {
  id: string;
  src: string;
}

interface StickerPackData {
  id: string;
  name: string;
  icon: string;
  stickers: StickerItem[];
}

interface EmojiStickerPickerProps {
  onSelectEmoji: (shortcode: string) => void;
  onSelectSticker: (stickerUrl: string) => void;
  onClose?: () => void;
}

export default function EmojiStickerPicker({
  onSelectEmoji,
  onSelectSticker,
  onClose,
}: EmojiStickerPickerProps) {
  const [activeTab, setActiveTab] = useState<'sticker' | 'emoji'>('emoji');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEmojiCategory] = useState('symbols');
  const [stickerPacks, setStickerPacks] = useState<StickerPackData[]>([]);
  const [activeStickerPackId, setActiveStickerPackId] = useState('');
  const [stickerLoading, setStickerLoading] = useState(false);

  // Normalize URLs matching the web implementation
  const normalizeStickerSrc = (src: string) => {
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    return `${S3_BASE_URL}${src}`;
  };

  const normalizeEmojiSrc = (src: string) => {
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    return `${S3_BASE_URL}${src.replace('/fruvia_emoji', '')}`;
  };

  // Load sticker packs from S3 JSON (same as web)
  useEffect(() => {
    if (stickerPacks.length > 0) return;
    setStickerLoading(true);

    fetch(`${S3_BASE_URL}/stickers/sticker-pack.json`)
      .then((r) => r.json())
      .then((data: { packs: StickerPackData[] }) => {
        const packs = data.packs.filter((p) => p.id !== 'pack_0');
        setStickerPacks(packs);
        if (packs.length > 0) setActiveStickerPackId(packs[0].id);
      })
      .catch((e) => console.error('Failed to load sticker packs:', e))
      .finally(() => setStickerLoading(false));
  }, [stickerPacks.length]);

  // Show stickers from active pack, filtered by search query
  const activePack = useMemo(() => {
    return stickerPacks.find((p) => p.id === activeStickerPackId);
  }, [stickerPacks, activeStickerPackId]);

  const filteredStickers = useMemo(() => {
    if (!activePack) return [];
    if (!searchQuery.trim()) return activePack.stickers;
    return activePack.stickers.filter((s) =>
      s.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activePack, searchQuery]);

  // Emojis filtered by category and search query
  const displayEmojiCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      return emojiPack.categories
        .map((cat) => ({
          ...cat,
          icons: cat.icons.filter(
            (icon) =>
              icon.shortcode.toLowerCase().includes(query) ||
              icon.keywords.some((k) => k.toLowerCase().includes(query))
          ),
        }))
        .filter((cat) => cat.icons.length > 0);
    }
    return emojiPack.categories.filter((cat) => cat.id === activeEmojiCategory);
  }, [activeEmojiCategory, searchQuery]);

  return (
    <View style={styles.container}>
      {/* Header Tabs: emoji icon + sticker pack icons */}
      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'emoji' && styles.activeTabButton]}
          onPress={() => {
            setActiveTab('emoji');
            setSearchQuery('');
          }}
        >
          <Ionicons
            name="happy-outline"
            size={24}
            color={activeTab === 'emoji' ? '#0068FF' : '#7B808A'}
          />
          {activeTab === 'emoji' && <View style={styles.activeTabIndicator} />}
        </TouchableOpacity>

        {/* Sticker pack icons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packTabsScroll}>
          {stickerPacks.map((pack) => (
            <TouchableOpacity
              key={pack.id}
              style={[styles.packTabItem, activeStickerPackId === pack.id && activeTab === 'sticker' && styles.packTabItemActive]}
              onPress={() => {
                setActiveTab('sticker');
                setActiveStickerPackId(pack.id);
                setSearchQuery('');
              }}
            >
              <Image
                source={{ uri: normalizeStickerSrc(pack.stickers[0]?.src || '') }}
                style={styles.packTabIcon}
              />
              {activeStickerPackId === pack.id && activeTab === 'sticker' && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Grid Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'sticker' && (
          <>
            {stickerLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#0068FF" />
              </View>
            ) : stickerPacks.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>Chưa có sticker</Text>
              </View>
            ) : (
              <FlatList
                data={filteredStickers}
                keyExtractor={(item) => item.id}
                numColumns={4}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.stickerItem}
                    onPress={() => onSelectSticker(normalizeStickerSrc(item.src))}
                  >
                    <Image
                      source={{ uri: normalizeStickerSrc(item.src) }}
                      style={styles.stickerImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.listContent}
              />
            )}
          </>
        )}

        {activeTab === 'emoji' && (
          <ScrollView contentContainerStyle={styles.emojiScrollContent}>
            {displayEmojiCategories.map((cat) => (
              <View key={cat.id} style={styles.emojiCategoryBlock}>
                <Text style={styles.categoryTitle}>{cat.name}</Text>
                <View style={styles.emojiGrid}>
                  {cat.icons.map((icon) => (
                    <TouchableOpacity
                      key={icon.id}
                      style={styles.emojiItem}
                      onPress={() => onSelectEmoji(icon.shortcode)}
                    >
                      <Image
                        source={{ uri: normalizeEmojiSrc(icon.src) }}
                        style={styles.emojiImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            {displayEmojiCategories.length === 0 && (
              <View style={styles.center}>
                <Text style={styles.emptyText}>Không tìm thấy emoji phù hợp</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 320,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFF1F5',
  },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF1F5',
    paddingHorizontal: 0,
  },
  tabButtons: {
    flexDirection: 'row',
    height: 40,
  },
  tabButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    position: 'relative',
    height: 40,
  },
  activeTabButton: {},
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7B808A',
  },
  activeTabText: {
    color: '#0068FF',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    backgroundColor: '#0068FF',
    borderRadius: 2,
  },
  packTabsScroll: {
    flex: 1,
    marginLeft: -2,
  },
  packTabItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    height: 40,
    position: 'relative',
    marginHorizontal: 1,
  },
  packTabItemActive: {},
  packTabIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6FA',
    margin: 8,
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#101317',
    paddingVertical: 0,
  },
  contentContainer: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#7B808A',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  stickerItem: {
    width: `${100 / 4}%`,
    aspectRatio: 1,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerImage: {
    width: '80%',
    height: '80%',
  },
  emojiScrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  emojiCategoryBlock: {
    marginVertical: 6,
  },
  categoryTitle: {
    fontSize: 9,
    fontWeight: '400',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emojiItem: {
    width: `${100 / 9}%`,
    aspectRatio: 1,
    padding: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiImage: {
    width: '70%',
    height: '70%',
  },
  bottomNav: {
    height: 48,
    borderTopWidth: 1,
    borderTopColor: '#EFF1F5',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  bottomScroll: {
    flex: 1,
  },
  bottomNavItem: {
    paddingHorizontal: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
    marginVertical: 4,
  },
  bottomNavItemActive: {
    backgroundColor: 'rgba(0,104,255,0.08)',
  },
  bottomNavIcon: {
    width: 24,
    height: 24,
  },
  bottomNavText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7B808A',
    textTransform: 'uppercase',
  },
});
