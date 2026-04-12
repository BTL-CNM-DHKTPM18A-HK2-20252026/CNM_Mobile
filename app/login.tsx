import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES } from '@/constants/theme';
import { authService } from '@/services/authService';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorEmail, setErrorEmail] = useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleGoToRegister = () => {
    Keyboard.dismiss();
    router.navigate('/register');
  };

  const isValidEmail = (e: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e.trim());

  const handleContinue = async () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) return;
    
    setIsLoading(true);
    try {
      const exists = await authService.checkEmail(trimmed);
      
      if (!exists) {
        setErrorEmail(t('login.email_not_found', 'Email chưa được đăng ký trong hệ thống'));
        return;
      }

      setErrorEmail(null);
      router.push({
        pathname: '/password',
        params: { email: trimmed }
      });
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
            <Ionicons name="arrow-back" size={22} color="#000000" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{t('login.header_title')}</Text>

          {/* Input Group */}
          <View style={[styles.inputWrapper, errorEmail && { borderColor: COLORS.error }]}>
            <Ionicons name="mail-outline" size={20} color={COLORS.inactive} style={{ marginLeft: 12 }} />

            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('login.email_placeholder', 'Nhập email')}
              placeholderTextColor="#999999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorEmail) setErrorEmail(null);
              }}
              autoFocus={false}
            />

            {email.length > 0 && (
              <TouchableOpacity 
                onPress={() => setEmail('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.inactive} />
              </TouchableOpacity>
            )}
          </View>

          {/* Error message */}
          {errorEmail && (
            <Text style={styles.errorText}>{errorEmail}</Text>
          )}

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton, 
              (!isValidEmail(email) || isLoading) && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={!isValidEmail(email) || isLoading}
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
            <TouchableOpacity onPress={handleGoToRegister} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
    backgroundColor: '#ffffff',
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
    color: '#000000',
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
    marginBottom: 10,
  },
  errorText: {
    color: COLORS.error,
    fontSize: SIZES.body4,
    marginBottom: 15,
    marginLeft: 5,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  countryText: {
    fontSize: SIZES.body3, // Reduced from body2
    color: '#000000',
    marginRight: 3,
  },
  divider: {
    width: 1,
    height: '50%',
    backgroundColor: '#e0e0e0',
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: SIZES.body3, // Reduced from body2
    color: '#000000',
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
    backgroundColor: '#f1f2f6',
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
    color: '#666666',
  },
  footerLink: {
    fontSize: SIZES.body4, // Reduced from body3
    color: COLORS.primary,
    fontWeight: '700',
  },
});
