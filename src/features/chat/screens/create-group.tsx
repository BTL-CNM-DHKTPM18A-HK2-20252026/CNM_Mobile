import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { chatFileService, type PickedMedia } from '@/services/chatFileService';
import { chatService } from '@/services/chatService';
import { friendService } from '@/services/friendService';
import { getAvatarSource } from '@/services/mediaUtils';
import { buildSectionedList, MAX_CREATE_GROUP_SELECTABLE_MEMBERS, type SectionedListItem } from '@/utils/group/groupMembers';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type FriendItem = {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
  last_seen_at?: string;
  last_seen_text?: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type ListItem = SectionedListItem<FriendItem>;

function getFriendListItemKey(item: ListItem | FriendItem): string {
  if (typeof item === 'object' && item !== null && 'type' in item) {
    return String(item.id);
  }

  return String((item as FriendItem).user_id);
}

const S3_BASE = process.env.EXPO_PUBLIC_S3_BASE_URL || 'https://fruvia-asset.s3.ap-southeast-2.amazonaws.com/public';
const FRUVIA_GROUP_IMAGE_OPTIONS = [
  `${S3_BASE}/avatar_group/avtgr1.jpg`,
  `${S3_BASE}/avatar_group/avtgr2.jpg`,
  `${S3_BASE}/avatar_group/avtgr3.jpg`,
  `${S3_BASE}/avatar_group/avtgr4.jpg`,
  `${S3_BASE}/avatar_group/avtgr5.jpg`,
  `${S3_BASE}/avatar_group/avtgr6.jpg`,
  `${S3_BASE}/avatar_group/avtgr7.jpg`,
  `${S3_BASE}/avatar_group/avtgr8.jpg`,
  `${S3_BASE}/avatar_group/avtgr9.jpg`,
  `${S3_BASE}/avatar_group/avtgr10.jpg`,
  `${S3_BASE}/avatar_group/avtgr11.jpg`,
  `${S3_BASE}/avatar_group/avtgr12.jpg`,
];

function normalizeFriends(raw: unknown): FriendItem[] {
  const payload = chatService.unwrapApiPayload<any>(raw);
  const data = Array.isArray(payload) ? payload : payload?.data;

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item: any) => ({
      user_id: String(item.user_id ?? item.userId ?? item.id ?? ''),
      display_name: String(item.display_name ?? item.displayName ?? item.full_name ?? item.fullName ?? '').trim(),
      avatar_url: item.avatar_url ?? item.avatarUrl,
      email: item.email,
      phone: item.phone,
      last_seen_at: String(item.last_seen_at ?? item.lastSeenAt ?? item.lastSeen ?? item.last_active ?? item.lastActive ?? item.updatedAt ?? '').trim(),
      last_seen_text: String(item.last_seen_text ?? item.lastSeenText ?? item.lastSeenLabel ?? '').trim(),
    }))
    .filter((item: FriendItem) => item.user_id && item.display_name)
    .sort((a: FriendItem, b: FriendItem) => a.display_name.localeCompare(b.display_name, 'vi'));
}

function formatRecentLabel(source: FriendItem): string {
  const text = String(source.last_seen_text ?? '').trim();
  if (text) return text;

  const raw = String(source.last_seen_at ?? '').trim();
  if (!raw) return 'Mới đây';

  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return raw;

  const diffMs = Date.now() - ms;
  if (diffMs < 60_000) return 'Vừa xong';
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return '1 ngày trước';
  return `${diffDay} ngày trước`;
}

export default function CreateGroupScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [groupName, setGroupName] = useState('');
  const [groupAvatarUri, setGroupAvatarUri] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'contacts'>('recent');
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [presetAvatarPickerVisible, setPresetAvatarPickerVisible] = useState(false);

  const handlePickGroupAvatarFromLibrary = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập thư viện ảnh');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      setGroupAvatarUri(result.assets[0].uri);
    }
  }, []);

  const fetchFriends = async () => {
    setLoading(true);

    try {
      const response = (await friendService.getFriendsList()) as unknown as ApiResponse<FriendItem[]>;
      setFriends(normalizeFriends(response));
    } catch {
      setFriends([]);
      Alert.alert('Lỗi', 'Không thể tải danh sách bạn bè');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const filteredFriends = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return friends;
    }

    return friends.filter((friend) => {
      return (
        friend.display_name.toLowerCase().includes(keyword) ||
        String(friend.email ?? '').toLowerCase().includes(keyword) ||
        String(friend.phone ?? '').toLowerCase().includes(keyword)
      );
    });
  }, [friends, query]);

  const recentFriends = useMemo(() => {
    return [...filteredFriends].sort((left, right) => {
      const leftTime = Date.parse(String(left.last_seen_at ?? ''));
      const rightTime = Date.parse(String(right.last_seen_at ?? ''));
      const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
      const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
      return safeRight - safeLeft;
    });
  }, [filteredFriends]);

  const listData = useMemo(() => {
    return buildSectionedList(
      filteredFriends,
      (friend) => friend.user_id,
      (friend) => friend.display_name,
    );
  }, [filteredFriends]);

  const toggleFriend = (userId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }

      if (prev.length >= MAX_CREATE_GROUP_SELECTABLE_MEMBERS) {
        Alert.alert('Giới hạn nhóm', `Nhóm chỉ chọn tối đa ${MAX_CREATE_GROUP_SELECTABLE_MEMBERS} thành viên.`);
        return prev;
      }

      return [...prev, userId];
    });
  };

  const handleCreateGroup = async () => {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      Alert.alert('Thiếu thông tin', 'Vui lòng đặt tên nhóm');
      return;
    }

    if (selectedIds.length === 0) {
      Alert.alert('Thiếu thành viên', 'Vui lòng chọn ít nhất 1 người bạn');
      return;
    }

    setSubmitting(true);

    try {
      let conversationAvatarUrl: string | undefined;

      if (groupAvatarUri) {
        const fileName = `group_avatar_${Date.now()}.jpg`;
        const pickedMedia: PickedMedia = {
          uri: groupAvatarUri,
          fileName,
          fileSize: 0,
          mimeType: 'image/jpeg',
          mediaType: 'IMAGE',
        };

        conversationAvatarUrl = groupAvatarUri.startsWith(S3_BASE)
          ? groupAvatarUri
          : await chatFileService.uploadMedia(pickedMedia);
      }

      const response = await chatService.createGroupConversation(trimmedName, selectedIds, conversationAvatarUrl);
      const payload = chatService.unwrapApiPayload<any>(response);
      const conversationId = String(payload?.conversationId ?? payload?.conversation_id ?? payload?.id ?? '');

      if (!conversationId) {
        Alert.alert('Tạo nhóm thành công', 'Không lấy được mã hội thoại để mở chat.');
        router.back();
        return;
      }

      const avatarQuery = conversationAvatarUrl ? `&avatar=${encodeURIComponent(conversationAvatarUrl)}` : '';
      router.replace(
        `/chat-detail?id=${encodeURIComponent(conversationId)}&name=${encodeURIComponent(trimmedName)}&type=GROUP${avatarQuery}`
      );
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Không thể tạo nhóm. Vui lòng thử lại.';
      Alert.alert('Lỗi tạo nhóm', message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <View style={[styles.letterRow, { borderTopColor: colors.border }]}> 
          <Text style={[styles.letterText, { color: colors.text }]}>{item.letter}</Text>
        </View>
      );
    }

    const friend = item.item;
    const selected = selectedIds.includes(friend.user_id);

    return (
      <TouchableOpacity
        style={[styles.friendRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
        activeOpacity={0.7}
        onPress={() => toggleFriend(friend.user_id)}
      >
        <Image source={getAvatarSource(friend.avatar_url)} style={styles.avatar} />

        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
            {friend.display_name}
          </Text>
          {activeTab === 'recent' ? (
            <Text style={[styles.friendSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {formatRecentLabel(friend)}
            </Text>
          ) : friend.email ? (
            <Text style={[styles.friendSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {friend.email}
            </Text>
          ) : null}
        </View>

        <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
          {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRecentItem = ({ item }: { item: FriendItem }) => {
    const selected = selectedIds.includes(item.user_id);
    return (
      <TouchableOpacity
        style={[styles.friendRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
        activeOpacity={0.7}
        onPress={() => toggleFriend(item.user_id)}
      >
        <Image source={getAvatarSource(item.avatar_url)} style={styles.avatar} />
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>{item.display_name}</Text>
          <Text style={[styles.friendSub, { color: colors.textSecondary }]} numberOfLines={1}>{formatRecentLabel(item)}</Text>
        </View>
        <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
          {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: COLORS.primary, borderBottomColor: COLORS.primary }]}> 
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>Nhóm mới</Text>
          <Text style={[styles.selectedText, { color: 'rgba(255,255,255,0.85)' }]}>Đã chọn: {selectedIds.length}/{MAX_CREATE_GROUP_SELECTABLE_MEMBERS}</Text>
        </View>
      </View>

      <View style={styles.nameRow}>
        <TouchableOpacity
          style={[styles.cameraIconWrap, { backgroundColor: colors.card }]}
          onPress={() => setAvatarPickerVisible(true)}
          activeOpacity={0.8}
        >
          {groupAvatarUri ? (
            <Image
              source={
                groupAvatarUri.startsWith('http')
                  ? { uri: groupAvatarUri }
                  : getAvatarSource(groupAvatarUri)
              }
              style={styles.groupAvatarPreview}
            />
          ) : (
            <Ionicons name="camera" size={24} color={isDark ? colors.textSecondary : '#70757C'} />
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="image-outline" size={10} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.nameInputWrap}>
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Đặt tên nhóm"
            placeholderTextColor={colors.textSecondary}
            style={[styles.nameInput, { color: colors.text }]}
            maxLength={100}
          />

          <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>Chạm để chọn ảnh nhóm</Text>
        </View>
      </View>

      <Modal
        visible={avatarPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAvatarPickerVisible(false)}
        >
          <View style={styles.avatarPickerCard}>
            <Text style={styles.avatarPickerTitle}>Chọn ảnh nhóm</Text>

            <TouchableOpacity
              style={styles.avatarPickerOption}
              onPress={async () => {
                setAvatarPickerVisible(false);
                setPresetAvatarPickerVisible(true);
              }}
            >
              <Ionicons name="images-outline" size={22} color={COLORS.primary} />
              <Text style={styles.avatarPickerOptionText}>Ảnh từ Fruvia Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarPickerOption}
              onPress={async () => {
                setAvatarPickerVisible(false);
                await handlePickGroupAvatarFromLibrary();
              }}
            >
              <Ionicons name="phone-portrait-outline" size={22} color={COLORS.primary} />
              <Text style={styles.avatarPickerOptionText}>Ảnh từ máy</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={presetAvatarPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPresetAvatarPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPresetAvatarPickerVisible(false)}
        >
          <View style={styles.presetAvatarCard}>
            <Text style={styles.avatarPickerTitle}>Ảnh đại diện đề xuất</Text>
            <View style={styles.presetAvatarGrid}>
              {FRUVIA_GROUP_IMAGE_OPTIONS.map((avatarPath) => (
                <TouchableOpacity
                  key={avatarPath}
                  style={styles.presetAvatarItem}
                  onPress={() => {
                    setGroupAvatarUri(avatarPath);
                    setPresetAvatarPickerVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Image source={getAvatarSource(avatarPath)} style={styles.presetAvatarImage} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.presetDoneBtn}
              onPress={() => setPresetAvatarPickerVisible(false)}
            >
              <Text style={styles.presetDoneBtnText}>Xong</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surface : '#F1F2F4' }]}> 
        <Ionicons name="search" size={24} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm tên hoặc số điện thoại"
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.text }]}
        />
        <TouchableOpacity style={styles.numericBtn} activeOpacity={0.8}>
          <Text style={[styles.numericBtnText, { color: colors.textSecondary }]}>123</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('recent')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'recent' && styles.tabTextActive]}>GẦN ĐÂY</Text>
          <View style={[styles.tabUnderline, activeTab === 'recent' && styles.tabUnderlineActive]} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('contacts')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'contacts' && styles.tabTextActive]}>DANH BẠ</Text>
          <View style={[styles.tabUnderline, activeTab === 'contacts' && styles.tabUnderlineActive]} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'recent' ? recentFriends : listData}
          keyExtractor={(item) => getFriendListItemKey(item)}
          renderItem={activeTab === 'recent' ? renderRecentItem : renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <TouchableOpacity
              style={[styles.createBottomBtn, (!groupName.trim() || selectedIds.length === 0 || submitting) && styles.createBtnDisabled]}
              onPress={handleCreateGroup}
              disabled={!groupName.trim() || selectedIds.length === 0 || submitting}
              activeOpacity={0.85}
            >
              <Text style={styles.createBottomBtnText}>{submitting ? '...' : 'Tạo nhóm'}</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Không tìm thấy bạn bè phù hợp</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedText: {
    marginTop: 2,
    fontSize: 10,
  },
  createBtnDisabled: {
    backgroundColor: '#9DBEF9',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  cameraIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  groupAvatarPreview: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  nameInputWrap: {
    flex: 1,
  },
  nameInput: {
    fontSize: 15,
    paddingVertical: 6,
  },
  avatarHint: {
    marginTop: 4,
    fontSize: 11,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    minHeight: 46,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 12,
  },
  numericBtn: {
    width: 38,
    height: 28,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BFC5CE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: '#F7F8FA',
  },
  numericBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D9DDE3',
    marginHorizontal: 16,
    marginTop: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A5A8AE',
  },
  tabTextActive: {
    color: '#212121',
  },
  tabUnderline: {
    marginTop: 12,
    width: '100%',
    height: 2,
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: {
    backgroundColor: '#212121',
  },
  listContent: {
    paddingBottom: 32,
  },
  letterRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#F5F6F8',
  },
  letterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '500',
  },
  friendSub: {
    marginTop: 2,
    fontSize: 10,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#999FA8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 11,
  },
  createBottomBtn: {
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 12,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBottomBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  avatarPickerCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  avatarPickerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  avatarPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  avatarPickerOptionText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  presetAvatarCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  presetAvatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetAvatarItem: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  presetAvatarImage: {
    width: '100%',
    height: '100%',
  },
  presetDoneBtn: {
    alignSelf: 'flex-end',
    marginTop: 18,
    minWidth: 120,
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
