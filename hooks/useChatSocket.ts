import {
    Client,
    type IMessage,
    type StompHeaders,
    type StompSubscription,
} from '@stomp/stompjs';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TextDecoder as PolyfillTextDecoder, TextEncoder as PolyfillTextEncoder } from 'text-encoding';

export type ChatSocketConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface ChatMessageEvent {
  id?: string;
  conversationId: string;
  senderId?: string;
  content?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping?: boolean;
  [key: string]: unknown;
}

export interface ReadReceiptEvent {
  conversationId: string;
  userId: string;
  messageId: string;
  readAt?: string;
  [key: string]: unknown;
}

interface UseChatSocketOptions {
  conversationId?: string | null;
  brokerURL: string;
  token?: string;
  getToken?: () => Promise<string | null>;
  reconnectDelayMs?: number;
  onMessage?: (event: ChatMessageEvent) => void;
  onTyping?: (event: TypingEvent) => void;
  onReadReceipt?: (event: ReadReceiptEvent) => void;
  onConnectionStateChange?: (state: ChatSocketConnectionState) => void;
  debug?: boolean;
}

const DEFAULT_RECONNECT_DELAY_MS = 5000;
const HEARTBEAT_MS = 25000;
const TOKEN_STORAGE_KEY = 'user_token';

function ensureTextEncodingPolyfill(): void {
  const globalValue = globalThis as unknown as {
    TextEncoder?: unknown;
    TextDecoder?: unknown;
  };

  if (!globalValue.TextEncoder) {
    globalValue.TextEncoder = PolyfillTextEncoder as unknown;
  }

  if (!globalValue.TextDecoder) {
    globalValue.TextDecoder = PolyfillTextDecoder as unknown;
  }
}

function parseJsonBody<T>(message: IMessage): T | null {
  try {
    return JSON.parse(message.body) as T;
  } catch {
    return null;
  }
}

function isForbiddenLocalHostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

export function useChatSocket(options: UseChatSocketOptions) {
  const {
    conversationId,
    brokerURL,
    token,
    getToken,
    reconnectDelayMs = DEFAULT_RECONNECT_DELAY_MS,
    onMessage,
    onTyping,
    onReadReceipt,
    onConnectionStateChange,
    debug = false,
  } = options;

  const clientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<StompSubscription[]>([]);

  const onMessageRef = useRef(onMessage);
  const onTypingRef = useRef(onTyping);
  const onReadReceiptRef = useRef(onReadReceipt);
  const onConnectionStateChangeRef = useRef(onConnectionStateChange);

  const [connectionState, setConnectionState] = useState<ChatSocketConnectionState>('DISCONNECTED');
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  useEffect(() => {
    onReadReceiptRef.current = onReadReceipt;
  }, [onReadReceipt]);

  useEffect(() => {
    onConnectionStateChangeRef.current = onConnectionStateChange;
  }, [onConnectionStateChange]);

  const updateConnectionState = useCallback((nextState: ChatSocketConnectionState) => {
    setConnectionState(nextState);
    onConnectionStateChangeRef.current?.(nextState);
  }, []);

  const clearSubscriptions = useCallback(() => {
    subscriptionsRef.current.forEach((subscription) => {
      try {
        subscription.unsubscribe();
      } catch {
        // Best-effort cleanup during reconnect/disconnect.
      }
    });
    subscriptionsRef.current = [];
  }, []);

  const subscribeConversationChannels = useCallback(() => {
    const client = clientRef.current;

    if (!client || !client.connected || !conversationId) {
      return;
    }

    clearSubscriptions();

    const messageSub = client.subscribe(`/topic/chat/${conversationId}`, (message) => {
      const payload = parseJsonBody<ChatMessageEvent>(message);
      if (payload) {
        onMessageRef.current?.(payload);
      }
    });

    const typingSub = client.subscribe(`/topic/chat/${conversationId}/typing`, (message) => {
      const payload = parseJsonBody<TypingEvent>(message);
      if (payload) {
        onTypingRef.current?.(payload);
      }
    });

    const readSub = client.subscribe(`/topic/chat/${conversationId}/read`, (message) => {
      const payload = parseJsonBody<ReadReceiptEvent>(message);
      if (payload) {
        onReadReceiptRef.current?.(payload);
      }
    });

    subscriptionsRef.current = [messageSub, typingSub, readSub];
  }, [clearSubscriptions, conversationId]);

  const resolveToken = useCallback(async (): Promise<string | null> => {
    if (token) {
      return token;
    }

    if (getToken) {
      return getToken();
    }

    return SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  }, [getToken, token]);

  const connect = useCallback(async () => {
    if (!brokerURL) {
      const message = 'Missing brokerURL for STOMP connection.';
      setLastError(message);
      updateConnectionState('ERROR');
      return;
    }

    if (isForbiddenLocalHostUrl(brokerURL)) {
      const message = 'brokerURL cannot use localhost/127.0.0.1 on React Native device.';
      setLastError(message);
      updateConnectionState('ERROR');
      return;
    }

    const currentClient = clientRef.current;
    if (currentClient?.active || currentClient?.connected) {
      return;
    }

    const accessToken = await resolveToken();
    if (!accessToken) {
      const message = 'Missing JWT token for STOMP authentication.';
      setLastError(message);
      updateConnectionState('ERROR');
      return;
    }

    ensureTextEncodingPolyfill();
    setLastError(null);
    updateConnectionState('CONNECTING');

    const connectHeaders: StompHeaders = {
      Authorization: `Bearer ${accessToken}`,
    };

    const client = new Client({
      brokerURL,
      connectHeaders,
      reconnectDelay: reconnectDelayMs,
      heartbeatIncoming: HEARTBEAT_MS,
      heartbeatOutgoing: HEARTBEAT_MS,
      debug: debug
        ? (message: string) => {
            console.log('[STOMP]', message);
          }
        : () => {
            // no-op
          },
      onConnect: () => {
        updateConnectionState('CONNECTED');
        subscribeConversationChannels();
      },
      onStompError: (frame) => {
        const message = frame.headers.message || 'STOMP broker error';
        setLastError(message);
        updateConnectionState('ERROR');
      },
      onWebSocketError: () => {
        setLastError('WebSocket transport error');
        updateConnectionState('ERROR');
      },
      onWebSocketClose: () => {
        clearSubscriptions();
        updateConnectionState('DISCONNECTED');
      },
    });

    clientRef.current = client;
    client.activate();
  }, [
    brokerURL,
    clearSubscriptions,
    debug,
    reconnectDelayMs,
    resolveToken,
    subscribeConversationChannels,
    updateConnectionState,
  ]);

  const disconnect = useCallback(async () => {
    clearSubscriptions();

    const client = clientRef.current;
    clientRef.current = null;

    if (client?.active) {
      await client.deactivate();
    }

    updateConnectionState('DISCONNECTED');
  }, [clearSubscriptions, updateConnectionState]);

  const sendTyping = useCallback(
    (targetConversationId: string, userId: string): boolean => {
      const client = clientRef.current;
      if (!client?.connected) {
        return false;
      }

      client.publish({
        destination: `/app/chat/${targetConversationId}/typing`,
        body: JSON.stringify({ userId }),
      });

      return true;
    },
    []
  );

  const sendReadReceipt = useCallback(
    (targetConversationId: string, userId: string, messageId: string): boolean => {
      const client = clientRef.current;
      if (!client?.connected) {
        return false;
      }

      client.publish({
        destination: `/app/chat/${targetConversationId}/read`,
        body: JSON.stringify({ userId, messageId }),
      });

      return true;
    },
    []
  );

  useEffect(() => {
    void connect();

    return () => {
      void disconnect();
    };
  }, [connect, disconnect]);

  useEffect(() => {
    subscribeConversationChannels();
  }, [subscribeConversationChannels]);

  const isConnected = useMemo(() => connectionState === 'CONNECTED', [connectionState]);

  return {
    connectionState,
    isConnected,
    lastError,
    connect,
    disconnect,
    sendTyping,
    sendReadReceipt,
  };
}
