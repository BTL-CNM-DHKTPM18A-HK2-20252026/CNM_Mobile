import { authService } from '@/services/authService';
import { getAvatarSource } from '@/services/mediaUtils';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Story = { id: string; name: string; avatar: string };
type Post = { id: string; user: string; avatar: string; time: string; text: string; image?: string };

const { width } = Dimensions.get('window');

export default function TimelineScreen() {
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
  const stories: Story[] = useMemo(
    () => [
      { id: 'create', name: 'Tạo mới', avatar: 'https://placehold.co/120x120/eee/000?text=+' },
      { id: '1', name: 'An', avatar: 'https://placekitten.com/100/100' },
      { id: '2', name: 'Bình', avatar: 'https://placekitten.com/101/101' },
      { id: '3', name: 'Chi', avatar: 'https://placekitten.com/102/102' },
      { id: '4', name: 'Dũng', avatar: 'https://placekitten.com/103/103' },
    ],
    []
  );

  const posts: Post[] = useMemo(
    () => [
      {
        id: 'p1',
        user: 'Lan Hoàng',
        avatar: 'https://placekitten.com/64/64',
        time: '7 giờ',
        text: 'Hôm nay trời đẹp, mình đi dạo công viên và thấy nhiều hoa.',
        image: 'https://placekitten.com/800/400',
      },
      {
        id: 'p2',
        user: 'Minh Tâm',
        avatar: 'https://placekitten.com/65/65',
        time: '12 giờ',
        text: 'Chia sẻ vài khoảnh khắc cuối tuần!',
        image: 'https://placekitten.com/801/401',
      },
      {
        id: 'p3',
        user: 'Ngọc',
        avatar: 'https://placekitten.com/66/66',
        time: '1 ngày',
        text: 'Ai đang tìm một quán cà phê chill ở Sài Gòn không?',
      },
    ],
    []
  );

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
        <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
        <View style={styles.storyOverlay} />
        <Text style={styles.storyName}>{item.name}</Text>
      </View>
    );
  }

  function renderPost({ item }: { item: Post }) {
    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <Image source={{ uri: item.avatar }} style={styles.postAvatar} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.postUser}>{item.user}</Text>
            <Text style={styles.postTime}>{item.time}</Text>
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
          <TouchableOpacity style={styles.inputBox}>
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stories} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {stories.map(renderStory)}
        </ScrollView>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Cập nhật trạng thái 24 giờ</Text>
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>Mới</Text>
          </View>
        </View>

        <FlatList data={posts} keyExtractor={(i) => i.id} renderItem={renderPost} scrollEnabled={false} />
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
