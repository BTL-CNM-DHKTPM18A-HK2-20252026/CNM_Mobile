import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ResizeMode, Video } from 'expo-av';
import React, { useEffect, useState } from 'react';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Dimensions, FlatList, Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MediaViewer } from '@/components/chat/MediaViewer';
import { getAvatarSource } from '@/services/mediaUtils';

const { width } = Dimensions.get('window');

export type PostCardData = {
  id: string;
  authorId?: string;
  author: string;
  avatar?: string;
  time: string;
  text?: string;
  images?: string[];
  image?: string | null;
  mediaType?: 'IMAGE' | 'VIDEO' | string;
  hasVideo?: boolean;
  likes: number;
  isLikedByMe?: boolean;
  myReactionType?: string | null;
  comments: number;
  reactions?: { type: string; count: number }[];
  isSponsored?: boolean;
};

type PostCardProps = {
  post: PostCardData;
  onMenuPress?: (postId: string) => void;
  onToggleLike?: (postId: string) => void;
  onLongPressLike?: (postId: string) => void;
  onCommentPress?: (postId: string) => void;
  showMenu?: boolean;
  showActions?: boolean;
};

type MediaItem = {
  uri: string;
  type: 'image' | 'video';
};

const REACTION_TO_EMOJI: Record<string, string> = {
  LOVE: '❤️',
  HAHA: '😆',
  WOW: '😮',
  SAD: '😭',
  ANGRY: '😡',
  LIKE: '👍',
};

function reactionTypeToEmoji(type?: string | null) {
  if (!type) return '👍';
  return REACTION_TO_EMOJI[type] || '👍';
}

function isVideoUri(uri?: string | null) {
  if (!uri) return false;
  const normalized = uri.split('?')[0].toLowerCase();
  return normalized.endsWith('.mp4') || normalized.endsWith('.mov') || normalized.endsWith('.m4v') || normalized.endsWith('.webm') || normalized.endsWith('.m3u8');
}

function hasVideoMedia(post: PostCardData) {
  if (post.hasVideo || post.mediaType === 'VIDEO') return true;
  if (isVideoUri(post.image)) return true;
  return (post.images || []).some((uri) => isVideoUri(uri));
}

function buildMediaItems(post: PostCardData): MediaItem[] {
  // keep all media for the viewer (UI will still only render first 4 tiles)
  const uris = post.images?.length ? post.images : post.image ? [post.image] : [];
  return uris.filter(Boolean).map((uri) => ({
    uri,
    type: isVideoUri(uri) ? 'video' : 'image',
  }));
}

function useImageAspectRatio(imageUri?: string | null) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!imageUri) {
      setAspectRatio(null);
      return;
    }

    let isActive = true;

    RNImage.getSize(
      imageUri,
      (imageWidth, imageHeight) => {
        if (isActive && imageWidth > 0 && imageHeight > 0) {
          setAspectRatio(imageWidth / imageHeight);
        }
      },
      () => {
        if (isActive) {
          setAspectRatio(null);
        }
      },
    );

    return () => {
      isActive = false;
    };
  }, [imageUri]);

  return aspectRatio;
}

function renderMedia(
  post: PostCardData,
  mediaItems: MediaItem[],
  singleImageAspectRatio: number | null,
  firstPairAspectRatio: number | null,
  onOpenViewer: (index: number) => void,
  thumbnails: Record<string, string>,
) {
  if (mediaItems.length === 0) return null;

  // Only render up to 4 tiles in the post UI, but viewer will show all mediaItems
  const visibleItems = mediaItems.slice(0, 4);
  const count = visibleItems.length;
  const gutter = 2;
  const mediaInset = 12;
  const innerWidth = width - mediaInset * 2;
  const squareSize = (innerWidth - gutter) / 2;
  const topImageHeight = innerWidth * 0.65;
  const pairHeight = firstPairAspectRatio ? squareSize / firstPairAspectRatio : squareSize;

  return (
    <View
      style={[
        styles.imageContainer,
        {
          height:
            count === 1
              ? undefined
              : count === 2
                ? pairHeight
                : count === 3
                  ? topImageHeight + gutter + squareSize
                  : squareSize * 2 + gutter,
        },
      ]}
    >
      {count === 1 ? (
        <TouchableOpacity activeOpacity={0.95} onPress={() => onOpenViewer(0)}>
          {visibleItems[0].type === 'video' ? (
            thumbnails[visibleItems[0].uri] ? (
              <View style={[styles.singleImage, { aspectRatio: singleImageAspectRatio ?? 1 }]}> 
                <Image source={{ uri: thumbnails[visibleItems[0].uri] }} style={[styles.singleImage, { aspectRatio: singleImageAspectRatio ?? 1 }]} contentFit="cover" />
                <View style={styles.playOverlay} pointerEvents="none">
                  <Ionicons name="play" size={36} color="#fff" />
                </View>
              </View>
            ) : (
              <View style={[styles.singleImage, styles.videoPreview, { aspectRatio: singleImageAspectRatio ?? 1 }]}> 
                <Ionicons name="videocam" size={34} color="#fff" />
                <Text style={styles.videoPreviewText}>Video</Text>
              </View>
            )
          ) : (
            <Image
              source={{ uri: visibleItems[0].uri }}
              style={[styles.singleImage, { aspectRatio: singleImageAspectRatio ?? 1 }]}
              contentFit="contain"
              transition={120}
            />
          )}
        </TouchableOpacity>
      ) : count === 2 ? (
        <View style={[styles.twoImageRow, { height: pairHeight }]}> 
          {visibleItems.map((item, index) => (
            <TouchableOpacity
              key={item.uri + index}
              style={[
                styles.twoImageTile,
                { width: squareSize, height: pairHeight, marginRight: index === 0 ? gutter : 0 },
              ]}
              activeOpacity={0.95}
              onPress={() => onOpenViewer(index)}
            >
              {item.type === 'video' ? (
                thumbnails[item.uri] ? (
                  <View style={styles.fillImage}>
                    <Image source={{ uri: thumbnails[item.uri] }} style={styles.fillImage} contentFit="cover" />
                    <View style={styles.playOverlaySmall} pointerEvents="none">
                      <Ionicons name="play" size={22} color="#fff" />
                    </View>
                  </View>
                ) : (
                  <View style={styles.videoPreview}>
                    <Ionicons name="videocam" size={30} color="#fff" />
                    <Text style={styles.videoPreviewText}>Video</Text>
                  </View>
                )
              ) : (
                <Image
                  source={{ uri: item.uri }}
                  style={styles.fillImage}
                  contentFit="cover"
                  transition={120}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : count === 3 ? (
        <View style={styles.threeImageLayout}>
          <TouchableOpacity activeOpacity={0.95} onPress={() => onOpenViewer(0)}>
            {visibleItems[0].type === 'video' ? (
              <View style={[styles.threeMainImage, styles.videoPreview, { width: '100%', height: topImageHeight, marginBottom: gutter }]}> 
                <Ionicons name="videocam" size={30} color="#fff" />
                <Text style={styles.videoPreviewText}>Video</Text>
              </View>
            ) : (
              <Image
                source={{ uri: visibleItems[0].uri }}
                style={[styles.threeMainImage, { width: '100%', height: topImageHeight, marginBottom: gutter }]}
                contentFit="cover"
                transition={120}
              />
            )}
          </TouchableOpacity>
          <View style={styles.threeBottomRow}>
            {visibleItems.slice(1, 3).map((item, index) => (
              <TouchableOpacity
                key={item.uri + index}
                style={[
                  styles.threeBottomTile,
                  { width: squareSize, height: squareSize, marginRight: index === 0 ? gutter : 0 },
                ]}
                activeOpacity={0.95}
                onPress={() => onOpenViewer(index + 1)}
              >
                {item.type === 'video' ? (
                  thumbnails[item.uri] ? (
                    <View style={styles.fillImage}>
                      <Image source={{ uri: thumbnails[item.uri] }} style={styles.fillImage} contentFit="cover" />
                      <View style={styles.playOverlaySmall} pointerEvents="none">
                        <Ionicons name="play" size={20} color="#fff" />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.videoPreview}>
                      <Ionicons name="videocam" size={26} color="#fff" />
                      <Text style={styles.videoPreviewText}>Video</Text>
                    </View>
                  )
                ) : (
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.fillImage}
                    contentFit="cover"
                    transition={120}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.fourGrid}>
          {visibleItems.map((item, index) => {
            const isLastVisibleTile = index === 3;
            const extraCount = (post.images?.length || 0) - 4;
            const isLeftColumn = index % 2 === 0;
            const isTopRow = index < 2;

            return (
              <TouchableOpacity
                key={item.uri + index}
                style={[
                  styles.fourGridTile,
                  {
                    width: squareSize,
                    height: squareSize,
                    marginRight: isLeftColumn ? gutter : 0,
                    marginBottom: isTopRow ? gutter : 0,
                  },
                ]}
                activeOpacity={0.95}
                onPress={() => onOpenViewer(index)}
              >
                {item.type === 'video' ? (
                  thumbnails[item.uri] ? (
                    <View style={styles.fourGridImage}>
                      <Image source={{ uri: thumbnails[item.uri] }} style={styles.fourGridImage} contentFit="cover" />
                      <View style={styles.playOverlaySmall} pointerEvents="none">
                        <Ionicons name="play" size={22} color="#fff" />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.videoPreview}>
                      <Ionicons name="videocam" size={28} color="#fff" />
                      <Text style={styles.videoPreviewText}>Video</Text>
                    </View>
                  )
                ) : (
                  <Image source={{ uri: item.uri }} style={styles.fourGridImage} contentFit="cover" transition={120} />
                )}
                {isLastVisibleTile && (post.images?.length || 0) > 4 ? (
                  <View style={styles.moreOverlay}>
                    <Text style={styles.moreOverlayText}>+{extraCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {hasVideoMedia(post) ? (
        <View style={styles.muteButton}>
          <Ionicons name="volume-mute" size={16} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

export function PostCard({
  post,
  onMenuPress,
  onToggleLike,
  onLongPressLike,
  onCommentPress,
  showMenu = true,
  showActions = true,
}: PostCardProps) {
  const canShowMenu = showMenu && typeof onMenuPress === 'function';
  const mediaItems = buildMediaItems(post);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const singleImageAspectRatio = useImageAspectRatio(mediaItems.length === 1 && mediaItems[0].type === 'image' ? mediaItems[0].uri : null);
  const firstPairAspectRatio = useImageAspectRatio(mediaItems.length === 2 && mediaItems[0].type === 'image' ? mediaItems[0].uri : null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  useEffect(() => {
    let mounted = true;
    const generate = async () => {
      for (const item of mediaItems) {
        if (item.type === 'video' && !thumbnails[item.uri]) {
          try {
            const res = await VideoThumbnails.getThumbnailAsync(item.uri, { time: 1000 });
            if (mounted && res?.uri) setThumbnails(prev => ({ ...prev, [item.uri]: res.uri }));
          } catch (err) {
            // ignore thumbnail errors
            console.warn('Video thumbnail error', err);
          }
        }
      }
    };

    generate();
    return () => { mounted = false; };
  }, [mediaItems, thumbnails]);

  return (
    <View style={styles.card}>
      <View style={styles.postHeader}>
        <Image source={getAvatarSource(post.avatar)} style={styles.avatar} contentFit="cover" transition={100} />
        <View style={styles.headerTextWrap}>
          <Text style={styles.author}>{post.author}</Text>
          <View style={styles.timeRow}>
            {post.isSponsored ? <Text style={styles.sponsoredText}>Được tài trợ</Text> : <Text style={styles.time}>{post.time}</Text>}
          </View>
        </View>

        {canShowMenu ? (
          <TouchableOpacity style={styles.moreButton} onPress={() => onMenuPress(post.id)}>
            <Ionicons name="ellipsis-horizontal" size={16} color="#727272" />
          </TouchableOpacity>
        ) : null}
      </View>

      {post.text ? <Text style={styles.contentText}>{post.text}</Text> : null}

      {renderMedia(post, mediaItems, singleImageAspectRatio, firstPairAspectRatio, openViewer, thumbnails)}

      <MediaViewer visible={viewerVisible} onClose={() => setViewerVisible(false)}>
        <View style={styles.viewerBackdrop}>
          <TouchableOpacity style={styles.viewerCloseButton} onPress={() => setViewerVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <FlatList
            key={`viewer-${viewerIndex}`}
            data={mediaItems}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            keyExtractor={(item, index) => `${item.uri}-${index}`}
            renderItem={({ item }) => (
              <View style={styles.viewerPage}>
                {item.type === 'video' ? (
                  <Video
                    source={{ uri: item.uri }}
                    style={styles.viewerMedia}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                  />
                ) : (
                  <Image source={{ uri: item.uri }} style={styles.viewerMedia} contentFit="contain" transition={120} />
                )}
              </View>
            )}
          />
        </View>
      </MediaViewer>

      {showActions ? (
        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => onToggleLike?.(post.id)}
              onLongPress={() => onLongPressLike?.(post.id)}
              delayLongPress={250}
            >
              {post.myReactionType ? (
                <Text style={styles.reactionEmoji}>{reactionTypeToEmoji(post.myReactionType)}</Text>
              ) : (
                <Ionicons name={post.isLikedByMe ? 'heart' : 'heart-outline'} size={22} color={post.isLikedByMe ? '#e91e63' : '#111'} />
              )}
              {post.likes > 0 ? <Text style={styles.actionCount}>{post.likes}</Text> : null}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={() => onCommentPress?.(post.id)}>
              <Ionicons name="chatbubble-outline" size={20} color="#111" />
              {post.comments > 0 ? <Text style={styles.actionCount}>{post.comments}</Text> : null}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 6,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  headerTextWrap: { flex: 1 },
  author: { fontWeight: '600', fontSize: 15, color: '#000' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  time: { fontSize: 12, color: '#757575' },
  sponsoredText: { fontSize: 12, color: '#757575' },
  moreButton: { padding: 4 },
  contentText: { marginTop: 10, paddingHorizontal: 12, fontSize: 15, color: '#1c1c1c', lineHeight: 21 },
  imageContainer: {
    marginTop: 10,
    marginHorizontal: 12,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#fff',
    alignSelf: 'stretch',
    borderRadius: 8,
  },
  singleImage: { width: '100%' },
  twoImageRow: { flexDirection: 'row', width: '100%' },
  twoImageTile: { position: 'relative', overflow: 'hidden' },
  fillImage: { width: '100%', height: '100%' },
  threeImageLayout: { width: '100%', height: '100%' },
  threeMainImage: { width: '100%' },
  threeBottomRow: { flexDirection: 'row', width: '100%', height: width / 2 },
  threeBottomTile: { height: '100%' },
  fourGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%' },
  fourGridTile: { position: 'relative', overflow: 'hidden' },
  fourGridImage: { width: '100%', height: '100%' },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreOverlayText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  muteButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPreviewText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 },
  playOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  playOverlaySmall: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', marginTop: 12, paddingHorizontal: 12, alignItems: 'center' },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  actionItem: { flexDirection: 'row', alignItems: 'center', marginRight: 24, backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  actionCount: { marginLeft: 6, fontSize: 13, color: '#333', fontWeight: '500' },
  reactionEmoji: { fontSize: 20, marginRight: 4 },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewerCloseButton: {
    position: 'absolute',
    top: 52,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerPage: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerMedia: {
    width: '100%',
    height: '100%',
  },
});
