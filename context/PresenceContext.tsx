import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Client } from '@stomp/stompjs';
import { TextDecoder as PolyfillTextDecoder, TextEncoder as PolyfillTextEncoder } from 'text-encoding';
import { presenceService, UserStatus } from '../services/presenceService';

// Ensure TextEncoding polyfill for React Native STOMP
const globalValue = globalThis as unknown as { TextEncoder?: unknown; TextDecoder?: unknown; };
if (!globalValue.TextEncoder) globalValue.TextEncoder = PolyfillTextEncoder as unknown;
if (!globalValue.TextDecoder) globalValue.TextDecoder = PolyfillTextDecoder as unknown;

interface PresenceContextValue {
  statuses: Map<string, UserStatus>;
  isOnline: (userId: string) => boolean;
  getLastSeen: (userId: string) => string | null;
  refreshUserStatus: (userId: string) => Promise<void>;
}

const PresenceContext = createContext<PresenceContextValue>({
  statuses: new Map(),
  isOnline: () => false,
  getLastSeen: () => null,
  refreshUserStatus: async () => {},
});

const HEARTBEAT_INTERVAL = 25000;
const BROKER_URL = 'ws://10.0.2.2:8080/ws'; // Adjust based on your API_URL config for React Native

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [statuses, setStatuses] = useState<Map<string, UserStatus>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const clientRef = useRef<Client | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);

  // 1. Get Current User ID from SecureStore
  useEffect(() => {
    const fetchUserId = async () => {
      const id = await SecureStore.getItemAsync('user_id');
      if (id) setCurrentUserId(id);
    };
    fetchUserId();
  }, []);

  // 2. Fetch Initial Friends Status via REST API
  useEffect(() => {
    if (!currentUserId) return;
    const fetchInitial = async () => {
      const list = await presenceService.getInitialFriendsStatus();
      setStatuses((prev) => {
        const next = new Map(prev);
        list.forEach((s) => next.set(s.userId, s));
        return next;
      });
    };
    fetchInitial();
  }, [currentUserId]);

  // 3. Setup WebSocket (STOMP) for Realtime updates and Heartbeat
  const connectPresenceSocket = useCallback(async () => {
    if (!currentUserId) return;
    
    const token = await SecureStore.getItemAsync('user_token');
    if (!token) return;

    const client = new Client({
      brokerURL: BROKER_URL,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      heartbeatIncoming: HEARTBEAT_INTERVAL,
      heartbeatOutgoing: HEARTBEAT_INTERVAL,
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      onConnect: () => {
        console.log(`[PresenceContext] Subscribing to /topic/presence/${currentUserId}`);
        client.subscribe(`/topic/presence/${currentUserId}`, (message) => {
          try {
            const payload: UserStatus = JSON.parse(message.body);
            setStatuses((prev) => {
              const next = new Map(prev);
              next.set(payload.userId, payload);
              return next;
            });
          } catch (e) {
            console.error('[Presence] Error parsing presence payload', e);
          }
        });

        // Start Heartbeat
        heartbeatRef.current = setInterval(() => {
          if (client.connected) {
            client.publish({ destination: '/app/presence/heartbeat', body: JSON.stringify({}) });
          }
        }, HEARTBEAT_INTERVAL);
      },
      onWebSocketClose: () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      }
    });

    clientRef.current = client;
    client.activate();
  }, [currentUserId]);

  const disconnectPresenceSocket = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (clientRef.current?.active) {
      clientRef.current.deactivate();
    }
  }, []);

  useEffect(() => {
    connectPresenceSocket();
    return () => disconnectPresenceSocket();
  }, [connectPresenceSocket, disconnectPresenceSocket]);

  // 4. Handle AppState (Background/Foreground) to send explicit Heartbeats / disconnects
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App comes to foreground - reconnect or send heartbeat immediately
        if (clientRef.current && clientRef.current.connected) {
          clientRef.current.publish({ destination: '/app/presence/heartbeat', body: JSON.stringify({}) });
        } else {
          connectPresenceSocket();
        }
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App goes to background - disconnect to trigger offline immediately (optional based on UX)
        // Or leave it up to the server TTL if you want slight background grace period.
        disconnectPresenceSocket();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [connectPresenceSocket, disconnectPresenceSocket]);

  // Helpers
  const isOnline = useCallback((userId: string) => statuses.get(userId)?.online ?? false, [statuses]);
  const getLastSeen = useCallback((userId: string) => statuses.get(userId)?.lastSeen ?? null, [statuses]);
  const refreshUserStatus = useCallback(async (userId: string) => {
    if (!userId || !currentUserId) return;
    const data = await presenceService.getUserStatus(userId);
    if (data?.userId) {
      setStatuses((prev) => {
        const next = new Map(prev);
        next.set(data.userId, { userId: data.userId, online: data.online ?? false, lastSeen: data.lastSeen ?? null });
        return next;
      });
    }
  }, [currentUserId]);

  return (
    <PresenceContext.Provider value={{ statuses, isOnline, getLastSeen, refreshUserStatus }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => useContext(PresenceContext);