import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatUiMessage } from '@/services/chatMessageAdapter';
import { mapChatPayloadListToUiMessages } from '@/services/chatMessageAdapter';
import { chatService } from '@/services/chatService';

const PAGE_SIZE = 30;

interface UseChatMessagesOptions {
  conversationId: string | null;
  currentUserId?: string | null;
  isGroupConversation?: boolean;
  isCloudConversation?: boolean;
  isAiConversation?: boolean;
}

interface UseChatMessagesReturn {
  messages: ChatUiMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatUiMessage[]>>;
  hasMoreOlder: boolean;
  isLoadingMore: boolean;
  isInitialLoading: boolean;
  loadInitialMessages: (uid?: string | null, silent?: boolean) => Promise<void>;
  loadMoreOlder: () => Promise<void>;
  refreshMessages: () => Promise<void>;
}

export function useChatMessages({
  conversationId,
  currentUserId,
}: UseChatMessagesOptions): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const parsePageResult = useCallback((response: any, pageSize: number): { payload: any[]; hasMore: boolean } => {
    let items: any[] = [];
    let total = 0;
    const data = response?.data ?? response ?? [];
    if (Array.isArray(data)) {
      items = data;
      total = items.length;
    } else if (data?.content && Array.isArray(data.content)) {
      items = data.content;
      total = data.totalElements ?? items.length;
    }
    return { payload: items, hasMore: items.length >= pageSize && items.length < total };
  }, []);

  const filterDeletedMessages = useCallback((msgs: ChatUiMessage[]): ChatUiMessage[] => {
    // Basic filter: remove empty content messages (extend as needed)
    return msgs.filter((m) => m.messageId && !m.isRecalled);
  }, []);

  const sortMessages = useCallback((msgs: ChatUiMessage[]): ChatUiMessage[] => {
    return [...msgs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, []);

  const loadInitialMessages = useCallback(async (uid?: string | null, silent = false) => {
    if (!conversationId) return;
    if (!silent) setIsInitialLoading(true);
    try {
      const response = await chatService.getMessages(conversationId, 0, PAGE_SIZE);
      const { payload, hasMore } = parsePageResult(response, PAGE_SIZE);
      if (!silent) {
        setHasMoreOlder(hasMore);
        hasMoreRef.current = hasMore;
      }
      let normalized = mapChatPayloadListToUiMessages(payload);
      normalized = filterDeletedMessages(normalized);
      normalized = sortMessages(normalized);

      // Auto-fill until we have PAGE_SIZE messages
      let mergedMsgs = normalized;
      let more = hasMore;
      if (!silent && mergedMsgs.length > 0 && mergedMsgs.length < PAGE_SIZE) {
        let cursorId = mergedMsgs[0].messageId;
        while (mergedMsgs.length < PAGE_SIZE && cursorId) {
          const remaining = PAGE_SIZE - mergedMsgs.length;
          const olderRes = await chatService.getMessagesBefore(conversationId, cursorId, remaining);
          const { payload: olderPayload, hasMore: olderHasMore } = parsePageResult(olderRes, remaining);
          const olderMsgs = sortMessages(filterDeletedMessages(mapChatPayloadListToUiMessages(olderPayload)));
          if (olderMsgs.length === 0) {
            more = false;
            break;
          }
          mergedMsgs = [...olderMsgs, ...mergedMsgs];
          cursorId = olderMsgs[0].messageId;
        }
        setHasMoreOlder(more);
        hasMoreRef.current = more;
      }
      setMessages((prev) => {
        const merged = [...mergedMsgs];
        // Preserve any realtime messages not in API response
        const apiIds = new Set(merged.map((m) => m.messageId));
        const realtimeOnly = prev.filter(
          (m) => !apiIds.has(m.messageId) && !m.messageId.startsWith('temp-')
        );
        return realtimeOnly.length > 0
          ? sortMessages([...merged, ...realtimeOnly])
          : merged;
      });
    } catch (err) {
      console.error('[useChatMessages] loadInitialMessages failed:', err);
    } finally {
      if (!silent) setIsInitialLoading(false);
    }
  }, [conversationId, parsePageResult, filterDeletedMessages, sortMessages]);

  const loadMoreOlder = useCallback(async () => {
    if (!conversationId || loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setIsLoadingMore(true);
    try {
      const oldestMsg = [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      if (!oldestMsg) return;
      const response = await chatService.getMessagesBefore(conversationId, oldestMsg.messageId, PAGE_SIZE);
      const { payload, hasMore } = parsePageResult(response, PAGE_SIZE);
      const olderMsgs = sortMessages(filterDeletedMessages(mapChatPayloadListToUiMessages(payload)));
      if (olderMsgs.length === 0) {
        hasMoreRef.current = false;
        setHasMoreOlder(false);
        return;
      }
      setMessages((prev) => [...olderMsgs, ...prev]);
      setHasMoreOlder(hasMore);
      hasMoreRef.current = hasMore;
    } catch (err) {
      console.error('[useChatMessages] loadMoreOlder failed:', err);
    } finally {
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [conversationId, messages, parsePageResult, filterDeletedMessages, sortMessages]);

  const refreshMessages = useCallback(async () => {
    await loadInitialMessages(currentUserId, false);
  }, [loadInitialMessages, currentUserId]);

  return {
    messages,
    setMessages,
    hasMoreOlder,
    isLoadingMore,
    isInitialLoading,
    loadInitialMessages,
    loadMoreOlder,
    refreshMessages,
  };
}
