import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useChatSocket } from '@/hooks/useChatSocket';
import { chatFileService, type PickedMedia } from '@/services/chatFileService';
import { chatService } from '@/services/chatService';
import { friendService } from '@/services/friendService';
import { getAvatarSource } from '@/services/mediaUtils';
import { Ionicons } from '@expo/vector-icons';
import type { AxiosError } from 'axios';
import { Audio, ResizeMode, Video } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
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
  type ChatUiMessage,
  type ChatUiReaction,
} from '../services/chatMessageAdapter';

interface Message {
  messageId: string;
  content: string;
  senderId: string;
  createdAt: string;
  senderName?: string;
  senderAvatarUrl?: string;
  messageType?: string;
  systemActionType?: 'PIN' | 'UNPIN' | 'JOIN' | 'LEAVE' | 'INFO';
  systemTargetMessageId?: string;
  systemActorName?: string;
  isEdited?: boolean;
  isRecalled?: boolean;
  updatedAt?: string;
  reactions?: ChatUiReaction[];
  fileName?: string;
  fileSize?: number;
  caption?: string;
  thumbnailUrl?: string;
  videoDuration?: number;
  voiceDuration?: number;
  // Reply
  replyToMessageId?: string;
  replyToSenderName?: string;
  replyToContent?: string;
  replyToMessageType?: string;
  // Forward
  forwardedFromSenderName?: string;
  // IMAGE_GROUP attachments
  attachments?: { url: string; fileName?: string; fileSize?: number; thumbnailUrl?: string }[];
}

interface PinnedMessageItem {
  id: string;
  messageId: string;
  content: string;
  messageType?: string;
  contentUrl?: string;
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
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

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

const pad2 = (value: number) => String(value).padStart(2, '0');

// Hàm tạo chuỗi giờ địa phương chuẩn (Dùng cho tin nhắn vừa bấm gửi)
const toLocalIsoString = (date: Date) => {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

const parseMessageDate = (createdAt?: string) => {
  if (!createdAt) return null;
  let raw = String(createdAt).trim();
  if (!raw) return null;

  // QUAN TRỌNG: Cắt bỏ đuôi múi giờ (Z, +00:00, +07:00)
  // Để ép Javascript hiểu chuỗi này là giờ địa phương thiết bị
  raw = raw.replace(/(Z|[+-]\d{2}:?\d{2})$/i, '');

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const epoch = Number(raw);
  if (!Number.isNaN(epoch)) {
    const fallback = new Date(epoch);
    if (!Number.isNaN(fallback.getTime())) return fallback;
  }

  return null;
};

const getMessageMillis = (createdAt?: string) => {
  if (!createdAt) return NaN;

  const raw = String(createdAt).trim();
  if (!raw) return NaN;

  const parsed = parseMessageDate(raw);
  if (parsed) {
    return parsed.getTime();
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
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
  '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
  '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱',
  '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻',
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '🤙', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌',
  '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🎉', '🎊',
  '🎈', '🎁', '🎀', '🔥', '⭐', '✨', '💫', '🌟', '🌈', '☀️', '🌙', '❄️', '🌸', '🌺', '🌻', '🌹', '🍀', '🌊', '🌍', '🐶',
  '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦',
  '🍎', '🍊', '🍋', '🍇', '🍓', '🍒', '🍑', '🍍', '🥭', '🍕', '🍔', '🍟', '🌭', '🍿', '🧁', '🍰', '🎂', '☕', '🍵', '🥤',
];

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id, name, avatar, type } = useLocalSearchParams<{ id: string; name: string; avatar?: string; type?: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(String(id ?? ''));
  const [conversationDisplayName, setConversationDisplayName] = useState(String(name ?? ''));
  const [conversationAvatarUrl, setConversationAvatarUrl] = useState(String(avatar ?? ''));
  const [messages, setMessages] = useState<Message[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
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
  const [pendingMediaList, setPendingMediaList] = useState<PickedMedia[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCurrentIndex, setUploadCurrentIndex] = useState(0);
  const [videoThumbnailsByMessageId, setVideoThumbnailsByMessageId] = useState<Record<string, string>>({});
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
  const [infoAddMemberSearch, setInfoAddMemberSearch] = useState('');
  const [infoFriendsList, setInfoFriendsList] = useState<any[]>([]);
  const [infoSelectedMembers, setInfoSelectedMembers] = useState<string[]>([]);
  const [infoAddingMembers, setInfoAddingMembers] = useState(false);
  const [infoMemberMenuId, setInfoMemberMenuId] = useState<string | null>(null);
  const [infoShowTransferModal, setInfoShowTransferModal] = useState(false);
  const [infoTransferReason, setInfoTransferReason] = useState<'transfer' | 'leave'>('transfer');
  const [isInfoMediaGalleryVisible, setIsInfoMediaGalleryVisible] = useState(false);
  const [infoMediaGalleryStartIndex, setInfoMediaGalleryStartIndex] = useState(0);
  const [infoMediaGalleryIndex, setInfoMediaGalleryIndex] = useState(0);
  const [isInfoGalleryMenuVisible, setIsInfoGalleryMenuVisible] = useState(false);
  const [infoGalleryPlayingMediaId, setInfoGalleryPlayingMediaId] = useState<string | null>(null);
  const [isInfoGalleryVideoLoading, setIsInfoGalleryVideoLoading] = useState(false);
  const [infoVideoThumbnailsByMediaId, setInfoVideoThumbnailsByMediaId] = useState<Record<string, string>>({});
  const [isJumpingToMessage, setIsJumpingToMessage] = useState(false);
  const [isDownloadingInfoMedia, setIsDownloadingInfoMedia] = useState(false);
  const [infoDownloadProgress, setInfoDownloadProgress] = useState(0);
  const [isInfoMediaBrowserVisible, setIsInfoMediaBrowserVisible] = useState(false);
  const [infoMediaBrowserFilter, setInfoMediaBrowserFilter] = useState<'ALL' | 'IMAGE' | 'VIDEO'>('ALL');
  const [infoEditNameVisible, setInfoEditNameVisible] = useState(false);
  const [infoEditNameValue, setInfoEditNameValue] = useState('');
  const [infoUpdatingGroupName, setInfoUpdatingGroupName] = useState(false);
  const [infoUpdatingGroupAvatar, setInfoUpdatingGroupAvatar] = useState(false);

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
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const loadingOlderRef = useRef(false);
  const shouldScrollToLatestRef = useRef(false);
  const generatingVideoThumbRef = useRef<Set<string>>(new Set());
  const infoMediaGalleryRef = useRef<FlatList>(null);
  const infoVideoThumbGeneratingRef = useRef<Set<string>>(new Set());
  const peerAvatarSource = useMemo(() => getAvatarSource(conversationAvatarUrl), [conversationAvatarUrl]);
  const normalizedName = String(conversationDisplayName ?? '').trim().toLowerCase();
  const normalizedType = String(type ?? '').trim().toUpperCase();
  const isAiConversation = normalizedType === 'AI' || normalizedName === 'fruvia chat ai' || normalizedName === 'fruvia ai';
  const isCloudConversation = normalizedType === 'CLOUD' || normalizedName === 'cloud của tôi';
  const isPrivateConversation = normalizedType === 'PRIVATE' || normalizedType === 'DIRECT';
  const isGroupConversation = normalizedType === 'GROUP';
  const showCallActions = !isCloudConversation && !isAiConversation;

  const canUseRealtimeIndicators = !isAiConversation && !isCloudConversation;
  const canUseMessageInteractions = isCloudConversation || isPrivateConversation || isGroupConversation;

  useEffect(() => {
    setConversationId(String(id ?? ''));
    setConversationDisplayName(String(name ?? ''));
    setConversationAvatarUrl(String(avatar ?? ''));
    setEditingMessageId(null);
    setInputText('');
    setIsPinnedListVisible(false);
    setIsMessageActionVisible(false);
    setSelectedMessage(null);
    setReplyingTo(null);
    setForwardingMsg(null);
  }, [avatar, id, name]);

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
      const timeA = parseMessageDate(a.createdAt)?.getTime() ?? Number.NaN;
      const timeB = parseMessageDate(b.createdAt)?.getTime() ?? Number.NaN;
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

  const isSameMessageList = useCallback((prev: Message[], next: Message[]) => {
    if (prev.length !== next.length) {
      return false;
    }

    for (let i = 0; i < prev.length; i += 1) {
      const prevMsg = prev[i];
      const nextMsg = next[i];

      if (String(prevMsg.messageId) !== String(nextMsg.messageId)) return false;
      if (prevMsg.content !== nextMsg.content) return false;
      if (prevMsg.createdAt !== nextMsg.createdAt) return false;
      if (prevMsg.updatedAt !== nextMsg.updatedAt) return false;
      if (prevMsg.isRecalled !== nextMsg.isRecalled) return false;
      if (prevMsg.isEdited !== nextMsg.isEdited) return false;
      if ((prevMsg.reactions?.length || 0) !== (nextMsg.reactions?.length || 0)) return false;
    }

    return true;
  }, []);

  const appendOrUpdateMessage = useCallback((message: ChatUiMessage) => {
    logChatDebug('appendOrUpdateMessage', message);
    setMessages((prev) => {
      const merged = mergeUniqueMessages(prev, [message]);
      return isSameMessageList(prev, merged) ? prev : merged;
    });
  }, [isSameMessageList, logChatDebug, mergeUniqueMessages]);

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
    const date = parseMessageDate(createdAt);
    if (!date) return '';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
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

  const generateVideoThumbnail = useCallback(async (videoUri: string): Promise<string | undefined> => {
    if (!videoUri) {
      return undefined;
    }

    try {
      const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 800,
        quality: 0.6,
      });
      return result.uri;
    } catch {
      return undefined;
    }
  }, []);

  const ensureVideoThumbnailForMessage = useCallback(async (messageId: string, videoUri?: string) => {
    const normalizedId = String(messageId || '');
    if (!normalizedId || !videoUri) {
      return;
    }

    if (generatingVideoThumbRef.current.has(normalizedId)) {
      return;
    }

    generatingVideoThumbRef.current.add(normalizedId);
    try {
      const thumbUri = await generateVideoThumbnail(videoUri);
      if (!thumbUri) {
        return;
      }

      setVideoThumbnailsByMessageId((prev) => {
        if (prev[normalizedId] === thumbUri) {
          return prev;
        }

        return {
          ...prev,
          [normalizedId]: thumbUri,
        };
      });
    } finally {
      generatingVideoThumbRef.current.delete(normalizedId);
    }
  }, [generateVideoThumbnail]);

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
          messageType: item.messageType ? String(item.messageType) : undefined,
          contentUrl: item.contentUrl
            ? String(item.contentUrl)
            : (item.mediaUrl ? String(item.mediaUrl) : undefined),
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

  const headerSubtitleText = isAiConversation
    ? (isSendingAi ? t('chat.typing', 'Đang nhập...') : t('chat.ai_subheading', 'Hỏi đáp với Fruvia AI'))
    : isCloudConversation
      ? t('chat.cloud_subheading', 'Truyền file giữa các thiết bị của bạn')
      : isConnected
        ? (isTyping ? t('chat.typing', 'Đang nhập...') : t('chat.active', 'Đang hoạt động'))
        : t('chat.offline_recent', 'Truy cập gần đây');

  const latestPinnedMessage = pinnedMessages.length > 0
    ? pinnedMessages[pinnedMessages.length - 1]
    : null;
  const latestPinnedType = (latestPinnedMessage?.messageType || '').toUpperCase();
  const latestPinnedIsImage = latestPinnedType === 'IMAGE';
  const latestPinnedThumbUrl = latestPinnedIsImage
    ? (latestPinnedMessage?.contentUrl || latestPinnedMessage?.content || '')
    : '';
  const latestPinnedLabel = latestPinnedMessage
    ? (() => {
      const text = (latestPinnedMessage.content || '').trim();
      if (latestPinnedIsImage) return '[Hình ảnh]';
      return text || t('chat.empty_message', 'Tin nhắn trống');
    })()
    : '';

  const getPinnedPreviewText = useCallback((item: PinnedMessageItem) => {
    const pinnedType = (item.messageType || '').toUpperCase();
    if (pinnedType === 'IMAGE') {
      return '[Hình ảnh]';
    }

    const text = (item.content || '').trim();
    return text || t('chat.empty_message', 'Tin nhắn trống');
  }, [t]);

  const getPinnedPreviewThumb = useCallback((item: PinnedMessageItem) => {
    const pinnedType = (item.messageType || '').toUpperCase();
    if (pinnedType !== 'IMAGE') return '';
    return item.contentUrl || item.content || '';
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

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
          const filtered = merged.filter((m) => {
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

          return isSameMessageList(prev, filtered) ? prev : filtered;
        });
      } else {
        setMessages((prev) => (isSameMessageList(prev, nextMessages) ? prev : nextMessages));
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
  }, [canUseRealtimeIndicators, conversationId, isSameMessageList, logChatDebug, mergeUniqueMessages, parsePageResult, sendReadReceipt, sortMessages]);

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
        setMessages((prev) => {
          const merged = mergeUniqueMessages(prev, sortedMessages);
          return isSameMessageList(prev, merged) ? prev : merged;
        });
      }

      setHasMoreOlder(hasMore && sortedMessages.length > 0);
    } catch (error) {
      console.error('Failed to load older messages:', error);
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [conversationId, hasMoreOlder, isLoadingOlder, isSameMessageList, logChatDebug, mergeUniqueMessages, messages, parsePageResult, sortMessages]);

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
      .catch(() => { })
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
      .catch(() => { })
      .finally(() => setScLoading(false));
  }, [isShareContactVisible]);

  useEffect(() => {
    if (shouldScrollToLatestRef.current && messages.length > 0) {
      shouldScrollToLatestRef.current = false;
      scrollToLatest(false);
    }
  }, [messages.length, scrollToLatest]);

  useEffect(() => {
    messages.forEach((message) => {
      const isVideoMessage = (message.messageType || '').toUpperCase() === 'VIDEO';
      if (!isVideoMessage || message.isRecalled) {
        return;
      }

      if (message.thumbnailUrl || videoThumbnailsByMessageId[String(message.messageId)]) {
        return;
      }

      if (!message.content) {
        return;
      }

      void ensureVideoThumbnailForMessage(String(message.messageId), message.content);
    });
  }, [ensureVideoThumbnailForMessage, messages, videoThumbnailsByMessageId]);

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
      createdAt: toLocalIsoString(now),
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
          const nowIso = toLocalIsoString(new Date());

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
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const oversized = result.assets.filter(a => (a.fileSize || 0) > 50 * 1024 * 1024);
      if (oversized.length) {
        Alert.alert('File quá lớn', `${oversized.length} ảnh vượt quá giới hạn 50MB và sẽ không được gửi.`);
      }
      const valid = result.assets.filter(a => (a.fileSize || 0) <= 50 * 1024 * 1024);
      if (!valid.length) return;
      const picked: PickedMedia[] = valid.map((asset) => ({
        uri: asset.uri,
        fileName: asset.fileName || `image_${Date.now()}.jpg`,
        fileSize: asset.fileSize || 0,
        mimeType: asset.mimeType || 'image/jpeg',
        mediaType: 'IMAGE' as const,
        width: asset.width,
        height: asset.height,
      }));
      setPendingMediaList(picked);
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
      if ((asset.fileSize || 0) > 50 * 1024 * 1024) {
        Alert.alert('File quá lớn', 'Video vượt quá giới hạn 50MB, vui lòng chọn video ngắn hơn.');
        return;
      }
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
      setPendingMediaList([picked]);
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
      createdAt: toLocalIsoString(new Date()),
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
      await soundRef.current.stopAsync().catch(() => { });
      await soundRef.current.unloadAsync().catch(() => { });
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
          sound.unloadAsync().catch(() => { });
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
        if ((asset.size || 0) > 50 * 1024 * 1024) {
          Alert.alert('File quá lớn', `File "${asset.name}" vượt quá giới hạn 50MB.`);
          return;
        }
        const picked: PickedMedia = {
          uri: asset.uri,
          fileName: asset.name || `file_${Date.now()}`,
          fileSize: asset.size || 0,
          mimeType: asset.mimeType || 'application/octet-stream',
          mediaType: chatFileService.resolveMediaType(asset.mimeType || ''),
        };
        setPendingMediaList([picked]);
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
      setPendingMediaList([picked]);
    }
  }, []);

  const handleCancelMedia = useCallback(() => {
    setPendingMediaList([]);
    setUploadProgress(0);
  }, []);

  const handleSendMedia = useCallback(async () => {
    if (pendingMediaList.length === 0 || !conversationId || isUploading) return;

    const mediaItems = [...pendingMediaList];
    const caption = inputText.trim();

    setPendingMediaList([]);
    setInputText('');
    setIsUploading(true);
    setUploadProgress(0);
    setUploadCurrentIndex(0);

    // Check if all items are images and there are multiple → send as IMAGE_GROUP
    const allImages = mediaItems.every((m) => m.mediaType === 'IMAGE');
    if (allImages && mediaItems.length > 1) {
      const tempMessageId = `temp-album-${Date.now()}`;
      const now = new Date();

      // Optimistic album message
      const optimisticMessage: Message = {
        messageId: tempMessageId,
        content: '',
        senderId: currentUserId ?? 'local-user',
        senderName: 'Me',
        createdAt: toLocalIsoString(now),
        messageType: 'IMAGE_GROUP',
        caption: caption || undefined,
        attachments: mediaItems.map((m) => ({ url: m.uri })),
      };

      setMessages((prev) => mergeUniqueMessages(prev, [optimisticMessage]));
      requestScrollToLatest(true);

      try {
        const s3Urls: string[] = [];
        for (let i = 0; i < mediaItems.length; i++) {
          setUploadCurrentIndex(i);
          const s3Url = await chatFileService.uploadMedia(mediaItems[i], (progress) => {
            const overallProgress = Math.round(((i * 100 + progress.percent) / mediaItems.length));
            setUploadProgress(overallProgress);
          });
          s3Urls.push(s3Url);
        }

        // Send single IMAGE_GROUP message
        const response = await chatService.sendMessage(conversationId, {
          content: s3Urls[0],
          messageType: 'IMAGE_GROUP',
          caption: caption || undefined,
          mediaUrls: s3Urls,
        });

        const mappedMessage = mapAnyPayloadToUiMessage(response);
        if (mappedMessage) {
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => m.messageId !== tempMessageId);
            return mergeUniqueMessages(withoutTemp, [mappedMessage]);
          });
        }
      } catch (error: any) {
        const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
        console.error('Failed to send album:', errorMsg);
        setMessages((prev) => prev.filter((m) => m.messageId !== tempMessageId));
        Alert.alert('Lỗi', `Không thể gửi album ảnh: ${errorMsg}`);
      }

      setIsUploading(false);
      setUploadProgress(0);
      setUploadCurrentIndex(0);
      requestScrollToLatest(true);
      return;
    }

    // Single image or non-image media: send individually
    for (let i = 0; i < mediaItems.length; i++) {
      const media = mediaItems[i];
      const tempMessageId = `temp-media-${Date.now()}-${i}`;
      const now = new Date();
      const videoThumbnail = media.mediaType === 'VIDEO'
        ? await generateVideoThumbnail(media.uri)
        : undefined;

      setUploadCurrentIndex(i);

      // Optimistic message
      const optimisticMessage: Message = {
        messageId: tempMessageId,
        content: media.uri,
        senderId: currentUserId ?? 'local-user',
        senderName: 'Me',
        createdAt: toLocalIsoString(now),
        messageType: media.mediaType,
        fileName: media.fileName,
        fileSize: media.fileSize,
        caption: i === 0 ? caption : undefined,
        thumbnailUrl: videoThumbnail,
      };

      setMessages((prev) => mergeUniqueMessages(prev, [optimisticMessage]));
      requestScrollToLatest(true);

      try {
        const s3Url = await chatFileService.uploadMedia(media, (progress) => {
          setUploadProgress(progress.percent);
        });

        setMessages((prev) =>
          prev.map((m) => m.messageId === tempMessageId ? { ...m, content: s3Url, thumbnailUrl: m.thumbnailUrl || videoThumbnail } : m)
        );

        const response = await chatService.sendMessage(conversationId, {
          content: s3Url,
          messageType: chatFileService.toBackendMessageType(media.mediaType),
          fileName: media.fileName,
          fileSize: media.fileSize,
          caption: i === 0 ? (caption || undefined) : undefined,
          videoDuration: media.duration,
        });

        const mappedMessage = mapAnyPayloadToUiMessage(response);
        if (mappedMessage) {
          const messageWithThumb: Message = {
            ...mappedMessage,
            thumbnailUrl: mappedMessage.messageType === 'VIDEO'
              ? (videoThumbnail || videoThumbnailsByMessageId[String(mappedMessage.messageId)])
              : undefined,
          };

          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => m.messageId !== tempMessageId);
            return mergeUniqueMessages(withoutTemp, [messageWithThumb]);
          });

          if (messageWithThumb.messageType === 'VIDEO' && !messageWithThumb.thumbnailUrl) {
            void ensureVideoThumbnailForMessage(String(messageWithThumb.messageId), messageWithThumb.content);
          }
        }
      } catch (error: any) {
        const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
        console.error('Failed to send media:', { index: i, errorMsg, error });
        setMessages((prev) => prev.filter((m) => m.messageId !== tempMessageId));
        Alert.alert('Lỗi', `Không thể gửi ảnh ${mediaItems.length > 1 ? `(${i + 1}/${mediaItems.length}) ` : ''}${errorMsg}`);
      }
    }

    setIsUploading(false);
    setUploadProgress(0);
    setUploadCurrentIndex(0);
    requestScrollToLatest(true);
  }, [pendingMediaList, conversationId, isUploading, inputText, currentUserId, mergeUniqueMessages, requestScrollToLatest, mapAnyPayloadToUiMessage, ensureVideoThumbnailForMessage, generateVideoThumbnail, videoThumbnailsByMessageId]);

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

  const highlightMessage = useCallback((messageId: string) => {
    setHighlightedMessageId(String(messageId));

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === String(messageId) ? null : prev));
    }, 1800);
  }, []);

  const handleJumpToPinnedMessage = useCallback(async (messageId: string) => {
    const normalizedMessageId = String(messageId || '').trim();
    if (!normalizedMessageId) {
      return;
    }

    setIsPinnedListVisible(false);

    const localTargetIndex = messages.findIndex((message) => String(message.messageId) === normalizedMessageId);
    if (localTargetIndex >= 0) {
      flatListRef.current?.scrollToIndex({ index: localTargetIndex, animated: true, viewPosition: 0.5 });
      highlightMessage(normalizedMessageId);
      return;
    }

    if (!conversationId) {
      return;
    }

    setIsJumpingToMessage(true);
    try {
      const fetchAroundCandidates = async () => {
        const aroundSizes = [40, 80, 120];

        for (const aroundSize of aroundSizes) {
          const aroundResponse = await chatService.getMessagesAround(conversationId, normalizedMessageId, aroundSize);
          const aroundRaw = chatService.unwrapApiPayload<any>(aroundResponse);
          const aroundPayload = Array.isArray(aroundRaw)
            ? aroundRaw
            : (Array.isArray(aroundRaw?.content) ? aroundRaw.content : []);

          const aroundMapped = sortMessages(mapChatPayloadListToUiMessages(aroundPayload));
          if (aroundMapped.some((message) => String(message.messageId) === normalizedMessageId)) {
            return aroundMapped;
          }
        }

        // Fallback: walk backward pages from latest in case around endpoint is delayed.
        const firstPageResponse = await chatService.getMessages(conversationId, 0, 40);
        const firstPageParsed = parsePageResult(firstPageResponse, 40);
        let fallbackMessages = sortMessages(mapChatPayloadListToUiMessages(firstPageParsed.payload));

        if (fallbackMessages.some((message) => String(message.messageId) === normalizedMessageId)) {
          return fallbackMessages;
        }

        let cursorId = fallbackMessages[0]?.messageId;
        for (let page = 0; page < 8 && cursorId; page += 1) {
          const olderResponse = await chatService.getMessagesBefore(conversationId, cursorId, 40);
          const olderParsed = parsePageResult(olderResponse, 40);
          const olderMessages = sortMessages(mapChatPayloadListToUiMessages(olderParsed.payload));

          if (olderMessages.length === 0) {
            break;
          }

          fallbackMessages = mergeUniqueMessages(fallbackMessages, olderMessages);
          if (fallbackMessages.some((message) => String(message.messageId) === normalizedMessageId)) {
            return fallbackMessages;
          }

          cursorId = fallbackMessages[0]?.messageId;
        }

        return [] as Message[];
      };

      const aroundMessages = await fetchAroundCandidates();
      if (aroundMessages.length === 0) {
        Alert.alert('Thông báo', 'Không tìm thấy đoạn hội thoại chứa tin nhắn này.');
        return;
      }

      const aroundTargetIndex = aroundMessages.findIndex((message) => String(message.messageId) === normalizedMessageId);
      setMessages(aroundMessages);
      setHasMoreOlder(true);

      if (aroundTargetIndex >= 0) {
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToIndex({ index: aroundTargetIndex, animated: true, viewPosition: 0.5 });
          highlightMessage(normalizedMessageId);
        });
      }
    } catch (error) {
      console.error('Failed to jump to historical message:', error);
      Alert.alert('Lỗi', 'Không thể tải đoạn hội thoại chứa tin nhắn này');
    } finally {
      setIsJumpingToMessage(false);
    }
  }, [conversationId, highlightMessage, mergeUniqueMessages, messages, parsePageResult, sortMessages]);

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

  const normalizeInfoMediaItems = useCallback((source: any[]) => {
    const items = Array.isArray(source) ? source : [];
    const normalized: any[] = [];

    items.forEach((item: any, index: number) => {
      const messageType = String(item?.messageType ?? '').toUpperCase();
      if (messageType === 'IMAGE' || messageType === 'VIDEO') {
        normalized.push(item);
        return;
      }

      if (messageType === 'IMAGE_GROUP' && Array.isArray(item?.attachments)) {
        const baseMessageId = String(item?.messageId ?? item?.id ?? `media-group-${index}`);
        item.attachments.forEach((attachment: any, attachmentIndex: number) => {
          const url = String(attachment?.url ?? '').trim();
          if (!url) {
            return;
          }

          normalized.push({
            ...item,
            id: `${baseMessageId}-attachment-${attachmentIndex}`,
            messageType: 'IMAGE',
            content: url,
            thumbnailUrl: attachment?.thumbnailUrl ?? item?.thumbnailUrl,
            parentMessageId: baseMessageId,
          });
        });
      }
    });

    return normalized;
  }, []);

  const fetchInfoMedia = useCallback(async () => {
    if (!conversationId || isAiConversation) return;
    try {
      const res = chatService.unwrapApiPayload<any[]>(
        await chatService.getConversationMedia(conversationId)
      );
      const items = Array.isArray(res) ? res : [];
      setInfoMediaItems(normalizeInfoMediaItems(items));
      setInfoFileItems(items.filter((m: any) => m.messageType === 'MEDIA'));
    } catch { setInfoMediaItems([]); setInfoFileItems([]); }
  }, [conversationId, isAiConversation, normalizeInfoMediaItems]);

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

  const getInfoMediaUrl = useCallback((item: any) => {
    return String(item?.content ?? item?.mediaUrl ?? item?.url ?? '').trim();
  }, []);

  const getInfoMediaId = useCallback((item: any, index?: number) => {
    const raw = item?.messageId ?? item?.id ?? `info-media-${index ?? 0}`;
    return String(raw);
  }, []);

  const getInfoMediaType = useCallback((item: any) => {
    return String(item?.messageType ?? '').toUpperCase();
  }, []);

  const requestMediaSavePermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const existing = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
      if (existing.granted) {
        return true;
      }

      const requested = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
      return requested.granted;
    }

    const existing = await MediaLibrary.getPermissionsAsync();
    if (existing.granted) {
      return true;
    }

    const requested = await MediaLibrary.requestPermissionsAsync();
    return requested.granted;
  }, []);

  const closeInfoMediaGallery = useCallback(() => {
    setIsInfoMediaGalleryVisible(false);
    setIsInfoGalleryMenuVisible(false);
    setInfoGalleryPlayingMediaId(null);
    setIsInfoGalleryVideoLoading(false);
    setInfoDownloadProgress(0);
  }, []);

  const handleOpenInfoMediaGallery = useCallback((startIndex: number) => {
    if (!Array.isArray(infoMediaItems) || infoMediaItems.length === 0) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(startIndex, infoMediaItems.length - 1));
    setInfoMediaGalleryStartIndex(safeIndex);
    setInfoMediaGalleryIndex(safeIndex);
    setInfoGalleryPlayingMediaId(null);
    setIsInfoGalleryVideoLoading(false);
    setIsInfoGalleryMenuVisible(false);
    setIsInfoMediaGalleryVisible(true);
  }, [infoMediaItems]);

  const handlePlayInfoGalleryVideo = useCallback((item: any, index: number) => {
    const mediaId = getInfoMediaId(item, index);
    setInfoGalleryPlayingMediaId(mediaId);
    setIsInfoGalleryVideoLoading(true);
  }, [getInfoMediaId]);

  const handleDownloadInfoGalleryCurrent = useCallback(async () => {
    const currentItem = infoMediaItems[infoMediaGalleryIndex];
    if (!currentItem) {
      return;
    }

    const mediaUrl = getInfoMediaUrl(currentItem);
    if (!mediaUrl) {
      Alert.alert('Lỗi', 'Không tìm thấy đường dẫn media');
      return;
    }

    try {
      setIsDownloadingInfoMedia(true);
      setInfoDownloadProgress(0);

      const hasPermission = await requestMediaSavePermission();
      if (!hasPermission) {
        Alert.alert('Quyền truy cập', 'Bạn cần cho phép quyền thư viện để lưu media');
        return;
      }

      const mediaType = getInfoMediaType(currentItem);
      let localUri = mediaUrl;

      if (/^https?:\/\//i.test(mediaUrl)) {
        const cleanUrl = mediaUrl.split('?')[0];
        const ext = cleanUrl.includes('.')
          ? `.${cleanUrl.split('.').pop()?.slice(0, 6) || ''}`
          : (mediaType === 'VIDEO' ? '.mp4' : '.jpg');
        const destinationFile = new File(Paths.cache, `fruvia_media_${Date.now()}${ext}`);
        const resumable = FileSystemLegacy.createDownloadResumable(
          mediaUrl,
          destinationFile.uri,
          {},
          (progressData) => {
            const total = progressData.totalBytesExpectedToWrite;
            if (typeof total === 'number' && total > 0) {
              const percent = Math.round((progressData.totalBytesWritten / total) * 100);
              setInfoDownloadProgress(Math.max(0, Math.min(100, percent)));
            }
          }
        );

        const downloaded = await resumable.downloadAsync();
        localUri = downloaded?.uri || destinationFile.uri;
      } else {
        setInfoDownloadProgress(100);
      }

      const asset = await MediaLibrary.createAssetAsync(localUri);
      const albumName = 'Fruvia';
      const album = await MediaLibrary.getAlbumAsync(albumName);

      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }

      Alert.alert('Thành công', 'Đã tải media về thiết bị');
    } catch (error: any) {
      Alert.alert('Lỗi', error?.message || 'Không thể tải media');
    } finally {
      setIsDownloadingInfoMedia(false);
      setTimeout(() => setInfoDownloadProgress(0), 200);
    }
  }, [getInfoMediaType, getInfoMediaUrl, infoMediaGalleryIndex, infoMediaItems, requestMediaSavePermission]);

  const openInfoMediaBrowser = useCallback(() => {
    setInfoMediaBrowserFilter('ALL');
    setIsInfoMediaBrowserVisible(true);
  }, []);

  const liveMediaSignature = useMemo(() => {
    return messages
      .filter((message) => {
        if (message.isRecalled) return false;
        const type = String(message.messageType || 'TEXT').toUpperCase();
        return type === 'IMAGE' || type === 'VIDEO' || type === 'IMAGE_GROUP';
      })
      .map((message) => {
        const attachmentCount = Array.isArray(message.attachments) ? message.attachments.length : 0;
        return `${message.messageId}:${message.updatedAt || message.createdAt}:${message.content}:${attachmentCount}`;
      })
      .join('|');
  }, [messages]);

  useEffect(() => {
    if (!isInfoPanelVisible && !isInfoMediaBrowserVisible) {
      return;
    }

    const liveItems = normalizeInfoMediaItems(messages);
    if (liveItems.length === 0) {
      return;
    }

    setInfoMediaItems((prev) => {
      const merged = new Map<string, any>();
      const buildKey = (item: any, idx: number) => String(item?.id ?? item?.messageId ?? `live-${idx}`);

      prev.forEach((item, idx) => {
        merged.set(buildKey(item, idx), item);
      });

      liveItems.forEach((item, idx) => {
        merged.set(buildKey(item, idx), {
          ...merged.get(buildKey(item, idx)),
          ...item,
        });
      });

      return Array.from(merged.values()).sort((a, b) => {
        const timeA = getMessageMillis(a?.createdAt);
        const timeB = getMessageMillis(b?.createdAt);
        return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
      });
    });
  }, [isInfoMediaBrowserVisible, isInfoPanelVisible, messages, normalizeInfoMediaItems]);

  useEffect(() => {
    if (!isInfoPanelVisible || !conversationId || isAiConversation) {
      return;
    }

    void fetchInfoMedia();
  }, [conversationId, fetchInfoMedia, isAiConversation, isInfoPanelVisible, liveMediaSignature]);

  const infoMediaBrowserItems = useMemo(() => {
    return infoMediaItems.filter((item: any) => {
      const mediaType = getInfoMediaType(item);
      if (infoMediaBrowserFilter === 'ALL') return true;
      if (infoMediaBrowserFilter === 'IMAGE') return mediaType === 'IMAGE';
      return mediaType === 'VIDEO';
    });
  }, [getInfoMediaType, infoMediaBrowserFilter, infoMediaItems]);

  const handleViewOriginalMessageFromGallery = useCallback(() => {
    const currentItem = infoMediaItems[infoMediaGalleryIndex];
    const targetMessageId = String(currentItem?.messageId ?? '').trim();

    closeInfoMediaGallery();
    setIsInfoPanelVisible(false);

    if (!targetMessageId) {
      return;
    }

    setTimeout(() => {
      void handleJumpToPinnedMessage(targetMessageId);
    }, 180);
  }, [closeInfoMediaGallery, handleJumpToPinnedMessage, infoMediaGalleryIndex, infoMediaItems]);

  const infoCurrentUserRole = infoMembers.find((m) => m.userId === currentUserId)?.role;
  const infoIsAdmin = infoCurrentUserRole === 'ADMIN';
  const infoIsDeputy = infoCurrentUserRole === 'DEPUTY';
  const infoCanAddMembers = infoIsAdmin || infoIsDeputy;

  const handleOpenInfoEditNameModal = useCallback(() => {
    setInfoEditNameValue(String(conversationDisplayName ?? '').trim());
    setInfoEditNameVisible(true);
  }, [conversationDisplayName]);

  const handleInfoUpdateGroupAvatar = useCallback(async (avatarUri: string) => {
    if (!conversationId || !isGroupConversation || infoUpdatingGroupAvatar) return;

    setInfoUpdatingGroupAvatar(true);
    try {
      let finalAvatarUrl = avatarUri.trim();

      if (finalAvatarUrl && !/^https?:\/\//i.test(finalAvatarUrl)) {
        const now = Date.now();
        const lowerUri = finalAvatarUrl.toLowerCase();
        const ext = lowerUri.includes('.png') ? 'png' : 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

        const picked: PickedMedia = {
          uri: finalAvatarUrl,
          fileName: `group_avatar_${now}.${ext}`,
          fileSize: 0,
          mimeType,
          mediaType: 'IMAGE',
        };

        finalAvatarUrl = await chatFileService.uploadMedia(picked);
      }

      const response = await chatService.updateGroupConversationInfo(conversationId, {
        conversationAvatarUrl: finalAvatarUrl || undefined,
      });

      const payload = chatService.unwrapApiPayload<any>(response) ?? {};
      const nextAvatar = String(payload.conversationAvatarUrl ?? payload.avatarUrl ?? finalAvatarUrl ?? '').trim();
      setConversationAvatarUrl(nextAvatar);
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện nhóm');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) {
        Alert.alert('Không có quyền', 'Bạn chưa có quyền đổi ảnh đại diện nhóm');
      } else {
        Alert.alert('Lỗi', err?.message || 'Không thể cập nhật ảnh đại diện nhóm');
      }
    } finally {
      setInfoUpdatingGroupAvatar(false);
    }
  }, [conversationId, infoUpdatingGroupAvatar, isGroupConversation]);

  const handlePickInfoGroupAvatar = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập thư viện ảnh');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      await handleInfoUpdateGroupAvatar(result.assets[0].uri);
    }
  }, [handleInfoUpdateGroupAvatar]);

  const handleTakeInfoGroupAvatar = useCallback(async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      await handleInfoUpdateGroupAvatar(result.assets[0].uri);
    }
  }, [handleInfoUpdateGroupAvatar]);

  const handleSelectInfoGroupAvatarSource = useCallback(() => {
    Alert.alert(
      'Ảnh đại diện nhóm',
      'Chọn cách cập nhật ảnh đại diện nhóm',
      [
        { text: 'Thư viện', onPress: () => { void handlePickInfoGroupAvatar(); } },
        { text: 'Chụp ảnh', onPress: () => { void handleTakeInfoGroupAvatar(); } },
        { text: 'Hủy', style: 'cancel' },
      ]
    );
  }, [handlePickInfoGroupAvatar, handleTakeInfoGroupAvatar]);

  const handleInfoUpdateGroupName = useCallback(async () => {
    if (!conversationId || !isGroupConversation || infoUpdatingGroupName) return;

    const trimmedName = infoEditNameValue.trim();
    if (!trimmedName) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nhóm');
      return;
    }

    setInfoUpdatingGroupName(true);
    try {
      const response = await chatService.updateGroupConversationInfo(conversationId, {
        conversationName: trimmedName,
      });

      const payload = chatService.unwrapApiPayload<any>(response) ?? {};
      const nextName = String(payload.conversationName ?? trimmedName).trim();
      setConversationDisplayName(nextName || trimmedName);
      setInfoEditNameVisible(false);
      Alert.alert('Thành công', 'Đã cập nhật tên nhóm');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) {
        Alert.alert('Không có quyền', 'Bạn chưa có quyền đổi tên nhóm');
      } else {
        Alert.alert('Lỗi', err?.message || 'Không thể cập nhật tên nhóm');
      }
    } finally {
      setInfoUpdatingGroupName(false);
    }
  }, [
    conversationId,
    infoEditNameValue,
    infoUpdatingGroupName,
    isGroupConversation,
  ]);

  const fetchInfoFriendsForAdd = useCallback(async () => {
    try {
      const res = chatService.unwrapApiPayload<any[]>(await friendService.getFriendsList());
      const list = Array.isArray(res) ? res : [];
      const existingIds = infoMembers.map((m) => m.userId);
      setInfoFriendsList(list.filter((f: any) => !existingIds.includes(f.user_id || f.id)));
    } catch { setInfoFriendsList([]); }
  }, [infoMembers]);

  const filteredInfoFriendsList = useMemo(() => {
    const keyword = infoAddMemberSearch.trim().toLowerCase();

    if (!keyword) {
      return infoFriendsList;
    }

    return infoFriendsList.filter((friend: any) => {
      const displayName = String(friend.display_name ?? friend.full_name ?? friend.name ?? '').toLowerCase();
      const email = String(friend.email ?? '').toLowerCase();
      const phone = String(friend.phone ?? '').toLowerCase();

      return displayName.includes(keyword) || email.includes(keyword) || phone.includes(keyword);
    });
  }, [infoAddMemberSearch, infoFriendsList]);

  const infoAddMemberListData = useMemo(() => {
    const output: Array<{ type: 'header'; id: string; letter: string } | { type: 'friend'; id: string; friend: any }> = [];
    let currentLetter = '';

    filteredInfoFriendsList.forEach((friend: any) => {
      const displayName = String(friend.display_name ?? friend.full_name ?? friend.name ?? 'Unknown').trim();
      const letter = displayName.charAt(0).toUpperCase() || '#';

      if (letter !== currentLetter) {
        currentLetter = letter;
        output.push({ type: 'header', id: `header-${letter}`, letter });
      }

      output.push({ type: 'friend', id: `friend-${friend.user_id ?? friend.id}`, friend });
    });

    return output;
  }, [filteredInfoFriendsList]);

  const handleOpenInfoAddMemberModal = useCallback(async () => {
    setInfoAddMemberVisible(true);
    setInfoAddMemberSearch('');
    setInfoSelectedMembers([]);
    await fetchInfoFriendsForAdd();
  }, [fetchInfoFriendsForAdd]);

  const handleCloseInfoAddMemberModal = useCallback(() => {
    setInfoAddMemberVisible(false);
    setInfoAddMemberSearch('');
    setInfoSelectedMembers([]);
  }, []);

  const handleInfoAddMembers = useCallback(async () => {
    if (infoSelectedMembers.length === 0 || infoAddingMembers || !conversationId) return;
    setInfoAddingMembers(true);
    try {
      await chatService.addConversationMembers(conversationId, infoSelectedMembers);
      handleCloseInfoAddMemberModal();
      await fetchInfoMembers();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể thêm thành viên');
    } finally { setInfoAddingMembers(false); }
  }, [conversationId, fetchInfoMembers, handleCloseInfoAddMemberModal, infoAddingMembers, infoSelectedMembers]);

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

  useEffect(() => {
    infoMediaItems.forEach((item, index) => {
      const mediaType = getInfoMediaType(item);
      if (mediaType !== 'VIDEO') {
        return;
      }

      const mediaId = getInfoMediaId(item, index);
      if (infoVideoThumbnailsByMediaId[mediaId]) {
        return;
      }

      const mediaUrl = getInfoMediaUrl(item);
      if (!mediaUrl || mediaUrl.startsWith('data:')) {
        return;
      }

      if (infoVideoThumbGeneratingRef.current.has(mediaId)) {
        return;
      }

      infoVideoThumbGeneratingRef.current.add(mediaId);
      void generateVideoThumbnail(mediaUrl)
        .then((thumbUri) => {
          if (!thumbUri) {
            return;
          }

          setInfoVideoThumbnailsByMediaId((prev) => {
            if (prev[mediaId] === thumbUri) {
              return prev;
            }

            return {
              ...prev,
              [mediaId]: thumbUri,
            };
          });
        })
        .finally(() => {
          infoVideoThumbGeneratingRef.current.delete(mediaId);
        });
    });
  }, [generateVideoThumbnail, getInfoMediaId, getInfoMediaType, getInfoMediaUrl, infoMediaItems, infoVideoThumbnailsByMediaId]);

  useEffect(() => {
    if (!isInfoMediaGalleryVisible || infoMediaItems.length === 0) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(infoMediaGalleryStartIndex, infoMediaItems.length - 1));
    setInfoMediaGalleryIndex(safeIndex);

    requestAnimationFrame(() => {
      infoMediaGalleryRef.current?.scrollToIndex({
        index: safeIndex,
        animated: false,
      });
    });
  }, [infoMediaGalleryStartIndex, infoMediaItems.length, isInfoMediaGalleryVisible]);

  const renderOlderMessagesLoading = () => {
    if (!hasMoreOlder) {
      return null;
    }

    return (
      <View style={styles.olderLoadingContainer}>
        {isLoadingOlder ? (
          <>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={[styles.olderLoadingText, { color: colors.textSecondary }]}>Đang tải tin cũ...</Text>
          </>
        ) : (
          <View style={styles.olderLoadingPlaceholder} />
        )}
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

  const formatDateSeparator = useCallback((createdAt?: string) => {
    const date = parseMessageDate(createdAt);
    if (!date) return null;

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dd = String(date.getDate()).padStart(2, '0');
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();

    if (isToday) return `${time} Hôm nay`;
    if (isYesterday) return `${time} Hôm qua`;
    return `${time} ${dd}/${mo}/${yyyy}`;
  }, []);

  const shouldShowDateSeparator = (current: Message, prev?: Message) => {
    if (!prev) return true;
    const currentDate = parseMessageDate(current.createdAt);
    const prevDate = parseMessageDate(prev.createdAt);
    if (!currentDate || !prevDate) return false;
    return currentDate.toDateString() !== prevDate.toDateString()
      || (currentDate.getTime() - prevDate.getTime() > 15 * 60 * 1000);
  };

  const SystemMessageBubble = React.memo(({ content }: { content: string }) => {
    return (
      <View style={styles.systemMessageRow}>
        <View style={styles.systemMessageBubble}>
          <Text style={styles.systemMessageText}>{content}</Text>
        </View>
      </View>
    );
  });

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    if ((item.messageType || '').toUpperCase() === 'SYSTEM') {
      return <SystemMessageBubble content={item.content || ''} />;
    }

    const isCurrentUserMessage = currentUserId !== null && String(item.senderId) === String(currentUserId);
    const prevMessage = index > 0 ? messages[index - 1] : undefined;
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : undefined;
    const showAvatar = !isCurrentUserMessage && isFirstInMessageBlock(item, prevMessage);
    const showSenderName = isGroupConversation && showAvatar;
    const senderDisplayName = (item.senderName || '').trim() || t('chat.unknown_user', 'Người dùng');
    const senderAvatarSource = showAvatar
      ? getAvatarSource(item.senderAvatarUrl || (isGroupConversation ? undefined : conversationAvatarUrl))
      : null;
    const showTimestamp = shouldShowMessageTimestamp(item, nextMessage);
    const timeLabel = formatMessageTime(item.createdAt);
    const displayContent = getDisplayMessageContent(item);
    const reactionSummary = buildReactionSummary(item.reactions);
    const showDateSep = shouldShowDateSeparator(item, prevMessage);
    const dateSepLabel = showDateSep ? formatDateSeparator(item.createdAt) : null;

    const msgType = (item.messageType || 'TEXT').toUpperCase();
    const isImageMsg = msgType === 'IMAGE';
    const isImageGroupMsg = msgType === 'IMAGE_GROUP';
    const isVideoMsg = msgType === 'VIDEO';
    const isVoiceMsg = msgType === 'VOICE';
    const isFileMsg = msgType === 'FILE' || msgType === 'MEDIA';
    const isMediaMsg = isImageMsg || isImageGroupMsg || isVideoMsg || isFileMsg || isVoiceMsg;

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
      const handleMediaLongPress = () => openMessageActionMenu(item);

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
            try { flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }); } catch { }
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
              onLongPress={handleMediaLongPress}
              delayLongPress={220}
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

      if (isImageGroupMsg && item.attachments && item.attachments.length > 0) {
        const imgs = item.attachments;
        const count = imgs.length;
        const gridWidth = 280;
        const gap = 2;
        const halfWidth = (gridWidth - gap) / 2;

        const renderGrid = () => {
          if (count === 1) {
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setFullscreenImageUrl(imgs[0].url)}
                onLongPress={handleMediaLongPress}
                delayLongPress={220}
              >
                <Image source={{ uri: imgs[0].url }} style={{ width: gridWidth, height: gridWidth * 0.75, borderRadius: 8 }} resizeMode="cover" />
              </TouchableOpacity>
            );
          }
          if (count === 2) {
            return (
              <View style={{ flexDirection: 'row', gap, width: gridWidth, borderRadius: 8, overflow: 'hidden' }}>
                {imgs.map((att, i) => (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.85}
                    onPress={() => setFullscreenImageUrl(att.url)}
                    onLongPress={handleMediaLongPress}
                    delayLongPress={220}
                  >
                    <Image source={{ uri: att.url }} style={{ width: halfWidth, height: halfWidth }} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            );
          }
          if (count === 3) {
            return (
              <View style={{ flexDirection: 'row', gap, width: gridWidth, borderRadius: 8, overflow: 'hidden' }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setFullscreenImageUrl(imgs[0].url)}
                  onLongPress={handleMediaLongPress}
                  delayLongPress={220}
                >
                  <Image source={{ uri: imgs[0].url }} style={{ width: halfWidth, height: halfWidth * 2 + gap }} resizeMode="cover" />
                </TouchableOpacity>
                <View style={{ gap }}>
                  {imgs.slice(1).map((att, i) => (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.85}
                      onPress={() => setFullscreenImageUrl(att.url)}
                      onLongPress={handleMediaLongPress}
                      delayLongPress={220}
                    >
                      <Image source={{ uri: att.url }} style={{ width: halfWidth, height: halfWidth }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          }
          // 4+ images: dynamic rows (Zalo-style, shows ALL images)
          const numRows = Math.ceil(count / 3);
          const rows: typeof imgs[number][][] = [];
          let startIdx = 0;
          let rem = count;
          for (let r = 0; r < numRows; r++) {
            const rowsLeft = numRows - r;
            const perRow = Math.floor(rem / rowsLeft);
            rows.push(imgs.slice(startIdx, startIdx + perRow));
            startIdx += perRow;
            rem -= perRow;
          }
          return (
            <View style={{ borderRadius: 8, overflow: 'hidden', width: gridWidth }}>
              {rows.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', gap, marginTop: ri > 0 ? gap : 0 }}>
                  {row.map((att, ci) => {
                    const itemWidth = (gridWidth - gap * (row.length - 1)) / row.length;
                    return (
                      <TouchableOpacity
                        key={ci}
                        activeOpacity={0.85}
                        onPress={() => setFullscreenImageUrl(att.url)}
                        onLongPress={handleMediaLongPress}
                        delayLongPress={220}
                      >
                        <Image source={{ uri: att.url }} style={{ width: itemWidth, height: itemWidth }} resizeMode="cover" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        };

        return (
          <>
            {replyBlock}
            {forwardedBanner}
            {renderGrid()}
            {item.caption ? (
              <Text style={[styles.messageText, isCurrentUserMessage ? styles.userMessageText : { color: colors.text }, { marginTop: 6 }]}>
                {item.caption}
              </Text>
            ) : null}
          </>
        );
      }

      if (isVideoMsg) {
        const isLocalUri = item.content.startsWith('file://') || item.content.startsWith('content://');
        const thumbUri = item.thumbnailUrl || videoThumbnailsByMessageId[String(item.messageId)];
        const showUploadOverlay = isLocalUri && isUploading;
        return (
          <>
            {replyBlock}
            {forwardedBanner}
            <TouchableOpacity
              onPress={() => {
                if (item.content && !isLocalUri) {
                  setFullscreenVideoUrl(item.content);
                }
              }}
              onLongPress={handleMediaLongPress}
              delayLongPress={220}
            >
              <View style={styles.videoContainer}>
                {thumbUri ? (
                  <Image source={{ uri: thumbUri }} style={styles.videoThumbnailImage} resizeMode="cover" />
                ) : null}
                <View style={styles.videoPlayOverlay}>
                  <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                </View>
                {showUploadOverlay ? (
                  <View style={styles.mediaUploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.mediaUploadingText}>{`${uploadProgress}%`}</Text>
                  </View>
                ) : null}
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
              onLongPress={handleMediaLongPress}
              delayLongPress={220}
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
                  Linking.openURL(fileUrl).catch(() => { });
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
        try { contact = JSON.parse(item.content || '{}'); } catch { }
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
      <View
        style={[
          styles.messageContainer,
          { marginBottom: showTimestamp ? 10 : 4 },
          highlightedMessageId === String(item.messageId) && styles.messageContainerHighlighted,
        ]}
      >
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
              {showAvatar && senderAvatarSource ? <Image source={senderAvatarSource} style={styles.peerAvatar} /> : null}
            </View>
            <View style={styles.otherContentBlock}>
              {showSenderName ? (
                <Text style={[styles.groupSenderName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {senderDisplayName}
                </Text>
              ) : null}
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
              {conversationDisplayName}
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
            <TouchableOpacity style={styles.headerIcon} onPress={() => { void openInfoPanel(); }}>
              <Ionicons name="list-outline" size={30} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {latestPinnedMessage ? (
          <View style={styles.pinnedBannerWrap}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.pinnedBanner}
              onPress={() => handleJumpToPinnedMessage(latestPinnedMessage.messageId)}
            >
              <View style={styles.pinnedBannerMain}>
                <Text style={styles.pinnedBannerText} numberOfLines={1}>
                  {latestPinnedLabel}
                </Text>
                {latestPinnedIsImage && latestPinnedThumbUrl ? (
                  <Image source={{ uri: latestPinnedThumbUrl }} style={styles.pinnedBannerThumb} resizeMode="cover" />
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.pinnedBannerAction}
                onPress={() => setIsPinnedListVisible(true)}
              >
                <Ionicons name="chevron-down" size={16} color="#DCE3EE" />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        ) : null}

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
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
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
          {pendingMediaList.length > 0 ? (
            pendingMediaList.length === 1 && pendingMediaList[0].mediaType !== 'IMAGE' ? (
              // Single non-image (video / file)
              <View style={styles.mediaPreviewBanner}>
                {pendingMediaList[0].mediaType !== 'FILE' ? (
                  <Image source={{ uri: pendingMediaList[0].uri }} style={styles.mediaPreviewThumb} resizeMode="cover" />
                ) : (
                  <View style={styles.mediaPreviewFileIcon}>
                    <Ionicons name="document-outline" size={28} color="#5B7FFF" />
                  </View>
                )}
                <View style={styles.mediaPreviewInfo}>
                  <Text style={styles.mediaPreviewName} numberOfLines={1}>
                    {pendingMediaList[0].fileName}
                  </Text>
                  <Text style={styles.mediaPreviewSize}>
                    {chatFileService.formatFileSize(pendingMediaList[0].fileSize)} • {pendingMediaList[0].mediaType}
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
            ) : (
              // Multi-image preview grid
              <View style={styles.multiImagePreviewContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.multiImageScroll} contentContainerStyle={styles.multiImageScrollContent}>
                  {pendingMediaList.map((media, index) => (
                    <View key={`preview-${index}`} style={styles.multiImageThumbWrap}>
                      <Image source={{ uri: media.uri }} style={styles.multiImageThumb} resizeMode="cover" />
                      {isUploading && index === uploadCurrentIndex ? (
                        <View style={styles.multiImageUploadOverlay}>
                          <Text style={styles.multiImageUploadPct}>{uploadProgress}%</Text>
                        </View>
                      ) : isUploading && index < uploadCurrentIndex ? (
                        <View style={styles.multiImageDoneOverlay}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      ) : null}
                      {!isUploading ? (
                        <TouchableOpacity
                          style={styles.multiImageRemoveBtn}
                          onPress={() => setPendingMediaList((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <Ionicons name="close-circle" size={18} color="#F04343" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.multiImageFooter}>
                  <Text style={styles.multiImageCount}>
                    {isUploading
                      ? `Đang gửi ${uploadCurrentIndex + 1}/${pendingMediaList.length}...`
                      : `${pendingMediaList.length} ảnh đã chọn`}
                  </Text>
                  {!isUploading ? (
                    <TouchableOpacity onPress={handleCancelMedia}>
                      <Text style={styles.multiImageCancelText}>Hủy tất cả</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {isUploading ? (
                  <View style={styles.uploadProgressBar}>
                    <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                ) : null}
              </View>
            )
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
                  placeholder={pendingMediaList.length > 0 ? t('chat.add_caption', 'Thêm mô tả...') : t('chat.send_message', 'Tin nhắn')}
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
                {pendingMediaList.length > 0 ? (
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
                      <View style={styles.pinnedContentRow}>
                        <Text style={[styles.pinnedContent, { color: colors.textSecondary }]} numberOfLines={2}>
                          {getPinnedPreviewText(item)}
                        </Text>
                        {getPinnedPreviewThumb(item) ? (
                          <Image source={{ uri: getPinnedPreviewThumb(item) }} style={styles.pinnedItemThumb} resizeMode="cover" />
                        ) : null}
                      </View>
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
                        .catch(() => { })
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
                      .catch(() => { })
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
                      }).catch(() => { })
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
                        .catch(() => { }).finally(() => setScLoading(false));
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
                      .catch(() => { })
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
                <View style={styles.infoPanelAvatarWrap}>
                  {isAiConversation ? (
                    <View style={styles.infoPanelAiAvatar}>
                      <Ionicons name="sparkles" size={34} color="#FFFFFF" />
                    </View>
                  ) : isCloudConversation ? (
                    <View style={[styles.infoPanelCloudAvatar]}>
                      <Ionicons name="cloud" size={36} color="#FFFFFF" />
                    </View>
                  ) : conversationAvatarUrl ? (
                    <Image source={peerAvatarSource} style={styles.infoPanelAvatarImg} />
                  ) : (
                    <View style={styles.infoPanelDefaultAvatar}>
                      <Text style={styles.infoPanelDefaultAvatarText}>{(String(conversationDisplayName ?? '?')).charAt(0).toUpperCase()}</Text>
                    </View>
                  )}

                  {isGroupConversation && (
                    <TouchableOpacity
                      style={styles.infoPanelAvatarCameraBadge}
                      onPress={handleSelectInfoGroupAvatarSource}
                      disabled={infoUpdatingGroupAvatar}
                    >
                      <Ionicons name="camera" size={16} color={colors.text} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.infoPanelNameRow}>
                  <Text style={[styles.infoPanelName, { color: colors.text }]} numberOfLines={2}>{conversationDisplayName}</Text>
                  {isGroupConversation && (
                    <TouchableOpacity style={styles.infoPanelNameEditBtn} onPress={handleOpenInfoEditNameModal}>
                      <Ionicons name="create-outline" size={16} color={colors.text} />
                    </TouchableOpacity>
                  )}
                </View>

                {isGroupConversation && infoMembers.length > 0 && (
                  <Text style={[styles.infoPanelSubName, { color: colors.textSecondary }]}>{infoMembers.length} thành viên</Text>
                )}

                {isGroupConversation && (
                  <View style={styles.infoPanelQuickActions}>
                    <TouchableOpacity
                      style={styles.infoPanelQuickAction}
                      onPress={() => Alert.alert('Tìm tin nhắn', 'Chức năng đang phát triển')}
                    >
                      <View style={[styles.infoPanelQuickActionIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="search" size={22} color={colors.text} />
                      </View>
                      <Text style={[styles.infoPanelQuickActionLabel, { color: colors.text }]}>Tìm
                        {'\n'}tin nhắn</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.infoPanelQuickAction}
                      onPress={() => { void handleOpenInfoAddMemberModal(); }}
                    >
                      <View style={[styles.infoPanelQuickActionIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="person-add-outline" size={22} color={colors.text} />
                      </View>
                      <Text style={[styles.infoPanelQuickActionLabel, { color: colors.text }]}>Thêm
                        {'\n'}thành viên</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.infoPanelQuickAction}
                      onPress={() => Alert.alert('Đổi hình nền', 'Chức năng đang phát triển')}
                    >
                      <View style={[styles.infoPanelQuickActionIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="color-wand-outline" size={22} color={colors.text} />
                      </View>
                      <Text style={[styles.infoPanelQuickActionLabel, { color: colors.text }]}>Đổi hình
                        {'\n'}nền</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.infoPanelQuickAction}
                      onPress={() => Alert.alert('Tắt thông báo', 'Chức năng đang phát triển')}
                    >
                      <View style={[styles.infoPanelQuickActionIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="notifications-off-outline" size={22} color={colors.text} />
                      </View>
                      <Text style={[styles.infoPanelQuickActionLabel, { color: colors.text }]}>Tắt
                        {'\n'}thông báo</Text>
                    </TouchableOpacity>
                  </View>
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
                      <>
                        <View style={styles.infoPanelMediaGridHeader}>
                          <Text style={[styles.infoPanelMediaGridHint, { color: colors.textSecondary }]}>Tổng {infoMediaItems.length} ảnh/video</Text>
                          <TouchableOpacity onPress={openInfoMediaBrowser}>
                            <Text style={styles.infoPanelMediaViewAll}>Xem tất cả</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.infoPanelMediaGrid}>
                          {infoMediaItems.slice(0, 9).map((m: any, i: number) => (
                          <TouchableOpacity
                            key={m.id || i}
                            style={styles.infoPanelMediaThumb}
                            onPress={() => handleOpenInfoMediaGallery(i)}
                          >
                            {m.messageType === 'IMAGE' ? (
                              <Image source={{ uri: m.content }} style={styles.infoPanelMediaThumbImg} resizeMode="cover" />
                            ) : (
                              <View style={[styles.infoPanelMediaThumbImg, { backgroundColor: '#101010', justifyContent: 'center', alignItems: 'center' }]}>
                                {(() => {
                                  const mediaId = getInfoMediaId(m, i);
                                  const thumbUri = String(m?.thumbnailUrl ?? infoVideoThumbnailsByMediaId[mediaId] ?? '').trim();

                                  if (!thumbUri) {
                                    return null;
                                  }

                                  return <Image source={{ uri: thumbUri }} style={styles.infoPanelMediaThumbImg} resizeMode="cover" />;
                                })()}
                                <View style={styles.infoPanelMediaPlayOverlay}>
                                  <Text style={styles.infoPanelMediaPlayText}>Play</Text>
                                </View>
                              </View>
                            )}
                          </TouchableOpacity>
                          ))}
                        </View>
                      </>
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

          {/* Media gallery inside info panel */}
          <Modal
            visible={isInfoMediaGalleryVisible}
            transparent
            animationType="fade"
            onRequestClose={closeInfoMediaGallery}
          >
            <View style={styles.infoMediaGalleryBackdrop}>
              <View style={styles.infoMediaGalleryTopBar}>
                <TouchableOpacity onPress={closeInfoMediaGallery}>
                  <Text style={styles.infoMediaGalleryCloseText}>X</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsInfoGalleryMenuVisible(true)}>
                  <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <FlatList
                ref={infoMediaGalleryRef}
                key={`info-gallery-${infoMediaGalleryStartIndex}-${infoMediaItems.length}`}
                data={infoMediaItems}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={Math.max(0, Math.min(infoMediaGalleryStartIndex, Math.max(infoMediaItems.length - 1, 0)))}
                keyExtractor={(item: any, index) => String(item?.id ?? `${item?.messageId ?? 'media'}-${item?.content ?? ''}-${index}`)}
                getItemLayout={(_, index) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * index,
                  index,
                })}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  if (!Number.isNaN(nextIndex)) {
                    setInfoMediaGalleryIndex(Math.max(0, Math.min(nextIndex, infoMediaItems.length - 1)));
                    setInfoGalleryPlayingMediaId(null);
                    setIsInfoGalleryVideoLoading(false);
                    setIsInfoGalleryMenuVisible(false);
                  }
                }}
                onScrollToIndexFailed={(info) => {
                  infoMediaGalleryRef.current?.scrollToOffset({
                    offset: info.averageItemLength * info.index,
                    animated: false,
                  });
                }}
                renderItem={({ item, index }) => {
                  const mediaType = getInfoMediaType(item);
                  const mediaUrl = getInfoMediaUrl(item);
                  const mediaId = getInfoMediaId(item, index);
                  const isVideo = mediaType === 'VIDEO';
                  const isPlayingVideo = infoGalleryPlayingMediaId === mediaId;
                  const fallbackThumb = String(item?.thumbnailUrl ?? infoVideoThumbnailsByMediaId[mediaId] ?? '').trim();

                  return (
                    <View style={styles.infoMediaGalleryItem}>
                      {isVideo ? (
                        isPlayingVideo ? (
                          <View style={styles.infoMediaGalleryVideoWrap}>
                            <Video
                              source={{ uri: mediaUrl }}
                              style={styles.infoMediaGalleryVideo}
                              useNativeControls
                              shouldPlay
                              resizeMode={ResizeMode.CONTAIN}
                              onLoadStart={() => setIsInfoGalleryVideoLoading(true)}
                              onReadyForDisplay={() => setIsInfoGalleryVideoLoading(false)}
                              onError={() => setIsInfoGalleryVideoLoading(false)}
                            />
                            {isInfoGalleryVideoLoading ? (
                              <View style={styles.infoMediaGalleryVideoLoadingOverlay}>
                                <ActivityIndicator size="large" color="#FFFFFF" />
                              </View>
                            ) : null}
                          </View>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.infoMediaGalleryVideoPosterWrap}
                            onPress={() => handlePlayInfoGalleryVideo(item, index)}
                          >
                            {fallbackThumb ? (
                              <Image source={{ uri: fallbackThumb }} style={styles.infoMediaGalleryImage} resizeMode="contain" />
                            ) : (
                              <View style={styles.infoMediaGalleryVideoPlaceholder} />
                            )}
                            <View style={styles.infoMediaGalleryVideoPlayButton}>
                              <Ionicons name="play" size={28} color="#FFFFFF" />
                            </View>
                          </TouchableOpacity>
                        )
                      ) : (
                        <Image source={{ uri: mediaUrl }} style={styles.infoMediaGalleryImage} resizeMode="contain" />
                      )}
                    </View>
                  );
                }}
              />

              <Modal
                visible={isInfoGalleryMenuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsInfoGalleryMenuVisible(false)}
              >
                <Pressable style={styles.infoMediaActionSheetBackdrop} onPress={() => setIsInfoGalleryMenuVisible(false)}>
                  <Pressable style={styles.infoMediaActionSheet} onPress={(e) => e.stopPropagation()}>
                    <TouchableOpacity
                      style={styles.infoMediaActionSheetItem}
                      onPress={() => {
                        setIsInfoGalleryMenuVisible(false);
                        void handleDownloadInfoGalleryCurrent();
                      }}
                    >
                      <Text style={styles.infoMediaActionSheetItemText}>Tải về</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.infoMediaActionSheetItem}
                      onPress={() => {
                        setIsInfoGalleryMenuVisible(false);
                        handleViewOriginalMessageFromGallery();
                      }}
                    >
                      <Text style={styles.infoMediaActionSheetItemText}>Xem tin nhắn gốc</Text>
                    </TouchableOpacity>
                  </Pressable>
                </Pressable>
              </Modal>
            </View>
          </Modal>
        </Modal>

        <Modal visible={isJumpingToMessage || isDownloadingInfoMedia} transparent animationType="fade">
          <View style={styles.globalBusyOverlay}>
            <View style={styles.globalBusyCard}>
              {isDownloadingInfoMedia ? (
                <>
                  <View style={styles.globalProgressTrack}>
                    <View style={[styles.globalProgressFill, { width: `${Math.max(0, Math.min(100, infoDownloadProgress))}%` }]} />
                  </View>
                  <Text style={styles.globalBusyPercent}>{`${Math.max(0, Math.min(100, infoDownloadProgress))}%`}</Text>
                </>
              ) : (
                <ActivityIndicator size="large" color="#FFFFFF" />
              )}
              <Text style={styles.globalBusyText}>
                {isDownloadingInfoMedia ? 'Đang tải media...' : 'Đang tải đoạn hội thoại...'}
              </Text>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isInfoMediaBrowserVisible}
          animationType="slide"
          onRequestClose={() => setIsInfoMediaBrowserVisible(false)}
        >
          <SafeAreaView style={styles.infoMediaBrowserContainer}>
            <View style={styles.infoMediaBrowserHeader}>
              <TouchableOpacity onPress={() => setIsInfoMediaBrowserVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.infoMediaBrowserTitle}>Ảnh, video</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.infoMediaBrowserFilterRow}>
              <TouchableOpacity
                style={[styles.infoMediaBrowserFilterBtn, infoMediaBrowserFilter === 'ALL' && styles.infoMediaBrowserFilterBtnActive]}
                onPress={() => setInfoMediaBrowserFilter('ALL')}
              >
                <Text style={[styles.infoMediaBrowserFilterText, infoMediaBrowserFilter === 'ALL' && styles.infoMediaBrowserFilterTextActive]}>Tất cả</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.infoMediaBrowserFilterBtn, infoMediaBrowserFilter === 'IMAGE' && styles.infoMediaBrowserFilterBtnActive]}
                onPress={() => setInfoMediaBrowserFilter('IMAGE')}
              >
                <Text style={[styles.infoMediaBrowserFilterText, infoMediaBrowserFilter === 'IMAGE' && styles.infoMediaBrowserFilterTextActive]}>Ảnh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.infoMediaBrowserFilterBtn, infoMediaBrowserFilter === 'VIDEO' && styles.infoMediaBrowserFilterBtnActive]}
                onPress={() => setInfoMediaBrowserFilter('VIDEO')}
              >
                <Text style={[styles.infoMediaBrowserFilterText, infoMediaBrowserFilter === 'VIDEO' && styles.infoMediaBrowserFilterTextActive]}>Video</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={infoMediaBrowserItems}
              keyExtractor={(item: any, index) => String(item?.id ?? `${item?.messageId ?? 'media'}-${item?.content ?? ''}-${index}`)}
              numColumns={3}
              contentContainerStyle={styles.infoMediaBrowserGrid}
              columnWrapperStyle={styles.infoMediaBrowserRow}
              renderItem={({ item, index }) => {
                const mediaType = getInfoMediaType(item);
                const mediaId = getInfoMediaId(item, index);
                const thumbUri = String(item?.thumbnailUrl ?? infoVideoThumbnailsByMediaId[mediaId] ?? '').trim();
                return (
                  <TouchableOpacity
                    style={styles.infoMediaBrowserThumb}
                    onPress={() => {
                      setIsInfoMediaBrowserVisible(false);
                      const originalIndex = infoMediaItems.findIndex((m) => String(getInfoMediaId(m)) === String(getInfoMediaId(item, index)));
                      handleOpenInfoMediaGallery(originalIndex >= 0 ? originalIndex : 0);
                    }}
                  >
                    {mediaType === 'IMAGE' ? (
                      <Image source={{ uri: getInfoMediaUrl(item) }} style={styles.infoMediaBrowserThumbImage} resizeMode="cover" />
                    ) : (
                      <>
                        {thumbUri ? <Image source={{ uri: thumbUri }} style={styles.infoMediaBrowserThumbImage} resizeMode="cover" /> : null}
                        <View style={styles.infoMediaBrowserThumbOverlay}>
                          <Ionicons name="play" size={20} color="#FFFFFF" />
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.infoMediaBrowserEmpty}>Không có media</Text>}
            />
          </SafeAreaView>
        </Modal>

        <Modal
          visible={infoEditNameVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setInfoEditNameVisible(false)}
        >
          <Pressable style={styles.infoNameModalBackdrop} onPress={() => setInfoEditNameVisible(false)}>
            <Pressable
              style={[styles.infoNameModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.infoNameModalTitle, { color: colors.text }]}>Đổi tên nhóm</Text>
              <TextInput
                value={infoEditNameValue}
                onChangeText={setInfoEditNameValue}
                maxLength={100}
                autoFocus
                placeholder="Nhập tên nhóm"
                placeholderTextColor={colors.textSecondary}
                style={[styles.infoNameModalInput, { color: colors.text, borderColor: colors.border }]}
              />
              <View style={styles.infoNameModalActions}>
                <TouchableOpacity
                  style={[styles.infoNameModalBtn, { borderColor: colors.border }]}
                  onPress={() => setInfoEditNameVisible(false)}
                >
                  <Text style={[styles.infoNameModalBtnText, { color: colors.textSecondary }]}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.infoNameModalBtnPrimary, (infoUpdatingGroupName || !infoEditNameValue.trim()) && styles.infoNameModalBtnPrimaryDisabled]}
                  onPress={() => { void handleInfoUpdateGroupName(); }}
                  disabled={infoUpdatingGroupName || !infoEditNameValue.trim()}
                >
                  <Text style={styles.infoNameModalBtnPrimaryText}>{infoUpdatingGroupName ? '...' : 'Lưu'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={infoAddMemberVisible}
          animationType="slide"
          onRequestClose={handleCloseInfoAddMemberModal}
        >
          <SafeAreaView style={[styles.addMemberModalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.addMemberModalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <TouchableOpacity style={styles.addMemberModalBackBtn} onPress={handleCloseInfoAddMemberModal}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.addMemberModalHeaderCenter}>
                <Text style={[styles.addMemberModalTitle, { color: colors.text }]}>Thêm thành viên</Text>
                <Text style={[styles.addMemberModalSubtitle, { color: colors.textSecondary }]}>
                  Đã chọn: {infoSelectedMembers.length}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.addMemberModalActionBtn,
                  (!infoSelectedMembers.length || infoAddingMembers) && styles.addMemberModalActionBtnDisabled,
                ]}
                onPress={handleInfoAddMembers}
                disabled={!infoSelectedMembers.length || infoAddingMembers}
              >
                <Text style={styles.addMemberModalActionBtnText}>
                  {infoAddingMembers ? '...' : 'Thêm'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.searchWrap, { backgroundColor: colors.surface }]}> 
              <Ionicons name="search" size={26} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                value={infoAddMemberSearch}
                onChangeText={setInfoAddMemberSearch}
                placeholder="Tìm tên hoặc số điện thoại"
                placeholderTextColor={colors.textSecondary}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>

            <View style={styles.addMemberListWrap}>
              <FlatList
                data={infoAddMemberListData}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.addMemberListContent}
                renderItem={({ item }) => {
                  if (item.type === 'header') {
                    return (
                      <View style={[styles.addMemberLetterRow, { borderTopColor: colors.border }]}>
                        <Text style={[styles.addMemberLetterText, { color: colors.text }]}>{item.letter}</Text>
                      </View>
                    );
                  }

                  const friend = item.friend;
                  const friendId = String(friend.user_id ?? friend.id ?? '');
                  const friendName = String(friend.display_name ?? friend.full_name ?? friend.name ?? 'Unknown');
                  const friendAvatar = friend.avatar_url || friend.avatarUrl || friend.avatar;
                  const selected = infoSelectedMembers.includes(friendId);

                  return (
                    <TouchableOpacity
                      style={[styles.addMemberFriendRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
                      activeOpacity={0.7}
                      onPress={() => setInfoSelectedMembers((prev) => (
                        prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
                      ))}
                    >
                      {friendAvatar ? (
                        <Image source={getAvatarSource(friendAvatar)} style={styles.addMemberAvatar} />
                      ) : (
                        <View style={[styles.addMemberAvatar, { backgroundColor: '#4A90D9' }]}>
                          <Text style={styles.addMemberAvatarText}>{friendName.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}

                      <View style={styles.addMemberFriendInfo}>
                        <Text style={[styles.addMemberFriendName, { color: colors.text }]} numberOfLines={1}>
                          {friendName}
                        </Text>
                        {friend.email ? (
                          <Text style={[styles.addMemberFriendSub, { color: colors.textSecondary }]} numberOfLines={1}>
                            {friend.email}
                          </Text>
                        ) : null}
                      </View>

                      <View style={[styles.addMemberCheckCircle, selected && styles.addMemberCheckCircleSelected]}>
                        {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.addMemberEmptyWrap}>
                    <Text style={[styles.addMemberEmptyText, { color: colors.textSecondary }]}>Không tìm thấy bạn bè phù hợp</Text>
                  </View>
                }
              />
            </View>
          </SafeAreaView>
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
  pinnedBannerWrap: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    backgroundColor: '#2F87F2',
  },
  pinnedBanner: {
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinnedBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: '#EEF3FA',
  },
  pinnedBannerAction: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedBannerThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    minHeight: 28,
    paddingVertical: 4,
  },
  olderLoadingText: {
    fontSize: 11,
    fontWeight: '500',
  },
  olderLoadingPlaceholder: {
    height: 14,
  },
  messageContainer: {
    marginBottom: 2,
    width: '100%',
  },
  messageContainerHighlighted: {
    backgroundColor: 'rgba(0, 104, 255, 0.09)',
    borderRadius: 12,
    paddingHorizontal: 4,
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
  groupSenderName: {
    fontSize: 11,
    marginLeft: 6,
    marginBottom: 4,
    fontWeight: '500',
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
    paddingVertical: 8,
    borderRadius: 18,
    maxWidth: '85%',
    minWidth: 48,
    minHeight: 34,
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
    lineHeight: 20,
    fontWeight: '400',
  },
  userMessageText: {
    paddingVertical: 0,
  },
  dateSeparator: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    gap: 6,
  },
  pinnedBannerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  systemMessageRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    paddingHorizontal: 20,
  },
  systemMessageBubble: {
    maxWidth: '88%',
    backgroundColor: 'rgba(120, 128, 140, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  systemMessageText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#6C7584',
    textAlign: 'center',
    fontWeight: '500',
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
    width: 32,
    height: 32,
    borderRadius: 4,
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
  pinnedContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pinnedSender: {
    fontSize: 12,
    fontWeight: '700',
  },
  pinnedContent: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  pinnedItemThumb: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#E6EBF2',
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
  videoThumbnailImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
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
  // ── Multi-image preview ──────────────────
  multiImagePreviewContainer: {
    backgroundColor: '#F4F7FC',
    borderTopWidth: 1,
    borderTopColor: '#DEE5EF',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 8,
  },
  multiImageScroll: {
    maxHeight: 90,
  },
  multiImageScrollContent: {
    gap: 6,
    paddingRight: 4,
  },
  multiImageThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden' as const,
    backgroundColor: '#E0E6EF',
  },
  multiImageThumb: {
    width: 72,
    height: 72,
  },
  multiImageUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiImageUploadPct: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  multiImageDoneOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,168,80,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiImageRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  multiImageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  multiImageCount: {
    fontSize: 12,
    color: '#6C7480',
  },
  multiImageCancelText: {
    fontSize: 12,
    color: '#F04343',
    fontWeight: '600',
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
  infoPanelAvatarWrap: {
    position: 'relative',
  },
  infoPanelAvatarCameraBadge: {
    position: 'absolute',
    right: -3,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoPanelNameRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoPanelNameEditBtn: {
    marginLeft: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoNameModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  infoNameModalCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  infoNameModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  infoNameModalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  infoNameModalActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  infoNameModalBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  infoNameModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoNameModalBtnPrimary: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: COLORS.primary,
  },
  infoNameModalBtnPrimaryDisabled: {
    backgroundColor: '#9DBEF9',
  },
  infoNameModalBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  addMemberModalContainer: {
    flex: 1,
  },
  addMemberModalHeader: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 10,
  },
  addMemberModalBackBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberModalHeaderCenter: {
    flex: 1,
    marginLeft: 4,
  },
  addMemberModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addMemberModalSubtitle: {
    marginTop: 2,
    fontSize: 11,
  },
  addMemberModalActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  addMemberModalActionBtnDisabled: {
    backgroundColor: '#9DBEF9',
  },
  addMemberModalActionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 12,
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
  addMemberListWrap: {
    flex: 1,
  },
  addMemberListContent: {
    paddingBottom: 20,
  },
  addMemberLetterRow: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#F1F2F4',
  },
  addMemberLetterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  addMemberFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addMemberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  addMemberFriendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  addMemberFriendName: {
    fontSize: 14,
    fontWeight: '500',
  },
  addMemberFriendSub: {
    marginTop: 2,
    fontSize: 11,
  },
  addMemberCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#999FA8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberCheckCircleSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  addMemberEmptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberEmptyText: {
    fontSize: 12,
  },
  infoPanelQuickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginTop: 18,
    paddingHorizontal: 8,
  },
  infoPanelQuickAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  infoPanelQuickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  infoPanelQuickActionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
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
  infoPanelMediaGridHeader: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoPanelMediaGridHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoPanelMediaViewAll: {
    color: '#0068FF',
    fontSize: 12,
    fontWeight: '700',
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
  infoPanelMediaPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.26)',
  },
  infoPanelMediaPlayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  infoMediaGalleryBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,1)',
  },
  infoMediaGalleryTopBar: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoMediaGalleryCloseText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '700',
  },
  infoMediaGalleryItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoMediaGalleryVideoWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  infoMediaGalleryImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  infoMediaGalleryVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  infoMediaGalleryVideoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  infoMediaGalleryVideoPosterWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoMediaGalleryVideoPlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#0F0F0F',
  },
  infoMediaGalleryVideoPlayButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  infoMediaGalleryVideoPlayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoMediaActionSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 92,
    paddingRight: 16,
  },
  infoMediaActionSheet: {
    width: 210,
    borderRadius: 10,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  infoMediaActionSheetItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  infoMediaActionSheetItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  globalBusyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalBusyCard: {
    minWidth: 190,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    gap: 10,
  },
  globalProgressTrack: {
    width: 180,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  globalProgressFill: {
    height: '100%',
    backgroundColor: '#4DA3FF',
  },
  globalBusyPercent: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  globalBusyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  infoMediaBrowserContainer: {
    flex: 1,
    backgroundColor: '#0B0D11',
  },
  infoMediaBrowserHeader: {
    height: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  infoMediaBrowserTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  infoMediaBrowserFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  infoMediaBrowserFilterBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  infoMediaBrowserFilterBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.32)',
  },
  infoMediaBrowserFilterText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  infoMediaBrowserFilterTextActive: {
    color: '#FFFFFF',
  },
  infoMediaBrowserGrid: {
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  infoMediaBrowserRow: {
    gap: 4,
    marginBottom: 4,
  },
  infoMediaBrowserThumb: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#12161E',
    borderRadius: 4,
    overflow: 'hidden',
  },
  infoMediaBrowserThumbImage: {
    width: '100%',
    height: '100%',
  },
  infoMediaBrowserThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  infoMediaBrowserEmpty: {
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 13,
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

