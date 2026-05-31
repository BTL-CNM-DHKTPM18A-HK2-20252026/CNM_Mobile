import { useTheme } from '@/context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface PollCardProps {
  poll: any;
  currentUserId?: string;
  conversationId: string;
  messageId?: string;
  onClose?: () => void;
}

import { useRouter } from 'expo-router';

export default function PollCard({ poll, currentUserId, conversationId, messageId, onClose }: PollCardProps) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  if (!poll) return null;

  const [localOptions, setLocalOptions] = useState<any[]>(() => (poll.options || []).slice());

  useEffect(() => {
    setLocalOptions((poll.options || []).slice());
  }, [poll.options]);

  // Calculate unique voters
  const uniqueVoters = new Set<string>();
  localOptions?.forEach((opt: any) => {
    opt.voterIds?.forEach((v: string) => uniqueVoters.add(v));
  });
  const totalUniqueVoters = uniqueVoters.size;
  const totalVotesCast = localOptions?.reduce((sum: number, opt: any) => sum + (opt.voterIds?.length || 0), 0) || 0;
  const displayVoteCount = totalUniqueVoters > 0 ? totalUniqueVoters : totalVotesCast;

  const openPollDetails = () => {
    if (!messageId) return;
    router.push(`/poll-details?messageId=${encodeURIComponent(String(messageId))}&conversationId=${encodeURIComponent(String(conversationId))}`);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={openPollDetails}
      style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}
    >
      <View style={[styles.header, { backgroundColor: '#0068FF' }]}>
        <Text style={styles.headerIcon}>📊</Text>
        <View style={styles.headerText}>
          <Text style={styles.headerLabel}>BÌNH CHỌN NHÓM</Text>
          <Text style={styles.headerQuestion} numberOfLines={2}>{poll.question}</Text>
        </View>
      </View>

      <View style={[styles.settingsBar, { backgroundColor: isDark ? '#1c1c1c' : '#f5f5f5' }]}>
        <Text style={[styles.settingsText, { color: colors.subText }]}>
          {poll.multipleChoices ? 'Chọn nhiều phương án' : 'Chọn một phương án'}
        </Text>
        <Text style={{ color: '#0B74FF', fontWeight: '700' }}>{displayVoteCount} người đã bình chọn</Text>
      </View>

      <View style={styles.optionsContainer}>
        {(localOptions || []).map((opt: any, idx: number) => {
          const optVotes = opt.voterIds?.length || 0;
          const percent = totalVotesCast > 0 ? Math.max(1, Math.round((optVotes / totalVotesCast) * 100)) : 0;

          return (
            <View
              key={opt.optionId}
              style={[
                styles.optionRow,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${percent}%`,
                    backgroundColor: isDark ? 'rgba(0,104,255,0.15)' : '#E1EDFF',
                  },
                ]}
              />

              <View style={styles.optionContent}>
                <View style={styles.checkboxWrap}>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: '#C4CFDE',
                        backgroundColor: 'transparent',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.optionText, { color: colors.text }]} numberOfLines={3}>
                  {opt.content}
                </Text>

                <View
                  style={styles.voterInline}
                />
              </View>

              <Text style={styles.percentText}>{percent}%</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.footerHint}>
        <Text style={{ color: '#0068FF', fontWeight: '700' }}>Chạm để xem chi tiết và bình chọn</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    width: '94%',
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerIcon: {
    fontSize: 22,
  },
  headerText: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.9)',
  },
  headerQuestion: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  settingsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  settingsText: {
    fontSize: 10,
  },
  badge: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  optionsContainer: {
    padding: 14,
    paddingBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 7,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    zIndex: 1,
  },
  checkboxWrap: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0068FF',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  voterInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0068FF',
    zIndex: 1,
  },
  footerHint: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    alignItems: 'center',
  },
});
