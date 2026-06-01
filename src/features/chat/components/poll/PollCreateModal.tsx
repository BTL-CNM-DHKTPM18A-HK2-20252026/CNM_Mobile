import { useTheme } from '@/context/ThemeContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type PollOptionItem = { id: string; value: string };

export interface PollCreateData {
  question: string;
  options: string[];
  deadline?: string;
  multipleChoices?: boolean;
  allowAddOptions?: boolean;
}

interface PollCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: PollCreateData) => void;
}

const INITIAL_OPTIONS: PollOptionItem[] = [
  { id: '1', value: '' },
  { id: '2', value: '' },
];

export default function PollCreateModal({ visible, onClose, onSubmit }: PollCreateModalProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<PollOptionItem[]>(() => [...INITIAL_OPTIONS]);
  const [multipleChoices, setMultipleChoices] = useState(true);
  const [allowAddOptions, setAllowAddOptions] = useState(true);
  const [deadlineDraft, setDeadlineDraft] = useState<Date | null>(null);
  const [deadlineModalVisible, setDeadlineModalVisible] = useState(false);
  const [deadlineHourText, setDeadlineHourText] = useState('09');
  const [deadlineMinuteText, setDeadlineMinuteText] = useState('00');
  const [deadlineSecondText, setDeadlineSecondText] = useState('00');

  const nextOptionIdRef = useRef(3);

  const deadline = useMemo(() => {
    if (!deadlineDraft) return undefined;
    const next = new Date(deadlineDraft);
    const hour = clamp(Number.parseInt(deadlineHourText, 10), 0, 23);
    const minute = clamp(Number.parseInt(deadlineMinuteText, 10), 0, 59);
    const second = clamp(Number.parseInt(deadlineSecondText, 10), 0, 59);
    next.setHours(hour, minute, second, 0);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}:${pad(next.getSeconds())}`;
  }, [deadlineDraft, deadlineHourText, deadlineMinuteText, deadlineSecondText]);

  const deadlineLabel = useMemo(() => {
    if (!deadlineDraft) return 'Chọn ngày giờ';
    return formatDeadlineLabel(deadlineDraft, deadlineHourText, deadlineMinuteText, deadlineSecondText);
  }, [deadlineDraft, deadlineHourText, deadlineMinuteText, deadlineSecondText]);

  const createEmptyOption = useCallback((): PollOptionItem => {
    const id = String(nextOptionIdRef.current);
    nextOptionIdRef.current += 1;
    return { id, value: '' };
  }, []);

  const resetForm = useCallback(() => {
    nextOptionIdRef.current = 3;
    setQuestion('');
    setOptions([...INITIAL_OPTIONS]);
    setMultipleChoices(true);
    setAllowAddOptions(true);
    setDeadlineDraft(null);
    setDeadlineHourText('09');
    setDeadlineMinuteText('00');
    setDeadlineSecondText('00');
    setDeadlineModalVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) resetForm();
  }, [resetForm, visible]);

  const handleAddOption = useCallback(() => {
    setOptions((prev) => [...prev, createEmptyOption()]);
  }, [createEmptyOption]);

  const handleRemoveOption = useCallback((index: number) => {
    setOptions((prev) => {
      if (prev.length <= 2 || index < 2) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (next.length < 2) return [...INITIAL_OPTIONS];
      const lastOption = next[next.length - 1];
      if (lastOption.value.trim().length > 0) next.push(createEmptyOption());
      return next;
    });
  }, [createEmptyOption]);

  const handleOptionChange = useCallback((index: number, value: string) => {
    setOptions((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, value } : item));
      if (index === prev.length - 1 && value.trim().length > 0) {
        const trailingOption = next[next.length - 1];
        if (!trailingOption || trailingOption.value.trim().length > 0) next.push(createEmptyOption());
      }
      return next;
    });
  }, [createEmptyOption]);

  const filledOptions = options.map((option) => option.value.trim()).filter(Boolean);
  const canSubmit = Boolean(question.trim()) && filledOptions.length >= 2;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) {
      Alert.alert('Thông báo', 'Vui lòng nhập câu hỏi và ít nhất 2 phương án');
      return;
    }

    onSubmit({
      question: question.trim(),
      options: filledOptions,
      multipleChoices,
      allowAddOptions,
      deadline,
    });
    resetForm();
  }, [allowAddOptions, canSubmit, deadline, filledOptions, multipleChoices, onSubmit, question, resetForm]);

  const openDeadlineModal = useCallback(() => {
    setDeadlineDraft((prev) => prev ?? startOfHourPlus(new Date()));
    setDeadlineModalVisible(true);
  }, []);

  const closeDeadlineModal = useCallback(() => {
    setDeadlineModalVisible(false);
  }, []);

  const confirmDeadline = useCallback(() => {
    setDeadlineModalVisible(false);
  }, []);

  const updateDeadlineDate = useCallback((nextDate: Date) => {
    setDeadlineDraft((prev) => {
      const base = prev ? new Date(prev) : startOfHourPlus(new Date());
      base.setFullYear(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
      return base;
    });
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <SafeAreaView
          style={[
            styles.modal,
            { backgroundColor: colors.card, paddingBottom: Platform.OS === 'ios' ? Math.max(34, insets.bottom) : Math.max(16, insets.bottom) },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.cancelBtn, { color: colors.textSecondary }]}>Huỷ</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Tạo bình chọn</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.text }]}>Chủ đề bình chọn</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1c1c' : '#fff' }]}
              placeholder="Nhập câu hỏi..."
              placeholderTextColor={colors.textPlaceholder}
              value={question}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              onChangeText={setQuestion}
            />

            <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>Phương án</Text>
            {options.map((opt, idx) => (
              <View key={opt.id} style={styles.optionRow}>
                <Text style={[styles.optionNumber, { color: colors.textSecondary }]}>{idx + 1}</Text>
                <TextInput
                  style={[styles.optionInput, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1c1c' : '#fff' }]}
                  placeholder={`Phương án ${idx + 1}`}
                  placeholderTextColor={colors.textPlaceholder}
                  value={opt.value}
                  multiline={false}
                  textAlignVertical="top"
                  onChangeText={(val) => handleOptionChange(idx, val)}
                />
                {idx >= 2 && (
                  <TouchableOpacity onPress={() => handleRemoveOption(idx)} style={styles.removeBtn}>
                    <Text style={{ color: '#ef4444', fontSize: 18 }}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <View style={[styles.settingsSection, { borderTopColor: colors.border }]}>
              <ToggleRow label="Chọn nhiều phương án" value={multipleChoices} onPress={() => setMultipleChoices((s) => !s)} colors={colors} />
              <ToggleRow label="Cho phép thêm phương án" value={allowAddOptions} onPress={() => setAllowAddOptions((s) => !s)} colors={colors} />

              <View style={{ marginTop: 10 }}>
                <Text style={[styles.settingLabel, { color: colors.text, marginBottom: 6 }]}>Hạn chót</Text>
                <TouchableOpacity
                  onPress={openDeadlineModal}
                  activeOpacity={0.85}
                  style={[styles.deadlineInputButton, { borderColor: colors.border, backgroundColor: isDark ? '#12233f' : '#f3f8ff' }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.deadlineInputLabel, { color: colors.textSecondary }]}>Bấm để chọn hạn chót</Text>
                    <Text style={[styles.deadlineInputValue, { color: colors.text }]} numberOfLines={1}>{deadlineLabel}</Text>
                  </View>
                  <Text style={styles.deadlineArrow}>›</Text>
                </TouchableOpacity>
                <Text style={[styles.deadlinePreview, { color: colors.textSecondary }]}>{deadline ? `Đã chọn: ${deadline}` : 'Chưa chọn hoặc nhập chưa đủ hạn chót'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
              <Text style={[styles.addOptionText, { color: '#0068FF' }]}>+ Thêm phương án</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.submitBtn, { opacity: canSubmit ? 1 : 0.5 }]} onPress={handleSubmit} disabled={!canSubmit}>
              <Text style={styles.submitText}>Tạo bình chọn</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <DeadlineModal
          visible={deadlineModalVisible}
          colors={colors}
          isDark={isDark}
          selectedDate={deadlineDraft}
          hourText={deadlineHourText}
          minuteText={deadlineMinuteText}
          secondText={deadlineSecondText}
          onClose={closeDeadlineModal}
          onSelectDate={updateDeadlineDate}
          onHourChange={setDeadlineHourText}
          onMinuteChange={setDeadlineMinuteText}
          onSecondChange={setDeadlineSecondText}
          onConfirm={confirmDeadline}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ToggleRow({ label, value, onPress, colors }: { label: string; value: boolean; onPress: () => void; colors: any }) {
  return (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity onPress={onPress} style={[styles.togglePill, value ? styles.togglePillOn : styles.togglePillOff]}>
        <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : styles.toggleKnobOff]} />
        <Text style={[styles.toggleText, { color: value ? '#fff' : colors.textSecondary }]}>{value ? 'ON' : 'OFF'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function DeadlineModal({
  visible,
  colors,
  isDark,
  selectedDate,
  hourText,
  minuteText,
  secondText,
  onClose,
  onSelectDate,
  onHourChange,
  onMinuteChange,
  onSecondChange,
  onConfirm,
}: {
  visible: boolean;
  colors: any;
  isDark: boolean;
  selectedDate: Date | null;
  hourText: string;
  minuteText: string;
  secondText: string;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  onHourChange: (text: string) => void;
  onMinuteChange: (text: string) => void;
  onSecondChange: (text: string) => void;
  onConfirm: () => void;
}) {
  const current = selectedDate ?? startOfHourPlus(new Date());
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
  const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const totalDays = monthEnd.getDate();
  const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const cells: Array<{ date: Date; inMonth: boolean; key: string }> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ date: new Date(monthStart.getFullYear(), monthStart.getMonth(), i - firstWeekday + 1), inMonth: false, key: `prev-${i}` });
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day), inMonth: true, key: `day-${day}` });
  }
  while (cells.length % 7 !== 0) {
    const nextIndex = cells.length - firstWeekday - totalDays + 1;
    cells.push({ date: new Date(monthEnd.getFullYear(), monthEnd.getMonth() + 1, nextIndex), inMonth: false, key: `next-${cells.length}` });
  }

  const moveMonth = (delta: number) => {
    const next = new Date(current);
    next.setMonth(next.getMonth() + delta);
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(next.getDate(), maxDay));
    onSelectDate(next);
  };

  const hourValue = clamp(Number.parseInt(hourText, 10), 0, 23);
  const minuteValue = clamp(Number.parseInt(minuteText, 10), 0, 59);
  const secondValue = clamp(Number.parseInt(secondText, 10), 0, 59);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.deadlineModalOverlay}>
        <View style={[styles.deadlineModalCard, { backgroundColor: isDark ? '#f7fbff' : '#ffffff', borderColor: '#bcd8ff' }]}>
          <View style={styles.deadlineModalHeader}>
            <Text style={styles.deadlineModalTitle}>Chọn ngày & giờ</Text>
            <TouchableOpacity onPress={onClose} style={styles.deadlineModalClose}>
              <Text style={styles.deadlineCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.deadlineSectionTitle}>Chọn ngày</Text>
          <View style={styles.calendarShell}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => moveMonth(-1)} style={styles.monthNavBtn}>
                <Text style={styles.monthNavIcon}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>Tháng {monthStart.getMonth() + 1}, {monthStart.getFullYear()}</Text>
              <TouchableOpacity onPress={() => moveMonth(1)} style={styles.monthNavBtn}>
                <Text style={styles.monthNavIcon}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {weekdayLabels.map((label) => <Text key={label} style={styles.weekLabel}>{label}</Text>)}
            </View>

            <View style={styles.daysGrid}>
              {cells.map((cell) => {
                const isSelected = Boolean(selectedDate && cell.inMonth && selectedDate.getFullYear() === cell.date.getFullYear() && selectedDate.getMonth() === cell.date.getMonth() && selectedDate.getDate() === cell.date.getDate());
                return (
                  <TouchableOpacity
                    key={cell.key}
                    onPress={() => cell.inMonth && onSelectDate(cell.date)}
                    disabled={!cell.inMonth}
                    style={[styles.dayCell, !cell.inMonth && styles.dayCellMuted, isSelected && styles.dayCellSelected]}
                  >
                    <Text style={[styles.dayCellText, isSelected && styles.dayCellTextSelected, !cell.inMonth && styles.dayCellTextMuted]}>{cell.date.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Text style={[styles.deadlineSectionTitle, { marginTop: 14 }]}>Chọn giờ</Text>
          <View style={styles.timeShell}>
            <ScrollColumn label="Giờ" max={23} value={hourValue} onChange={onHourChange} />
            <View style={styles.timeDivider} />
            <ScrollColumn label="Phút" max={59} value={minuteValue} onChange={onMinuteChange} />
            <View style={styles.timeDivider} />
            <ScrollColumn label="Giây" max={59} value={secondValue} onChange={onSecondChange} />
          </View>

          <TouchableOpacity onPress={onConfirm} style={styles.deadlineConfirmBtn}>
            <Text style={styles.deadlineConfirmText}>Xác nhận</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ScrollColumn({ label, max, value, onChange }: { label: string; max: number; value: number; onChange: (text: string) => void }) {
  const items = Array.from({ length: max + 1 }, (_, index) => index);
  return (
    <View style={styles.timeColumn}>
      <Text style={styles.timeColumnLabel}>{label}</Text>
      <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const selected = item === value;
          return (
            <TouchableOpacity key={item} onPress={() => onChange(String(item).padStart(2, '0'))} style={[styles.timeItem, selected && styles.timeItemSelected]}>
              <Text style={[styles.timeItemText, selected && styles.timeItemTextSelected]}>{String(item).padStart(2, '0')}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function startOfHourPlus(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

function formatDeadlineLabel(date: Date, hourText: string, minuteText: string, secondText: string) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${hourText.padStart(2, '0')}:${minuteText.padStart(2, '0')}:${secondText.padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { borderTopLeftRadius: 14, borderTopRightRadius: 14, maxHeight: '85%', paddingBottom: Platform.OS === 'ios' ? 28 : 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#dbeafe', backgroundColor: '#eff6ff' },
  cancelBtn: { fontSize: 15 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 92 },
  optionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  optionNumber: { fontSize: 13, fontWeight: '600', width: 20, marginRight: 8 },
  optionInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, minHeight: 44 },
  removeBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  addOptionBtn: { paddingVertical: 8, alignItems: 'center' },
  addOptionText: { fontSize: 14, fontWeight: '600' },
  settingsSection: { borderTopWidth: 0.5, marginTop: 12, paddingTop: 12, paddingBottom: 12 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  settingLabel: { fontSize: 14, flex: 1 },
  togglePill: { minWidth: 72, height: 32, borderRadius: 16, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  togglePillOn: { backgroundColor: '#0068FF' },
  togglePillOff: { backgroundColor: '#E5E7EB' },
  toggleKnob: { width: 24, height: 24, borderRadius: 12 },
  toggleKnobOn: { backgroundColor: '#fff' },
  toggleKnobOff: { backgroundColor: '#fff' },
  toggleText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  deadlinePreview: { marginTop: 8, fontSize: 12 },
  deadlineInputButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deadlineInputLabel: { fontSize: 12, marginBottom: 2 },
  deadlineInputValue: { fontSize: 15, fontWeight: '700' },
  deadlineArrow: { color: '#2563eb', fontSize: 24, fontWeight: '700', marginLeft: 12 },
  footer: { borderTopWidth: 0.5, paddingHorizontal: 16, paddingTop: 12 },
  submitBtn: { backgroundColor: '#0068FF', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deadlineModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  deadlineModalCard: { width: '100%', maxWidth: 430, borderRadius: 24, borderWidth: 1, padding: 16, shadowColor: '#0f172a', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  deadlineModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  deadlineModalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  deadlineModalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fdf2f8', alignItems: 'center', justifyContent: 'center' },
  deadlineCloseText: { color: '#ef476f', fontSize: 24, lineHeight: 24, fontWeight: '300' },
  deadlineSectionTitle: { fontSize: 14, fontWeight: '700', color: '#1d4ed8', marginBottom: 8 },
  calendarShell: { borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbeafe', padding: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monthNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  monthNavIcon: { color: '#2563eb', fontSize: 24, fontWeight: '700', lineHeight: 24 },
  monthTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekLabel: { width: `${100 / 7}%`, textAlign: 'center', color: '#475569', fontSize: 12, fontWeight: '700' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginVertical: 2 },
  dayCellMuted: { opacity: 0.25 },
  dayCellSelected: { backgroundColor: '#ef476f' },
  dayCellText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  dayCellTextMuted: { color: '#94a3b8' },
  dayCellTextSelected: { color: '#fff' },
  timeShell: { flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 18, padding: 12 },
  timeColumn: { flex: 1, alignItems: 'center' },
  timeColumnLabel: { color: '#1d4ed8', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  timeScroll: { height: 180, width: '100%' },
  timeItem: { height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginVertical: 2, backgroundColor: 'transparent' },
  timeItemSelected: { backgroundColor: '#e0f2fe' },
  timeItemText: { fontSize: 18, fontWeight: '700', color: '#64748b' },
  timeItemTextSelected: { color: '#ef476f' },
  timeDivider: { width: 1, backgroundColor: '#dbeafe', marginHorizontal: 2 },
  deadlineConfirmBtn: { marginTop: 16, backgroundColor: '#ef476f', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  deadlineConfirmText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
