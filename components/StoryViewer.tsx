import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export type StoryViewerStory = {
  id: string;
  name: string;
  avatar: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  caption?: string;
  isViewed?: boolean;
};

type StoryViewerProps = {
  visible: boolean;
  story: StoryViewerStory | null;
  onClose: () => void;
};

export default function StoryViewer({ visible, story, onClose }: StoryViewerProps) {
  const insets = useSafeAreaInsets();
  const [replyText, setReplyText] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [progress, setProgress] = useState(0);

  // Hiệu ứng tự động chạy thanh tiến trình giả lập thời gian xem 5 giây
  useEffect(() => {
    if (visible) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 1) {
            clearInterval(interval);
            onClose(); // Tự động đóng khi xem hết thời gian
            return 1;
          }
          return prev + 0.02; // Tăng dần tiến trình
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [visible, story]);

  if (!story) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* 1. KHU VỰC HIỂN THỊ MEDIA CHÍNH (ẢNH STORY TRÀN VIỀN) */}
        <Image source={{ uri: story.mediaUrl }} style={styles.storyMedia} resizeMode="cover" />

        {/* Lớp phủ tối mờ ở đầu và đáy để hiển thị text rõ hơn */}
        <View style={styles.topGradient} />
        <View style={styles.bottomGradient} />

        {/* 2. THANH TIẾN TRÌNH (PROGRESS BAR) CHẠY ĐẦU MÀN HÌNH */}
        <View style={[styles.progressContainer, { top: insets.top + 8 }]}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarActive, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* 3. HEADER: THÔNG TIN TÁC GIẢ (AVATAR, TÊN, THỜI GIAN) */}
        <View style={[styles.headerContainer, { top: insets.top + 20 }]}>
          <Image source={{ uri: story.avatar || 'https://via.placeholder.com/80' }} style={styles.authorAvatar} />
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{story.name}</Text>
            <Text style={styles.timeAgo}>3m</Text> 
          </View>
          
          <TouchableOpacity style={styles.moreButton} activeOpacity={0.7}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Cụm đóng nhanh khi click vào vùng giữa màn hình */}
        <TouchableOpacity style={styles.closeTouchArea} activeOpacity={1} onPress={onClose} />

        {/* 4. ĐÁY MÀN HÌNH: THANH THẢ CẢM XÚC & TRẢ LỜI TIN TINH CHỈNH THEO MẪU */}
        <View style={[styles.bottomActionsContainer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.replyRow}>
            
            {/* Ô nhập tin nhắn phản hồi */}
            <View style={styles.inputWrapper}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder={`Trả lời ${story.name}...`}
                placeholderTextColor="rgba(255,255,255,0.7)"
                style={styles.replyInput}
              />
            </View>

            {/* Icon Thả tim tương tác nhanh */}
            <TouchableOpacity 
              style={styles.actionIconBtn} 
              onPress={() => setIsLiked(!isLiked)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={28} 
                color={isLiked ? "#e91e63" : "#fff"} 
              />
            </TouchableOpacity>

            {/* Icon Chia sẻ tin nhanh */}
            <TouchableOpacity style={styles.actionIconBtn} activeOpacity={0.7}>
              <Ionicons name="paper-plane-outline" size={26} color="#fff" />
            </TouchableOpacity>

          </View>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyMedia: {
    width: width,
    height: height,
    position: 'absolute',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeTouchArea: {
    position: 'absolute',
    top: 150,
    bottom: 120,
    left: 0,
    right: 0,
  },
  // Progress Bar Styles
  progressContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 20,
  },
  progressBarBackground: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarActive: {
    height: '100%',
    backgroundColor: '#fff',
  },
  // Header Styles
  headerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  authorInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  authorName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginLeft: 10,
  },
  moreButton: {
    padding: 6,
  },
  // Bottom Bar Input Styles
  bottomActionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 20,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputWrapper: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 18,
    justifyContent: 'center',
    marginRight: 12,
  },
  replyInput: {
    color: '#fff',
    fontSize: 14,
  },
  actionIconBtn: {
    width: 40,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});