import { COLORS } from '@/constants/theme';
import { PostCard, type PostCardData } from '@/components/post/PostCard';
import { useTheme } from '@/context/ThemeContext';
import { authService } from '@/services/authService';
import api from '@/services/api';
import { getAvatarSource, getCoverSource } from '@/services/mediaUtils';
import { Ionicons, Feather  } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PersonalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; name?: string; avatar?: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const viewedUserId = String(params.userId ?? '').trim();
  const viewedUserName = String(params.name ?? '').trim();
  const viewedUserAvatar = String(params.avatar ?? '').trim();

  // Profile data state
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);
  const [commentModalPostId, setCommentModalPostId] = useState<string | null>(null);
  const [commentList, setCommentList] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);

  const inferHasVideo = (media: any, mediaUrl?: string | null) => {
    const isVideoUrl = (uri?: string | null) => {
      if (!uri) return false;
      const normalized = uri.split('?')[0].toLowerCase();
      return normalized.endsWith('.mp4') || normalized.endsWith('.mov') || normalized.endsWith('.m4v') || normalized.endsWith('.webm') || normalized.endsWith('.m3u8');
    };

    if (typeof media?.mediaType === 'string' && media.mediaType.toUpperCase() === 'VIDEO') return true;
    if (typeof media?.type === 'string' && media.type.toUpperCase() === 'VIDEO') return true;
    if (typeof media?.contentType === 'string' && media.contentType.toLowerCase().startsWith('video/')) return true;
    if (isVideoUrl(mediaUrl)) return true;

    if (Array.isArray(media)) {
      return media.some((item) => {
        const itemType = String(item?.mediaType || item?.type || item?.contentType || '').toUpperCase();
        const itemUrl = typeof item === 'string' ? item : (item?.url || item?.mediaUrl || item?.source || item?.uri);
        return itemType === 'VIDEO' || String(item?.contentType || '').toLowerCase().startsWith('video/') || isVideoUrl(itemUrl);
      });
    }

    return false;
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
    }, [])
  );

  function formatPostTime(createdAtString?: string | null): string {
    if (!createdAtString) return 'Vừa xong';

    const createdTime = new Date(createdAtString).getTime();
    const now = Date.now();
    const diffInSeconds = Math.floor((now - createdTime) / 1000);

    if (diffInSeconds < 60) return 'Vừa xong';

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} phút`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} giờ`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} ngày`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} tháng`;
    }

    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} năm`;
  }

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      if (viewedUserId) {
        setProfile({
          id: viewedUserId,
          userId: viewedUserId,
          full_name: viewedUserName || t('profile.guest_user'),
          displayName: viewedUserName || t('profile.guest_user'),
          avatar_url: viewedUserAvatar || null,
          bio: '',
        });
        await fetchUserPosts(viewedUserId);
      } else {
        const data = await authService.getProfile();

        if (data && (data.full_name || data.id)) {
          setProfile(data);
          await fetchUserPosts(String(data.id || data.userId || data.user_id));
        } else {
          Alert.alert(t('profile.error_title'), t('profile.error_loading'));
          setPosts([]);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert(t('profile.error_title'), t('profile.error_loading'));
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async (userId: string) => {
    try {
      const res: any = await api.get(`/posts/user/${userId}?page=0&size=20`);
      const list = Array.isArray(res) ? res : res?.content || res?.data || [];
      const mapped: PostCardData[] = (list || []).map((p: any) => ({
        id: String(p.id || p.postId || p._id || Date.now()),
        authorId: String(p.authorId || p.userId || p.createdById || p.createdBy || ''),
        author: p.author?.displayName || p.authorName || p.createdBy || p.userName || 'Người dùng',
        avatar: p.authorAvatarUrl || p.avatarUrl || null,
        time: formatPostTime(p.createdAt),
        text: p.content || p.text || p.body || '',
        images: Array.isArray(p.media) && p.media.length > 0
          ? p.media.map((m: any) => m.url || m)
          : (p.images && Array.isArray(p.images) ? p.images : (p.image ? [p.image] : [])),
        image: (p.media && p.media[0]?.url) || p.image || null,
        mediaType: p.mediaType || (inferHasVideo(p.media, p.media?.[0]?.url || p.image) ? 'VIDEO' : 'IMAGE'),
        hasVideo: inferHasVideo(p.media, p.media?.[0]?.url || p.image),
        likes: p.likeCount || p.likes || 0,
        isLikedByMe: p.isLikedByMe || false,
        myReactionType: p.myReactionType || null,
        reactions: p.reactionCounts ? Object.entries(p.reactionCounts).map(([k, v]) => ({ type: k, count: Number(v) || 0 })) : undefined,
        comments: p.commentCount || p.comments || 0,
        isSponsored: p.isSponsored || false,
      }));
      setPosts(mapped);
    } catch (error) {
      console.warn('Fetch personal posts error:', error);
      setPosts([]);
    }
  };

  const REACTION_EMOJIS = ['❤️', '👍', '😆', '😮', '😭', '😡'] as const;

  const emojiToReactionType = (emoji: string): 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY' => {
    switch (emoji) {
      case '❤️': return 'LOVE';
      case '😆': return 'HAHA';
      case '😮': return 'WOW';
      case '😭': return 'SAD';
      case '😡': return 'ANGRY';
      default: return 'LIKE';
    }
  };

  const updatePostFromResponse = (postId: string, res: any) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== String(res.postId || res.id || postId)) return p;
      return {
        ...p,
        likes: res.likeCount ?? p.likes,
        comments: res.commentCount ?? p.comments,
        isLikedByMe: res.isLikedByMe ?? p.isLikedByMe,
        myReactionType: res.myReactionType ?? p.myReactionType,
        reactions: res.reactionCounts
          ? Object.entries(res.reactionCounts).map(([k, v]) => ({ type: k, count: Number(v) || 0 }))
          : p.reactions,
      };
    }));
  };

  const toggleLike = async (postId: string) => {
    try {
      const existing = posts.find((post) => post.id === postId);
      setPosts((prev) => prev.map((post) => {
        if (post.id !== postId) return post;
        if (post.isLikedByMe) {
          return { ...post, isLikedByMe: false, myReactionType: null, likes: Math.max(0, (post.likes || 1) - 1) };
        }
        return { ...post, isLikedByMe: true, myReactionType: 'LIKE', likes: (post.likes || 0) + 1 };
      }));

      if (existing?.isLikedByMe) {
        const res = await api.delete(`/posts/${postId}/like`);
        updatePostFromResponse(postId, res);
      } else {
        const res = await api.post(`/posts/${postId}/react/LIKE`);
        updatePostFromResponse(postId, res);
      }
    } catch (error) {
      console.warn('Toggle like error', error);
    }
  };

  const reactWith = async (postId: string, emoji: string) => {
    try {
      const reactionType = emojiToReactionType(emoji);
      setPosts((prev) => prev.map((post) => {
        if (post.id !== postId) return post;
        const alreadyLiked = !!post.isLikedByMe;
        return { ...post, isLikedByMe: true, myReactionType: reactionType, likes: alreadyLiked ? post.likes : (post.likes || 0) + 1 };
      }));
      const res = await api.post(`/posts/${postId}/react/${reactionType}`);
      updatePostFromResponse(postId, res);
      setReactionPickerPostId(null);
    } catch (error) {
      console.warn('React error', error);
    }
  };

  const openCommentModal = async (postId: string) => {
    try {
      const res: any = await api.get(`/posts/${postId}/comments`);
      setCommentList(Array.isArray(res) ? res : (res || []));
      setCommentModalPostId(postId);
    } catch (error) {
      console.warn('Fetch comments error', error);
    }
  };

  const submitComment = async () => {
    if (!commentModalPostId || !commentInput.trim()) return;
    try {
      const body = { content: commentInput.trim() };
      const res = await api.post(`/posts/${commentModalPostId}/comments`, body);
      setPosts((prev) => prev.map((post) => post.id === commentModalPostId ? { ...post, comments: (post.comments || 0) + 1 } : post));
      setCommentInput('');
      setCommentList((prev) => [res, ...prev]);
    } catch (error) {
      console.warn('Submit comment error', error);
    }
  };

  const handleChangeAvatar = async () => {
    // 1. Xin quyền và chọn ảnh
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Quyền truy cập", "Bạn cần cho phép truy cập thư viện ảnh");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `avatar_${Date.now()}.jpg`;
      const fileType = asset.mimeType || 'image/jpeg';

      try {
        setLoading(true);
        
        // 2. Lấy Presigned URL
        const presignedUrl = await authService.getAvatarPresignedUrl(fileName, fileType);
        
        // 3. Upload lên S3
        await authService.uploadToS3(presignedUrl, asset.uri, fileType);
        
        // 4. Lấy link sạch (bỏ các query params của S3 nếu có)
        const cleanUrl = presignedUrl.split('?')[0];
        
        // 5. Cập nhật vào Database
        const success = await authService.updateAvatar(cleanUrl);
        
        if (success) {
          setProfile((prev: any) => ({ ...prev, avatar_url: cleanUrl }));
          await fetchUserPosts(String(profile?.id || profile?.userId || profile?.user_id));
          Alert.alert("Thành công", "Đã cập nhật ảnh đại diện");
        }
      } catch (error) {
        console.error(error);
        Alert.alert("Lỗi", "Không thể upload ảnh");
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Cover Photo */}
        <View style={styles.coverPhotoContainer}>
          <Image
            source={getCoverSource(profile?.cover_photo_url)}
            style={styles.coverPhoto}
            defaultSource={require('@/assets/images/icon.png')}
          />
          <View style={[styles.headerOverlay, { paddingTop: insets.top + 12, height: 60 + insets.top }]}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/personal-menu')}>
              <Feather name="more-horizontal" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar Section */}
        <View style={[styles.avatarSection, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={handleChangeAvatar}>
            <View style={[styles.avatarBorder, { borderColor: colors.card }]}> 
              <Image
                source={getAvatarSource(profile?.avatar_url)}
                style={styles.avatar}
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.body, { backgroundColor: colors.background }]}> 
          {/* Name */}
          <Text style={[styles.name, { color: colors.text }]}>{profile?.full_name || t('profile.guest_user')}</Text>

          {/* Bio */}
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {profile?.bio || t('profile.bio_default')}
          </Text>

          <View style={styles.postsSection}>
            <View style={{backgroundColor: '#ddd', height: 8}}></View>
            {posts.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <View style={styles.emptyStateVisual}>
                  <View style={styles.emptyStateGlow} />
                  <View style={styles.emptyStateBubbleLeft}>
                    <Ionicons name="heart" size={18} color="#ef4444" />
                  </View>
                  <View style={styles.emptyStateBubbleRight}>
                    <Ionicons name="chatbubble-ellipses" size={16} color="#22c55e" />
                  </View>
                  <View style={styles.emptyStateDevice}>
                    <ExpoImage
                      source={require('@/assets/images/icon.png')}
                      style={styles.emptyStateImage}
                      contentFit="contain"
                    />
                  </View>
                </View>

                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Hôm nay {profile?.full_name || t('profile.guest_user')} có gì vui?</Text>
                <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
                  Đây là Nhật ký của bạn - Hãy làm đầy Nhật ký với những dấu ấn cuộc đời và kỷ niệm đáng nhớ nhé!
                </Text>

                <TouchableOpacity style={[styles.emptyStateButton, { backgroundColor: COLORS.primary }]} onPress={() => router.push('/create-post')}>
                  <Text style={styles.emptyStateButtonText}>Đăng lên Nhật ký</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.postsList}>
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onMenuPress={setActiveMenuPostId}
                    onToggleLike={toggleLike}
                    onLongPressLike={setReactionPickerPostId}
                    onCommentPress={openCommentModal}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!reactionPickerPostId} transparent animationType="fade" onRequestClose={() => setReactionPickerPostId(null)}>
        <View style={styles.reactionModalBackdrop}>
          <View style={styles.reactionPicker}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => reactWith(reactionPickerPostId as string, emoji)} style={styles.reactionEmojiButton}>
                <Text style={styles.reactionEmojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={!!commentModalPostId} transparent animationType="slide" onRequestClose={() => setCommentModalPostId(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCommentModalPostId(null)} />
        <View style={styles.bottomSheetContainer}>
          <View style={styles.bottomSheetContent}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetHeaderTitle}>Bình luận</Text>
              <TouchableOpacity onPress={() => setCommentModalPostId(null)}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.commentListWrapper}>
              {commentList.length === 0 ? (
                <View style={styles.emptyComments}>
                  <Text style={{ color: '#888' }}>Chưa có bình luận nào</Text>
                </View>
              ) : (
                <FlatList
                  data={commentList}
                  keyExtractor={(c, index) => c.commentId || c.id || String(index)}
                  renderItem={({ item }) => (
                    <View style={styles.commentItem}>
                      <Image source={getAvatarSource(item.avatar || item.userAvatar || item.authorAvatar)} style={styles.commentAvatar} />
                      <View style={styles.commentBody}>
                        <Text style={styles.commentUser}>{item.userName || item.authorName || 'Người dùng'}</Text>
                        <Text style={styles.commentText}>{item.content}</Text>
                      </View>
                    </View>
                  )}
                />
              )}
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder="Viết bình luận..."
                placeholderTextColor="#999"
                style={styles.bottomSheetInput}
                multiline={false}
              />
              <TouchableOpacity
                onPress={submitComment}
                style={[styles.sendButton, { backgroundColor: commentInput.trim() ? '#0082f6' : '#e0e0e0' }]}
                disabled={!commentInput.trim()}
              >
                <Ionicons name="send" size={16} color={commentInput.trim() ? '#fff' : '#999'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!activeMenuPostId}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveMenuPostId(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActiveMenuPostId(null)}
        />

        <View style={[styles.menuBottomSheetContainer, { paddingBottom: insets.bottom || 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.menuOptionsList}>
            <TouchableOpacity style={styles.menuItem} onPress={() => setActiveMenuPostId(null)}>
              <Ionicons name="trash-outline" size={24} color="#555" style={styles.menuIcon} />
              <View style={styles.menuTextContent}>
                <Text style={styles.menuItemTitle}>Xóa bài đăng</Text>
                <Text style={styles.menuItemSubtitle}>Bài đăng này sẽ ẩn khỏi nhật ký</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => setActiveMenuPostId(null)}>
              <Ionicons name="alert-circle-outline" size={24} color="#555" style={styles.menuIcon} />
              <View style={styles.menuTextContent}>
                <Text style={styles.menuItemTitle}>Báo xấu</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setActiveMenuPostId(null)}>
              <Ionicons name="person-remove-outline" size={24} color="#ff3b30" style={styles.menuIcon} />
              <View style={styles.menuTextContent}>
                <Text style={[styles.menuItemTitle, { color: '#ff3b30' }]}>Xóa bạn</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPhotoContainer: {
    position: 'relative',
    height: 220,
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
  },
  avatarSection: {
    alignItems: 'center',
   
    marginBottom: 20,
    zIndex: 10,
    position: 'absolute',
    top: 160,
    alignSelf: "center",
    borderRadius: 60
  },
  avatarBorder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    padding: 2,
    position: 'relative',
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  postsSection: {
    marginTop: 8,
    paddingBottom: 20,
    marginHorizontal: -16,
  },
  postsList: {
    marginTop: 4,
    width: '100%',
  },
  emptyStateCard: {
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
  },
  emptyStateVisual: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  emptyStateGlow: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(24, 119, 242, 0.08)',
  },
  emptyStateDevice: {
    width: 76,
    height: 108,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(180, 195, 210, 0.75)',
    backgroundColor: '#fff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9db2c9',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  emptyStateImage: {
    width: 46,
    height: 46,
    opacity: 0.86,
  },
  emptyStateBubbleLeft: {
    position: 'absolute',
    left: 10,
    top: 76,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#b6b6b6',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  emptyStateBubbleRight: {
    position: 'absolute',
    right: 10,
    top: 54,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#b6b6b6',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  emptyStateTitle: {
    marginTop: 6,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateDescription: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  emptyStateButton: {
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
    minWidth: 160,
    alignItems: 'center',
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  reactionModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPicker: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
  },
  reactionEmojiButton: {
    padding: 8,
  },
  reactionEmojiText: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  bottomSheetContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#dbdbdb',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  sheetHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  commentListWrapper: {
    flex: 1,
  },
  emptyComments: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f9f9f9',
  },
  commentUser: {
    fontWeight: '600',
    fontSize: 14,
    color: '#333',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentBody: {
    flex: 1,
  },
  commentText: {
    marginTop: 3,
    fontSize: 14,
    color: '#111',
    lineHeight: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  bottomSheetInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#000',
  },
  sendButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuBottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '55%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  menuOptionsList: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f2f2f2',
  },
  menuIcon: {
    width: 28,
    marginRight: 14,
    textAlign: 'center',
  },
  menuTextContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 14,
    color: '#222',
    fontWeight: '400',
  },
  menuItemSubtitle: {
    fontSize: 10,
    color: '#7c7c7c',
    marginTop: 2,
    lineHeight: 13,
  },
});
