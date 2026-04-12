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
  
  const [activeTab, setActiveTab] = useState<'Bạn bè' | 'Nhóm'>('Bạn bè');
  
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
          <Ionicons name="people" size={20} color="#fff" />
        </View>
        <Text style={[styles.actionText, { color: colors.text }]}>
          Lời mời kết bạn ({totalRequests})
        </Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: isDark ? '#000' : '#f0f2f5' }]} />

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
        {(['Bạn bè', 'Nhóm'] as const).map((tab) => (
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
              fontWeight: activeTab === tab ? 'bold' : 'normal'
            }]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Bạn bè' ? renderFriendsContent() : (
        <View style={styles.emptyContainer}>
          <Text style={{ color: colors.textSecondary }}>Tính năng Nhóm đang phát triển</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 56 },
  searchBarBox: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  searchIcon: { marginRight: 10 },
  headerSearchText: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 15 },
  tabContainer: { flexDirection: 'row', height: 45, borderBottomWidth: 0.5 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabText: { fontSize: 14 },
  actionItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  iconCircle: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionText: { marginLeft: 15, fontSize: 16 },
  divider: { height: 8 },
  letterHeader: { paddingHorizontal: 15, paddingVertical: 4, fontWeight: 'bold', fontSize: 13 },
  contactItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  nameContainer: { flex: 1, marginLeft: 12 },
  contactName: { fontSize: 16, fontWeight: '500' },
  contactActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 8, marginLeft: 5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }
});