import * as SecureStore from 'expo-secure-store';
import { Client } from '@stomp/stompjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import SockJS from 'sockjs-client';

const WS_BASE_URL = 'http://localhost:8080/ws'; // SockJS endpoint

export const useChatWebSocket = (conversationId: string) => {
  const clientRef = useRef<Client | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [conversationId]);

  const connectWebSocket = async () => {
    const token = await SecureStore.getItemAsync('user_token'); // Assuming token key
    const uid = await SecureStore.getItemAsync('user_id'); // Assuming user ID key
    if (!token || !uid) return;

    setUserId(uid);

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_BASE_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (str) => {
        console.log(str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = () => {
      setIsConnected(true);
      console.log('[STOMP] Connected');

      // Subscribe to messages for this conversation
      client.subscribe(`/user/queue/messages`, (message) => {
        const payload = JSON.parse(message.body);
        if (payload.conversationId === conversationId) {
          setMessages((prev) => [payload, ...prev]);
        }
      });

      // Subscribe to typing indicators
      client.subscribe(`/topic/chat/${conversationId}/typing`, (message) => {
        const payload = JSON.parse(message.body);
        setIsTyping(payload.userId !== uid);
      });

      // Subscribe to read receipts
      client.subscribe(`/topic/chat/${conversationId}/read`, (message) => {
        // Handle read receipts if needed
      });
    };

    client.onStompError = (frame) => {
      console.error('[STOMP] Error:', frame.headers['message']);
    };

    client.onWebSocketClose = () => {
      setIsConnected(false);
      console.log('[STOMP] Disconnected');
    };

    client.activate();
    clientRef.current = client;
  };

  const sendMessage = useCallback((content: string, type = 'TEXT', attachments = []) => {
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.publish({
        destination: '/app/chat/send',
        body: JSON.stringify({
          conversationId,
          content,
          messageType: type,
          attachments,
        }),
      });
    }
  }, [conversationId]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (clientRef.current && clientRef.current.connected && userId) {
      clientRef.current.publish({
        destination: '/app/chat/typing',
        body: JSON.stringify({
          conversationId,
          userId,
          isTyping,
        }),
      });
    }
  }, [conversationId, userId]);

  return {
    messages,
    setMessages,
    sendMessage,
    sendTyping,
    isTyping,
    isConnected,
  };
};