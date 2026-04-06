import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { authService } from '@/services/authService';
import { getAvatarSource } from '@/services/mediaUtils';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MoreScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        const data = await authService.getProfile();
        if (data) setProfile(data);
      };
      fetchProfile();
    }, [])
  );

  const MenuItem = ({ icon, title, subtitle, color, iconType = 'ionicons' }: any) => (
    <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
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
        <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={isDark ? colors.textSecondary : "#C7C7CC"} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" translucent />

      <View style={{ 
        backgroundColor: isDark ? colors.header : COLORS.primary,
        paddingTop: insets.top
      }}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#fff" />
            <Text style={styles.headerSearchText}>{t('chat.search')}</Text>
          </TouchableOpacity>
          <View style={styles.flexOne} />
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.headerIconRight}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={[styles.scrollView, { backgroundColor: colors.chatBackground }]} bounces={false}>
        {/* Profile Card */}
        <Pressable style={[styles.profileCard, { backgroundColor: colors.card }]} onPress={() => router.push('/profile')}>
          <View style={styles.avatarContainer}>
            <Image 
              source={getAvatarSource(profile?.avatar_url)} 
              style={styles.avatar} 
            />
            <View style={[styles.moodIcon, { borderColor: colors.tabBar, backgroundColor: isDark ? colors.surface : '#f0f0f0' }]}>
              <Ionicons name="happy-outline" size={16} color={colors.textSecondary} />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {profile ? profile.full_name : 'Guest User'}
            </Text>
            <Text style={[styles.profileStatus, { color: colors.textSecondary }]}>{t('more.view_profile')}</Text>
          </View>
          <Ionicons name="person-circle-outline" size={26} color={COLORS.primary} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Cloud & Style Section */}
        <MenuItem 
          icon="cloud-outline" 
          title={t('more.zcloud_title')} 
          subtitle={t('more.zcloud_desc')} 
          color="#0068ff" 
        />
        <MenuItem 
          icon="magic-staff" 
          iconType="mci"
          title={t('more.zstyle_title')} 
          subtitle={t('more.zstyle_desc')} 
          color="#aa44ff" 
        />

        <View style={[styles.sectionDivider, { backgroundColor: colors.chatBackground }]} />

        {/* Basic Tools Section */}
        <MenuItem 
          icon="folder-outline" 
          title={t('more.my_documents')} 
          subtitle={t('more.my_documents_desc')} 
          color="#0068ff" 
        />
        <MenuItem 
          icon="time-outline" 
          title={t('more.data_on_device')} 
          subtitle={t('more.data_on_device_desc')} 
          color="#0068ff" 
        />
        <MenuItem 
          icon="wallet-outline" 
          title={t('more.wallet_title')} 
          subtitle={t('more.wallet_desc')} 
          color="#0068ff" 
        />

        <View style={[styles.sectionDivider, { backgroundColor: colors.chatBackground }]} />

        {/* Security Section */}
        <MenuItem 
          icon="shield-checkmark-outline" 
          title={t('settings.account_security')} 
          color="#0068ff" 
        />
        <MenuItem 
          icon="lock-closed-outline" 
          title={t('settings.privacy')} 
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
  },
  header: {
    // Background removed here as it's in the outer View
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 54,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 36,
  },
  headerSearchText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginLeft: 18,
  },
  headerIconRight: {
    paddingLeft: 12,
  },
  flexOne: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '600',
  },
  profileStatus: {
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    height: 1,
  },
  sectionDivider: {
    height: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
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
    fontWeight: '400',
  },
  menuSubtitle: {
    fontSize: 9,
    marginTop: 2,
  },
});
