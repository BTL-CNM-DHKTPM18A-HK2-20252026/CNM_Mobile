// Re-export — keep require() paths relative to THIS file's location (src/shared/services/)
// IMPORTANT: default images are at public/ (project root), not src/shared/public/
// So we use absolute-ish require paths via the service's re-export pattern
import { ImageSourcePropType } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const S3_BASE_URL = process.env.EXPO_PUBLIC_S3_BASE_URL || 'https://fruvia-asset.s3.ap-southeast-2.amazonaws.com/public';

export const FRUVIA_CHATBOT_AVATAR_URL = `${S3_BASE_URL}/system/fruvia_chatbot.png`;

const DEFAULT_AVATAR_KEY = '/default/image1.jpg';
const DEFAULT_COVER_KEY = '/background/image1.jpg';

// Use require() relative to project root (public/) via services/mediaUtils.ts re-export
const _DEFAULT_AVATARS: Record<string, ImageSourcePropType> = {
  '/default/image1.jpg': { uri: '/default/image1.jpg' },
  '/default/image2.jpg': { uri: '/default/image2.jpg' },
  '/default/image3.jpg': { uri: '/default/image3.jpg' },
  '/default/image4.jpg': { uri: '/default/image4.jpg' },
  '/default/image5.jpg': { uri: '/default/image5.jpg' },
  '/default/image6.jpg': { uri: '/default/image6.jpg' },
  '/default/image7.jpg': { uri: '/default/image7.jpg' },
  '/default/image8.jpg': { uri: '/default/image8.jpg' },
  '/system/fruvia_chatbot.png': { uri: '/system/fruvia_chatbot.png' },
};

const _DEFAULT_BACKGROUNDS: Record<string, ImageSourcePropType> = {
  '/background/image1.jpg': { uri: '/background/image1.jpg' },
  '/background/image2.jpg': { uri: '/background/image2.jpg' },
  '/background/image3.jpg': { uri: '/background/image3.jpg' },
};

const API_ORIGIN = (() => {
  if (!API_URL) return null;
  try {
    const parsed = new URL(API_URL);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
})();

function normalizePath(path: string): string {
  const cleaned = path.split('?')[0].split('#')[0].trim();
  if (!cleaned) return '';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

function toAbsoluteUri(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalized = normalizePath(path);
  if (!normalized) return '';
  if (!API_ORIGIN) return normalized;
  return `${API_ORIGIN}${normalized}`;
}

export function resolveAvatarUri(avatarUrl: string | null | undefined): string {
  if (!avatarUrl) return toAbsoluteUri(DEFAULT_AVATAR_KEY);
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) return avatarUrl;
  return toAbsoluteUri(avatarUrl);
}

export function getAvatarSource(avatarUrl: string | null | undefined): ImageSourcePropType {
  if (!avatarUrl) return _DEFAULT_AVATARS[DEFAULT_AVATAR_KEY];

  // Fruvia Chatbot avatar: always use local bundled image (avoid S3 dependency)
  if (avatarUrl === FRUVIA_CHATBOT_AVATAR_URL || avatarUrl.includes('/system/fruvia_chatbot.png')) {
    return _DEFAULT_AVATARS['/system/fruvia_chatbot.png'];
  }

  const normalized = normalizePath(avatarUrl);
  if (_DEFAULT_AVATARS[normalized]) return _DEFAULT_AVATARS[normalized];

  return { uri: toAbsoluteUri(avatarUrl) };
}

export function getCoverSource(coverUrl: string | null | undefined): ImageSourcePropType {
  if (!coverUrl) return _DEFAULT_BACKGROUNDS[DEFAULT_COVER_KEY];
  const normalized = normalizePath(coverUrl);
  if (_DEFAULT_BACKGROUNDS[normalized]) return _DEFAULT_BACKGROUNDS[normalized];
  return { uri: toAbsoluteUri(coverUrl) };
}
