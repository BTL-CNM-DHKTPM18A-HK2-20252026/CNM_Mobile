import { getAvatarSource } from '@/services/mediaUtils';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Alert, Image, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type GroupMemberRole = 'ADMIN' | 'DEPUTY' | 'MEMBER';

export interface GroupMemberItem {
  userId?: string | number | null;
  displayName?: string | null;
  userName?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  role?: GroupMemberRole | string | null;
  addedByName?: string | null;
  addedBy?: string | null;
}

export interface MemberListModalProps {
  visible: boolean;
  members: GroupMemberItem[];
  currentUserId?: string | null;
  conversationName?: string | null;
  onClose: () => void;
  onAddMemberPress?: () => void;
  onSearchPress?: () => void;
  onMemberMenuPress?: (member: GroupMemberItem) => void;
}

const COLORS = {
  pinkMist: '#F7DAE7',
  bubblegum: '#E2B4C1',
  cherrySoda: '#D38C9D',
  rubyPetals: '#A55166',
  softCard: '#FFF7FA',
  softText: '#6E5A63',
  deepText: '#2F2430',
  divider: 'rgba(163, 91, 110, 0.14)',
};

const normalizeText = (value: string | null | undefined, fallback: string): string => {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : fallback;
};

const getMemberName = (member: GroupMemberItem, fallback: string): string => {
  return normalizeText(member.displayName ?? member.userName ?? member.fullName, fallback);
};

const getMemberId = (member: GroupMemberItem, fallback: string): string => {
  return normalizeText(member.userId == null ? '' : String(member.userId), fallback);
};

const getRoleLabel = (role?: GroupMemberRole | string | null): string => {
  const normalized = String(role ?? '').toUpperCase();
  if (normalized === 'ADMIN') return 'Trưởng nhóm';
  if (normalized === 'DEPUTY') return 'Phó nhóm';
  return 'Thành viên';
};

export const MemberListModal: React.FC<MemberListModalProps> = ({
  visible,
  members,
  currentUserId,
  conversationName,
  onClose,
  onAddMemberPress,
  onSearchPress,
  onMemberMenuPress,
}) => {
  const orderedMembers = useMemo(() => {
    const cloned = [...members];
    return cloned.sort((left, right) => {
      const leftRole = String(left.role ?? '').toUpperCase();
      const rightRole = String(right.role ?? '').toUpperCase();
      if (leftRole === 'ADMIN') return -1;
      if (rightRole === 'ADMIN') return 1;
      return 0;
    });
  }, [members]);

  const ownerName = useMemo(() => {
    const owner = orderedMembers.find((member) => String(member.role ?? '').toUpperCase() === 'ADMIN');
    return owner ? getMemberName(owner, 'Trưởng nhóm') : normalizeText(conversationName, 'Thành viên');
  }, [conversationName, orderedMembers]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <StatusBar barStyle="light-content" backgroundColor={COLORS.cherrySoda} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerIconButton} accessibilityLabel="Quay lại">
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.headerTitle} numberOfLines={1}>
              Thành viên
            </Text>

            <View style={styles.headerActionGroup}>
              <TouchableOpacity
                onPress={onAddMemberPress ?? (() => Alert.alert('Thêm thành viên', 'Chức năng đang phát triển'))}
                style={styles.headerIconButton}
                accessibilityLabel="Thêm thành viên"
              >
                <Ionicons name="person-add-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSearchPress ?? (() => Alert.alert('Tìm thành viên', 'Chức năng đang phát triển'))}
                style={styles.headerIconButton}
                accessibilityLabel="Tìm thành viên"
              >
                <Ionicons name="search" size={21} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Thành viên ({orderedMembers.length})</Text>
              <TouchableOpacity
                onPress={onSearchPress ?? (() => Alert.alert('Tùy chọn', 'Chức năng đang phát triển'))}
                style={styles.sectionMenuButton}
                accessibilityLabel="Tùy chọn danh sách"
              >
                <Ionicons name="ellipsis-vertical" size={16} color={COLORS.rubyPetals} />
              </TouchableOpacity>
            </View>

            <View style={styles.listCard}>
              {orderedMembers.map((member, index) => {
                const memberId = getMemberId(member, String(index));
                const memberName = getMemberName(member, 'Thành viên');
                const isCurrentUser = Boolean(currentUserId && String(member.userId ?? '') === String(currentUserId));
                const roleLabel = getRoleLabel(member.role);
                const isOwner = String(member.role ?? '').toUpperCase() === 'ADMIN';
                const subtitle = isOwner
                  ? roleLabel
                  : `Thêm bởi ${normalizeText(member.addedByName ?? member.addedBy, ownerName)}`;
                const avatarUrl = String(member.avatarUrl ?? member.avatar ?? '').trim();
                const showAddIcon = !isOwner;

                return (
                  <View key={`${memberId}-${index}`} style={[styles.memberRow, index !== orderedMembers.length - 1 && styles.memberRowBorder]}>
                    <View style={styles.avatarWrap}>
                      {avatarUrl ? (
                        <Image source={getAvatarSource(avatarUrl)} style={styles.avatarImage} />
                      ) : (
                        <View style={[styles.avatarFallback, isOwner && styles.avatarFallbackOwner]}>
                          <Text style={styles.avatarFallbackText}>{memberName.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.memberBody}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {memberName}{isCurrentUser ? ' (Bạn)' : ''}
                      </Text>
                      <Text style={[styles.memberSubtitle, isOwner && styles.memberOwnerSubtitle]} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    </View>

                    <View style={styles.memberActions}>
                      {showAddIcon && (
                        <TouchableOpacity
                          onPress={onAddMemberPress ?? (() => Alert.alert('Thêm thành viên', 'Chức năng đang phát triển'))}
                          style={styles.memberActionButton}
                          accessibilityLabel={`Thêm ${memberName}`}
                        >
                          <Ionicons name="person-add-outline" size={22} color={COLORS.cherrySoda} />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => {
                          if (onMemberMenuPress) {
                            onMemberMenuPress(member);
                            return;
                          }

                          Alert.alert(memberName, 'Chức năng đang phát triển');
                        }}
                        style={styles.memberActionButton}
                        accessibilityLabel={`Tùy chọn ${memberName}`}
                      >
                        <Ionicons name="ellipsis-vertical" size={16} color={COLORS.cherrySoda} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.pinkMist,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.pinkMist,
  },
  header: {
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.cherrySoda,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  content: {
    flex: 1,
    paddingTop: 12,
  },
  sectionHeader: {
    marginHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.rubyPetals,
  },
  sectionMenuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    flex: 1,
    paddingTop: 2,
    backgroundColor: COLORS.softCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  memberRow: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  avatarWrap: {
    marginRight: 8,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.bubblegum,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bubblegum,
  },
  avatarFallbackOwner: {
    backgroundColor: COLORS.rubyPetals,
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  memberBody: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.deepText,
    marginBottom: 2,
  },
  memberSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.softText,
  },
  memberOwnerSubtitle: {
    color: COLORS.cherrySoda,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  memberActionButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginLeft: 4,
  },
});

export default MemberListModal;