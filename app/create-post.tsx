import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '@/services/api';

const { width } = Dimensions.get('window');
const COLUMN_SIZE = width / 3;

const mockGalleryImages = [
  { id: 'cam', type: 'camera' },
  { id: '1', url: 'https://via.placeholder.com/300/2e7d32/fff?text=Le+Tong+Ket' },
  { id: '2', url: 'https://via.placeholder.com/300/0d47a1/fff?text=FIFA+2026' },
  { id: '3', url: 'https://via.placeholder.com/300/ff3b30/fff?text=UI+Zalo' },
  { id: '4', url: 'https://via.placeholder.com/300/ff9500/fff?text=Code+React' },
  { id: '5', url: 'https://via.placeholder.com/300/4cd964/fff?text=Screen' },
];

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<any[]>([]);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!res.cancelled) {
      setSelectedImages(prev => [...prev, { uri: res.uri }]);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!res.cancelled) {
      setSelectedImages(prev => [...prev, { uri: res.uri }]);
    }
  };

  const submit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      // If there are images selected, upload them first to /files/upload/multiple
      let media: { url: string; altText?: string }[] = [];
      if (selectedImages.length > 0) {
        const uploadForm = new FormData();
        selectedImages.forEach((it, idx) => {
          const uri = it.uri;
          const filename = uri.split('/').pop() || `photo_${idx}.jpg`;
          const fileType = (filename.match(/\.(\w+)$/)?.[1] || 'jpg').toLowerCase();
          const mime = fileType === 'png' ? 'image/png' : 'image/jpeg';
          uploadForm.append('files', {
            uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
            name: filename,
            type: mime,
          } as any);
        });

        // Use files/multiple upload endpoint
        const uploadRes: any = await api.post('/files/upload/multiple', uploadForm, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // uploadRes is expected to be an array of FileUploadResponse
        const uploaded: any[] = Array.isArray(uploadRes) ? uploadRes : uploadRes?.data || [];
        media = uploaded.map(u => ({ url: u.fileUrl || u.url || u.file_url, altText: '' }));
      }

      // Create post with JSON body including media URLs
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

  const renderGalleryItem = ({ item }: { item: any }) => {
    if (item.type === 'camera') {
      return (
        <TouchableOpacity style={styles.cameraItem} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={32} color="#727272" />
          <Text style={styles.cameraText}>Chụp ảnh</Text>
        </TouchableOpacity>
      );
    }

    const isSelected = selectedImages.some(s => s.uri === item.url);
    return (
      <TouchableOpacity
        style={styles.galleryItem}
        onPress={() => {
          if (isSelected) setSelectedImages(prev => prev.filter(p => p.uri !== item.url));
          else setSelectedImages(prev => [...prev, { uri: item.url }]);
        }}
      >
        <Image source={{ uri: item.url }} style={styles.galleryImage} />
        <View style={[styles.selectCircle, isSelected && { backgroundColor: '#0082f6' }]} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.privacyDropdown}>
          <Ionicons name="people" size={18} color="#4f4f4f" />
          <View style={styles.privacyTextContainer}>
            <View style={styles.privacyRow}>
              <Text style={styles.privacyTitle}>Bạn bè Zalo</Text>
              <Ionicons name="caret-down" size={12} color="#4f4f4f" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.privacySubtitle}>Trừ bạn bè đã bị chặn xem</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.aaBadge}>
            <Text style={styles.aaText}>Aa</Text>
            <Ionicons name="megaphone" size={14} color="#fff" style={styles.iconInBadge} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={submit}
            disabled={!content.trim() || loading}
            style={[styles.postBtn, content.trim() ? styles.postBtnActive : styles.postBtnDisabled]}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>Đăng</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={mockGalleryImages}
        keyExtractor={(item) => item.id}
        renderItem={renderGalleryItem}
        numColumns={3}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        ListHeaderComponent={
          <View style={styles.mainContent}>
            <TextInput
              style={styles.input}
              placeholder="Bạn đang nghĩ gì?"
              placeholderTextColor="#a1a1a1"
              multiline
              value={content}
              onChangeText={setContent}
            />

            <View style={styles.colorTextRow}>
              <TouchableOpacity style={styles.circleColorButton}>
                <Text style={styles.circleColorText}>Aa</Text>
              </TouchableOpacity>

              <View style={styles.pickButtonsRow}>
                <TouchableOpacity style={styles.pickBtn} onPress={pickFromLibrary}>
                  <Ionicons name="image" size={20} color="#0082f6" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickBtn} onPress={takePhoto}>
                  <Ionicons name="camera" size={20} color="#4caf50" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.tagsRow}>
              <TouchableOpacity style={styles.tagItem}>
                <Ionicons name="musical-notes-outline" size={16} color="#111" />
                <Text style={styles.tagText}>Nhạc</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tagItem}>
                <Ionicons name="images-outline" size={16} color="#111" />
                <Text style={styles.tagText}>Album</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tagItem}>
                <Ionicons name="pricetag-outline" size={16} color="#111" />
                <Text style={styles.tagText}>Với bạn bè</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toolbarRow}>
              <TouchableOpacity style={styles.toolIcon}>
                <Ionicons name="happy-outline" size={24} color="#757575" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toolIcon, styles.toolActive]}>
                <Ionicons name="image" size={24} color="#0082f6" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolIcon}>
                <Ionicons name="play-circle-outline" size={24} color="#757575" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolIcon}>
                <Ionicons name="link-outline" size={24} color="#757575" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolIcon}>
                <Ionicons name="location-outline" size={24} color="#757575" />
              </TouchableOpacity>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 56,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  backButton: { padding: 4 },
  privacyDropdown: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 16 },
  privacyTextContainer: { marginLeft: 8 },
  privacyRow: { flexDirection: 'row', alignItems: 'center' },
  privacyTitle: { fontWeight: '600', fontSize: 15, color: '#111' },
  privacySubtitle: { fontSize: 11, color: '#888', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  aaBadge: {
    flexDirection: 'row',
    backgroundColor: '#0082f6',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    marginRight: 12,
  },
  aaText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  iconInBadge: { marginLeft: 4 },
  postBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  postBtnActive: { backgroundColor: '#0082f6' },
  postBtnDisabled: { backgroundColor: '#e0e0e0' },
  postBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  mainContent: { paddingHorizontal: 16, paddingTop: 16 },
  input: { minHeight: 120, fontSize: 18, color: '#111', textAlignVertical: 'top' },
  colorTextRow: { marginVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circleColorButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  circleColorText: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  pickButtonsRow: { flexDirection: 'row' },
  pickBtn: { marginLeft: 12, backgroundColor: '#f2f2f2', padding: 8, borderRadius: 8 },
  tagsRow: { flexDirection: 'row', marginBottom: 16 },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#fcfcfc',
  },
  tagText: { marginLeft: 6, fontSize: 13, color: '#333', fontWeight: '500' },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
    paddingVertical: 12,
    marginBottom: 4,
  },
  toolIcon: { padding: 4 },
  toolActive: { borderBottomWidth: 2, borderBottomColor: '#0082f6' },
  cameraItem: {
    width: COLUMN_SIZE - 2,
    height: COLUMN_SIZE - 2,
    backgroundColor: '#f7f7f7',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
  },
  cameraText: { fontSize: 12, color: '#727272', marginTop: 4 },
  galleryItem: {
    width: COLUMN_SIZE - 2,
    height: COLUMN_SIZE - 2,
    margin: 1,
    position: 'relative',
  },
  galleryImage: { width: '100%', height: '100%' },
  selectCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});
