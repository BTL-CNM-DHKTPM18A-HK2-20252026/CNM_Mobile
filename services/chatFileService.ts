import api from './api';

export type MediaType = 'IMAGE' | 'VIDEO' | 'FILE';

/** Backend MessageType tương ứng — backend dùng 'MEDIA' cho file, không có 'FILE' */
export type BackendMessageType = 'IMAGE' | 'VIDEO' | 'MEDIA' | 'VOICE';

export interface PickedMedia {
  uri: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  mediaType: MediaType;
  width?: number;
  height?: number;
  duration?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * Map client MediaType → backend MessageType.
 * Backend enum không có 'FILE', dùng 'MEDIA' thay thế.
 */
const toBackendMessageType = (mediaType: MediaType): BackendMessageType => {
  if (mediaType === 'FILE') return 'MEDIA';
  return mediaType;
};

/** Upload raw voice file trực tiếp (không qua PickedMedia) */
const uploadVoice = async (
  uri: string,
  fileName: string,
  mimeType: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> => {
  const presignedUrl = await getPresignedUrl(fileName, mimeType);
  await uploadToS3(presignedUrl, uri, fileName, mimeType, onProgress);
  return getCleanS3Url(presignedUrl);
};

/**
 * Lấy presigned URL từ backend (endpoint /messages/presigned-url)
 * Backend tự phân folder theo fileType: images/, videos/, files/
 */
const getPresignedUrl = async (fileName: string, fileType: string): Promise<string> => {
  const response = await api.get<any, any>(
    `/messages/presigned-url?fileName=${encodeURIComponent(fileName)}&fileType=${encodeURIComponent(fileType)}`
  );

  // Unwrap API response
  if (response && typeof response === 'object' && response.success && response.data !== undefined) {
    return String(response.data);
  }

  return String(response);
};

/**
 * Upload file lên S3 bằng presigned URL.
 * Dùng XMLHttpRequest (native RN) để stream file từ disk, không đọc toàn bộ vào blob.
 * Hỗ trợ progress tracking và kiểm tra response status.
 */
const uploadToS3 = async (
  presignedUrl: string,
  fileUri: string,
  fileName: string,
  fileType: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', fileType);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({ loaded: 1, total: 1, percent: 100 });
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}: ${xhr.responseText?.substring(0, 200)}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('S3 upload network error'));
    };

    xhr.ontimeout = () => {
      reject(new Error('S3 upload timeout'));
    };

    xhr.timeout = 120000; // 2 phút cho file lớn

    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          });
        }
      };
    }

    // React Native hỗ trợ pass { uri, type, name } → stream file từ disk
    xhr.send({ uri: fileUri, type: fileType, name: fileName } as any);
  });
};

/**
 * Lấy public URL (bỏ query params S3 signature)
 */
const getCleanS3Url = (presignedUrl: string): string => {
  return presignedUrl.split('?')[0];
};

/**
 * Xác định MediaType từ mimeType
 */
const resolveMediaType = (mimeType: string): MediaType => {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return 'FILE';
};

/**
 * Format file size hiển thị
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Full upload flow: presigned → S3 → trả về clean URL
 */
const uploadMedia = async (
  media: PickedMedia,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> => {
  // 1. Lấy presigned URL
  const presignedUrl = await getPresignedUrl(media.fileName, media.mimeType);

  // 2. Upload lên S3
  await uploadToS3(presignedUrl, media.uri, media.fileName, media.mimeType, onProgress);

  // 3. Trả về clean URL
  return getCleanS3Url(presignedUrl);
};

export const chatFileService = {
  getPresignedUrl,
  uploadToS3,
  getCleanS3Url,
  uploadMedia,
  uploadVoice,
  resolveMediaType,
  formatFileSize,
  toBackendMessageType,
};
