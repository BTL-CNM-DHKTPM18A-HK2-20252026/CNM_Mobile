import * as SecureStore from 'expo-secure-store';
import { useCallback, useRef } from 'react';

const LOCAL_DELETED_STORAGE_KEY = 'fruvia.chat.deleted-local.v1';

const getDeletedStorageKey = (conversationId: string, userId: string = 'anonymous'): string =>
  `${LOCAL_DELETED_STORAGE_KEY}:${userId}:${conversationId}`;

const readDeletedMessageIds = async (conversationId: string, userId?: string): Promise<Set<string>> => {
  try {
    const key = getDeletedStorageKey(conversationId, userId);
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.map((id: unknown) => String(id)).filter(Boolean));
  } catch (error) {
    console.warn('[useLocalDeleted] Failed to read:', error);
  }
  return new Set();
};

const persistDeletedSet = async (conversationId: string, userId: string | undefined, set: Set<string>) => {
  try {
    const key = getDeletedStorageKey(conversationId, userId);
    await SecureStore.setItemAsync(key, JSON.stringify([...set]));
  } catch (error) {
    console.warn('[useLocalDeleted] Failed to persist:', error);
  }
};

export type UseLocalDeletedReturn = {
  initDeletedSet: (conversationId: string, userId?: string) => Promise<void>;
  markDeleted: (conversationId: string, userId: string | undefined, messageId: string) => Promise<Set<string>>;
  isDeleted: (messageId: string) => boolean;
  getDeletedSet: () => Set<string>;
};

export default function useLocalDeleted(): UseLocalDeletedReturn {
  const deletedRef = useRef<Set<string>>(new Set());

  const initDeletedSet = useCallback(async (conversationId: string, userId?: string) => {
    const set = await readDeletedMessageIds(conversationId, userId);
    deletedRef.current = set;
  }, []);

  const markDeleted = useCallback(async (conversationId: string, userId: string | undefined, messageId: string) => {
    const next = await readDeletedMessageIds(conversationId, userId);
    next.add(String(messageId));
    deletedRef.current = next;
    await persistDeletedSet(conversationId, userId, next);
    return next;
  }, []);

  const isDeleted = useCallback((messageId: string) => {
    return deletedRef.current.has(String(messageId));
  }, []);

  const getDeletedSet = useCallback(() => deletedRef.current, []);

  return {
    initDeletedSet,
    markDeleted,
    isDeleted,
    getDeletedSet,
  };
}
