import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatItem {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  isGroup: boolean;
  isPinned: boolean;
  unreadCount?: number;
  avatar?: string;
  groupAvatars?: string[];
}

const MOCK_CHATS: ChatItem[] = [
  {
    id: '1',
    name: 'KTTKPM_DHKTPM18C_HK2_202...',
    lastMessage: 'Nguyễn Thị Thái Hòa: Dạ thưa cô em tên là...',
    time: 'T7',
    isGroup: true,
    isPinned: true,
    groupAvatars: ['https://randomuser.me/api/portraits/women/1.jpg', 'https://randomuser.me/api/portraits/men/1.jpg', 'https://randomuser.me/api/portraits/men/2.jpg']
  },
  {
    id: '2',
    name: 'TTDN_HK2_2025_2026_T.HUNG',
    lastMessage: 'Thanh Trúc: [File] TTDN_NguyenThanhTruc...',
    time: 'T7',
    isGroup: true,
    isPinned: true,
    groupAvatars: ['https://randomuser.me/api/portraits/men/3.jpg', 'https://randomuser.me/api/portraits/women/2.jpg']
  },
  {
    id: '3',
    name: 'SE_TTDN_HK2_2025_2026',
    lastMessage: 'Nguyen Thi Hanh: Bạn nào có đề cương...',
    time: 'T7',
    isGroup: true,
    isPinned: true,
    avatar: 'https://via.placeholder.com/150/0068ff/ffffff?text=SE'
  },
  {
    id: '4',
    name: 'CNMOI_HK2_25-26_DHKTPM1...',
    lastMessage: 'Nguyễn Ngọc Hồng Min...: [Link] https...',
    time: '16/03',
    isGroup: true,
    isPinned: true,
    groupAvatars: ['https://randomuser.me/api/portraits/men/4.jpg', 'https://randomuser.me/api/portraits/women/3.jpg']
  },
  {
    id: '5',
    name: 'My Documents',
    lastMessage: 'Bạn: [Hình ảnh]',
    time: '10 phút',
    isGroup: false,
    isPinned: true,
    avatar: 'https://cdn-icons-png.flaticon.com/512/3767/3767084.png' // Cloud/Document icon
  },
  {
    id: '6',
    name: 'Thời Tiết',
    lastMessage: 'Chào ngày mới, thời tiết TP. Hồ Chí Minh...',
    time: '52 phút',
    isGroup: false,
    isPinned: false,
    unreadCount: 1,
    avatar: 'https://cdn-icons-png.flaticon.com/512/1163/1163624.png' // Weather icon
  },
  {
    id: '7',
    name: 'Media Box',
    lastMessage: 'Báo Mới: [APP] Xuất hiện mưa đá dữ dội ở...',
    time: 'Bây giờ',
    isGroup: false,
    isPinned: false,
    unreadCount: 1,
    avatar: 'https://cdn-icons-png.flaticon.com/512/3671/3671927.png' // News/Box icon
  },
  {
    id: '8',
    name: 'Mẹ',
    lastMessage: '[Cuộc gọi video đi]',
    time: '12 giờ',
    isGroup: false,
    isPinned: false,
    avatar: 'https://randomuser.me/api/portraits/women/4.jpg'
  },
  {
    id: '9',
    name: 'Trâm',
    lastMessage: '[Cuộc gọi video đến]',
    time: '13 giờ',
    isGroup: false,
    isPinned: false,
    avatar: 'https://randomuser.me/api/portraits/women/5.jpg'
  }
];

const GroupAvatar = ({ avatars, themeColors }: { avatars: string[], themeColors: any }) => (
  <View style={[styles.groupAvatarContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
    {avatars.slice(0, 4).map((uri, index) => (
      <Image
        key={index}
        source={{ uri }}
        style={[
          styles.smallAvatar,
          { borderColor: themeColors.card },
          index === 0 && styles.avatarPos0,
          index === 1 && styles.avatarPos1,
          index === 2 && styles.avatarPos2,
          index === 3 && styles.avatarPos3,
        ]}
      />
    ))}
    {avatars.length > 4 && (
      <View style={[styles.smallAvatar, styles.avatarPos3, styles.moreGroup, { backgroundColor: themeColors.border }]}>
        <Text style={[styles.moreText, { color: themeColors.textSecondary }]}>{avatars.length}</Text>
      </View>
    )}
  </View>
);

export default function ChatScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const insets = useSafeAreaInsets();

  const renderItem = ({ item }: { item: ChatItem }) => (
    <TouchableOpacity style={[styles.chatItem, { backgroundColor: colors.card }]}>
      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        {item.isGroup && item.groupAvatars ? (
          <GroupAvatar avatars={item.groupAvatars} themeColors={colors} />
        ) : (
          <View>
            <Image source={{ uri: item.avatar || 'https://randomuser.me/api/portraits/men/1.jpg' }} style={[styles.avatar, { borderColor: colors.border }]} />
            {item.name === 'Thời Tiết' || item.name === 'My Documents' ? (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.card }]}>
                <Ionicons name="checkmark-circle" size={12} color="#0068ff" />
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <View style={styles.nameHeader}>
          <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <View style={styles.timeSection}>
            {item.isPinned && <Ionicons name="pin" size={12} color={colors.textSecondary} style={{ marginRight: 5 }} />}
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>{item.time}</Text>
          </View>
        </View>

        <View style={styles.messageFooter}>
          <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={1}>{item.lastMessage}</Text>
          {item.unreadCount ? (
            <View style={styles.unreadBadge}>
              <View style={styles.redDot} />
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" translucent />
      <View style={{
        backgroundColor: isDark ? colors.header : COLORS.primary,
        paddingTop: insets.top
      }}>
        <View style={styles.searchBarRow}>
          <TouchableOpacity style={styles.searchBarBox}>
            <Ionicons name="search" size={18} color="#fff" style={styles.searchIcon} />
            <Text style={styles.headerSearchText}>{t('chat.search')}</Text>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={() => router.push('/qr-scan')}>
              <MaterialCommunityIcons name="qrcode-scan" size={22} color="#fff" style={styles.icon} />
            </TouchableOpacity>
            <Ionicons name="add" size={28} color="#fff" />
          </View>
        </View>
      </View>

      {/* Chat List */}
      <FlatList
        data={MOCK_CHATS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingBottom: 4,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 56,
  },
  searchBarBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  headerSearchText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 15,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    alignItems: 'center',
  },
  avatarSection: {
    marginRight: 15,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 0.1,
  },
  groupAvatarContainer: {
    width: 54,
    height: 54,
    flexWrap: 'wrap',
    flexDirection: 'row',
    borderRadius: 27,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
  },
  smallAvatar: {
    width: '50%',
    height: '50%',
    borderWidth: 0.5,
  },
  avatarPos0: {},
  avatarPos1: {},
  avatarPos2: {},
  avatarPos3: {},

  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  nameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  chatName: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 9,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 10,
    flex: 1,
    marginRight: 10,
  },
  unreadBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff3b30',
  },
  separator: {
    height: 1,
    marginLeft: 84, // Align with text
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 6,
  },
  moreGroup: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 9,
  }
});
