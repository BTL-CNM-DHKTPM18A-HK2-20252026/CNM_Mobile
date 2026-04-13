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
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/constants/theme';
import { authService } from '@/services/authService';

type ModalStep = 'email' | 'otp';

type RegisterErrors = {
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  confirmPassword?: string;
};

const PHONE_REGEX = /^(0|\+84)[0-9]{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
const OTP_LENGTH = 6;
const RESEND_SECONDS = 59;

const formatTimer = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export default function RegisterScreen() {
  const { t } = useTranslation();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generatedHint, setGeneratedHint] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('email');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  const displayName = useMemo(() => `${lastName} ${firstName}`.trim(), [firstName, lastName]);

  const generateStrongPassword = () => {
    const lowers = 'abcdefghijklmnopqrstuvwxyz';
    const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const specials = '!@#$%^&*';
    const all = lowers + uppers + numbers + specials;

    let generated = '';
    for (let i = 0; i < 2; i += 1) {
      generated += lowers.charAt(Math.floor(Math.random() * lowers.length));
      generated += uppers.charAt(Math.floor(Math.random() * uppers.length));
      generated += numbers.charAt(Math.floor(Math.random() * numbers.length));
      generated += specials.charAt(Math.floor(Math.random() * specials.length));
    }
    for (let i = 0; i < 4; i += 1) {
      generated += all.charAt(Math.floor(Math.random() * all.length));
    }

    const shuffled = generated
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');

    setPassword(shuffled);
    setConfirmPassword(shuffled);
    setShowPassword(true);
    setShowConfirmPassword(true);
    setGeneratedHint(true);
    setErrors((prev) => ({ ...prev, password: undefined, confirmPassword: undefined }));
  };

  const validateRegisterForm = () => {
    const nextErrors: RegisterErrors = {};

    if (!lastName.trim()) {
      nextErrors.lastName = t('login.validation.last_name_required', 'Vui long nhap ho');
    }

    if (!firstName.trim()) {
      nextErrors.firstName = t('login.validation.first_name_required', 'Vui long nhap ten');
    }

    if (!PHONE_REGEX.test(phoneNumber.trim())) {
      nextErrors.phoneNumber = t('login.validation.phone_invalid', 'So dien thoai khong hop le');
    }

    if (!PASSWORD_REGEX.test(password)) {
      nextErrors.password = t(
        'login.validation.password_weak',
        'Mat khau phai co it nhat 8 ky tu, gom chu hoa, chu thuong, so va ky tu dac biet'
      );
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = t('login.validation.confirm_mismatch', 'Mat khau xac nhan khong khop');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleOpenVerificationModal = () => {
    if (!validateRegisterForm() || isLoading) {
      return;
    }

    setModalError(null);
    setVerificationEmail('');
    setOtp('');
    setSecondsLeft(0);
    setModalStep('email');
    setShowVerifyModal(true);
  };

  const completeRegistration = async (email?: string) => {
    setIsLoading(true);

    try {
      await authService.register({
        phoneNumber: phoneNumber.trim(),
        email,
        password,
        displayName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      setShowVerifyModal(false);
      Alert.alert(
        t('register.success_title', 'Thanh cong'),
        t('register.success_message', 'Tao tai khoan thanh cong. Vui long dang nhap.'),
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (error: any) {
      const message = error?.toString?.() || t('register.error_register_failed', 'Dang ky that bai');

      if (showVerifyModal) {
        setModalError(message);
      } else {
        Alert.alert(t('register.error_title', 'Loi'), message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyByEmail = async () => {
    if (isSendingOtp || isLoading) {
      return;
    }

    const normalizedEmail = verificationEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setModalError(t('login.gmail_modal.invalid', 'Email khong hop le'));
      return;
    }

    setModalError(null);
    setIsSendingOtp(true);

    try {
      const emailExists = await authService.checkEmail(normalizedEmail);
      if (emailExists) {
        setModalError(t('login.gmail_modal.email_exists', 'Email da ton tai trong he thong'));
        return;
      }

      await authService.sendRegisterOtp(normalizedEmail);
      setVerificationEmail(normalizedEmail);
      setModalStep('otp');
      setOtp('');
      setSecondsLeft(RESEND_SECONDS);
      setModalError(null);
    } catch (error: any) {
      setModalError(error?.toString?.() || t('register.otp_send_failed', 'Khong the gui OTP'));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (secondsLeft > 0 || isResendingOtp || !verificationEmail) {
      return;
    }

    setIsResendingOtp(true);
    setModalError(null);

    try {
      await authService.resendRegisterOtp(verificationEmail);
      setOtp('');
      setSecondsLeft(RESEND_SECONDS);
    } catch (error: any) {
      setModalError(error?.toString?.() || t('register.otp_resend_failed', 'Gui lai OTP that bai'));
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleVerifyOtpAndRegister = async () => {
    if (isVerifyingOtp || isLoading) {
      return;
    }

    const normalizedOtp = otp.trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      setModalError(t('register.otp_invalid', 'Ma OTP phai gom dung 6 chu so'));
      return;
    }

    setIsVerifyingOtp(true);
    setModalError(null);

    try {
      await authService.verifyRegisterOtp(verificationEmail, normalizedOtp);
      await completeRegistration(verificationEmail);
    } catch (error: any) {
      setModalError(error?.toString?.() || t('register.otp_verify_failed', 'Xac thuc OTP that bai'));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSkipEmailVerification = () => {
    if (isLoading || isSendingOtp || isVerifyingOtp || isResendingOtp) {
      return;
    }

    Alert.alert(
      t('login.gmail_modal.skip_warning_title', 'Bo qua xac thuc email?'),
      t(
        'login.gmail_modal.skip_warning_desc',
        'Neu bo qua email, ban van co the dang ky nhung mot so tinh nang se bi gioi han.'
      ),
      [
        {
          text: t('common.cancel', 'Huy'),
          style: 'cancel',
        },
        {
          text: t('login.gmail_modal.skip_warning_continue', 'Tiep tuc bo qua'),
          style: 'destructive',
          onPress: () => {
            completeRegistration();
          },
        },
      ]
    );
  };

  const isBusy = isLoading || isSendingOtp || isVerifyingOtp || isResendingOtp;

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
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="#000000" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>{t('register.header_title', 'Tao tai khoan')}</Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t('register.last_name_label', 'Ho')}</Text>
              <View style={[styles.inputWrapper, errors.lastName ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder={t('register.last_name_placeholder', 'Nhap ho')}
                  placeholderTextColor="#999"
                  value={lastName}
                  onChangeText={(value) => {
                    setLastName(value);
                    if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }));
                  }}
                />
              </View>
              {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t('register.first_name_label', 'Ten')}</Text>
              <View style={[styles.inputWrapper, errors.firstName ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder={t('register.first_name_placeholder', 'Nhap ten')}
                  placeholderTextColor="#999"
                  value={firstName}
                  onChangeText={(value) => {
                    setFirstName(value);
                    if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }));
                  }}
                />
              </View>
              {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t('register.phone_label', 'So dien thoai')}</Text>
              <View style={[styles.inputWrapper, errors.phoneNumber ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder={t('register.phone_placeholder', 'Nhap so dien thoai')}
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={(value) => {
                    setPhoneNumber(value);
                    if (errors.phoneNumber) setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                  }}
                />
              </View>
              {errors.phoneNumber ? <Text style={styles.errorText}>{errors.phoneNumber}</Text> : null}
            </View>

            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{t('register.password_label', 'Mat khau')}</Text>
                <TouchableOpacity onPress={generateStrongPassword} style={styles.generateBtn}>
                  <Ionicons name="sparkles" size={13} color={COLORS.primary} />
                  <Text style={styles.generateBtnText}>{t('register.generate_password', 'Tao mat khau')}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder={t('register.password_placeholder', 'Nhap mat khau')}
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setGeneratedHint(false);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                />
                <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeButton}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#333"
                  />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              {generatedHint && !errors.password ? (
                <Text style={styles.hintText}>{t('register.generated_password_hint')}</Text>
              ) : null}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t('register.confirm_password_label', 'Xac nhan mat khau')}</Text>
              <View style={[styles.inputWrapper, errors.confirmPassword ? styles.inputError : null]}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder={t('register.confirm_password_placeholder', 'Nhap lai mat khau')}
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    if (errors.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#333"
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleOpenVerificationModal}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('register.submit', 'Tao tai khoan')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('register.already_have_account')} </Text>
              <TouchableOpacity onPress={() => router.replace('/login')}>
                <Text style={styles.footerLink}>{t('register.login')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        visible={showVerifyModal}
        animationType="fade"
        onRequestClose={() => {
          if (!isBusy) {
            setShowVerifyModal(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowVerifyModal(false)}
              disabled={isBusy}
            >
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>

            {modalStep === 'email' ? (
              <>
                <Text style={styles.modalTitle}>{t('login.gmail_modal.title', 'Xac thuc email')}</Text>
                <Text style={styles.modalDesc}>
                  {t(
                    'login.gmail_modal.subtitle',
                    'Nhap email de nhan OTP truoc khi tao tai khoan. Ban co the bo qua buoc nay.'
                  )}
                </Text>

                <View style={[styles.inputWrapper, modalError ? styles.inputError : null]}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('login.gmail_modal.placeholder', 'Nhap email')}
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={verificationEmail}
                    onChangeText={(value) => {
                      setVerificationEmail(value);
                      if (modalError) setModalError(null);
                    }}
                  />
                </View>

                {modalError ? <Text style={styles.errorText}>{modalError}</Text> : null}

                <TouchableOpacity
                  style={[styles.button, isSendingOtp && styles.buttonDisabled]}
                  onPress={handleVerifyByEmail}
                  disabled={isSendingOtp}
                >
                  {isSendingOtp ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t('login.gmail_modal.verify_btn', 'Gui OTP')}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleSkipEmailVerification}
                  disabled={isBusy}
                >
                  <Text style={styles.skipButtonText}>{t('login.gmail_modal.skip_btn', 'Bo qua email')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>{t('register.otp_modal_title', 'Xac thuc OTP')}</Text>
                <Text style={styles.modalDesc}>{t('register.otp_modal_desc', 'Nhap ma OTP 6 so da gui den email')}</Text>
                <Text style={styles.modalEmail}>{verificationEmail}</Text>

                <View style={[styles.inputWrapper, modalError ? styles.inputError : null]}>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder={t('register.otp_placeholder', 'Nhap OTP')}
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    value={otp}
                    onChangeText={(value) => {
                      setOtp(value.replace(/\D/g, ''));
                      if (modalError) setModalError(null);
                    }}
                  />
                </View>

                {modalError ? <Text style={styles.errorText}>{modalError}</Text> : null}

                <View style={styles.resendRow}>
                  <Text style={styles.resendHint}>
                    {secondsLeft > 0
                      ? `${t('login.otp.resend_in', 'Gui lai sau')} ${formatTimer(secondsLeft)}`
                      : t('login.otp.can_resend', 'Ban co the gui lai OTP')}
                  </Text>

                  <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={secondsLeft > 0 || isResendingOtp}
                    style={styles.resendBtn}
                  >
                    {isResendingOtp ? (
                      <ActivityIndicator color={COLORS.primary} />
                    ) : (
                      <Text
                        style={[
                          styles.resendText,
                          (secondsLeft > 0 || isResendingOtp) && styles.resendTextDisabled,
                        ]}
                      >
                        {t('register.resend_otp', 'Gui lai OTP')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.button, (otp.length !== OTP_LENGTH || isBusy) && styles.buttonDisabled]}
                  onPress={handleVerifyOtpAndRegister}
                  disabled={otp.length !== OTP_LENGTH || isBusy}
                >
                  {isVerifyingOtp || isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t('register.verify_otp', 'Xac thuc OTP')}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (!isBusy) {
                      setModalStep('email');
                      setOtp('');
                      setModalError(null);
                    }
                  }}
                  disabled={isBusy}
                  style={styles.backStepBtn}
                >
                  <Text style={styles.backStepText}>{t('login.otp.back_to_register', 'Quay lai')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    opacity: 0.7,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
    padding: 6,
    zIndex: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    paddingRight: 18,
  },
  modalDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  modalEmail: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
    marginBottom: 12,
  },
  skipButton: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '700',
  },
  resendRow: {
    marginTop: 10,
    marginBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  backStepBtn: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
  },
  backStepText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});
