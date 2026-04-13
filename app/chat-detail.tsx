import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useChatSocket } from '@/hooks/useChatSocket';
import { chatService } from '@/services/chatService';
import { getAvatarSource } from '@/services/mediaUtils';
import { Ionicons } from '@expo/vector-icons';
import type { AxiosError } from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
  const flatListRef = useRef<FlatList>(null);
  const appStateRef = useRef(AppState.currentState);
  const loadingOlderRef = useRef(false);
  const shouldScrollToLatestRef = useRef(false);
  const peerAvatarSource = useMemo(() => getAvatarSource(avatar), [avatar]);
  const normalizedName = String(name ?? '').trim().toLowerCase();
  const normalizedType = String(type ?? '').trim().toUpperCase();
  const isAiConversation = normalizedType === 'AI' || normalizedName === 'fruvia chat ai' || normalizedName === 'fruvia ai';
  const isCloudConversation = normalizedType === 'CLOUD' || normalizedName === 'cloud của tôi';
  const isPrivateConversation = normalizedType === 'PRIVATE' || normalizedType === 'DIRECT';
  const showCallActions = !isCloudConversation && !isAiConversation;

  const canUseRealtimeIndicators = !isAiConversation && !isCloudConversation;
  const canUseMessageInteractions = isCloudConversation || isPrivateConversation;

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
    if (raw) {
      const isoTimeMatch = raw.match(/T(\d{2}):(\d{2})/);
      if (isoTimeMatch) {
        return `${isoTimeMatch[1]}:${isoTimeMatch[2]}`;
      }

      const parsedDate = new Date(raw);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      }
    }

    return new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
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
            // Keep temp if no server message has the same content from the same sender
            return !nextMessages.some(
              (s) => String(s.senderId) === String(m.senderId) && s.content === m.content
            );
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

  const handleStartEditSelectedMessage = useCallback(() => {
    if (!selectedMessage || selectedMessage.isRecalled) {
      return;
    }

    setEditingMessageId(selectedMessage.messageId);
    setInputText(selectedMessage.content || '');
    closeMessageActionMenu();
  }, [closeMessageActionMenu, selectedMessage]);

  const handleRecallSelectedMessage = useCallback(async () => {
    if (!selectedMessage) {
      return;
    }

    try {
      await chatService.recallMessage(selectedMessage.messageId);
      closeMessageActionMenu();
      await loadInitialMessages(currentUserId, true);
    } catch (error) {
      console.error('Failed to recall message:', error);
      closeMessageActionMenu();
    }
  }, [closeMessageActionMenu, currentUserId, loadInitialMessages, selectedMessage]);

  const handleDeleteSelectedMessageLocal = useCallback(async () => {
    if (!selectedMessage) {
      return;
    }

    try {
      await chatService.deleteMessageLocal(selectedMessage.messageId);
      setMessages((prev) => prev.filter((message) => String(message.messageId) !== String(selectedMessage.messageId)));
      closeMessageActionMenu();
    } catch (error) {
      console.error('Failed to delete local message:', error);
      closeMessageActionMenu();
    }
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
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (isToday) return `${time} Hôm nay`;
  if (isYesterday) return `${time} Hôm qua`;
  return `${time} ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
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
            style={[styles.messageBubble, styles.userBubble]}
          >
            {item.isRecalled ? (
              <Text style={[styles.recalledText, styles.userRecalledText]}>{t('chat.recalled', 'Tin nhắn đã được thu hồi')}</Text>
            ) : (
              <>
                <Text style={[styles.messageText, styles.userMessageText]}>{displayContent}</Text>
                {item.isEdited ? <Text style={[styles.editedLabel, styles.userEditedLabel]}>{t('chat.edited', 'Đã chỉnh sửa')}</Text> : null}
              </>
            )}
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
              style={[styles.messageBubble, styles.otherBubble, { backgroundColor: colors.card }]}
            >
              {item.isRecalled ? (
                <Text style={[styles.recalledText, { color: colors.textSecondary }]}>{t('chat.recalled', 'Tin nhắn đã được thu hồi')}</Text>
              ) : (
                <>
                  <Text style={[styles.messageText, { color: colors.text }]}>{displayContent}</Text>
                  {item.isEdited ? <Text style={[styles.editedLabel, { color: colors.textSecondary }]}>{t('chat.edited', 'Đã chỉnh sửa')}</Text> : null}
                </>
              )}
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

        <View style={styles.composerRow}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="happy-outline" size={30} color="#7B808A" />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: colors.text, maxHeight: 100 }]}
            placeholder={t('chat.send_message', 'Tin nhắn')}
            placeholderTextColor="#5BA8D9"
            value={inputText}
            onChangeText={handleInputChange}
            editable={!isAiConversation || !isSendingAi}
            multiline
          />
          <TouchableOpacity style={styles.bottomActionButton}>
            <Ionicons name="ellipsis-horizontal" size={26} color="#7B808A" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomActionButton}>
            <Ionicons name="mic-outline" size={26} color="#7B808A" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomActionButton}
            onPress={inputText.trim() ? handleSendMessage : undefined}
            disabled={!inputText.trim() || (isAiConversation && isSendingAi)}
          >
            <Ionicons
              name={editingMessageId ? 'checkmark' : (isAiConversation && isSendingAi ? 'time-outline' : (inputText.trim() ? 'send' : 'image-outline'))}
              size={26}
              color={inputText.trim() && !(isAiConversation && isSendingAi) ? COLORS.primary : '#7B808A'}
            />
          </TouchableOpacity>
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
              <TouchableOpacity style={styles.actionGridItem} onPress={closeMessageActionMenu}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#EBF0FF' }]}>
                  <Ionicons name="arrow-undo" size={22} color="#5B7FFF" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.reply', 'Trả lời')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionGridItem} onPress={closeMessageActionMenu}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#EBF0FF' }]}>
                  <Ionicons name="arrow-redo" size={22} color="#5B7FFF" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.forward', 'Chuyển tiếp')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionGridItem} onPress={closeMessageActionMenu}>
                <View style={[styles.actionGridIcon, { backgroundColor: '#EBF0FF' }]}>
                  <Ionicons name="copy-outline" size={22} color="#5B7FFF" />
                </View>
                <Text style={[styles.actionGridLabel, { color: colors.text }]}>{t('chat.menu.copy', 'Sao chép')}</Text>
              </TouchableOpacity>

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
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#8BC34A',
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
});
