import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { authService } from '@/services/authService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDay, setTempDay] = useState('01');
  const [tempMonth, setTempMonth] = useState('01');
  const [dobText, setDobText] = useState('');

  // Form state
  // const [firstName, setFirstName] = useState('');
  // const [lastName, setLastName] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('Nam');
  const [dob, setDob] = useState(new Date(2000, 0, 1));
  const [bio, setBio] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [education, setEducation] = useState('');
  const [workplace, setWorkplace] = useState('');

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const data = await authService.getProfile();

      if (data && (data.full_name || data.id)) {
        // Parse dữ liệu từ response
        // setFirstName(data.firstName || '');
        // setLastName(data.lastName || '');
        setFullName(data.displayName || data.full_name || '');
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
            setDob(date);
            setDobText(`${getDayFromDate(date)}/${getMonthFromDate(date)}/${getYearFromDate(date)}`);
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

  const formatDateForAPI = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDayFromDate = (date: Date) => date.getDate().toString().padStart(2, '0');
  const getMonthFromDate = (date: Date) => (date.getMonth() + 1).toString().padStart(2, '0');
  const getYearFromDate = (date: Date) => date.getFullYear().toString();

  const handleDobTextChange = (text: string) => {
    // Remove all non-numeric characters
    const numericText = text.replace(/\D/g, '');
    
    let formattedText = '';
    
    if (numericText.length > 0) {
      // Add day (first 2 digits)
      formattedText = numericText.slice(0, 2);
      
      if (numericText.length >= 3) {
        // Add slash after day if user entered 3+ digits
        formattedText += '/' + numericText.slice(2, 4);
        
        if (numericText.length >= 5) {
          // Add slash after month if user entered 5+ digits
          formattedText += '/' + numericText.slice(4, 8);
        }
      }
    }
    
    setDobText(formattedText);
    
    // Parse dd/mm/yyyy only if complete
    const parts = formattedText.split('/');
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && day > 0 && day <= 31 && month > 0 && month <= 12) {
        const newDate = new Date(year, month - 1, day);
        if (newDate.getFullYear() === year && newDate.getMonth() === month - 1 && newDate.getDate() === day) {
          setDob(newDate);
        }
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const dobString = formatDateForAPI(dob);
      const lastUpdateProfile = new Date().toISOString();

      const updatedProfile = {
        displayName: fullName,
        full_name: fullName,
        gender,
        dob: dobString,
        bio,
        address,
        city,
        education,
        workplace,
        lastUpdateProfile,
      };

      // Call API to update profile
      await authService.updateProfile(updatedProfile);
      console.log('Profile to save:', updatedProfile);

      Alert.alert(t('profile.success_title'), t('profile.profile_updated'), [
        {
          text: t('profile.ok'),
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert(t('profile.error_title'), t('profile.error_saving'));
    } finally {
      setSaving(false);
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

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.edit_profile_title')}</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={[styles.body, { backgroundColor: colors.background }]}>
          {/* Name Section */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Nhập họ và tên</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder={t('profile.display_name_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />
            </View>
          {/* Bio Section */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('profile.bio')}</Text>
            <TextInput
              style={[styles.bioInput, { color: colors.text, borderColor: colors.border }]}
              placeholder={t('profile.bio_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={bio}
              onChangeText={setBio}
              multiline
            />
          </View>

          {/* Basic Info Section */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.gender')}</Text>

            <View style={styles.formGroup}>
              <View style={styles.radioGroup}>
                {['Nam', 'Nữ', 'Khác'].map((g) => (
                  <TouchableOpacity key={g} style={styles.radioOption} onPress={() => setGender(g)}>
                    <View style={[styles.radioButton, { borderColor: COLORS.primary }]}>
                      {gender === g && <View style={[styles.radioButtonInner, { backgroundColor: COLORS.primary }]} />}
                    </View>
                    <Text style={[styles.radioLabel, { color: colors.text }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Date of Birth Section */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.dob')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="dd/mm/yyyy"
              placeholderTextColor={colors.textSecondary}
              value={dobText}
              onChangeText={handleDobTextChange}
              keyboardType="numeric"
            />
          </View>



          {/* Contact Info Section */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.contact_info')}</Text>

            <View style={styles.formGroup}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.address')}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder={t('profile.address_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.city')}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder={t('profile.city_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={city}
                onChangeText={setCity}
              />
            </View>
          </View>

          {/* Professional Info Section */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.professional_info')}</Text>

            <View style={styles.formGroup}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.education')}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder={t('profile.education_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={education}
                onChangeText={setEducation}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.workplace')}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder={t('profile.workplace_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={workplace}
                onChangeText={setWorkplace}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: COLORS.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>{t('profile.save')}</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: 10,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  formGroup: {
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    paddingBottom: 5
  },
  sectionLabel: {
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '500',
  },
  input: {
    fontSize: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 2,
    borderWidth: 1,
  },
  bioInput: {
    fontSize: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  previewText: {
    fontSize: 11,
    lineHeight: 18,
  },
  dobFieldFull: {
    width: '100%',
  },
  dobValue: {
    fontSize: 14,
  },
  dobInputContainer: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  radioGroup: {
    flex: 1,
    flexDirection: 'row', // Chuyển hướng các phần tử sang nằm ngang
    gap: 12,
    alignItems: 'center',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    gap: 10,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 10,
  },
  radioLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  dobContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  dobHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarButton: {
    padding: 8,
  },
  dobField: {
    flex: 1,
  },
  dobLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  dobInput: {
    fontSize: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    textAlign: 'center',
  },
  datePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  datePickerHeaderButton: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  datePickerHeaderTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
    maxHeight: 300,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  pickerScroll: {
    flex: 1,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
