import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Dimensions } from 'react-native';

export const LOCAL_DELETED_STORAGE_KEY = 'fruvia.chat.deleted-local.v1';

export const getDeletedStorageKey = (conversationId: string, userId: string = 'anonymous'): string =>
  `${LOCAL_DELETED_STORAGE_KEY}:${userId}:${conversationId}`;

export const readDeletedMessageIds = async (conversationId: string, userId?: string): Promise<Set<string>> => {
  try {
    const key = getDeletedStorageKey(conversationId, userId);
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.map((id: unknown) => String(id)).filter(Boolean));
  } catch (error) {
    console.warn('[LocalDelete] Failed to read:', error);
  }
  return new Set();
};

export const addDeletedMessageId = async (
  conversationId: string,
  userId: string | undefined,
  messageId: string,
): Promise<Set<string>> => {
  const next = await readDeletedMessageIds(conversationId, userId);
  next.add(String(messageId));
  try {
    const key = getDeletedStorageKey(conversationId, userId);
    await SecureStore.setItemAsync(key, JSON.stringify([...next]));
  } catch (error) {
    console.warn('[LocalDelete] Failed to write:', error);
  }
  return next;
};

export const PAGE_SIZE = 10;
export const SCROLL_TOP_THRESHOLD = 48;
export const AI_TYPING_USER_ID = 'FRUVIA_AI_ASSISTANT';
export const BLOCK_GAP_MS = 5 * 60 * 1000;
export const MAX_IMAGE_SELECTION = 30;
export const REACTION_EMOJIS = ['❤️', '👍', '😆', '😮', '😭', '😡'] as const;

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const SCREEN_WIDTH = Dimensions.get('window').width;
export const SCREEN_HEIGHT = Dimensions.get('window').height;

export const buildStompBrokerUrl = () => {
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

export const BROKER_URL = buildStompBrokerUrl();

export const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
  '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
  '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱',
  '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻',
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '🤙', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌',
  '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🎉', '🎊',
  '🎈', '🎁', '🎀', '🔥', '⭐', '✨', '💫', '🌟', '🌈', '☀️', '🌙', '❄️', '🌸', '🌺', '🌻', '🌹', '🍀', '🌊', '🌍', '🐶',
  '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦',
  '🍎', '🍊', '🍋', '🍇', '🍓', '🍒', '🍑', '🍍', '🥭', '🍕', '🍔', '🍟', '🌭', '🍿', '🧁', '🍰', '🎂', '☕', '🍵', '🥤',
];
