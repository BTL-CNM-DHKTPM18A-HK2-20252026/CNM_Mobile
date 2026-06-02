import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { PostCard, type PostCardData } from '@/components/post/PostCard';
import StoryCard from '@/components/post/StoryCard';
import StoryViewer from '@/components/post/StoryViewer';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/services/api';
import { authService } from '@/services/authService';
import { getAvatarSource } from '@/services/mediaUtils';

const { width } = Dimensions.get('window');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Post = PostCardData;

const samplePosts: Post[] = [];

function inferHasVideo(media: any, mediaUrl?: string | null) {
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
}

export default function TimelineScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>(samplePosts);
  const [stories, setStories] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);
  const [commentModalPostId, setCommentModalPostId] = useState<string | null>(null);
  const [commentList, setCommentList] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState('');

  // Trạng thái quản lý đóng/mở và id bài viết đang chọn cho Menu 3 chấm
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, []);

  useEffect(() => {
    fetchPosts();
    (async () => {
      const p = await authService.getProfile();
      if (p) setProfile(p);
    })();
    fetchStories();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
      fetchStories();
    }, [])
  );

  const fetchStories = async () => {
    try {
      let userId = profile?.id || profile?.userId || profile?.user_id;
      if (!userId) {
        const p = await authService.getProfile();
        if (p) {
          setProfile(p);
          userId = p.id || p.userId || p.user_id;
        }
      }
      const res: any = await api.get('/stories/feed', { headers: userId ? { 'X-User-Id': String(userId) } : undefined });
      const list = Array.isArray(res) ? res : res?.data || res || [];

      const mapped = (list || []).map((s: any) => ({
        id: s.storyId || s.id,
        name: s.authorName || s.name || 'Bạn bè',
        avatar: s.authorAvatarUrl || s.authorAvatar || s.avatar,
        mediaUrl: s.mediaUrl || s.media || s.cover,
        mediaType: s.mediaType || (s.mediaUrl && s.mediaUrl.endsWith('.mp4') ? 'VIDEO' : 'IMAGE'),
        isViewed: s.isViewedByMe || false,
        // Thêm dòng này để giữ lại nội dung chữ của Story
        caption: s.caption || s.content || s.text || '',
      }));

      setStories(mapped);
    } catch (err) {
      console.warn('Fetch stories error', err);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/posts/feed?size=20`);
      const list = Array.isArray(res) ? res : res?.content || res?.data || [];
      const mapped: Post[] = (list || []).map((p: any) => ({
        id: String(p.id || p.postId || p._id || Date.now()),
        authorId: String(p.authorId || p.userId || p.createdById || p.createdBy || ''),
        author: p.author?.displayName || p.authorName || p.createdBy || p.userName || 'Người dùng',
        avatar:
          p.authorAvatarUrl ||
          p.avatarUrl ||
          null,
        time: formatPostTime(p.createdAt || p.time),
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
        reactions: p.reactionCounts ? Object.entries(p.reactionCounts).map(([k, v]) => ({ type: k, count: v })) : undefined,
        comments: p.commentCount || p.comments || 0,
        isSponsored: p.isSponsored || false,
      }));
      setPosts([...samplePosts, ...mapped]);
    } catch (err) {
      console.warn('Fetch posts error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  const reactionTypeToEmoji = (type?: string | null) => {
    switch (type) {
      case 'LOVE': return '❤️';
      case 'HAHA': return '😆';
      case 'WOW': return '😮';
      case 'SAD': return '😭';
      case 'ANGRY': return '😡';
      default: return '👍';
    }
  };

  const updatePostFromResponse = (postId: string, res: any) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== String(res.postId || res.id || res.postId)) return p;
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
      const existing = posts.find(p => p.id === postId);
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        if (p.isLikedByMe) {
          return { ...p, isLikedByMe: false, myReactionType: null, likes: Math.max(0, (p.likes || 1) - 1) };
        }
        return { ...p, isLikedByMe: true, myReactionType: 'LOVE', likes: (p.likes || 0) + 1 };
      }));

      if (existing?.isLikedByMe) {
        const res = await api.delete(`/posts/${postId}/like`);
        updatePostFromResponse(postId, res);
      } else {
        const res = await api.post(`/posts/${postId}/react/LOVE`);
        updatePostFromResponse(postId, res);
      }
    } catch (err) {
      console.warn('Toggle like error', err);
    }
  };

  const reactWith = async (postId: string, emoji: string) => {
    try {
      const reactionType = emojiToReactionType(emoji);
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const alreadyLiked = !!p.isLikedByMe;
        return { ...p, isLikedByMe: true, myReactionType: reactionType, likes: alreadyLiked ? p.likes : (p.likes || 0) + 1 };
      }));
      const res = await api.post(`/posts/${postId}/react/${reactionType}`);
      updatePostFromResponse(postId, res);
      setReactionPickerPostId(null);
    } catch (err) {
      console.warn('React error', err);
    }
  };

  const openCommentModal = async (postId: string) => {
    try {
      const res: any = await api.get(`/posts/${postId}/comments`);
      setCommentList(Array.isArray(res) ? res : (res || []));
      setCommentModalPostId(postId);
    } catch (err) {
      console.warn('Fetch comments error', err);
    }
  };

  const submitComment = async () => {
    if (!commentModalPostId || !commentInput.trim()) return;
    try {
      const body = { content: commentInput.trim() };
      const res = await api.post(`/posts/${commentModalPostId}/comments`, body);
      setPosts(prev => prev.map(p => p.id === commentModalPostId ? { ...p, comments: (p.comments || 0) + 1 } : p));
      setCommentInput('');
      setCommentList(prev => [res, ...prev]);
    } catch (err) {
      console.warn('Submit comment error', err);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onMenuPress={setActiveMenuPostId}
      onToggleLike={toggleLike}
      onLongPressLike={setReactionPickerPostId}
      onCommentPress={openCommentModal}
    />
  );

  const openStory = (idx: number) => {
    setStoryViewerIndex(idx);
    setStoryViewerVisible(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2F80ED" />
      <View style={[styles.zaloHeader, { paddingTop: insets.top }]}>
        <View style={styles.headerTop}>
          <Ionicons name="search-outline" size={30} color="#FFFFFF" style={styles.headerSearchIcon} />
          <TextInput 
            placeholder="Tìm kiếm" 
            placeholderTextColor="rgba(255,255,255,0.7)" 
            style={styles.searchBar} 
          />
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="image-outline" size={25} color="#FFFFFF" />
            <Ionicons name="add" size={15} color="#FFFFFF" style={styles.headerIconPlus} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={27} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabItem, styles.tabActive]}>
          <Text style={[styles.tabText, styles.tabTextActive]}>Nhật Ký</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabText}>Zalo Video</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={renderPost}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={() => (
          <View style={{ padding: 24, alignItems: 'center' }}>
            {loading ? <ActivityIndicator size="large" color="#888" /> : <Text style={{ color: '#888' }}>Chưa có bài viết</Text>}
          </View>
        )}
        ListHeaderComponent={
          <>
            <View style={styles.storySection}>
              <ScrollViewHorizontal stories={stories} onPressCreate={() => router.push('/story-creator')} profile={profile} onOpenStory={openStory} />
            </View>

            <View style={styles.composerCard}>
              <View style={styles.composerTop}>
                <Image source={getAvatarSource(profile?.avatar_url || profile?.avatar || profile?.profile_picture)} style={styles.avatarSmall} />
                <TouchableOpacity style={styles.composerInputMock} onPress={() => router.push('/create-post')}>
                  <Text style={styles.composerPlaceholder}>Hôm nay bạn thế nào?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.composerButtons}>
                <TouchableOpacity style={styles.composerBtn}><Ionicons name="image" size={18} color="#4caf50" /><Text style={styles.composerBtnTxt}>Ảnh</Text></TouchableOpacity>
                <TouchableOpacity style={styles.composerBtn}><Ionicons name="videocam" size={18} color="#e91e63" /><Text style={styles.composerBtnTxt}>Video</Text></TouchableOpacity>
                <TouchableOpacity style={styles.composerBtn}><Ionicons name="images" size={18} color="#2196f3" /><Text style={styles.composerBtnTxt}>Album</Text></TouchableOpacity>
                <TouchableOpacity style={styles.composerBtn}><Ionicons name="brush" size={18} color="#3b82f6" /><Text style={styles.composerBtnTxt}>Nền chữ</Text></TouchableOpacity>
              </View>
            </View>

            <View style={styles.statusPromptSection}>
              <TouchableOpacity style={styles.statusPromptCard} activeOpacity={0.8}>
                <View style={styles.statusPromptLeft}>
                  <Ionicons name="happy-outline" size={20} color="#8E949F" />
                  <Text style={styles.statusPromptText}>Cập nhật trạng thái 24 giờ</Text>
                </View>
                <View style={styles.statusPromptRight}>
                  <View style={styles.newBadge}><Text style={styles.newBadgeText}>Mới</Text></View>
                  <Ionicons name="flame" size={18} color="#6B7280" />
                  <Text style={styles.statusCount}>0</Text>
                  <Ionicons name="chevron-down" size={14} color="#6B7280" />
                </View>
              </TouchableOpacity>
            </View>
          </>
        }
      />

      <StoryViewer
        visible={storyViewerVisible}
        stories={stories}
        startIndex={storyViewerIndex}
        onClose={() => setStoryViewerVisible(false)}
      />

      {/* Reaction picker modal */}
      <Modal visible={!!reactionPickerPostId} transparent animationType="fade" onRequestClose={() => setReactionPickerPostId(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, flexDirection: 'row' }}>
            {REACTION_EMOJIS.map((e) => (
              <TouchableOpacity key={e} onPress={() => reactWith(reactionPickerPostId as string, e)} style={{ padding: 8 }}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Comment modal */}
      <Modal visible={!!commentModalPostId} transparent={true} animationType="slide" onRequestClose={() => setCommentModalPostId(null)}>
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
                  keyExtractor={(c, i) => c.commentId || c.id || String(i)}
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

      {/* POPUP OPTIONS MENU (3 CHẤM) CHIẾM NỬA MÀN HÌNH CHUẨN UI TRONG ẢNH MẪU */}
      <Modal
        visible={!!activeMenuPostId}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveMenuPostId(null)}
      >
        {/* Click ra ngoài để đóng menu */}
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActiveMenuPostId(null)}
        />

        {/* Khung Bottom Sheet chứa các chức năng tinh giản tên */}
        <View style={[styles.menuBottomSheetContainer, { paddingBottom: insets.bottom || 16 }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.menuOptionsList}>

            {/* Chức năng 1: Xóa bài đăng */}
            <TouchableOpacity style={styles.menuItem} onPress={() => setActiveMenuPostId(null)}>
              <Ionicons name="trash-outline" size={24} color="#555" style={styles.menuIcon} />
              <View style={styles.menuTextContent}>
                <Text style={styles.menuItemTitle}>Xóa bài đăng</Text>
                <Text style={styles.menuItemSubtitle}>Bài đăng này sẽ ẩn khỏi nhật ký</Text>
              </View>
            </TouchableOpacity>

            {/* Chức năng 2: Ẩn hoạt động */}
            <TouchableOpacity style={styles.menuItem} onPress={() => setActiveMenuPostId(null)}>
              <MaterialCommunityIcons name="eye-off-outline" size={24} color="#555" style={styles.menuIcon} />
              <View style={styles.menuTextContent}>
                <Text style={styles.menuItemTitle}>Ẩn hoạt động</Text>
                <Text style={styles.menuItemSubtitle}>Bạn sẽ không thấy bài đăng và khoảnh khắc của người này</Text>
              </View>
            </TouchableOpacity>

            {/* Chức năng 3: Chặn xem nhật ký */}
            <TouchableOpacity style={styles.menuItem} onPress={() => setActiveMenuPostId(null)}>
              <Ionicons name="ban-outline" size={24} color="#555" style={styles.menuIcon} />
              <View style={styles.menuTextContent}>
                <Text style={styles.menuItemTitle}>Chặn xem nhật ký của tôi</Text>
                <Text style={styles.menuItemSubtitle}>Người này sẽ không xem được bài đăng và khoảnh khắc của bạn</Text>
              </View>
            </TouchableOpacity>

            {/* Chức năng 4: Báo xấu */}
            <TouchableOpacity style={styles.menuItem} onPress={() => setActiveMenuPostId(null)}>
              <Ionicons name="alert-circle-outline" size={24} color="#555" style={styles.menuIcon} />
              <View style={styles.menuTextContent}>
                <Text style={styles.menuItemTitle}>Báo xấu</Text>
              </View>
            </TouchableOpacity>

            {/* Chức năng 5: Xóa bạn */}
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setActiveMenuPostId(null)}>
              <Ionicons name="person-remove-outline" size={24} color="#ff3b30" style={styles.menuIcon} />
              <View style={styles.menuTextContent}>
                <Text style={[styles.menuItemTitle, { color: '#ff3b30' }]}>Xóa bạn</Text>
              </View>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const ScrollViewHorizontal = ({ stories, onPressCreate, profile, onOpenStory }: { stories?: any[], onPressCreate?: () => void, profile?: any, onOpenStory?: (idx: number) => void }) => {
  const router = useRouter();
  const data = [null, ...(stories || [])];
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    const loadThumbnails = async () => {
      if (!stories || stories.length === 0) return;
      for (const s of stories) {
        const uri = s?.mediaUrl;
        if (!uri) continue;
        if (s.mediaType === 'VIDEO' && !thumbnails[uri]) {
          try {
            const result = await VideoThumbnails.getThumbnailAsync(uri, { time: 1000 });
            if (mounted && result?.uri) {
              setThumbnails(prev => ({ ...prev, [uri]: result.uri }));
            }
          } catch (err) {
            console.warn('Thumbnail generation failed', err);
          }
        }
      }
    };
    loadThumbnails();
    return () => { mounted = false; };
  }, [stories]);

  return (
    <FlatList
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(_, index) => String(index)}
      renderItem={({ item, index }) => {
        if (index === 0) {
          return (
            <StoryCard isCreate profile={profile} onPress={() => (onPressCreate ? onPressCreate() : router.push('/story-creator'))} />
          );
        }

        const uri = item?.mediaUrl || 'https://via.placeholder.com/150/ffc107';
        const displayUri = item.mediaType === 'VIDEO' ? (thumbnails[item.mediaUrl] || uri) : uri;

        return (
          <StoryCard displayUri={displayUri} avatarSource={getAvatarSource(item?.avatar)} name={item?.name} onPress={() => onOpenStory && onOpenStory(index - 1)} />
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E9EEF3' },
  zaloHeader: { backgroundColor: '#3A8BF4', paddingHorizontal: 12, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', height: 42 },
  headerSearchIcon: { marginLeft: 2, marginRight: 10 },
  searchBar: { flex: 1, color: '#fff', fontSize: 12, height: '100%', paddingHorizontal: 10 },
  headerIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 2, position: 'relative' },
  headerIconPlus: { position: 'absolute', right: 5, top: 7 },
  tabBar: { height: 46, flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#111827' },
  tabText: { color: '#6B7280', fontWeight: '500', fontSize: 12 },
  tabTextActive: { color: '#111827' },

  storySection: { backgroundColor: '#fff', paddingVertical: 12, paddingLeft: 12, borderTopWidth: 8, borderTopColor: '#E9EEF3', borderBottomWidth: 8, borderBottomColor: '#E9EEF3' },
  storyCard: { width: 84, height: 116, marginRight: 10, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f0f0f0', position: 'relative' },
  createStoryCard: { backgroundColor: '#26232f' },
  storyCover: { width: '100%', height: '100%' },
  storyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  createStoryOverlay: { backgroundColor: 'rgba(0,0,0,0.32)' },
  createStoryButton: { position: 'absolute', left: 25, top: 56 },
  createStoryCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#4B75FF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  storyAvatarBorder: { position: 'absolute', left: 10, top: 62, width: 31, height: 31, borderRadius: 16, borderWidth: 2, borderColor: '#4F8CFF' },
  storyNameWrap: { position: 'absolute', bottom: 7, left: 8, right: 8, alignItems: 'center' },
  storyName: { color: '#fff', fontSize: 11, fontWeight: '500', maxWidth: 76 },

  composerCard: { backgroundColor: '#fff', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  composerTop: { flexDirection: 'row', alignItems: 'center' },
  avatarSmall: { width: 38, height: 38, borderRadius: 19 },
  composerInputMock: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  composerPlaceholder: { color: '#8E949F', fontSize: 12 },
  composerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  composerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F7F9', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  composerBtnTxt: { marginLeft: 5, color: '#111827', fontSize: 11, fontWeight: '500' },
  statusPromptSection: { backgroundColor: '#FFFFFF', borderTopWidth: 8, borderTopColor: '#E9EEF3', paddingHorizontal: 14, paddingVertical: 10 },
  statusPromptCard: { height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: '#D2D6DC', borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  statusPromptLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusPromptText: { marginLeft: 6, color: '#9CA3AF', fontSize: 11 },
  statusPromptRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newBadge: { position: 'absolute', top: -22, right: -4, backgroundColor: '#5CBF73', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  newBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  statusCount: { color: '#111827', fontSize: 12, fontWeight: '600' },

  card: { marginTop: 6, paddingVertical: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  author: { fontWeight: '600', fontSize: 13, color: '#000' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  time: { fontSize: 12, color: '#757575' },
  sponsoredText: { fontSize: 12, color: '#757575' },
  moreButton: { padding: 4 },
  contentText: { marginTop: 10, paddingHorizontal: 12, fontSize: 13, color: '#1c1c1c', lineHeight: 19 },

  imageContainer: { marginTop: 10, width: width, position: 'relative', overflow: 'hidden', backgroundColor: '#fff' },
  singleImage: { width: '100%', height: '100%' },
  twoImageRow: { flexDirection: 'row', width: '100%', height: '100%' },
  twoImageTile: { height: '100%' },
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
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

  // === STYLES MỚI CHO OPTIONS MENU 3 CHẤM NỬA MÀN HÌNH ===
  menuBottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.55, // Giới hạn chiều cao tối đa khoảng nửa màn hình
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
