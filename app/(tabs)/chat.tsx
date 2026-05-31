import { COLORS } from '@/constants/theme';
import { usePresence } from '@/context/PresenceContext';
import { chatService } from '@/services/chatService';
import { getAvatarSource } from '@/services/mediaUtils';
import { Ionicons } from '@expo/vector-icons';
import { Client, type StompSubscription } from '@stomp/stompjs';
import { router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextDecoder as PolyfillTextDecoder, TextEncoder as PolyfillTextEncoder } from 'text-encoding';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv', '3gp', 'wmv']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac']);

function getStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function getFileExtensionFromValue(value: string): string {
  const clean = value.split('?')[0].split('#')[0];
  const fileName = clean.split('/').pop() ?? clean;
  const ext = fileName.includes('.') ? fileName.split('.').pop() ?? '' : '';
  return ext.toLowerCase();
}

function inferMediaTypeFromValue(value: string): 'IMAGE' | 'VIDEO' | 'VOICE' | 'FILE' | null {
  const raw = getStringValue(value);
  if (!raw) return null;

  const extension = getFileExtensionFromValue(raw);
  if (IMAGE_EXTENSIONS.has(extension)) return 'IMAGE';
  if (VIDEO_EXTENSIONS.has(extension)) return 'VIDEO';
  if (AUDIO_EXTENSIONS.has(extension)) return 'VOICE';

  return null;
}

function formatMediaLabel(messageType: string, fileName?: string, attachmentCount?: number): string {
  switch (messageType) {
    case 'IMAGE':
      return 'Hình ảnh';
    case 'IMAGE_GROUP':
      return attachmentCount && attachmentCount > 1 ? `${attachmentCount} hình ảnh` : 'Hình ảnh';
    case 'VIDEO':
      return 'Video';
    case 'VOICE':
      return 'Tin nhắn thoại';
    case 'FILE':
    case 'MEDIA':
      return fileName ? `Tệp: ${fileName}` : 'Tệp đính kèm';
    case 'SHARE_CONTACT':
      return 'Danh thiếp';
    default:
      return 'Nội dung media';
  }
}

function extractConversationPreview(rawValue: unknown): {
  text: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'VOICE' | 'FILE' | 'IMAGE_GROUP' | 'MEDIA' | 'SHARE_CONTACT' | null;
  fileName: string;
  attachmentCount: number;
} {
  const state = {
    textParts: [] as string[],
    mediaType: null as 'IMAGE' | 'VIDEO' | 'VOICE' | 'FILE' | 'IMAGE_GROUP' | 'MEDIA' | 'SHARE_CONTACT' | null,
    fileName: '',
    attachmentCount: 0,
  };

  const visit = (node: any): void => {
    if (!node) return;

    if (typeof node === 'string') {
      const text = node.trim();
      if (text) state.textParts.push(text);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (typeof node !== 'object') return;

    const nodeType = getStringValue(node.type ?? node.messageType ?? node.kind).toUpperCase();
    if (!state.mediaType) {
      if (nodeType === 'IMAGE_GROUP') state.mediaType = 'IMAGE_GROUP';
      else if (nodeType === 'IMAGE') state.mediaType = 'IMAGE';
      else if (nodeType === 'VIDEO') state.mediaType = 'VIDEO';
      else if (nodeType === 'VOICE' || nodeType === 'AUDIO') state.mediaType = 'VOICE';
      else if (nodeType === 'FILE') state.mediaType = 'FILE';
      else if (nodeType === 'MEDIA') state.mediaType = 'MEDIA';
      else if (nodeType === 'SHARE_CONTACT') state.mediaType = 'SHARE_CONTACT';
    }

    const text = getStringValue(node.text ?? node.value ?? node.label ?? node.name);
    if (text) {
      state.textParts.push(text);
    }

    if (!state.fileName) {
      state.fileName = getStringValue(
        node.fileName ?? node.filename ?? node.attrs?.fileName ?? node.attrs?.name ?? node.meta?.fileName
      );
    }

    if (!state.mediaType) {
      const urlCandidate = getStringValue(
        node.url ?? node.src ?? node.contentUrl ?? node.mediaUrl ?? node.path ?? node.attrs?.src ?? node.attrs?.url
      );
      if (urlCandidate) {
        state.mediaType = inferMediaTypeFromValue(urlCandidate) ?? null;
        if (!state.fileName) {
          const fileName = getStringValue(node.fileName ?? node.attrs?.fileName ?? node.attrs?.name);
          if (fileName) state.fileName = fileName;
        }
      }
    }

    const attachments = Array.isArray(node.attachments) ? node.attachments : [];
    if (attachments.length > 0) {
      state.attachmentCount += attachments.length;
      if (!state.mediaType) state.mediaType = 'IMAGE_GROUP';
    }

    if (Array.isArray(node.content)) visit(node.content);
    if (Array.isArray(node.children)) visit(node.children);
    if (Array.isArray(node.items)) visit(node.items);
    if (Array.isArray(node.nodes)) visit(node.nodes);
    if (Array.isArray(node.markup)) visit(node.markup);
    if (Array.isArray(node.attachments)) visit(node.attachments);
  };

  const rawText = getStringValue(rawValue);
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      visit(parsed);
    } catch {
      state.textParts.push(rawText);
    }
  }

  const text = stripHtml(state.textParts.join(' ').replace(/\s+/g, ' ').trim());
  if (!state.mediaType && rawText) {
    state.mediaType = inferMediaTypeFromValue(rawText) ?? null;
  }

  return {
    text,
    mediaType: state.mediaType,
    fileName: state.fileName,
    attachmentCount: state.attachmentCount,
  };
}

function buildConversationPreview(item: any, currentUserId?: string | null): string {
  const rawSenderId = getStringValue(
    item.lastMessageSenderId ?? item.lastSenderId ?? item.senderId ?? item.authorId ?? item.messageSenderId
  );
  const rawSenderName = getStringValue(
    item.lastMessageSenderName ?? item.lastSenderName ?? item.senderName ?? item.authorName ?? item.messageSenderName
  );
  const isSelf = Boolean(currentUserId && rawSenderId && String(currentUserId) === rawSenderId);
  const senderLabel = isSelf ? 'Bạn' : rawSenderName;

  const rawPreviewSource =
    item.lastMessageContent ??
    item.lastMessage ??
    item.preview ??
    item.snippet ??
    item.content ??
    item.caption ??
    '';

  const explicitType = getStringValue(
    item.lastMessageType ?? item.messageType ?? item.lastMessageKind ?? item.kind ?? item.type
  ).toUpperCase();
  const parsed = extractConversationPreview(rawPreviewSource);
  const inferredType = explicitType || parsed.mediaType || inferMediaTypeFromValue(parsed.text || getStringValue(rawPreviewSource)) || '';

  let previewText = parsed.text;

  if (inferredType === 'IMAGE_GROUP') {
    previewText = formatMediaLabel('IMAGE_GROUP', parsed.fileName, parsed.attachmentCount);
  } else if (
    inferredType === 'IMAGE' ||
    inferredType === 'VIDEO' ||
    inferredType === 'VOICE' ||
    inferredType === 'FILE' ||
    inferredType === 'MEDIA' ||
    inferredType === 'SHARE_CONTACT'
  ) {
    previewText = formatMediaLabel(inferredType, parsed.fileName, parsed.attachmentCount);
  }

  if (!previewText) {
    previewText = parsed.mediaType
      ? formatMediaLabel(parsed.mediaType, parsed.fileName, parsed.attachmentCount)
      : 'Chưa có tin nhắn';
  }

  if (senderLabel) {
    return `${senderLabel}: ${previewText}`;
  }

  return previewText;
}

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
  pinnedAt?: string | null;
  mutedUntil?: string | null;
  isMarkedUnread?: boolean;
  type: ConversationType;
  otherUserId?: string;
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
  title: 'Fruvia Chatbot',
  lastMessage: 'Hỏi đáp với Fruvia Chatbot',
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
  return normalized === 'fruvia ai' || normalized === 'fruvia chat ai' || normalized === 'fruvia chatbot';
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
        ? 'Fruvia Chatbot'
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

    const lastMessage = buildConversationPreview(item, currentUserId);

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
      pinnedAt: (item.pinnedAt ?? item.pinned_at ?? null) as string | null | undefined,
      mutedUntil: (item.mutedUntil ?? item.muted_until ?? null) as string | null | undefined,
      isMarkedUnread: Boolean(item.isMarkedUnread ?? item.markedUnread ?? false),
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
  const { isOnline } = usePresence();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ChatItem[]>(FALLBACK_ITEMS);
  const [quickMenuVisible, setQuickMenuVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ item: ChatItem } | null>(null);
  const [showMuteSubMenu, setShowMuteSubMenu] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [hideTargetId, setHideTargetId] = useState<string | null>(null);

  // Sort: pinned first (newest pin first), then by time
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aPinned = !!a.pinned;
      const bPinned = !!b.pinned;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (aPinned && bPinned) {
        const aPinTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
        const bPinTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
        return bPinTime - aPinTime;
      }
      return 0; // Keep API order for non-pinned
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return sortedItems;

    return sortedItems.filter(
      (item) =>
        item.title.toLowerCase().includes(keyword) ||
        item.lastMessage.toLowerCase().includes(keyword)
    );
  }, [sortedItems, query]);

  const fetchConversations = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
    }
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
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchConversations({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [fetchConversations]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  // Re-fetch khi quay lại tab (giống Web: luôn đồng bộ conversation list)
  useFocusEffect(
    useCallback(() => {
      void fetchConversations();
    }, [fetchConversations])
  );

  // Subscribe STOMP friend-events → re-fetch khi có ACCEPTED (giống Web: ChatDashboardLegacy)
  const stompClientRef = useRef<Client | null>(null);
  const stompSubRefs = useRef<StompSubscription[]>([]);

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
          const friendSub = client.subscribe(`/topic/friend-events/${userId}`, (msg) => {
            if (msg.body === 'ACCEPTED') {
              void fetchConversations({ silent: true });
            }
          });

          const groupSub = client.subscribe(`/topic/group-events/${userId}`, (msg) => {
            try {
              const payload = JSON.parse(msg.body || '{}') as Record<string, unknown>;
              const eventType = String(payload?.type ?? '').toUpperCase();
              const eventConversationId = String(payload?.conversationId ?? payload?.id ?? '');

              if ((eventType === 'REMOVED' || eventType === 'DISSOLVED') && eventConversationId) {
                setItems((prev) => prev.filter((item) => String(item.id) !== eventConversationId));
              }

              void fetchConversations({ silent: true });
            } catch {
              void fetchConversations({ silent: true });
            }
          });

          stompSubRefs.current = [friendSub, groupSub];

          // Listen for conversation pin updates from other devices
          const convSub = client.subscribe(`/topic/conversation-events/${userId}`, (msg) => {
            try {
              const payload = JSON.parse(msg.body || '{}') as Record<string, unknown>;
              if (String(payload?.type ?? '') === 'PIN_UPDATED') {
                const evtConvId = String(payload?.conversationId ?? '');
                const evtPinned = Boolean(payload?.isPinned);
                const evtPinnedAt = (payload?.pinnedAt as string) ?? null;
                if (evtConvId) {
                  setItems((prev) => prev.map((item) =>
                    String(item.id) === evtConvId
                      ? { ...item, pinned: evtPinned, pinnedAt: evtPinnedAt }
                      : item
                  ));
                }
              }
            } catch {
              // ignore
            }
          });

          stompSubRefs.current = [friendSub, groupSub, convSub];
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
      stompSubRefs.current.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch {
          // Best-effort cleanup
        }
      });
      stompSubRefs.current = [];
      stompClientRef.current?.deactivate();
    };
  }, [fetchConversations]);

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

  const handleMuteConversation = async (convId: string, duration: string) => {
    try {
      await chatService.muteConversation(convId, duration);
      setItems((prev) => prev.map((item) => {
        if (String(item.id) !== convId) return item;
        if (duration === 'off') return { ...item, mutedUntil: null };
        const now = new Date();
        switch (duration) {
          case '1h': now.setHours(now.getHours() + 1); break;
          case '4h': now.setHours(now.getHours() + 4); break;
          case 'until_8am': now.setHours(8, 0, 0, 0); if (now <= new Date()) now.setDate(now.getDate() + 1); break;
          case 'forever': return { ...item, mutedUntil: '2099-12-31T23:59:59' };
        }
        return { ...item, mutedUntil: now.toISOString() };
      }));
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể tắt thông báo');
    }
  };

  const handleMarkUnread = async (convId: string) => {
    try {
      await chatService.markUnread(convId);
      setItems((prev) => prev.map((item) =>
        String(item.id) === convId ? { ...item, isMarkedUnread: true, unreadCount: Math.max(item.unreadCount, 1) } : item
      ));
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể đánh dấu chưa đọc');
    }
  };

  const handleHideConversation = async (convId: string) => {
    setHideTargetId(convId);
    setShowPinInput(true);
    setPinInput('');
  };

  const confirmHide = async () => {
    const convId = hideTargetId;
    if (!convId || pinInput.length !== 6) return;
    try {
      await chatService.hideConversation(convId, pinInput);
      setItems((prev) => prev.filter((item) => String(item.id) !== convId));
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể ẩn hội thoại');
    } finally {
      setShowPinInput(false);
      setPinInput('');
      setHideTargetId(null);
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

  const handlePinConversation = async (convId: string, isPinned: boolean) => {
    // Optimistic update
    setItems((prev) => prev.map((item) =>
      String(item.id) === convId
        ? { ...item, pinned: !isPinned, pinnedAt: !isPinned ? new Date().toISOString() : null }
        : item
    ));

    try {
      const res = await chatService.togglePinConversation(convId) as any;
      const newPinned = res?.data?.isPinned ?? res?.isPinned ?? !isPinned;
      const newPinnedAt = (res?.data?.pinnedAt ?? res?.pinnedAt ?? null) as string | null;
      setItems((prev) => prev.map((item) =>
        String(item.id) === convId
          ? { ...item, pinned: newPinned, pinnedAt: newPinnedAt }
          : item
      ));
    } catch (e: any) {
      // Revert on failure
      setItems((prev) => prev.map((item) =>
        String(item.id) === convId
          ? { ...item, pinned: isPinned, pinnedAt: isPinned ? item.pinnedAt : null }
          : item
      ));
      Alert.alert('Lỗi', e?.message || 'Không thể ghim/bỏ ghim hội thoại');
    }
  };

  const renderItem = ({ item }: { item: ChatItem }) => {
    return (
      <View>
        <TouchableOpacity
          style={styles.chatItem}
          onPress={() => handleOpenConversation(item)}
          onLongPress={() => setContextMenu({ item })}
          activeOpacity={0.8}
        >
          {renderAvatar(item)}

          <View style={styles.chatContent}>
            <View style={styles.chatTopLine}>
              <Text style={styles.chatTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.timeAndPinWrap}>
                {item.pinned ? <Ionicons name="pin" size={13} color="#A5A8AE" style={styles.pinIcon} /> : null}
                {item.mutedUntil ? <Ionicons name="volume-mute" size={13} color="#F87171" style={styles.pinIcon} /> : null}
                <Text style={styles.timeText}>{item.timeText}</Text>
              </View>
            </View>

            <View style={styles.lastMessageRow}>
              <Text style={styles.lastMessageText} numberOfLines={1}>
                {item.lastMessage}
              </Text>
              {item.isMarkedUnread ? <View style={styles.markedUnreadDot} /> : null}
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.separator} />
      </View>
    );
  };

  const openQuickMenu = () => {
    setQuickMenuVisible((prev) => !prev);
  };

  const closeQuickMenu = () => {
    setQuickMenuVisible(false);
  };

  const handleAddFriendPress = () => {
    closeQuickMenu();
    router.push('/search');
  };

  const handleCreateGroupPress = () => {
    closeQuickMenu();
    router.push('/create-group');
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

          <TouchableOpacity style={styles.topActionButton} onPress={openQuickMenu}>
            <Ionicons name="add" size={30} color="#E7F0FF" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={quickMenuVisible} transparent animationType="fade" onRequestClose={closeQuickMenu}>
        <Pressable style={styles.quickMenuOverlay} onPress={closeQuickMenu}>
          <View style={[styles.quickMenuCard, { top: insets.top + 50 }]}>
            <TouchableOpacity style={styles.quickMenuItem} activeOpacity={0.75} onPress={handleAddFriendPress}>
              <Ionicons name="person-add-outline" size={18} color="#2E7DE9" />
              <Text style={styles.quickMenuText}>Thêm bạn</Text>
            </TouchableOpacity>

            <View style={styles.quickMenuDivider} />

            <TouchableOpacity style={styles.quickMenuItem} activeOpacity={0.75} onPress={handleCreateGroupPress}>
              <Ionicons name="people-outline" size={18} color="#2E7DE9" />
              <Text style={styles.quickMenuText}>Tạo nhóm</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Context menu (long press) */}
      <Modal visible={contextMenu !== null} transparent animationType="fade" onRequestClose={() => { setContextMenu(null); setShowMuteSubMenu(false); }}>
        <Pressable style={styles.quickMenuOverlay} onPress={() => { setContextMenu(null); setShowMuteSubMenu(false); }}>
          {showMuteSubMenu ? (
            <View style={styles.contextMenuCard}>
              <Text style={[styles.contextMenuText, { paddingHorizontal: 16, paddingVertical: 6, color: '#888' }]}>Tắt thông báo</Text>
              {[
                { label: '1 giờ', value: '1h' },
                { label: '4 giờ', value: '4h' },
                { label: 'Đến 8 giờ sáng', value: 'until_8am' },
                { label: 'Đến khi được mở lại', value: 'forever' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.contextMenuItem}
                  activeOpacity={0.75}
                  onPress={() => {
                    const ctxItem = contextMenu?.item;
                    setContextMenu(null);
                    setShowMuteSubMenu(false);
                    if (ctxItem) handleMuteConversation(ctxItem.id, opt.value);
                  }}
                >
                  <Ionicons name="time-outline" size={18} color="#2E7DE9" />
                  <Text style={styles.contextMenuText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.quickMenuDivider} />
              <TouchableOpacity
                style={styles.contextMenuItem}
                activeOpacity={0.75}
                onPress={() => {
                  const ctxItem = contextMenu?.item;
                  setContextMenu(null);
                  setShowMuteSubMenu(false);
                  if (ctxItem) handleMuteConversation(ctxItem.id, 'off');
                }}
              >
                <Ionicons name="notifications" size={18} color="#10B981" />
                <Text style={[styles.contextMenuText, { color: '#10B981' }]}>Bật thông báo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.contextMenuCard}>
              <TouchableOpacity
                style={styles.contextMenuItem}
                activeOpacity={0.75}
                onPress={() => {
                  const ctxItem = contextMenu?.item;
                  if (ctxItem) {
                    setContextMenu(null);
                    handlePinConversation(ctxItem.id, ctxItem.pinned);
                  }
                }}
              >
                <Ionicons name={contextMenu?.item?.pinned ? 'pin-outline' : 'pin'} size={18} color="#2E7DE9" />
                <Text style={styles.contextMenuText}>{contextMenu?.item?.pinned ? 'Bỏ ghim' : 'Ghim'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contextMenuItem}
                activeOpacity={0.75}
                onPress={() => setShowMuteSubMenu(true)}
              >
                <Ionicons name="volume-mute" size={18} color="#F87171" />
                <Text style={styles.contextMenuText}>Tắt thông báo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contextMenuItem}
                activeOpacity={0.75}
                onPress={() => {
                  const ctxItem = contextMenu?.item;
                  setContextMenu(null);
                  if (ctxItem) handleMarkUnread(ctxItem.id);
                }}
              >
                <Ionicons name="ellipse-outline" size={18} color="#22C55E" />
                <Text style={styles.contextMenuText}>Đánh dấu chưa đọc</Text>
              </TouchableOpacity>

              <View style={styles.quickMenuDivider} />

              <TouchableOpacity
                style={styles.contextMenuItem}
                activeOpacity={0.75}
                onPress={() => {
                  const ctxItem = contextMenu?.item;
                  setContextMenu(null);
                  if (ctxItem) handleHideConversation(ctxItem.id);
                }}
              >
                <Ionicons name="eye-off-outline" size={18} color="#888" />
                <Text style={[styles.contextMenuText, { color: '#888' }]}>Ẩn trò chuyện</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Modal>

      {/* PIN Input Modal for Hide */}
      <Modal visible={showPinInput} transparent animationType="fade">
        <View style={styles.pinOverlay}>
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>Nhập mã PIN</Text>
            <Text style={styles.pinSubtitle}>Nhập PIN 6 số để ẩn hội thoại</Text>
            <TextInput
              style={styles.pinInput}
              value={pinInput}
              onChangeText={(t) => setPinInput(t.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor="#AAA"
            />
            <View style={styles.pinButtonRow}>
              <TouchableOpacity style={styles.pinCancelBtn} onPress={() => { setShowPinInput(false); setPinInput(''); setHideTargetId(null); }}>
                <Text style={styles.pinCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pinConfirmBtn, pinInput.length === 6 ? {} : { opacity: 0.4 }]}
                onPress={confirmHide}
                disabled={pinInput.length !== 6}
              >
                <Text style={styles.pinConfirmText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
              />
            }
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
  quickMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  quickMenuCard: {
    position: 'absolute',
    right: 12,
    width: 164,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  quickMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  quickMenuText: {
    marginLeft: 10,
    color: '#101317',
    fontSize: 13,
    fontWeight: '600',
  },
  quickMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E6EAF2',
    marginHorizontal: 12,
  },
  contextMenuCard: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    minWidth: 160,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  contextMenuText: {
    marginLeft: 10,
    color: '#101317',
    fontSize: 14,
    fontWeight: '600',
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markedUnreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    marginLeft: 6,
  },
  pinOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: 280,
    alignItems: 'center',
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#101317',
    marginBottom: 6,
  },
  pinSubtitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 20,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 8,
    color: '#101317',
  },
  pinButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  pinCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  pinCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  pinConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2E7DE9',
    alignItems: 'center',
  },
  pinConfirmText: {
    color: '#FFF',
    fontWeight: '600',
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
