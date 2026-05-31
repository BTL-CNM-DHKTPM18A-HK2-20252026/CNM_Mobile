import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, StatusBar, Switch } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '@/services/authService';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/services/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [accountLocked, setAccountLocked] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);

  useEffect(() => {
    api.get('/users/me/settings')
      .then((res: any) => {
        const data = res?.data?.data ?? res?.data ?? res;
        setAccountLocked(Boolean(data?.accountLocked));
      })
      .catch(() => {});
  }, []);

  const handleToggleLock = useCallback(async (newValue: boolean) => {
    setLockLoading(true);
    try {
      await api.patch('/users/me/settings/lock', { accountLocked: newValue });
      setAccountLocked(newValue);
      Alert.alert(
        t(newValue ? 'settings.lock_success_title' : 'settings.unlock_success_title', newValue ? 'Đã khóa' : 'Đã mở khóa'),
        t(newValue ? 'settings.lock_success_desc' : 'settings.unlock_success_desc',
          newValue ? 'Tài khoản đã được khóa thành công.' : 'Tài khoản đã được mở khóa.')
      );
    } catch {
      Alert.alert(t('settings.error', 'Lỗi'), t('settings.lock_failed', 'Thao tác thất bại'));
    } finally {
      setLockLoading(false);
    }
  }, [t]);

  const handleLogout = async () => {
    Alert.alert(
      t('settings.logout_confirm_title'),
      t('settings.logout_confirm_desc'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        { 
          text: t('settings.logout'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();
              router.replace('/');
            } catch (error) {
              console.error('Logout error:', error);
              router.replace('/'); // Still redirect even if API fails
            }
          }
        },
      ]
    );
  };

  const SettingItem = ({ icon, title, iconType = 'ionicons', color = '#555', onPress }: any) => (
    <TouchableOpacity style={[styles.settingItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress}>
      <View style={styles.iconBox}>
        {iconType === 'ionicons' ? (
          <Ionicons name={icon} size={22} color={color} />
        ) : (
          <MaterialCommunityIcons name={icon} size={22} color={color} />
        )}
      </View>
      <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={isDark ? colors.textSecondary : "#C7C7CC"} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "light-content"} />
      <View style={{ 
        backgroundColor: isDark ? colors.header : COLORS.primary,
        paddingTop: insets.top
      }}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('settings.header')}</Text>
          <View style={styles.flexOne} />
          <Ionicons name="search" size={24} color="#fff" />
        </View>
      </View>

      <ScrollView style={[styles.scrollView, { backgroundColor: colors.chatBackground }]}>
        <View style={styles.sectionHeader} />
        
        {/* Account & Privacy Section */}
        <SettingItem 
          icon="shield-checkmark-outline" 
          title={t('settings.account_security')} 
          color={COLORS.primary} 
        />
        <SettingItem 
          icon="lock-closed-outline" 
          title={t('settings.privacy')} 
          color={COLORS.primary} 
        />

        {/* Account Lock Toggle */}
        <View style={[styles.settingItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.iconBox}>
            <Ionicons name="shield-outline" size={22} color="#ef4444" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingTitle, { color: colors.text, flex: undefined }]}>
              {t('settings.lock_account', 'Khóa tài khoản')}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
              {t('settings.lock_account_desc', 'Chặn nhắn tin, kết bạn, xem trang cá nhân')}
            </Text>
          </View>
          <Switch
            value={accountLocked}
            onValueChange={handleToggleLock}
            disabled={lockLoading}
            trackColor={{ false: '#D1D5DB', true: '#ef4444' }}
            thumbColor="#fff"
          />
        </View>
        
        <View style={[styles.sectionDivider, { backgroundColor: colors.chatBackground }]} />

        {/* Data & Backup Section */}
        <SettingItem icon="time-outline" title={t('settings.data_storage')} color={COLORS.primary} />
        <SettingItem icon="sync-outline" title={t('settings.backup_restore')} color={COLORS.primary} />
        
        <View style={[styles.sectionDivider, { backgroundColor: colors.chatBackground }]} />

        {/* App Settings Section */}
        <SettingItem icon="notifications-outline" title={t('settings.notifications')} color={COLORS.primary} />
        <SettingItem icon="chatbubble-outline" title={t('settings.messages')} color={COLORS.primary} />
        <SettingItem icon="call-outline" title={t('settings.calls')} color={COLORS.primary} />
        <SettingItem icon="book-outline" title={t('settings.timeline')} color={COLORS.primary} />
        <SettingItem icon="person-outline" title={t('settings.contacts')} color={COLORS.primary} />
        <SettingItem 
          icon="color-palette-outline" 
          title={t('settings.appearance')} 
          color={COLORS.primary} 
          onPress={() => router.push('/appearance')}
        />

        <View style={[styles.sectionDivider, { backgroundColor: colors.chatBackground }]} />

        {/* Info & Support Section */}
        <SettingItem icon="information-circle-outline" title={t('settings.about')} color={COLORS.primary} />
        <SettingItem icon="help-circle-outline" title={t('settings.support')} color={COLORS.primary} />

        <View style={[styles.sectionDivider, { backgroundColor: colors.chatBackground }]} />

        {/* Account Switch Section */}
        <SettingItem icon="people-outline" title={t('settings.switch_account')} color={COLORS.primary} />

        <View style={styles.logoutContainer}>
          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: isDark ? colors.surface : '#EBEBEB' }]} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color={isDark ? colors.text : "#000"} />
            <Text style={[styles.logoutText, { color: isDark ? colors.text : "#000" }]}>{t('settings.logout')}</Text>
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
  },
  header: {
    // Background removed here as it's in the outer View
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
    fontSize: 13,
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
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  iconBox: {
    width: 32,
    alignItems: 'center',
  },
  settingTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 12,
  },
  logoutContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 25,
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
  },
});
