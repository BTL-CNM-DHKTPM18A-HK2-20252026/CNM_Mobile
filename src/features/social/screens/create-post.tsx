import api from '@/services/api';
import { authService } from '@/services/authService';
import { getAvatarSource } from '@/services/mediaUtils';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type UserProfile = {
  displayName?: string;
  full_name?: string;
  avatar_url?: string | null;
};

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Array<{ uri: string; type?: string }>>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const data = await authService.getProfile();
        if (active) {
          setProfile(data ?? null);
        }
      } catch (error) {
        console.warn('Load profile error', error);
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const isVideoAsset = (uri: string, type?: string) => {
    const ext = uri.split('.').pop()?.toLowerCase();
    return type === 'video' || ext === 'mp4' || ext === 'mov' || ext === 'm4v';
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!res.canceled && res.assets && res.assets.length > 0) {
      setSelectedImages(prev => [
        ...prev,
        ...res.assets
          .filter((asset) => !!asset.uri)
          .map((asset) => ({ uri: asset.uri, type: asset.type })),
      ]);
    }
  };
const takePhoto = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    alert('Cần cấp quyền truy cập camera để chụp ảnh!');
    return;
  }
  
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 0.8,
  });

  if (!res.canceled && res.assets && res.assets.length > 0) {
    setSelectedImages(prev => [
      ...prev,
      ...res.assets
        .filter((asset) => !!asset.uri)
        .map((asset) => ({ uri: asset.uri, type: asset.type })),
    ]);
  }
};
  const submit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      let media: { url: string; altText?: string }[] = [];
      if (selectedImages.length > 0) {
        const uploadForm = new FormData();
        let appendedCount = 0;
        selectedImages.forEach((it, idx) => {
          const uri = it.uri;
          const mediaType = isVideoAsset(uri, it.type) ? 'video' : 'image';

          // Lớp bảo vệ: Bỏ qua nếu cấu trúc uri trống
          if (!uri) return;

          const filename = uri.split('/').pop() || `photo_${idx}.jpg`;
          const fileType = (filename.match(/\.(\w+)$/)?.[1] || 'jpg').toLowerCase();
          const mime = mediaType === 'video'
            ? (fileType === 'mov' ? 'video/quicktime' : 'video/mp4')
            : (fileType === 'png' ? 'image/png' : 'image/jpeg');

          uploadForm.append('files', {
            uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
            name: filename,
            type: mime,
          } as any);
          appendedCount += 1;
        });

        if (appendedCount > 0) {
          const uploadRes: any = await api.post('/files/upload/multiple', uploadForm, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const uploaded: any[] = Array.isArray(uploadRes) ? uploadRes : uploadRes?.data || [];
          media = uploaded.map(u => ({ url: u.fileUrl || u.url || u.file_url, altText: '' }));
        }
      }

      const postBody: any = { content: content.trim() };
      if (media.length) postBody.media = media;

      await api.post('/posts', postBody);
      router.back();
    } catch (err) {
      console.warn('Create post error', err);
    } finally {
      setLoading(false);
    }
  };

  const renderGalleryItem = ({ item }: { item: any }) => null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(0, insets.top * 0.25) }]}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => router.back()}>
            <Ionicons name="close" size={30}  />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Bài viết mới</Text>

  
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 128 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authorRow}>
            <Image source={getAvatarSource(profile?.avatar_url)} style={styles.avatar} />
            <Text style={styles.authorName} numberOfLines={1}>
              {profile?.displayName || profile?.full_name || 'Bạn'}
            </Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Bạn đang nghĩ gì?"
            multiline
            value={content}
            placeholderTextColor="rgba(0, 0, 0, 0.45)"
            onChangeText={setContent}
          />

          {selectedImages.length > 0 ? (
            <FlatList
              data={selectedImages}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => index.toString()}
              contentContainerStyle={styles.selectedList}
              renderItem={({ item, index }) => (
                <View style={styles.selectedImageContainer}>
                  {isVideoAsset(item.uri, item.type) ? (
                    <View style={[styles.selectedPreviewImage, styles.videoPreviewBox]}>
                      <Ionicons name="videocam" size={22} />
                      <Text style={styles.videoPreviewText}>Video</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: item.uri }} style={styles.selectedPreviewImage} />
                  )}

                  {isVideoAsset(item.uri, item.type) ? (
                    <View style={styles.videoBadge}>
                      <Ionicons name="play" size={12} />
                      <Text style={styles.videoBadgeText}>Video</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    onPress={() => setSelectedImages((prev) => prev.filter((_, i) => i !== index))}
                    style={styles.removeImageBadge}
                  >
                    <Ionicons name="close-circle" size={18} color="rgba(255, 0, 0, 1)" />
                  </TouchableOpacity>
                </View>
              )}
            />
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.actionButtonsGroup}>
            <TouchableOpacity style={styles.libraryButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={20} color="#000000" />
              
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.libraryButton} onPress={pickFromLibrary}>
            <Ionicons name="image-outline" size={20} />
          </TouchableOpacity>
          </View>
          


          <TouchableOpacity
            onPress={submit}
            disabled={!content.trim() || loading}
            style={[styles.postBtn, content.trim() ? styles.postBtnActive : styles.postBtnDisabled]}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>Đăng</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)', // Đổi viền ngăn cách sang màu đen trong suốt
  },
  headerIconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '800',
    marginHorizontal: 8,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E5E5EA', // Đổi nền xám sáng (khi chưa load được ảnh)
    marginRight: 14,
  },
  authorName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
  input: {
    minHeight: 240,
    fontSize: 18,
    lineHeight: 30,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  selectedList: {
    paddingTop: 18,
    paddingBottom: 6,
  },
  selectedImageContainer: {
    marginRight: 10,
    position: 'relative',
  },
  selectedPreviewImage: {
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  videoPreviewBox: {
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewText: { color: '#fff', fontSize: 10, marginTop: 2, fontWeight: '600' },
  videoBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  videoBadgeText: { color: '#fff', fontSize: 10, marginLeft: 3, fontWeight: '600' },
  removeImageBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)', // Đổi viền ngăn cách sang đen nhạt
    backgroundColor: '#FFFFFF',
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
  },
  actionButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
  },
  actionButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  libraryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  postBtn: {
    minWidth: 112,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  postBtnActive: { backgroundColor: '#3E6DF7' },
  postBtnDisabled: { backgroundColor: '#D1D1D6' },
  postBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});