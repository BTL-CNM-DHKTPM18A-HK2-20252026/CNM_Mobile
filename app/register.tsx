import React, { useState } from 'react';
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/constants/theme';
import { authService } from '@/services/authService';

export default function RegisterScreen() {
  const { t } = useTranslation();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('TestUser123@');
  const [confirmPassword, setConfirmPassword] = useState('TestUser123@');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedHint, setGeneratedHint] = useState(false);

  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const generateStrongPassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '!@#$%^&*';
    const all = upper + lower + digits + special;
    const getRandom = (str: string) => str[Math.floor(Math.random() * str.length)];
    const shuffled = [
      getRandom(upper),
      getRandom(lower),
      getRandom(digits),
      getRandom(special),
      ...Array.from({ length: 8 }, () => getRandom(all)),
    ].sort(() => Math.random() - 0.5).join('');
    setPassword(shuffled);
    setConfirmPassword(shuffled);
    setShowPassword(true);
    setShowConfirmPassword(true);
    setGeneratedHint(true);
    setErrors((e) => ({ ...e, password: null, confirmPassword: null }));
  };

  const validate = () => {
    const newErrors: Record<string, string | null> = {};
    const phoneRegex = /^0[35789]\d{8}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;

    if (!phoneRegex.test(phoneNumber)) {
      newErrors.phoneNumber = t('register.phone_invalid');
    }
    if (!emailRegex.test(email)) {
      newErrors.email = t('register.email_invalid');
    }
    if (!displayName.trim()) {
      newErrors.displayName = t('register.display_name_required');
    }
    if (!passwordRegex.test(password)) {
      newErrors.password = t('register.password_invalid');
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('register.confirm_password_mismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate() || isLoading) return;

    setIsLoading(true);
    try {
      await authService.register({
        phoneNumber,
        email,
        password,
        displayName,
      });

      Alert.alert(
        t('register.success_title'),
        t('register.success_message'),
        [
          {
            text: 'OK',
            onPress: () =>
              router.replace({
                pathname: '/password',
                params: { phoneNumber },
              }),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        t('register.error_title'),
        error.toString() || 'Đăng ký thất bại, vui lòng thử lại'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    phoneNumber.length >= 10 &&
    email.length > 0 &&
    displayName.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length >= 8;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="#000000" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>{t('register.header_title')}</Text>

            {/* Phone */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t('register.phone_label')}</Text>
              <View style={[styles.inputWrapper, errors.phoneNumber ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder={t('register.phone_placeholder')}
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={(v) => {
                    setPhoneNumber(v);
                    if (errors.phoneNumber) setErrors((e) => ({ ...e, phoneNumber: null }));
                  }}
                />
              </View>
              {errors.phoneNumber && (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t('register.email_label')}</Text>
              <View style={[styles.inputWrapper, errors.email ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder={t('register.email_placeholder')}
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (errors.email) setErrors((e) => ({ ...e, email: null }));
                  }}
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Display name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t('register.display_name_label')}</Text>
              <View style={[styles.inputWrapper, errors.displayName ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder={t('register.display_name_placeholder')}
                  placeholderTextColor="#999"
                  value={displayName}
                  onChangeText={(v) => {
                    setDisplayName(v);
                    if (errors.displayName) setErrors((e) => ({ ...e, displayName: null }));
                  }}
                />
              </View>
              {errors.displayName && (
                <Text style={styles.errorText}>{errors.displayName}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{t('register.password_label')}</Text>
                <TouchableOpacity onPress={generateStrongPassword} style={styles.generateBtn}>
                  <Ionicons name="sparkles" size={13} color={COLORS.primary} />
                  <Text style={styles.generateBtnText}>{t('register.generate_password')}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder={t('register.password_placeholder')}
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setGeneratedHint(false);
                    if (errors.password) setErrors((e) => ({ ...e, password: null }));
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#333"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
              {generatedHint && !errors.password && (
                <Text style={styles.hintText}>{t('register.generated_password_hint')}</Text>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t('register.confirm_password_label')}</Text>
              <View style={[styles.inputWrapper, errors.confirmPassword ? styles.inputError : null]}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder={t('register.confirm_password_placeholder')}
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={(v) => {
                    setConfirmPassword(v);
                    if (errors.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: null }));
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#333"
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.button, (!isFormValid || isLoading) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('register.submit')}</Text>
              )}
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('register.already_have_account')} </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.footerLink}>{t('register.login')}</Text>
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
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 5,
  },
  backButton: {
    width: 35,
    height: 35,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
    marginBottom: 6,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  generateBtnText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 11,
    color: '#4caf50',
    marginTop: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: '#000',
  },
  inputFlex: {
    flex: 1,
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  button: {
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#b0c4de',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#888',
    fontSize: 14,
  },
  footerLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
