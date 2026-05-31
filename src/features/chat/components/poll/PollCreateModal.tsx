import { useTheme } from '@/context/ThemeContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

type PollOptionItem = {
  id: string;
  value: string;
};

export interface PollCreateData {
  question: string;
  options: string[];
  deadline?: string;
  isPinned?: boolean;
  multipleChoices?: boolean;
  allowAddOptions?: boolean;
  hideResultsBeforeVote?: boolean;
  hideVoters?: boolean;
  allowMultiChoice?: boolean;
  allowUserOptions?: boolean;
  isAnonymous?: boolean;
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
  const [showSettings, setShowSettings] = useState(false);
  const [allowMultiChoice, setAllowMultiChoice] = useState(true);
  const [allowUserOptions, setAllowUserOptions] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const nextOptionIdRef = useRef(3);

  const createEmptyOption = useCallback((): PollOptionItem => {
    const id = String(nextOptionIdRef.current);
    nextOptionIdRef.current += 1;
    return { id, value: '' };
  }, []);

  const resetForm = useCallback(() => {
    nextOptionIdRef.current = 3;
    setQuestion('');
    setOptions([...INITIAL_OPTIONS]);
    setShowSettings(false);
    setAllowMultiChoice(true);
    setAllowUserOptions(true);
    setIsAnonymous(false);
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
      multipleChoices: allowMultiChoice,
      allowMultiChoice: allowMultiChoice,
      allowAddOptions: allowUserOptions,
      allowUserOptions: allowUserOptions,
      isAnonymous: isAnonymous,
      hideVoters: isAnonymous,
      hideResultsBeforeVote: false,
      isPinned: false,
    });
    resetForm();
  }, [allowMultiChoice, allowUserOptions, canSubmit, filledOptions, isAnonymous, onSubmit, question, resetForm]);

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
              <Text style={[styles.cancelBtn, { color: colors.subText }]}>Huỷ</Text>
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
              placeholderTextColor={colors.subText}
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
                <Text style={[styles.optionNumber, { color: colors.subText }]}>{idx + 1}</Text>
                <TextInput
                  style={[
                    styles.optionInput,
                    { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1c1c' : '#fff' },
                  ]}
                  placeholder={`Phương án ${idx + 1}`}
                  placeholderTextColor={colors.subText}
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

            {/* Settings */}
            {showSettings && (
              <View style={[styles.settingsSection, { borderTopColor: colors.border }]}>
                <SettingRow label="Chọn nhiều phương án" value={allowMultiChoice} onValueChange={setAllowMultiChoice} colors={colors} />
                <SettingRow label="Cho phép thêm phương án" value={allowUserOptions} onValueChange={setAllowUserOptions} colors={colors} />
                <SettingRow label="Ẩn danh" value={isAnonymous} onValueChange={setIsAnonymous} colors={colors} />
              </View>
            )}

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
