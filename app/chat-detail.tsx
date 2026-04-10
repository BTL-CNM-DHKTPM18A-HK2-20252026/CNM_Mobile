import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useChatSocket } from '@/hooks/useChatSocket';
import { chatService } from '@/services/chatService';
import { Ionicons } from '@expo/vector-icons';
import type { AxiosError } from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
} from '../services/chatMessageAdapter';

interface Message {
  messageId: string;
  content: string;
  senderId: string;
  createdAt: string;
  senderName?: string;
}

interface MessagePageResponse {
  content?: unknown[];
  last?: boolean;
  totalPages?: number;
  number?: number;
}

const PAGE_SIZE = 10;
const SCROLL_TOP_THRESHOLD = 48;
const DEBUG_CHAT_MESSAGES = __DEV__;

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
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const appStateRef = useRef(AppState.currentState);
  const loadingOlderRef = useRef(false);
  const shouldScrollToLatestRef = useRef(false);

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

  const { isConnected, sendTyping, sendReadReceipt } = useChatSocket({
    conversationId: id,
    brokerURL: BROKER_URL,
    onMessage: (event) => {
      const mappedMessage = mapChatPayloadToUiMessage(event);
      if (!mappedMessage) {
        return;
      }

      appendOrUpdateMessage(mappedMessage);
    },
    onTyping: (event) => {
      if (!currentUserId) {
        return;
      }

      const isOtherUser = String(event.userId) !== String(currentUserId);
      const typingValue = event.isTyping ?? true;
      setIsTyping(isOtherUser && typingValue);
    },
    onReadReceipt: (event) => {
      if (!currentUserId) {
        return;
      }

      const isFromOtherUser = String(event.userId) !== String(currentUserId);
      if (isFromOtherUser) {
        // Placeholder: update read status in UI model when app has read indicator.
      }
    },
  });

  const loadInitialMessages = useCallback(async (uid?: string | null, silent = false) => {
    try {
      const response = await chatService.getMessages(id, 0, PAGE_SIZE);
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
          const olderResponse = await chatService.getMessagesBefore(id, cursorId, remainingSlots);
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
        setMessages((prev) => mergeUniqueMessages(prev, nextMessages));
      } else {
        setMessages(nextMessages);
        setHasMoreOlder(nextHasMoreOlder);
        shouldScrollToLatestRef.current = true;
      }

      const lastMessage = nextMessages[nextMessages.length - 1];
      if (uid && lastMessage?.messageId) {
        sendReadReceipt(id, uid, lastMessage.messageId);
      }
    } catch (error) {
      if (!silent) {
        console.error('Failed to load messages:', error);
      }
    }
  }, [id, logChatDebug, mergeUniqueMessages, parsePageResult, sendReadReceipt, sortMessages]);

  useEffect(() => {
    const initialize = async () => {
      const uid = await SecureStore.getItemAsync('user_id');
      setCurrentUserId(uid);
      await loadInitialMessages(uid);
    };
    initialize();
  }, [id, loadInitialMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!id || !hasMoreOlder || isLoadingOlder || loadingOlderRef.current) {
      return;
    }

    const oldestLoadedMessageId = messages[0]?.messageId;
    if (!oldestLoadedMessageId) {
      return;
    }

    loadingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      const response = await chatService.getMessagesBefore(id, oldestLoadedMessageId, PAGE_SIZE);
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
  }, [hasMoreOlder, id, isLoadingOlder, logChatDebug, mergeUniqueMessages, messages, parsePageResult, sortMessages]);

  useEffect(() => {
    if (shouldScrollToLatestRef.current && messages.length > 0) {
      shouldScrollToLatestRef.current = false;
      scrollToLatest(false);
    }
  }, [messages.length, scrollToLatest]);

  useEffect(() => {
    if (!id || !currentUserId) {
      return;
    }

    const intervalId = setInterval(() => {
      void loadInitialMessages(currentUserId, true);
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [id, currentUserId, loadInitialMessages]);

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
    if (inputText.trim() === '') return;

    const messageContent = inputText.trim();
    setInputText('');

    try {
      const response = await chatService.sendMessage(id, {
        content: messageContent,
        messageType: 'TEXT',
        attachments: [],
      });

      logChatDebug('sendMessage.response', response);

      const mappedMessage = mapChatPayloadToUiMessage(response);
      if (mappedMessage) {
        logChatDebug('sendMessage.mapped', mappedMessage);
        appendOrUpdateMessage(mappedMessage);
        requestScrollToLatest(true);
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string; error?: { message?: string } }>;
      console.error('Failed to send message via REST:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
      setInputText(messageContent);
    }
  };

  const handleInputChange = (value: string) => {
    setInputText(value);

    if (currentUserId && value.trim().length > 0) {
      sendTyping(id, currentUserId);
    }
  };

  const renderOlderMessagesLoading = () => {
    if (!isLoadingOlder && !hasMoreOlder) {
      return null;
    }

    return (
      <TouchableOpacity
        style={styles.olderLoadingContainer}
        onPress={() => { void loadOlderMessages(); }}
        disabled={isLoadingOlder}
        activeOpacity={0.8}
      >
        {isLoadingOlder ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Ionicons name="refresh" size={16} color={COLORS.primary} />
        )}
        <Text style={[styles.olderLoadingText, { color: colors.textSecondary }]}>Đang tải tin cũ...</Text>
      </TouchableOpacity>
    );
  };

const renderMessage = ({ item }: { item: Message }) => {
    const isCurrentUserMessage = currentUserId !== null && String(item.senderId) === String(currentUserId);
    return (
      <View style={[
        styles.messageContainer,
        isCurrentUserMessage ? styles.userMessage : styles.otherMessage,
      ]}>
        <View style={[styles.messageWrapper, isCurrentUserMessage ? styles.userMessageWrapper : styles.otherMessageWrapper]}>
          {!isCurrentUserMessage && (
            <Text style={[styles.senderName, { color: colors.textSecondary }]}>{item.senderName}</Text>
          )}
          <View style={[
            styles.messageBubble,
            isCurrentUserMessage ? styles.userBubble : styles.otherBubble,
            !isCurrentUserMessage && { backgroundColor: colors.card },
          ]}>
            <Text style={[
              styles.messageText,
              isCurrentUserMessage ? { color: '#fff' } : { color: colors.text },
            ]}>
              {item.content}
            </Text>
          </View>
          <Text style={[
            styles.timestamp,
            { color: colors.textSecondary },
          ]}>
            {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right', 'top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {isConnected ? (isTyping ? 'Đang nhập...' : 'Đang hoạt động') : 'Đang kết nối...'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="call" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="videocam" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
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
      />

      {/* Input Area */}
      <SafeAreaView style={[styles.inputArea, { backgroundColor: colors.background, borderTopColor: colors.border }]} edges={['left', 'right', 'bottom']}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border, maxHeight: 100 }]}
          placeholder={t('chat.search')}
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={handleInputChange}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: inputText.trim() ? COLORS.primary : colors.border }]}
          onPress={handleSendMessage}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
  },
  headerInfo: { 
    flex: 1, 
    marginLeft: 16 
  },
  headerTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  headerSubtitle: { 
    fontSize: 12,
    fontWeight: '500',
  },
  headerActions: { 
    flexDirection: 'row', 
    gap: 8 
  },
  headerIcon: { 
    width: 40, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  messagesList: { 
    paddingHorizontal: 12, 
    paddingVertical: 16, 
    flexGrow: 1, 
    justifyContent: 'flex-end',
  },
  olderLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  olderLoadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  messageContainer: { 
    marginBottom: 16, // Tăng khoảng cách giữa các tin nhắn
    flexDirection: 'row',
    width: '100%',
  },
  messageWrapper: {
    maxWidth: '80%', // Chuyển maxWidth ra wrapper để tên và giờ không bị tràn
  },
  userMessage: { 
    justifyContent: 'flex-end', // Đẩy toàn bộ khối sang phải
  },
  otherMessage: { 
    justifyContent: 'flex-start', // Đẩy toàn bộ khối sang trái
  },
  userMessageWrapper: {
    alignItems: 'flex-end', // Căn lề phải cho text bên trong
  },
  otherMessageWrapper: {
    alignItems: 'flex-start', // Căn lề trái cho text bên trong
  },
  senderName: { 
    fontSize: 12, 
    marginBottom: 4, 
    marginLeft: 4,
    fontWeight: '600',
  },
  messageBubble: { 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 4, // Bo góc nhọn ở đuôi tin nhắn giống Zalo
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  otherBubble: {
    borderTopLeftRadius: 4, // Bo góc nhọn ở đuôi tin nhắn giống Zalo
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  messageText: { 
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  timestamp: { 
    fontSize: 11, 
    marginTop: 4,
    marginHorizontal: 4,
    fontWeight: '400',
  },
  
  timestampLeft: {
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  timestampRight: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  inputArea: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    paddingHorizontal: 12, 
    paddingVertical: 12, 
    borderTopWidth: 1, 
    gap: 8,
  },
  attachButton: { 
    width: 40, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderRadius: 20,
  },
  input: { 
    flex: 1, 
    borderWidth: 1.5, 
    borderRadius: 24, 
    paddingHorizontal: 16, 
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '500',
  },
  sendButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
});
