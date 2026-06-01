import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Message } from '@chat/types/chatTypes';

/**
 * Bộ nhớ đệm tin nhắn offline cho từng cuộc trò chuyện (tương đương IndexedDB/Dexie trên web).
 * Giúp mở lại đoạn chat hiển thị tin tức thì trong khi chờ tải mới từ server.
 */

const CACHE_PREFIX = 'chat_msg_cache_';
const MAX_CACHED_MESSAGES = 50;

const buildKey = (conversationId: string): string => `${CACHE_PREFIX}${conversationId}`;

const isPersistableMessage = (message: Message): boolean => {
  const id = String(message?.messageId ?? '');
  // Bỏ qua tin optimistic (chưa có ID server) để tránh lưu rác.
  return id.length > 0 && !id.startsWith('temp-');
};

/**
 * Đọc tin nhắn đã lưu (mới nhất ở đầu, đã sort theo state hiện tại).
 */
export const loadCachedMessages = async (conversationId: string): Promise<Message[] | null> => {
  if (!conversationId) return null;

  try {
    const raw = await AsyncStorage.getItem(buildKey(conversationId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed as Message[];
  } catch {
    return null;
  }
};

/**
 * Lưu (giới hạn) danh sách tin nhắn gần nhất vào cache.
 */
export const saveCachedMessages = async (
  conversationId: string,
  messages: Message[]
): Promise<void> => {
  if (!conversationId) return;

  try {
    const persistable = messages.filter(isPersistableMessage).slice(0, MAX_CACHED_MESSAGES);

    if (persistable.length === 0) {
      return;
    }

    await AsyncStorage.setItem(buildKey(conversationId), JSON.stringify(persistable));
  } catch {
    // Cache là phụ trợ — bỏ qua lỗi ghi.
  }
};

/**
 * Xóa cache của một cuộc trò chuyện (ví dụ khi rời nhóm / xóa hội thoại).
 */
export const clearCachedMessages = async (conversationId: string): Promise<void> => {
  if (!conversationId) return;

  try {
    await AsyncStorage.removeItem(buildKey(conversationId));
  } catch {
    // Bỏ qua lỗi xóa cache.
  }
};
