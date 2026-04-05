import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { authService } from '@/services/authService';
import { resolveAvatarUri } from '@/services/mediaUtils';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  
  // Profile data state
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Form state for editing
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('Nam');
  const [day, setDay] = useState('01');
  const [month, setMonth] = useState('01');
  const [year, setYear] = useState('2000');
  const [bio, setBio] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [education, setEducation] = useState('');
  const [workplace, setWorkplace] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const data = await authService.getProfile();
      
      if (data && (data.full_name || data.id)) {
        setProfile(data);
        
        // Parse dữ liệu từ response
        setFullName(data.full_name || '');
        setEmail(data.email || '');
        setPhone(data.phone_number || '');
        setGender(data.gender || 'Nam');
        setBio(data.bio || '');
        setAddress(data.address || '');
        setCity(data.city || '');
        setEducation(data.education || '');
        setWorkplace(data.workplace || '');

        // Parse DOB (ISO 8601 format: "2000-01-15")
        if (data.dob) {
          try {
            const date = new Date(data.dob);
            setDay(date.getDate().toString().padStart(2, '0'));
            setMonth((date.getMonth() + 1).toString().padStart(2, '0'));
            setYear(date.getFullYear().toString());
          } catch (err) {
            console.log('Error parsing date:', err);
          }
        }
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

  const handleSave = async () => {
    try {
      // Construct DOB string
      const dobString = `${year}-${month}-${day}`;
      
      const updatedProfile = {
        full_name: fullName,
        email,
        gender,
        dob: dobString,
        bio,
        address,
        city,
        education,
        workplace,
      };

      // TODO: Implement API call for update
      console.log('Saving profile:', updatedProfile);
      
      setProfile({ ...profile, ...updatedProfile });
      setIsEditing(false);
      Alert.alert(t('profile.success_title'), t('profile.profile_updated'));
    } catch (error) {
      Alert.alert(t('profile.error_title'), t('profile.error_saving'));
    }
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
            <TouchableOpacity style={styles.iconButton} onPress={() => setIsEditing(!isEditing)}>
              <Ionicons name={isEditing ? 'close' : 'pencil'} size={24} color="#fff" />
            </TouchableOpacity>
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
          {isEditing ? (
            <TextInput
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
              placeholder={t('profile.full_name_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />
          ) : (
            <Text style={[styles.name, { color: colors.text }]}>{fullName || t('profile.guest_user')}</Text>
          )}

          {/* Bio/Intro */}
          {isEditing ? (
            <TextInput
              style={[styles.bioInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder={t('profile.bio_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={bio}
              onChangeText={setBio}
              multiline
            />
          ) : (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {bio || t('profile.bio_default')}
            </Text>
          )}

          {/* Edit/Save Button */}
          {isEditing && (
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: COLORS.primary }]} 
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>{t('profile.save')}</Text>
            </TouchableOpacity>
          )}

          {/* Basic Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.basic_info')}</Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.phone')}</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.infoInput, { color: colors.text, borderColor: colors.border }]}
                  value={phone}
                  onChangeText={setPhone}
                  editable={false}
                />
              ) : (
                <Text style={[styles.infoValue, { color: colors.text }]}>{phone || '-'}</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.email')}</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.infoInput, { color: colors.text, borderColor: colors.border }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.infoValue, { color: colors.text }]}>{email || '-'}</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.gender')}</Text>
              {isEditing ? (
                <View style={styles.genderButtons}>
                  {['Nam', 'Nữ', 'Khác'].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.genderButton,
                        { backgroundColor: gender === g ? COLORS.primary : colors.card, borderColor: colors.border }
                      ]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={{ color: gender === g ? '#fff' : colors.text, fontSize: 12 }}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={[styles.infoValue, { color: colors.text }]}>{gender || '-'}</Text>
              )}
            </View>
          </View>

          {/* Date of Birth */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.dob')}</Text>
            {isEditing ? (
              <View style={styles.dobContainer}>
                <TextInput
                  style={[styles.dobInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="DD"
                  value={day}
                  onChangeText={setDay}
                  maxLength={2}
                />
                <Text style={[styles.dobSeparator, { color: colors.text }]}>/</Text>
                <TextInput
                  style={[styles.dobInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="MM"
                  value={month}
                  onChangeText={setMonth}
                  maxLength={2}
                />
                <Text style={[styles.dobSeparator, { color: colors.text }]}>/</Text>
                <TextInput
                  style={[styles.dobYearInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="YYYY"
                  value={year}
                  onChangeText={setYear}
                  maxLength={4}
                />
              </View>
            ) : (
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {`${day}/${month}/${year}`}
              </Text>
            )}
          </View>

          {/* Contact Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.contact_info')}</Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.address')}</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.infoInput, { color: colors.text, borderColor: colors.border }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder={t('profile.address_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.infoValue, { color: colors.text }]}>{address || '-'}</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.city')}</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.infoInput, { color: colors.text, borderColor: colors.border }]}
                  value={city}
                  onChangeText={setCity}
                  placeholder={t('profile.city_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.infoValue, { color: colors.text }]}>{city || '-'}</Text>
              )}
            </View>
          </View>

          {/* Professional Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.professional_info')}</Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.education')}</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.infoInput, { color: colors.text, borderColor: colors.border }]}
                  value={education}
                  onChangeText={setEducation}
                  placeholder={t('profile.education_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.infoValue, { color: colors.text }]}>{education || '-'}</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.workplace')}</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.infoInput, { color: colors.text, borderColor: colors.border }]}
                  value={workplace}
                  onChangeText={setWorkplace}
                  placeholder={t('profile.workplace_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.infoValue, { color: colors.text }]}>{workplace || '-'}</Text>
              )}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
  },
  nameInput: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  bioInput: {
    fontSize: 14,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  saveButton: {
    alignSelf: 'center',
    marginVertical: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
  infoInput: {
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  genderButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dobContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dobInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: 'center',
  },
  dobYearInput: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: 'center',
  },
  dobSeparator: {
    fontSize: 16,
    fontWeight: '600',
  },
});
