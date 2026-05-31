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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { PostCard, type PostCardData } from '@/components/post/PostCard';
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

export default function TimelineScreen() {
  const { colors } = useTheme();
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
        time: p.createdAt ? `${Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 60000)} phút` : p.time || 'Vừa xong',
        text: p.content || p.text || p.body || '',
        images: Array.isArray(p.media) && p.media.length > 0
          ? p.media.map((m: any) => m.url || m)
          : (p.images && Array.isArray(p.images) ? p.images : (p.image ? [p.image] : [])),
        image: (p.media && p.media[0]?.url) || p.image || null,
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
        return { ...p, isLikedByMe: true, myReactionType: 'LIKE', likes: (p.likes || 0) + 1 };
      }));

      if (existing?.isLikedByMe) {
        const res = await api.delete(`/posts/${postId}/like`);
        updatePostFromResponse(postId, res);
      } else {
        const res = await api.post(`/posts/${postId}/react/LIKE`);
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

  return (
    <View style={[styles.container, { backgroundColor: '#ededed' }]}>
      <View style={[styles.zaloHeader, { paddingTop: insets.top }]}>
        <View style={styles.headerTop}>
          <TextInput 
            placeholder="Tìm kiếm" 
            placeholderTextColor="rgba(255,255,255,0.7)" 
            style={[styles.searchBar, { paddingLeft: 12 }]} 
          />
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tabItem, styles.tabActive]}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Nhật Ký</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <Text style={styles.tabText}>Zalo Video</Text>
          </TouchableOpacity>
        </View>
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
              <ScrollViewHorizontal stories={stories} onPressCreate={() => router.push('/story-creator')} />
            </View>

            <View style={styles.composerCard}>
              <View style={styles.composerTop}>
                <Image source={getAvatarSource(profile?.avatar_url || profile?.avatar || profile?.profile_picture)} style={styles.avatarSmall} />
                <TouchableOpacity style={styles.composerInputMock} onPress={() => router.push('/create-post')}>
                  <Text style={{ color: '#7f7f7f', fontSize: 15 }}>Hôm nay bạn thế nào?</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.composerButtons}>
                <TouchableOpacity style={styles.composerBtn}><Ionicons name="image" size={18} color="#4caf50" /><Text style={styles.composerBtnTxt}>Ảnh</Text></TouchableOpacity>
                <TouchableOpacity style={styles.composerBtn}><Ionicons name="videocam" size={18} color="#e91e63" /><Text style={styles.composerBtnTxt}>Video</Text></TouchableOpacity>
                <TouchableOpacity style={styles.composerBtn}><Ionicons name="images" size={18} color="#2196f3" /><Text style={styles.composerBtnTxt}>Album</Text></TouchableOpacity>
                <TouchableOpacity style={styles.composerBtn}><Ionicons name="color-palette" size={18} color="#9c27b0" /><Text style={styles.composerBtnTxt}>Nền</Text></TouchableOpacity>
              </View>
            </View>
          </>
        }
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
                      <Text style={styles.commentUser}>{item.userName || item.authorName || 'Người dùng'}</Text>
                      <Text style={styles.commentText}>{item.content}</Text>
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

const ScrollViewHorizontal = ({ stories, onPressCreate }: { stories?: any[], onPressCreate?: () => void }) => {
  const router = useRouter();
  const data = [null, ...(stories || [])];
  return (
    <FlatList
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(_, index) => String(index)}
      renderItem={({ item, index }) => (
        <View style={styles.storyCard}>
          <Image 
            source={{ uri: index === 0 ? 'https://via.placeholder.com/150/333' : (item?.mediaUrl || 'https://via.placeholder.com/150/ffc107') }} 
            style={styles.storyCover} 
          />
          <View style={styles.storyOverlay} />
          {index === 0 ? (
            <>
              <TouchableOpacity
                onPress={() => (onPressCreate ? onPressCreate() : router.push('/story-creator'))}
                style={{ position: 'absolute', left: 12, top: 75 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <View style={styles.createStoryCircle}>
                  <Ionicons name="camera" size={18} color="#fff" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => (onPressCreate ? onPressCreate() : router.push('/story-creator'))}
                style={StyleSheet.absoluteFillObject}
              />
            </>
          ) : (
            <Image source={getAvatarSource(item?.avatar)} style={styles.storyAvatarBorder} />
          )}
          <View style={styles.storyNameWrap}>
            <Text style={styles.storyName} numberOfLines={1}>
              {index === 0 ? 'Tạo mới' : (item?.name || 'Bạn bè')}
            </Text>
          </View>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  zaloHeader: { backgroundColor: '#0082f6', paddingHorizontal: 16, paddingBottom: 0 },
  headerTop: { flexDirection: 'row', alignItems: 'center', height: 48 },
  searchBar: { flex: 1, color: '#fff', fontSize: 16, height: '100%' },
  tabBar: { flexDirection: 'row', marginTop: 4 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#fff' },
  tabText: { color: 'rgba(255,255,255,0.7)', fontWeight: '500', fontSize: 15 },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },

  storySection: { backgroundColor: '#fff', paddingVertical: 12, paddingLeft: 12, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  storyCard: { width: 105, height: 145, marginRight: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f0f0f0', position: 'relative' },
  storyCover: { width: '100%', height: '100%' },
  storyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  createStoryCircle: { position: 'absolute', left: 12, top: 75, width: 34, height: 34, borderRadius: 17, backgroundColor: '#0082f6', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  storyAvatarBorder: { position: 'absolute', left: 12, top: 75, width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#0082f6' },
  storyNameWrap: { position: 'absolute', bottom: 8, left: 8, right: 8, alignItems: 'flex-start' },
  storyName: { color: '#fff', fontSize: 12, fontWeight: '600', maxWidth: 88 },

  composerCard: { backgroundColor: '#fff', padding: 12, marginTop: 8, marginBottom: 4 },
  composerTop: { flexDirection: 'row', alignItems: 'center' },
  avatarSmall: { width: 38, height: 38, borderRadius: 19 },
  composerInputMock: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  composerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, borderTopWidth: 0.5, borderTopColor: '#f0f0f0', paddingTop: 10 },
  composerBtn: { flexDirection: 'row', alignItems: 'center' },
  composerBtnTxt: { marginLeft: 6, color: '#555', fontSize: 13, fontWeight: '500' },

  card: { marginTop: 6, paddingVertical: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  author: { fontWeight: '600', fontSize: 15, color: '#000' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  time: { fontSize: 12, color: '#757575' },
  sponsoredText: { fontSize: 12, color: '#757575' },
  moreButton: { padding: 4 },
  contentText: { marginTop: 10, paddingHorizontal: 12, fontSize: 15, color: '#1c1c1c', lineHeight: 21 },
  
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
    paddingVertical: 14,
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
    fontSize: 16,
    color: '#222',
    fontWeight: '400',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#7c7c7c',
    marginTop: 3,
    lineHeight: 16,
  },
});