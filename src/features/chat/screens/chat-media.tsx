import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chatService } from '@chat/services/chatService';

type MediaType = 'IMAGE' | 'VIDEO' | 'FILE' | 'LINK' | 'VOICE';

type MediaItem = {
  id: string;
  mediaUrl: string;
  fileName?: string;
  messageType: MediaType | string;
  createdAt?: string;
  senderName?: string;
  thumbnailUrl?: string;
};

type FilterKey = 'ALL' | 'IMAGE' | 'VIDEO' | 'FILE' | 'LINK' | 'VOICE';

export default function ChatMediaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const conversationId = String(params.id ?? '').trim();
  const conversationName = String(params.name ?? 'Ảnh, file, link');

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activeTab, setActiveTab] = useState<FilterKey>('IMAGE');

  const normalizeMediaItems = useCallback((source: any[]) => {
    const list = Array.isArray(source) ? source : [];
    return list.flatMap((item: any, idx: number) => {
      const type = String(item?.messageType ?? '').toUpperCase();
      const mediaUrl = String(item?.content ?? item?.mediaUrl ?? item?.url ?? '').trim();
      const fileName = String(item?.fileName ?? '').trim();

      if ((type === 'IMAGE' || type === 'VIDEO' || type === 'FILE' || type === 'MEDIA' || type === 'LINK' || type === 'VOICE') && mediaUrl) {
        return [{
          id: String(item?.messageId ?? item?.id ?? `media-${idx}`),
          mediaUrl,
          fileName,
          messageType: type,
          createdAt: String(item?.createdAt ?? item?.updatedAt ?? ''),
          senderName: String(item?.senderName ?? ''),
          thumbnailUrl: String(item?.thumbnailUrl ?? ''),
        }];
      }

      if (type === 'IMAGE_GROUP' && Array.isArray(item?.attachments)) {
        return item.attachments.map((attachment: any, ai: number) => {
          const url = String(attachment?.url ?? attachment?.content ?? attachment?.mediaUrl ?? attachment?.fileUrl ?? attachment?.path ?? '').trim();
          if (!url) return null;
          return {
            id: `${String(item?.messageId ?? item?.id ?? `media-group-${idx}`)}-${ai}`,
            mediaUrl: url,
            fileName: String(attachment?.fileName ?? fileName ?? '').trim(),
            messageType: 'IMAGE',
            createdAt: String(item?.createdAt ?? item?.updatedAt ?? ''),
            senderName: String(item?.senderName ?? ''),
            thumbnailUrl: String(attachment?.thumbnailUrl ?? item?.thumbnailUrl ?? '').trim(),
          } as MediaItem;
        }).filter(Boolean);
      }

      return [];
    });
  }, []);

  const fetchMedia = useCallback(async () => {
    if (!conversationId) {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      const response = await chatService.getConversationMedia(conversationId);
      const payload = (response as any)?.data ?? response;
      setItems(normalizeMediaItems(Array.isArray(payload) ? payload : []));
    } catch (error) {
      console.error('Failed to fetch media:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, normalizeMediaItems]);

  useEffect(() => {
    void fetchMedia();
  }, [fetchMedia]);

  const filteredItems = useMemo(() => {
    const base = activeTab === 'ALL'
      ? items
      : items.filter((item) => String(item.messageType).toUpperCase() === activeTab);

    return [...base].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }, [activeTab, items]);

  const groupedByDate = useMemo(() => {
    const groups: { label: string; items: MediaItem[] }[] = [];
    for (const item of filteredItems) {
      const dateLabel = item.createdAt
        ? new Date(item.createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Hôm nay';
      const last = groups[groups.length - 1];
      if (!last || last.label !== dateLabel) {
        groups.push({ label: dateLabel, items: [item] });
      } else {
        last.items.push(item);
      }
    }
    return groups;
  }, [filteredItems]);

  const filterButtons: { key: FilterKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'IMAGE', label: 'Ảnh', icon: 'image-outline' },
    { key: 'FILE', label: 'File', icon: 'document-text-outline' },
    { key: 'LINK', label: 'Link', icon: 'link-outline' },
    { key: 'VOICE', label: 'Tin nhắn thoại', icon: 'mic-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar backgroundColor="#4A96F0" barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{conversationName}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="cloud-upload-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="search-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterWrap}>
        <View style={styles.tabRow}>
          {filterButtons.map((btn) => (
            <TouchableOpacity
              key={btn.key}
              style={styles.tabItem}
              onPress={() => setActiveTab(btn.key)}
            >
              <Text
                style={[styles.tabText, activeTab === btn.key && styles.tabTextActive]}
                numberOfLines={1}
              >
                {btn.label}
              </Text>
              <View style={[styles.tabUnderline, activeTab === btn.key && styles.tabUnderlineActive]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#4A96F0" />
        </View>
      ) : (
        <FlatList
          data={groupedByDate}
          keyExtractor={(item) => item.label}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: group }) => (
            <View style={styles.groupBlock}>
              <Text style={styles.groupDate}>{group.label}</Text>
              <View style={styles.grid}>
                {group.items.map((item) => {
                  const type = String(item.messageType).toUpperCase();
                  const isImage = type === 'IMAGE';
                  const isVideo = type === 'VIDEO';
                  const isFile = type === 'FILE' || type === 'MEDIA';
                  const isLink = type === 'LINK';
                  const isVoice = type === 'VOICE';
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.gridItem, isImage && styles.gridItemImage]}
                      activeOpacity={0.85}
                      onPress={() => {
                        if (item.mediaUrl) {
                          void Linking.openURL(item.mediaUrl).catch(() => { });
                        }
                      }}
                    >
                      <View style={styles.thumbWrap}>
                        {isImage ? (
                          <Image source={{ uri: item.mediaUrl }} style={styles.thumb} contentFit="cover" />
                        ) : (
                          <Ionicons
                            name={isVideo ? 'play-circle-outline' : isLink ? 'link-outline' : isVoice ? 'mic-outline' : 'document-text-outline'}
                            size={28}
                            color="#4A96F0"
                          />
                        )}
                      </View>
                      {!isImage && (
                        <>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {item.fileName || (isImage ? 'Ảnh' : isVideo ? 'Video' : isLink ? 'Link' : isVoice ? 'Tin nhắn thoại' : 'File')}
                          </Text>
                          <Text style={styles.itemSub} numberOfLines={1}>
                            {item.senderName || 'Hôm nay'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          ListEmptyComponent={<View style={styles.emptyWrap}><Text style={styles.emptyText}>Chưa có media</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 56,
    backgroundColor: '#4A96F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E7ECF2',
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    minWidth: 0,
  },
  tabText: {
    fontSize: 9,
    color: '#717784',
    fontWeight: '700',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#111827',
  },
  tabUnderline: {
    marginTop: 8,
    height: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: {
    backgroundColor: '#111827',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  groupBlock: {
    paddingTop: 12,
  },
  groupDate: {
    fontSize: 9,
    fontWeight: '500',
    color: '#7A808A',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  grid: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '33.333%',
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  gridItemImage: {
    width: '50%',
  },
  thumbWrap: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EEF3F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  itemTitle: {
    fontSize: 11,
    color: '#1F2937',
    marginTop: 6,
    fontWeight: '600',
  },
  itemSub: {
    fontSize: 10,
    color: '#7A808A',
    marginTop: 2,
  },
  emptyWrap: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#7A808A',
  },
});
