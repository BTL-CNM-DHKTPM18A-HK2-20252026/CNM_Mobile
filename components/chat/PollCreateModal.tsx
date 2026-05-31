import { useTheme } from '@/context/ThemeContext';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface PollCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    question: string;
    options: string[];
    deadline?: string;
    isPinned?: boolean;
    multipleChoices?: boolean;
    allowAddOptions?: boolean;
    hideResultsBeforeVote?: boolean;
    hideVoters?: boolean;
  }) => void;
}

export default function PollCreateModal({ visible, onClose, onSubmit }: PollCreateModalProps) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [showSettings, setShowSettings] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [deadlinePickerVisible, setDeadlinePickerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const next = new Date();
    next.setHours(0, 0, 0, 0);
    return next;
  });
  const [isPinned, setIsPinned] = useState(false);
  const [multipleChoices, setMultipleChoices] = useState(true);
  const [allowAddOptions, setAllowAddOptions] = useState(true);
  const [hideResultsBeforeVote, setHideResultsBeforeVote] = useState(false);
  const [hideVoters, setHideVoters] = useState(false);

  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const buildDeadlineFromState = () => {
    const [datePart, timePart] = [deadlineDate.trim(), deadlineTime.trim()];
    if (!datePart || !timePart) return undefined;

    const dateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = timePart.match(/^(\d{2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) return undefined;

    const [, yearStr, monthStr, dayStr] = dateMatch;
    const [, hourStr, minuteStr] = timeMatch;
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    const day = Number.parseInt(dayStr, 10);
    const hour = Number.parseInt(hourStr, 10);
    const minute = Number.parseInt(minuteStr, 10);

    const next = new Date(year, month - 1, day, hour, minute, 0);
    if (Number.isNaN(next.getTime())) return undefined;
    return formatLocalDateTime(next);
  };

  const parseDeadlineToState = (value?: string | null) => {
    if (!value) return { date: '', time: '' };
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return { date: '', time: '' };
    }
    const pad = (v: number) => String(v).padStart(2, '0');
    return {
      date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
      time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
    };
  };

  const openDeadlineModal = () => {
    const next = parseDeadlineToState(deadline);
    setDeadlineDate(next.date);
    setDeadlineTime(next.time);
    if (next.date) {
      const [year, month] = next.date.split('-').map((part) => Number.parseInt(part, 10));
      const parsedMonth = new Date(year, month - 1, 1);
      if (!Number.isNaN(parsedMonth.getTime())) setCalendarMonth(parsedMonth);
    }
    setDeadlinePickerVisible(true);
  };

  const getMonthLabel = (date: Date) => {
    const months = [
      'Tháng 1',
      'Tháng 2',
      'Tháng 3',
      'Tháng 4',
      'Tháng 5',
      'Tháng 6',
      'Tháng 7',
      'Tháng 8',
      'Tháng 9',
      'Tháng 10',
      'Tháng 11',
      'Tháng 12',
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatDateValue = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const formatDateLabel = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
  };

  const getCalendarDays = (month: Date) => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const daysInMonth = end.getDate();
    const firstDay = (start.getDay() + 6) % 7;
    const cells: Array<{ date?: Date; key: string; empty?: boolean }> = [];

    for (let i = 0; i < firstDay; i += 1) {
      cells.push({ key: `empty-${i}`, empty: true });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      cells.push({ key: formatDateValue(date), date });
    }

    return cells;
  };

  const selectCalendarDate = (date: Date) => {
    setDeadlineDate(formatDateValue(date));
    setCalendarVisible(false);
  };

  const generateTimeOptions = () => {
    const optionsList: { label: string; value: string }[] = [];
    const hours = [6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22];
    hours.forEach((hour) => {
      [0, 30].forEach((minute) => {
        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');
        optionsList.push({ label: `${hh}:${mm}`, value: `${hh}:${mm}` });
      });
    });
    return optionsList;
  };

  const handleAddOption = () => {
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = () => {
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) {
      Alert.alert('Thông báo', 'Vui lòng nhập câu hỏi và ít nhất 2 phương án');
      return;
    }
    onSubmit({
      question: question.trim(),
      options: validOptions,
      deadline: deadline || undefined,
      isPinned,
      multipleChoices,
      allowAddOptions,
      hideResultsBeforeVote,
      hideVoters,
    });
    // Reset
    setQuestion('');
    setOptions(['', '']);
    setDeadline('');
    setDeadlineDate('');
    setDeadlineTime('');
    setIsPinned(false);
    setMultipleChoices(true);
    setAllowAddOptions(true);
    setHideResultsBeforeVote(false);
    setHideVoters(false);
    setShowSettings(false);
  };

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setDeadline('');
    setDeadlineDate('');
    setDeadlineTime('');
    setIsPinned(false);
    setMultipleChoices(true);
    setAllowAddOptions(true);
    setHideResultsBeforeVote(false);
    setHideVoters(false);
    setShowSettings(false);
  };

  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.card, paddingBottom: Platform.OS === 'ios' ? Math.max(34, insets.bottom) : Math.max(16, insets.bottom) }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.cancelBtn, { color: colors.textSecondary }]}>Huỷ</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Tạo bình chọn</Text>
            <TouchableOpacity onPress={() => setShowSettings((s) => !s)}>
              <Text style={[styles.settingsBtn, { color: '#0068FF' }]}>
                {showSettings ? 'Xong' : 'Cài đặt'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* Question */}
            <Text style={[styles.label, { color: colors.text }]}>Chủ đề bình chọn</Text>
            <TextInput
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1c1c' : '#fff' },
              ]}
              placeholder="Nhập câu hỏi..."
              placeholderTextColor={colors.textPlaceholder}
              value={question}
              onChangeText={setQuestion}
            />

            {/* Options */}
            <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>Phương án</Text>
            {options.map((opt, idx) => (
              <View key={idx} style={styles.optionRow}>
                <Text style={[styles.optionNumber, { color: colors.textSecondary }]}>{idx + 1}</Text>
                <TextInput
                  style={[
                    styles.optionInput,
                    { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1c1c' : '#fff' },
                  ]}
                  placeholder={`Phương án ${idx + 1}`}
                  placeholderTextColor={colors.textPlaceholder}
                  value={opt}
                  onChangeText={(val) => handleOptionChange(idx, val)}
                />
                {options.length > 2 && (
                  <TouchableOpacity onPress={() => handleRemoveOption(idx)} style={styles.removeBtn}>
                    <Text style={{ color: '#ef4444', fontSize: 18 }}>−</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
              <Text style={[styles.addOptionText, { color: '#0068FF' }]}>+ Thêm phương án</Text>
            </TouchableOpacity>

            {/* Settings */}
            {showSettings && (
              <View style={[styles.settingsSection, { borderTopColor: colors.border }]}>
                <DeadlineSettingRow
                  label="Hạn chót"
                  value={deadline ? buildDeadlineFromState() ?? deadline : 'Chưa đặt'}
                  onPress={openDeadlineModal}
                  colors={colors}
                />
                <SettingRow label="Cho phép chọn nhiều" value={multipleChoices} onValueChange={setMultipleChoices} colors={colors} />
                <SettingRow label="Cho thêm phương án" value={allowAddOptions} onValueChange={setAllowAddOptions} colors={colors} />
              </View>
            )}
          </ScrollView>

          {/* Submit */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.submitBtn, { opacity: question.trim() && options.filter((o) => o.trim()).length >= 2 ? 1 : 0.5 }]}
              onPress={handleSubmit}
              disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
            >
              <Text style={styles.submitText}>Tạo bình chọn</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={deadlinePickerVisible} transparent animationType="fade" onRequestClose={() => setDeadlinePickerVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.deadlineCard, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '80%' }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Hạn chót</Text>
                <Text style={[styles.deadlinePreview, { color: colors.textSecondary, marginTop: 8 }]}>Bấm vào ngày để mở lịch chọn.</Text>

                <View style={styles.deadlineInputRow}>
                  <View style={styles.deadlineInputGroup}>
                    <Text style={[styles.deadlineFieldLabel, { color: colors.textSecondary }]}>Ngày</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const nextMonth = deadlineDate ? new Date(`${deadlineDate}T00:00:00`) : new Date();
                        if (!Number.isNaN(nextMonth.getTime())) setCalendarMonth(nextMonth);
                        setCalendarVisible(true);
                      }}
                      activeOpacity={0.85}
                      style={[
                        styles.deadlineTextInput,
                        { borderColor: colors.border, backgroundColor: isDark ? '#1c1c1c' : '#fff' },
                      ]}
                    >
                      <Text style={{ color: deadlineDate ? colors.text : colors.textPlaceholder }}>
                        {deadlineDate ? formatDateLabel(deadlineDate) : 'Chọn ngày'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.deadlineInputGroup}>
                    <Text style={[styles.deadlineFieldLabel, { color: colors.textSecondary }]}>Giờ</Text>
                    <TextInput
                      value={deadlineTime}
                      onChangeText={setDeadlineTime}
                      placeholder="18:00"
                      placeholderTextColor={colors.textPlaceholder}
                      keyboardType="numbers-and-punctuation"
                      style={[
                        styles.deadlineTextInput,
                        { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1c1c' : '#fff' },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.quickActionRow}>
                  <TouchableOpacity
                    onPress={() => {
                      const now = new Date();
                      const pad = (v: number) => String(v).padStart(2, '0');
                      setDeadlineDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
                      setDeadlineTime('20:00');
                    }}
                    style={styles.quickChip}
                  >
                    <Text style={styles.quickChipText}>Hôm nay 20:00</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const now = new Date();
                      const tomorrow = new Date(now);
                      tomorrow.setDate(now.getDate() + 1);
                      const pad = (v: number) => String(v).padStart(2, '0');
                      setDeadlineDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`);
                      setDeadlineTime('18:00');
                    }}
                    style={styles.quickChip}
                  >
                    <Text style={styles.quickChipText}>Ngày mai 18:00</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.deadlinePreview, { color: colors.textSecondary }]}> 
                  {buildDeadlineFromState() ? `Đã chọn: ${buildDeadlineFromState()}` : 'Chưa đủ ngày hoặc giờ'}
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity onPress={() => setDeadlinePickerVisible(false)} style={styles.modalBtn}>
                    <Text style={{ color: colors.textSecondary }}>Đóng</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const nextDeadline = buildDeadlineFromState();
                      if (nextDeadline) setDeadline(nextDeadline);
                      setDeadlinePickerVisible(false);
                    }}
                    style={styles.modalBtn}
                  >
                    <Text style={{ color: '#0068FF', fontWeight: '700' }}>Xong</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      const prev = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
                      setCalendarMonth(prev);
                    }}
                    style={styles.calendarNavBtn}
                  >
                    <Text style={{ color: '#0068FF', fontSize: 18 }}>‹</Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{getMonthLabel(calendarMonth)}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
                      setCalendarMonth(next);
                    }}
                    style={styles.calendarNavBtn}
                  >
                    <Text style={{ color: '#0068FF', fontSize: 18 }}>›</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.weekdayRow}>
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((item) => (
                    <Text key={item} style={[styles.weekdayText, { color: colors.textSecondary }]}>
                      {item}
                    </Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {getCalendarDays(calendarMonth).map((item) => {
                    if (item.empty || !item.date) {
                      return <View key={item.key} style={styles.calendarDayCell} />;
                    }
                    const day = item.date;
                    const value = formatDateValue(day);
                    const selected = deadlineDate === value;
                    const today = formatDateValue(new Date()) === value;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        onPress={() => selectCalendarDate(day)}
                        style={[
                          styles.calendarDayCell,
                          {
                            borderColor: selected ? '#0068FF' : 'transparent',
                            backgroundColor: selected ? '#0068FF14' : 'transparent',
                          },
                        ]}
                      >
                        <Text style={{ color: selected ? '#0068FF' : colors.text, fontWeight: '600' }}>{item.date.getDate()}</Text>
                        {today ? <View style={styles.todayDot} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity onPress={() => setCalendarVisible(false)} style={styles.modalBtn}>
                    <Text style={{ color: colors.textSecondary }}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SettingRow({
  label,
  value,
  onValueChange,
  colors,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: any;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#ddd', true: '#0068FF80' }}
        thumbColor={value ? '#0068FF' : '#f4f3f4'}
      />
    </View>
  );
}

function DeadlineSettingRow({
  label,
  value,
  onPress,
  colors,
}: {
  label: string;
  value: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.deadlineRow} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.deadlineValue, { color: colors.textSecondary }]} numberOfLines={1}>
          {value || 'Chưa đặt'}
        </Text>
      </View>
      <Text style={{ color: '#0068FF', fontWeight: '600' }}>Chọn</Text>
    </TouchableOpacity>
  );
}

function DeadlinePickerButton({
  label,
  value,
  onPress,
  colors,
  style,
}: {
  label: string;
  value: string;
  onPress: () => void;
  colors: any;
  style?: any;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.deadlineField, style]}>
      <Text style={[styles.deadlineFieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.deadlineFieldInput, { borderColor: colors.border }]}>
        <Text style={{ color: value === 'Chọn ngày' || value === 'Chọn giờ' ? colors.textPlaceholder : colors.text }}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  cancelBtn: {
    fontSize: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  settingsBtn: {
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  optionNumber: {
    fontSize: 13,
    fontWeight: '600',
    width: 20,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  removeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addOptionBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  addOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsSection: {
    borderTopWidth: 0.5,
    marginTop: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 14,
    flex: 1,
  },
  deadlineValue: {
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    borderTopWidth: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  submitBtn: {
    backgroundColor: '#0068FF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  deadlineCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  deadlineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  deadlineInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  deadlineInputGroup: {
    flex: 1,
  },
  deadlineField: {
    flex: 1,
  },
  compactDeadlineRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  compactDeadlineField: {
    minWidth: 0,
  },
  deadlineFieldLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  deadlineFieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
  },
  deadlineTextInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarNavBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#0068FF14',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayText: {
    width: 34,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  todayDot: {
    marginTop: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0068FF',
  },
  pickerSection: {
    marginTop: 16,
  },
  pickerSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  quickChip: {
    backgroundColor: '#0068FF14',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickChipText: {
    color: '#0068FF',
    fontWeight: '700',
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  deadlinePreview: {
    marginTop: 10,
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
