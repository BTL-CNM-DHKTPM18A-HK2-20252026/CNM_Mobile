import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface CallHistoryCardProps {
  callType?: string; // 'VOICE' | 'VIDEO' | 'GROUP_VOICE' | 'GROUP_VIDEO'
  durationSeconds?: number;
  status?: string; // 'MISSED' | 'ENDED' | 'CANCELLED'
  isCaller: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CallHistoryCard({ callType, durationSeconds, status, isCaller }: CallHistoryCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const isVideo = (callType || '').toUpperCase().includes('VIDEO');
  const isMissed = (status || '').toUpperCase() === 'MISSED';
  const isRejected = (status || '').toUpperCase() === 'REJECTED';
  const isGroup = (callType || '').toUpperCase().includes('GROUP');

  let icon: keyof typeof Ionicons.glyphMap = 'call-outline';
  let label = t('chat.call.voice', 'Cuộc gọi thoại');
  let iconColor = '#22C55E';

  if (isVideo) {
    icon = 'videocam-outline';
    label = t('chat.call.video', 'Cuộc gọi video');
    iconColor = '#3B82F6';
  }
  if (isGroup) {
    icon = isVideo ? 'videocam-outline' : 'call-outline';
    label = isVideo
      ? t('chat.call.groupVideo', 'Cuộc gọi video nhóm')
      : t('chat.call.groupVoice', 'Cuộc gọi thoại nhóm');
    iconColor = '#8B5CF6';
  }
  if (isMissed) {
    icon = 'call-outline';
    label = t('chat.call.missed', 'Cuộc gọi nhỡ');
    iconColor = '#EF4444';
  }
  if (isRejected) {
    icon = 'call-outline';
    label = isCaller ? t('chat.call.rejected', 'Cuộc gọi bận') : t('chat.call.missed', 'Cuộc gọi nhỡ');
    iconColor = '#EF4444';
  }

  const durationText = durationSeconds ? formatDuration(durationSeconds) : '';
  const bubbleText = isMissed ? label : durationText || t('chat.call.incoming', 'Đã nhận');

  return (
    <View style={[styles.bubble, { backgroundColor: colors.card }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text
        style={[
          styles.bubbleText,
          { color: isMissed ? iconColor : colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {bubbleText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 32,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});
