import { useTheme } from '@/context/ThemeContext';
import { chatService } from '@/services/chatService';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface GroupPermissionsModalProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  currentPermissions: {
    canEditInfo?: boolean;
    canPinMessages?: boolean;
    canSendMessages?: boolean;
    isMemberApprovalRequired?: boolean;
  };
}

type GroupPermissionKey =
  | 'canEditInfo'
  | 'canPinMessages'
  | 'canSendMessages'
  | 'isMemberApprovalRequired';

const PERMISSIONS = [
  { key: 'canEditInfo', label: 'Chỉnh sửa thông tin nhóm', description: 'Cho phép thành viên sửa tên, ảnh nhóm' },
  { key: 'canPinMessages', label: 'Ghim tin nhắn', description: 'Cho phép thành viên ghim/bỏ ghim tin nhắn' },
  { key: 'canSendMessages', label: 'Gửi tin nhắn', description: 'Cho phép thành viên gửi tin nhắn' },
  { key: 'isMemberApprovalRequired', label: 'Duyệt thành viên', description: 'Admin phải duyệt khi có thành viên mới' }
] as const;

export default function GroupPermissionsModal({
  visible,
  onClose,
  conversationId,
  currentPermissions,
}: GroupPermissionsModalProps) {
  const { colors } = useTheme();
  const [settings, setSettings] = useState({ ...currentPermissions });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings({ ...currentPermissions });
  }, [currentPermissions, visible]);

  const toggleSetting = (key: GroupPermissionKey) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await chatService.updatePermissions(conversationId, {
        canEditInfo: settings.canEditInfo,
        canPinMessages: settings.canPinMessages,
        canSendMessages: settings.canSendMessages,
        isMemberApprovalRequired: settings.isMemberApprovalRequired,
      });
      Alert.alert('Thành công', 'Đã cập nhật quyền hạn nhóm');
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể cập nhật quyền hạn');
    } finally {
      setSaving(false);
    }
  }, [settings, conversationId, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Quyền hạn nhóm</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.subText, fontSize: 15 }}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            {PERMISSIONS.map((perm) => {
              const value = settings[perm.key] ?? true;
              return (
                <TouchableOpacity
                  key={perm.key}
                  style={styles.permRow}
                  onPress={() => toggleSetting(perm.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.permInfo}>
                    <Text style={[styles.permLabel, { color: colors.text }]}>{perm.label}</Text>
                    <Text style={[styles.permDesc, { color: colors.subText }]}>{perm.description}</Text>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={() => toggleSetting(perm.key)}
                    trackColor={{ false: '#ddd', true: '#0068FF80' }}
                    thumbColor={value ? '#0068FF' : '#f4f3f4'}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Save button */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveText}>Lưu thay đổi</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
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
    maxHeight: '80%',
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
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  permInfo: {
    flex: 1,
    marginRight: 12,
  },
  permLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  permDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    borderTopWidth: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginTop: 8,
  },
  saveBtn: {
    backgroundColor: '#0068FF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
