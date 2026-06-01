import { useTheme } from '@/context/ThemeContext';
import { chatService } from '@/services/chatService';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
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
  readOnly?: boolean;
}

import { useRouter } from 'expo-router';

export default function PollCard({ poll, currentUserId, conversationId, messageId, onClose, readOnly }: PollCardProps) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const router = useRouter();

  if (!poll) return null;

  // Calculate unique voters
  const uniqueVoters = new Set<string>();
  poll.options?.forEach((opt: any) => {
    opt.voterIds?.forEach((v: string) => uniqueVoters.add(v));
  });
  const totalUniqueVoters = uniqueVoters.size;
  const totalVotesCast = poll.options?.reduce((sum: number, opt: any) => sum + (opt.voterIds?.length || 0), 0) || 0;
  const hasVoted = uniqueVoters.has(currentUserId || '');
  const showResults = !poll.hideResultsBeforeVote || hasVoted;

  // Percent calculation will use unique voter count (same as details screen)

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(() => {
    return poll.options
      ?.filter((opt: any) => opt.voterIds?.includes(currentUserId))
      .map((opt: any) => opt.optionId) || [];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOptionClick = async (optionId: string) => {
    if (poll.deadline && new Date(poll.deadline).getTime() < Date.now()) {
      Alert.alert('Thông báo', 'Bình chọn này đã kết thúc!');
      return;
    }
    if (hasVoted && !poll.multipleChoices) {
      Alert.alert('Thông báo', 'Bạn đã bình chọn rồi!');
      return;
    }
    setIsSubmitting(true);
    try {
      if (poll.multipleChoices) {
        const newSelected = selectedOptionIds.includes(optionId)
          ? selectedOptionIds.filter((id) => id !== optionId)
          : [...selectedOptionIds, optionId];
        setSelectedOptionIds(newSelected);
        if (newSelected.length > 0) {
          await chatService.votePoll(poll.pollId, newSelected);
        }
      } else {
        await chatService.votePoll(poll.pollId, [optionId]);
        setSelectedOptionIds([optionId]);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể thực hiện bình chọn');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show only top 3 options in the preview: by percent desc, tie-breaker by original order
  const displayOptions = useMemo(() => {
    const opts = Array.isArray(poll.options) ? poll.options : [];
    if (opts.length <= 3) return opts;

    // If results are hidden, just show the first 3 options in original order
    if (!showResults) return opts.slice(0, 3);

    const withMeta = opts.map((o: any, i: number) => {
      const optVotes = o.voterIds?.length || 0;
      const percent = totalUniqueVoters > 0 ? Math.round((optVotes / totalUniqueVoters) * 100) : 0;
      return { opt: o, idx: i, percent, votes: optVotes } as { opt: any; idx: number; percent: number; votes: number };
    }) as { opt: any; idx: number; percent: number; votes: number }[];

    withMeta.sort((a: { opt: any; idx: number; percent: number; votes: number }, b: { opt: any; idx: number; percent: number; votes: number }) => {
      if (b.percent !== a.percent) return b.percent - a.percent; // higher percent first
      return a.idx - b.idx; // tie-break by original index (ascending)
    });

    return withMeta.slice(0, 3).map((m: { opt: any; idx: number; percent: number; votes: number }) => m.opt);
  }, [poll.options, showResults, totalUniqueVoters]);

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#0068FF' }]}>
        <Text style={styles.headerIcon}>📊</Text>
        <View style={styles.headerText}>
          <Text style={styles.headerLabel}>CUỘC BÌNH CHỌN</Text>
          <Text style={styles.headerQuestion} numberOfLines={2}>{poll.question}</Text>
        </View>
      </View>

      {/* Settings bar */}
      <View style={[styles.settingsBar, { backgroundColor: isDark ? '#1c1c1c' : '#f5f5f5' }]}>
        <Text style={[styles.settingsText, { color: colors.textSecondary }]}> 
          {poll.multipleChoices ? 'Chọn nhiều phương án' : 'Chọn một phương án'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {poll.hideVoters && (
            <Text style={[styles.badge, { backgroundColor: isDark ? '#333' : '#e0e0e0', color: colors.textSecondary }]}>Ẩn danh</Text>
          )}
          <TouchableOpacity onPress={() => {
            if (!messageId) return;
            router.push({
              pathname: '/poll-details',
              params: {
                messageId: String(messageId),
                conversationId: String(conversationId),
                poll: JSON.stringify(poll),
              },
            });
          }}>
            <Text style={{ color: '#0B74FF', fontWeight: '700' }}>{(poll && poll.options) ? (new Set((poll.options || []).flatMap((o: any) => o.voterIds || [])).size) : 0} người bình chọn</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {(displayOptions || []).map((opt: any, idx: number) => {
          const optVotes = opt.voterIds?.length || 0;
          const percent = showResults ? (totalUniqueVoters > 0 ? Math.round((optVotes / totalUniqueVoters) * 100) : 0) : 0;
          const isSelected = selectedOptionIds.includes(opt.optionId);

          return (
            <TouchableOpacity
              key={opt.optionId}
              style={[
                styles.optionRow,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
              onPress={readOnly ? undefined : () => handleOptionClick(opt.optionId)}
              disabled={isSubmitting || Boolean(readOnly)}
              activeOpacity={readOnly ? 1 : 0.7}
            >
              {/* Progress bar background */}
              {showResults && (
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${percent}%`,
                      backgroundColor: isDark ? 'rgba(0,104,255,0.15)' : '#E1EDFF',
                    },
                  ]}
                />
              )}

              {/* Option content (checkbox removed for preview) */}
              <View style={styles.optionContent}>
                <Text
                  style={[styles.optionText, { color: colors.text }]}
                  numberOfLines={3}
                >
                  {opt.content}
                </Text>

              </View>

              {/* Percent */}
              {showResults && (
                <Text style={styles.percentText}>{percent}%</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 4,
    maxWidth: 320,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  headerIcon: {
    fontSize: 22,
  },
  headerText: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.9)',
  },
  headerQuestion: {
    fontSize: 13,
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
    padding: 12,
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
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
    gap: 8,
    zIndex: 1,
  },
  /* checkbox removed for preview-only PollCard */
  optionText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  voterInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0068FF',
    zIndex: 1,
  },
});
