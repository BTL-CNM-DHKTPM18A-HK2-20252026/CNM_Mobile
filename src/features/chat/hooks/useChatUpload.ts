import { useCallback, useState } from 'react';
import { chatFileService, type PickedMedia } from '@/services/chatFileService';
import { chatService } from '@/services/chatService';
import type { ChatUiMessage } from '@/services/chatMessageAdapter';
import { mapChatPayloadToUiMessage } from '@/services/chatMessageAdapter';

interface UseChatUploadOptions {
  conversationId: string | null;
  mergeUniqueMessages?: (prev: ChatUiMessage[], next: ChatUiMessage[]) => ChatUiMessage[];
  requestScrollToLatest?: (animated: boolean) => void;
}

interface UseChatUploadReturn {
  uploadProgress: number;
  uploadCurrentIndex: number;
  isUploading: boolean;
  uploadMedia: (items: PickedMedia[]) => Promise<void>;
  cancelUpload: () => void;
}

export function useChatUpload({
  conversationId,
  mergeUniqueMessages,
  requestScrollToLatest,
}: UseChatUploadOptions): UseChatUploadReturn {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCurrentIndex, setUploadCurrentIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMedia = useCallback(async (items: PickedMedia[]) => {
    if (!conversationId || items.length === 0 || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadCurrentIndex(0);

    const allImages = items.every((m) => m.mediaType === 'IMAGE');
    const isAlbum = allImages && items.length > 1;

    try {
      const s3Urls: string[] = [];
      for (let i = 0; i < items.length; i++) {
        setUploadCurrentIndex(i);
        const s3Url = await chatFileService.uploadMedia(items[i], (progress) => {
          const overall = Math.round(((i * 100 + progress.percent) / items.length));
          setUploadProgress(overall);
        });
        s3Urls.push(s3Url);
      }

      if (isAlbum) {
        // IMAGE_GROUP: single message with all URLs
        const response = await chatService.sendMessage(conversationId, {
          content: s3Urls[0],
          messageType: 'IMAGE_GROUP',
          mediaUrls: s3Urls,
        });
        return mapChatPayloadToUiMessage(response);
      } else {
        // Single media: send one by one
        const results: (ChatUiMessage | null)[] = [];
        for (const url of s3Urls) {
          const mediaItem = items[s3Urls.indexOf(url)];
          const response = await chatService.sendMessage(conversationId, {
            content: url,
            messageType: mediaItem.mediaType as string,
            fileName: mediaItem.fileName,
            fileSize: mediaItem.fileSize,
          });
          results.push(mapChatPayloadToUiMessage(response));
        }
        return results.filter(Boolean);
      }
    } catch (err) {
      console.error('[useChatUpload] uploadMedia failed:', err);
      throw err;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadCurrentIndex(0);
    }
  }, [conversationId, isUploading, mergeUniqueMessages, requestScrollToLatest]);

  const cancelUpload = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadCurrentIndex(0);
  }, []);

  return {
    uploadProgress,
    uploadCurrentIndex,
    isUploading,
    uploadMedia,
    cancelUpload,
  };
}
