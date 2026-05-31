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
  const [isPinned, setIsPinned] = useState(false);
  const [multipleChoices, setMultipleChoices] = useState(true);
  const [allowAddOptions, setAllowAddOptions] = useState(true);
  const [hideResultsBeforeVote, setHideResultsBeforeVote] = useState(false);
  const [hideVoters, setHideVoters] = useState(false);

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
              onChangeText={setQuestion}
            />

            {/* Options */}
            <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>Phương án</Text>
            {options.map((opt, idx) => (
              <View key={idx} style={styles.optionRow}>
                <Text style={[styles.optionNumber, { color: colors.subText }]}>{idx + 1}</Text>
                <TextInput
                  style={[
                    styles.optionInput,
                    { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? '#1c1c1c' : '#fff' },
                  ]}
                  placeholder={`Phương án ${idx + 1}`}
                  placeholderTextColor={colors.subText}
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
                <SettingRow label="Ghim bình chọn" value={isPinned} onValueChange={setIsPinned} colors={colors} />
                <SettingRow label="Cho phép chọn nhiều" value={multipleChoices} onValueChange={setMultipleChoices} colors={colors} />
                <SettingRow label="Cho thêm phương án" value={allowAddOptions} onValueChange={setAllowAddOptions} colors={colors} />
                <SettingRow label="Ẩn kết quả trước khi vote" value={hideResultsBeforeVote} onValueChange={setHideResultsBeforeVote} colors={colors} />
                <SettingRow label="Ẩn danh người vote" value={hideVoters} onValueChange={setHideVoters} colors={colors} />
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
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
