import { useTheme } from '@/context/ThemeContext';
import { chatService } from '@/services/chatService';
import React, { useState } from 'react';
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
}

import { useRouter } from 'expo-router';

export default function PollCard({ poll, currentUserId, conversationId, messageId, onClose }: PollCardProps) {
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

  // Largest remainder method for % calculation
  const rawPercents = (poll.options || []).map((opt: any) => {
    const votes = opt.voterIds?.length || 0;
    return totalVotesCast > 0 ? (votes / totalVotesCast) * 100 : 0;
  });
  const floored = rawPercents.map((p: number) => Math.floor(p));
  const remainder = Math.min(
    100 - floored.reduce((a: number, b: number) => a + b, 0),
    poll.options?.length || 0
  );
  const remainders = rawPercents.map((p: number, i: number) => ({
    idx: i,
    frac: p - floored[i],
  }));
  remainders.sort((a: any, b: any) => b.frac - a.frac);
  for (let r = 0; r < remainder && r < remainders.length; r++) {
    if (remainders[r]) floored[remainders[r].idx]++;
  }

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

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#0068FF' }]}>
        <Text style={styles.headerIcon}>📊</Text>
        <View style={styles.headerText}>
          <Text style={styles.headerLabel}>BÌNH CHỌN NHÓM</Text>
          <Text style={styles.headerQuestion} numberOfLines={2}>{poll.question}</Text>
        </View>
      </View>

      {/* Settings bar */}
      <View style={[styles.settingsBar, { backgroundColor: isDark ? '#1c1c1c' : '#f5f5f5' }]}>
        <Text style={[styles.settingsText, { color: colors.subText }]}>
          {poll.multipleChoices ? 'Chọn nhiều phương án' : 'Chọn một phương án'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {poll.hideVoters && (
            <Text style={[styles.badge, { backgroundColor: isDark ? '#333' : '#e0e0e0', color: colors.subText }]}>Ẩn danh</Text>
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
        {(poll.options || []).map((opt: any, idx: number) => {
          const optVotes = opt.voterIds?.length || 0;
          const percent = showResults ? (totalVotesCast > 0 ? floored[idx] : 0) : 0;
          const isSelected = selectedOptionIds.includes(opt.optionId);

          return (
            <TouchableOpacity
              key={opt.optionId}
              style={[
                styles.optionRow,
                {
                  borderColor: isSelected ? '#0068FF' : colors.border,
                  backgroundColor: isSelected ? (isDark ? '#1a2744' : '#f0f6ff') : colors.card,
                },
              ]}
              onPress={() => handleOptionClick(opt.optionId)}
              disabled={isSubmitting}
              activeOpacity={0.7}
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

              {/* Checkbox / Radio */}
              <View style={styles.optionContent}>
                <View style={styles.checkboxWrap}>
                  {poll.multipleChoices ? (
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected ? '#0068FF' : colors.border,
                          backgroundColor: isSelected ? '#0068FF' : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor: isSelected ? '#0068FF' : colors.border,
                        },
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.optionText, { color: colors.text }]}
                  numberOfLines={3}
                >
                  {opt.content}
                </Text>

                {/* Voter avatars inline */}
                {showResults && !poll.hideVoters && opt.voterIds?.length > 0 && (
                  <View style={styles.voterInline}>
                    <Text style={{ fontSize: 11, color: colors.subText }}>
                      {opt.voterIds.length} phiếu
                    </Text>
                  </View>
                )}
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
