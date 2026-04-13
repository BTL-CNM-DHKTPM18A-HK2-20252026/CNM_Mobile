import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES } from '@/constants/theme';
import { authService } from '@/services/authService';

const PHONE_REGEX = /^(0|\+84)[0-9]{9}$/;

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState('0399614015');
  const [password, setPassword] = useState('TestUser123@');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleGoToRegister = () => {
    router.navigate('/register');
  };

  const isValidPhone = useMemo(() => PHONE_REGEX.test(username.trim()), [username]);

  const handleContinue = async () => {
    const trimmedPhone = username.trim();
    if (!isValidPhone) {
      setError(t('login.validation.phone_invalid', 'Số điện thoại không hợp lệ'));
      return;
    }

    if (!password.trim()) {
      setError(t('login.password_required', 'Vui lòng nhập mật khẩu'));
      return;
    }

    setIsLoading(true);
    try {
      setError(null);
      await authService.login(trimmedPhone, password);
      router.replace('/(tabs)/chat');
    } catch (error: any) {
      Alert.alert(
        t('login.error_title', 'Lỗi'),
        error?.toString?.() || t('login.error_message', 'Đăng nhập thất bại, vui lòng thử lại')
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#000000" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{t('login.header_title', 'Đăng nhập')}</Text>

          {/* Phone */}
          <View style={[styles.inputWrapper, error && { borderColor: COLORS.error }]}>
            <Ionicons name="call-outline" size={20} color={COLORS.inactive} style={styles.inputLeadingIcon} />

            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('login.phone_placeholder', 'Nhập số điện thoại')}
              placeholderTextColor="#999999"
              keyboardType="phone-pad"
              autoCapitalize="none"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (error) setError(null);
              }}
              autoFocus={false}
            />

            {username.length > 0 && (
              <TouchableOpacity
                onPress={() => setUsername('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.inactive} />
              </TouchableOpacity>
            )}
          </View>

          {/* Password */}
          <View style={[styles.inputWrapper, { marginTop: 12 }, error && { borderColor: COLORS.error }]}> 
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.inactive} style={styles.inputLeadingIcon} />

            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('login.password_placeholder', 'Nhập mật khẩu')}
              placeholderTextColor="#999999"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError(null);
              }}
            />

            <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} style={styles.clearButton}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={COLORS.inactive} />
            </TouchableOpacity>
          </View>

          {/* Error message */}
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <TouchableOpacity style={styles.forgotButton} onPress={() => router.push('/forgot-password')}>
            <Text style={styles.forgotText}>{t('login.forgot_password', 'Quên mật khẩu?')}</Text>
          </TouchableOpacity>

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton, 
              (!isValidPhone || !password.trim() || isLoading) && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={!isValidPhone || !password.trim() || isLoading}
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
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
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
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  inputLeadingIcon: {
    marginLeft: 2,
    marginRight: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: SIZES.body4,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 5,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 8,
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: SIZES.body4,
    fontWeight: '600',
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
    marginTop: 28,
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
