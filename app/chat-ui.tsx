import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { chatService } from '@/services/chatService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Keyboard,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatItem {
  id: string;
  title: string;
  lastMessage: string;
  avatar: string;
  time: string;
  unreadCount?: number;
  type: 'AI' | 'Cloud' | 'Default';
}

const DEFAULT_CLOUD_AVATAR = 'https://cdn-icons-png.flaticon.com/512/414/414974.png';
const DEFAULT_USER_AVATAR = 'https://randomuser.me/api/portraits/men/12.jpg';

const DEFAULT_CHAT_ITEMS: ChatItem[] = [
  {
    id: 'default-ai',
    title: 'AI',
    lastMessage: 'Trợ lý AI của bạn sẵn sàng giúp tìm kiếm.',
    avatar: DEFAULT_USER_AVATAR,
    time: 'Mới',
    type: 'AI',
  },
  {
    id: 'default-cloud',
    title: 'Cloud của tôi',
    lastMessage: 'Lưu trữ nhanh và tìm lại nội dung dễ dàng.',
    avatar: DEFAULT_CLOUD_AVATAR,
    time: 'Mới',
    type: 'Cloud',
  },
];

function formatTimestamp(value: unknown) {
  const date = new Date(value as string);
  if (isNaN(date.getTime())) {
    return 'Mới';
  }
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function normalizeToChatItems(data: any[]): ChatItem[] {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  return data.map((item) => ({
    id: item.conversationId,
    title: item.conversationName || (item.members && item.members.length > 0 ? item.members[0].displayName : 'Unknown'),
    lastMessage: item.lastMessageContent || 'No messages',
    avatar: item.conversationAvatarUrl || (item.members && item.members.length > 0 ? item.members[0].avatarUrl : DEFAULT_USER_AVATAR),
    time: item.lastMessageTime ? formatTimestamp(item.lastMessageTime) : 'New',
    unreadCount: item.unreadCount || 0,
    type: item.conversationType === 'PRIVATE' ? 'Default' : 'Cloud', // Adjust based on type
  }));
}

export default function ChatUI() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ChatItem[]>(DEFAULT_CHAT_ITEMS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = async (searchQuery?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = (await chatService.getConversations(0, 20, searchQuery?.trim())) as any;
      const data = Array.isArray(response)
        ? response
        : response?.conversations ?? response?.items ?? response?.data ?? [];

      setItems(normalizeToChatItems(data));
    } catch (err) {
      setError('Tải danh sách chat thất bại. Vui lòng thử lại.');
      setItems(DEFAULT_CHAT_ITEMS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  const handleSearch = () => {
    Keyboard.dismiss();
    fetchChats(query);
  };

  const handleClearSearch = () => {
    setQuery('');
    fetchChats();
  };

  const renderItem = ({ item }: { item: ChatItem }) => (
    <TouchableOpacity
      style={[styles.chatItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/chat-detail?id=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.title)}`)}
    >
      <Image source={{ uri: item.avatar }} style={[styles.avatar, { borderColor: colors.border }]} />

      <View style={styles.chatInfo}>
        <View style={styles.chatTopRow}>
          <Text style={[styles.chatTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.chatTime, { color: colors.textSecondary }]}>{item.time}</Text>
        </View>

        <Text style={[styles.chatSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>

      {item.unreadCount ? (
        <View style={[styles.unreadBadge, { backgroundColor: COLORS.primary }]}> 
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}> 
        <Text style={[styles.pageTitle, { color: colors.text }]}>Chat của tôi</Text>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder={t('chat.search') ?? 'Tìm kiếm đoạn chat'}
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Đang tải chat...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.text, textAlign: 'center' }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    minHeight: 40,
  },
  clearButton: {
    padding: 4,
  },
  listContent: {
    paddingVertical: 12,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 14,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 11,
  },
  chatSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    marginLeft: 86,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
});
