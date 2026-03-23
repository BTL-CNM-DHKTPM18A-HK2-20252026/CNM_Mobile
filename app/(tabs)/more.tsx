import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS, SIZES } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MoreScreen() {
  const router = useRouter();

  const MenuItem = ({ icon, title, subtitle, color, iconType = 'ionicons' }: any) => (
    <TouchableOpacity style={styles.menuItem}>
      <View style={styles.menuIconContainer}>
        {iconType === 'ionicons' ? (
          <Ionicons name={icon} size={16} color={color || COLORS.primary} />
        ) : iconType === 'mci' ? (
          <MaterialCommunityIcons name={icon} size={16} color={color || COLORS.primary} />
        ) : (
          <MaterialIcons name={icon} size={16} color={color || COLORS.primary} />
        )}
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header with Search and Settings */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="search" size={24} color="#fff" />
          <View style={styles.flexOne} />
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scrollView} bounces={false}>
        {/* Profile Card */}
        <Pressable style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: 'https://i.pravatar.cc/150?u=huy' }} 
              style={styles.avatar} 
            />
            <View style={styles.moodIcon}>
              <Ionicons name="happy-outline" size={16} color="#666" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Nguyễn Quang Huy</Text>
            <Text style={styles.profileStatus}>Xem trang cá nhân</Text>
          </View>
          <Ionicons name="person-circle-outline" size={26} color={COLORS.primary} />
        </Pressable>

        <View style={styles.divider} />

        {/* Cloud & Style Section */}
        <MenuItem 
          icon="cloud-outline" 
          title="zCloud" 
          subtitle="Không gian lưu trữ dữ liệu trên đám mây" 
          color="#0068ff" 
        />
        <MenuItem 
          icon="magic-staff" 
          iconType="mci"
          title="zStyle - Nổi bật trên Zalo" 
          subtitle="Hình nền và nhạc cho cuộc gọi Zalo" 
          color="#aa44ff" 
        />

        <View style={styles.sectionDivider} />

        {/* Basic Tools Section */}
        <MenuItem 
          icon="folder-outline" 
          title="My Documents" 
          subtitle="Lưu trữ các tin nhắn quan trọng" 
          color="#0068ff" 
        />
        <MenuItem 
          icon="time-outline" 
          title="Dữ liệu trên máy" 
          subtitle="Quản lý dữ liệu Zalo của bạn" 
          color="#0068ff" 
        />
        <MenuItem 
          icon="wallet-outline" 
          title="Ví QR" 
          subtitle="Lưu trữ và xuất trình các mã QR quan trọng" 
          color="#0068ff" 
        />

        <View style={styles.sectionDivider} />

        {/* Security Section */}
        <MenuItem 
          icon="shield-checkmark-outline" 
          title="Tài khoản và bảo mật" 
          color="#0068ff" 
        />
        <MenuItem 
          icon="lock-closed-outline" 
          title="Quyền riêng tư" 
          color="#0068ff" 
        />
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  flexOne: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  moodIcon: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  profileStatus: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F2F7',
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#F2F2F7',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  menuIconContainer: {
    width: 32,
    alignItems: 'center',
  },
  menuTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    fontSize: 12,
    color: '#000',
    fontWeight: '400',
  },
  menuSubtitle: {
    fontSize: 9,
    color: '#8e8e93',
    marginTop: 2,
  },
});
