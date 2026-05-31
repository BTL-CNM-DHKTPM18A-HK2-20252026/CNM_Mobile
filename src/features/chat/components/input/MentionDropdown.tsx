import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getAvatarSource } from '@/services/mediaUtils';
import { fetchConversationMembers } from '@/services/chatConversationMembers';
import { Ionicons } from '@expo/vector-icons';

interface MentionUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

interface MentionDropdownProps {
  visible: boolean;
  conversationId: string;
  searchText: string; // text after @ symbol
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
}

export default function MentionDropdown({ visible, conversationId, searchText, onSelect, onClose }: MentionDropdownProps) {
  const { colors } = useTheme();
  const [members, setMembers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const raw = await fetchConversationMembers(conversationId);
      const mapped: MentionUser[] = (Array.isArray(raw) ? raw : []).map((m: any) => ({
        userId: String(m.userId ?? m.id ?? ''),
        displayName: String(m.displayName ?? m.fullName ?? m.name ?? 'Unknown'),
        avatarUrl: m.avatarUrl ?? m.avatar,
      }));
      setMembers(mapped);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (visible) { loadMembers(); }
  }, [visible, loadMembers]);

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    if (!q) return members;
    return members.filter((m) =>
      m.displayName.toLowerCase().includes(q) ||
      m.userId.toLowerCase().includes(q)
    );
  }, [members, searchText]);

  if (!visible) return null;

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerText, { color: colors.textSecondary }]}>
            Gợi ý người dùng
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator style={{ padding: 16 }} color="#0068FF" />
        ) : (
          <FlatList
            data={filtered.slice(0, 10)}
            keyExtractor={(item) => item.userId}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                Không tìm thấy thành viên
              </Text>
            }
            renderItem={({ item }) => {
              const avatarSource = getAvatarSource(item.avatarUrl);
              return (
                <TouchableOpacity
                  style={[styles.userRow, { borderBottomColor: colors.border }]}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                >
                  {item.avatarUrl ? (
                    <Image source={avatarSource} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                      <Ionicons name="person" size={18} color={colors.textSecondary} />
                    </View>
                  )}
                  <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  dropdown: {
    maxHeight: 280,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 15,
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
});
