import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

interface VoiceMessageProps {
  uri: string;
  duration?: number;
  isCurrentUserMessage?: boolean;
  colors: any;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

export function VoiceMessage({ uri, duration = 0, isCurrentUserMessage, colors, isPlaying, onTogglePlay }: VoiceMessageProps) {
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => { audioRef.current?.unloadAsync(); };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      setProgress(0);
    }
  }, [isPlaying]);

  const play = async () => {
    if (audioRef.current) {
      await audioRef.current.unloadAsync();
    }
    const { sound } = await Audio.Sound.createAsync({ uri });
    audioRef.current = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.durationMillis) {
        setProgress(status.positionMillis / status.durationMillis);
      }
    });
    await sound.playAsync();
  };

  const waveHeights = [8, 14, 10, 18, 12, 16, 8, 12, 10, 14].map(h => isPlaying ? h * (0.5 + progress * 0.5) : h * 0.5);

  return (
    <TouchableOpacity
      onPress={onTogglePlay || play}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 180, paddingVertical: 4 }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isCurrentUserMessage ? '#0068FF20' : '#0068FF15', justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#0068FF" />
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 20, gap: 2 }}>
        {waveHeights.map((h, i) => (
          <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: isPlaying ? '#0068FF' : colors.textSecondary || '#999' }} />
        ))}
      </View>
      <Text style={{ fontSize: 12, color: colors.textSecondary || '#999', width: 40, textAlign: 'right' }}>
        {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
      </Text>
    </TouchableOpacity>
  );
}
