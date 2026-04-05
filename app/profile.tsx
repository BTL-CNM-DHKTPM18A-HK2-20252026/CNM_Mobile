import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { authService } from '@/services/authService';
import { resolveAvatarUri } from '@/services/mediaUtils';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  // Profile data state
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
    }, [])
  );

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const data = await authService.getProfile();

      if (data && (data.full_name || data.id)) {
        setProfile(data);
      } else {
        Alert.alert(t('profile.error_title'), t('profile.error_loading'));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert(t('profile.error_title'), t('profile.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Cover Photo */}
        <View style={styles.coverPhotoContainer}>
          <Image
            source={{ uri: profile?.cover_photo_url ? resolveAvatarUri(profile.cover_photo_url) : 'https://via.placeholder.com/400x200' }}
            style={styles.coverPhoto}
            defaultSource={require('@/assets/images/icon.png')}
          />
          <View style={styles.headerOverlay}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.iconButton} />
          </View>
        </View>

        {/* Avatar Section */}
        <View style={[styles.avatarSection, { backgroundColor: colors.background }]}>
          <View style={[styles.avatarBorder, { borderColor: colors.card }]}> 
            <Image
              source={{ uri: resolveAvatarUri(profile?.avatar_url) }}
              style={styles.avatar}
            />
          </View>
        </View>

        <View style={[styles.body, { backgroundColor: colors.background }]}> 
          {/* Name */}
          <Text style={[styles.name, { color: colors.text }]}>{profile?.full_name || t('profile.guest_user')}</Text>

          {/* Bio */}
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {profile?.bio || t('profile.bio_default')}
          </Text>

          {/* Edit Button */}
          <TouchableOpacity 
            style={[styles.editButton, { backgroundColor: COLORS.primary }]} 
            onPress={() => router.push('/edit-profile')}
          >
            <Ionicons name="pencil" size={16} color="#fff" />
            <Text style={styles.editButtonText}>{t('profile.edit_profile_button')}</Text>
          </TouchableOpacity>

          {/* Basic Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.basic_info')}</Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.phone')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile?.phone_number || '-'}</Text>
            </View>

            {/* <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.email')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile?.email || '-'}</Text>
            </View> */}

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.gender')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile?.gender || '-'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.dob')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {profile?.dob ? formatDate(profile.dob) : '-'}
              </Text>
            </View>
          </View>

          {/* Contact Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.contact_info')}</Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.address')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile?.address || '-'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.city')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile?.city || '-'}</Text>
            </View>
          </View>

          {/* Professional Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.professional_info')}</Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.education')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile?.education || '-'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.workplace')}</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{profile?.workplace || '-'}</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (err) {
    return '-';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPhotoContainer: {
    position: 'relative',
    height: 220,
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: -60,
    marginBottom: 20,
    zIndex: 10,
  },
  avatarBorder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    padding: 2,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    marginTop: 16,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
});
