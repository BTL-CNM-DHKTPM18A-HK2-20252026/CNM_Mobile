import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '@/services/authService';

export default function SettingsScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Đăng xuất', 
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              router.replace('/login'); // Still redirect even if API fails
            }
          }
        },
      ]
    );
  };

  const SettingItem = ({ icon, title, iconType = 'ionicons', color = '#555' }: any) => (
    <TouchableOpacity style={styles.settingItem}>
      <View style={styles.iconBox}>
        {iconType === 'ionicons' ? (
          <Ionicons name={icon} size={22} color={color} />
        ) : (
          <MaterialCommunityIcons name={icon} size={22} color={color} />
        )}
      </View>
      <Text style={styles.settingTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cài đặt</Text>
          <View style={styles.flexOne} />
          <Ionicons name="search" size={24} color="#fff" />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scrollView}>
        <View style={styles.sectionHeader} />
        
        <SettingItem icon="time-outline" title="Dữ liệu trên máy" color={COLORS.primary} />
        <SettingItem icon="sync-outline" title="Sao lưu và khôi phục" color={COLORS.primary} />
        
        <View style={styles.sectionDivider} />

        <SettingItem icon="notifications-outline" title="Thông báo" color={COLORS.primary} />
        <SettingItem icon="chatbubble-outline" title="Tin nhắn" color={COLORS.primary} />
        <SettingItem icon="call-outline" title="Cuộc gọi" color={COLORS.primary} />
        <SettingItem icon="book-outline" title="Nhật ký" color={COLORS.primary} />
        <SettingItem icon="person-outline" title="Danh bạ" color={COLORS.primary} />
        <SettingItem icon="color-palette-outline" title="Giao diện và ngôn ngữ" color={COLORS.primary} />

        <View style={styles.sectionDivider} />

        <SettingItem icon="information-circle-outline" title="Thông tin về Zalo" color={COLORS.primary} />
        <SettingItem icon="help-circle-outline" title="Liên hệ hỗ trợ" color={COLORS.primary} />

        <View style={styles.sectionDivider} />

        <SettingItem icon="people-outline" title="Chuyển tài khoản" color={COLORS.primary} />

        <View style={styles.logoutContainer}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={22} color="#000" />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: COLORS.primary,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 50,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  flexOne: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    height: 8,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#F2F2F7',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  iconBox: {
    width: 32,
    alignItems: 'center',
  },
  settingTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 12,
    color: '#000',
  },
  logoutContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBEBEB',
    paddingVertical: 12,
    borderRadius: 25,
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
});
