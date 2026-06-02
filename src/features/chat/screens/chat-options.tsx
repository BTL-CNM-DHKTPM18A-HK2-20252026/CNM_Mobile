import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAvatarSource } from '@/services/mediaUtils';
import { chatService } from '@chat/services/chatService';

type OptionItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

type QuickItem = OptionItem & {
  labelLines?: [string, string];
};

function OptionRow({ icon, label, onPress, danger, style }: OptionItem & { style?: any }) {
  return (
    <TouchableOpacity style={[styles.optionRow, style]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.optionIconWrap}>
        <Ionicons name={icon} size={22} color={danger ? '#E04B4B' : '#8A8F99'} />
      </View>
      <Text style={[styles.optionLabel, danger && styles.optionLabelDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ChatOptionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string; avatar?: string; type?: string }>();
  const [pinConversation, setPinConversation] = useState(false);
  const [hideConversation, setHideConversation] = useState(false);
  const [incomingCallNotify, setIncomingCallNotify] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaItems, setMediaItems] = useState<any[]>([]);

  const conversationName = String(params.name ?? 'Tùy chọn');
  const conversationAvatar = String(params.avatar ?? '');
  const isGroupConversation = String(params.type ?? '').toLowerCase() === 'group';
  const avatarSource = getAvatarSource(conversationAvatar);
  const conversationId = String(params.id ?? '').trim();

  const openStub = (title: string) => {
    Alert.alert(title, 'Chức năng đang phát triển');
  };

  const normalizeMediaItems = useCallback((items: any[]) => {
    const list = Array.isArray(items) ? items : [];
    return list.flatMap((item: any, idx: number) => {
      const type = String(item?.messageType ?? '').toUpperCase();
      const mediaUrl = String(item?.content ?? item?.mediaUrl ?? item?.url ?? '').trim();
      const fileName = String(item?.fileName ?? '').trim();

      if ((type === 'IMAGE' || type === 'VIDEO' || type === 'FILE' || type === 'MEDIA' || type === 'LINK') && mediaUrl) {
        return [{
          ...item,
          id: String(item?.messageId ?? item?.id ?? `media-${idx}`),
          mediaUrl,
          fileName,
          messageType: type,
        }];
      }

      if (type === 'IMAGE_GROUP' && Array.isArray(item?.attachments)) {
        return item.attachments.map((attachment: any, ai: number) => {
          const url = String(attachment?.url ?? attachment?.content ?? attachment?.mediaUrl ?? attachment?.fileUrl ?? attachment?.path ?? '').trim();
          if (!url) return null;
          return {
            ...item,
            id: `${String(item?.messageId ?? item?.id ?? `media-group-${idx}`)}-${ai}`,
            mediaUrl: url,
            fileName: String(attachment?.fileName ?? fileName ?? '').trim(),
            thumbnailUrl: String(attachment?.thumbnailUrl ?? item?.thumbnailUrl ?? '').trim(),
            messageType: 'IMAGE',
          };
        }).filter(Boolean);
      }

      return [];
    });
  }, []);

  const mediaBrowserItems = useMemo(() => normalizeMediaItems(mediaItems), [mediaItems, normalizeMediaItems]);
  const mediaPreviewItems = useMemo(() => mediaBrowserItems.slice(0, 4), [mediaBrowserItems]);

  const fetchMediaItems = useCallback(async () => {
    if (!conversationId) {
      setMediaItems([]);
      return;
    }

    try {
      setMediaLoading(true);
      const response = await chatService.getConversationMedia(conversationId);
      const payload = (response as any)?.data ?? response;
      setMediaItems(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Failed to load conversation media:', error);
      setMediaItems([]);
    } finally {
      setMediaLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void fetchMediaItems();
  }, [fetchMediaItems]);

  const quickActions: QuickItem[] = [
    { icon: 'search-outline', label: 'Tìm tin nhắn', labelLines: ['Tìm', 'tin nhắn'], onPress: () => {
      router.replace({
        pathname: '/chat-detail',
        params: {
          id: conversationId,
          name: conversationName,
          avatar: conversationAvatar,
          type: params.type,
          search: '1',
        },
      });
    } },
    { icon: 'person-outline', label: 'Trang cá nhân', labelLines: ['Trang', 'cá nhân'], onPress: () => openStub('Trang cá nhân') },
    { icon: 'brush-outline', label: 'Đổi hình nền', labelLines: ['Đổi', 'hình nền'], onPress: () => openStub('Đổi hình nền') },
    { icon: 'notifications-outline', label: 'Tắt thông báo', labelLines: ['Tắt', 'thông báo'], onPress: () => openStub('Tắt thông báo') },
  ];

  const moreActions: OptionItem[] = [
    { icon: 'create-outline', label: 'Đổi tên gợi nhớ', onPress: () => openStub('Đổi tên gợi nhớ') },
    { icon: 'star-outline', label: 'Đánh dấu bạn thân', onPress: () => openStub('Đánh dấu bạn thân') },
    { icon: 'time-outline', label: 'Nhật ký chung', onPress: () => openStub('Nhật ký chung') },
  ];

  const groupActions: OptionItem[] = isGroupConversation ? [
    { icon: 'people-outline', label: `Tạo nhóm với ${conversationName}`, onPress: () => openStub('Tạo nhóm') },
    { icon: 'person-add-outline', label: `Thêm ${conversationName} vào nhóm`, onPress: () => openStub('Thêm vào nhóm') },
    { icon: 'people-circle-outline', label: 'Xem nhóm chung', onPress: () => openStub('Nhóm chung') },
  ] : [];

  const dangerActions: OptionItem[] = [
    { icon: 'warning-outline', label: 'Báo xấu', onPress: () => openStub('Báo xấu') },
    { icon: 'ban-outline', label: 'Quản lý chặn', onPress: () => openStub('Quản lý chặn') },
    { icon: 'pie-chart-outline', label: 'Dung lượng trò chuyện', onPress: () => openStub('Dung lượng trò chuyện') },
    { icon: 'trash-outline', label: 'Xóa lịch sử trò chuyện', onPress: () => openStub('Xóa lịch sử trò chuyện'), danger: true },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#4A96F0" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tùy chọn</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            <Image source={avatarSource} style={styles.avatar} contentFit="cover" />
          </View>
          <Text style={styles.name} numberOfLines={2}>{conversationName}</Text>
        </View>

        <View style={styles.quickGrid}>
          {quickActions.map((item) => (
            <TouchableOpacity key={item.label} style={styles.quickItem} onPress={item.onPress} activeOpacity={0.75}>
              <View style={styles.quickIconWrap}>
                <Ionicons name={item.icon} size={25} color="#111" />
              </View>
              <Text style={styles.quickLabel} numberOfLines={2}>
                {item.labelLines ? `${item.labelLines[0]}\n${item.labelLines[1]}` : item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.sectionCard, styles.moreActionsCard]}>
          {moreActions.map((item) => (
            <OptionRow key={item.label} {...item} style={styles.moreActionRow} />
          ))}
        </View>

        <TouchableOpacity
          style={styles.mediaCard}
          onPress={() => {
            router.push({
              pathname: '/chat-media',
              params: {
                id: conversationId,
                name: conversationName,
              },
            });
          }}
          activeOpacity={0.8}
        >
          <View style={styles.mediaCardHeader}>
            <View style={styles.mediaCardIconWrap}>
              <Ionicons name="images-outline" size={20} color="#5D6B7E" />
            </View>
            <View style={styles.mediaCardTextWrap}>
              <Text style={styles.mediaCardTitle}>Ảnh, file, link</Text>
              <Text style={styles.mediaCardSubtitle} numberOfLines={1}>Xem toàn bộ ảnh, tệp và liên kết đã chia sẻ</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#B5BCC6" />
          </View>
          <View style={styles.mediaCardPreviewRow}>
            {mediaLoading ? (
              <>
                <View style={styles.mediaPreviewThumb} />
                <View style={styles.mediaPreviewThumb} />
                <View style={styles.mediaPreviewThumb} />
                <View style={styles.mediaPreviewThumb} />
              </>
            ) : mediaPreviewItems.length > 0 ? (
              mediaPreviewItems.map((item: any) => (
                <View key={item.id} style={styles.mediaPreviewThumb}>
                  {String(item.messageType).toUpperCase() === 'IMAGE' ? (
                    <Image source={{ uri: item.mediaUrl }} style={styles.mediaPreviewThumbImage} contentFit="cover" />
                  ) : (
                    <View style={styles.mediaPreviewFileThumb}>
                      <Ionicons
                        name={String(item.messageType).toUpperCase() === 'LINK' ? 'link-outline' : 'document-text-outline'}
                        size={16}
                        color="#5D6B7E"
                      />
                    </View>
                  )}
                </View>
              ))
            ) : (
              <>
                <View style={styles.mediaPreviewThumb} />
                <View style={styles.mediaPreviewThumb} />
                <View style={styles.mediaPreviewThumb} />
                <View style={styles.mediaPreviewThumb} />
              </>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.sectionCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="push-outline" size={20} color="#8A8F99" />
              </View>
              <Text style={styles.optionLabel}>Ghim trò chuyện</Text>
            </View>
            <Switch
              value={pinConversation}
              onValueChange={setPinConversation}
              trackColor={{ false: '#E4E7EC', true: '#9CC7FF' }}
              thumbColor={pinConversation ? '#4A96F0' : '#FFFFFF'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="eye-off-outline" size={20} color="#8A8F99" />
              </View>
              <Text style={styles.optionLabel}>Ẩn trò chuyện</Text>
            </View>
            <Switch
              value={hideConversation}
              onValueChange={setHideConversation}
              trackColor={{ false: '#E4E7EC', true: '#9CC7FF' }}
              thumbColor={hideConversation ? '#4A96F0' : '#FFFFFF'}
            />
          </View>

          <TouchableOpacity style={styles.settingRow} onPress={() => openStub('Báo cuộc gọi đến')} activeOpacity={0.75}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="call-outline" size={20} color="#8A8F99" />
              </View>
              <Text style={styles.optionLabel}>Báo cuộc gọi đến</Text>
            </View>
            <Switch
              value={incomingCallNotify}
              onValueChange={setIncomingCallNotify}
              trackColor={{ false: '#E4E7EC', true: '#9CC7FF' }}
              thumbColor={incomingCallNotify ? '#4A96F0' : '#FFFFFF'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow} onPress={() => openStub('Tin nhắn tự xóa')} activeOpacity={0.75}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="timer-outline" size={20} color="#8A8F99" />
              </View>
              <View style={styles.settingTextBlock}>
                <Text style={styles.optionLabel}>Tin nhắn tự xóa</Text>
                <Text style={styles.settingSubLabel}>Không tự xóa</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#B5BCC6" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]} onPress={() => openStub('Cài đặt cá nhân')} activeOpacity={0.75}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="person-circle-outline" size={20} color="#8A8F99" />
              </View>
              <Text style={styles.optionLabel}>Cài đặt cá nhân</Text>
            </View>
          </TouchableOpacity>
        </View>

        {groupActions.length > 0 ? (
          <View style={styles.sectionCard}>
            {groupActions.map((item) => (
              <OptionRow key={item.label} {...item} />
            ))}
          </View>
        ) : null}

        <View style={[styles.sectionCard, styles.dangerActionsCard]}>
          {dangerActions.map((item) => (
            <OptionRow key={item.label} {...item} style={styles.dangerActionRow} />
          ))}
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#4A96F0',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  body: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingBottom: 24,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 18,
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: 'hidden',
    backgroundColor: '#EEF2F7',
    marginBottom: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: '#202124',
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  quickItem: {
    width: 74,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  quickIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F4F6FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  quickLabel: {
    fontSize: 8,
    lineHeight: 10,
    textAlign: 'center',
    color: '#30343B',
    fontWeight: '400',
  },
  sectionCard: {
    marginHorizontal: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 8,
    borderTopColor: '#EEF1F5',
    paddingHorizontal: 12,
    paddingVertical: 1,
  },
  moreActionsCard: {
    marginTop: 12,
    marginBottom: 12,
    paddingVertical: 6,
  },
  mediaCard: {
    marginHorizontal: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 8,
    borderTopColor: '#EEF1F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mediaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaCardIconWrap: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  mediaCardTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  mediaCardTitle: {
    fontSize: 12,
    lineHeight: 15,
    color: '#202124',
    fontWeight: '500',
  },
  mediaCardSubtitle: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    color: '#7A808A',
    fontWeight: '400',
  },
  mediaCardPreviewRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingLeft: 36,
  },
  mediaPreviewThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#EDF1F6',
    borderWidth: 0.5,
    borderColor: '#E1E6ED',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEF1F5',
  },
  moreActionRow: {
    paddingVertical: 13,
  },
  dangerActionsCard: {
    marginTop: 12,
    marginBottom: 12,
    paddingVertical: 6,
  },
  dangerActionRow: {
    paddingVertical: 13,
  },
  optionIconWrap: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  optionLabel: {
    flex: 1,
    fontSize: 12,
    color: '#202124',
    fontWeight: '400',
  },
  optionLabelDanger: {
    color: '#E04B4B',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEF1F5',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconWrap: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  settingTextBlock: {
    flex: 1,
  },
  settingSubLabel: {
    marginTop: 0,
    fontSize: 9,
    lineHeight: 11,
    color: '#8A8F99',
  },
  mediaPreviewThumbImage: {
    width: '100%',
    height: '100%',
  },
  mediaPreviewFileThumb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
