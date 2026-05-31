import { AttachMenuContent } from '@/components/chat/AttachMenuContent';
import { ChatHeader } from '@/components/chat/ChatHeader';
import CustomImagePicker from '@/components/chat/CustomImagePicker';
import ExpandableText from '@/components/chat/ExpandableText';
import { ForwardModalContent } from '@/components/chat/ForwardModalContent';
import { MediaViewer } from '@/components/chat/MediaViewer';
import MemberListModal from '@/components/chat/MemberListModal';
import { MessageInput } from '@/components/chat/MessageInput';
import { MessageItem } from '@/components/chat/MessageItem';
import ForwardedBanner from '@/components/chat/MessageItem/ForwardedBanner';
import ReplySnippet from '@/components/chat/MessageItem/ReplySnippet';
import { MessageList } from '@/components/chat/MessageList';
import { PinnedListContent } from '@/components/chat/PinnedListContent';
import PollCard from '@/components/chat/PollCard';
import PollCreateModal from '@/components/chat/PollCreateModal';
import { ReactionPicker } from '@/components/chat/ReactionPicker';
import RichTextRenderer, { extractRichTextPlainText } from '@/components/chat/RichTextRenderer';
import { ShareContactContent } from '@/components/chat/ShareContactContent';
import { SystemMessageBubble } from '@/components/chat/SystemMessageBubble';
import { COLORS } from '@/constants/theme';
import { usePresence } from '@/context/PresenceContext';
import { useTheme } from '@/context/ThemeContext';
import { useChatSocket } from '@/hooks/useChatSocket';
import useLocalDeleted from '@/hooks/useLocalDeleted';
import useVoiceRecording from '@/hooks/useVoiceRecording';
import api from '@/services/api';
import { chatFileService, type PickedMedia } from '@/services/chatFileService';
import { chatService } from '@/services/chatService';
import { friendService } from '@/services/friendService';
import { getAvatarSource } from '@/services/mediaUtils';
import GroupCallCard from '@/src/components/chat/GroupCallCard';
import { serializePlainTextToTiptapJson } from '@/utils/chat/plainTextToTiptap';
import { DEFAULT_SPLIT_MESSAGE_MAX_WORDS, splitMessage } from '@/utils/chat/splitMessage';
import { getSystemMessageContent, isSystemMessage } from '@/utils/chat/systemMessage';
import { CallOverlay } from '@chat/components/CallOverlay';
import MentionDropdown from '@chat/components/input/MentionDropdown';
import CallHistoryCard from '@chat/components/message/CallHistoryCard';
import LinkPreviewCard from '@chat/components/message/LinkPreviewCard';
import { Ionicons } from '@expo/vector-icons';
import { chatDetailStyles as styles } from '@features/chat/styles/chatDetailStyles';
import type { AxiosError } from 'axios';
import { ResizeMode, Video } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as VideoThumbnails from 'expo-video-thumbnails';
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
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchConversationMembers } from '../services/chatConversationMembers';
import {
  mapChatPayloadListToUiMessages,
  mapChatPayloadToUiMessage,
  type ChatUiMessage
} from '../services/chatMessageAdapter';
import { webrtcService } from '../services/webrtcService';


import ChatInfoPanel from '../components/ChatInfoPanel';
import {
  AI_TYPING_USER_ID, BLOCK_GAP_MS,
  BROKER_URL,
  isExpoGo,
  MAX_IMAGE_SELECTION,
  PAGE_SIZE,
  REACTION_EMOJIS,
  SCROLL_TOP_THRESHOLD
} from '../constants/chatConstants';
import type { ApiWrappedPayload, ForwardConversationItem, Message, MessagePageResponse, PinnedMessageItem } from '../types/chatTypes';
import {
  buildReactionSummary,
  emojiToReactionType,
  formatDateSeparator,
  formatMessageTime,
  getDisplayFileNameFromValue,
  getFileExtensionFromMimeType,
  getForwardAttachmentUrls,
  getMessageMillis,
  getReplySnippet,
  isLikelyUrl,
  parseMessageDate,
  stripAiMarkdownMarkers,
  toLocalIsoString
} from '../utils/chatHelpers';

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id, name, avatar, type } = useLocalSearchParams<{ id: string; name: string; avatar?: string; type?: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [inputText, setInputText] = useState('');
  const locallyDeletedMessageIdsRef = useRef<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(String(id ?? ''));
  const [conversationDisplayName, setConversationDisplayName] = useState(String(name ?? ''));
  const [conversationAvatarUrl, setConversationAvatarUrl] = useState(String(avatar ?? ''));
  const [messages, setMessages] = useState<Message[]>([]);
  const displayMessages = useMemo(() => {
    return messages.filter(
      (m) =>
        (m.messageType || '').toUpperCase() !== 'MESSAGE_PIN' &&
        (m.messageType || '').toUpperCase() !== 'MESSAGE_UNPIN'
    );
  }, [messages]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSendingAi, setIsSendingAi] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isMessageActionVisible, setIsMessageActionVisible] = useState(false);
  const [reactionViewerMessage, setReactionViewerMessage] = useState<Message | null>(null);
  const [reactionViewerEmojiTab, setReactionViewerEmojiTab] = useState<string>('all');
  const [isPinnedListVisible, setIsPinnedListVisible] = useState(false);
  const [isPollModalVisible, setIsPollModalVisible] = useState(false);
  const [isMentionDropdownVisible, setIsMentionDropdownVisible] = useState(false);
  const [mentionSearchText, setMentionSearchText] = useState('');
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessageItem[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isAttachMenuVisible, setIsAttachMenuVisible] = useState(false);
  const [isCustomImagePickerVisible, setIsCustomImagePickerVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isSearchingLoading, setIsSearchingLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchMessages = useCallback(async (q: string) => {
    if (!q.trim() || !conversationId) return;
    setIsSearchingLoading(true);
    try {
      // API: /search/messages?q=...&conversationId=...
      const res = await api.get(`/search/messages?q=${encodeURIComponent(q.trim())}&conversationId=${conversationId}`);
      const resData = chatService.unwrapApiPayload<any>(res);
      const content = resData?.content ?? (Array.isArray(resData) ? resData : null);
      if (content && Array.isArray(content) && content.length > 0) {
        // Map search results to UI message format
        const mapped = content.map((item: any) => {
          // Backend trả về SearchResult<MessageDocument> -> trường 'document'
          const doc = item?.document ?? item;
          const resolvedMessageId =
            doc?.messageId ??
            doc?.id ??
            doc?._id ??
            item?.messageId ??
            item?.id ??
            item?._id;

          if (resolvedMessageId && !doc?.messageId) {
            doc.messageId = resolvedMessageId;
          }

          return mapChatPayloadToUiMessage(doc);
        });
        setSearchResults(mapped.filter(Boolean) as Message[]);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearchingLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    if (!isSearching || !searchQuery.trim()) {
      setIsSearchingLoading(false);
      if (!searchQuery.trim()) {
        setSearchResults([]);
      }
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      void handleSearchMessages(searchQuery);
    }, 320);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [handleSearchMessages, isSearching, searchQuery]);

  const handlePollSubmit = useCallback(async (data: {
    question: string;
    options: string[];
    deadline?: string;
    isPinned?: boolean;
    multipleChoices?: boolean;
    allowAddOptions?: boolean;
    hideResultsBeforeVote?: boolean;
    hideVoters?: boolean;
  }) => {
    try {
      await chatService.createPoll({
        conversationId,
        question: data.question,
        options: data.options,
        deadline: data.deadline,
        isPinned: data.isPinned,
        multipleChoices: data.multipleChoices,
        allowAddOptions: data.allowAddOptions,
        hideResultsBeforeVote: data.hideResultsBeforeVote,
        hideVoters: data.hideVoters,
      } as any);
      setIsPollModalVisible(false);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      Alert.alert(t('common.error', 'Lỗi'), axiosErr?.response?.data?.message || t('chat.poll.createError', 'Không thể tạo cuộc thăm dò'));
    }
  }, [conversationId, t]);

  const toggleSearchMode = () => {
    setIsSearching(!isSearching);
    if (isSearching) {
      setSearchQuery('');
      setSearchResults([]);
      setIsSearchingLoading(false);
    }
  };

  const closeSearchMode = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    setIsSearching(false);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchingLoading(false);
  }, []);

  const [pendingMediaList, setPendingMediaList] = useState<PickedMedia[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const filterDeletedMessages = useCallback((msgs: Message[]) => {
    const deletedSet = localDeleted.getDeletedSet();
    if (!deletedSet || deletedSet.size === 0) return msgs;
    const filtered = msgs.filter((m) => !deletedSet.has(String(m.messageId)));
    return filtered;
  }, [isExpoGo]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCurrentIndex, setUploadCurrentIndex] = useState(0);
  const [videoThumbnailsByMessageId, setVideoThumbnailsByMessageId] = useState<Record<string, string>>({});
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [fullscreenVideoUrl, setFullscreenVideoUrl] = useState<string | null>(null);

  // Info panel state — managed inside ChatInfoPanel
  const [isInfoPanelVisible, setIsInfoPanelVisible] = useState(false);
  const [infoMembers, setInfoMembers] = useState<any[]>([]);
  const [isMemberListVisible, setIsMemberListVisible] = useState(false);
  const [isJumpingToMessage, setIsJumpingToMessage] = useState(false);

  // Reply, Forward, Share Contact
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [isShareContactVisible, setIsShareContactVisible] = useState(false);
  // Forward modal state
  const [fwdConversations, setFwdConversations] = useState<ForwardConversationItem[]>([]);
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

  // Voice recording moved into hook (useVoiceRecording)
  const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const loadingOlderRef = useRef(false);
  const pendingScrollToLatestRef = useRef(false);
  const pendingScrollToLatestAnimatedRef = useRef(false);
  const isAtLatestMessageRef = useRef(true);
  const generatingVideoThumbRef = useRef<Set<string>>(new Set());
  const peerAvatarSource = useMemo(() => getAvatarSource(conversationAvatarUrl), [conversationAvatarUrl]);
  const normalizedName = String(conversationDisplayName ?? '').trim().toLowerCase();
  const normalizedType = String(type ?? '').trim().toUpperCase();
  const isAiConversation = normalizedType === 'AI' || normalizedName === 'fruvia chat ai' || normalizedName === 'fruvia ai' || normalizedName === 'fruvia chatbot';
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
    setIsMemberListVisible(false);
  }, [avatar, id, name]);

  // Initialize local-deleted IDs into the existing ref so legacy usages keep working
  useEffect(() => {
    if (!conversationId) return;
    void (async () => {
      await localDeleted.initDeletedSet(conversationId, currentUserId ?? undefined);
      locallyDeletedMessageIdsRef.current = localDeleted.getDeletedSet();
    })();
  }, [conversationId, currentUserId]);

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

  const logChatDebug = useCallback((_label: string, _payload: unknown) => {}, []);

  const requestScrollToLatest = useCallback((animated: boolean) => {
    pendingScrollToLatestRef.current = true;
    pendingScrollToLatestAnimatedRef.current = animated;
  }, []);

  const sortMessages = useCallback((msgs: Message[]): Message[] => {
    return [...msgs].sort((a, b) => {
      const timeA = parseMessageDate(a.createdAt)?.getTime() ?? Number.NaN;
      const timeB = parseMessageDate(b.createdAt)?.getTime() ?? Number.NaN;
      return timeB - timeA; // descending: mới → cũ
    });
  }, []);

  const mergeUniqueMessages = useCallback((base: Message[], incoming: Message[]) => {
    const mergedById = new Map<string, Message>();

    base.forEach((message) => {
      if (!localDeleted.isDeleted(String(message.messageId))) {
        mergedById.set(String(message.messageId), message);
      }
    });

    incoming.forEach((message) => {
      if (!localDeleted.isDeleted(String(message.messageId))) {
        mergedById.set(String(message.messageId), message);
      }
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
    if (localDeleted.isDeleted(String(message.messageId))) {
      return;
    }
    setMessages((prev) => {
      const merged = mergeUniqueMessages(prev, [message]);
      return isSameMessageList(prev, merged) ? prev : merged;
    });
  }, [isSameMessageList, logChatDebug, mergeUniqueMessages]);

  const applyReactionUpdate = useCallback((event: Record<string, unknown>) => {
    const messageId = String(event.messageId ?? '');
    if (!messageId) {
      return;
    }

    const action = String(event.action ?? '').toUpperCase();
    const reactionEmoji = String(event.emoji ?? '').trim();
    const reactionType = String(event.reactionType ?? '').toUpperCase();
    const reactionId = String(event.reactionId ?? `${messageId}-${event.userId ?? 'user'}-${reactionType || reactionEmoji}`);
    const userId = String(event.userId ?? '');

    setMessages((prev) => prev.map((message) => {
      if (String(message.messageId) !== messageId) {
        return message;
      }

      const currentReactions = Array.isArray(message.reactions) ? [...message.reactions] : [];

      if (action === 'CLEAR') {
        return { ...message, reactions: [] };
      }

      if (action === 'REMOVE') {
        return {
          ...message,
          reactions: currentReactions.filter((reaction) => {
            if (reactionId && reaction.id === reactionId) return false;
            if (userId && String(reaction.userId) === userId && reaction.reactionType === reactionType) return false;
            if (reactionEmoji && reaction.emoji === reactionEmoji && userId && String(reaction.userId) === userId) return false;
            return true;
          }),
        };
      }

      if (action === 'ADD' || !action) {
        const nextReaction: any = {
          id: reactionId,
          userId,
          emoji: reactionEmoji || '👍',
          reactionType: reactionType || 'LIKE',
          userName: String(event.userName ?? '') || undefined,
          userAvatar: String(event.userAvatar ?? '') || undefined,
        };

        if (currentReactions.some((reaction) => reaction.id === nextReaction.id)) {
          return {
            ...message,
            reactions: currentReactions.map((reaction) => (reaction.id === nextReaction.id ? nextReaction : reaction)),
          };
        }

        return {
          ...message,
          reactions: [...currentReactions, nextReaction],
        };
      }

      return message;
    }));

    if (reactionViewerMessage && String(reactionViewerMessage.messageId) === messageId) {
      const current = messages.find((message) => String(message.messageId) === messageId);
      if (current) {
        setReactionViewerMessage(current);
      }
    }
  }, [messages, reactionViewerMessage]);

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

  // formatMessageTime, isLikelyUrl, getDisplayFileNameFromValue,
  // getReplySnippet, getForwardAttachmentUrls moved to utils/chatHelpers.ts

  const getForwardPreviewText = useCallback((msg: Message) => {
    const mType = String(msg.messageType ?? 'TEXT').toUpperCase();
    if (mType === 'IMAGE') return 'Ảnh';
    if (mType === 'IMAGE_GROUP') {
      const count = getForwardAttachmentUrls(msg).length;
      return count > 0 ? `${count} hình ảnh` : 'Album ảnh';
    }
    if (mType === 'VIDEO') return 'Video';
    if (mType === 'VOICE') return 'Tin nhắn thoại';
    if (mType === 'FILE' || mType === 'MEDIA') {
      const fileName = msg.fileName || getDisplayFileNameFromValue(msg.content);
      return fileName || 'Tệp đính kèm';
    }
    if (mType === 'SHARE_CONTACT') {
      try {
        const parsed = JSON.parse(msg.content || '{}');
        return parsed.fullName || 'Danh thiếp';
      } catch {
        return 'Danh thiếp';
      }
    }

    let content = String(msg.content ?? '').trim();
    try {
      if (content.startsWith('{') && content.endsWith('}')) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          const extract = (node: any): string => {
            if (!node) return '';
            if (node.type === 'text') return node.text ?? '';
            if (Array.isArray(node.content)) return node.content.map(extract).join('');
            return '';
          };
          content = extract(parsed).trim() || content;
        }
      }
    } catch { /* not JSON */ }

    if (!content) {
      return t('chat.empty_message', 'Tin nhắn trống');
    }

    return content.length > 120 ? `${content.slice(0, 120)}...` : content;
  }, [getDisplayFileNameFromValue, getForwardAttachmentUrls, t]);

  const buildForwardPayload = useCallback((msg: Message) => {
    const mType = String(msg.messageType ?? 'TEXT').toUpperCase();

    if (mType === 'IMAGE_GROUP') {
      const mediaUrls = getForwardAttachmentUrls(msg);
      return {
        content: mediaUrls[0] || String(msg.content ?? ''),
        messageType: 'IMAGE_GROUP',
        mediaUrls,
        caption: msg.caption,
        forwardedFromMessageId: msg.messageId,
      };
    }

    if (mType === 'FILE' || mType === 'MEDIA') {
      const fileName = msg.fileName || getDisplayFileNameFromValue(msg.content);
      return {
        content: String(msg.content ?? ''),
        messageType: mType,
        fileName: fileName || undefined,
        fileSize: msg.fileSize,
        caption: msg.caption,
        forwardedFromMessageId: msg.messageId,
      };
    }

    if (mType === 'VIDEO') {
      return {
        content: String(msg.content ?? ''),
        messageType: 'VIDEO',
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        caption: msg.caption,
        videoDuration: msg.videoDuration,
        forwardedFromMessageId: msg.messageId,
      };
    }

    if (mType === 'IMAGE') {
      return {
        content: String(msg.content ?? ''),
        messageType: 'IMAGE',
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        caption: msg.caption,
        forwardedFromMessageId: msg.messageId,
      };
    }

    if (mType === 'VOICE') {
      return {
        content: String(msg.content ?? ''),
        messageType: 'VOICE',
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        voiceDuration: msg.voiceDuration,
        forwardedFromMessageId: msg.messageId,
      };
    }

    if (mType === 'SHARE_CONTACT') {
      return {
        content: String(msg.content ?? ''),
        messageType: 'SHARE_CONTACT',
        forwardedFromMessageId: msg.messageId,
      };
    }

    return {
      content: String(msg.content ?? ''),
      messageType: 'TEXT',
      forwardedFromMessageId: msg.messageId,
    };
  }, [getDisplayFileNameFromValue, getForwardAttachmentUrls]);

  const filteredFwdConversations = useMemo(() => {
    const keyword = fwdSearch.trim().toLowerCase();
    if (!keyword) {
      return fwdConversations;
    }

    return fwdConversations.filter((conversation) => conversation.name.toLowerCase().includes(keyword));
  }, [fwdConversations, fwdSearch]);

  // stripAiMarkdownMarkers moved to utils/chatHelpers.ts

  const getDisplayMessageContent = useCallback((message: Message) => {
    const senderName = (message.senderName || '').trim().toLowerCase();
    const isAiSender =
      isAiConversation ||
      String(message.senderId) === AI_TYPING_USER_ID ||
      senderName === 'fruvia ai' || senderName === 'fruvia chatbot';

    const raw = message.content || '';
    const richTextPlain = extractRichTextPlainText(raw);

    if (!isAiSender) {
      return richTextPlain || raw;
    }

    let plain = richTextPlain || raw;
    try {
      if (plain.trim().startsWith('{') && plain.trim().endsWith('}')) {
        const parsed = JSON.parse(plain);
        if (parsed && typeof parsed === 'object') {
          const extract = (node: any): string => {
            if (!node) return '';
            if (node.type === 'text') return node.text ?? '';
            if (Array.isArray(node.content)) return node.content.map(extract).join('');
            return '';
          };
          plain = extract(parsed).trim() || raw;
        }
      }
    } catch { /* not JSON */ }

    return stripAiMarkdownMarkers(plain);
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
          thumbnailUrl: item.thumbnailUrl ? String(item.thumbnailUrl) : undefined,
          fileName: item.fileName ? String(item.fileName) : undefined,
          fileSize: typeof item.fileSize === 'number' ? item.fileSize : undefined,
          caption: item.caption ? String(item.caption) : undefined,
          attachments: Array.isArray(item.attachments)
            ? item.attachments
              .map((att: any) => ({
                url: String(att?.url ?? att?.content ?? att?.mediaUrl ?? att?.fileUrl ?? '').trim(),
                fileName: att?.fileName ? String(att.fileName) : undefined,
                fileSize: typeof att?.fileSize === 'number' ? att.fileSize : undefined,
                thumbnailUrl: att?.thumbnailUrl ? String(att.thumbnailUrl) : undefined,
              }))
              .filter((att: any) => att.url)
            : (Array.isArray(item.mediaUrls)
              ? item.mediaUrls
                .map((url: any) => String(url ?? '').trim())
                .filter((url: string) => url)
                .map((url: string) => ({ url }))
              : undefined),
          senderName: item.senderName ? String(item.senderName) : undefined,
          pinnedAt: item.pinnedAt ? String(item.pinnedAt) : undefined,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch pinned messages:', error);
      setPinnedMessages([]);
    }
  }, [canUseMessageInteractions, conversationId]);

  const { statuses } = usePresence();
  const { isConnected, sendTyping, sendReadReceipt, sendCallSignal } = useChatSocket({
    conversationId,
    brokerURL: BROKER_URL,
    userId: currentUserId,
    onMessage: (event) => {
      const wrapped = chatService.unwrapApiPayload<any>(event);
      if (String(wrapped?.type ?? '').toUpperCase() === 'REACTION_UPDATE') {
        applyReactionUpdate(wrapped as Record<string, unknown>);
        return;
      }

      const mappedMessage = mapAnyPayloadToUiMessage(wrapped);
      
      if (mappedMessage) {
        // Nếu là tin nhắn hệ thống (thêm người, rời nhóm...), ta xử lý hiển thị
        if (mappedMessage.messageType === 'SYSTEM') {
          // Logic hiển thị thông báo hệ thống nếu cần xử lý riêng
        }
        appendOrUpdateMessage(mappedMessage);
      } else {
        void loadInitialMessages(currentUserId, true);
      }
    },
    onCallSignal: (event) => {
      webrtcService.handleIncomingSignal(event as any);
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
    onConversationEvent: async (event) => {
      if (event.type !== 'MESSAGE_LOCAL_DELETE') return;
      const msgId = String(event.messageId);
      const convId = String(event.conversationId);
      // Persist to SecureStore via hook so it stays hidden after reload
      await localDeleted.markDeleted(convId, currentUserId || 'anonymous', msgId);
      locallyDeletedMessageIdsRef.current = localDeleted.getDeletedSet();
      // Hide from current message list immediately
      if (convId === conversationId) {
        setMessages((prev) => prev.filter((m) => String(m.messageId) !== msgId));
      }
    },
    onGroupEvent: async (event) => {
      const eventType = String(event?.type ?? '').toUpperCase();
      const eventConversationId = String(event?.conversationId ?? event?.id ?? '');

      if (!eventConversationId || eventConversationId !== String(conversationId)) {
        return;
      }

      if (eventType === 'REMOVED' || eventType === 'DISSOLVED') {
        Alert.alert(
          'Thông báo',
          eventType === 'DISSOLVED'
            ? 'Nhóm đã bị giải tán.'
            : 'Bạn đã bị xóa khỏi nhóm.'
        );
        router.replace('/(tabs)/chat');
        return;
      }

      if (isGroupConversation) {
        // Info panel state managed inside ChatInfoPanel
      }
    },
  });

  useEffect(() => {
    webrtcService.setSignalSender((signal: any) => {
      // Send strictly through useChatSocket connection callback
      return sendCallSignal!(signal as any);
    });
  }, [sendCallSignal]);

  const partnerId = isPrivateConversation && type !== 'CLOUD' ? conversationId.split('_').find(id => id !== currentUserId) : null;
  const isPartnerOnline = partnerId ? statuses.get(partnerId)?.online : false;
  const isPartnerTyping = isPartnerOnline && isTyping;

  // Fetch group members for online status
  useEffect(() => {
    if (!isGroupConversation || !conversationId) return;
    fetchConversationMembers(conversationId)
      .then(setInfoMembers)
      .catch(() => setInfoMembers([]));
  }, [isGroupConversation, conversationId]);

  // Count online members for group
  const groupOnlineCount = useMemo(() => {
    if (!isGroupConversation || infoMembers.length === 0) return 0;
    return infoMembers.filter((m: any) => {
      const uid = String(m.userId ?? m.user_id ?? '');
      return uid && uid !== currentUserId && statuses.get(uid)?.online;
    }).length;
  }, [isGroupConversation, infoMembers, currentUserId, statuses]);

  const headerSubtitleText = isAiConversation
    ? (isSendingAi ? t('chat.typing', 'Đang nhập...') : t('chat.ai_subheading', 'Hỏi đáp với Fruvia Chatbot'))
    : isCloudConversation
      ? t('chat.cloud_subheading', 'Truyền file giữa các thiết bị của bạn')
      : isGroupConversation
        ? groupOnlineCount > 0
          ? `${infoMembers.length} thành viên, ${groupOnlineCount} đang hoạt động`
          : `${infoMembers.length} thành viên`
        : isPartnerOnline
          ? (isPartnerTyping ? t('chat.typing', 'Đang nhập...') : t('chat.active', 'Đang hoạt động'))
          : t('chat.offline_recent', 'Truy cập gần đây');

  const latestPinnedMessage = pinnedMessages.length > 0
    ? pinnedMessages[pinnedMessages.length - 1]
    : null;
  const latestPinnedType = (latestPinnedMessage?.messageType || '').toUpperCase();
  const latestPinnedIsImage = latestPinnedType === 'IMAGE' || latestPinnedType === 'IMAGE_GROUP';
  const latestPinnedThumbUrl = latestPinnedMessage
    ? (() => {
      if (latestPinnedType === 'IMAGE') {
        const candidate = String(latestPinnedMessage.contentUrl || latestPinnedMessage.content || '').trim();
        return isLikelyUrl(candidate) ? candidate : '';
      }

      if (latestPinnedType === 'IMAGE_GROUP') {
        const firstAttachment = latestPinnedMessage.attachments?.[0]?.url;
        const candidate = String(firstAttachment || latestPinnedMessage.contentUrl || latestPinnedMessage.content || '').trim();
        return isLikelyUrl(candidate) ? candidate : '';
      }

      return '';
    })()
    : '';
  const latestPinnedLabel = latestPinnedMessage
    ? (() => {
      const text = (latestPinnedMessage.content || '').trim();
      if (latestPinnedType === 'IMAGE') return '[Hình ảnh]';
      if (latestPinnedType === 'IMAGE_GROUP') {
        const imageCount = latestPinnedMessage.attachments?.length ?? 0;
        return imageCount > 0 ? `[${imageCount} hình ảnh]` : '[Album ảnh]';
      }
      if (latestPinnedType === 'VIDEO') return '[Video]';
      if (latestPinnedType === 'VOICE') return '[Tin nhắn thoại]';
      if (latestPinnedType === 'FILE' || latestPinnedType === 'MEDIA') {
        const fileName = latestPinnedMessage.fileName || getDisplayFileNameFromValue(latestPinnedMessage.contentUrl || latestPinnedMessage.content);
        return fileName ? `[Tệp] ${fileName}` : '[Tệp đính kèm]';
      }
      return text || t('chat.empty_message', 'Tin nhắn trống');
    })()
    : '';

  const getPinnedPreviewText = useCallback((item: PinnedMessageItem) => {
    const pinnedType = (item.messageType || '').toUpperCase();
    if (pinnedType === 'IMAGE') {
      return '[Hình ảnh]';
    }

    if (pinnedType === 'IMAGE_GROUP') {
      const imageCount = item.attachments?.length ?? 0;
      return imageCount > 0 ? `[${imageCount} hình ảnh]` : '[Album ảnh]';
    }

    if (pinnedType === 'VIDEO') {
      return '[Video]';
    }

    if (pinnedType === 'VOICE') {
      return '[Tin nhắn thoại]';
    }

    if (pinnedType === 'FILE' || pinnedType === 'MEDIA') {
      const fileName = item.fileName || getDisplayFileNameFromValue(item.contentUrl || item.content);
      return fileName ? `[Tệp] ${fileName}` : '[Tệp đính kèm]';
    }

    const text = (item.content || '').trim();
    if (!text) {
      return t('chat.empty_message', 'Tin nhắn trống');
    }

    if (isLikelyUrl(text)) {
      return '[Nội dung media]';
    }

    return text;
  }, [getDisplayFileNameFromValue, isLikelyUrl, t]);

  const getPinnedPreviewThumb = useCallback((item: PinnedMessageItem) => {
    const pinnedType = (item.messageType || '').toUpperCase();
    if (pinnedType === 'IMAGE') {
      const candidate = String(item.contentUrl || item.content || '').trim();
      return isLikelyUrl(candidate) ? candidate : '';
    }

    if (pinnedType === 'IMAGE_GROUP') {
      const firstAttachment = item.attachments?.[0]?.url;
      const candidate = String(firstAttachment || item.contentUrl || item.content || '').trim();
      return isLikelyUrl(candidate) ? candidate : '';
    }

    return '';
  }, [isLikelyUrl]);

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
      // 1. Load deleted IDs from storage first (via hook)
      await localDeleted.initDeletedSet(conversationId, uid || currentUserId || 'anonymous');
      locallyDeletedMessageIdsRef.current = localDeleted.getDeletedSet();

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
      // 2. Filter out locally deleted messages
      const filteredMessages = filterDeletedMessages(normalizedMessages);
      const sortedMessages = sortMessages(filteredMessages);
      logChatDebug('loadInitialMessages.normalized', {
        normalizedCount: normalizedMessages.length,
        filteredCount: filteredMessages.length,
        sortedCount: sortedMessages.length,
        firstId: sortedMessages[0]?.messageId,
        lastId: sortedMessages[sortedMessages.length - 1]?.messageId,
      });

      let nextMessages = sortedMessages;
      let nextHasMoreOlder = hasMore;

      if (!silent && nextMessages.length > 0 && nextMessages.length < PAGE_SIZE) {
        let cursorId = nextMessages[nextMessages.length - 1].messageId;

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
          cursorId = nextMessages[nextMessages.length - 1]?.messageId ?? cursorId;
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
        const filteredNext = nextMessages.filter(m => !localDeleted.isDeleted(String(m.messageId)));
        setMessages((prev) => (isSameMessageList(prev, filteredNext) ? prev : filteredNext));
        setHasMoreOlder(nextHasMoreOlder);
        pendingScrollToLatestRef.current = true;
        pendingScrollToLatestAnimatedRef.current = false;
      }

      const latestMessage = nextMessages[0];
      if (uid && latestMessage?.messageId && canUseRealtimeIndicators) {
        sendReadReceipt(conversationId, uid, latestMessage.messageId);
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
      // Load locally-deleted IDs BEFORE loading messages so they get filtered (via hook)
      await localDeleted.initDeletedSet(conversationId, uid || 'anonymous');
      locallyDeletedMessageIdsRef.current = localDeleted.getDeletedSet();
      await loadInitialMessages(uid);
    };
    initialize();
  }, [conversationId, loadInitialMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !hasMoreOlder || isLoadingOlder || loadingOlderRef.current) {
      return;
    }

    const oldestLoadedMessageId = messages[messages.length - 1]?.messageId;
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
      // Filter out locally deleted messages
      const filteredMessages = filterDeletedMessages(normalizedMessages);
      const sortedMessages = sortMessages(filteredMessages);
      logChatDebug('loadOlderMessages.normalized', {
        normalizedCount: normalizedMessages.length,
        filteredCount: filteredMessages.length,
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

  const extractForwardConversationItems = useCallback((raw: any): ForwardConversationItem[] => {
    const payload = chatService.unwrapApiPayload<any>(raw);
    const rawList = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.content)
        ? payload.content
        : (Array.isArray(payload?.conversations)
          ? payload.conversations
          : (Array.isArray(payload?.items)
            ? payload.items
            : (Array.isArray(payload?.data) ? payload.data : []))));

    const normalizedCurrentUserId = String(currentUserId ?? '').trim();

    return rawList
      .map((item: any, index: number): ForwardConversationItem | null => {
        const id = String(item?.conversationId ?? item?.id ?? '').trim();
        if (!id || id === String(conversationId ?? '').trim()) {
          return null;
        }

        const members = Array.isArray(item?.members) ? item.members : [];
        const conversationTypeRaw = String(item?.conversationType ?? item?.type ?? item?.kind ?? '').toUpperCase();
        const isDirectConversation = ['PRIVATE', 'DIRECT', 'ONE_TO_ONE'].includes(conversationTypeRaw);
        const getMemberId = (member: any) => String(
          member?.userId ??
          member?.user_id ??
          member?.id ??
          member?.memberId ??
          member?.member_id ??
          member?.user?.userId ??
          member?.user?.user_id ??
          member?.user?.id ??
          ''
        ).trim();
        const getMemberName = (member: any) => String(
          member?.displayName ??
          member?.display_name ??
          member?.fullName ??
          member?.full_name ??
          member?.name ??
          member?.user?.displayName ??
          member?.user?.display_name ??
          member?.user?.fullName ??
          member?.user?.full_name ??
          member?.user?.name ??
          ''
        ).trim();
        const getMemberAvatar = (member: any) => String(
          member?.avatarUrl ??
          member?.avatar_url ??
          member?.avatar ??
          member?.profilePicture ??
          member?.profile_picture ??
          member?.user?.avatarUrl ??
          member?.user?.avatar_url ??
          member?.user?.avatar ??
          member?.user?.profilePicture ??
          member?.user?.profile_picture ??
          ''
        ).trim();

        const otherMember = isDirectConversation
          ? members.find((member: any) => {
              const memberId = getMemberId(member);
              if (!memberId) {
                return false;
              }

              return normalizedCurrentUserId ? memberId !== normalizedCurrentUserId : true;
            }) ?? members[0] ?? null
          : null;

        const rawConversationName = String(item?.conversationName ?? item?.name ?? '').trim();
        const normalizedRawName = rawConversationName.toLowerCase();
        const isSelfConversation = conversationTypeRaw === 'SELF';
        const isAiConversation = isSelfConversation && (normalizedRawName === 'fruvia ai' || normalizedRawName === 'fruvia chat ai' || normalizedRawName === 'fruvia chatbot');
        const isCloudConversation = isSelfConversation && !isAiConversation;

        const rawName = String(
          (isDirectConversation
            ? getMemberName(otherMember)
            : undefined)
            ?? (isAiConversation ? 'Fruvia Chatbot' : (isCloudConversation ? 'Cloud của tôi' : undefined))
            ?? item?.conversationName
            ?? item?.name
            ?? getMemberName(members?.[0])
            ?? ''
        ).trim();

        const avatarUrl = String(
          (isDirectConversation
            ? getMemberAvatar(otherMember)
            : undefined)
            ?? item?.conversationAvatarUrl
            ?? item?.conversation_avatar_url
            ?? item?.avatarUrl
            ?? item?.avatar_url
            ?? item?.avatar
            ?? getMemberAvatar(members?.[0])
            ?? ''
        ).trim();

        return {
          id,
          name: rawName || `Cuộc trò chuyện ${index + 1}`,
          avatarUrl: avatarUrl || undefined,
          type: isAiConversation
            ? 'AI'
            : isCloudConversation
            ? 'CLOUD'
            : conversationTypeRaw === 'GROUP'
            ? 'GROUP'
            : isDirectConversation
            ? 'PRIVATE'
            : 'OTHER',
        };
      })
          .filter((item: ForwardConversationItem | null): item is ForwardConversationItem => item !== null);
  }, [conversationId, currentUserId]);

  const loadForwardConversations = useCallback(async (keyword?: string) => {
    setFwdLoading(true);
    try {
      const response = await chatService.getConversations(0, 60, keyword?.trim() || undefined);
      setFwdConversations(extractForwardConversationItems(response));
    } catch {
      setFwdConversations([]);
    } finally {
      setFwdLoading(false);
    }
  }, [extractForwardConversationItems]);

  // Load conversations when forward modal opens
  useEffect(() => {
    if (!forwardingMsg) return;
    setFwdConversations([]);
    setFwdSearch('');
    setFwdSelected(new Set());
    void loadForwardConversations();
  }, [forwardingMsg, loadForwardConversations]);

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
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const offsetY = contentOffset.y;
    const olderEdgeOffset = Math.max(0, contentSize.height - layoutMeasurement.height - SCROLL_TOP_THRESHOLD);

    isAtLatestMessageRef.current = offsetY <= SCROLL_TOP_THRESHOLD;

    if (offsetY >= olderEdgeOffset) {
      void loadOlderMessages();
    }
  };

  const handleMessageListContentSizeChange = useCallback(() => {
    if (!pendingScrollToLatestRef.current) {
      return;
    }

    if (!isAtLatestMessageRef.current) {
      pendingScrollToLatestRef.current = false;
      pendingScrollToLatestAnimatedRef.current = false;
      return;
    }

    pendingScrollToLatestRef.current = false;
    const animated = pendingScrollToLatestAnimatedRef.current;
    pendingScrollToLatestAnimatedRef.current = false;
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  const sendTextMessagesSequentially = useCallback(async (content: string, replyToMessageId?: string) => {
    if (!conversationId) {
      return { failedParts: [] as string[] };
    }

    const segments = splitMessage(content, DEFAULT_SPLIT_MESSAGE_MAX_WORDS);
    if (segments.length === 0) {
      return { failedParts: [] as string[] };
    }

    const baseTimestamp = Date.now();
    const optimisticMessages: Message[] = segments.map((segment, index) => ({
      messageId: `temp-${baseTimestamp}-${index}`,
      content: segment,
      senderId: currentUserId ?? 'local-user',
      senderName: 'Me',
      createdAt: toLocalIsoString(new Date(baseTimestamp + index)),
    }));

    setMessages((prev) => mergeUniqueMessages(prev, optimisticMessages));
    requestScrollToLatest(true);

    const failedParts: string[] = [];
    let shouldRefresh = false;

    for (let index = 0; index < segments.length; index += 1) {
      const part = segments[index];
      const optimisticId = optimisticMessages[index].messageId;

      try {
        const response = await chatService.sendMessage(conversationId, {
          content: serializePlainTextToTiptapJson(part),
          messageType: 'TEXT',
          attachments: [],
          replyToMessageId: index === 0 ? replyToMessageId : undefined,
        });

        logChatDebug('sendMessage.response', response);

        const mappedMessage = mapAnyPayloadToUiMessage(response);
        if (mappedMessage) {
          logChatDebug('sendMessage.mapped', mappedMessage);
          setMessages((prev) => {
            const withoutTemp = prev.filter((message) => message.messageId !== optimisticId);
            return mergeUniqueMessages(withoutTemp, [mappedMessage]);
          });
        } else {
          shouldRefresh = true;
        }
      } catch (error) {
        const axiosError = error as AxiosError<{ message?: string; error?: { message?: string } }>;
        console.error('Failed to send message part via REST:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          message: axiosError.message,
        });

        failedParts.push(part);
        setMessages((prev) => prev.filter((message) => message.messageId !== optimisticId));
      }
    }

    if (shouldRefresh) {
      void loadInitialMessages(currentUserId, true);
    }

    return { failedParts };
  }, [conversationId, currentUserId, loadInitialMessages, logChatDebug, mapAnyPayloadToUiMessage, mergeUniqueMessages, requestScrollToLatest]);

  const handleSendMessage = async () => {
    if (inputText.trim() === '' || !conversationId) return;
    if (isAiConversation && isSendingAi) return;

    if (editingMessageId) {
      const nextContent = inputText.trim();
      const serializedContent = serializePlainTextToTiptapJson(nextContent);
      try {
        const response = await chatService.updateMessage(editingMessageId, serializedContent);
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
            content: serializedContent,
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

    const rawInputText = inputText.trim();
    const replyToMessageId = replyingTo?.messageId;
    setInputText('');
    setReplyingTo(null);

    try {
      if (isAiConversation) {
        const tempMessageId = `temp-${Date.now()}`;
        const now = new Date();
        const optimisticMessage: Message = {
          messageId: tempMessageId,
          content: rawInputText,
          senderId: currentUserId ?? 'local-user',
          senderName: 'Me',
          createdAt: toLocalIsoString(now),
        };

        setMessages((prev) => mergeUniqueMessages(prev, [optimisticMessage]));
        requestScrollToLatest(true);

        setIsSendingAi(true);

        const locale = (i18n.resolvedLanguage || i18n.language || 'vi').toLowerCase();
        const aiResponse = await chatService.sendAiMessage({
          content: inputText.trim(),
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
            senderName: 'Fruvia Chatbot',
            createdAt: nowIso,
          }]));
          requestScrollToLatest(true);
        }

        return;
      }

      const { failedParts } = await sendTextMessagesSequentially(rawInputText, replyToMessageId);
      if (failedParts.length > 0) {
        setInputText(failedParts.join('\n\n'));
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string; error?: { message?: string } }>;
      console.error('Failed to send message via REST:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
      setInputText(rawInputText);
    } finally {
      if (isAiConversation) {
        setIsSendingAi(false);
      }
    }
  };

  const handleInputChange = (value: string) => {
    setInputText(value);

    // Detect @mention
    const cursorPos = value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);
    if (atMatch) {
      setMentionSearchText(atMatch[1]);
      setIsMentionDropdownVisible(true);
    } else {
      setIsMentionDropdownVisible(false);
      setMentionSearchText('');
    }

    if (canUseRealtimeIndicators && currentUserId && value.trim().length > 0 && conversationId) {
      sendTyping(conversationId, currentUserId);
    }
  };

  const handleMentionSelect = (user: { userId: string; displayName: string }) => {
    // Replace @query with @displayName
    const atMatch = inputText.match(/@(\S*)$/);
    if (atMatch) {
      const beforeAt = inputText.slice(0, atMatch.index);
      const afterMention = `@${user.displayName} `;
      setInputText(beforeAt + afterMention);
    }
    setIsMentionDropdownVisible(false);
    setMentionSearchText('');
  };

  const buildPickedMediaFromUris = useCallback((selectedUris: string[]): PickedMedia[] => {
    return selectedUris.map((uri, index) => {
      const cleanUri = uri.split('?')[0];
      const decodedUri = (() => {
        try {
          return decodeURIComponent(cleanUri);
        } catch {
          return cleanUri;
        }
      })();
      const fileExtensionMatch = decodedUri.match(/\.([a-zA-Z0-9]+)$/);
      const extension = (fileExtensionMatch?.[1] || 'jpg').toLowerCase();
      const mimeType = extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : extension === 'heic'
            ? 'image/heic'
            : 'image/jpeg';

      return {
        uri,
        fileName: `image_${Date.now()}_${index + 1}.${extension}`,
        fileSize: 0,
        mimeType,
        mediaType: 'IMAGE',
      };
    });
  }, []);

  // getFileExtensionFromMimeType moved to utils/chatHelpers.ts

  const handleConfirmCustomImages = useCallback((selectedUris: string[]) => {
    const picked = buildPickedMediaFromUris(selectedUris);
    if (picked.length === 0) {
      return;
    }

    setPendingMediaList(picked);
    setIsCustomImagePickerVisible(false);
  }, [buildPickedMediaFromUris]);

  // ── Media Picker Functions ──────────────────────────────

  const handlePickImage = useCallback(async () => {
    setIsAttachMenuVisible(false);
    if (isExpoGo) {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập thư viện ảnh');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGE_SELECTION,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const picked = result.assets.slice(0, MAX_IMAGE_SELECTION).map((asset, index) => ({
        uri: asset.uri,
        fileName: asset.fileName || `image_${Date.now()}_${index + 1}.${getFileExtensionFromMimeType(asset.mimeType)}`,
        fileSize: asset.fileSize || 0,
        mimeType: asset.mimeType || 'image/jpeg',
        mediaType: 'IMAGE' as const,
        width: asset.width,
        height: asset.height,
      }));

      setPendingMediaList(picked);
      return;
    }

    setIsCustomImagePickerVisible(true);
  }, [getFileExtensionFromMimeType, isExpoGo]);

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

  // ─── Voice recording (moved to hooks) ────────────────────────────────────
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    playingVoiceId,
    togglePlayVoice: hookTogglePlayVoice,
    stopPlayback,
  } = useVoiceRecording();

  // Local-deleted helper (initialize below to populate existing ref)
  const localDeleted = useLocalDeleted();

  const startVoiceRecording = useCallback(async () => {
    if (isRecording) return;
    await startRecording();
  }, [isRecording, startRecording]);

  const stopVoiceRecording = useCallback(async (discard = false) => {
    const result = await stopRecording(discard);
    if (!result) return;

    const { uri, durationSeconds: duration, fileName, mimeType, tempId } = result;
    if (!uri) return;

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
  }, [stopRecording, currentUserId, conversationId, mergeUniqueMessages, requestScrollToLatest, mapAnyPayloadToUiMessage]);

  const togglePlayVoice = useCallback(async (item: Message) => {
    await hookTogglePlayVoice(item.content ?? null, String(item.messageId));
  }, [hookTogglePlayVoice]);

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
    const serializedCaption = caption ? serializePlainTextToTiptapJson(caption) : undefined;

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
        caption: serializedCaption,
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
          caption: serializedCaption,
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
          caption: i === 0 ? serializedCaption : undefined,
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

  const handleOpenReactionViewer = useCallback((message: Message) => {
    setReactionViewerMessage(message);
    setReactionViewerEmojiTab('all');
  }, []);

  const handleCloseReactionViewer = useCallback(() => {
    setReactionViewerMessage(null);
    setReactionViewerEmojiTab('all');
  }, []);

  const handleCopySelectedMessage = useCallback(async () => {
    if (!selectedMessage) return;
    const text = extractRichTextPlainText(selectedMessage.content || '') || selectedMessage.content || '';
    await Clipboard.setStringAsync(text);
    closeMessageActionMenu();
    Alert.alert('', 'Đã sao chép tin nhắn');
  }, [closeMessageActionMenu, selectedMessage]);

  const handleStartEditSelectedMessage = useCallback(() => {
    if (!selectedMessage || selectedMessage.isRecalled) {
      return;
    }

    setEditingMessageId(selectedMessage.messageId);
    const text = extractRichTextPlainText(selectedMessage.content || '') || selectedMessage.content || '';
    setInputText(text);
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
              setMessages((prev) =>
                prev.map((m) =>
                  String(m.messageId) === String(selectedMessage.messageId)
                    ? { ...m, isRecalled: true, messageType: 'TEXT', content: 'Tin nhắn đã được thu hồi' }
                    : m
                )
              );
            } catch (error) {
              console.error('Failed to recall message:', error);
              const axiosError = error as AxiosError<{
                message?: string;
                error?: { message?: string };
              }>;
              const backendMessage =
                axiosError.response?.data?.message ||
                axiosError.response?.data?.error?.message ||
                axiosError.message ||
                '';
              const normalizedMessage = backendMessage.toLowerCase();
              const isRecallTimeLimitError = normalizedMessage.includes('recall time limit')

              if (isRecallTimeLimitError) {
                Alert.alert('Lỗi', 'Bạn chỉ có thể thu hồi tin nhắn trong 60 phút sau khi gửi');
              } else {
                Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn');
              }
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
              await localDeleted.markDeleted(conversationId, currentUserId || 'anonymous', selectedMessage.messageId);
              locallyDeletedMessageIdsRef.current = localDeleted.getDeletedSet();
              setMessages((prev) => prev.filter((m) => String(m.messageId) !== String(selectedMessage.messageId)));
            } catch (error) {
              console.error('Failed to delete local message:', error);
              Alert.alert('Lỗi', 'Không thể xóa tin nhắn');
            }
          },
        },
      ]
    );
  }, [closeMessageActionMenu, selectedMessage, conversationId, currentUserId]);

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

  const jumpToHistoricalMessage = useCallback(async (messageId: string) => {
    const normalizedMessageId = String(messageId || '').trim();
    if (!normalizedMessageId) {
      return false;
    }

    const localTargetIndex = messages.findIndex((message) => String(message.messageId) === normalizedMessageId);
    if (localTargetIndex >= 0) {
      flatListRef.current?.scrollToIndex({ index: localTargetIndex, animated: true, viewPosition: 0.5 });
      highlightMessage(normalizedMessageId);
      return true;
    }

    if (!conversationId) {
      return false;
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

        const firstPageResponse = await chatService.getMessages(conversationId, 0, 40);
        const firstPageParsed = parsePageResult(firstPageResponse, 40);
        let fallbackMessages = sortMessages(mapChatPayloadListToUiMessages(firstPageParsed.payload));

        if (fallbackMessages.some((message) => String(message.messageId) === normalizedMessageId)) {
          return fallbackMessages;
        }

        let cursorId = fallbackMessages[fallbackMessages.length - 1]?.messageId;
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

          cursorId = fallbackMessages[fallbackMessages.length - 1]?.messageId;
        }

        return [] as Message[];
      };

      const aroundMessages = await fetchAroundCandidates();
      if (aroundMessages.length === 0) {
        Alert.alert('Thông báo', 'Không tìm thấy đoạn hội thoại chứa tin nhắn này.');
        return false;
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

      return true;
    } catch (error) {
      console.error('Failed to jump to historical message:', error);
      Alert.alert('Lỗi', 'Không thể tải đoạn hội thoại chứa tin nhắn này');
      return false;
    } finally {
      setIsJumpingToMessage(false);
    }
  }, [conversationId, highlightMessage, messages, mergeUniqueMessages, parsePageResult, sortMessages]);

  const handleJumpToPinnedMessage = useCallback(async (messageId: string) => {
    setIsPinnedListVisible(false);
    await jumpToHistoricalMessage(messageId);
  }, [jumpToHistoricalMessage]);

  const handleJumpToMessage = useCallback(async (messageId: string) => {
    const jumped = await jumpToHistoricalMessage(messageId);

    if (jumped) {
      setIsSearching(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [jumpToHistoricalMessage]);

  const handleUnpinFromPinnedList = useCallback(async (messageId: string) => {
    try {
      await chatService.unpinMessage(messageId);
      await fetchPinnedMessages();
    } catch (error) {
      console.error('Failed to unpin message from list:', error);
    }
  }, [fetchPinnedMessages]);

  
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

  // formatDateSeparator moved to utils/chatHelpers.ts

  const shouldShowDateSeparator = (current: Message, prev?: Message) => {
    if (!prev) return true;
    const currentDate = parseMessageDate(current.createdAt);
    const prevDate = parseMessageDate(prev.createdAt);
    if (!currentDate || !prevDate) return false;
    return currentDate.toDateString() !== prevDate.toDateString()
      || (currentDate.getTime() - prevDate.getTime() > 15 * 60 * 1000);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    if (isSystemMessage(item)) {
      return <SystemMessageBubble content={getSystemMessageContent(item)} />;
    }

    const isCurrentUserMessage = currentUserId !== null && String(item.senderId) === String(currentUserId);
    const newerMessage = index > 0 ? messages[index - 1] : undefined;
    const olderMessage = index < messages.length - 1 ? messages[index + 1] : undefined;
    const isLastInMessageBlock = shouldShowMessageTimestamp(item, newerMessage);
    const showAvatar = !isCurrentUserMessage && isLastInMessageBlock;
    const showSenderName = isGroupConversation && isFirstInMessageBlock(item, olderMessage);
    const senderDisplayName = (item.senderName || '').trim() || t('chat.unknown_user', 'Người dùng');
    const senderAvatarSource = showAvatar
      ? getAvatarSource(item.senderAvatarUrl || (isGroupConversation ? undefined : conversationAvatarUrl))
      : null;
    const showTimestamp = shouldShowMessageTimestamp(item, newerMessage);
    const timeLabel = formatMessageTime(item.createdAt);
    const reactionSummary = buildReactionSummary(item.reactions);
    const showDateSep = shouldShowDateSeparator(item, olderMessage);
    const dateSepLabel = showDateSep ? formatDateSeparator(item.createdAt) : null;

    const msgType = (item.messageType || 'TEXT').toUpperCase();
    const isImageMsg = msgType === 'IMAGE';
    const isImageGroupMsg = msgType === 'IMAGE_GROUP';
    const isVideoMsg = msgType === 'VIDEO';
    const isVoiceMsg = msgType === 'VOICE';
    const isStickerMsg = msgType === 'STICKER';
    const isFileMsg = msgType === 'FILE' || msgType === 'MEDIA';
    const isMediaMsg = isImageMsg || isImageGroupMsg || isVideoMsg || isFileMsg || isVoiceMsg;
    const plainTextContent = extractRichTextPlainText(item.content || '').trim();
    const isCompactBubble = msgType === 'TEXT' && plainTextContent.length > 0 && !plainTextContent.includes('\n') && plainTextContent.length <= 80;

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

      // Reply snippet block (presentational component)
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
          <ReplySnippet
            senderLabel={senderLabel}
            snippet={snippet}
            onPress={scrollToReplied}
            isCurrentUserMessage={isCurrentUserMessage}
            styles={styles}
            colors={colors}
          />
        );
      })() : null;

      // Forwarded banner (presentational component)
      const forwardedBanner = (item.forwardedFromSenderName && !item.isRecalled) ? (
        <ForwardedBanner forwardedFromSenderName={item.forwardedFromSenderName} isCurrentUserMessage={isCurrentUserMessage} styles={styles} />
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
                <ExpandableText
                  text={item.caption}
                  previewWords={120}
                  previewLines={8}
                  containerStyle={{ marginTop: 6 }}
                  textStyle={[styles.messageText, isCurrentUserMessage ? styles.userMessageText : { color: colors.text }]}
                  actionTextStyle={isCurrentUserMessage ? styles.userEditedLabel : { color: colors.textSecondary }}
                />
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
              <ExpandableText
                text={item.caption}
                previewWords={120}
                previewLines={8}
                containerStyle={{ marginTop: 6 }}
                textStyle={[styles.messageText, isCurrentUserMessage ? styles.userMessageText : { color: colors.text }]}
                actionTextStyle={isCurrentUserMessage ? styles.userEditedLabel : { color: colors.textSecondary }}
              />
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
                <ExpandableText
                  text={item.caption}
                  previewWords={120}
                  previewLines={8}
                  containerStyle={{ marginTop: 6 }}
                  textStyle={[styles.messageText, isCurrentUserMessage ? styles.userMessageText : { color: colors.text }]}
                  actionTextStyle={isCurrentUserMessage ? styles.userEditedLabel : { color: colors.textSecondary }}
                />
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

      // POLL render
      if ((item.messageType || '').toUpperCase() === 'POLL') {
        let pollData: any = null;
        try { pollData = item.poll || JSON.parse(item.content || '{}'); } catch { pollData = item.poll || null; }
        return (
          <>
            {replyBlock}
            {forwardedBanner}
            {pollData ? (
              <PollCard
                poll={pollData}
                currentUserId={currentUserId ?? undefined}
                conversationId={conversationId}
              />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: colors.card, borderRadius: 12, marginVertical: 4 }}>
                <Ionicons name="stats-chart-outline" size={18} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, marginLeft: 6, fontSize: 13 }}>📊 Cuộc thăm dò ý kiến</Text>
              </View>
            )}
          </>
        );
      }

      // CALL render
      if (msgType === 'CALL' || msgType === 'CALL_HISTORY' || msgType === 'CALL_MISSED' || msgType === 'CALL_REJECTED' || msgType === 'CALL_ENDED') {
        const rawContent = String(item.content || '').trim();
        const parsedDuration = rawContent && !Number.isNaN(Number(rawContent)) ? Number(rawContent) : 0;
        let callData: any = {};
        try { callData = rawContent.startsWith('{') ? JSON.parse(rawContent) : {}; } catch { callData = {}; }
        const isMissed = msgType === 'CALL_MISSED';
        const isRejected = msgType === 'CALL_REJECTED';
        const isEnded = msgType === 'CALL_ENDED';
        const shouldTreatAsMissed = isMissed || (isEnded && parsedDuration <= 0);
        const durationSeconds = isEnded ? (parsedDuration > 0 ? parsedDuration : 0) : (callData.durationSeconds ?? callData.duration ?? 0);
        return (
          <>
            {replyBlock}
            {forwardedBanner}
            <CallHistoryCard
              callType={callData.callType ?? 'VIDEO'}
              durationSeconds={durationSeconds}
              status={shouldTreatAsMissed ? 'MISSED' : isRejected ? 'REJECTED' : isEnded ? 'ENDED' : (callData.status || 'ENDED')}
              isCaller={item.senderId === currentUserId}
            />
          </>
        );
      }

      // CALL_GROUP_START render
      if (msgType === 'CALL_GROUP_START') {
        const senderName = item.senderName || 'Thành viên';
        return (
          <View style={{ alignItems: 'center', marginVertical: 8 }}>
            <GroupCallCard
              senderName={senderName}
              onJoin={() => {
                const joinSignal = {
                  type: 'CALL_GROUP_JOIN',
                  receiverId: conversationId,
                  callId: item.messageId || String(Date.now()),
                  callerName: currentUserId || 'Thành viên',
                  conversationId,
                };
                if (sendCallSignal) {
                  sendCallSignal(joinSignal);
                  Alert.alert('Đã tham gia', 'Bạn đã tham gia cuộc gọi nhóm!');
                }
              }}
            />
          </View>
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
      // Extract URLs for link preview
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
      const detectedUrls = item.content.match(urlRegex) || [];
      const linkPreviewUrls = detectedUrls.slice(0, 2); // Max 2 link previews

      return (
        <>
          {replyBlock}
          {forwardedBanner}
          <View style={styles.richTextBubbleContent}>
            <RichTextRenderer
              value={item.content}
              paragraphSpacing={6}
              customStyles={{
                container: styles.richTextContainer,
                paragraph: styles.richTextParagraph,
                text: [styles.messageText, isCurrentUserMessage ? styles.userMessageText : { color: colors.text }],
                bold: { fontWeight: '700' },
                italic: { fontStyle: 'italic' },
                underline: { textDecorationLine: 'underline' },
              }}
            />
          </View>
          {linkPreviewUrls.map((url: string, i: number) => (
            <LinkPreviewCard key={`link-${i}`} url={url} />
          ))}
          {item.isEdited ? <Text style={[styles.editedLabel, isCurrentUserMessage ? styles.userEditedLabel : { color: colors.textSecondary }]}>{t('chat.edited', 'Đã chỉnh sửa')}</Text> : null}
        </>
      );
    };

    const mediaContent = renderMediaContent();

    // STICKER: render without bubble wrapper
    if (isStickerMsg) {
      return (
        <View style={{ alignItems: 'center', marginVertical: 6, paddingHorizontal: 40 }}>
          {dateSepLabel ? (
            <View style={styles.dateSeparator}>
              <Text style={styles.dateSeparatorText}>{dateSepLabel}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => openMessageActionMenu(item)}
            delayLongPress={220}
          >
            <Image
              source={{ uri: item.content }}
              style={{ width: 120, height: 120 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <MessageItem
        item={item}
        index={index}
        dateSepLabel={dateSepLabel}
        isCurrentUserMessage={isCurrentUserMessage}
        showAvatar={showAvatar}
        showSenderName={showSenderName}
        isLastInBlock={isLastInMessageBlock}
        senderDisplayName={senderDisplayName}
        senderAvatarSource={senderAvatarSource}
        mediaContent={mediaContent}
        reactionSummary={reactionSummary}
        showTimestamp={showTimestamp}
        timeLabel={timeLabel}
        highlighted={highlightedMessageId === String(item.messageId)}
        onLongPress={() => openMessageActionMenu(item)}
        isCompactBubble={isCompactBubble}
        colors={colors}
        styles={styles as any}
        playingVoiceId={playingVoiceId}
      />
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
        <ChatHeader>
          <View style={styles.header}>
            {!isSearching ? (
              <>
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
                  <TouchableOpacity style={styles.headerIcon} onPress={toggleSearchMode}>
                    <Ionicons name="search-outline" size={26} color="#FFFFFF" />
                  </TouchableOpacity>
                  {showCallActions ? (
                    <>
                      <TouchableOpacity style={styles.headerIcon}>
                        <Ionicons name="call-outline" size={27} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.headerIcon}
                        onPress={() => {
                          if (isGroupConversation) {
                            // Start group call
                            const callId = String(Date.now());
                            if (sendCallSignal) {
                              sendCallSignal({
                                type: 'CALL_GROUP_START',
                                receiverId: conversationId,
                                callId,
                                callerName: 'Bạn',
                                conversationId,
                              });
                              Alert.alert('Đã bắt đầu', 'Cuộc gọi video nhóm đã được bắt đầu!');
                            }
                          } else {
                            const peerName = conversationDisplayName;
                            const peerAvatar = conversationAvatarUrl;
                            webrtcService.startCall(
                              currentUserId!,
                              partnerId || '',
                              peerName || 'Unknown',
                              peerAvatar,
                              conversationId,
                              'Bạn',
                              undefined
                            );
                          }
                        }}
                      >
                        <Ionicons name={isGroupConversation ? 'people' : 'videocam-outline'} size={27} color="#FFFFFF" />
                      </TouchableOpacity>
                    </>
                  ) : null}
                  <TouchableOpacity style={styles.headerIcon} onPress={() => { setIsInfoPanelVisible(true); }}>
                    <Ionicons name="list-outline" size={30} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.searchBarHeader}>
                <TouchableOpacity onPress={closeSearchMode} hitSlop={10}>
                  <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
                </TouchableOpacity>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm tin nhắn..."
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  selectionColor="#FFF"
                  returnKeyType="search"
                  clearButtonMode="never"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setIsSearchingLoading(false); }} hitSlop={10}>
                    <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ChatHeader>

        {/* Search Results Overlay */}
        {isSearching && searchQuery.length > 0 && (
          <View style={[styles.searchResultsOverlay, { backgroundColor: colors.background }]}>
            <View style={[styles.searchResultsShell, { backgroundColor: colors.card }]}>
              <View style={[styles.searchResultsHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.searchResultsHeaderText}>
                  <Text style={[styles.searchResultsTitle, { color: colors.text }]}>Tìm trong lịch sử chat</Text>
                  <Text style={[styles.searchResultsMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {searchQuery.trim() ? `"${searchQuery.trim()}"` : 'Nhập nội dung để bắt đầu tìm'}
                  </Text>
                </View>
                {searchResults.length > 0 && !isSearchingLoading ? (
                  <View style={[styles.searchResultsCountPill, { backgroundColor: colors.border }]}>
                    <Text style={[styles.searchResultsCountText, { color: colors.text }]}>{searchResults.length}</Text>
                  </View>
                ) : null}
              </View>

              {!searchQuery.trim() ? (
                <View style={styles.searchEmptyState}>
                  <Ionicons name="search-outline" size={28} color={colors.textSecondary} />
                  <Text style={[styles.searchEmptyTitle, { color: colors.text }]}>Tìm tin nhắn trong quá khứ</Text>
                  <Text style={[styles.searchEmptySubtitle, { color: colors.textSecondary }]}>Gõ vài từ khóa để tìm lại đoạn chat cũ và chạm vào kết quả để cuộn tới đúng vị trí.</Text>
                </View>
              ) : isSearchingLoading ? (
                <View style={styles.searchLoadingState}>
                  <ActivityIndicator color="#2F87F2" />
                  <Text style={[styles.searchLoadingText, { color: colors.textSecondary }]}>Đang tìm trong lịch sử...</Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.searchEmptyState}>
                  <Ionicons name="sad-outline" size={28} color={colors.textSecondary} />
                  <Text style={[styles.searchEmptyTitle, { color: colors.text }]}>Không tìm thấy kết quả</Text>
                  <Text style={[styles.searchEmptySubtitle, { color: colors.textSecondary }]}>Thử đổi từ khóa khác hoặc tìm bằng một phần nội dung ngắn hơn.</Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.messageId}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.searchResultsList}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity 
                      style={[
                        styles.searchResultItem,
                        { borderBottomColor: colors.border },
                        isJumpingToMessage ? styles.searchResultItemDisabled : null,
                        index === 0 ? styles.searchResultItemFirst : null,
                      ]}
                      onPress={() => { void handleJumpToMessage(item.messageId); }}
                      disabled={isJumpingToMessage}
                      activeOpacity={0.75}
                    >
                      <View style={styles.searchResultHeader}>
                        <Text style={[styles.searchResultSender, { color: colors.text }]} numberOfLines={1}>{item.senderName}</Text>
                        <Text style={[styles.searchResultTime, { color: colors.textSecondary }]}>
                          {parseMessageDate(item.createdAt)?.toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={[styles.searchResultContent, { color: colors.textSecondary }]} numberOfLines={2}>
                        {getDisplayMessageContent(item)}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        )}

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
        <MessageList
          ref={flatListRef as any}
          messages={messages}
          renderItem={renderMessage as any}
          contentContainerStyle={styles.messagesList}
          inverted={true}
          scrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={renderOlderMessagesLoading}
          onScroll={handleMessageListScroll}
          onContentSizeChange={handleMessageListContentSizeChange}
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          onScrollToIndexFailed={(info: any) => {
            flatListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
        />

        {/* Input Area */}
        <MessageInput>
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
                    {isUploading ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Ionicons
                        name="send"
                        size={26}
                        color={COLORS.primary}
                      />
                    )}
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
        </MessageInput>

        {/* Mention Dropdown */}
        <MentionDropdown
          visible={isMentionDropdownVisible}
          conversationId={conversationId}
          searchText={mentionSearchText}
          onSelect={handleMentionSelect}
          onClose={() => { setIsMentionDropdownVisible(false); setMentionSearchText(''); }}
        />

        <Modal
          visible={isMessageActionVisible}
          transparent
          animationType="slide"
          onRequestClose={closeMessageActionMenu}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeMessageActionMenu}>
            <Pressable style={[styles.actionSheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
              {/* Emoji reaction bar */}
              <ReactionPicker emojis={REACTION_EMOJIS as any} onSelect={(emoji: string) => { void handleReactWithEmoji(emoji); }} style={styles.emojiRow} />

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

                {isSelectedMessageMine && !selectedMessage?.isRecalled && (Date.now() - getMessageMillis(selectedMessage?.createdAt) < 60 * 60 * 1000) ? (
                  <TouchableOpacity style={styles.actionGridItem} onPress={() => { void handleRecallSelectedMessage(); }}>
                    <View style={[styles.actionGridIcon, { backgroundColor: '#FFF3EB' }]}>
                      <Ionicons name="refresh" size={22} color="#F0853A" />
                    </View>
                    <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.recall', 'Thu hồi')}</Text>
                  </TouchableOpacity>
                ) : null}

                {isSelectedMessageMine && !selectedMessage?.isRecalled && (Date.now() - getMessageMillis(selectedMessage?.createdAt) < 60 * 60 * 1000) ? (
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
          visible={Boolean(reactionViewerMessage)}
          transparent
          animationType="fade"
          onRequestClose={handleCloseReactionViewer}
        >
          <Pressable style={styles.reactionViewerBackdrop} onPress={handleCloseReactionViewer}>
            <Pressable style={[styles.reactionViewerSheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.reactionViewerHandle} />

              <View style={[styles.reactionViewerHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.reactionViewerTitle, { color: colors.text }]}>Người đã thả reaction</Text>
                <TouchableOpacity onPress={handleCloseReactionViewer} style={styles.clearButton}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {(() => {
                const targetMessage = reactionViewerMessage;
                const allReactions = targetMessage?.reactions || [];
                const counts = new Map<string, number>();
                allReactions.forEach((reaction) => {
                  const emoji = reaction.emoji || '👍';
                  counts.set(emoji, (counts.get(emoji) || 0) + 1);
                });

                const filtered = reactionViewerEmojiTab === 'all'
                  ? allReactions
                  : allReactions.filter((reaction) => reaction.emoji === reactionViewerEmojiTab);

                const groupedByUser = filtered.reduce<Record<string, { userId: string; name: string; avatar?: string; emojis: string[]; total: number }>>((acc, reaction) => {
                  const userId = String(reaction.userId || '');
                  if (!userId) return acc;

                  if (!acc[userId]) {
                    acc[userId] = {
                      userId,
                      name: reaction.userName || t('chat.unknown_user', 'Người dùng'),
                      avatar: reaction.userAvatar,
                      emojis: [],
                      total: 0,
                    };
                  }

                  acc[userId].emojis.push(reaction.emoji || '👍');
                  acc[userId].total += 1;
                  return acc;
                }, {});

                return (
                  <View style={styles.reactionViewerList}>
                    <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                      <View style={[styles.reactionViewerTabs, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity
                          onPress={() => setReactionViewerEmojiTab('all')}
                          style={[styles.reactionViewerTab, reactionViewerEmojiTab === 'all' && styles.reactionViewerTabActive]}
                        >
                          <Text style={[styles.reactionViewerTabText, { color: colors.text }]}>Tất cả</Text>
                          <Text style={[styles.reactionViewerCount, { color: colors.textSecondary }]}>{allReactions.length}</Text>
                        </TouchableOpacity>
                        {Array.from(counts.entries())
                          .sort((left, right) => right[1] - left[1])
                          .map(([emoji, count]) => (
                            <TouchableOpacity
                              key={emoji}
                              onPress={() => setReactionViewerEmojiTab(emoji)}
                              style={[styles.reactionViewerTab, reactionViewerEmojiTab === emoji && styles.reactionViewerTabActive]}
                            >
                              <Text style={styles.reactionViewerEmoji}>{emoji}</Text>
                              <Text style={[styles.reactionViewerCount, { color: colors.textSecondary }]}>{count}</Text>
                            </TouchableOpacity>
                          ))}
                      </View>

                      {Object.values(groupedByUser).length > 0 ? (
                        Object.values(groupedByUser).map((user) => (
                          <View key={user.userId} style={[styles.reactionViewerItem, { borderBottomColor: colors.border }]}>
                            <Image source={getAvatarSource(user.avatar)} style={styles.reactionViewerAvatar} />
                            <View style={styles.reactionViewerItemMain}>
                              <View style={styles.reactionViewerNameRow}>
                                <Text style={[styles.reactionViewerName, { color: colors.text }]} numberOfLines={1}>{user.name}</Text>
                                <Text style={[styles.reactionViewerCount, { color: colors.textSecondary }]}>{user.total}</Text>
                              </View>
                              <View style={styles.reactionViewerMeta}>
                                {Array.from(new Set(user.emojis)).map((emoji) => (
                                  <Text key={`${user.userId}-${emoji}`} style={[styles.reactionViewerEmoji, { color: colors.text }]}>{emoji}</Text>
                                ))}
                              </View>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 24 }]}>Chưa có reaction nào</Text>
                      )}
                    </ScrollView>
                  </View>
                );
              })()}
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
              <PinnedListContent
                pinnedMessages={pinnedMessages}
                onClose={() => setIsPinnedListVisible(false)}
                onJump={handleJumpToPinnedMessage}
                onUnpin={(msgId: string) => { void handleUnpinFromPinnedList(msgId); }}
                colors={colors}
                styles={styles}
                t={t}
              />
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
              <AttachMenuContent
                onPickImage={handlePickImage}
                onPickVideo={handlePickVideo}
                onPickFile={handlePickFile}
                onTakePhoto={handleTakePhoto}
                onShareContact={() => { setIsAttachMenuVisible(false); setIsShareContactVisible(true); }}
                onCreatePoll={() => { setIsAttachMenuVisible(false); setIsPollModalVisible(true); }}
                colors={colors}
                styles={styles}
              />
            </Pressable>
          </Pressable>
        </Modal>

        {/* Poll Create Modal */}
        <PollCreateModal
          visible={isPollModalVisible}
          onClose={() => setIsPollModalVisible(false)}
          onSubmit={handlePollSubmit}
        />

        <CustomImagePicker
          isVisible={isCustomImagePickerVisible}
          onClose={() => setIsCustomImagePickerVisible(false)}
          onConfirm={handleConfirmCustomImages}
          maxSelection={MAX_IMAGE_SELECTION}
        />

        {/* Forward Message Modal */}
        <Modal
          visible={Boolean(forwardingMsg)}
          transparent
          animationType="slide"
          onRequestClose={() => { setForwardingMsg(null); setFwdSelected(new Set()); setFwdSearch(''); }}
        >
          <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
            <View style={[styles.fwdSheet, { backgroundColor: colors.card }]}> 
              <ForwardModalContent
                forwardingMsg={forwardingMsg}
                filteredFwdConversations={filteredFwdConversations}
                fwdLoading={fwdLoading}
                fwdSelected={fwdSelected}
                onToggleSelect={(id: string) => {
                  setFwdSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  });
                }}
                onLoadConversations={(q: string) => { void loadForwardConversations(q); }}
                fwdSearch={fwdSearch}
                setFwdSearch={setFwdSearch}
                onSend={async () => {
                  if (!forwardingMsg || fwdSelected.size === 0) return;
                  setFwdSending(true);
                  const sendPromises = Array.from(fwdSelected).map((cId) =>
                    chatService.sendMessage(cId, buildForwardPayload(forwardingMsg)).catch(() => { })
                  );
                  await Promise.all(sendPromises);
                  setFwdSending(false);
                  setForwardingMsg(null);
                  setFwdSelected(new Set());
                  setFwdSearch('');
                  Alert.alert('', `Đã chuyển tiếp đến ${sendPromises.length} cuộc trò chuyện`);
                }}
                fwdSending={fwdSending}
                getForwardAttachmentUrls={getForwardAttachmentUrls}
                getForwardPreviewText={getForwardPreviewText}
                videoThumbnailsByMessageId={videoThumbnailsByMessageId}
                colors={colors}
                styles={styles}
                t={t}
                onClose={() => { setForwardingMsg(null); setFwdSelected(new Set()); setFwdSearch(''); }}
              />
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
              <ShareContactContent
                scFriends={scFriends}
                scLoading={scLoading}
                scSelected={scSelected}
                setScSelected={setScSelected}
                scSearch={scSearch}
                setScSearch={setScSearch}
                onSend={async () => {
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
                scSending={scSending}
                scIncludePhone={scIncludePhone}
                setScIncludePhone={setScIncludePhone}
                colors={colors}
                styles={styles}
                t={t}
                onClose={() => { setIsShareContactVisible(false); setScSelected(new Set()); setScSearch(''); }}
              />
            </View>
          </View>
        </Modal>

        <MemberListModal
          visible={isMemberListVisible}
          members={infoMembers}
          currentUserId={currentUserId}
          conversationName={conversationDisplayName}
          onClose={() => setIsMemberListVisible(false)}
          onAddMemberPress={() => {
            setIsMemberListVisible(false);
            setIsInfoPanelVisible(true);
          }}
          onSearchPress={() => Alert.alert('Tìm thành viên', 'Chức năng đang phát triển')}
          onMemberMenuPress={(member) => {
            const memberName = String(member.displayName ?? member.userName ?? member.fullName ?? 'Thành viên');
            Alert.alert(memberName, 'Chức năng đang phát triển');
          }}
        />

        {/* Fullscreen Image Preview */}
        <MediaViewer visible={!!fullscreenImageUrl} onClose={() => setFullscreenImageUrl(null)}>
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
        </MediaViewer>

        {/* Fullscreen Video Preview */}
        <MediaViewer visible={!!fullscreenVideoUrl} onClose={() => setFullscreenVideoUrl(null)}>
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
        </MediaViewer>

        
        {/* ── Chat Info Panel ──────────────────────────────────────────────── */}

        <ChatInfoPanel

          visible={isInfoPanelVisible}

          onClose={() => setIsInfoPanelVisible(false)}

          conversationId={conversationId}

          currentUserId={currentUserId}

          conversationDisplayName={conversationDisplayName}

          conversationAvatarUrl={conversationAvatarUrl}

          isAiConversation={isAiConversation}

          isCloudConversation={isCloudConversation}

          isGroupConversation={isGroupConversation}

          messages={messages}

          onNameUpdated={(name) => setConversationDisplayName(name)}

          onAvatarUpdated={(url) => setConversationAvatarUrl(url)}

          onChatCleared={() => setMessages([])}

          onGroupLeft={() => router.back()}

          onJumpToPinnedMessage={handleJumpToPinnedMessage}

        />


        <CallOverlay currentUserId={currentUserId || ''} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
