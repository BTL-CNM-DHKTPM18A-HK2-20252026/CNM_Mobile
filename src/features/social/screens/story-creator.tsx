import React, { useState } from 'react';
import { TouchableOpacity, View, ActivityIndicator, Text, Platform, Alert, Image, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '@/services/api';
import * as SecureStore from 'expo-secure-store';

type Props = { onCreated?: () => void };

export default function StoryCreator({ onCreated }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');

  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập bị từ chối', 'Vui lòng cho phép truy cập camera');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
      if (res.cancelled) return;
      const asset = res.assets ? res.assets[0] : (res as any);
      setPreviewUri(asset.uri);
      setIsVideo(asset.type === 'video' || asset.uri.endsWith('.mp4'));
    } catch (err) {
      console.warn('Open camera error', err);
    }
  };

  const pickFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập bị từ chối', 'Vui lòng cho phép truy cập thư viện ảnh');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
      if (res.cancelled) return;
      const asset = res.assets ? res.assets[0] : (res as any);
      setPreviewUri(asset.uri);
      setIsVideo(asset.type === 'video' || asset.uri.endsWith('.mp4'));
    } catch (err) {
      console.warn('Pick media error', err);
    }
  };

  const uploadAndPostStory = async () => {
    if (!previewUri) return;
    setUploading(true);
    try {
      const userId = await SecureStore.getItemAsync('user_id');
      if (!userId) {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
        return;
      }

      const uri = previewUri;
      const uploadForm = new FormData();
      const filename = uri.split('/').pop() || `story_${Date.now()}.jpg`;
      const fileType = (filename.match(/\.(\w+)$/)?.[1] || 'jpg').toLowerCase();
      const mime = fileType === 'png' ? 'image/png' : (isVideo ? 'video/mp4' : 'image/jpeg');
      uploadForm.append('files', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: filename,
        type: mime,
      } as any);

      // Use fetch for multipart upload to let the native layer set the correct Content-Type/boundary
      const API_URL = process.env.EXPO_PUBLIC_API_URL;
      const token = await SecureStore.getItemAsync('user_token');
      const uploadResponse = await fetch(`${API_URL}/files/upload/multiple`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'X-Platform': 'mobile',
        },
        body: uploadForm,
      });
      if (!uploadResponse.ok) {
        const txt = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} ${txt}`);
      }
      const uploadResJson = await uploadResponse.json();
      const uploaded = Array.isArray(uploadResJson) ? uploadResJson : uploadResJson?.data || uploadResJson || [];
      const fileUrl = uploaded[0]?.fileUrl || uploaded[0]?.url || uploaded[0]?.file_url;
      if (!fileUrl) throw new Error('Upload failed');

      const body = { mediaUrl: fileUrl, mediaType: isVideo ? 'VIDEO' : 'IMAGE', caption: caption || '' };
      await api.post('/stories', body, {
        headers: {
          'X-User-Id': String(userId),
        },
      });

      onCreated && onCreated();
      router.back();
    } catch (err) {
      console.warn('Upload story error', err);
      Alert.alert('Lỗi', 'Không thể đăng Story.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadPress = () => {
    if (!previewUri || uploading) return;
    Alert.alert('Xác nhận', 'Bạn có chắc muốn đăng Story này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng', onPress: () => uploadAndPostStory() },
    ]);
  };

  return (
    <View style={[styles.pageContainer, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo Story</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.previewArea}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={{ color: '#888' }}>Chưa có nội dung</Text>
          </View>
        )}
      </View>

      {previewUri && (
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Thêm chú thích (tùy chọn)"
          style={styles.captionInput}
        />
      )}

      <View style={styles.actionsRowPage}>
        <TouchableOpacity style={styles.actionBtn} onPress={openCamera}>
          <Ionicons name="camera" size={22} color="#0082f6" />
          <Text style={styles.actionTxt}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={pickFromLibrary}>
          <Ionicons name="image" size={22} color="#0082f6" />
          <Text style={styles.actionTxt}>Thư viện</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadBtn, { backgroundColor: previewUri ? '#0082f6' : '#e0e0e0' }]}
          onPress={handleUploadPress}
          disabled={!previewUri || uploading}
        >
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadTxt}>Đăng</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: '#fff' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  backBtn: { width: 44, alignItems: 'flex-start' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  previewArea: { height: 360, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '100%' },
  emptyPreview: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  captionInput: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee', fontSize: 15 },
  actionsRowPage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  actionBtn: { alignItems: 'center', width: 88 },
  actionTxt: { marginTop: 6, color: '#333', fontSize: 13 },
  uploadBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  uploadTxt: { color: '#fff', fontWeight: '600' },
});