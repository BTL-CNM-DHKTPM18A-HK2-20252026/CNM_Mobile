import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  likes: number;
  isLikedByMe?: boolean;
  myReactionType?: string | null;
  comments: number;
  reactions?: Array<{ type: string; count: number }>;
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

function renderMedia(post: PostCardData, singleImageAspectRatio: number | null, firstPairAspectRatio: number | null) {
  const images = post.images?.length ? post.images.slice(0, 4) : post.image ? [post.image] : [];
  if (images.length === 0) return null;

  const count = images.length;
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
        <Image
          source={{ uri: images[0] }}
          style={[styles.singleImage, { aspectRatio: singleImageAspectRatio ?? 1 }]}
          contentFit="contain"
          transition={120}
        />
      ) : count === 2 ? (
        <View style={[styles.twoImageRow, { height: pairHeight }]}> 
          {images.map((uri, index) => (
            <Image
              key={uri + index}
              source={{ uri }}
              style={[
                styles.twoImageTile,
                { width: squareSize, height: pairHeight, marginRight: index === 0 ? gutter : 0 },
              ]}
              contentFit="cover"
              transition={120}
            />
          ))}
        </View>
      ) : count === 3 ? (
        <View style={styles.threeImageLayout}>
          <Image
            source={{ uri: images[0] }}
            style={[styles.threeMainImage, { width: '100%', height: topImageHeight, marginBottom: gutter }]}
            contentFit="cover"
            transition={120}
          />
          <View style={styles.threeBottomRow}>
            {images.slice(1, 3).map((uri, index) => (
              <Image
                key={uri + index}
                source={{ uri }}
                style={[
                  styles.threeBottomTile,
                  { width: squareSize, height: squareSize, marginRight: index === 0 ? gutter : 0 },
                ]}
                contentFit="cover"
                transition={120}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.fourGrid}>
          {images.map((uri, index) => {
            const isLastVisibleTile = index === 3;
            const extraCount = (post.images?.length || 0) - 4;
            const isLeftColumn = index % 2 === 0;
            const isTopRow = index < 2;

            return (
              <View
                key={uri + index}
                style={[
                  styles.fourGridTile,
                  {
                    width: squareSize,
                    height: squareSize,
                    marginRight: isLeftColumn ? gutter : 0,
                    marginBottom: isTopRow ? gutter : 0,
                  },
                ]}
              >
                <Image source={{ uri }} style={styles.fourGridImage} contentFit="cover" transition={120} />
                {isLastVisibleTile && (post.images?.length || 0) > 4 ? (
                  <View style={styles.moreOverlay}>
                    <Text style={styles.moreOverlayText}>+{extraCount}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {!post.isSponsored ? (
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
  const images = post.images?.length ? post.images.slice(0, 4) : post.image ? [post.image] : [];
  const singleImageAspectRatio = useImageAspectRatio(images.length === 1 ? images[0] : null);
  const firstPairAspectRatio = useImageAspectRatio(images.length === 2 ? images[0] : null);

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

      {renderMedia(post, singleImageAspectRatio, firstPairAspectRatio)}

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
    backgroundColor: '#f5f5f5',
    alignSelf: 'stretch',
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
  muteButton: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', marginTop: 12, paddingHorizontal: 12, alignItems: 'center' },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  actionItem: { flexDirection: 'row', alignItems: 'center', marginRight: 24, backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  actionCount: { marginLeft: 6, fontSize: 13, color: '#333', fontWeight: '500' },
  reactionEmoji: { fontSize: 20, marginRight: 4 },
});