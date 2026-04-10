import api from '@/services/api';
import { authService } from '@/services/authService';
import { getAvatarSource } from '@/services/mediaUtils';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Story = { id: string; name: string; avatar: string };
type Post = { id: string; user: string; avatar: string; time: string; text: string; image?: string; authorId?: string };

const { width } = Dimensions.get('window');

export default function TimelineScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      const data = await authService.getProfile();
      if (mounted && data) setProfile(data);
    };
    fetchProfile();
    return () => { mounted = false; };
  }, []);

  const isOwnStory = (s: any) => {
    if (!profile) return false;
    const pid = profile.id || profile.userId || profile.user_id || profile._id;
    if (!pid) return false;
    return (
      s.id === pid || s.userId === pid || s.user_id === pid || s.ownerId === pid || (s.user && (s.user.id === pid || s.user.userId === pid))
    );
  };
  const [uploading, setUploading] = useState(false);

  const handlePickAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (res.canceled) return;
      const asset = res.assets && res.assets[0];
      if (!asset?.uri) return;
      const uri = asset.uri;
      const fileName = uri.split('/').pop() || `avatar_${Date.now()}.jpg`;
      const ext = fileName.split('.').pop() || 'jpg';
      const fileType = asset.type ? `${asset.type}/${ext}` : `image/${ext}`;

      setUploading(true);
      const presigned = await authService.getAvatarPresignedUrl(fileName, fileType);
      await authService.uploadToS3(presigned, uri, fileType);
      const publicUrl = presigned.split('?')[0];
      await authService.updateAvatar(publicUrl);
      const updated = await authService.getProfile();
      setProfile(updated);
      Alert.alert('Thành công', 'Cập nhật avatar thành công.');
    } catch (err) {
      console.error('Upload avatar error', err);
      Alert.alert('Lỗi', 'Không thể cập nhật avatar.');
    } finally {
      setUploading(false);
    }
  };
  const [stories, setStories] = useState<Story[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchStories = async () => {
      setLoadingStories(true);
      try {
        const tryEndpoints = ['/users/me/stories', '/stories', '/timeline/stories'];
        for (const ep of tryEndpoints) {
          try {
            const res: any = await api.get(ep);
            if (!mounted || !res) continue;

            let list: any = Array.isArray(res) ? res : (res.data || res.stories || res.items || res.results || res.content || res);
            if (!Array.isArray(list) && res && Array.isArray(res.data)) list = res.data;

            if (Array.isArray(list) && list.length > 0) {
              const mapped = list.map((s: any, idx: number) => {
                const id = String(s.id || s.userId || s._id || s.ownerId || s.userid || s.user?.id || `story-${idx}-${Date.now()}`);
                const name = s.name || s.displayName || s.user?.displayName || s.user?.name || s.title || '';
                const avatar = s.avatar_url || s.avatar || s.user?.avatar || '';
                return { id, name, avatar } as Story;
              });

              setStories(mapped);
              break;
            }
          } catch (e) {
            // continue
          }
        }
      } finally {
        if (mounted) setLoadingStories(false);
      }
    };

    const fetchPosts = async () => {
      setLoadingPosts(true);
      try {
        // Try common feed endpoints; many backends return a paged response
        const tryEndpoints = ['/posts/feed', '/timeline/posts', '/posts/timeline', '/posts'];
        for (const ep of tryEndpoints) {
          try {
            const res: any = await api.get(ep);
            if (!mounted || !res) continue;

            // Possible shapes:
            // 1) Array directly
            // 2) Paged: { content: [...] }
            // 3) Wrapped: { data: [...] } or { posts: [...] } or { items: [...] }
            let list: any = Array.isArray(res) ? res : (res.content || res.data || res.posts || res.results || res.items || res);

            // If page wrapper (res has content but list is object), extract content
            if (!Array.isArray(list) && res && Array.isArray(res.content)) {
              list = res.content;
            }

            if (Array.isArray(list) && list.length > 0) {
              // Normalize backend post shape to the UI Post type used in this screen
              const mapped = list.map((p: any, idx: number) => {
                const id = String(p.postId || p.id || p._id || `post-${idx}-${Date.now()}`);
                const authorId = p.authorId || p.author?.id || p.author?._id || (typeof p.author === 'string' ? p.author : undefined) || p.userId || p.user?.id;
                const user = p.author?.displayName || p.author?.name || p.displayName || p.username || p.user?.name || p.user || (authorId ? String(authorId) : 'Người dùng');
                const avatar = p.author?.avatar_url || p.author?.avatar || p.avatar || p.user?.avatar || '';
                const time = p.createdAt || p.created_at || p.time || p.created || '';
                const text = p.content || p.text || p.body || '';
                const image = (p.mediaUrls && p.mediaUrls.length) ? p.mediaUrls[0] : (p.image || p.imageUrl || p.mediaUrl || undefined);
                return { id, user, avatar, time, text, image, authorId: authorId ? String(authorId) : undefined } as Post;
              });

              setPosts(mapped);
              break;
            }
          } catch (e) {
            // continue to next endpoint
          }
        }
      } finally {
        if (mounted) setLoadingPosts(false);
      }
    };

    fetchStories();
    fetchPosts();

    return () => { mounted = false; };
  }, []);

  function formatDateTime(value?: string | number) {
    if (!value) return '';
    let date: Date;
    if (typeof value === 'number') {
      date = new Date(value);
    } else if (/^\d+$/.test(String(value))) {
      date = new Date(Number(value));
    } else {
      const parsed = Date.parse(String(value));
      if (!isNaN(parsed)) date = new Date(parsed);
      else return String(value);
    }

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  // When profile is loaded, prefer profile displayName/avatar for posts authored by current user
  useEffect(() => {
    if (!profile || posts.length === 0) return;
    const pid = profile.id || profile.userId || profile.user_id || profile._id;
    if (!pid) return;

    const updated = posts.map((p: any) => {
      if (p.authorId && String(p.authorId) === String(pid)) {
        const name = profile.displayName || profile.full_name || profile.name || profile.username || p.user;
        const avatar = profile.avatar_url || profile.avatar || p.avatar;
        if (name !== p.user || avatar !== p.avatar) {
          return { ...p, user: name, avatar };
        }
      }
      return p;
    });

    const changed = updated.some((u: any, i: number) => u.user !== posts[i].user || u.avatar !== posts[i].avatar);
    if (changed) setPosts(updated);
  }, [profile, posts]);

  function renderStory(item: Story) {
    if (item.id === 'create') {
      return (
        <TouchableOpacity style={styles.storyCreate} key={item.id}>
          <View style={styles.storyPlus}>
            <MaterialIcons name="add" size={24} color="#007aff" />
          </View>
          <Text style={styles.storyName}>Tạo mới</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.storyItem} key={item.id}>
        <Image source={getAvatarSource(item.avatar)} style={styles.storyAvatar} />
        <View style={styles.storyOverlay} />
        <Text style={styles.storyName}>{item.name}</Text>
      </View>
    );
  }

  function renderPost({ item }: { item: Post }) {
    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <Image source={getAvatarSource(item.avatar)} style={styles.postAvatar} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.postUser}>{item.user}</Text>
            <Text style={styles.postTime}>{formatDateTime(item.time)}</Text>
          </View>
          <TouchableOpacity>
            <Feather name="more-vertical" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {item.text ? <Text style={styles.postText}>{item.text}</Text> : null}

        {item.image ? <Image source={{ uri: item.image }} style={styles.postImage} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#2f80ed", "#1c60d1"]} style={styles.header}>
        <View style={styles.headerTop}>
          
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, styles.tabActive]}>
            <Text style={styles.tabTextActive}>Nhật Ký</Text>
            <View style={styles.tabIndicator} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Text style={styles.tabText}>Zalo Video</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.postInputRow}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color="#007aff" style={{ width: 44, height: 44 }} />
            ) : (
              <Image source={getAvatarSource(profile?.avatar_url)} style={styles.inputAvatar} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.inputBox} onPress={() => router.push('/create-post')}>
            <Text style={styles.inputPlaceholder}>Hôm nay bạn thế nào?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn}>
            <MaterialIcons name="photo" size={18} color="#007aff" />
            <Text style={styles.actionText}>Ảnh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <MaterialIcons name="videocam" size={18} color="#ff3b30" />
            <Text style={styles.actionText}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <MaterialIcons name="collections" size={18} color="#4cd964" />
            <Text style={styles.actionText}>Album</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <MaterialIcons name="format-color-fill" size={18} color="#8e8e93" />
            <Text style={styles.actionText}>Nền chữ</Text>
          </TouchableOpacity>
        </View>

        {/* Stories: always show 'Tạo mới'; show user's story if present; hide sample placeholders */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stories} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {renderStory({ id: 'create', name: 'Tạo mới', avatar: '' })}
          {!loadingStories && (() => {
            const own = stories.find(isOwnStory as any);
            const others = stories.filter((s) => !isOwnStory(s) && s.id !== 'create');
            const nodes: any[] = [];
            if (own) nodes.push(renderStory(own));
            others.forEach((o) => nodes.push(renderStory(o)));
            return nodes;
          })()}
        </ScrollView>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Cập nhật trạng thái 24 giờ</Text>
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>Mới</Text>
          </View>
        </View>

        {loadingPosts ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : posts.length > 0 ? (
          <FlatList data={posts} keyExtractor={(i) => i.id} renderItem={renderPost} scrollEnabled={false} />
        ) : (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: '#666', textAlign: 'center' }}>
              Hãy kết bạn hoặc đăng bài viết đầu tiên của bạn
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  header: { paddingTop: 40, paddingBottom: 10, paddingHorizontal: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.09)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, marginRight: 8 },
  searchInput: { marginLeft: 8, color: '#fff', flex: 1 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { marginLeft: 8, padding: 6 },
  badge: { position: 'absolute', right: -6, top: -6, backgroundColor: '#ff3b30', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  tabs: { flexDirection: 'row', marginTop: 12 },
  tab: { marginRight: 20, paddingBottom: 6 },
  tabActive: {},
  tabText: { color: 'rgba(255,255,255,0.9)', fontSize: 16 },
  tabTextActive: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tabIndicator: { height: 3, backgroundColor: '#fff', borderRadius: 2, marginTop: 6, width: 40 },

  body: { flex: 1 },
  postInputRow: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  inputAvatar: { width: 44, height: 44, borderRadius: 22 },
  inputBox: { flex: 1, marginLeft: 10, backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 24, borderWidth: 0.5, borderColor: '#eee' },
  inputPlaceholder: { color: '#888' },

  actionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, paddingBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  actionText: { marginLeft: 6, color: '#333' },

  stories: { paddingVertical: 6, backgroundColor: 'transparent' },
  storyItem: { width: 84, height: 120, marginRight: 10, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  storyAvatar: { position: 'absolute', top: 0, width: 84, height: 100 },
  storyOverlay: { position: 'absolute', top: 60, left: 0, right: 0, height: 40, backgroundColor: 'rgba(0,0,0,0.18)' },
  storyName: { position: 'absolute', bottom: 8, color: '#fff', fontWeight: '600', fontSize: 12 },
  storyCreate: { width: 84, height: 120, marginRight: 10, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  storyPlus: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eef6ff', alignItems: 'center', justifyContent: 'center' },

  statusBox: { margin: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d0d3d8', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusText: { color: '#333' },
  newBadge: { backgroundColor: '#ff3b30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  newBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  postCard: { marginHorizontal: 12, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  postAvatar: { width: 48, height: 48, borderRadius: 24 },
  postUser: { fontWeight: '700', color: '#111' },
  postTime: { color: '#888', fontSize: 12 },
  postText: { marginTop: 8, color: '#222' },
  postImage: { width: width - 36, height: 200, marginTop: 10, borderRadius: 12, alignSelf: 'center' },
});
