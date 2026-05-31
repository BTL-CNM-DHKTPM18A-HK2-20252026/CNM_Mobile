import { getAvatarSource } from '@/services/mediaUtils';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type MemberRole = 'ADMIN' | 'DEPUTY' | 'MEMBER';

type MemberItem = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: MemberRole;
  addedByName?: string;
  isCurrentUser?: boolean;
  isFriend?: boolean;
};

const DEFAULT_MEMBERS: MemberItem[] = [
  {
    userId: 'admin-1',
    displayName: 'Nhiên Trần',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop',
    role: 'ADMIN',
    addedByName: '',
  },
  {
    userId: 'member-1',
    displayName: 'Bà Nghi',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop',
    role: 'MEMBER',
    addedByName: 'Nhiên Trần',
    isFriend: false,
  },
  {
    userId: 'member-2',
    displayName: 'Bạn',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop',
    role: 'MEMBER',
    addedByName: 'Nhiên Trần',
    isCurrentUser: true,
    isFriend: true,
  },
];

const roleLabelMap: Record<MemberRole, string> = {
  ADMIN: 'Trưởng nhóm',
  DEPUTY: 'Phó nhóm',
  MEMBER: 'Thành viên',
};

export default function MemberDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ members?: string; currentUserId?: string }>();

  const members = useMemo(() => {
    const rawMembers = (() => {
      if (!params.members) return null;
      try {
        const decoded = decodeURIComponent(params.members);
        const parsed = JSON.parse(decoded);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    })();

    const source = rawMembers ?? DEFAULT_MEMBERS;
    const currentUserId = String(params.currentUserId ?? '').trim();

    return [...source]
      .map((member: any, index: number) => {
        const userId = String(member?.userId ?? member?.user_id ?? member?.id ?? `member-${index}`);
        const displayName = String(member?.displayName ?? member?.display_name ?? member?.userName ?? member?.fullName ?? member?.name ?? 'Thành viên');
        const avatarUrl = String(member?.avatarUrl ?? member?.avatar_url ?? member?.avatar ?? '').trim();
        const role = String(member?.role ?? member?.memberRole ?? 'MEMBER').toUpperCase() as MemberRole;
        const addedByName = String(member?.addedByName ?? member?.added_by_name ?? member?.addedBy ?? member?.added_by ?? 'Nhiên Trần');
        const isFriend = Boolean(
          member?.isFriend ||
          member?.friendshipStatus === 'FRIEND' ||
          member?.friendship_status === 'FRIEND' ||
          String(member?.friendshipStatus ?? member?.friendship_status ?? '').toUpperCase() === 'FRIEND'
        );

        return {
          userId,
          displayName,
          avatarUrl,
          role,
          addedByName,
          isCurrentUser: Boolean(currentUserId && userId === currentUserId),
          isFriend,
        } satisfies MemberItem;
      })
      .sort((left, right) => {
        if (left.role === 'ADMIN') return -1;
        if (right.role === 'ADMIN') return 1;
        return 0;
      });
  }, [params.currentUserId, params.members]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#F7DCE4' }]} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#E06B89" />

      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIconButton} accessibilityLabel="Quay lại">
            <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Thành viên
          </Text>

          <View style={styles.headerActionGroup}>
            <TouchableOpacity
              onPress={() => Alert.alert('Thêm thành viên', 'Chức năng đang phát triển')}
              style={styles.headerIconButton}
              accessibilityLabel="Thêm thành viên"
            >
              <Ionicons name="person-add-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert('Tìm thành viên', 'Chức năng đang phát triển')}
              style={styles.headerIconButton}
              accessibilityLabel="Tìm thành viên"
            >
              <Ionicons name="search" size={23} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thành viên ({members.length})</Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Tùy chọn', 'Chức năng đang phát triển')}
              style={styles.sectionMenuButton}
              accessibilityLabel="Tùy chọn danh sách"
            >
              <Ionicons name="ellipsis-vertical" size={18} color="#D07A90" />
            </TouchableOpacity>
          </View>

          <View style={styles.listCard}>
            {members.map((member, index) => {
              const showFriendButton = !member.isCurrentUser && !member.isFriend && member.role !== 'ADMIN';

              return (
                <View key={member.userId} style={[styles.memberRow, index !== members.length - 1 && styles.memberRowBorder]}>
                  <View style={styles.avatarWrap}>
                    <Image source={getAvatarSource(member.avatarUrl)} style={styles.avatarImage} contentFit="cover" transition={120} />
                  </View>

                  <View style={styles.memberBody}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.displayName}
                    </Text>
                    <Text style={[styles.memberSubtitle, member.role === 'ADMIN' && styles.memberOwnerSubtitle]} numberOfLines={1}>
                      {member.role === 'ADMIN' ? roleLabelMap.ADMIN : `Thêm bởi ${member.addedByName ?? 'Nhiên Trần'}`}
                    </Text>
                  </View>

                  <View style={styles.memberActions}>
                    {showFriendButton ? (
                      <TouchableOpacity
                        onPress={() => Alert.alert('Kết bạn', `Gửi lời mời kết bạn tới ${member.displayName}`)}
                        style={styles.friendActionButton}
                        accessibilityLabel={`Kết bạn với ${member.displayName}`}
                      >
                        <Ionicons name="person-add-outline" size={28} color="#D27C93" />
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      onPress={() => Alert.alert(member.displayName, 'Chức năng đang phát triển')}
                      style={styles.memberActionButton}
                      accessibilityLabel={`Tùy chọn ${member.displayName}`}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color="#D27C93" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#F7DCE4',
  },
  header: {
    minHeight: 104,
    paddingHorizontal: 18,
    paddingBottom: 18,
    backgroundColor: '#E56C8A',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 10,
    color: '#FFFFFF',
    fontSize: 18,            // Tăng từ 15 lên 18 để tiêu đề header rõ ràng, đúng chuẩn Mobile UI
    fontWeight: '700',
    lineHeight: 24,          // Đảm bảo khoảng cách dòng cân đối với cỡ chữ 18
    letterSpacing: 0.1,
  },
  headerActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  content: {
    flex: 1,
    paddingTop: 14,
  },
  sectionHeader: {
    marginHorizontal: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#D06E88',
    fontSize: 13,            // Giảm nhẹ từ 14 xuống 13 để phân biệt rõ với nội dung chính bên dưới
    fontWeight: '600',       // Đổi từ 700 sang 600 để làm phụ đề nhóm (Sub-header) thanh thoát hơn
    lineHeight: 18,          
    textTransform: 'uppercase', // (Tùy chọn) Thường các section title viết hoa nhìn sẽ chuyên nghiệp hơn
  },
  sectionMenuButton: {
    width: 30,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    flex: 1,
    backgroundColor: '#FFF7FB',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(211, 140, 157, 0.16)',
    overflow: 'hidden',
  },
  memberRow: {
    minHeight: 72,           // Giảm từ 80 xuống 72 để danh sách gọn gàng, chứa được nhiều item hơn trên màn hình
    paddingVertical: 12,     // Tinh chỉnh lại padding dọc cho cân đối
    paddingHorizontal: 18,   // Bổ sung đệm lề ngang để nội dung không bị dính sát mép listCard
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(211, 140, 157, 0.16)',
  },
  avatarWrap: {
    marginRight: 14,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,        // SỬA LỖI: Đường kính 44 thì borderRadius phải là 22 để tạo thành hình tròn hoàn hảo (cũ là 33)
    backgroundColor: '#E8B9C6',
  },
  memberBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center', // Giúp tên và dòng phụ đề luôn căn đều giữa theo chiều dọc của hàng
  },
  memberName: {
    color: '#2D2530',
    fontSize: 15,            // Tăng từ 13 lên 15 để tên thành viên nổi bật, dễ đọc lướt
    fontWeight: '600',       // Dùng Semi-bold (600) thay vì Bold (700) giúp font chữ trông sạch và hiện đại hơn
    lineHeight: 20,          // SỬA LỖI: Hạ từ 28 xuống 20 để tránh khoảng trống dọc quá lớn giữa tên và phụ đề
  },
  memberSubtitle: {
    marginTop: 4,            // Giảm nhẹ từ 6 xuống 4 để kéo sát thông tin phụ lại gần tên
    color: '#6E6670',
    fontSize: 13,            // Tăng từ 11 lên 13 để mắt người dùng không phải điều tiết quá nhiều khi đọc trên màn hình điện thoại
    fontWeight: '400',       // Dùng Regular (400) để tạo sự tương phản rõ rệt với dòng tên (600)
    lineHeight: 18,          // SỬA LỖI: Hạ từ 20 xuống 18 cho vừa vặn với cỡ chữ 13
  },
  memberOwnerSubtitle: {
    color: '#D06E88',
    fontWeight: '500',       // Tăng nhẹ độ đậm cho nhãn "Trưởng phòng/Chủ sở hữu" để tạo điểm nhấn
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  friendActionButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberActionButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});