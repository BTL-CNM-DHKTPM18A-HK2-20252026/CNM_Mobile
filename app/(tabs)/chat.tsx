import { chatService } from '@/services/chatService';
import { getAvatarSource } from '@/services/mediaUtils';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Client, type StompSubscription } from '@stomp/stompjs';
import { TextDecoder as PolyfillTextDecoder, TextEncoder as PolyfillTextEncoder } from 'text-encoding';

type ConversationType = 'PRIVATE' | 'GROUP' | 'CLOUD' | 'SYSTEM' | 'AI' | 'SELF';

interface ChatItem {
  id: string;
  title: string;
  lastMessage: string;
  avatarUrl?: string | null;
  groupAvatarUrl?: string | null;
  firstMemberAvatarUrl?: string | null;
  secondAvatarUrl?: string | null;
  thirdAvatarUrl?: string | null;
  groupMemberCount?: number;
  timeText: string;
  unreadCount: number;
  pinned: boolean;
  type: ConversationType;
}

const DEFAULT_CLOUD_ITEM: ChatItem = {
  id: 'default-cloud',
  title: 'Cloud của tôi',
  lastMessage: 'Truyền file giữa các thiết bị của bạn',
  avatarUrl: null,
  timeText: 'Mới',
  unreadCount: 0,
  pinned: true,
  type: 'CLOUD',
};

const DEFAULT_AI_ITEM: ChatItem = {
  id: 'default-ai',
  title: 'Fruvia AI',
  lastMessage: 'Hỏi đáp với Fruvia AI',
  avatarUrl: null,
  timeText: 'Mới',
  unreadCount: 0,
  pinned: true,
  type: 'AI',
};

const FALLBACK_ITEMS: ChatItem[] = [
  DEFAULT_CLOUD_ITEM,
  DEFAULT_AI_ITEM,
  {
    id: 'group-cnm-10',
    title: 'CNM - Nhóm 10',
    lastMessage: 'Trần Hồng Nhiên: kê huy',
    avatarUrl: '/default/image3.jpg',
    groupAvatarUrl: null,
    firstMemberAvatarUrl: '/default/image3.jpg',
    secondAvatarUrl: '/default/image4.jpg',
    thirdAvatarUrl: '/default/image5.jpg',
    groupMemberCount: 5,
    timeText: '35 phút',
    unreadCount: 0,
    pinned: false,
    type: 'GROUP',
  },
  {
    id: 'group-phongtro',
    title: 'Phòng trọ 3H',
    lastMessage: 'Hoàng Đẹp Trai: oke',
    avatarUrl: '/default/image4.jpg',
    groupAvatarUrl: null,
    firstMemberAvatarUrl: '/default/image4.jpg',
    secondAvatarUrl: '/default/image5.jpg',
    thirdAvatarUrl: '/default/image3.jpg',
    groupMemberCount: 4,
    timeText: '3 giờ',
    unreadCount: 0,
    pinned: false,
    type: 'GROUP',
  },
];

const WEEK_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function isAiConversationName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === 'fruvia ai' || normalized === 'fruvia chat ai';
}

function toTimeText(value: unknown): string {
  if (!value) return 'Mới';

  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return 'Mới';

  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Mới';
  if (diffMinutes < 60) return `${diffMinutes} phút`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ`;

  const dayDiff = Math.floor(diffHours / 24);
  if (dayDiff < 7) return WEEK_DAYS[parsed.getDay()];

  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
}

function normalizeConversations(rawData: any[], currentUserId?: string | null): ChatItem[] {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return FALLBACK_ITEMS;
  }

  return rawData.map((item, index) => {
    const members = Array.isArray(item.members) ? item.members : [];
    const primaryMember = members[0] ?? null;
    const secondMember = members[1] ?? null;
    const thirdMember = members[2] ?? null;
    const groupMemberCount = Number(item.memberCount ?? item.totalMembers ?? members.length ?? 0);

    const conversationTypeRaw = String(
      item.conversationType ?? item.type ?? item.kind ?? 'PRIVATE'
    ).toUpperCase();

    const normalizedCurrentUserId = currentUserId ? String(currentUserId) : '';
    const getMemberId = (member: any) => String(member?.userId ?? member?.user_id ?? member?.id ?? '');
    const otherMember = conversationTypeRaw === 'PRIVATE'
      ? members.find((member: any) => {
          const memberId = getMemberId(member);
          if (!memberId) {
            return false;
          }

          return normalizedCurrentUserId ? memberId !== normalizedCurrentUserId : true;
        }) ?? members[0] ?? null
      : null;

    const rawConversationName = String(item.conversationName ?? item.name ?? '').trim();
    const isSelfConversation = conversationTypeRaw === 'SELF';
    const isAiConversation = isSelfConversation && isAiConversationName(rawConversationName);
    const isCloudConversation = isSelfConversation && !isAiConversation;

    const conversationType: ConversationType = isAiConversation
      ? 'AI'
      : isCloudConversation
      ? 'CLOUD'
      : (conversationTypeRaw as ConversationType);

    const title =
      isAiConversation
        ? 'Fruvia AI'
        : isCloudConversation
        ? 'Cloud của tôi'
        : conversationTypeRaw === 'PRIVATE'
        ? otherMember?.displayName ??
          otherMember?.display_name ??
          otherMember?.fullName ??
          otherMember?.full_name ??
          item.conversationName ??
          item.name ??
          `Đoạn chat ${index + 1}`
        : item.conversationName ??
      item.name ??
      primaryMember?.displayName ??
      primaryMember?.fullName ??
      `Đoạn chat ${index + 1}`;

    const senderPrefix = item.lastMessageSenderName ? `${item.lastMessageSenderName}: ` : '';
    const lastMessage =
      item.lastMessageContent ??
      item.lastMessage ??
      item.preview ??
      item.snippet ??
      `${senderPrefix}Chưa có tin nhắn`;

    return {
      id: String(item.conversationId ?? item.id ?? item.userId ?? `conversation-${index}`),
      title,
      lastMessage,
      avatarUrl:
        (conversationTypeRaw === 'PRIVATE'
          ? otherMember?.avatarUrl ?? otherMember?.avatar_url
          : undefined) ??
        item.conversationAvatarUrl ??
        item.conversation_avatar_url ??
        item.avatarUrl ??
        item.avatar_url ??
        primaryMember?.avatarUrl ??
        primaryMember?.avatar_url ??
        (conversationType === 'GROUP' ? null : '/default/image1.jpg'),
      groupAvatarUrl:
        conversationType === 'GROUP'
          ? (item.conversationAvatarUrl ?? item.conversation_avatar_url ?? item.avatarUrl ?? item.avatar_url ?? null)
          : null,
      firstMemberAvatarUrl:
        conversationType === 'GROUP'
          ? (primaryMember?.avatarUrl ?? primaryMember?.avatar_url ?? null)
          : null,
      secondAvatarUrl:
        conversationType === 'GROUP' ? secondMember?.avatarUrl ?? null : null,
      thirdAvatarUrl:
        conversationType === 'GROUP' ? thirdMember?.avatarUrl ?? thirdMember?.avatar_url ?? null : null,
      groupMemberCount: conversationType === 'GROUP' ? groupMemberCount : undefined,
      timeText: toTimeText(item.lastMessageTime ?? item.updatedAt ?? item.lastUpdated ?? item.time),
      unreadCount: Number(item.unreadCount ?? item.unread ?? 0),
      pinned: Boolean(item.isPinned ?? item.pinned),
      type: conversationType,
    };
  });
}

function withDefaultConversations(items: ChatItem[]): ChatItem[] {
  const hasCloud = items.some(
    (item) => item.type === 'CLOUD' || item.title.trim().toLowerCase() === 'cloud của tôi'
  );
  const hasAi = items.some(
    (item) => item.type === 'AI' || isAiConversationName(item.title)
  );

  const defaults: ChatItem[] = [];
  if (!hasCloud) defaults.push(DEFAULT_CLOUD_ITEM);
  if (!hasAi) defaults.push(DEFAULT_AI_ITEM);

  return [...defaults, ...items];
}

function ensureTextEncodingPolyfill(): void {
  const g = globalThis as any;
  if (!g.TextEncoder) g.TextEncoder = PolyfillTextEncoder;
  if (!g.TextDecoder) g.TextDecoder = PolyfillTextDecoder;
}

function buildStompBrokerUrl(): string {
  const directBroker = process.env.EXPO_PUBLIC_STOMP_BROKER_URL;
  if (directBroker) return directBroker;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) return '';
  try {
    const parsed = new URL(apiUrl);
    const ws = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${ws}//${parsed.host}/ws-native`;
  } catch { return ''; }
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ChatItem[]>(FALLBACK_ITEMS);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(keyword) ||
        item.lastMessage.toLowerCase().includes(keyword)
    );
  }, [items, query]);

  const fetchConversations = async () => {
    setLoading(true);
    setError(null);

    try {
      // Keep Cloud + AI conversations in sync with web flow before listing.
      await Promise.allSettled([
        chatService.ensureSelfConversation(),
        chatService.ensureAiConversation(),
      ]);

      const response = (await chatService.getConversations(0, 40)) as any;
      const data = Array.isArray(response)
        ? response
        : response?.conversations ?? response?.items ?? response?.data ?? [];

      const currentUserId = await SecureStore.getItemAsync('user_id');

      setItems(withDefaultConversations(normalizeConversations(data, currentUserId)));
    } catch {
      setError('Không thể tải danh sách chat, đang hiển thị dữ liệu mẫu.');
      setItems(withDefaultConversations(FALLBACK_ITEMS));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Re-fetch khi quay lại tab (giống Web: luôn đồng bộ conversation list)
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  // Subscribe STOMP friend-events → re-fetch khi có ACCEPTED (giống Web: ChatDashboardLegacy)
  const stompClientRef = useRef<Client | null>(null);
  const stompSubRef = useRef<StompSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    const setupStomp = async () => {
      const userId = await SecureStore.getItemAsync('user_id');
      const token = await SecureStore.getItemAsync('user_token');
      const brokerURL = buildStompBrokerUrl();
      if (!userId || !token || !brokerURL) return;

      ensureTextEncodingPolyfill();

      const client = new Client({
        brokerURL,
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 5000,
        heartbeatIncoming: 25000,
        heartbeatOutgoing: 25000,
        debug: () => {},
        onConnect: () => {
          if (cancelled) { client.deactivate(); return; }
          const sub = client.subscribe(`/topic/friend-events/${userId}`, (msg) => {
            if (msg.body === 'ACCEPTED') {
              fetchConversations();
            }
          });
          stompSubRef.current = sub;
        },
        onStompError: () => {},
        onWebSocketError: () => {},
      });

      stompClientRef.current = client;
      client.activate();
    };

    setupStomp();

    return () => {
      cancelled = true;
      stompSubRef.current?.unsubscribe();
      stompClientRef.current?.deactivate();
    };
  }, []);

  const resolveConversationIdForOpen = async (item: ChatItem): Promise<string> => {
    if (item.type === 'CLOUD') {
      const resolvedId = await chatService.ensureSelfConversationId();
      return resolvedId ?? item.id;
    }

    if (item.type === 'AI') {
      const resolvedId = await chatService.ensureAiConversationId();
      return resolvedId ?? item.id;
    }

    return item.id;
  };

  const handleOpenConversation = async (item: ChatItem) => {
    try {
      const resolvedId = await resolveConversationIdForOpen(item);

      router.push(
        `/chat-detail?id=${encodeURIComponent(resolvedId)}&name=${encodeURIComponent(item.title)}&type=${encodeURIComponent(item.type)}&avatar=${encodeURIComponent(item.avatarUrl ?? '')}`
      );
    } catch {
      router.push(
        `/chat-detail?id=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.title)}&type=${encodeURIComponent(item.type)}&avatar=${encodeURIComponent(item.avatarUrl ?? '')}`
      );
    }
  };

  const renderAvatar = (item: ChatItem) => {
    if (item.type === 'AI') {
      return (
        <View style={[styles.singleAvatarWrap, styles.specialAvatarWrap, styles.aiAvatarWrap]}>
          <Ionicons name="sparkles" size={28} color="#FFFFFF" />
          {item.unreadCount > 0 ? (
            <View style={styles.unreadDotOnAvatar}>
              <Text style={styles.unreadDotText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      );
    }

    if (item.type === 'CLOUD') {
      return (
        <View style={[styles.singleAvatarWrap, styles.specialAvatarWrap, styles.cloudAvatarWrap]}>
          <Ionicons name="folder-open" size={28} color="#FFFFFF" />
          {item.unreadCount > 0 ? (
            <View style={styles.unreadDotOnAvatar}>
              <Text style={styles.unreadDotText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      );
    }

    if (item.type === 'GROUP') {
      const hasGroupAvatar = Boolean(item.groupAvatarUrl && !String(item.groupAvatarUrl).includes('/default/'));
      const avatarUrls = [item.firstMemberAvatarUrl, item.secondAvatarUrl, item.thirdAvatarUrl].filter(Boolean) as string[];
      const memberBadgeCount = Math.max(item.groupMemberCount ?? avatarUrls.length, 0);

      if (hasGroupAvatar) {
        return (
          <View style={styles.groupAvatarWrap}>
            <Image source={getAvatarSource(item.groupAvatarUrl)} style={styles.groupAvatarSingle} />
          </View>
        );
      }

      return (
        <View style={styles.groupAvatarWrap}>
          {avatarUrls[0] ? <Image source={getAvatarSource(avatarUrls[0])} style={styles.groupAvatarPrimary} /> : null}
          {avatarUrls[1] ? <Image source={getAvatarSource(avatarUrls[1])} style={styles.groupAvatarSecondary} /> : null}
          {avatarUrls[2] ? <Image source={getAvatarSource(avatarUrls[2])} style={styles.groupAvatarTertiary} /> : null}

          {memberBadgeCount > 0 ? (
            <View style={styles.unreadDotOnAvatar}>
              <Text style={styles.unreadDotText}>{memberBadgeCount > 99 ? '99+' : memberBadgeCount}</Text>
            </View>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.singleAvatarWrap}>
        <Image source={getAvatarSource(item.avatarUrl)} style={styles.singleAvatar} />
        {item.unreadCount > 0 ? (
          <View style={styles.unreadDotOnAvatar}>
            <Text style={styles.unreadDotText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderItem = ({ item }: { item: ChatItem }) => {
    return (
      <View>
        <TouchableOpacity style={styles.chatItem} onPress={() => handleOpenConversation(item)} activeOpacity={0.8}>
          {renderAvatar(item)}

          <View style={styles.chatContent}>
            <View style={styles.chatTopLine}>
              <Text style={styles.chatTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.timeAndPinWrap}>
                {item.pinned ? <Ionicons name="pin" size={13} color="#A5A8AE" style={styles.pinIcon} /> : null}
                <Text style={styles.timeText}>{item.timeText}</Text>
              </View>
            </View>

            <Text style={styles.lastMessageText} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.separator} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2E7DE9" />

      <View style={[styles.topHeader, { paddingTop: insets.top + 6 }]}>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={28} color="#FFFFFF" style={styles.searchIcon} />

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm kiếm"
            placeholderTextColor="#C9DCFF"
            returnKeyType="search"
            style={styles.searchInput}
            onSubmitEditing={Keyboard.dismiss}
          />

          <TouchableOpacity style={styles.topActionButton} onPress={() => router.push('/qr-scan')}>
            <Ionicons name="qr-code-outline" size={22} color="#E7F0FF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.topActionButton} onPress={() => router.push('/search')}>
            <Ionicons name="add" size={30} color="#E7F0FF" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#2F80ED" />
          <Text style={styles.stateText}>Đang tải hội thoại...</Text>
        </View>
      ) : (
        <>
          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: '#3A8BF4',
  },
  searchRow: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 0,
  },
  searchIcon: {
    marginLeft: 2,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 12,
    paddingHorizontal: 10,
  },
  topActionButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  errorBanner: {
    color: '#D14545',
    backgroundColor: '#FFF3F3',
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 11,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  chatItem: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  singleAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  specialAvatarWrap: {
    borderWidth: 1,
    borderColor: '#E6EAF2',
  },
  aiAvatarWrap: {
    backgroundColor: '#4F74E8',
  },
  cloudAvatarWrap: {
    backgroundColor: '#0068FF',
  },
  singleAvatar: {
    width: 56,
    height: 56,
    borderRadius: 50,
    backgroundColor: '#E9EEF5',
  },
  groupAvatarWrap: {
    width: 56,
    height: 56,
    position: 'relative',
    justifyContent: 'center',
  },
  groupAvatarPrimary: {
    position: 'absolute',
    left: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#E9EEF5',
  },
  groupAvatarSingle: {
    width: 60,
    height: 60,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#E9EEF5',
  },
  groupAvatarSecondary: {
    position: 'absolute',
    right: 2,
    top: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#E9EEF5',
  },
  groupAvatarTertiary: {
    position: 'absolute',
    left: 10,
    top: 20,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#E9EEF5',
  },
  unreadDotOnAvatar: {
    position: 'absolute',
    bottom: -3,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F4F8',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadDotText: {
    color: '#6C717C',
    fontSize: 10,
    fontWeight: '700',
  },
  chatContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  chatTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  chatTitle: {
    flex: 1,
    color: '#101317',
    fontSize: 13,
    fontWeight: '500',
    marginRight: 8,
  },
  timeAndPinWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinIcon: {
    marginRight: 4,
  },
  timeText: {
    color: '#8D929C',
    fontSize: 10,
    fontWeight: '500',
  },
  lastMessageText: {
    color: '#818792',
    fontSize: 12,
    lineHeight: 16,
  },
  separator: {
    height: 1,
    marginLeft: 82,
    marginRight: 10,
    backgroundColor: '#EFF1F5',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    marginTop: 10,
    color: '#8E949F',
    fontSize: 12,
  },
});
