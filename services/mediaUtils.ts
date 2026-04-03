const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3000';

/**
 * Resolves an avatar_url (which may be a relative path like /default/image3.jpg
 * or a full Cloudinary https URL) into a valid URI for React Native Image.
 */
export function resolveAvatarUri(avatarUrl: string | null | undefined): string {
  if (!avatarUrl) return `${WEB_URL}/default/image1.jpg`;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  // Relative path — prefix with web base URL
  return `${WEB_URL}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`;
}
