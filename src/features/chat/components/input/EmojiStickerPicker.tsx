import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Dimensions,
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
  const [activeTab, setActiveTab] = useState<'sticker' | 'emoji'>('sticker');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('symbols');
  const [stickerPacks, setStickerPacks] = useState<StickerPackData[]>([]);
  const [activeStickerPackId, setActiveStickerPackId] = useState('');
  const [stickerLoading, setStickerLoading] = useState(false);

  // Normalize URLs matching the web implementation
  const normalizeStickerSrc = (src: string) => {
    return `${S3_BASE_URL}${src.replace(/\\/g, '/').replace(/\.webp$/i, '.png')}`;
  };

  const normalizeEmojiSrc = (src: string) => {
    return `${S3_BASE_URL}${src.replace('/fruvia_emoji', '')}`;
  };

  // Load stickers from S3 when the sticker tab is opened
  useEffect(() => {
    if (activeTab !== 'sticker' || stickerPacks.length > 0) return;
    setStickerLoading(true);
    fetch(`${S3_BASE_URL}/stickers/sticker-pack.json`)
      .then((r) => r.json())
      .then((data: { packs: StickerPackData[] }) => {
        // filter out pack_0 if matching web logic
        const packs = data.packs.filter((p) => p.id !== 'pack_0');
        setStickerPacks(packs);
        if (packs.length > 0) {
          setActiveStickerPackId(packs[0].id);
        }
      })
      .catch((e) => {
        console.error('Failed to load sticker packs:', e);
      })
      .finally(() => setStickerLoading(false));
  }, [activeTab, stickerPacks.length]);

  // Active sticker pack stickers filtered by search query
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
      {/* Header Tabs */}
      <View style={styles.tabHeader}>
        <View style={styles.tabButtons}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'sticker' && styles.activeTabButton]}
            onPress={() => {
              setActiveTab('sticker');
              setSearchQuery('');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'sticker' && styles.activeTabText]}>STICKER</Text>
            {activeTab === 'sticker' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'emoji' && styles.activeTabButton]}
            onPress={() => {
              setActiveTab('emoji');
              setSearchQuery('');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'emoji' && styles.activeTabText]}>EMOJI</Text>
            {activeTab === 'emoji' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        </View>
        
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="chevron-down" size={24} color="#7B808A" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#7B808A" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'sticker' ? 'Tìm kiếm sticker...' : 'Tìm kiếm emoji...'}
          placeholderTextColor="#7B808A"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#7B808A" />
          </TouchableOpacity>
        )}
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

      {/* Bottom Category Selector */}
      <View style={styles.bottomNav}>
        {activeTab === 'emoji' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bottomScroll}>
            {emojiPack.categories.map((cat) => {
              const representativeIcon = cat.icons[0];
              const isSelected = activeEmojiCategory === cat.id && !searchQuery;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.bottomNavItem, isSelected && styles.bottomNavItemActive]}
                  onPress={() => {
                    setActiveEmojiCategory(cat.id);
                    setSearchQuery('');
                  }}
                >
                  {representativeIcon ? (
                    <Image
                      source={{ uri: normalizeEmojiSrc(representativeIcon.src) }}
                      style={styles.bottomNavIcon}
                    />
                  ) : (
                    <Text style={styles.bottomNavText}>{cat.name.substring(0, 2)}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bottomScroll}>
            {stickerPacks.map((pack) => {
              const representativeIcon = pack.stickers[0];
              const isSelected = activeStickerPackId === pack.id && !searchQuery;
              return (
                <TouchableOpacity
                  key={pack.id}
                  style={[styles.bottomNavItem, isSelected && styles.bottomNavItemActive]}
                  onPress={() => {
                    setActiveStickerPackId(pack.id);
                    setSearchQuery('');
                  }}
                >
                  {representativeIcon ? (
                    <Image
                      source={{ uri: normalizeStickerSrc(representativeIcon.src) }}
                      style={styles.bottomNavIcon}
                    />
                  ) : (
                    <Text style={styles.bottomNavText}>{pack.name.substring(0, 2)}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
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
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF1F5',
    paddingHorizontal: 8,
  },
  tabButtons: {
    flexDirection: 'row',
    height: 40,
  },
  tabButton: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'relative',
    height: '100%',
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
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: '#0068FF',
    borderRadius: 2,
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
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  stickerItem: {
    width: `${100 / 4}%`,
    aspectRatio: 1,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerImage: {
    width: '100%',
    height: '100%',
  },
  emojiScrollContent: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  emojiCategoryBlock: {
    marginVertical: 6,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7B808A',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emojiItem: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiImage: {
    width: '100%',
    height: '100%',
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
