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

type PollOptionItem = {
  id: string;
  value: string;
};

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
  const [deadlineYear, setDeadlineYear] = useState('');
  const [deadlineMonth, setDeadlineMonth] = useState('');
  const [deadlineDay, setDeadlineDay] = useState('');
  const [deadlineHour, setDeadlineHour] = useState('');
  const [deadlineMinute, setDeadlineMinute] = useState('');
  const [deadlineSecond, setDeadlineSecond] = useState('00');

  const nextOptionIdRef = useRef(3);

  const deadline = useMemo(() => {
    const year = Number.parseInt(deadlineYear, 10);
    const month = Number.parseInt(deadlineMonth, 10);
    const day = Number.parseInt(deadlineDay, 10);
    const hour = Number.parseInt(deadlineHour, 10);
    const minute = Number.parseInt(deadlineMinute, 10);
    const second = Number.parseInt(deadlineSecond, 10);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return undefined;

    const next = new Date(year, month - 1, day, hour, minute, second);
    if (Number.isNaN(next.getTime())) return undefined;

    const pad = (value: number) => String(value).padStart(2, '0');
    return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}:${pad(next.getSeconds())}`;
  }, [deadlineYear, deadlineMonth, deadlineDay, deadlineHour, deadlineMinute, deadlineSecond]);

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
    setDeadlineYear('');
    setDeadlineMonth('');
    setDeadlineDay('');
    setDeadlineHour('');
    setDeadlineMinute('');
    setDeadlineSecond('00');
  }, []);

  useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [resetForm, visible]);

  const handleAddOption = useCallback(() => {
    setOptions((prev) => [...prev, createEmptyOption()]);
  }, [createEmptyOption]);

  const handleRemoveOption = useCallback((index: number) => {
    setOptions((prev) => {
      if (prev.length <= 2 || index < 2) {
        return prev;
      }

      const next = prev.filter((_, i) => i !== index);
      if (next.length < 2) {
        return [...INITIAL_OPTIONS];
      }

      const lastOption = next[next.length - 1];
      if (lastOption.value.trim().length > 0) {
        next.push(createEmptyOption());
      }

      return next;
    });
  }, [createEmptyOption]);

  const handleOptionChange = useCallback((index: number, value: string) => {
    setOptions((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, value } : item));

      if (index === prev.length - 1 && value.trim().length > 0) {
        const trailingOption = next[next.length - 1];
        if (!trailingOption || trailingOption.value.trim().length > 0) {
          next.push(createEmptyOption());
        }
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <SafeAreaView
          style={[
            styles.modal,
            { backgroundColor: colors.card, paddingBottom: Platform.OS === 'ios' ? Math.max(34, insets.bottom) : Math.max(16, insets.bottom) },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.cancelBtn, { color: colors.textSecondary }]}>Huỷ</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Tạo bình chọn</Text>
            <View style={{ width: 60 }} />
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
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              onChangeText={setQuestion}
            />

            {/* Options */}
            <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>Phương án</Text>
            {options.map((opt, idx) => (
              <View key={opt.id} style={styles.optionRow}>
                <Text style={[styles.optionNumber, { color: colors.textSecondary }]}>{idx + 1}</Text>
                <TextInput
                  style={[
                    styles.optionInput,
                    { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1c1c' : '#fff' },
                  ]}
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
                  <View style={styles.deadlineGrid}>
                    <DeadlineField label="Năm" value={deadlineYear} onChangeText={setDeadlineYear} placeholder="2026" colors={colors} />
                    <DeadlineField label="Tháng" value={deadlineMonth} onChangeText={setDeadlineMonth} placeholder="06" colors={colors} />
                    <DeadlineField label="Ngày" value={deadlineDay} onChangeText={setDeadlineDay} placeholder="01" colors={colors} />
                    <DeadlineField label="Giờ" value={deadlineHour} onChangeText={setDeadlineHour} placeholder="18" colors={colors} />
                    <DeadlineField label="Phút" value={deadlineMinute} onChangeText={setDeadlineMinute} placeholder="30" colors={colors} />
                    <DeadlineField label="Giây" value={deadlineSecond} onChangeText={setDeadlineSecond} placeholder="00" colors={colors} />
                  </View>
                  <Text style={[styles.deadlinePreview, { color: colors.textSecondary }]}> 
                    {deadline ? `Đã chọn: ${deadline}` : 'Chưa chọn hoặc nhập chưa đủ hạn chót'}
                  </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
              <Text style={[styles.addOptionText, { color: '#0068FF' }]}>+ Thêm phương án</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Submit */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.submitBtn, { opacity: canSubmit ? 1 : 0.5 }]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <Text style={styles.submitText}>Tạo bình chọn</Text>
            </TouchableOpacity>
          </View>
          </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
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
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity onPress={onPress} style={[styles.togglePill, value ? styles.togglePillOn : styles.togglePillOff]}>
        <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : styles.toggleKnobOff]} />
        <Text style={[styles.toggleText, { color: value ? '#fff' : colors.textSecondary }]}>{value ? 'ON' : 'OFF'}</Text>
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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modal: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
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
    paddingBottom: 6,
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
    minHeight: 92,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  optionNumber: {
    fontSize: 13,
    fontWeight: '600',
    width: 20,
    marginRight: 8,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  removeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  addOptionBtn: {
    paddingVertical: 8,
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
    paddingBottom: 12,
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
  togglePill: {
    minWidth: 72,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  togglePillOn: {
    backgroundColor: '#0068FF',
  },
  togglePillOff: {
    backgroundColor: '#E5E7EB',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  toggleKnobOn: {
    backgroundColor: '#fff',
  },
  toggleKnobOff: {
    backgroundColor: '#fff',
  },
  toggleText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
  },
  deadlinePreview: {
    marginTop: 8,
    fontSize: 12,
  },
  deadlineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  deadlineField: {
    width: '31%',
  },
  deadlineFieldLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  deadlineFieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  submitBtn: {
    backgroundColor: '#0068FF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
