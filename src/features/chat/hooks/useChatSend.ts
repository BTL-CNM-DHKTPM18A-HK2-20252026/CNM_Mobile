import { useCallback, useState } from 'react';
import type { ChatUiMessage } from '@/services/chatMessageAdapter';
import { mapChatPayloadToUiMessage } from '@/services/chatMessageAdapter';
import { chatService } from '@/services/chatService';
import { serializePlainTextToTiptapJson } from '@/utils/chat/plainTextToTiptap';

interface UseChatSendOptions {
  conversationId: string | null;
  currentUserId?: string | null;
  isAiConversation?: boolean;
  i18n?: any;
  mergeUniqueMessages?: (prev: ChatUiMessage[], next: ChatUiMessage[]) => ChatUiMessage[];
  requestScrollToLatest?: (animated: boolean) => void;
}

interface UseChatSendReturn {
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  editingMessageId: string | null;
  setEditingMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  isSendingAi: boolean;
  replyingTo: any | null;
  setReplyingTo: React.Dispatch<React.SetStateAction<any | null>>;
  sendTextMessage: (text: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  sendAiMessage: (text: string) => Promise<void>;
}

export function useChatSend({
  conversationId,
  currentUserId,
  isAiConversation,
  i18n,
  mergeUniqueMessages,
  requestScrollToLatest,
}: UseChatSendOptions): UseChatSendReturn {
  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isSendingAi, setIsSendingAi] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);

  const toLocalIsoString = (date: Date): string => {
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, -1);
  };

  const splitLongMessage = useCallback((text: string, maxLen = 800): string[] => {
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      let splitPos = remaining.lastIndexOf('\n', maxLen);
      if (splitPos <= 0) splitPos = remaining.lastIndexOf(' ', maxLen);
      if (splitPos <= 0) splitPos = maxLen;
      chunks.push(remaining.substring(0, splitPos).trim());
      remaining = remaining.substring(splitPos).trim();
    }
    return chunks;
  }, []);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!conversationId) return;
    const serialized = serializePlainTextToTiptapJson(newContent);
    try {
      const response = await chatService.updateMessage(messageId, serialized);
      const mapped = mapChatPayloadToUiMessage(response);
      // The response handling is left to the caller to update messages state
      return mapped;
    } catch (err) {
      console.error('[useChatSend] editMessage failed:', err);
      throw err;
    }
  }, [conversationId]);

  const sendAiMessage = useCallback(async (text: string) => {
    if (!conversationId || !currentUserId || !mergeUniqueMessages || !requestScrollToLatest) return;
    setIsSendingAi(true);
    const tempId = `temp-${Date.now()}`;
    const now = new Date();
    const optimistic: ChatUiMessage = {
      messageId: tempId,
      content: text,
      senderId: currentUserId,
      senderName: 'Me',
      createdAt: toLocalIsoString(now),
      messageType: 'TEXT',
    };
    // Optimistic update handled by caller via setMessages
    requestScrollToLatest(true);

    try {
      const locale = (i18n?.resolvedLanguage || i18n?.language || 'vi').toLowerCase();
      const aiResponse = await chatService.sendAiMessage({
        content: text,
        conversationId,
        useRag: true,
        language: locale.startsWith('en') ? 'en' : 'vi',
      });
      const aiPayload = chatService.unwrapApiPayload<any>(aiResponse) ?? {};
      return {
        tempId,
        userMessage: mapChatPayloadToUiMessage(aiPayload?.userMessage),
        imageMessage: mapChatPayloadToUiMessage(aiPayload?.imageMessage),
        assistantMessage: mapChatPayloadToUiMessage(aiPayload?.assistantMessage),
      };
    } catch (err) {
      console.error('[useChatSend] AI message failed:', err);
      throw err;
    } finally {
      setIsSendingAi(false);
    }
  }, [conversationId, currentUserId, isAiConversation, i18n, mergeUniqueMessages, requestScrollToLatest]);

  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() || !conversationId) return;

    const serialized = serializePlainTextToTiptapJson(text.trim());
    // Split long messages
    const parts = serialized.length > 800 ? splitLongMessage(text.trim()) : [text.trim()];

    for (const part of parts) {
      try {
        await chatService.sendMessage(conversationId, {
          content: part,
          messageType: 'TEXT',
          replyToMessageId: replyingTo?.messageId,
        });
      } catch (err) {
        console.error('[useChatSend] sendTextMessage part failed:', err);
      }
    }
  }, [conversationId, replyingTo, splitLongMessage]);

  return {
    inputText,
    setInputText,
    editingMessageId,
    setEditingMessageId,
    isSendingAi,
    replyingTo,
    setReplyingTo,
    sendTextMessage,
    editMessage,
    sendAiMessage,
  };
}
