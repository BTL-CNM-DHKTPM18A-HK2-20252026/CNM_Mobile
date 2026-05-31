import React, { useEffect, useMemo, useState } from 'react';
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

type ForgotStep = 'request' | 'reset';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 59;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;

const isValidEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  if (!emailRegex.test(normalized)) return false;
  if (normalized.includes('..')) return false;
  const [localPart] = normalized.split('@');
  if (!localPart || localPart.startsWith('.') || localPart.endsWith('.')) return false;
  return true;
};

const formatTimer = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<ForgotStep>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const handleSendOtp = async () => {
    if (sendingOtp) return;

    if (!isValidEmail(normalizedEmail)) {
      Alert.alert(
        t('register.error_title', 'Lỗi'),
        t('login.validation.email_invalid', 'Email không hợp lệ')
      );
      return;
    }

    setSendingOtp(true);
    try {
      await authService.sendPasswordResetOtp(normalizedEmail);
      setEmail(normalizedEmail);
      setOtp('');
      setStep('reset');
      setSecondsLeft(RESEND_SECONDS);
      Alert.alert(
        t('login.forgot.send_success', 'Đã gửi mã OTP đặt lại mật khẩu'),
        `${t('login.forgot.sent_to', 'Mã OTP đặt lại mật khẩu đã gửi tới')} ${normalizedEmail}`
      );
    } catch (error: any) {
      Alert.alert(
        t('register.error_title', 'Lỗi'),
        error?.toString?.() || t('login.forgot.send_failed', 'Không thể gửi OTP đặt lại mật khẩu')
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendingOtp || secondsLeft > 0) return;

    setResendingOtp(true);
    try {
      await authService.sendPasswordResetOtp(normalizedEmail);
      setOtp('');
      setSecondsLeft(RESEND_SECONDS);
      Alert.alert(
        t('login.forgot.resend_success', 'Đã gửi lại OTP đặt lại mật khẩu'),
        `${t('login.forgot.sent_to', 'Mã OTP đặt lại mật khẩu đã gửi tới')} ${normalizedEmail}`
      );
    } catch (error: any) {
      Alert.alert(
        t('register.error_title', 'Lỗi'),
        error?.toString?.() || t('login.forgot.resend_failed', 'Không thể gửi lại OTP đặt lại mật khẩu')
      );
    } finally {
      setResendingOtp(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetting) return;

    if (otp.trim().length !== OTP_LENGTH) {
      Alert.alert(
        t('register.error_title', 'Lỗi'),
        t('login.forgot.otp_invalid', 'Vui lòng nhập đủ 6 số OTP')
      );
      return;
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      Alert.alert(
        t('register.error_title', 'Lỗi'),
        t(
          'login.validation.password_weak',
          'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt'
        )
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        t('register.error_title', 'Lỗi'),
        t('login.validation.confirm_mismatch', 'Mật khẩu xác nhận không khớp')
      );
      return;
    }

    setResetting(true);
    try {
      await authService.resetPassword(normalizedEmail, otp.trim(), newPassword);
      Alert.alert(
        t('register.success_title', 'Thành công'),
        t('login.forgot.reset_success', 'Đặt lại mật khẩu thành công'),
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        t('register.error_title', 'Lỗi'),
        error?.toString?.() || t('login.forgot.reset_failed', 'Đặt lại mật khẩu thất bại')
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>{t('login.forgot.title', 'Quên mật khẩu')}</Text>
            <Text style={styles.subtitle}>
              {step === 'request'
                ? t('login.forgot.subtitle_request', 'Nhập email để nhận OTP đặt lại mật khẩu')
                : t('login.forgot.subtitle_reset', 'Nhập OTP và mật khẩu mới để hoàn tất khôi phục')}
            </Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t('login.forgot.email_label', 'Email')}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={t('login.forgot.email_placeholder', 'Nhập email')}
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={step === 'request'}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {step === 'request' ? (
              <TouchableOpacity
                style={[styles.button, sendingOtp && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={sendingOtp}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{t('login.forgot.send_otp', 'Gửi mã OTP')}</Text>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>{t('login.forgot.otp_label', 'Mã OTP')}</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      placeholder={t('register.otp_placeholder', 'Nhập OTP')}
                      placeholderTextColor="#999"
                      keyboardType="number-pad"
                      maxLength={OTP_LENGTH}
                      value={otp}
                      onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
                    />
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>{t('login.forgot.new_password_label', 'Mật khẩu mới')}</Text>
                  <View style={styles.inputWrapperRow}>
                    <TextInput
                      style={[styles.input, styles.flexInput]}
                      placeholder={t('login.forgot.new_password_placeholder', 'Nhập mật khẩu mới')}
                      placeholderTextColor="#999"
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TouchableOpacity onPress={() => setShowNewPassword((v) => !v)} style={styles.eyeButton}>
                      <Ionicons
                        name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="#333"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>
                    {t('login.forgot.confirm_password_label', 'Xác nhận mật khẩu mới')}
                  </Text>
                  <View style={styles.inputWrapperRow}>
                    <TextInput
                      style={[styles.input, styles.flexInput]}
                      placeholder={t('login.forgot.confirm_password_placeholder', 'Nhập lại mật khẩu mới')}
                      placeholderTextColor="#999"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword((v) => !v)}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="#333"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.resendRow}>
                  <Text style={styles.resendHint}>
                    {secondsLeft > 0
                      ? `${t('login.otp.resend_in', 'Gửi lại sau')} ${formatTimer(secondsLeft)}`
                      : t('login.otp.can_resend', 'Bạn có thể gửi lại OTP')}
                  </Text>
                  <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={secondsLeft > 0 || resendingOtp}
                    style={styles.resendBtn}
                  >
                    {resendingOtp ? (
                      <ActivityIndicator color={COLORS.primary} />
                    ) : (
                      <Text
                        style={[
                          styles.resendText,
                          (secondsLeft > 0 || resendingOtp) && styles.resendTextDisabled,
                        ]}
                      >
                        {t('login.otp.resend', 'Gửi lại OTP')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.button, resetting && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={resetting}
                >
                  {resetting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {t('login.forgot.reset_password', 'Đặt lại mật khẩu')}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => router.replace('/login')} style={styles.backToLoginBtn}>
              <Text style={styles.backToLoginText}>{t('login.forgot.back_to_login', 'Quay lại đăng nhập')}</Text>
            </TouchableOpacity>
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
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
    fontWeight: '600',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fafafa',
    paddingHorizontal: 14,
  },
  inputWrapperRow: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fafafa',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    height: 48,
    fontSize: 15,
    color: '#000',
  },
  flexInput: {
    flex: 1,
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '700',
  },
  eyeButton: {
    padding: 4,
  },
  button: {
    marginTop: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resendRow: {
    marginTop: 6,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resendHint: {
    fontSize: 12,
    color: '#666',
  },
  resendBtn: {
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  resendTextDisabled: {
    color: '#9fb5df',
  },
  backToLoginBtn: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  backToLoginText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});
