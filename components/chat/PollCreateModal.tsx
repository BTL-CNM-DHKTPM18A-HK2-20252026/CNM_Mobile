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
  const [deadlineModalVisible, setDeadlineModalVisible] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
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
    setDeadlineModalVisible(true);
  };

  const saveDeadline = () => {
    const nextDeadline = buildDeadlineFromState();
    if (!nextDeadline) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ ngày, giờ kết thúc bình chọn');
      return;
    }
    setDeadline(nextDeadline);
    setDeadlineModalVisible(false);
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
    setDeadlineModalVisible(false);
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
    setDeadlineModalVisible(false);
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

          <Modal visible={deadlineModalVisible} transparent animationType="fade" onRequestClose={() => setDeadlineModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.deadlineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Hạn chót</Text>
                <View style={styles.compactDeadlineRow}>
                  <DeadlineField label="Ngày" value={deadlineDate} onChangeText={setDeadlineDate} placeholder="2026-06-01" colors={colors} style={styles.compactDeadlineField} />
                  <DeadlineField label="Giờ" value={deadlineTime} onChangeText={setDeadlineTime} placeholder="18:30" colors={colors} style={styles.compactDeadlineField} />
                </View>
                <Text style={[styles.deadlinePreview, { color: colors.textSecondary }]}> 
                  {buildDeadlineFromState() ? `Đã chọn: ${buildDeadlineFromState()}` : 'Nhập ngày (YYYY-MM-DD) và giờ (HH:MM)'}
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity onPress={() => setDeadlineModalVisible(false)} style={styles.modalBtn}>
                    <Text style={{ color: colors.textSecondary }}>Huỷ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveDeadline} style={styles.modalBtn}>
                    <Text style={{ color: '#0068FF', fontWeight: '700' }}>Lưu</Text>
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

function DeadlineField({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  colors: any;
  style?: any;
}) {
  return (
    <View style={[styles.deadlineField, style]}>
      <Text style={[styles.deadlineFieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        keyboardType="number-pad"
        style={[styles.deadlineFieldInput, { borderColor: colors.border, color: colors.text }]}
      />
    </View>
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
