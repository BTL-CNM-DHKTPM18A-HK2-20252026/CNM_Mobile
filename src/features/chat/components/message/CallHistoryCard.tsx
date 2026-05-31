import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from 'react-i18next';

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
  const directionText = isCaller
    ? t('chat.call.outgoing', 'Đã gọi')
    : t('chat.call.incoming', 'Đã nhận');

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {[directionText, durationText].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {!isMissed && durationSeconds ? (
        <Text style={[styles.duration, { color: colors.textSecondary }]}>{formatDuration(durationSeconds)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    maxWidth: 280,
    marginTop: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  duration: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
});
