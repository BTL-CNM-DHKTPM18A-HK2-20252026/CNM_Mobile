import { useTheme } from '@/context/ThemeContext';
import { chatService } from '@/services/chatService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PollOption = {
  optionId: string;
  content: string;
  voterIds?: string[];
};

export default function PollDetailsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const messageId = String(params.messageId || '');
  const conversationId = String(params.conversationId || '');
  const pollSnapshot = typeof params.poll === 'string' ? params.poll : Array.isArray(params.poll) ? params.poll[0] : '';

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [poll, setPoll] = useState<any | null>(null);
  const [membersMap, setMembersMap] = useState<Record<string, any>>({});
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [addingOption, setAddingOption] = useState(false);
  const [newOptionText, setNewOptionText] = useState('');
  const [addOptionLoading, setAddOptionLoading] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editMultipleChoices, setEditMultipleChoices] = useState<boolean>(true);
  const [editAllowAddOptions, setEditAllowAddOptions] = useState<boolean>(true);
  const [editDeadlineYear, setEditDeadlineYear] = useState('');
  const [editDeadlineMonth, setEditDeadlineMonth] = useState('');
  const [editDeadlineDay, setEditDeadlineDay] = useState('');
  const [editDeadlineHour, setEditDeadlineHour] = useState('');
  const [editDeadlineMinute, setEditDeadlineMinute] = useState('');
  const [editDeadlineSecond, setEditDeadlineSecond] = useState('00');

  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const buildDeadlineFromState = () => {
    const year = Number.parseInt(editDeadlineYear, 10);
    const month = Number.parseInt(editDeadlineMonth, 10);
    const day = Number.parseInt(editDeadlineDay, 10);
    const hour = Number.parseInt(editDeadlineHour, 10);
    const minute = Number.parseInt(editDeadlineMinute, 10);
    const second = Number.parseInt(editDeadlineSecond, 10);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return undefined;

    const next = new Date(year, month - 1, day, hour, minute, second);
    if (Number.isNaN(next.getTime())) return undefined;
    return formatLocalDateTime(next);
  };

  const parseDeadlineToState = (deadline?: string | null) => {
    if (!deadline) return { year: '', month: '', day: '', hour: '', minute: '', second: '00' };
    const parsed = new Date(deadline);
    if (Number.isNaN(parsed.getTime())) {
      return { year: '', month: '', day: '', hour: '', minute: '', second: '00' };
    }
    const pad = (value: number) => String(value).padStart(2, '0');
    return {
      year: String(parsed.getFullYear()),
      month: pad(parsed.getMonth() + 1),
      day: pad(parsed.getDate()),
      hour: pad(parsed.getHours()),
      minute: pad(parsed.getMinutes()),
      second: pad(parsed.getSeconds()),
    };
  };

  useEffect(() => {
    let mounted = true;

    const loadCurrentUserId = async () => {
      const uid = await SecureStore.getItemAsync('user_id');
      if (mounted) {
        setCurrentUserId(uid || '');
      }
    };

    void loadCurrentUserId();

    async function load() {
      if (!messageId || !conversationId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (pollSnapshot) {
          try {
            const parsedPoll = JSON.parse(decodeURIComponent(pollSnapshot));
            if (mounted && parsedPoll) {
              // normalize options
              const opts = Array.isArray(parsedPoll.options) ? parsedPoll.options.map(normalizeOption) : [];
              setPoll({ ...parsedPoll, options: opts });
            }
          } catch {
            // fall back to network lookup below
          }
        }

        const resp: any = await chatService.getMessagesAround(conversationId, messageId, 1).catch(() => null);
        const rawResponse = resp?.data ?? resp;
        const list = Array.isArray(rawResponse?.content)
          ? rawResponse.content
          : Array.isArray(rawResponse?.data)
            ? rawResponse.data
            : Array.isArray(rawResponse)
              ? rawResponse
              : [];

        let foundMsg: any = null;
        if (list.length > 0) {
          foundMsg = list.find((m: any) => String(m.messageId) === String(messageId)) || null;
        }

        if (!foundMsg) {
          const pageResp: any = await chatService.getMessages(conversationId, 0, 100).catch(() => null);
          const pageRaw = pageResp?.data ?? pageResp;
          const pageList = Array.isArray(pageRaw?.content)
            ? pageRaw.content
            : Array.isArray(pageRaw?.data)
              ? pageRaw.data
              : Array.isArray(pageRaw)
                ? pageRaw
                : [];

          foundMsg = pageList.find((m: any) => String(m.messageId) === String(messageId)) || null;
        }

        if (!foundMsg) {
          if (!pollSnapshot) {
            setPoll(null);
          }
          return;
        }

        if (!pollSnapshot) {
          let pollData = foundMsg.poll;
          try {
            if (!pollData && foundMsg.content) pollData = JSON.parse(foundMsg.content);
          } catch {
            pollData = foundMsg.poll || null;
          }

          if (mounted) {
            const opts = Array.isArray(pollData?.options) ? pollData.options.map(normalizeOption) : [];
            setPoll(pollData ? { ...pollData, options: opts } : null);
          }
        }

        const memResp: any = await chatService.getConversationMembers(conversationId).catch(() => null);
        const members = (memResp && memResp.data) ? memResp.data : memResp;
        const map: Record<string, any> = {};

        if (Array.isArray(members)) {
          members.forEach((member: any) => {
            const memberId = String(member.userId || member.user_id || member.id || '');
            if (memberId) {
              map[memberId] = member;
            }
          });
        }

        setMembersMap(map);
      } catch (err) {
        console.warn('Failed load poll details', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [conversationId, messageId, pollSnapshot]);

  const normalizedOptions: PollOption[] = useMemo(() => {
    return Array.isArray(poll?.options) ? poll.options : [];
  }, [poll]);

  const totalVoters = useMemo(() => {
    const voterSet = new Set<string>();
    normalizedOptions.forEach((option) => {
      (option.voterIds || []).forEach((voterId) => voterSet.add(String(voterId)));
    });
    return voterSet.size;
  }, [normalizedOptions]);

  const selectedOptionIds = useMemo(() => {
    if (!currentUserId) return [] as string[];
    return normalizedOptions
      .filter((option) => (option.voterIds || []).map(String).includes(String(currentUserId)))
      .map((option) => option.optionId);
  }, [currentUserId, normalizedOptions]);

  const hasVoted = selectedOptionIds.length > 0;
  const showResults = !poll?.hideResultsBeforeVote || hasVoted;

  const handleVote = async (optionId: string) => {
    if (!poll) return;
    if (poll.deadline && new Date(poll.deadline).getTime() < Date.now()) {
      return;
    }

    if (!poll.multipleChoices && hasVoted && !selectedOptionIds.includes(optionId)) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (poll.multipleChoices) {
        const nextSelected = selectedOptionIds.includes(optionId)
          ? selectedOptionIds.filter((id) => id !== optionId)
          : [...selectedOptionIds, optionId];
        await chatService.votePoll(poll.pollId, nextSelected);
        setPoll((prev: any) => {
          if (!prev) return prev;
          const nextOptions = (prev.options || []).map((option: PollOption) => {
            const voterIds = (option.voterIds || []).map(String);
            if (option.optionId === optionId) {
              const hasUser = voterIds.includes(String(currentUserId));
              const updatedVoters = hasUser
                ? voterIds.filter((id) => id !== String(currentUserId))
                : [...voterIds, String(currentUserId)];
              return { ...option, voterIds: updatedVoters };
            }
            return option;
          });
          return { ...prev, options: nextOptions };
        });
      } else {
        await chatService.votePoll(poll.pollId, [optionId]);
        setPoll((prev: any) => {
          if (!prev) return prev;
          const nextOptions = (prev.options || []).map((option: PollOption) => {
            const voterIds = (option.voterIds || []).map(String).filter((id) => id !== String(currentUserId));
            if (option.optionId === optionId) {
              return { ...option, voterIds: [...voterIds, String(currentUserId)] };
            }
            return { ...option, voterIds };
          });
          return { ...prev, options: nextOptions };
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddOption = () => {
    setNewOptionText('');
    setAddingOption(true);
  };

  const isCreator = poll?.creatorId && String(poll.creatorId) === String(currentUserId);

  const openEditSettings = () => {
    if (!poll) return;
    setEditMultipleChoices(Boolean(poll.multipleChoices));
    setEditAllowAddOptions(Boolean(poll.allowAddOptions));
    const deadlineState = parseDeadlineToState(poll.deadline ?? undefined);
    setEditDeadlineYear(deadlineState.year);
    setEditDeadlineMonth(deadlineState.month);
    setEditDeadlineDay(deadlineState.day);
    setEditDeadlineHour(deadlineState.hour);
    setEditDeadlineMinute(deadlineState.minute);
    setEditDeadlineSecond(deadlineState.second);
    setIsEditingSettings(true);
  };

  const submitEditSettings = async () => {
    if (!poll) return;
    try {
      setIsSubmitting(true);
      const payload: any = {
        multipleChoices: editMultipleChoices,
        allowAddOptions: editAllowAddOptions,
        deadline: buildDeadlineFromState() ?? null,
      };
      const resp: any = await chatService.updatePollSettings(poll.pollId, payload).catch(() => null);
      const updated = resp?.data ?? resp;
      const newPoll = updated?.poll ?? updated ?? updated;
      if (newPoll) {
        const opts = Array.isArray(newPoll.options) ? newPoll.options.map(normalizeOption) : [];
        setPoll({ ...newPoll, options: opts });
      }
      setIsEditingSettings(false);
    } catch (err) {
      console.warn('Failed to update poll settings', err);
      Alert.alert('Lỗi', 'Không thể cập nhật cài đặt, thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitNewOption = async () => {
    if (!newOptionText.trim() || !poll) {
      return;
    }
    setAddOptionLoading(true);
    try {
      // optimistic add
      const tempId = `temp-${Date.now()}`;
      const optimistic = { optionId: tempId, content: newOptionText.trim(), voterIds: [] };
      setPoll((prev: any) => {
        if (!prev) return prev;
        const nextOptions = Array.isArray(prev.options) ? [...prev.options, optimistic] : [optimistic];
        return { ...prev, options: nextOptions };
      });

      const resp: any = await chatService.addPollOption(poll.pollId, newOptionText.trim()).catch(() => null);
      const created = resp?.data ?? resp;
      const serverOptionRaw = created?.option || created?.data || created;
      const serverOption = normalizeOption(serverOptionRaw || { optionId: String(Date.now()), content: newOptionText.trim(), voterIds: [] });

      // replace optimistic with server result (match by temp id)
      setPoll((prev: any) => {
        if (!prev) return prev;
        const nextOptions = Array.isArray(prev.options)
          ? prev.options.map((o: any) => (String(o.optionId) === String(tempId) ? serverOption : normalizeOption(o)))
          : [serverOption];
        return { ...prev, options: nextOptions };
      });
      setAddingOption(false);
    } catch (err) {
      console.warn('Failed to add option', err);
      Alert.alert('Lỗi', 'Không thêm được phương án, thử lại sau.');
    } finally {
      setAddOptionLoading(false);
    }
  };

  function normalizeOption(raw: any) {
    if (!raw) return { optionId: String(Date.now()), content: '', voterIds: [] };
    const optionId = String(raw.optionId ?? raw.id ?? raw.option_id ?? raw.id ?? raw.optionId ?? raw.key ?? raw.uuid ?? raw._id ?? Date.now());
    const content = String(raw.content ?? raw.text ?? raw.name ?? raw.title ?? raw.option ?? '');
    const voterIds = Array.isArray(raw.voterIds) ? raw.voterIds : Array.isArray(raw.voters) ? raw.voters : raw.voter_ids ? raw.voter_ids : [];
    return { optionId, content, voterIds };
  }

  const renderVoterAvatars = (option: PollOption) => {
    const voterIds = (option.voterIds || []).map(String);
    if (voterIds.length === 0) return null;

    return (
      <View style={styles.voterAvatarStack}>
        {voterIds.slice(0, 4).map((voterId, index) => {
          const member = membersMap[voterId];
          const avatarUrl = member?.avatarUrl || member?.avatar || member?.profilePicture || null;
          const overlapStyle = { marginLeft: index === 0 ? 0 : -10 };
          return avatarUrl ? (
            <Image key={`${option.optionId}-${voterId}`} source={{ uri: avatarUrl }} style={[styles.voterAvatar, overlapStyle]} />
          ) : (
            <View key={`${option.optionId}-${voterId}`} style={[styles.voterAvatar, styles.voterAvatarFallback, overlapStyle]} />
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}> 
        <ActivityIndicator size="large" color="#0068FF" />
      </SafeAreaView>
    );
  }

  if (!poll) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background, padding: 16 }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={{ color: '#0068FF' }}>Quay lại</Text></TouchableOpacity>
        <Text style={[styles.emptyText, { color: colors.text }]}>Không tìm thấy thông tin bình chọn.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}> 
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: '#0068FF', fontWeight: '600' }}>Quay lại</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{poll.question}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isCreator ? (
            <TouchableOpacity onPress={openEditSettings} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: '#0068FF', fontWeight: '600' }}>Chỉnh sửa</Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ width: 8 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.meta, { color: colors.subText }]}>{totalVoters} người đã bình chọn</Text>

        <Text style={[styles.pollType, { color: colors.textSecondary }]}> {poll.multipleChoices ? 'Chọn được nhiều phương án' : 'Chọn một phương án'} </Text>

        {normalizedOptions.map((opt, idx) => {
          const votes = (opt.voterIds || []).length;
          const percent = totalVoters > 0 ? Math.round((votes / totalVoters) * 100) : 0;
          const isSelected = selectedOptionIds.includes(opt.optionId);
          const canVote = !isSubmitting && (!poll.deadline || new Date(poll.deadline).getTime() >= Date.now()) && (poll.multipleChoices || !hasVoted || isSelected);

          return (
            <TouchableOpacity
              key={opt.optionId || idx}
              activeOpacity={0.82}
              disabled={!canVote}
              onPress={() => void handleVote(opt.optionId)}
              style={[
                styles.optionRow,
                {
                  backgroundColor: isSelected ? (isDark ? '#18315c' : '#EAF3FF') : colors.card,
                  borderColor: isSelected ? '#0068FF' : colors.border,
                },
              ]}
            >
              <View style={[styles.progressFill, { width: `${Math.max(2, percent)}%`, opacity: showResults ? 1 : 0 }]} />

              <View style={styles.optionMain}>
                <View style={styles.optionTopRow}>
                  <View style={[styles.optionIndicator, { borderColor: isSelected ? '#0068FF' : '#B9C4D4', backgroundColor: isSelected ? '#0068FF' : 'transparent' }]}>
                    {isSelected ? <Text style={styles.optionIndicatorCheck}>✓</Text> : null}
                  </View>
                  <Text style={[styles.optionText, { color: colors.text }]} numberOfLines={2}>{opt.content}</Text>
                  <Text style={styles.percentText}>{showResults ? `${percent}%` : ''}</Text>
                </View>

                {showResults ? (
                  <View style={styles.voterRow}>
                    {renderVoterAvatars(opt)}
                    <Text style={[styles.voteCountText, { color: colors.textSecondary }]}>{votes} phiếu</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}

        {poll.allowAddOptions ? (
          <TouchableOpacity style={styles.addOptionButton} onPress={handleOpenAddOption} activeOpacity={0.85}>
            <Text style={styles.addOptionText}>+ Thêm phương án</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={addingOption} transparent animationType="fade" onRequestClose={() => setAddingOption(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Thêm phương án</Text>
            <TextInput
              value={newOptionText}
              onChangeText={setNewOptionText}
              placeholder="Nhập nội dung phương án"
              placeholderTextColor={colors.subText}
              style={[styles.modalInput, { borderColor: colors.border, color: colors.text }]}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setAddingOption(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.subText }}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmitNewOption} style={[styles.modalBtn, { opacity: addOptionLoading ? 0.6 : 1 }]} disabled={addOptionLoading}>
                <Text style={{ color: '#0068FF', fontWeight: '700' }}>{addOptionLoading ? '...' : 'Thêm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isEditingSettings} transparent animationType="fade" onRequestClose={() => setIsEditingSettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Chỉnh sửa cài đặt</Text>
            <View style={{ marginTop: 8 }}>
              <ToggleRow label="Chọn nhiều phương án" value={editMultipleChoices} onPress={() => setEditMultipleChoices((s) => !s)} colors={colors} />
              <ToggleRow label="Cho phép thêm phương án" value={editAllowAddOptions} onPress={() => setEditAllowAddOptions((s) => !s)} colors={colors} />

              <Text style={[styles.settingLabel, { color: colors.text, marginTop: 10, marginBottom: 6 }]}>Hạn chót</Text>
              <View style={styles.deadlineGrid}>
                <DeadlineField label="Năm" value={editDeadlineYear} onChangeText={setEditDeadlineYear} placeholder="2026" colors={colors} />
                <DeadlineField label="Tháng" value={editDeadlineMonth} onChangeText={setEditDeadlineMonth} placeholder="06" colors={colors} />
                <DeadlineField label="Ngày" value={editDeadlineDay} onChangeText={setEditDeadlineDay} placeholder="01" colors={colors} />
                <DeadlineField label="Giờ" value={editDeadlineHour} onChangeText={setEditDeadlineHour} placeholder="18" colors={colors} />
                <DeadlineField label="Phút" value={editDeadlineMinute} onChangeText={setEditDeadlineMinute} placeholder="30" colors={colors} />
                <DeadlineField label="Giây" value={editDeadlineSecond} onChangeText={setEditDeadlineSecond} placeholder="00" colors={colors} />
              </View>

              <Text style={[styles.deadlinePreview, { color: colors.textSecondary }]}> 
                {buildDeadlineFromState() ? `Đã chọn: ${buildDeadlineFromState()}` : 'Chưa chọn hoặc nhập chưa đủ hạn chót'}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setIsEditingSettings(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.subText }}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitEditSettings} style={[styles.modalBtn, { opacity: isSubmitting ? 0.6 : 1 }]} disabled={isSubmitting}>
                <Text style={{ color: '#0068FF', fontWeight: '700' }}>{isSubmitting ? '...' : 'Lưu'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onPress,
  colors,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity onPress={onPress} style={[styles.togglePill, value ? styles.togglePillOn : styles.togglePillOff]}>
        <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : styles.toggleKnobOff]} />
        <Text style={[styles.toggleText, { color: value ? '#fff' : colors.subText }]}>{value ? 'ON' : 'OFF'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function DeadlineField({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  colors: any;
}) {
  return (
    <View style={styles.deadlineField}>
      <Text style={[styles.deadlineFieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 4))}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        keyboardType="number-pad"
        style={[styles.deadlineFieldInput, { borderColor: colors.border, color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1 },
  backBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  scrollContent: { padding: 16, paddingBottom: 24 },
  meta: { marginBottom: 8, fontSize: 13, fontWeight: '600' },
  pollType: { marginBottom: 14, fontSize: 13 },
  optionRow: {
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#D6EEFF',
    borderRadius: 12,
  },
  optionMain: { position: 'relative', zIndex: 1 },
  optionTopRow: { flexDirection: 'row', alignItems: 'center' },
  optionIndicator: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  optionIndicatorCheck: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 12 },
  optionText: { flex: 1, fontSize: 15, fontWeight: '700', paddingRight: 10 },
  percentText: { minWidth: 38, textAlign: 'right', color: '#0068FF', fontWeight: '800' },
  voterRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voterAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  voterAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#fff', backgroundColor: '#E6EEF9' },
  voterAvatarFallback: { backgroundColor: '#D8E6F6' },
  voteCountText: { fontSize: 12, fontWeight: '600' },
  addOptionButton: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  addOptionText: { color: '#6B7280', fontWeight: '700' },
  emptyText: { marginTop: 24, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '90%', borderRadius: 12, padding: 14, borderWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  modalInput: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 44, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 12 },
  modalBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  togglePill: {
    minWidth: 72,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  togglePillOn: { backgroundColor: '#0068FF' },
  togglePillOff: { backgroundColor: '#E5E7EB' },
  toggleKnob: { width: 24, height: 24, borderRadius: 12 },
  toggleKnobOn: { backgroundColor: '#fff' },
  toggleKnobOff: { backgroundColor: '#fff' },
  toggleText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  deadlinePreview: { marginTop: 8, fontSize: 12 },
  deadlineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deadlineField: { width: '31%' },
  deadlineFieldLabel: { fontSize: 12, marginBottom: 4 },
  deadlineFieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, textAlign: 'center' },
});
