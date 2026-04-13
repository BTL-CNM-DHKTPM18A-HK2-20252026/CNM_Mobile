import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useChatSocket } from '@/hooks/useChatSocket';
import { chatService } from '@/services/chatService';
import { chatFileService, type PickedMedia } from '@/services/chatFileService';
import { friendService } from '@/services/friendService';
import { getAvatarSource } from '@/services/mediaUtils';
import { Ionicons } from '@expo/vector-icons';
import type { AxiosError } from 'axios';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Video, ResizeMode, Audio } from 'expo-av';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  mapChatPayloadListToUiMessages,
  mapChatPayloadToUiMessage,
  type ChatUiReaction,
  type ChatUiMessage,
} from '../services/chatMessageAdapter';

interface Message {
  messageId: string;
  content: string;
  senderId: string;
  createdAt: string;
  senderName?: string;
  senderAvatarUrl?: string;
  messageType?: string;
  isEdited?: boolean;
  isRecalled?: boolean;
  reactions?: ChatUiReaction[];
  fileName?: string;
  fileSize?: number;
  caption?: string;
  videoDuration?: number;
  voiceDuration?: number;
  // Reply
  replyToMessageId?: string;
  replyToSenderName?: string;
  replyToContent?: string;
  replyToMessageType?: string;
  // Forward
  forwardedFromSenderName?: string;
}

interface PinnedMessageItem {
  id: string;
  messageId: string;
  content: string;
  senderName?: string;
  pinnedAt?: string;
}

interface MessagePageResponse {
  content?: unknown[];
  last?: boolean;
  totalPages?: number;
  number?: number;
}

interface ApiWrappedPayload<T> {
  success?: boolean;
  data?: T;
}

const PAGE_SIZE = 10;
const SCROLL_TOP_THRESHOLD = 48;
const DEBUG_CHAT_MESSAGES = __DEV__;
const AI_TYPING_USER_ID = 'FRUVIA_AI_ASSISTANT';
const BLOCK_GAP_MS = 5 * 60 * 1000;
const REACTION_EMOJIS = ['❤️', '👍', '😆', '😮', '😭', '😡'] as const;

const emojiToReactionType = (emoji: string): 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY' => {
  switch (emoji) {
    case '❤️':
      return 'LOVE';
    case '�':
      return 'HAHA';
    case '😮':
      return 'WOW';
    case '😭':
      return 'SAD';
    case '😡':
      return 'ANGRY';
    default:
      return 'LIKE';
  }
};

const buildReactionSummary = (reactions?: ChatUiReaction[]) => {
  if (!Array.isArray(reactions) || reactions.length === 0) {
    return [] as Array<{ emoji: string; count: number }>;
  }

  const counter = new Map<string, number>();
  reactions.forEach((reaction) => {
    const emoji = reaction.emoji || '👍';
    counter.set(emoji, (counter.get(emoji) || 0) + 1);
  });

  return Array.from(counter.entries()).map(([emoji, count]) => ({ emoji, count }));
};

const toLocalIsoLike = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
};

const getMessageMillis = (createdAt?: string) => {
  if (!createdAt) return NaN;

  const raw = String(createdAt).trim();
  if (!raw) return NaN;

  const parsed = new Date(raw).getTime();
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  const epoch = Number(raw);
  if (!Number.isNaN(epoch)) {
    return epoch;
  }

  return NaN;
};

const buildStompBrokerUrl = () => {
  const directBroker = process.env.EXPO_PUBLIC_STOMP_BROKER_URL;
  if (directBroker) {
    return directBroker;
  }

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(apiUrl);
    const wsProtocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${parsedUrl.host}/ws-native`;
  } catch {
    return '';
  }
};

const BROKER_URL = buildStompBrokerUrl();

const EMOJI_LIST = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
  '🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬',
  '🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸',
  '😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
  '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻',
  '👋','🤚','🖐️','✋','🖖','👌','🤌','✌️','🤞','🤟','🤘','🤙','👍','👎','✊','👊','🤛','🤜','👏','🙌',
  '🙏','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','💕','💞','💓','💗','💖','💘','💝','🎉','🎊',
  '🎈','🎁','🎀','🔥','⭐','✨','💫','🌟','🌈','☀️','🌙','❄️','🌸','🌺','🌻','🌹','🍀','🌊','🌍','🐶',
  '🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦',
  '🍎','🍊','🍋','🍇','🍓','🍒','🍑','🍍','🥭','🍕','🍔','🍟','🌭','🍿','🧁','🍰','🎂','☕','🍵','🥤',
];

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id, name, avatar, type } = useLocalSearchParams<{ id: string; name: string; avatar?: string; type?: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(String(id ?? ''));
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSendingAi, setIsSendingAi] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isMessageActionVisible, setIsMessageActionVisible] = useState(false);
  const [isPinnedListVisible, setIsPinnedListVisible] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessageItem[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isAttachMenuVisible, setIsAttachMenuVisible] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PickedMedia | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [fullscreenVideoUrl, setFullscreenVideoUrl] = useState<string | null>(null);

  // Info panel state — mirrors Web ChatInfoSidebar
  const [isInfoPanelVisible, setIsInfoPanelVisible] = useState(false);
  const [infoMembers, setInfoMembers] = useState<any[]>([]);
  const [infoMediaItems, setInfoMediaItems] = useState<any[]>([]);
  const [infoFileItems, setInfoFileItems] = useState<any[]>([]);
  const [infoStorageStats, setInfoStorageStats] = useState<any>(null);
  const [infoShowMembers, setInfoShowMembers] = useState(true);
  const [infoShowMedia, setInfoShowMedia] = useState(true);
  const [infoShowFiles, setInfoShowFiles] = useState(false);
  const [infoShowPinned, setInfoShowPinned] = useState(true);
  const [infoAddMemberVisible, setInfoAddMemberVisible] = useState(false);
  const [infoFriendsList, setInfoFriendsList] = useState<any[]>([]);
  const [infoSelectedMembers, setInfoSelectedMembers] = useState<string[]>([]);
  const [infoAddingMembers, setInfoAddingMembers] = useState(false);
  const [infoMemberMenuId, setInfoMemberMenuId] = useState<string | null>(null);
  const [infoShowTransferModal, setInfoShowTransferModal] = useState(false);
  const [infoTransferReason, setInfoTransferReason] = useState<'transfer' | 'leave'>('transfer');
  const [infoSelectedImage, setInfoSelectedImage] = useState<string | null>(null);

  // Reply, Forward, Share Contact
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [isShareContactVisible, setIsShareContactVisible] = useState(false);
  // Forward modal state
  const [fwdConversations, setFwdConversations] = useState<any[]>([]);
  const [fwdSearch, setFwdSearch] = useState('');
  const [fwdSelected, setFwdSelected] = useState<Set<string>>(new Set());
  const [fwdLoading, setFwdLoading] = useState(false);
  const [fwdSending, setFwdSending] = useState(false);
  // Share contact modal state
  const [scFriends, setScFriends] = useState<any[]>([]);
  const [scSearch, setScSearch] = useState('');
  const [scSelected, setScSelected] = useState<Set<string>>(new Set());
  const [scLoading, setScLoading] = useState(false);
  const [scSending, setScSending] = useState(false);
  const [scIncludePhone, setScIncludePhone] = useState(true);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  // Voice playback
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);
  const appStateRef = useRef(AppState.currentState);
  const loadingOlderRef = useRef(false);
  const shouldScrollToLatestRef = useRef(false);
  const peerAvatarSource = useMemo(() => getAvatarSource(avatar), [avatar]);
  const normalizedName = String(name ?? '').trim().toLowerCase();
  const normalizedType = String(type ?? '').trim().toUpperCase();
  const isAiConversation = normalizedType === 'AI' || normalizedName === 'fruvia chat ai' || normalizedName === 'fruvia ai';
  const isCloudConversation = normalizedType === 'CLOUD' || normalizedName === 'cloud của tôi';
  const isPrivateConversation = normalizedType === 'PRIVATE' || normalizedType === 'DIRECT';
  const isGroupConversation = normalizedType === 'GROUP';
  const showCallActions = !isCloudConversation && !isAiConversation;

  const canUseRealtimeIndicators = !isAiConversation && !isCloudConversation;
  const canUseMessageInteractions = isCloudConversation || isPrivateConversation || isGroupConversation;

  const headerSubtitleText = isAiConversation
    ? (isSendingAi ? t('chat.typing', 'Đang nhập...') : t('chat.ai_subheading', 'Hỏi đáp với Fruvia AI'))
    : isCloudConversation
    ? t('chat.cloud_subheading', 'Truyền file giữa các thiết bị của bạn')
    : isConnected
    ? (isTyping ? t('chat.typing', 'Đang nhập...') : t('chat.active', 'Đang hoạt động'))
    : t('chat.offline_recent', 'Truy cập gần đây');

  useEffect(() => {
    setConversationId(String(id ?? ''));
    setEditingMessageId(null);
    setInputText('');
    setIsPinnedListVisible(false);
    setIsMessageActionVisible(false);
    setSelectedMessage(null);
    setReplyingTo(null);
    setForwardingMsg(null);
  }, [id]);

  useEffect(() => {
    const ensureSpecialConversation = async () => {
      try {
        if (isCloudConversation) {
          const resolvedId = await chatService.ensureSelfConversationId();
          if (resolvedId) {
            setConversationId(resolvedId);
          }
          return;
        }

        if (isAiConversation) {
          const resolvedId = await chatService.ensureAiConversationId();
          if (resolvedId) {
            setConversationId(resolvedId);
          }
        }
      } catch (error) {
        console.error('Failed to resolve Cloud/AI conversation:', error);
      }
    };

    void ensureSpecialConversation();
  }, [id, isAiConversation, isCloudConversation]);

  const logChatDebug = useCallback((label: string, payload: unknown) => {
    if (!DEBUG_CHAT_MESSAGES) {
      return;
    }

    console.log(`[CHAT_DEBUG] ${label}`, payload);
  }, []);

  const scrollToLatest = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const requestScrollToLatest = useCallback((animated: boolean) => {
    shouldScrollToLatestRef.current = true;
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const sortMessages = useCallback((msgs: Message[]): Message[] => {
    return [...msgs].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeA - timeB; // ascending: cũ → mới
    });
  }, []);

  const mergeUniqueMessages = useCallback((base: Message[], incoming: Message[]) => {
    const mergedById = new Map<string, Message>();

    base.forEach((message) => {
      mergedById.set(String(message.messageId), message);
    });

    incoming.forEach((message) => {
      mergedById.set(String(message.messageId), message);
    });

    return sortMessages(Array.from(mergedById.values()));
  }, [sortMessages]);

  const appendOrUpdateMessage = useCallback((message: ChatUiMessage) => {
    logChatDebug('appendOrUpdateMessage', message);
    setMessages((prev) => {
      return mergeUniqueMessages(prev, [message]);
    });
  }, [logChatDebug, mergeUniqueMessages]);

  const unwrapApiPayload = useCallback((raw: unknown): unknown => {
    if (!raw || typeof raw !== 'object') {
      return raw;
    }

    const wrapped = raw as ApiWrappedPayload<unknown>;
    if (wrapped.success && wrapped.data !== undefined) {
      return wrapped.data;
    }

    return raw;
  }, []);

  const mapAnyPayloadToUiMessage = useCallback((raw: unknown): Message | null => {
    const normalized = unwrapApiPayload(raw) as any;

    const candidates: unknown[] = [
      normalized,
      normalized?.message,
      normalized?.data,
      normalized?.data?.message,
      (raw as any)?.message,
      (raw as any)?.data,
      (raw as any)?.data?.message,
    ];

    for (const candidate of candidates) {
      const mapped = mapChatPayloadToUiMessage(candidate);
      if (mapped) {
        return mapped;
      }
    }

    return null;
  }, [unwrapApiPayload]);

  const parsePageResult = useCallback((raw: unknown, expectedSize: number) => {
    if (Array.isArray(raw)) {
      return {
        payload: raw,
        hasMore: raw.length === expectedSize,
      };
    }

    const response = (raw ?? {}) as MessagePageResponse;
    const payload = Array.isArray(response.content) ? response.content : [];

    if (typeof response.last === 'boolean') {
      return {
        payload,
        hasMore: !response.last,
      };
    }

    if (typeof response.totalPages === 'number' && typeof response.number === 'number') {
      return {
        payload,
        hasMore: response.number + 1 < response.totalPages,
      };
    }

    return {
      payload,
      hasMore: payload.length === expectedSize,
    };
  }, []);

  const formatMessageTime = useCallback((createdAt?: string) => {
    const raw = String(createdAt || '').trim();
    // Backend gửi LocalDateTime không có timezone (VD: "2026-04-13T14:35:00")
    // Hermes parse nó như UTC → sai +7. Đọc HH:mm thẳng từ chuỗi ISO.
    const isoMatch = raw.match(/T(\d{2}):(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;
    // fallback: giờ hiện tại của thiết bị
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, []);

  const getReplySnippet = useCallback((msg: Message): string => {
    if (msg.isRecalled) return 'Tin nhắn đã được thu hồi';
    const mType = (msg.messageType || 'TEXT').toUpperCase();
    if (mType === 'IMAGE') return '📷 Hình ảnh';
    if (mType === 'VIDEO') return '🎬 Video';
    if (mType === 'VOICE') return '🎤 Tin nhắn thoại';
    if (mType === 'FILE' || mType === 'MEDIA') return '📎 Tệp đính kèm';
    if (mType === 'SHARE_CONTACT') {
      try { const c = JSON.parse(msg.content || '{}'); return `📇 ${c.fullName || 'Danh thiếp'}`; } catch { return '📇 Danh thiếp'; }
    }
    const text = msg.content || '';
    return text.length > 80 ? `${text.slice(0, 80)}...` : text;
  }, []);

  const stripAiMarkdownMarkers = useCallback((content: string | null | undefined) => {
    if (!content) return '';

    return content
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*\*/g, '');
  }, []);

  const getDisplayMessageContent = useCallback((message: Message) => {
    const senderName = (message.senderName || '').trim().toLowerCase();
    const isAiSender =
      isAiConversation ||
      String(message.senderId) === AI_TYPING_USER_ID ||
      senderName === 'fruvia ai';

    if (!isAiSender) {
      return message.content;
    }

    return stripAiMarkdownMarkers(message.content);
  }, [isAiConversation, stripAiMarkdownMarkers]);

  const closeMessageActionMenu = useCallback(() => {
    setIsMessageActionVisible(false);
    setSelectedMessage(null);
  }, []);

  const openMessageActionMenu = useCallback((message: Message) => {
    if (!canUseMessageInteractions) {
      return;
    }

    setSelectedMessage(message);
    setIsMessageActionVisible(true);
  }, [canUseMessageInteractions]);

  const isSelectedMessageMine = selectedMessage
    ? (currentUserId !== null && String(selectedMessage.senderId) === String(currentUserId))
    : false;

  const isSelectedMessagePinned = selectedMessage
    ? pinnedMessages.some((item) => String(item.messageId) === String(selectedMessage.messageId))
    : false;

  const fetchPinnedMessages = useCallback(async () => {
    if (!conversationId || !canUseMessageInteractions) {
      setPinnedMessages([]);
      return;
    }

    try {
      const response = await chatService.getPinnedMessages(conversationId);
      const rawList = chatService.unwrapApiPayload<any>(response);
      const list = Array.isArray(rawList) ? rawList : [];

      setPinnedMessages(
        list.map((item: any) => ({
          id: String(item.id ?? item.messageId ?? ''),
          messageId: String(item.messageId ?? ''),
          content: String(item.content ?? ''),
          senderName: item.senderName ? String(item.senderName) : undefined,
          pinnedAt: item.pinnedAt ? String(item.pinnedAt) : undefined,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch pinned messages:', error);
      setPinnedMessages([]);
    }
  }, [canUseMessageInteractions, conversationId]);

  const { isConnected, sendTyping, sendReadReceipt } = useChatSocket({
    conversationId,
    brokerURL: BROKER_URL,
    onMessage: (event) => {
      const mappedMessage = mapChatPayloadToUiMessage(event);
      if (!mappedMessage) {
        return;
      }

      appendOrUpdateMessage(mappedMessage);
    },
    onTyping: (event) => {
      if (!currentUserId || !canUseRealtimeIndicators) {
        return;
      }

      const isOtherUser = String(event.userId) !== String(currentUserId);
      const typingValue = event.isTyping ?? true;
      setIsTyping(isOtherUser && typingValue);
    },
    onReadReceipt: (event) => {
      if (!currentUserId || !canUseRealtimeIndicators) {
        return;
      }

      const isFromOtherUser = String(event.userId) !== String(currentUserId);
      if (isFromOtherUser) {
        // Placeholder: update read status in UI model when app has read indicator.
      }
    },
  });

  const loadInitialMessages = useCallback(async (uid?: string | null, silent = false) => {
    if (!conversationId) {
      return;
    }

    try {
      const response = await chatService.getMessages(conversationId, 0, PAGE_SIZE);
      const { payload, hasMore } = parsePageResult(response, PAGE_SIZE);
      logChatDebug('loadInitialMessages.response', response);
      logChatDebug('loadInitialMessages.payload', {
        silent,
        hasMore,
        payloadCount: payload.length,
        payload,
      });
      if (!silent) {
        setHasMoreOlder(hasMore);
      }

      const normalizedMessages = mapChatPayloadListToUiMessages(payload);
      const sortedMessages = sortMessages(normalizedMessages);
      logChatDebug('loadInitialMessages.normalized', {
        normalizedCount: normalizedMessages.length,
        sortedCount: sortedMessages.length,
        firstId: sortedMessages[0]?.messageId,
        lastId: sortedMessages[sortedMessages.length - 1]?.messageId,
      });

      let nextMessages = sortedMessages;
      let nextHasMoreOlder = hasMore;

      if (!silent && nextMessages.length > 0 && nextMessages.length < PAGE_SIZE) {
        let cursorId = nextMessages[0].messageId;

        while (nextMessages.length < PAGE_SIZE && cursorId) {
          const remainingSlots = PAGE_SIZE - nextMessages.length;
          const olderResponse = await chatService.getMessagesBefore(conversationId, cursorId, remainingSlots);
          const { payload: olderPayload, hasMore: olderHasMore } = parsePageResult(olderResponse, remainingSlots);
          const olderNormalized = mapChatPayloadListToUiMessages(olderPayload);
          const olderSorted = sortMessages(olderNormalized);

          logChatDebug('loadInitialMessages.prefillOlder', {
            cursorId,
            remainingSlots,
            olderCount: olderSorted.length,
            olderHasMore,
            olderPayload,
          });

          if (olderSorted.length === 0) {
            nextHasMoreOlder = false;
            break;
          }

          nextMessages = mergeUniqueMessages(nextMessages, olderSorted);
          cursorId = nextMessages[0]?.messageId ?? cursorId;
          nextHasMoreOlder = olderHasMore;

          if (olderSorted.length < remainingSlots) {
            break;
          }
        }
      }

      if (silent) {
        setMessages((prev) => {
          const merged = mergeUniqueMessages(prev, nextMessages);
          // Remove optimistic temp messages whose content already exists from server
          const serverIds = new Set(nextMessages.map((m) => String(m.messageId)));
          if (serverIds.size === 0) return merged;
          return merged.filter((m) => {
            if (!String(m.messageId).startsWith('temp-')) return true;
            const isTempMedia = String(m.messageId).startsWith('temp-media-');
            return !nextMessages.some((s) => {
              if (String(s.senderId) !== String(m.senderId)) return false;
              // Exact content match (text messages, or media after S3 URL updated)
              if (s.content === m.content) return true;
              // For media temp messages: match by messageType + fileName
              if (isTempMedia && m.messageType && m.messageType !== 'TEXT') {
                return s.messageType === m.messageType && s.fileName === m.fileName;
              }
              return false;
            });
          });
        });
      } else {
        setMessages(nextMessages);
        setHasMoreOlder(nextHasMoreOlder);
        shouldScrollToLatestRef.current = true;
      }

      const lastMessage = nextMessages[nextMessages.length - 1];
      if (uid && lastMessage?.messageId && canUseRealtimeIndicators) {
        sendReadReceipt(conversationId, uid, lastMessage.messageId);
      }
    } catch (error) {
      if (!silent) {
        console.error('Failed to load messages:', error);
      }
    }
  }, [canUseRealtimeIndicators, conversationId, logChatDebug, mergeUniqueMessages, parsePageResult, sendReadReceipt, sortMessages]);

  useEffect(() => {
    const initialize = async () => {
      const uid = await SecureStore.getItemAsync('user_id');
      setCurrentUserId(uid);
      await loadInitialMessages(uid);
    };
    initialize();
  }, [conversationId, loadInitialMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !hasMoreOlder || isLoadingOlder || loadingOlderRef.current) {
      return;
    }

    const oldestLoadedMessageId = messages[0]?.messageId;
    if (!oldestLoadedMessageId) {
      return;
    }

    loadingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      const response = await chatService.getMessagesBefore(conversationId, oldestLoadedMessageId, PAGE_SIZE);
      const { payload, hasMore } = parsePageResult(response, PAGE_SIZE);
      logChatDebug('loadOlderMessages.request', {
        beforeId: oldestLoadedMessageId,
        pageSize: PAGE_SIZE,
      });
      logChatDebug('loadOlderMessages.response', response);
      logChatDebug('loadOlderMessages.payload', {
        hasMore,
        payloadCount: payload.length,
        payload,
      });
      const normalizedMessages = mapChatPayloadListToUiMessages(payload);
      const sortedMessages = sortMessages(normalizedMessages);
      logChatDebug('loadOlderMessages.normalized', {
        normalizedCount: normalizedMessages.length,
        sortedCount: sortedMessages.length,
        firstId: sortedMessages[0]?.messageId,
        lastId: sortedMessages[sortedMessages.length - 1]?.messageId,
      });

      if (sortedMessages.length > 0) {
        setMessages((prev) => mergeUniqueMessages(prev, sortedMessages));
      }

      setHasMoreOlder(hasMore && sortedMessages.length > 0);
    } catch (error) {
      console.error('Failed to load older messages:', error);
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [conversationId, hasMoreOlder, isLoadingOlder, logChatDebug, mergeUniqueMessages, messages, parsePageResult, sortMessages]);

  // Load conversations when forward modal opens
  useEffect(() => {
    if (!forwardingMsg) return;
    setFwdConversations([]);
    setFwdSearch('');
    setFwdSelected(new Set());
    setFwdLoading(true);
    chatService.getConversations()
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? res?.content ?? []);
        setFwdConversations(list.filter((c: any) => (c.conversationId || c.id) !== conversationId));
      })
      .catch(() => {})
      .finally(() => setFwdLoading(false));
  }, [forwardingMsg, conversationId]);

  // Load friends when share contact modal opens
  useEffect(() => {
    if (!isShareContactVisible) return;
    setScFriends([]);
    setScSearch('');
    setScSelected(new Set());
    setScLoading(true);
    friendService.getFriendsList()
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        setScFriends(list);
      })
      .catch(() => {})
      .finally(() => setScLoading(false));
  }, [isShareContactVisible]);

  useEffect(() => {
    if (shouldScrollToLatestRef.current && messages.length > 0) {
      shouldScrollToLatestRef.current = false;
      scrollToLatest(false);
    }
  }, [messages.length, scrollToLatest]);

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      return;
    }

    const intervalId = setInterval(() => {
      void loadInitialMessages(currentUserId, true);
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [conversationId, currentUserId, loadInitialMessages]);

  useEffect(() => {
    logChatDebug('messages.state', {
      count: messages.length,
      firstId: messages[0]?.messageId,
      lastId: messages[messages.length - 1]?.messageId,
      hasMoreOlder,
      isLoadingOlder,
    });
  }, [hasMoreOlder, isLoadingOlder, logChatDebug, messages]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasInBackground = appStateRef.current.match(/inactive|background/);

      if (wasInBackground && nextState === 'active' && currentUserId) {
        void loadInitialMessages(currentUserId, true);
      }

      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, [currentUserId, loadInitialMessages]);

  const handleMessageListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (event.nativeEvent.contentOffset.y <= SCROLL_TOP_THRESHOLD) {
      void loadOlderMessages();
    }
  };

  const handleSendMessage = async () => {
    if (inputText.trim() === '' || !conversationId) return;
    if (isAiConversation && isSendingAi) return;

    if (editingMessageId) {
      const nextContent = inputText.trim();
      try {
        const response = await chatService.updateMessage(editingMessageId, nextContent);
        const mappedMessage = mapAnyPayloadToUiMessage(response);

        setMessages((prev) => prev.map((message) => {
          if (String(message.messageId) !== String(editingMessageId)) {
            return message;
          }

          if (mappedMessage) {
            return mappedMessage;
          }

          return {
            ...message,
            content: nextContent,
            isEdited: true,
          };
        }));

        setInputText('');
        setEditingMessageId(null);
      } catch (error) {
        const axiosError = error as AxiosError<{ message?: string; error?: { message?: string } }>;
        console.error('Failed to edit message:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          message: axiosError.message,
        });
      }

      return;
    }

    const messageContent = inputText.trim();
    const tempMessageId = `temp-${Date.now()}`;
    const now = new Date();
    const optimisticMessage: Message = {
      messageId: tempMessageId,
      content: messageContent,
      senderId: currentUserId ?? 'local-user',
      senderName: 'Me',
      createdAt: toLocalIsoLike(now),
    };

    setMessages((prev) => mergeUniqueMessages(prev, [optimisticMessage]));
    requestScrollToLatest(true);
    setInputText('');
    setReplyingTo(null);

    try {
      if (isAiConversation) {
        setIsSendingAi(true);

        const locale = (i18n.resolvedLanguage || i18n.language || 'vi').toLowerCase();
        const aiResponse = await chatService.sendAiMessage({
          content: messageContent,
          conversationId,
          useRag: true,
          language: locale.startsWith('en') ? 'en' : 'vi',
        });

        const aiPayload = chatService.unwrapApiPayload<any>(aiResponse) ?? {};
        const mappedUserMessage = mapAnyPayloadToUiMessage(aiPayload?.userMessage);
        const mappedImageMessage = mapAnyPayloadToUiMessage(aiPayload?.imageMessage);
        const mappedAssistantMessage = mapAnyPayloadToUiMessage(aiPayload?.assistantMessage);
        const aiMessages = [mappedUserMessage, mappedImageMessage, mappedAssistantMessage]
          .filter((item): item is Message => Boolean(item));

        if (aiMessages.length > 0) {
          setMessages((prev) => {
            const withoutTemp = prev.filter((message) => message.messageId !== tempMessageId);
            return mergeUniqueMessages(withoutTemp, aiMessages);
          });
          requestScrollToLatest(true);
        } else {
          const fallbackAiText = locale.startsWith('en')
            ? 'AI response is empty. Please try again.'
            : 'AI chưa có phản hồi. Bạn thử lại nhé.';
          const nowIso = toLocalIsoLike(new Date());

          setMessages((prev) => mergeUniqueMessages(prev, [{
            messageId: `ai-fallback-${Date.now()}`,
            content: fallbackAiText,
            senderId: 'FRUVIA_AI_ASSISTANT',
            senderName: 'Fruvia AI',
            createdAt: nowIso,
          }]));
          requestScrollToLatest(true);
        }

        return;
      }

      const response = await chatService.sendMessage(conversationId, {
        content: messageContent,
        messageType: 'TEXT',
        attachments: [],
        replyToMessageId: replyingTo?.messageId,
      });

      logChatDebug('sendMessage.response', response);

      const mappedMessage = mapAnyPayloadToUiMessage(response);
      if (mappedMessage) {
        logChatDebug('sendMessage.mapped', mappedMessage);
        setMessages((prev) => {
          const withoutTemp = prev.filter((message) => message.messageId !== tempMessageId);
          return mergeUniqueMessages(withoutTemp, [mappedMessage]);
        });
        requestScrollToLatest(true);
      } else {
        // Keep optimistic message visible and let polling/socket reconcile shortly.
        void loadInitialMessages(currentUserId, true);
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string; error?: { message?: string } }>;
      console.error('Failed to send message via REST:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
      setMessages((prev) => prev.filter((message) => message.messageId !== tempMessageId));
      setInputText(messageContent);
    } finally {
      if (isAiConversation) {
        setIsSendingAi(false);
      }
    }
  };

  const handleInputChange = (value: string) => {
    setInputText(value);

    if (canUseRealtimeIndicators && currentUserId && value.trim().length > 0 && conversationId) {
      sendTyping(conversationId, currentUserId);
    }
  };

  // ── Media Picker Functions ──────────────────────────────

  const handlePickImage = useCallback(async () => {
    setIsAttachMenuVisible(false);
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập thư viện ảnh');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const picked: PickedMedia = {
        uri: asset.uri,
        fileName: asset.fileName || `image_${Date.now()}.jpg`,
        fileSize: asset.fileSize || 0,
        mimeType: asset.mimeType || 'image/jpeg',
        mediaType: 'IMAGE',
        width: asset.width,
        height: asset.height,
      };
      setPendingMedia(picked);
      setMediaPreviewUrl(asset.uri);
    }
  }, []);

  const handlePickVideo = useCallback(async () => {
    setIsAttachMenuVisible(false);
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập thư viện ảnh');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 120,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const picked: PickedMedia = {
        uri: asset.uri,
        fileName: asset.fileName || `video_${Date.now()}.mp4`,
        fileSize: asset.fileSize || 0,
        mimeType: asset.mimeType || 'video/mp4',
        mediaType: 'VIDEO',
        width: asset.width,
        height: asset.height,
        duration: asset.duration ? Math.round(asset.duration / 1000) : undefined,
      };
      setPendingMedia(picked);
      setMediaPreviewUrl(asset.uri);
    }
  }, []);

  // ─── Voice recording ──────────────────────────────────────────────────────
  const startVoiceRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Quyền truy cập', 'Cần quyền truy cập microphone để ghi âm');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch {
      Alert.alert('Lỗi', 'Không thể mở microphone');
    }
  }, [isRecording]);

  const stopVoiceRecording = useCallback(async (discard = false) => {
    if (!recordingRef.current) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    const duration = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
    const recording = recordingRef.current;
    recordingRef.current = null;
    setRecordingTime(0);

    try {
      await recording.stopAndUnloadAsync();
    } catch { /* ignore */ }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    if (discard || duration < 1) return;

    const uri = recording.getURI();
    if (!uri) return;

    const isIos = Platform.OS === 'ios';
    const mimeType = isIos ? 'audio/m4a' : 'audio/3gpp';
    const ext = isIos ? 'm4a' : '3gp';
    const fileName = `voice_${Date.now()}.${ext}`;
    const tempId = `temp-voice-${Date.now()}`;

    const optMsg: Message = {
      messageId: tempId,
      content: uri,
      senderId: currentUserId ?? 'local-user',
      senderName: 'Me',
      createdAt: toLocalIsoLike(new Date()),
      messageType: 'VOICE',
      voiceDuration: duration,
    };
    setMessages(prev => mergeUniqueMessages(prev, [optMsg]));
    requestScrollToLatest(true);

    try {
      const s3Url = await chatFileService.uploadVoice(uri, fileName, mimeType);
      setMessages(prev => prev.map(m => m.messageId === tempId ? { ...m, content: s3Url } : m));

      const response = await chatService.sendMessage(conversationId!, {
        content: s3Url,
        messageType: 'VOICE',
        fileName,
        voiceDuration: duration,
      });

      const mapped = mapAnyPayloadToUiMessage(response);
      if (mapped) {
        setMessages(prev => {
          const withoutTemp = prev.filter(m => m.messageId !== tempId);
          return mergeUniqueMessages(withoutTemp, [mapped]);
        });
      }
      requestScrollToLatest(true);
    } catch (err: any) {
      console.error('Voice send error:', err);
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn giọng nói');
      setMessages(prev => prev.filter(m => m.messageId !== tempId));
    }
  }, [currentUserId, conversationId, mergeUniqueMessages, requestScrollToLatest, mapAnyPayloadToUiMessage]);

  const togglePlayVoice = useCallback(async (item: Message) => {
    if (playingVoiceId === item.messageId) {
      await soundRef.current?.pauseAsync();
      setPlayingVoiceId(null);
      return;
    }
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: item.content });
      soundRef.current = sound;
      setPlayingVoiceId(item.messageId);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingVoiceId(null);
          sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) soundRef.current = null;
        }
      });
    } catch {
      setPlayingVoiceId(null);
    }
  }, [playingVoiceId]);

  const handlePickFile = useCallback(async () => {
    setIsAttachMenuVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const picked: PickedMedia = {
          uri: asset.uri,
          fileName: asset.name || `file_${Date.now()}`,
          fileSize: asset.size || 0,
          mimeType: asset.mimeType || 'application/octet-stream',
          mediaType: chatFileService.resolveMediaType(asset.mimeType || ''),
        };
        setPendingMedia(picked);
        setMediaPreviewUrl(null);
      }
    } catch (error) {
      console.error('Failed to pick file:', error);
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    setIsAttachMenuVisible(false);
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const picked: PickedMedia = {
        uri: asset.uri,
        fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        fileSize: asset.fileSize || 0,
        mimeType: asset.mimeType || 'image/jpeg',
        mediaType: 'IMAGE',
        width: asset.width,
        height: asset.height,
      };
      setPendingMedia(picked);
      setMediaPreviewUrl(asset.uri);
    }
  }, []);

  const handleCancelMedia = useCallback(() => {
    setPendingMedia(null);
    setMediaPreviewUrl(null);
    setUploadProgress(0);
  }, []);

  const handleSendMedia = useCallback(async () => {
    if (!pendingMedia || !conversationId || isUploading) return;

    const media = pendingMedia;
    const caption = inputText.trim();
    const tempMessageId = `temp-media-${Date.now()}`;
    const now = new Date();

    // Optimistic message
    const optimisticMessage: Message = {
      messageId: tempMessageId,
      content: media.uri,
      senderId: currentUserId ?? 'local-user',
      senderName: 'Me',
      createdAt: toLocalIsoLike(now),
      messageType: media.mediaType,
      fileName: media.fileName,
      fileSize: media.fileSize,
      caption,
    };

    setMessages((prev) => mergeUniqueMessages(prev, [optimisticMessage]));
    requestScrollToLatest(true);
    setPendingMedia(null);
    setMediaPreviewUrl(null);
    setInputText('');
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload to S3
      const s3Url = await chatFileService.uploadMedia(media, (progress) => {
        setUploadProgress(progress.percent);
      });

      // Update optimistic message content to S3 URL so polling cleanup can match it
      setMessages((prev) =>
        prev.map((m) => m.messageId === tempMessageId ? { ...m, content: s3Url } : m)
      );

      // Send message with S3 URL (map FILE → MEDIA for backend)
      const response = await chatService.sendMessage(conversationId, {
        content: s3Url,
        messageType: chatFileService.toBackendMessageType(media.mediaType),
        fileName: media.fileName,
        fileSize: media.fileSize,
        caption: caption || undefined,
        videoDuration: media.duration,
      });

      const mappedMessage = mapAnyPayloadToUiMessage(response);
      if (mappedMessage) {
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.messageId !== tempMessageId);
          return mergeUniqueMessages(withoutTemp, [mappedMessage]);
        });
      } else {
        // Update optimistic message with s3 url
        setMessages((prev) =>
          prev.map((m) => m.messageId === tempMessageId ? { ...m, content: s3Url } : m)
        );
      }
      requestScrollToLatest(true);
    } catch (error: any) {
      const statusCode = error?.response?.status;
      const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
      console.error('Failed to send media:', { statusCode, errorMsg, error });
      setMessages((prev) => prev.filter((m) => m.messageId !== tempMessageId));
      Alert.alert('Lỗi', `Không thể gửi file: ${errorMsg}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [pendingMedia, conversationId, isUploading, inputText, currentUserId, mergeUniqueMessages, requestScrollToLatest, mapAnyPayloadToUiMessage]);

  const handleReactWithEmoji = useCallback(async (emoji: string) => {
    if (!selectedMessage) {
      return;
    }

    try {
      await chatService.reactToMessage(selectedMessage.messageId, emojiToReactionType(emoji));
      closeMessageActionMenu();
      await loadInitialMessages(currentUserId, true);
    } catch (error) {
      console.error('Failed to react message:', error);
    }
  }, [closeMessageActionMenu, currentUserId, loadInitialMessages, selectedMessage]);

  const handleCopySelectedMessage = useCallback(async () => {
    if (!selectedMessage) return;
    const text = selectedMessage.content || '';
    await Clipboard.setStringAsync(text);
    closeMessageActionMenu();
    Alert.alert('', 'Đã sao chép tin nhắn');
  }, [closeMessageActionMenu, selectedMessage]);

  const handleStartEditSelectedMessage = useCallback(() => {
    if (!selectedMessage || selectedMessage.isRecalled) {
      return;
    }

    setEditingMessageId(selectedMessage.messageId);
    setInputText(selectedMessage.content || '');
    closeMessageActionMenu();
  }, [closeMessageActionMenu, selectedMessage]);

  const handleRecallSelectedMessage = useCallback(async () => {
    if (!selectedMessage) return;
    closeMessageActionMenu();
    Alert.alert(
      'Thu hồi tin nhắn',
      'Tin nhắn sẽ bị thu hồi với tất cả mọi người. Bạn có chắc không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Thu hồi',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.recallMessage(selectedMessage.messageId);
              await loadInitialMessages(currentUserId, true);
            } catch (error) {
              console.error('Failed to recall message:', error);
              Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn');
            }
          },
        },
      ]
    );
  }, [closeMessageActionMenu, currentUserId, loadInitialMessages, selectedMessage]);

  const handleDeleteSelectedMessageLocal = useCallback(async () => {
    if (!selectedMessage) return;
    closeMessageActionMenu();
    Alert.alert(
      'Xóa tin nhắn',
      'Tin nhắn sẽ bị xóa khỏi thiết bị của bạn. Bạn có chắc không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.deleteMessageLocal(selectedMessage.messageId);
              setMessages((prev) => prev.filter((m) => String(m.messageId) !== String(selectedMessage.messageId)));
            } catch (error) {
              console.error('Failed to delete local message:', error);
              Alert.alert('Lỗi', 'Không thể xóa tin nhắn');
            }
          },
        },
      ]
    );
  }, [closeMessageActionMenu, selectedMessage]);

  const handleTogglePinSelectedMessage = useCallback(async () => {
    if (!selectedMessage) {
      return;
    }

    try {
      if (isSelectedMessagePinned) {
        await chatService.unpinMessage(selectedMessage.messageId);
      } else {
        await chatService.pinMessage(selectedMessage.messageId);
      }

      closeMessageActionMenu();
      await fetchPinnedMessages();
    } catch (error) {
      console.error('Failed to toggle pin message:', error);
      closeMessageActionMenu();
    }
  }, [closeMessageActionMenu, fetchPinnedMessages, isSelectedMessagePinned, selectedMessage]);

  const handleOpenPinnedList = useCallback(async () => {
    await fetchPinnedMessages();
    setIsPinnedListVisible(true);
  }, [fetchPinnedMessages]);

  const handleJumpToPinnedMessage = useCallback((messageId: string) => {
    const targetIndex = messages.findIndex((message) => String(message.messageId) === String(messageId));
    if (targetIndex >= 0) {
      flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true, viewPosition: 0.5 });
    }

    setIsPinnedListVisible(false);
  }, [messages]);

  const handleUnpinFromPinnedList = useCallback(async (messageId: string) => {
    try {
      await chatService.unpinMessage(messageId);
      await fetchPinnedMessages();
    } catch (error) {
      console.error('Failed to unpin message from list:', error);
    }
  }, [fetchPinnedMessages]);

  // ── Info Panel helpers ────────────────────────────────────────────────────

  const fetchInfoMembers = useCallback(async () => {
    if (!conversationId || !isGroupConversation) return;
    try {
      const res = chatService.unwrapApiPayload<any[]>(
        await chatService.getConversationMembers(conversationId)
      );
      setInfoMembers(Array.isArray(res) ? res : []);
    } catch { setInfoMembers([]); }
  }, [conversationId, isGroupConversation]);

  const fetchInfoMedia = useCallback(async () => {
    if (!conversationId || isAiConversation) return;
    try {
      const res = chatService.unwrapApiPayload<any[]>(
        await chatService.getConversationMedia(conversationId)
      );
      const items = Array.isArray(res) ? res : [];
      setInfoMediaItems(items.filter((m: any) => m.messageType === 'IMAGE' || m.messageType === 'VIDEO'));
      setInfoFileItems(items.filter((m: any) => m.messageType === 'MEDIA'));
    } catch { setInfoMediaItems([]); setInfoFileItems([]); }
  }, [conversationId, isAiConversation]);

  const fetchInfoStorageStats = useCallback(async () => {
    if (!isCloudConversation) return;
    try {
      const res = await chatService.getStorageStats();
      setInfoStorageStats(res);
    } catch { setInfoStorageStats(null); }
  }, [isCloudConversation]);

  const openInfoPanel = useCallback(async () => {
    setIsInfoPanelVisible(true);
    await Promise.all([
      fetchInfoMembers(),
      fetchInfoMedia(),
      fetchInfoStorageStats(),
      fetchPinnedMessages(),
    ]);
  }, [fetchInfoMembers, fetchInfoMedia, fetchInfoStorageStats, fetchPinnedMessages]);

  const infoCurrentUserRole = infoMembers.find((m) => m.userId === currentUserId)?.role;
  const infoIsAdmin = infoCurrentUserRole === 'ADMIN';
  const infoIsDeputy = infoCurrentUserRole === 'DEPUTY';
  const infoCanAddMembers = infoIsAdmin || infoIsDeputy;

  const fetchInfoFriendsForAdd = useCallback(async () => {
    try {
      const res = chatService.unwrapApiPayload<any[]>(await friendService.getFriendsList());
      const list = Array.isArray(res) ? res : [];
      const existingIds = infoMembers.map((m) => m.userId);
      setInfoFriendsList(list.filter((f: any) => !existingIds.includes(f.user_id || f.id)));
    } catch { setInfoFriendsList([]); }
  }, [infoMembers]);

  const handleInfoAddMembers = useCallback(async () => {
    if (infoSelectedMembers.length === 0 || infoAddingMembers || !conversationId) return;
    setInfoAddingMembers(true);
    try {
      await chatService.addConversationMembers(conversationId, infoSelectedMembers);
      setInfoAddMemberVisible(false);
      setInfoSelectedMembers([]);
      await fetchInfoMembers();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể thêm thành viên');
    } finally { setInfoAddingMembers(false); }
  }, [conversationId, fetchInfoMembers, infoAddingMembers, infoSelectedMembers]);

  const handleInfoRemoveMember = useCallback((memberId: string, memberName: string) => {
    Alert.alert(
      'Xóa thành viên',
      `Bạn có chắc muốn xóa ${memberName} khỏi nhóm?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa', style: 'destructive',
          onPress: async () => {
            try {
              await chatService.removeConversationMember(conversationId!, memberId);
              await fetchInfoMembers();
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể xóa thành viên');
            }
          },
        },
      ]
    );
  }, [conversationId, fetchInfoMembers]);

  const handleInfoChangeRole = useCallback((targetUserId: string, targetName: string, newRole: 'DEPUTY' | 'MEMBER') => {
    const roleLabel = newRole === 'DEPUTY' ? 'Phó nhóm' : 'Thành viên';
    Alert.alert(
      'Thay đổi quyền',
      `Đổi quyền ${targetName} thành ${roleLabel}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              await chatService.changeMemberRole(conversationId!, targetUserId, newRole);
              await fetchInfoMembers();
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể thay đổi quyền');
            }
          },
        },
      ]
    );
    setInfoMemberMenuId(null);
  }, [conversationId, fetchInfoMembers]);

  const handleInfoLeaveGroup = useCallback(() => {
    if (infoIsAdmin) {
      setInfoTransferReason('leave');
      setInfoShowTransferModal(true);
      return;
    }
    Alert.alert(
      'Rời nhóm',
      'Bạn có chắc muốn rời khỏi nhóm?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm', style: 'destructive',
          onPress: async () => {
            try {
              await chatService.leaveConversation(conversationId!);
              setIsInfoPanelVisible(false);
              router.back();
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể rời nhóm');
            }
          },
        },
      ]
    );
  }, [conversationId, infoIsAdmin, router]);

  const handleInfoDissolveGroup = useCallback(() => {
    Alert.alert(
      'Giải tán nhóm',
      'Hành động này không thể hoàn tác. Bạn có chắc muốn giải tán nhóm?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Giải tán', style: 'destructive',
          onPress: async () => {
            try {
              await chatService.dissolveConversation(conversationId!);
              setIsInfoPanelVisible(false);
              router.back();
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể giải tán nhóm');
            }
          },
        },
      ]
    );
  }, [conversationId, router]);

  const handleInfoTransferOwnership = useCallback((newAdminId: string, newAdminName: string) => {
    Alert.alert(
      'Chuyển quyền trưởng nhóm',
      `Chuyển quyền trưởng nhóm cho ${newAdminName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              if (infoTransferReason === 'leave') {
                await chatService.leaveConversation(conversationId!, newAdminId);
                setIsInfoPanelVisible(false);
                router.back();
              } else {
                await chatService.transferOwnership(conversationId!, newAdminId);
                await fetchInfoMembers();
              }
              setInfoShowTransferModal(false);
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể chuyển quyền');
            }
          },
        },
      ]
    );
  }, [conversationId, fetchInfoMembers, infoTransferReason, router]);

  const handleInfoClearChat = useCallback(() => {
    Alert.alert(
      'Xóa lịch sử',
      'Bạn có chắc muốn xóa toàn bộ lịch sử chat?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa', style: 'destructive',
          onPress: async () => {
            try {
              await chatService.clearConversation(conversationId!);
              setMessages([]);
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể xóa lịch sử');
            }
          },
        },
      ]
    );
  }, [conversationId]);

  useEffect(() => {
    void fetchPinnedMessages();
  }, [fetchPinnedMessages]);

  const renderOlderMessagesLoading = () => {
    if (!hasMoreOlder) {
      return null;
    }

    // Only show the indicator when actively loading older messages (user scrolled to top)
    if (!isLoadingOlder) {
      return null;
    }

    return (
      <View style={styles.olderLoadingContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={[styles.olderLoadingText, { color: colors.textSecondary }]}>Đang tải tin cũ...</Text>
      </View>
    );
  };

const isFirstInMessageBlock = (current: Message, prev?: Message) => {
  if (!prev) return true;
  if (String(current.senderId) !== String(prev.senderId)) return true;

  const currentMs = getMessageMillis(current.createdAt);
  const prevMs = getMessageMillis(prev.createdAt);
  if (Number.isNaN(currentMs) || Number.isNaN(prevMs)) return true;

  return currentMs - prevMs > BLOCK_GAP_MS;
};

const shouldShowMessageTimestamp = (current: Message, next?: Message) => {
  if (!next) return true;
  if (String(current.senderId) !== String(next.senderId)) return true;

  const currentMs = getMessageMillis(current.createdAt);
  const nextMs = getMessageMillis(next.createdAt);
  if (Number.isNaN(currentMs) || Number.isNaN(nextMs)) return true;

  return nextMs - currentMs > BLOCK_GAP_MS;
};

const formatDateSeparator = (createdAt?: string) => {
  const raw = String(createdAt || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  // Đọc HH:mm thẳng từ chuỗi ISO để tránh Hermes parse UTC sai +7
  const isoTimeMatch = raw.match(/T(\d{2}):(\d{2})/);
  const time = isoTimeMatch
    ? `${isoTimeMatch[1]}:${isoTimeMatch[2]}`
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (isToday) return `${time} Hôm nay`;
  if (isYesterday) return `${time} Hôm qua`;
  // Đọc ngày tháng thẳng từ chuỗi ISO
  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) return `${time} ${isoDateMatch[3]}/${isoDateMatch[2]}/${isoDateMatch[1]}`;
  const dd = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${time} ${dd}/${mo}/${yyyy}`;
};

const shouldShowDateSeparator = (current: Message, prev?: Message) => {
  if (!prev) return true;
  const currentDate = new Date(current.createdAt);
  const prevDate = new Date(prev.createdAt);
  if (Number.isNaN(currentDate.getTime()) || Number.isNaN(prevDate.getTime())) return false;
  return currentDate.toDateString() !== prevDate.toDateString()
    || (currentDate.getTime() - prevDate.getTime() > 15 * 60 * 1000);
};

const renderMessage = ({ item, index }: { item: Message; index: number }) => {
  const isCurrentUserMessage = currentUserId !== null && String(item.senderId) === String(currentUserId);
  const prevMessage = index > 0 ? messages[index - 1] : undefined;
  const nextMessage = index < messages.length - 1 ? messages[index + 1] : undefined;
  const showAvatar = !isCurrentUserMessage && isFirstInMessageBlock(item, prevMessage);
  const showTimestamp = shouldShowMessageTimestamp(item, nextMessage);
  const timeLabel = formatMessageTime(item.createdAt);
  const displayContent = getDisplayMessageContent(item);
  const reactionSummary = buildReactionSummary(item.reactions);
  const showDateSep = shouldShowDateSeparator(item, prevMessage);
  const dateSepLabel = showDateSep ? formatDateSeparator(item.createdAt) : null;

  const msgType = (item.messageType || 'TEXT').toUpperCase();
  const isImageMsg = msgType === 'IMAGE';
  const isVideoMsg = msgType === 'VIDEO';
  const isVoiceMsg = msgType === 'VOICE';
  const isFileMsg = msgType === 'FILE' || msgType === 'MEDIA';
  const isMediaMsg = isImageMsg || isVideoMsg || isFileMsg || isVoiceMsg;

  // Helpers for file bubbles
  const getFileNameFromUrl = (url: string): string => {
    try {
      const decoded = decodeURIComponent(url);
      const lastPart = decoded.split('/').pop() ?? '';
      const filename = lastPart.includes('_') ? lastPart.split('_').slice(1).join('_') : lastPart;
      return filename || 'Tệp đính kèm';
    } catch {
      return url.split('/').pop() ?? 'Tệp đính kèm';
    }
  };
  const getFileExt = (url: string): string => {
    const name = getFileNameFromUrl(url);
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
  };
  const getFileIconColor = (url: string): string => {
    const ext = getFileExt(url).toLowerCase();
    if (ext === 'pdf') return '#F40F02';
    if (['doc', 'docx'].includes(ext)) return '#2B579A';
    if (['xls', 'xlsx'].includes(ext)) return '#217346';
    if (['ppt', 'pptx'].includes(ext)) return '#D24726';
    if (['zip', 'rar', '7z'].includes(ext)) return '#F59E0B';
    return '#6B7280';
  };

  const renderMediaContent = () => {
    if (item.isRecalled) {
      return (
        <Text style={[styles.recalledText, isCurrentUserMessage && styles.userRecalledText, !isCurrentUserMessage && { color: colors.textSecondary }]}>
          {t('chat.recalled', 'Tin nhắn đã được thu hồi')}
        </Text>
      );
    }

    // Reply snippet block
    const replyBlock = item.replyToMessageId ? (() => {
      const repliedMsg = messages.find((m) => m.messageId === item.replyToMessageId);
      const snippet = repliedMsg
        ? getReplySnippet(repliedMsg)
        : (item.replyToContent ? (item.replyToContent.length > 80 ? `${item.replyToContent.slice(0, 80)}...` : item.replyToContent) : 'Tin nhắn đã xóa');
      const senderLabel = repliedMsg
        ? (repliedMsg.senderId === currentUserId ? 'Bạn' : (repliedMsg.senderName || 'Người dùng'))
        : (item.replyToSenderName || 'Người dùng');
      const scrollToReplied = () => {
        const idx = messages.findIndex((m) => m.messageId === item.replyToMessageId);
        if (idx >= 0) {
          try { flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }); } catch {}
        }
      };
      return (
        <TouchableOpacity
          style={[styles.replySnippetBlock, isCurrentUserMessage ? styles.replySnippetBlockUser : styles.replySnippetBlockOther]}
          onPress={scrollToReplied}
          activeOpacity={0.7}
        >
          <Text style={[styles.replySnippetSender, { color: isCurrentUserMessage ? '#90CAF9' : '#0068FF' }]} numberOfLines={1}>
            {senderLabel}
          </Text>
          <Text style={[styles.replySnippetText, { color: isCurrentUserMessage ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]} numberOfLines={2}>
            {snippet}
          </Text>
        </TouchableOpacity>
      );
    })() : null;

    // Forwarded banner
    const forwardedBanner = (item.forwardedFromSenderName && !item.isRecalled) ? (
      <View style={styles.forwardedBanner}>
        <Ionicons name="return-up-forward-outline" size={12} color={isCurrentUserMessage ? '#90CAF9' : '#0068FF'} />
        <Text style={[styles.forwardedBannerText, { color: isCurrentUserMessage ? '#90CAF9' : '#0068FF' }]}>
          {`Chuyển tiếp từ ${item.forwardedFromSenderName}`}
        </Text>
      </View>
    ) : null;

    if (isImageMsg) {
      const isLocalUri = item.content.startsWith('file://') || item.content.startsWith('content://');
      return (
        <>
          {replyBlock}
          {forwardedBanner}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (!isLocalUri) {
                setFullscreenImageUrl(item.content);
              }
            }}
          >
            <Image
              source={{ uri: item.content }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
            {item.caption ? (
              <Text style={[styles.messageText, isCurrentUserMessage ? styles.userMessageText : { color: colors.text }, { marginTop: 6 }]}>
                {item.caption}
              </Text>
            ) : null}
            {isLocalUri && (
              <View style={styles.mediaUploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.mediaUploadingText}>Đang gửi...</Text>
              </View>
            )}
          </TouchableOpacity>
        </>
      );
    }

    if (isVideoMsg) {
      const isLocalUri = item.content.startsWith('file://') || item.content.startsWith('content://');
      return (
        <>
          {replyBlock}
          {forwardedBanner}
          <TouchableOpacity onPress={() => {
            if (item.content && !isLocalUri) {
              setFullscreenVideoUrl(item.content);
            }
          }}>
            <View style={styles.videoContainer}>
              <View style={styles.videoPlayOverlay}>
                <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
              </View>
              {item.videoDuration ? (
                <View style={styles.videoDurationBadge}>
                  <Text style={styles.videoDurationText}>
                    {Math.floor(item.videoDuration / 60)}:{String(item.videoDuration % 60).padStart(2, '0')}
                  </Text>
                </View>
              ) : null}
            </View>
            {item.caption ? (
              <Text style={[styles.messageText, isCurrentUserMessage ? styles.userMessageText : { color: colors.text }, { marginTop: 6 }]}>
                {item.caption}
              </Text>
            ) : null}
          </TouchableOpacity>
        </>
      );
    }

    if (isVoiceMsg) {
      const isLocalUri = item.content.startsWith('file://') || item.content.startsWith('content://');
      const isPlaying = playingVoiceId === item.messageId;
      const dur = item.voiceDuration ?? 0;
      const waveHeights = [6, 10, 14, 10, 16, 8, 12, 18, 10, 14, 8, 16, 12, 10, 14, 8, 12, 16, 10, 8];
      return (
        <>
          {replyBlock}
          {forwardedBanner}
          <TouchableOpacity
            style={styles.voiceBubble}
            onPress={() => { if (!isLocalUri) togglePlayVoice(item); }}
            activeOpacity={0.75}
          >
            {isLocalUri ? (
              <ActivityIndicator size="small" color={isCurrentUserMessage ? '#1A2A3B' : COLORS.primary} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={22}
                color={isCurrentUserMessage ? '#1A2A3B' : COLORS.primary}
              />
            )}
            <View style={styles.voiceWaveform}>
              {waveHeights.map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.voiceBar,
                    { height: h },
                    isPlaying && { backgroundColor: isCurrentUserMessage ? '#4A90D9' : COLORS.primary },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.voiceDurationText, { color: isCurrentUserMessage ? '#526377' : colors.textSecondary }]}>
              {Math.floor(dur / 60)}:{String(dur % 60).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        </>
      );
    }

    if (isFileMsg) {
      const isUploading = item.content?.startsWith('file://') || item.content?.startsWith('content://');
      const fileUrl = item.content ?? '';
      const displayName = item.fileName || getFileNameFromUrl(fileUrl);
      const ext = getFileExt(fileUrl);
      const iconColor = getFileIconColor(fileUrl);
      const extLabel = ext.slice(0, 4) || 'FILE';
      return (
        <>
          {replyBlock}
          {forwardedBanner}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (!isUploading && fileUrl) {
                Linking.openURL(fileUrl).catch(() => {});
              }
            }}
          >
            <View style={styles.fileBubbleContent}>
              <View style={[styles.fileIconWrap, { backgroundColor: iconColor }]}>
                {isUploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.fileExtLabel}>{extLabel}</Text>
                )}
              </View>
              <View style={styles.fileInfoWrap}>
                <Text
                  style={[styles.fileNameMainText, { color: isCurrentUserMessage ? '#1A2A3B' : colors.text }]}
                  numberOfLines={2}
                >
                  {displayName}
                </Text>
                {item.fileSize ? (
                  <Text style={[styles.fileSizeText, { color: isCurrentUserMessage ? '#617287' : colors.textSecondary }]}>
                    {chatFileService.formatFileSize(item.fileSize)}
                  </Text>
                ) : null}
              </View>
              {!isUploading && (
                <Ionicons name="download-outline" size={22} color={isCurrentUserMessage ? '#526377' : COLORS.primary} />
              )}
            </View>
          </TouchableOpacity>
        </>
      );
    }

    // SHARE_CONTACT render
    if ((item.messageType || '').toUpperCase() === 'SHARE_CONTACT') {
      let contact: { userId?: string; fullName?: string; phoneNumber?: string; avatar?: string } = {};
      try { contact = JSON.parse(item.content || '{}'); } catch {}
      const hasAvatar = Boolean(contact.avatar);
      return (
        <>
          {replyBlock}
          {forwardedBanner}
          <View style={[styles.contactCard, isCurrentUserMessage && styles.contactCardUser]}>
            <View style={styles.contactCardHeader}>
              <View style={[styles.contactCardAvatar, { backgroundColor: '#4A90D9' }]}>
                {hasAvatar ? (
                  <Image source={{ uri: contact.avatar }} style={styles.contactCardAvatarImg} />
                ) : (
                  <Text style={styles.contactCardAvatarText}>
                    {(contact.fullName || '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.contactCardInfo}>
                <Text style={[styles.contactCardName, { color: isCurrentUserMessage ? '#1A2A3B' : colors.text }]} numberOfLines={2}>
                  {contact.fullName || 'Người dùng'}
                </Text>
                {contact.phoneNumber ? (
                  <Text style={[styles.contactCardPhone, { color: isCurrentUserMessage ? '#617287' : colors.textSecondary }]}>
                    {contact.phoneNumber}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.contactCardDivider, { backgroundColor: isCurrentUserMessage ? 'rgba(100,120,140,0.25)' : colors.border }]} />
            <TouchableOpacity
              style={styles.contactCardBtn}
              onPress={() => Alert.alert(contact.fullName || 'Danh thiếp', contact.phoneNumber || 'Không có số điện thoại')}
            >
              <Text style={[styles.contactCardBtnText, { color: isCurrentUserMessage ? '#1A6DA8' : '#0068FF' }]}>Nhắn tin</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    // Default: TEXT message
    return (
      <>
        {replyBlock}
        {forwardedBanner}
        <Text style={[styles.messageText, isCurrentUserMessage ? styles.userMessageText : { color: colors.text }]}>{displayContent}</Text>
        {item.isEdited ? <Text style={[styles.editedLabel, isCurrentUserMessage ? styles.userEditedLabel : { color: colors.textSecondary }]}>{t('chat.edited', 'Đã chỉnh sửa')}</Text> : null}
      </>
    );
  };

  return (
    <View style={[styles.messageContainer, { marginBottom: showTimestamp ? 10 : 4 }]}>
      {dateSepLabel ? (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{dateSepLabel}</Text>
        </View>
      ) : null}
      {isCurrentUserMessage ? (
        <View style={styles.userMessageBlock}>
          <TouchableOpacity
            activeOpacity={1}
            onLongPress={() => openMessageActionMenu(item)}
            delayLongPress={220}
            style={[
              styles.messageBubble,
              styles.userBubble,
              isMediaMsg && !isFileMsg && !isVoiceMsg && styles.mediaBubble,
            ]}
          >
            {renderMediaContent()}
          </TouchableOpacity>

          {reactionSummary.length > 0 ? (
            <View style={styles.reactionRowRight}>
              {reactionSummary.map((reaction) => (
                <View key={`${item.messageId}-${reaction.emoji}`} style={styles.reactionChip}>
                  <Text style={styles.reactionChipText}>{reaction.emoji} {reaction.count}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {showTimestamp ? (
            <Text style={[styles.timestamp, styles.timestampRight]}>{timeLabel}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.otherMessageBlock}>
          <View style={[styles.otherAvatarSlot, { marginBottom: showTimestamp ? 18 : 2 }]}>
            {showAvatar ? <Image source={peerAvatarSource} style={styles.peerAvatar} /> : null}
          </View>
          <View style={styles.otherContentBlock}>
            <TouchableOpacity
              activeOpacity={1}
              onLongPress={() => openMessageActionMenu(item)}
              delayLongPress={220}
              style={[
                styles.messageBubble,
                styles.otherBubble,
                { backgroundColor: colors.card },
                isMediaMsg && !isFileMsg && !isVoiceMsg && styles.mediaBubble,
              ]}
            >
              {renderMediaContent()}
            </TouchableOpacity>

            {reactionSummary.length > 0 ? (
              <View style={styles.reactionRowLeft}>
                {reactionSummary.map((reaction) => (
                  <View key={`${item.messageId}-${reaction.emoji}`} style={styles.reactionChip}>
                    <Text style={styles.reactionChipText}>{reaction.emoji} {reaction.count}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {showTimestamp ? (
              <Text style={[styles.timestamp, styles.timestampLeft]}>{timeLabel}</Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      <StatusBar barStyle="light-content" backgroundColor="#2F87F2" />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={0}
      >

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.headerSubtitle}>
            {headerSubtitleText}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {showCallActions ? (
            <>
              <TouchableOpacity style={styles.headerIcon}>
                <Ionicons name="call-outline" size={27} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIcon}>
                <Ionicons name="videocam-outline" size={27} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity style={styles.headerIcon} onPress={() => { void handleOpenPinnedList(); }}>
            <Ionicons name="list-outline" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => { void openInfoPanel(); }}>
            <Ionicons name="information-circle-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => String(item.messageId)}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        scrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={renderOlderMessagesLoading}
        onScroll={handleMessageListScroll}
        scrollEventThrottle={120}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }}
      />

      {/* Input Area */}
      <SafeAreaView style={[styles.inputArea, { borderTopColor: colors.border }]} edges={['left', 'right', 'bottom']}>
        {editingMessageId ? (
          <View style={styles.editingBanner}>
            <View style={styles.editingBannerTextWrap}>
              <Text style={styles.editingBannerTitle}>{t('chat.editing_title', 'Đang chỉnh sửa tin nhắn')}</Text>
              <Text style={styles.editingBannerSubtitle} numberOfLines={1}>{t('chat.editing_hint', 'Nhấn gửi để lưu, hoặc hủy để thoát')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditingMessageId(null);
                setInputText('');
              }}
              style={styles.editingCloseButton}
            >
              <Ionicons name="close" size={18} color="#6F7581" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Media Preview */}
        {pendingMedia ? (
          <View style={styles.mediaPreviewBanner}>
            {mediaPreviewUrl && pendingMedia.mediaType !== 'FILE' ? (
              <Image source={{ uri: mediaPreviewUrl }} style={styles.mediaPreviewThumb} resizeMode="cover" />
            ) : (
              <View style={styles.mediaPreviewFileIcon}>
                <Ionicons name="document-outline" size={28} color="#5B7FFF" />
              </View>
            )}
            <View style={styles.mediaPreviewInfo}>
              <Text style={styles.mediaPreviewName} numberOfLines={1}>
                {pendingMedia.fileName}
              </Text>
              <Text style={styles.mediaPreviewSize}>
                {chatFileService.formatFileSize(pendingMedia.fileSize)} • {pendingMedia.mediaType}
              </Text>
              {isUploading ? (
                <View style={styles.uploadProgressBar}>
                  <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
                </View>
              ) : null}
            </View>
            {!isUploading ? (
              <TouchableOpacity onPress={handleCancelMedia} style={styles.mediaPreviewClose}>
                <Ionicons name="close-circle" size={22} color="#F04343" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Emoji Picker Panel - uses native keyboard emoji */}

        {/* Reply bar */}
        {replyingTo ? (
          <View style={[styles.replyBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View style={styles.replyBarAccent} />
            <View style={styles.replyBarContent}>
              <Text style={[styles.replyBarSender, { color: '#0068FF' }]} numberOfLines={1}>
                {replyingTo.senderId === currentUserId ? 'Bạn' : (replyingTo.senderName || 'Người dùng')}
              </Text>
              <Text style={[styles.replyBarSnippet, { color: colors.textSecondary }]} numberOfLines={1}>
                {getReplySnippet(replyingTo)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyBarDismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.composerRow}>
          {isRecording ? (
            <View style={styles.recordingBar}>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTimeText}>
                  {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                </Text>
                <Text style={styles.recordingLabel}>Đang ghi âm...</Text>
              </View>
              <TouchableOpacity style={styles.recordingCancelBtn} onPress={() => stopVoiceRecording(true)}>
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.recordingSendBtn} onPress={() => stopVoiceRecording(false)}>
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => textInputRef.current?.focus()}
          >
            <Ionicons
              name="happy-outline"
              size={30}
              color="#7B808A"
            />
          </TouchableOpacity>
          <TextInput
            ref={textInputRef}
            style={[styles.input, { color: colors.text, maxHeight: 100 }]}
            placeholder={pendingMedia ? t('chat.add_caption', 'Thêm mô tả...') : t('chat.send_message', 'Tin nhắn')}
            placeholderTextColor="#5BA8D9"
            value={inputText}
            onChangeText={handleInputChange}
            editable={!isUploading && (!isAiConversation || !isSendingAi)}
            multiline
          />
          <TouchableOpacity style={styles.bottomActionButton} onPress={() => setIsAttachMenuVisible(true)} disabled={isUploading}>
            <Ionicons name="attach" size={26} color={isUploading ? '#CCC' : '#7B808A'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomActionButton}
            onPress={isRecording ? () => stopVoiceRecording(false) : startVoiceRecording}
            disabled={isUploading}
          >
            <Ionicons
              name={isRecording ? 'stop-circle' : 'mic-outline'}
              size={26}
              color={isRecording ? '#FF3B30' : '#7B808A'}
            />
          </TouchableOpacity>
          {pendingMedia ? (
            <TouchableOpacity
              style={styles.bottomActionButton}
              onPress={handleSendMedia}
              disabled={isUploading}
            >
              <Ionicons
                name={isUploading ? 'time-outline' : 'send'}
                size={26}
                color={isUploading ? '#7B808A' : COLORS.primary}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.bottomActionButton}
              onPress={inputText.trim() ? handleSendMessage : () => setIsAttachMenuVisible(true)}
              disabled={isAiConversation && isSendingAi}
            >
              <Ionicons
                name={editingMessageId ? 'checkmark' : (isAiConversation && isSendingAi ? 'time-outline' : (inputText.trim() ? 'send' : 'image-outline'))}
                size={26}
                color={inputText.trim() && !(isAiConversation && isSendingAi) ? COLORS.primary : '#7B808A'}
              />
            </TouchableOpacity>
          )}
            </>
          )}
        </View>
      </SafeAreaView>

      <Modal
        visible={isMessageActionVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMessageActionMenu}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeMessageActionMenu}>
          <Pressable style={[styles.actionSheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            {/* Emoji reaction bar */}
            <View style={styles.emojiRow}>
              {REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => { void handleReactWithEmoji(emoji); }}
                >
                  <Text style={styles.emojiButtonText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action grid */}
            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.actionGridItem} onPress={() => { setReplyingTo(selectedMessage); closeMessageActionMenu(); }}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#EBF0FF' }]}>
                  <Ionicons name="arrow-undo" size={22} color="#5B7FFF" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.reply', 'Trả lời')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionGridItem} onPress={() => { if (selectedMessage && !selectedMessage.isRecalled) { setForwardingMsg(selectedMessage); closeMessageActionMenu(); } else { closeMessageActionMenu(); } }}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#EBF0FF' }]}>
                  <Ionicons name="arrow-redo" size={22} color="#5B7FFF" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.forward', 'Chuyển tiếp')}</Text>
              </TouchableOpacity>

              {!selectedMessage?.isRecalled && (selectedMessage?.messageType === 'TEXT' || !selectedMessage?.messageType) ? (
                <TouchableOpacity style={styles.actionGridItem} onPress={() => { void handleCopySelectedMessage(); }}>
                  <View style={[styles.actionGridIcon, { backgroundColor: '#EBF0FF' }]}>
                    <Ionicons name="copy-outline" size={22} color="#5B7FFF" />
                  </View>
                  <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.copy', 'Sao chép')}</Text>
                </TouchableOpacity>
              ) : null}

              {isSelectedMessageMine && !selectedMessage?.isRecalled ? (
                <TouchableOpacity style={styles.actionGridItem} onPress={() => { void handleRecallSelectedMessage(); }}>
                  <View style={[styles.actionGridIcon, { backgroundColor: '#FFF3EB' }]}>
                    <Ionicons name="refresh" size={22} color="#F0853A" />
                  </View>
                  <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.recall', 'Thu hồi')}</Text>
                </TouchableOpacity>
              ) : null}

              {isSelectedMessageMine && !selectedMessage?.isRecalled ? (
                <TouchableOpacity style={styles.actionGridItem} onPress={handleStartEditSelectedMessage}>
                  <View style={[styles.actionGridIcon, { backgroundColor: '#EBF0FF' }]}>
                    <Ionicons name="create-outline" size={22} color="#5B7FFF" />
                  </View>
                  <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.edit', 'Chỉnh sửa')}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.actionGridItem} onPress={() => { void handleTogglePinSelectedMessage(); }}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#FFF3EB' }]}>
                  <Ionicons name={isSelectedMessagePinned ? 'pin-outline' : 'pin'} size={22} color="#F0853A" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>
                  {isSelectedMessagePinned ? t('chat.menu.unpin', 'Bỏ ghim') : t('chat.menu.pin', 'Ghim')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionGridItem} onPress={closeMessageActionMenu}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#EBF0FF' }]}>
                  <Ionicons name="checkmark-done-outline" size={22} color="#5B7FFF" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.multi_select', 'Chọn nhiều')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionGridItem} onPress={closeMessageActionMenu}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#EBF0FF' }]}>
                  <Ionicons name="information-circle-outline" size={22} color="#5B7FFF" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.details', 'Chi tiết')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionGridItem} onPress={() => { void handleDeleteSelectedMessageLocal(); }}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#FFEBEB' }]}>
                  <Ionicons name="trash" size={22} color="#F04343" />
                </View>
                <Text style={[styles.actionGridLabel, { color: '#F04343' }]}>{t('chat.menu.delete_local', 'Xóa')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isPinnedListVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPinnedListVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsPinnedListVisible(false)}>
          <Pressable style={[styles.pinnedSheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pinnedHeader}>
              <Text style={[styles.pinnedTitle, { color: colors.text }]}>{t('chat.pinned_title', 'Tin nhắn đã ghim')}</Text>
              <TouchableOpacity onPress={() => setIsPinnedListVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pinnedList}>
              {pinnedMessages.length === 0 ? (
                <Text style={[styles.pinnedEmpty, { color: colors.textSecondary }]}>{t('chat.pinned_empty', 'Chưa có tin nhắn ghim')}</Text>
              ) : pinnedMessages.map((item) => (
                <TouchableOpacity
                  key={item.id || item.messageId}
                  style={[styles.pinnedItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleJumpToPinnedMessage(item.messageId)}
                >
                  <View style={styles.pinnedItemMain}>
                    <Text style={[styles.pinnedSender, { color: colors.text }]} numberOfLines={1}>{item.senderName || t('chat.unknown_user', 'Người dùng')}</Text>
                    <Text style={[styles.pinnedContent, { color: colors.textSecondary }]} numberOfLines={2}>{item.content || t('chat.empty_message', 'Tin nhắn trống')}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { void handleUnpinFromPinnedList(item.messageId); }}
                    style={styles.unpinButton}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Attachment Picker Modal */}
      <Modal
        visible={isAttachMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAttachMenuVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsAttachMenuVisible(false)}>
          <Pressable style={[styles.actionSheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.attachMenuTitle, { color: colors.text }]}>Gửi tệp đính kèm</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.actionGridItem} onPress={handlePickImage}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="image" size={24} color="#4CAF50" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>Hình ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionGridItem} onPress={handlePickVideo}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="videocam" size={24} color="#2196F3" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>Video</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionGridItem} onPress={handlePickFile}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="document" size={24} color="#FF9800" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>Tệp</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionGridItem} onPress={handleTakePhoto}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#FCE4EC' }]}>
                  <Ionicons name="camera" size={24} color="#E91E63" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>Chụp ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionGridItem} onPress={() => { setIsAttachMenuVisible(false); setIsShareContactVisible(true); }}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#E8F4FD' }]}>
                  <Ionicons name="person-circle-outline" size={24} color="#0068FF" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>Danh thiếp</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Forward Message Modal */}
      <Modal
        visible={Boolean(forwardingMsg)}
        transparent
        animationType="slide"
        onRequestClose={() => { setForwardingMsg(null); setFwdSelected(new Set()); setFwdSearch(''); }}
      >
        <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
          <View style={[styles.fwdSheet, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[styles.fwdHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => { setForwardingMsg(null); setFwdSelected(new Set()); setFwdSearch(''); }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.fwdTitle, { color: colors.text }]}>Chuyển tiếp tin nhắn</Text>
              <View style={{ width: 22 }} />
            </View>
            {/* Message preview */}
            {forwardingMsg ? (
              <View style={[styles.fwdPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="return-up-forward-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.fwdPreviewText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {getReplySnippet(forwardingMsg)}
                </Text>
              </View>
            ) : null}
            {/* Search */}
            <View style={[styles.fwdSearchRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.fwdSearchInput, { color: colors.text }]}
                placeholder="Tìm cuộc trò chuyện..."
                placeholderTextColor={colors.textSecondary}
                value={fwdSearch}
                onChangeText={setFwdSearch}
                onFocus={() => {
                  if (fwdConversations.length === 0 && !fwdLoading) {
                    setFwdLoading(true);
                    chatService.getConversations?.()
                      .then((res: any) => {
                        const list: any[] = Array.isArray(res) ? res : (res?.data ?? res?.content ?? []);
                        setFwdConversations(list.filter((c: any) => (c.conversationId || c.id) !== conversationId));
                      })
                      .catch(() => {})
                      .finally(() => setFwdLoading(false));
                  }
                }}
              />
            </View>
            {/* Load on mount */}
            {fwdConversations.length === 0 && !fwdLoading ? (
              <TouchableOpacity
                style={{ paddingVertical: 8, alignItems: 'center' }}
                onPress={() => {
                  setFwdLoading(true);
                  chatService.getConversations?.()
                    .then((res: any) => {
                      const list: any[] = Array.isArray(res) ? res : (res?.data ?? res?.content ?? []);
                      setFwdConversations(list.filter((c: any) => (c.conversationId || c.id) !== conversationId));
                    })
                    .catch(() => {})
                    .finally(() => setFwdLoading(false));
                }}
              >
                <Text style={{ color: '#0068FF', fontSize: 13 }}>Tải danh sách</Text>
              </TouchableOpacity>
            ) : null}
            {/* Conversation list */}
            <ScrollView style={styles.fwdList}>
              {fwdLoading ? (
                <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />
              ) : (
                fwdConversations
                  .filter((c: any) => {
                    const name: string = c.conversationName || c.name || '';
                    return name.toLowerCase().includes(fwdSearch.toLowerCase());
                  })
                  .map((c: any) => {
                    const cId: string = c.conversationId || c.id;
                    const cName: string = c.conversationName || c.name || 'Cuộc trò chuyện';
                    const isSelected = fwdSelected.has(cId);
                    return (
                      <TouchableOpacity
                        key={cId}
                        style={[styles.fwdItem, { borderBottomColor: colors.border }]}
                        onPress={() => {
                          setFwdSelected((prev) => {
                            const next = new Set(prev);
                            if (isSelected) { next.delete(cId); } else { next.add(cId); }
                            return next;
                          });
                        }}
                      >
                        <View style={styles.fwdItemAvatar}>
                          <Text style={styles.fwdItemAvatarText}>{cName.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={[styles.fwdItemName, { color: colors.text }]} numberOfLines={1}>{cName}</Text>
                        <View style={[styles.fwdCheckbox, isSelected && styles.fwdCheckboxSelected, { borderColor: isSelected ? '#0068FF' : colors.border }]}>
                          {isSelected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })
              )}
            </ScrollView>
            {/* Footer */}
            <View style={[styles.fwdFooter, { borderTopColor: colors.border }]}>
              {fwdSelected.size > 0 ? (
                <Text style={[styles.fwdSelectedCount, { color: colors.textSecondary }]}>
                  {`Đã chọn ${fwdSelected.size} cuộc trò chuyện`}
                </Text>
              ) : <View />}
              <TouchableOpacity
                style={[styles.fwdSendBtn, { opacity: fwdSelected.size === 0 || fwdSending ? 0.5 : 1 }]}
                disabled={fwdSelected.size === 0 || fwdSending}
                onPress={async () => {
                  if (!forwardingMsg || fwdSelected.size === 0) return;
                  setFwdSending(true);
                  const sendPromises = Array.from(fwdSelected).map((cId) =>
                    chatService.sendMessage(cId, {
                      content: forwardingMsg.content || '',
                      messageType: forwardingMsg.messageType || 'TEXT',
                      attachments: [],
                      forwardedFromMessageId: forwardingMsg.messageId,
                    }).catch(() => {})
                  );
                  await Promise.all(sendPromises);
                  setFwdSending(false);
                  setForwardingMsg(null);
                  setFwdSelected(new Set());
                  setFwdSearch('');
                  Alert.alert('', `Đã chuyển tiếp đến ${sendPromises.length} cuộc trò chuyện`);
                }}
              >
                {fwdSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.fwdSendBtnText}>Gửi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Contact Modal */}
      <Modal
        visible={isShareContactVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setIsShareContactVisible(false); setScSelected(new Set()); setScSearch(''); }}
      >
        <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
          <View style={[styles.fwdSheet, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[styles.fwdHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => { setIsShareContactVisible(false); setScSelected(new Set()); setScSearch(''); }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.fwdTitle, { color: colors.text }]}>Gửi danh thiếp</Text>
              <View style={{ width: 22 }} />
            </View>
            {/* Include phone toggle */}
            <View style={[styles.scToggleRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.scToggleLabel, { color: colors.text }]}>Bao gồm số điện thoại</Text>
              <TouchableOpacity
                style={[styles.scToggle, { backgroundColor: scIncludePhone ? '#0068FF' : colors.border }]}
                onPress={() => setScIncludePhone((p) => !p)}
              >
                <View style={[styles.scToggleThumb, { left: scIncludePhone ? 18 : 2 }]} />
              </TouchableOpacity>
            </View>
            {/* Search */}
            <View style={[styles.fwdSearchRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.fwdSearchInput, { color: colors.text }]}
                placeholder="Tìm bạn bè..."
                placeholderTextColor={colors.textSecondary}
                value={scSearch}
                onChangeText={setScSearch}
                onFocus={() => {
                  if (scFriends.length === 0 && !scLoading) {
                    setScLoading(true);
                    friendService.getFriendsList()
                      .then((res: any) => {
                        const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
                        setScFriends(list);
                      })
                      .catch(() => {}).finally(() => setScLoading(false));
                  }
                }}
              />
            </View>
            {/* Load friends on mount helper */}
            {scFriends.length === 0 && !scLoading ? (
              <TouchableOpacity
                style={{ paddingVertical: 8, alignItems: 'center' }}
                onPress={() => {
                  setScLoading(true);
                  friendService.getFriendsList()
                    .then((res: any) => {
                      const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
                      setScFriends(list);
                    })
                    .catch(() => {})
                    .finally(() => setScLoading(false));
                }}
              >
                <Text style={{ color: '#0068FF', fontSize: 13 }}>Tải danh bạ</Text>
              </TouchableOpacity>
            ) : null}
            {/* Friends list */}
            <ScrollView style={styles.fwdList}>
              {scLoading ? (
                <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />
              ) : (
                scFriends
                  .filter((f: any) => {
                    const name: string = f.displayName || f.display_name || f.fullName || '';
                    const phone: string = f.phoneNumber || f.phone_number || '';
                    const q = scSearch.toLowerCase();
                    return name.toLowerCase().includes(q) || phone.includes(q);
                  })
                  .map((f: any) => {
                    const fId: string = f.userId || f.user_id || f.id;
                    const fName: string = f.displayName || f.display_name || f.fullName || 'Người dùng';
                    const fPhone: string = f.phoneNumber || f.phone_number || '';
                    const fAvatar: string = f.avatarUrl || f.avatar_url || f.avatar || '';
                    const isSelected = scSelected.has(fId);
                    return (
                      <TouchableOpacity
                        key={fId}
                        style={[styles.fwdItem, { borderBottomColor: colors.border }]}
                        onPress={() => {
                          setScSelected((prev) => {
                            const next = new Set(prev);
                            if (isSelected) { next.delete(fId); } else if (next.size < 9) { next.add(fId); }
                            return next;
                          });
                        }}
                      >
                        <View style={styles.fwdItemAvatar}>
                          {fAvatar ? (
                            <Image source={{ uri: fAvatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                          ) : (
                            <Text style={styles.fwdItemAvatarText}>{fName.charAt(0).toUpperCase()}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fwdItemName, { color: colors.text }]} numberOfLines={1}>{fName}</Text>
                          {fPhone ? <Text style={{ fontSize: 12, color: colors.textSecondary }}>{fPhone}</Text> : null}
                        </View>
                        <View style={[styles.fwdCheckbox, isSelected && styles.fwdCheckboxSelected, { borderColor: isSelected ? '#0068FF' : colors.border }]}>
                          {isSelected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })
              )}
            </ScrollView>
            {/* Footer */}
            <View style={[styles.fwdFooter, { borderTopColor: colors.border }]}>
              {scSelected.size > 0 ? (
                <Text style={[styles.fwdSelectedCount, { color: colors.textSecondary }]}>
                  {`Đã chọn ${scSelected.size}/9`}
                </Text>
              ) : <View />}
              <TouchableOpacity
                style={[styles.fwdSendBtn, { opacity: scSelected.size === 0 || scSending ? 0.5 : 1 }]}
                disabled={scSelected.size === 0 || scSending}
                onPress={async () => {
                  if (scSelected.size === 0) return;
                  setScSending(true);
                  const selectedFriends = scFriends.filter((f: any) => scSelected.has(f.userId || f.user_id || f.id));
                  try {
                    for (const f of selectedFriends) {
                      const contactData = {
                        userId: f.userId || f.user_id || f.id,
                        fullName: f.displayName || f.display_name || f.fullName || '',
                        phoneNumber: scIncludePhone ? (f.phoneNumber || f.phone_number || '') : '',
                        avatar: f.avatarUrl || f.avatar_url || f.avatar || '',
                      };
                      await chatService.sendMessage(conversationId, {
                        content: JSON.stringify(contactData),
                        messageType: 'SHARE_CONTACT',
                        attachments: [],
                      });
                    }
                    setIsShareContactVisible(false);
                    setScSelected(new Set());
                    setScSearch('');
                  } catch {
                    Alert.alert('Lỗi', 'Không thể gửi danh thiếp. Vui lòng thử lại.');
                  } finally {
                    setScSending(false);
                  }
                }}
              >
                {scSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.fwdSendBtnText}>Gửi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Image Preview */}
      <Modal
        visible={!!fullscreenImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImageUrl(null)}
      >
        <View style={styles.fullscreenImageBackdrop}>
          <TouchableOpacity
            style={styles.fullscreenImageClose}
            onPress={() => setFullscreenImageUrl(null)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          {fullscreenImageUrl ? (
            <Image
              source={{ uri: fullscreenImageUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={styles.fullscreenImageDownload}
            onPress={() => {
              if (fullscreenImageUrl) {
                Linking.openURL(fullscreenImageUrl);
              }
            }}
          >
            <Ionicons name="download-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Fullscreen Video Preview */}
      <Modal
        visible={!!fullscreenVideoUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenVideoUrl(null)}
      >
        <View style={styles.fullscreenImageBackdrop}>
          <TouchableOpacity
            style={styles.fullscreenImageClose}
            onPress={() => setFullscreenVideoUrl(null)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          {fullscreenVideoUrl ? (
            <Video
              source={{ uri: fullscreenVideoUrl }}
              style={styles.fullscreenVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          ) : null}
        </View>
      </Modal>

      {/* ── Chat Info Panel ──────────────────────────────────────────────── */}
      <Modal
        visible={isInfoPanelVisible}
        animationType="slide"
        onRequestClose={() => setIsInfoPanelVisible(false)}
      >
        <SafeAreaView style={[styles.infoPanelContainer, { backgroundColor: colors.background }]}>
          {/* Panel Header */}
          <View style={[styles.infoPanelHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.infoPanelTitle, { color: colors.text }]}>Thông tin hội thoại</Text>
            <TouchableOpacity onPress={() => setIsInfoPanelVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.infoPanelScroll} showsVerticalScrollIndicator={false}>

            {/* Profile section */}
            <View style={[styles.infoPanelProfile, { borderBottomColor: colors.border }]}>
              {isAiConversation ? (
                <View style={styles.infoPanelAiAvatar}>
                  <Ionicons name="sparkles" size={34} color="#FFFFFF" />
                </View>
              ) : isCloudConversation ? (
                <View style={[styles.infoPanelCloudAvatar]}>
                  <Ionicons name="cloud" size={36} color="#FFFFFF" />
                </View>
              ) : avatar ? (
                <Image source={peerAvatarSource} style={styles.infoPanelAvatarImg} />
              ) : (
                <View style={styles.infoPanelDefaultAvatar}>
                  <Text style={styles.infoPanelDefaultAvatarText}>{(String(name ?? '?')).charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={[styles.infoPanelName, { color: colors.text }]} numberOfLines={2}>{name}</Text>
              {isGroupConversation && infoMembers.length > 0 && (
                <Text style={[styles.infoPanelSubName, { color: colors.textSecondary }]}>{infoMembers.length} thành viên</Text>
              )}
            </View>

            {/* AI Info section */}
            {isAiConversation && (
              <View style={[styles.infoPanelSection, { borderBottomColor: colors.border }]}>
                <Text style={[styles.infoPanelSectionTitle, { color: colors.text }]}>Khả năng của Fruvia AI</Text>
                {['Trả lời câu hỏi thông minh về mọi chủ đề', 'Tạo hình ảnh từ mô tả văn bản', 'Hỗ trợ phân tích tài liệu và file cá nhân'].map((cap) => (
                  <Text key={cap} style={[styles.infoPanelCapItem, { color: colors.textSecondary }]}>• {cap}</Text>
                ))}
                <TouchableOpacity
                  style={styles.infoPanelDangerBtn}
                  onPress={handleInfoClearChat}
                >
                  <Ionicons name="trash-outline" size={16} color="#F04343" />
                  <Text style={styles.infoPanelDangerBtnText}>Xóa lịch sử chat</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cloud storage section */}
            {isCloudConversation && infoStorageStats && (
              <View style={[styles.infoPanelSection, { borderBottomColor: colors.border }]}>
                <View style={styles.infoPanelStorageHeader}>
                  <Text style={[styles.infoPanelSectionTitle, { color: colors.text }]}>Dung lượng lưu trữ</Text>
                  <Text style={[styles.infoPanelStorageUsed, { color: colors.textSecondary }]}>
                    {infoStorageStats.totalSizeFormatted ?? '0 B'} / 500 MB
                  </Text>
                </View>
                <View style={styles.infoPanelStorageBar}>
                  {infoStorageStats.totalSize > 0 && (
                    <>
                      <View style={[styles.infoPanelStorageSegment, { backgroundColor: '#F97316', flex: (infoStorageStats.imageSize ?? 0) / infoStorageStats.totalSize }]} />
                      <View style={[styles.infoPanelStorageSegment, { backgroundColor: '#3B82F6', flex: (infoStorageStats.videoSize ?? 0) / infoStorageStats.totalSize }]} />
                      <View style={[styles.infoPanelStorageSegment, { backgroundColor: '#22C55E', flex: (infoStorageStats.fileSize ?? 0) / infoStorageStats.totalSize }]} />
                      <View style={[styles.infoPanelStorageSegment, { backgroundColor: '#EC4899', flex: (infoStorageStats.voiceSize ?? 0) / infoStorageStats.totalSize }]} />
                    </>
                  )}
                </View>
                <View style={styles.infoPanelStorageLegend}>
                  {[
                    { color: '#F97316', label: `Ảnh ${infoStorageStats.imageSizeFormatted ? `(${infoStorageStats.imageSizeFormatted})` : ''}` },
                    { color: '#3B82F6', label: `Video ${infoStorageStats.videoSizeFormatted ? `(${infoStorageStats.videoSizeFormatted})` : ''}` },
                    { color: '#22C55E', label: `File ${infoStorageStats.fileSizeFormatted ? `(${infoStorageStats.fileSizeFormatted})` : ''}` },
                    { color: '#EC4899', label: `Giọng nói ${infoStorageStats.voiceSizeFormatted ? `(${infoStorageStats.voiceSizeFormatted})` : ''}` },
                  ].map((item) => (
                    <View key={item.color} style={styles.infoPanelLegendItem}>
                      <View style={[styles.infoPanelLegendDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.infoPanelLegendText, { color: colors.textSecondary }]}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Group Members section */}
            {isGroupConversation && (
              <View style={[styles.infoPanelSection, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.infoPanelSectionToggle}
                  onPress={() => setInfoShowMembers((v) => !v)}
                >
                  <View style={styles.infoPanelSectionToggleLeft}>
                    <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.infoPanelSectionTitle, { color: colors.text, marginLeft: 8 }]}>
                      Thành viên ({infoMembers.length})
                    </Text>
                  </View>
                  <Ionicons name={infoShowMembers ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {infoShowMembers && (
                  <View style={styles.infoPanelMemberList}>
                    {/* Add member button */}
                    {infoCanAddMembers && !infoAddMemberVisible && (
                      <TouchableOpacity
                        style={styles.infoPanelAddMemberBtn}
                        onPress={async () => { setInfoAddMemberVisible(true); await fetchInfoFriendsForAdd(); }}
                      >
                        <Ionicons name="person-add-outline" size={16} color="#0068FF" />
                        <Text style={styles.infoPanelAddMemberBtnText}>Thêm thành viên</Text>
                      </TouchableOpacity>
                    )}

                    {/* Add member panel */}
                    {infoAddMemberVisible && (
                      <View style={[styles.infoPanelAddPanel, { borderColor: colors.border, backgroundColor: colors.card }]}>
                        <View style={styles.infoPanelAddPanelHeader}>
                          <Text style={[styles.infoPanelAddPanelTitle, { color: colors.text }]}>Chọn bạn bè</Text>
                          <TouchableOpacity onPress={() => { setInfoAddMemberVisible(false); setInfoSelectedMembers([]); }}>
                            <Ionicons name="close" size={18} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                        {infoFriendsList.length === 0 ? (
                          <Text style={[styles.infoPanelEmpty, { color: colors.textSecondary }]}>Không có bạn bè nào</Text>
                        ) : infoFriendsList.map((f: any) => {
                          const fId = f.user_id || f.id;
                          const fName = f.display_name || f.full_name || f.name || 'Unknown';
                          const fAvatar = f.avatar_url || f.avatar;
                          const isSelected = infoSelectedMembers.includes(fId);
                          return (
                            <TouchableOpacity
                              key={fId}
                              style={styles.infoPanelFriendRow}
                              onPress={() => setInfoSelectedMembers((prev) =>
                                isSelected ? prev.filter((id) => id !== fId) : [...prev, fId]
                              )}
                            >
                              {fAvatar ? (
                                <Image source={getAvatarSource(fAvatar)} style={styles.infoPanelSmallAvatar} />
                              ) : (
                                <View style={[styles.infoPanelSmallAvatar, styles.infoPanelDefaultAvatar]}>
                                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{fName.charAt(0)}</Text>
                                </View>
                              )}
                              <Text style={[styles.infoPanelMemberName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{fName}</Text>
                              <Ionicons
                                name={isSelected ? 'checkbox' : 'square-outline'}
                                size={20}
                                color={isSelected ? '#0068FF' : colors.textSecondary}
                              />
                            </TouchableOpacity>
                          );
                        })}
                        {infoSelectedMembers.length > 0 && (
                          <TouchableOpacity
                            style={[styles.infoPanelAddMemberBtn, { marginTop: 8 }]}
                            onPress={handleInfoAddMembers}
                            disabled={infoAddingMembers}
                          >
                            <Text style={styles.infoPanelAddMemberBtnText}>
                              {infoAddingMembers ? 'Đang thêm...' : `Thêm ${infoSelectedMembers.length} người`}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Members list */}
                    {infoMembers.map((m: any) => {
                      const mName = m.displayName || m.userName || 'Unknown';
                      const mAvatar = m.avatarUrl || m.avatar;
                      const mRole = m.role;
                      const isMe = m.userId === currentUserId;
                      const menuOpen = infoMemberMenuId === m.userId;
                      return (
                        <View key={m.userId} style={styles.infoPanelMemberRow}>
                          {mAvatar ? (
                            <Image source={getAvatarSource(mAvatar)} style={styles.infoPanelMemberAvatar} />
                          ) : (
                            <View style={[styles.infoPanelMemberAvatar, styles.infoPanelDefaultAvatar]}>
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{mName.charAt(0)}</Text>
                            </View>
                          )}
                          <View style={styles.infoPanelMemberInfo}>
                            <Text style={[styles.infoPanelMemberName, { color: colors.text }]} numberOfLines={1}>
                              {mName}{isMe ? ' (Bạn)' : ''}
                            </Text>
                            {mRole === 'ADMIN' && <Text style={styles.infoPanelRoleBadgeAdmin}>Trưởng nhóm</Text>}
                            {mRole === 'DEPUTY' && <Text style={styles.infoPanelRoleBadgeDeputy}>Phó nhóm</Text>}
                          </View>
                          {infoIsAdmin && !isMe && (
                            <TouchableOpacity
                              style={styles.infoPanelMemberMenuBtn}
                              onPress={() => setInfoMemberMenuId(menuOpen ? null : m.userId)}
                            >
                              <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                          )}
                          {menuOpen && (
                            <View style={[styles.infoPanelMemberMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                              {mRole !== 'DEPUTY' && (
                                <TouchableOpacity
                                  style={styles.infoPanelMemberMenuItem}
                                  onPress={() => handleInfoChangeRole(m.userId, mName, 'DEPUTY')}
                                >
                                  <Text style={[styles.infoPanelMemberMenuItemText, { color: colors.text }]}>Đặt làm phó nhóm</Text>
                                </TouchableOpacity>
                              )}
                              {mRole === 'DEPUTY' && (
                                <TouchableOpacity
                                  style={styles.infoPanelMemberMenuItem}
                                  onPress={() => handleInfoChangeRole(m.userId, mName, 'MEMBER')}
                                >
                                  <Text style={[styles.infoPanelMemberMenuItemText, { color: colors.text }]}>Hạ xuống thành viên</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={styles.infoPanelMemberMenuItem}
                                onPress={() => { setInfoMemberMenuId(null); setInfoTransferReason('transfer'); handleInfoTransferOwnership(m.userId, mName); }}
                              >
                                <Text style={[styles.infoPanelMemberMenuItemText, { color: '#F97316' }]}>Chuyển quyền trưởng nhóm</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.infoPanelMemberMenuItem}
                                onPress={() => { setInfoMemberMenuId(null); handleInfoRemoveMember(m.userId, mName); }}
                              >
                                <Text style={[styles.infoPanelMemberMenuItemText, { color: '#F04343' }]}>Xóa khỏi nhóm</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Leave / Dissolve buttons */}
                    <TouchableOpacity style={styles.infoPanelDangerBtn} onPress={handleInfoLeaveGroup}>
                      <Ionicons name="exit-outline" size={16} color="#F04343" />
                      <Text style={styles.infoPanelDangerBtnText}>
                        {infoIsAdmin ? 'Chuyển quyền & rời nhóm' : 'Rời nhóm'}
                      </Text>
                    </TouchableOpacity>
                    {infoIsAdmin && (
                      <TouchableOpacity style={[styles.infoPanelDangerBtn, { marginTop: 6 }]} onPress={handleInfoDissolveGroup}>
                        <Ionicons name="warning-outline" size={16} color="#DC2626" />
                        <Text style={[styles.infoPanelDangerBtnText, { color: '#DC2626' }]}>Giải tán nhóm</Text>
                      </TouchableOpacity>
                    )}

                    {/* Transfer ownership modal */}
                    {infoShowTransferModal && (
                      <View style={[styles.infoPanelTransferBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                        <Text style={[styles.infoPanelSectionTitle, { color: colors.text, marginBottom: 8 }]}>
                          {infoTransferReason === 'leave' ? 'Chọn trưởng nhóm kế tiếp' : 'Chọn người nhận quyền'}
                        </Text>
                        {infoMembers.filter((m) => m.userId !== currentUserId).map((m: any) => {
                          const mName = m.displayName || m.userName || 'Unknown';
                          const mAvatar = m.avatarUrl || m.avatar;
                          return (
                            <TouchableOpacity
                              key={m.userId}
                              style={styles.infoPanelFriendRow}
                              onPress={() => handleInfoTransferOwnership(m.userId, mName)}
                            >
                              {mAvatar ? (
                                <Image source={getAvatarSource(mAvatar)} style={styles.infoPanelSmallAvatar} />
                              ) : (
                                <View style={[styles.infoPanelSmallAvatar, styles.infoPanelDefaultAvatar]}>
                                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{mName.charAt(0)}</Text>
                                </View>
                              )}
                              <Text style={[styles.infoPanelMemberName, { color: colors.text }]} numberOfLines={1}>{mName}</Text>
                              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity onPress={() => setInfoShowTransferModal(false)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Hủy</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Pinned Messages section */}
            {!isAiConversation && (
              <View style={[styles.infoPanelSection, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.infoPanelSectionToggle}
                  onPress={() => setInfoShowPinned((v) => !v)}
                >
                  <View style={styles.infoPanelSectionToggleLeft}>
                    <Ionicons name="pin-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.infoPanelSectionTitle, { color: colors.text, marginLeft: 8 }]}>
                      Tin nhắn đã ghim {pinnedMessages.length > 0 ? `(${pinnedMessages.length})` : ''}
                    </Text>
                  </View>
                  <Ionicons name={infoShowPinned ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                {infoShowPinned && (
                  <View>
                    {pinnedMessages.length === 0 ? (
                      <Text style={[styles.infoPanelEmpty, { color: colors.textSecondary }]}>Chưa có tin nhắn ghim</Text>
                    ) : pinnedMessages.map((pin, idx) => (
                      <View key={pin.id || pin.messageId} style={[styles.infoPanelPinnedRow, { borderBottomColor: colors.border }]}>
                        <View style={styles.infoPanelPinnedIndex}>
                          <Text style={styles.infoPanelPinnedIndexText}>{idx + 1}</Text>
                        </View>
                        <View style={styles.infoPanelPinnedContent}>
                          <Text style={[styles.infoPanelPinnedSender, { color: '#0068FF' }]} numberOfLines={1}>{pin.senderName}</Text>
                          <Text style={[styles.infoPanelPinnedText, { color: colors.text }]} numberOfLines={2}>{pin.content}</Text>
                        </View>
                        <TouchableOpacity onPress={() => { void handleUnpinFromPinnedList(pin.messageId); }}>
                          <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Media section */}
            <View style={[styles.infoPanelSection, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={styles.infoPanelSectionToggle}
                onPress={() => setInfoShowMedia((v) => !v)}
              >
                <View style={styles.infoPanelSectionToggleLeft}>
                  <Ionicons name="images-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.infoPanelSectionTitle, { color: colors.text, marginLeft: 8 }]}>Ảnh &amp; Video</Text>
                </View>
                <Ionicons name={infoShowMedia ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {infoShowMedia && (
                <View>
                  {infoMediaItems.length === 0 ? (
                    <Text style={[styles.infoPanelEmpty, { color: colors.textSecondary }]}>Chưa có ảnh hoặc video</Text>
                  ) : (
                    <View style={styles.infoPanelMediaGrid}>
                      {infoMediaItems.slice(0, 9).map((m: any, i: number) => (
                        <TouchableOpacity
                          key={m.id || i}
                          style={styles.infoPanelMediaThumb}
                          onPress={() => {
                            if (m.messageType === 'IMAGE') setInfoSelectedImage(m.content);
                            else if (m.messageType === 'VIDEO') setInfoSelectedImage(null);
                          }}
                        >
                          {m.messageType === 'IMAGE' ? (
                            <Image source={{ uri: m.content }} style={styles.infoPanelMediaThumbImg} resizeMode="cover" />
                          ) : (
                            <View style={[styles.infoPanelMediaThumbImg, { backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' }]}>
                              <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.7)" />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Files section */}
            <View style={[styles.infoPanelSection, { borderBottomColor: colors.border, marginBottom: 32 }]}>
              <TouchableOpacity
                style={styles.infoPanelSectionToggle}
                onPress={() => setInfoShowFiles((v) => !v)}
              >
                <View style={styles.infoPanelSectionToggleLeft}>
                  <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.infoPanelSectionTitle, { color: colors.text, marginLeft: 8 }]}>Tệp đính kèm</Text>
                </View>
                <Ionicons name={infoShowFiles ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {infoShowFiles && (
                <View>
                  {infoFileItems.length === 0 ? (
                    <Text style={[styles.infoPanelEmpty, { color: colors.textSecondary }]}>Chưa có tệp đính kèm</Text>
                  ) : infoFileItems.slice(0, 10).map((f: any, i: number) => {
                    const rawName = (f.content ?? '').split('/').pop()?.split('_').slice(1).join('_') || 'Tệp đính kèm';
                    const fileName = decodeURIComponent(rawName);
                    const ext = fileName.split('.').pop()?.toLowerCase() || '';
                    const extColor = ext === 'pdf' ? '#F40F02' : ['doc', 'docx'].includes(ext) ? '#0068FF' : ['xls', 'xlsx'].includes(ext) ? '#217346' : '#6B7280';
                    return (
                      <TouchableOpacity
                        key={f.id || i}
                        style={styles.infoPanelFileRow}
                        onPress={() => f.content && Linking.openURL(f.content)}
                      >
                        <View style={[styles.infoPanelFileIcon, { backgroundColor: extColor }]}>
                          <Text style={styles.infoPanelFileExt}>{ext.toUpperCase().slice(0, 3) || 'FILE'}</Text>
                        </View>
                        <View style={styles.infoPanelFileInfo}>
                          <Text style={[styles.infoPanelFileName, { color: colors.text }]} numberOfLines={1}>{fileName}</Text>
                          {f.fileSize ? <Text style={[styles.infoPanelFileSize, { color: colors.textSecondary }]}>{chatFileService.formatFileSize(f.fileSize)}</Text> : null}
                        </View>
                        <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

          </ScrollView>
        </SafeAreaView>

        {/* Lightbox inside info panel */}
        <Modal
          visible={!!infoSelectedImage}
          transparent
          animationType="fade"
          onRequestClose={() => setInfoSelectedImage(null)}
        >
          <View style={styles.fullscreenImageBackdrop}>
            <TouchableOpacity style={styles.fullscreenImageClose} onPress={() => setInfoSelectedImage(null)}>
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            {infoSelectedImage ? (
              <Image source={{ uri: infoSelectedImage }} style={styles.fullscreenImage} resizeMode="contain" />
            ) : null}
          </View>
        </Modal>
      </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#EBF0F6',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#2F87F2',
  },
  headerInfo: { 
    flex: 1, 
    marginLeft: 14 
  },
  headerTitle: { 
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  headerSubtitle: { 
    fontSize: 10,
    color: '#CFE4FF',
    fontWeight: '500',
  },
  headerActions: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerIcon: { 
    width: 42,
    height: 42,
    justifyContent: 'center', 
    alignItems: 'center',
  },
  messagesList: { 
    paddingHorizontal: 10, 
    paddingVertical: 12, 
    flexGrow: 1, 
    justifyContent: 'flex-end'
  },
  olderLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  olderLoadingText: {
    fontSize: 11,
    fontWeight: '500',
  },
  messageContainer: { 
    marginBottom: 2,
    width: '100%',
  },
  userMessageBlock: {
    alignItems: 'flex-end',
    marginLeft: 48,
  },
  otherMessageBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginRight: 48,
  },
  otherContentBlock: {
    flex: 1,
    marginLeft: 8,
    alignItems: 'flex-start',
  },
  otherAvatarSlot: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  peerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8EDF3',
  },
  messageBubble: { 
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
    maxWidth: '85%',
    minWidth: 48,
    minHeight: 42,
    justifyContent: 'center' as const,
  },
  userBubble: {
    backgroundColor: '#D0EAFF',
    borderTopRightRadius: 6,
  },
  otherBubble: {
    borderTopLeftRadius: 6,
  },
  messageText: { 
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400',
  },
  userMessageText: {
    color: '#1A2A3B',
  },
  dateSeparator: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  dateSeparatorText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
    backgroundColor: '#4A4E57',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  timestamp: { 
    fontSize: 10,
    marginTop: 4,
    color: '#8D929C',
    fontWeight: '400',
  },
  timestampLeft: {
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  timestampRight: {
    marginRight: 4,
    alignSelf: 'flex-end',
  },
  recalledText: {
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  userRecalledText: {
    color: '#526377',
  },
  editedLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '500',
  },
  userEditedLabel: {
    color: '#617287',
  },
  reactionRowLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: -6,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  reactionRowRight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: -6,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionChipText: {
    fontSize: 9,
    color: '#2D3640',
    fontWeight: '600',
  },
  inputArea: { 
    flexDirection: 'column', 
    alignItems: 'stretch', 
    paddingHorizontal: 12, 
    paddingVertical: 8,
    borderTopWidth: 1, 
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    backgroundColor: '#F4F7FC',
    borderWidth: 1,
    borderColor: '#DEE5EF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editingBannerTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  editingBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2A3340',
  },
  editingBannerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#6C7480',
  },
  editingCloseButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButton: { 
    width: 34,
    height: 34,
    justifyContent: 'center', 
    alignItems: 'center',
  },
  input: { 
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 2,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '500',
    backgroundColor: 'transparent',
  },
  bottomActionButton: {
    width: 34,
    height: 34,
    justifyContent: 'center', 
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 20,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  emojiButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#F4F6FA',
  },
  emojiButtonText: {
    fontSize: 28,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  actionGridItem: {
    width: '25%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  actionGridIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionGridLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  pinnedSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  pinnedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pinnedTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pinnedList: {
    maxHeight: 420,
  },
  pinnedEmpty: {
    paddingVertical: 20,
    textAlign: 'center',
    fontSize: 13,
  },
  pinnedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  pinnedItemMain: {
    flex: 1,
    gap: 2,
  },
  pinnedSender: {
    fontSize: 12,
    fontWeight: '700',
  },
  pinnedContent: {
    fontSize: 12,
    lineHeight: 16,
  },
  unpinButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Media message styles ──────────────────
  mediaBubble: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderRadius: 6,
    overflow: 'hidden' as const,
  },
  mediaImage: {
    width: 220,
    height: 220,
    borderRadius: 6,
    backgroundColor: '#000000',
  },
  mediaUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mediaUploadingText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  videoContainer: {
    width: 220,
    height: 160,
    borderRadius: 6,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' as const,
  },
  videoPlayOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  videoDurationText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  fileNameText: {
    fontSize: 11,
    marginTop: 2,
  },
  fileBubbleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
  },
  fileIconWrap: {
    width: 44,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#EBF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileExtLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  fileInfoWrap: {
    flex: 1,
    gap: 2,
  },
  fileNameMainText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fileSizeText: {
    fontSize: 11,
  },
  // ── Media preview banner ──────────────────
  mediaPreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F4F7FC',
    borderWidth: 1,
    borderColor: '#DEE5EF',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 10,
  },
  mediaPreviewThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#E8EDF3',
  },
  mediaPreviewFileIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#EBF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPreviewInfo: {
    flex: 1,
    gap: 2,
  },
  mediaPreviewName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2A3340',
  },
  mediaPreviewSize: {
    fontSize: 11,
    color: '#6C7480',
  },
  mediaPreviewClose: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadProgressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DEE5EF',
    marginTop: 4,
    overflow: 'hidden' as const,
  },
  uploadProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  // ── Attach menu ──────────────────
  attachMenuTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  // ── Reply bar ─────────────────────
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
    minHeight: 52,
  },
  replyBarAccent: {
    width: 3,
    height: 36,
    borderRadius: 2,
    backgroundColor: '#0068FF',
    flexShrink: 0,
  },
  replyBarContent: {
    flex: 1,
    gap: 2,
  },
  replyBarSender: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyBarSnippet: {
    fontSize: 12,
  },
  replyBarDismiss: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Reply snippet inside bubble ───
  replySnippetBlock: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#0068FF',
    maxWidth: '100%',
  },
  replySnippetBlockUser: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  replySnippetBlockOther: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  replySnippetSender: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  replySnippetText: {
    fontSize: 12,
  },
  // ── Forwarded banner ──────────────
  forwardedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  forwardedBannerText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  // ── Contact card ──────────────────
  contactCard: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 220,
    backgroundColor: '#F4F7FC',
    borderWidth: 1,
    borderColor: '#DEE5EF',
  },
  contactCardUser: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  contactCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  contactCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCardAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  contactCardAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contactCardInfo: {
    flex: 1,
    gap: 2,
  },
  contactCardName: {
    fontSize: 14,
    fontWeight: '700',
  },
  contactCardPhone: {
    fontSize: 12,
  },
  contactCardDivider: {
    height: 1,
    marginHorizontal: 0,
  },
  contactCardBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  contactCardBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Forward / Share Contact modals ─
  fwdSheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 16,
  },
  fwdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  fwdTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  fwdPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  fwdPreviewText: {
    fontSize: 13,
    flex: 1,
  },
  fwdSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  fwdSearchInput: {
    flex: 1,
    fontSize: 14,
    height: 36,
    padding: 0,
  },
  fwdList: {
    maxHeight: 320,
    paddingHorizontal: 16,
  },
  fwdItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  fwdItemAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0068FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fwdItemAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fwdItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  fwdCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fwdCheckboxSelected: {
    backgroundColor: '#0068FF',
  },
  fwdFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    marginTop: 4,
  },
  fwdSelectedCount: {
    fontSize: 13,
  },
  fwdSendBtn: {
    backgroundColor: '#0068FF',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  fwdSendBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  // Share contact toggle
  scToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  scToggleLabel: {
    fontSize: 14,
  },
  scToggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    position: 'relative',
  },
  scToggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
  },
  // ── Fullscreen image preview ──────
  fullscreenImageBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
  fullscreenImageClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullscreenImageDownload: {
    position: 'absolute',
    bottom: 50,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
  },
  fullscreenVideo: {
    width: '100%',
    height: '75%',
  },
  // ── Emoji picker ──────────────────
  emojiPickerPanel: {
    height: 240,
    borderTopWidth: 1,
    borderTopColor: '#E5E9EF',
    backgroundColor: '#FFFFFF',
  },
  emojiPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  emojiPickerItem: {
    width: '12.5%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiPickerText: {
    fontSize: 26,
  },
  // ── Voice message bubble ──────────
  voiceBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
    minWidth: 180,
  },
  voiceWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  voiceBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#9EBCD8',
  },
  voiceDurationText: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 32,
    textAlign: 'right',
  },
  // ── Recording UI ──────────────────
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
  },
  recordingTimeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF3B30',
  },
  recordingLabel: {
    fontSize: 12,
    color: '#7B808A',
  },
  recordingCancelBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Info Panel ────────────────────────────────────────────────────────────
  infoPanelContainer: {
    flex: 1,
  },
  infoPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoPanelTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  infoPanelScroll: {
    flex: 1,
  },
  infoPanelProfile: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  infoPanelAiAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#06B6D4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoPanelCloudAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0068FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoPanelAvatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  infoPanelDefaultAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoPanelDefaultAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoPanelName: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  infoPanelSubName: {
    fontSize: 13,
    textAlign: 'center',
  },
  infoPanelSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoPanelSectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoPanelSectionToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoPanelSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoPanelCapItem: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 20,
  },
  infoPanelDangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(240,67,67,0.08)',
    borderRadius: 8,
    justifyContent: 'center',
  },
  infoPanelDangerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F04343',
  },
  infoPanelStorageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoPanelStorageUsed: {
    fontSize: 12,
  },
  infoPanelStorageBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    marginBottom: 10,
  },
  infoPanelStorageSegment: {
    height: '100%',
  },
  infoPanelStorageLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoPanelLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoPanelLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoPanelLegendText: {
    fontSize: 11,
  },
  infoPanelMemberList: {
    marginTop: 8,
  },
  infoPanelAddMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,104,255,0.08)',
    borderRadius: 8,
    justifyContent: 'center',
    marginBottom: 8,
  },
  infoPanelAddMemberBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0068FF',
  },
  infoPanelAddPanel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  infoPanelAddPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoPanelAddPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoPanelFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  infoPanelSmallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  infoPanelMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    position: 'relative',
  },
  infoPanelMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  infoPanelMemberInfo: {
    flex: 1,
  },
  infoPanelMemberName: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoPanelRoleBadgeAdmin: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F97316',
    marginTop: 2,
  },
  infoPanelRoleBadgeDeputy: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
    marginTop: 2,
  },
  infoPanelMemberMenuBtn: {
    padding: 6,
  },
  infoPanelMemberMenu: {
    position: 'absolute',
    right: 0,
    top: 36,
    zIndex: 10,
    borderWidth: 1,
    borderRadius: 10,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  infoPanelMemberMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  infoPanelMemberMenuItemText: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoPanelTransferBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  infoPanelEmpty: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
    opacity: 0.6,
  },
  infoPanelPinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  infoPanelPinnedIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,104,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoPanelPinnedIndexText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0068FF',
  },
  infoPanelPinnedContent: {
    flex: 1,
  },
  infoPanelPinnedSender: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoPanelPinnedText: {
    fontSize: 13,
    marginTop: 2,
  },
  infoPanelMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 8,
  },
  infoPanelMediaThumb: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  infoPanelMediaThumbImg: {
    width: '100%',
    height: '100%',
  },
  infoPanelFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  infoPanelFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoPanelFileExt: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  infoPanelFileInfo: {
    flex: 1,
  },
  infoPanelFileName: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoPanelFileSize: {
    fontSize: 11,
    marginTop: 2,
  },
});

