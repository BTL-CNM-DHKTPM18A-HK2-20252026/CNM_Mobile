import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

type StoryItem = {
  id?: string;
  name?: string;
  avatar?: string;
  mediaUrl?: string;
  mediaType?: string; // 'VIDEO' | 'IMAGE'
  caption?: string;
};

type Props = {
  visible: boolean;
  stories: StoryItem[];
  startIndex?: number;
  onClose?: () => void;
};

const IMAGE_DURATION = 5000; // 5s per image

export default function StoryViewer({ visible, stories = [], startIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<any>(null);
  const videoRef = useRef<Video | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIndex(startIndex);
    } else {
      clearTimer();
      resetProgress();
    }
    return () => clearTimer();
  }, [visible, startIndex]);

  useEffect(() => {
    if (!visible) return;
    const current = stories[index];
    if (!current) return;
    clearTimer();
    resetProgress();

    if (current.mediaType === 'VIDEO') {
      // video will update progress via onPlaybackStatusUpdate
      // ensure it starts from 0
      setProgress(0);
    } else {
      // image: start a timer for IMAGE_DURATION
      const start = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - start;
        const p = Math.min(1, elapsed / IMAGE_DURATION);
        setProgress(p);
        progressAnim.setValue(p);
        if (p >= 1) {
          clearTimer();
          goNext();
        }
      }, 100);
    }

    return () => clearTimer();
  }, [index, visible]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetProgress = () => {
    setProgress(0);
    progressAnim.setValue(0);
  };

  const goNext = () => {
    if (index + 1 < stories.length) {
      setIndex(i => i + 1);
    } else {
      onClose && onClose();
    }
  };

  const goPrev = () => {
    if (index - 1 >= 0) setIndex(i => i - 1);
  };

  const onVideoStatus = (status: any) => {
    if (!status) return;
    if (status.isLoaded) {
      const p = status.positionMillis / Math.max(1, status.durationMillis);
      setProgress(p);
      progressAnim.setValue(p);
      if (status.didJustFinish) {
        goNext();
      }
    }
  };

  const current = stories[index] || {};

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen">
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => onClose && onClose()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Author (top-left) */}
        {(current.name || current.avatar) && (
          <View style={styles.authorWrap}>
            {current.avatar ? <Image source={{ uri: current.avatar }} style={styles.authorAvatar} /> : null}
            {current.name ? <Text style={styles.authorName}>{current.name}</Text> : null}
          </View>
        )}

        <View style={styles.progressRow} pointerEvents="none">
          {stories.map((_, i) => (
            <View key={String(i)} style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { flex: progressAnim && i === index ? progressAnim : (i < index ? 1 : 0) }]} />
            </View>
          ))}
        </View>

        <View style={styles.mediaWrap}>
          {current.mediaType === 'VIDEO' ? (
            <Video
              ref={v => (videoRef.current = v)}
              source={{ uri: current.mediaUrl }}
              style={styles.media}
              resizeMode="contain"
              shouldPlay
              useNativeControls={false}
              onPlaybackStatusUpdate={onVideoStatus}
            />
          ) : (
            <Image source={{ uri: current.mediaUrl }} style={styles.media} resizeMode="cover" />
          )}
        </View>

        <View style={styles.captionWrap}>
          <Text style={styles.captionText}>{current.caption ?? ''}</Text>
        </View>

        {/* Left/right tap zones to navigate */}
        <TouchableOpacity style={styles.leftZone} onPress={goPrev} />
        <TouchableOpacity style={styles.rightZone} onPress={goNext} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  mediaWrap: { width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' },
  media: { width: '100%', height: '100%' },
  captionWrap: { position: 'absolute', bottom: 60, left: 20, right: 20, zIndex: 40},
  captionText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 30 },
  progressRow: { position: 'absolute', top: 40, left: 10, right: 10, flexDirection: 'row', zIndex: 20 },
  authorWrap: { position: 'absolute', top: 46, left: 12, flexDirection: 'row', alignItems: 'center', zIndex: 30 },
  authorAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  authorName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 4, overflow: 'hidden', borderRadius: 2 },
  progressFill: { backgroundColor: '#fff', height: '100%' },
  leftZone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%' },
  rightZone: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%' },
});
