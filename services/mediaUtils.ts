import { ImageSourcePropType } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const DEFAULT_AVATAR_KEY = '/default/image1.jpg';
const DEFAULT_COVER_KEY = '/background/image1.jpg';

const DEFAULT_AVATARS: Record<string, ImageSourcePropType> = {
  '/default/image1.jpg': require('../public/default/image1.jpg'),
  '/default/image2.jpg': require('../public/default/image2.jpg'),
  '/default/image3.jpg': require('../public/default/image3.jpg'),
  '/default/image4.jpg': require('../public/default/image4.jpg'),
  '/default/image5.jpg': require('../public/default/image5.jpg'),
  '/default/image6.jpg': require('../public/default/image6.jpg'),
  '/default/image7.jpg': require('../public/default/image7.jpg'),
  '/default/image8.jpg': require('../public/default/image8.jpg'),
};

const DEFAULT_BACKGROUNDS: Record<string, ImageSourcePropType> = {
  '/background/image1.jpg': require('../public/background/image1.jpg'),
  '/background/image2.jpg': require('../public/background/image2.jpg'),
  '/background/image3.jpg': require('../public/background/image3.jpg'),
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

  if (!API_ORIGIN) {
    return normalized;
  }

  return `${API_ORIGIN}${normalized}`;
}

/**
 * Resolves an avatar_url (which may be a relative path like /default/image3.jpg
 * or a full Cloudinary https URL) into a valid URI for React Native Image.
 */
export function resolveAvatarUri(avatarUrl: string | null | undefined): string {
  if (!avatarUrl) {
    return toAbsoluteUri(DEFAULT_AVATAR_KEY);
  }

  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }

  return toAbsoluteUri(avatarUrl);
}

export function getAvatarSource(avatarUrl: string | null | undefined): ImageSourcePropType {
  if (!avatarUrl) {
    return DEFAULT_AVATARS[DEFAULT_AVATAR_KEY];
  }

  const normalized = normalizePath(avatarUrl);
  if (DEFAULT_AVATARS[normalized]) {
    return DEFAULT_AVATARS[normalized];
  }

  return { uri: toAbsoluteUri(avatarUrl) };
}

export function getCoverSource(coverUrl: string | null | undefined): ImageSourcePropType {
  if (!coverUrl) {
    return DEFAULT_BACKGROUNDS[DEFAULT_COVER_KEY];
  }

  const normalized = normalizePath(coverUrl);
  if (DEFAULT_BACKGROUNDS[normalized]) {
    return DEFAULT_BACKGROUNDS[normalized];
  }

  return { uri: toAbsoluteUri(coverUrl) };
}
