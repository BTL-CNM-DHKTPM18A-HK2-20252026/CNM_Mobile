import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '@/services/mediaUtils';

type Props = {
  isCreate?: boolean;
  onPress?: () => void;
  profile?: any;
  displayUri?: string;
  avatarSource?: any;
  name?: string;
};

export default function StoryCard({ isCreate, onPress, profile, displayUri, avatarSource, name }: Props) {
  const profileAvatar = getAvatarSource(profile?.avatar_url || profile?.avatar || profile?.profile_picture);

  if (isCreate) {
    return (
      <TouchableOpacity style={styles.storyCard} activeOpacity={0.9} onPress={onPress}>
        {profileAvatar ? (
          <>
            <Image source={profileAvatar} style={styles.storyCover} blurRadius={3} />
            <View style={[styles.storyOverlay, { backgroundColor: 'rgba(20,20,20,0.28)' }]} />
          </>
        ) : (
          <View style={[styles.storyCover, { backgroundColor: '#e4e6eb' }]} />
        )}

        <View style={styles.createStoryCircleCenter}>
          <Ionicons name="camera" size={20} color="#fff" />
        </View>

        <View style={styles.storyNameWrap}>
          <Text style={[styles.storyName, { color: '#fff', marginBottom: 34 }]} numberOfLines={1}>
            Tạo mới
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.storyCard} activeOpacity={0.9} onPress={onPress}>
      <Image source={{ uri: displayUri }} style={styles.storyCover} />
      <View style={styles.storyOverlay} />
      <Image source={avatarSource} style={styles.storyAvatarBorder} />
      <View style={styles.storyNameWrap}>
        <Text style={styles.storyName} numberOfLines={1}>
          {name || 'Bạn bè'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  storyCard: { width: 105, height: 145, marginRight: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f0f0f0', position: 'relative' },
  storyCover: { width: '100%', height: '100%' },
  storyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  createStoryCircleCenter: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -19 }, { translateY: -19 }],
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0082f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  storyAvatarBorder: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#0082f6',
  },
  storyNameWrap: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  storyName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
