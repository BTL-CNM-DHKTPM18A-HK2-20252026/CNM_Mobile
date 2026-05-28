import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/services/api';

const { width } = Dimensions.get('window');

type Post = {
  id: string;
  author: string;
  avatar?: string;
  time: string;
  text?: string;
  image?: string;
  likes: number;
  comments: number;
  isSponsored?: boolean;
};
// Minimal sample posts to avoid runtime undefined errors
const samplePosts: Post[] = [];
export default function TimelineScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>(samplePosts);
  // stories will be fetched later; for now start empty so we show Create-new only
  const [stories, setStories] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [composer, setComposer] = useState('');
  const [loading, setLoading] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/posts/feed?size=20`);
      const list = Array.isArray(res) ? res : res?.content || res?.data || [];

      const mapped: Post[] = (list || []).map((p: any) => ({
        id: String(p.id || p.postId || p._id || Date.now()),
        author: p.author?.displayName || p.authorName || p.createdBy || p.userName || 'Người dùng',
        avatar: p.author?.avatar || p.avatar || p.profileImage || 'https://via.placeholder.com/80',
        time: p.createdAt ? `${Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 60000)} phút` : p.time || 'Vừa xong',
        text: p.content || p.text || p.body || '',
        image: (p.media && p.media[0]?.url) || p.image || null,
        likes: p.likeCount || p.likes || 0,
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

  // Render một bài đăng chuẩn Zalo
  const renderPost = ({ item }: { item: Post }) => (
    <View style={[styles.card, { backgroundColor: '#fff' }]}>
      {/* Header bài viết */}
      <View style={styles.postHeader}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{item.author}</Text>
          <View style={styles.timeRow}>
            {item.isSponsored ? (
              <Text style={styles.sponsoredText}>Được tài trợ</Text>
            ) : (
              <Text style={styles.time}>{item.time}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#727272" />
        </TouchableOpacity>
      </View>

      {/* Nội dung chữ */}
      {item.text ? <Text style={styles.contentText}>{item.text}</Text> : null}

      {/* Hình ảnh hiển thị full chiều ngang viền bo tròn nhẹ */}
      {item.image ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />
          {/* Nút bật/tắt âm thanh giả lập nếu là video giống trong ảnh */}
          {!item.isSponsored && (
            <TouchableOpacity style={styles.muteButton}>
              <Ionicons name="volume-mute" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Thanh tương tác dưới bài viết */}
      <View style={styles.actionsRow}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.actionItem}>
            <Ionicons name="heart-outline" size={22} color="#111" />
            {item.likes > 0 && <Text style={styles.actionCount}>{item.likes}</Text>}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionItem}>
            <Ionicons name="chatbubble-outline" size={20} color="#111" />
            {item.comments > 0 && <Text style={styles.actionCount}>{item.comments}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#ededed' }]}>
      {/* Thanh Header màu xanh Zalo */}
      <View style={[styles.zaloHeader, { paddingTop: insets.top }]}>
        <View style={styles.headerTop}>
          <TextInput 
            placeholder="Tìm kiếm" 
            placeholderTextColor="rgba(255,255,255,0.7)" 
            style={[styles.searchBar, { paddingLeft: 12 }]} 
          />
        </View>

        {/* Cấu trúc Tab Nhật Ký và Zalo Video */}
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
            {/* Vùng Khoảnh khắc (Stories) đầu trang */}
            <View style={styles.storySection}>
              <ScrollViewHorizontal stories={stories} />
            </View>

            {/* Khung đăng bài "Hôm nay bạn thế nào?" */}
            <View style={styles.composerCard}>
              <View style={styles.composerTop}>
                <Image source={{ uri: 'https://via.placeholder.com/80' }} style={styles.avatarSmall} />
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

      {/* bottom tab removed */}
    </View>
  );
}

// Component phụ hiển thị danh sách Story (Tin 24h) nằm ngang đầu trang
const ScrollViewHorizontal = ({ stories }: { stories?: any[] }) => {
  const data = (stories && stories.length > 0) ? stories : [null];
  return (
    <FlatList
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(_, index) => String(index)}
      renderItem={({ item, index }) => (
        <View style={styles.storyCard}>
          <Image 
            source={{ uri: index === 0 ? 'https://via.placeholder.com/150/333' : (item?.cover || 'https://via.placeholder.com/150/ffc107') }} 
            style={styles.storyCover} 
          />
          <View style={styles.storyOverlay} />
          {index === 0 ? (
            <View style={styles.createStoryCircle}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          ) : (
            <Image source={{ uri: item?.avatar || 'https://via.placeholder.com/50' }} style={styles.storyAvatarBorder} />
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
  // Zalo Blue Header 
  zaloHeader: { backgroundColor: '#0082f6', paddingHorizontal: 16, pb: 0 },
  headerTop: { flexDirection: 'row', alignItems: 'center', height: 48 },
  searchBar: { flex: 1, color: '#fff', fontSize: 16, height: '100%' },
  // badge removed
  
  // Tabs Navigation
  tabBar: { flexDirection: 'row', marginTop: 4 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#fff' },
  tabText: { color: 'rgba(255,255,255,0.7)', fontWeight: '500', fontSize: 15 },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },

  // Stories Section
  storySection: { backgroundColor: '#fff', paddingVertical: 12, paddingLeft: 12, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  storyCard: { width: 105, height: 145, marginRight: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f0f0f0', position: 'relative' },
  storyCover: { width: '100%', height: '100%' },
  storyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  createStoryCircle: { position: 'absolute', left: 12, top: 75, width: 34, height: 34, borderRadius: 17, backgroundColor: '#0082f6', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  storyAvatarBorder: { position: 'absolute', left: 12, top: 75, width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#0082f6' },
  storyNameWrap: { position: 'absolute', bottom: 8, left: 8, right: 8, alignItems: 'flex-start' },
  storyName: { color: '#fff', fontSize: 12, fontWeight: '600', maxWidth: 88 },

  // Composer Area
  composerCard: { backgroundColor: '#fff', padding: 12, marginTop: 8, marginBottom: 4 },
  composerTop: { flexDirection: 'row', alignItems: 'center' },
  avatarSmall: { width: 38, height: 38, borderRadius: 19 },
  composerInputMock: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  composerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, borderTopWidth: 0.5, borderTopColor: '#f0f0f0', paddingTop: 10 },
  composerBtn: { flexDirection: 'row', alignItems: 'center' },
  composerBtnTxt: { marginLeft: 6, color: '#555', fontSize: 13, fontWeight: '500' },

  // Post Card Standard
  card: { marginTop: 6, paddingVertical: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  author: { fontWeight: '600', fontSize: 15, color: '#000' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  time: { fontSize: 12, color: '#757575' },
  sponsoredText: { fontSize: 12, color: '#757575' },
  moreButton: { padding: 4 },
  contentText: { marginTop: 10, paddingHorizontal: 12, fontSize: 15, color: '#1c1c1c', lineHeight: 21 },
  
  // Image layout fitting screen width perfectly
  imageContainer: { marginTop: 10, width: width, height: width * 0.65, position: 'relative' },
  postImage: { width: '100%', height: '100%' },
  muteButton: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  // Action Buttons row 
  actionsRow: { flexDirection: 'row', marginTop: 12, paddingHorizontal: 12, alignItems: 'center' },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  actionItem: { flexDirection: 'row', alignItems: 'center', marginRight: 24, backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  actionCount: { marginLeft: 6, fontSize: 13, color: '#333', fontWeight: '500' },

  // Bottom tab simulation removed
});