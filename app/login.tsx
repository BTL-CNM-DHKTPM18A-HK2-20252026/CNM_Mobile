import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES } from '@/constants/theme';
import { authService } from '@/services/authService';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    if (phoneNumber.length < 10) return;
    
    setIsLoading(true);
    try {
      // For now, we use a fixed password as the UI only has phone number
      // In a real app, this would lead to an OTP or Password screen
      await authService.login(phoneNumber, 'password123');
      
      router.replace('/(tabs)/chat');
    } catch (error: any) {
      Alert.alert(
        t('login.error_title', 'Lỗi'),
        error.toString() || t('login.error_message', 'Đăng nhập thất bại, vui lòng thử lại')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{t('login.header_title')}</Text>

          {/* Input Group */}
          <View style={styles.inputWrapper}>
            <TouchableOpacity style={styles.countryCode}>
              <Text style={styles.countryText}>{t('login.country_code')}</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.inactive} />
            </TouchableOpacity>
            
            <View style={styles.divider} />

            <TextInput
              style={styles.input}
              placeholder={t('login.phone_placeholder')}
              placeholderTextColor={COLORS.textPlaceholder}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              autoFocus={true}
            />

            {phoneNumber.length > 0 && (
              <TouchableOpacity 
                onPress={() => setPhoneNumber('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.inactive} />
              </TouchableOpacity>
            )}
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton, 
              (phoneNumber.length < 10 || isLoading) && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={phoneNumber.length < 10 || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={styles.continueText}>{t('login.continue')}</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('login.no_account')} </Text>
            <TouchableOpacity onPress={() => console.log('Go to Register')}>
              <Text style={styles.footerLink}>{t('login.create_account')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 15,
    paddingTop: 50, // Moved even further down
    paddingBottom: 5,
  },
  backButton: {
    width: 35,
    height: 35,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 10,
  },
  title: {
    fontSize: SIZES.h4, // Reduced from h3
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 25,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1, // Reduced thickness
    borderColor: COLORS.primary,
    borderRadius: 12,
    height: 50, // Slightly shorter
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  countryText: {
    fontSize: SIZES.body3, // Reduced from body2
    color: COLORS.text,
    marginRight: 3,
  },
  divider: {
    width: 1,
    height: '50%',
    backgroundColor: COLORS.border,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: SIZES.body3, // Reduced from body2
    color: COLORS.text,
    height: '100%',
  },
  clearButton: {
    padding: 5,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    height: 48, // Slightly shorter
    borderRadius: SIZES.radiusFull,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  disabledButton: {
    backgroundColor: COLORS.surface,
  },
  continueText: {
    color: COLORS.textWhite,
    fontSize: SIZES.body3, // Reduced from body2
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 35,
  },
  footerText: {
    fontSize: SIZES.body4, // Reduced from body3
    color: COLORS.textSecondary,
  },
  footerLink: {
    fontSize: SIZES.body4, // Reduced from body3
    color: COLORS.primary,
    fontWeight: '700',
  },
});
