import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { COLORS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { friendService } from '@/services/friendService';
import { getAvatarSource } from '@/services/mediaUtils';
import GroupTab from '@/components/GroupTab';

// Định nghĩa Interface dựa trên UserResponse.java
interface UserResponse {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  account_status?: string;
}

// Interface chuẩn cho API trả về từ Fruvia Backend
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export default function ContactsScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'Bạn bè' | 'Nhóm' | 'OA'>('Bạn bè');
  const [friendFilter, setFriendFilter] = useState<'all' | 'recent'>('all');
  
  // States dữ liệu
  const [friends, setFriends] = useState<UserResponse[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchContactsData = async () => {
    try {
      // Gọi đồng thời 3 API để tối ưu tốc độ
      const [friendsRes, receivedRes, sentRes] = await Promise.all([
        friendService.getFriendsList() as unknown as ApiResponse<UserResponse[]>,
        friendService.getReceivedRequests() as unknown as ApiResponse<any[]>,
        friendService.getSentRequests() as unknown as ApiResponse<any[]>,
      ]);

      // 1. Xử lý danh sách bạn bè
      if (friendsRes.success) {
        const sorted = (friendsRes.data || []).sort((a, b) => 
          a.display_name.localeCompare(b.display_name)
        );
        setFriends(sorted);
      }

      // 2. Tính tổng số lời mời (Đã nhận + Đã gửi)
      const countReceived = receivedRes.success ? (receivedRes.data?.length || 0) : 0;
      const countSent = sentRes.success ? (sentRes.data?.length || 0) : 0;
      setTotalRequests(countReceived + countSent);

    } catch (error) {
      console.error("Lỗi tải danh bạ:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchContactsData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchContactsData();
  };

  const renderHeader = () => (
    <View style={{ backgroundColor: isDark ? colors.header : COLORS.primary, paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" translucent />
      <View style={styles.searchBarRow}>
        <TouchableOpacity style={styles.searchBarBox} onPress={() => router.push('/search')}>
          <Ionicons name="search" size={18} color="#fff" style={styles.searchIcon} />
          <Text style={styles.headerSearchText}>{t('chat.search') || 'Tìm kiếm'}</Text>
        </TouchableOpacity>
        <View style={styles.headerIcons}>
          <TouchableOpacity>
            <Ionicons name="person-add-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderFriendsContent = () => (
    <ScrollView 
      style={{ flex: 1 }} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      {/* Mục Lời mời kết bạn */}
      <TouchableOpacity 
        style={[styles.actionItem, { backgroundColor: colors.card }]} 
        onPress={() => router.push('/friend-requests')} 
      >
        <View style={[styles.iconCircle, { backgroundColor: '#0091ff' }]}>
          <Ionicons name="people" size={18} color="#fff" />
        </View>
        <Text style={[styles.actionText, { color: colors.text }]}>
          Lời mời kết bạn ({totalRequests})
        </Text>
      </TouchableOpacity>

      {/* Sinh nhật */}
      <TouchableOpacity style={[styles.actionItem, { backgroundColor: colors.card }]}>
        <View style={[styles.iconCircle, { backgroundColor: '#0091ff' }]}>
          <Ionicons name="gift" size={18} color="#fff" />
        </View>
        <Text style={[styles.actionText, { color: colors.text }]}>Sinh nhật</Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: isDark ? '#000' : '#f0f2f5' }]} />

      {/* Filter pills */}
      <View style={[styles.filterRow, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.filterPill, friendFilter === 'all' && styles.filterPillActive]}
          onPress={() => setFriendFilter('all')}
        >
          <Text style={[styles.filterPillText, friendFilter === 'all' && styles.filterPillTextActive]}>
            Tất cả  {friends.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, friendFilter === 'recent' && styles.filterPillActive]}
          onPress={() => setFriendFilter('recent')}
        >
          <Text style={[styles.filterPillText, friendFilter === 'recent' && styles.filterPillTextActive]}>
            Mới truy cập  0
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.divider, { backgroundColor: isDark ? '#000' : '#f0f2f5', height: 1 }]} />

      {/* Danh sách bạn bè */}
      {loading && !refreshing ? (
        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 30 }} />
      ) : (
        friends.map((item, index) => {
          const firstLetter = item.display_name.charAt(0).toUpperCase();
          const isNewLetter = index === 0 || friends[index - 1].display_name.charAt(0).toUpperCase() !== firstLetter;

          return (
            <View key={item.user_id} style={{ backgroundColor: colors.card }}>
              {isNewLetter && (
                <Text style={[styles.letterHeader, { 
                  color: colors.textSecondary, 
                  backgroundColor: isDark ? colors.background : '#f9f9f9' 
                }]}>
                  {firstLetter}
                </Text>
              )}
              <TouchableOpacity 
                style={styles.contactItem}
              >
                <Image source={getAvatarSource(item.avatar_url)} style={styles.avatar} />
                <View style={styles.nameContainer}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{item.display_name}</Text>
                </View>
                
                <View style={styles.contactActions}>
                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => console.log('Call to', item.display_name)}
                  >
                    <Ionicons name="call-outline" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => console.log('Video call to', item.display_name)}
                  >
                    <Ionicons name="videocam-outline" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          );
        })
      )}
      
      {!loading && friends.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={{ color: colors.textSecondary }}>Chưa có bạn bè trong danh sách</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      
      {/* Tab Switcher */}
      <View style={[styles.tabContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['Bạn bè', 'Nhóm', 'OA'] as const).map((tab) => (
          <TouchableOpacity 
            key={tab} 
            onPress={() => setActiveTab(tab)} 
            style={[styles.tabItem, activeTab === tab && { 
              borderBottomColor: isDark ? colors.text : COLORS.primary, 
              borderBottomWidth: 2 
            }]}
          >
            <Text style={[styles.tabText, { 
              color: activeTab === tab ? (isDark ? colors.text : COLORS.primary) : colors.textSecondary,
              fontWeight: activeTab === tab ? '600' : 'normal'
            }]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Bạn bè' ? renderFriendsContent() : activeTab === 'Nhóm' ? (
        <GroupTab />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Tính năng OA đang phát triển
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 50 },
  searchBarBox: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  searchIcon: { marginRight: 10 },
  headerSearchText: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 13 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 15 },
  tabContainer: { flexDirection: 'row', height: 40, borderBottomWidth: 0.5 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabText: { fontSize: 13 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionText: { marginLeft: 14, fontSize: 14, fontWeight: '400' },
  divider: { height: 8 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F2F5',
  },
  filterPillActive: {
    backgroundColor: '#E3EEFF',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#65676B',
  },
  filterPillTextActive: {
    color: COLORS.primary,
  },
  letterHeader: { paddingHorizontal: 15, paddingVertical: 3, fontWeight: '600', fontSize: 12 },
  contactItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  nameContainer: { flex: 1, marginLeft: 12 },
  contactName: { fontSize: 14, fontWeight: '500' },
  contactActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 8, marginLeft: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }
});