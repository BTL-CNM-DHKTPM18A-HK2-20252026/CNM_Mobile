import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { COLORS } from '@/constants/theme';
import { friendService } from '@/services/friendService';
import { chatService } from '@/services/chatService';
import { getAvatarSource } from '@/services/mediaUtils';

type FriendItem = {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type ListItem =
  | { type: 'header'; letter: string; id: string }
  | { type: 'friend'; friend: FriendItem; id: string };

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
    }))
    .filter((item: FriendItem) => item.user_id && item.display_name)
    .sort((a: FriendItem, b: FriendItem) => a.display_name.localeCompare(b.display_name, 'vi'));
}

export default function CreateGroupScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [groupName, setGroupName] = useState('');
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const listData = useMemo(() => {
    const output: ListItem[] = [];
    let currentLetter = '';

    filteredFriends.forEach((friend) => {
      const letter = friend.display_name.charAt(0).toUpperCase();

      if (letter !== currentLetter) {
        currentLetter = letter;
        output.push({
          type: 'header',
          letter,
          id: `header-${letter}`,
        });
      }

      output.push({
        type: 'friend',
        friend,
        id: `friend-${friend.user_id}`,
      });
    });

    return output;
  }, [filteredFriends]);

  const toggleFriend = (userId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
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
      const response = await chatService.createGroupConversation(trimmedName, selectedIds);
      const payload = chatService.unwrapApiPayload<any>(response);
      const conversationId = String(payload?.conversationId ?? payload?.conversation_id ?? payload?.id ?? '');

      if (!conversationId) {
        Alert.alert('Tạo nhóm thành công', 'Không lấy được mã hội thoại để mở chat.');
        router.back();
        return;
      }

      router.replace(
        `/chat-detail?id=${encodeURIComponent(conversationId)}&name=${encodeURIComponent(trimmedName)}&type=GROUP`
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

    const selected = selectedIds.includes(item.friend.user_id);

    return (
      <TouchableOpacity
        style={[styles.friendRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
        activeOpacity={0.7}
        onPress={() => toggleFriend(item.friend.user_id)}
      >
        <Image source={getAvatarSource(item.friend.avatar_url)} style={styles.avatar} />

        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
            {item.friend.display_name}
          </Text>
          {item.friend.email ? (
            <Text style={[styles.friendSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.friend.email}
            </Text>
          ) : null}
        </View>

        <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
          {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.border }]}> 
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Nhóm mới</Text>
          <Text style={[styles.selectedText, { color: colors.textSecondary }]}>Đã chọn: {selectedIds.length}</Text>
        </View>

        <TouchableOpacity
          style={[styles.createBtn, (!groupName.trim() || selectedIds.length === 0 || submitting) && styles.createBtnDisabled]}
          onPress={handleCreateGroup}
          disabled={!groupName.trim() || selectedIds.length === 0 || submitting}
        >
          <Text style={styles.createBtnText}>{submitting ? '...' : 'Tạo'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nameRow}>
        <View style={[styles.cameraIconWrap]}> 
          <Ionicons name="camera" size={24} color={isDark ? colors.textSecondary : '#70757C'} />
        </View>

        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Đặt tên nhóm"
          placeholderTextColor={colors.textSecondary}
          style={[styles.nameInput, { color: colors.text }]}
          maxLength={100}
        />
      </View>

      <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surface : '#F1F2F4' }]}> 
        <Ionicons name="search" size={26} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Nhập tên để tìm kiếm..."
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Không tìm thấy bạn bè phù hợp</Text>
            </View>
          }
        />
      )}
    </View>
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
    paddingHorizontal: 10,
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
    fontSize: 17,
    fontWeight: '600',
  },
  selectedText: {
    marginTop: 2,
    fontSize: 11,
  },
  createBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  createBtnDisabled: {
    backgroundColor: '#9DBEF9',
  },
  createBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cameraIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  letterRow: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#F1F2F4',
  },
  letterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 28,
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
    fontSize: 11,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 17,
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
    fontSize: 12,
  },
});
