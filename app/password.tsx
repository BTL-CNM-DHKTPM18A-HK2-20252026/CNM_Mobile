import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '@/constants/theme';
import { authService } from '@/services/authService';

export default function PasswordScreen() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  
  const [password, setPassword] = useState('TestUser123@');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Format phone number with spaces for display: 0xxx xxx xxx
  const formatPhoneNumber = (num: string) => {
    if (!num) return '';
    const cleaned = num.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]}`;
    }
    return num;
  };

  const handleBack = () => {
    router.back();
  };

  const handleLogin = async () => {
    if (!password || isLoading) return;
    
    setIsLoading(true);
    try {
      await authService.login(phoneNumber as string, password);
      router.replace('/(tabs)/chat');
    } catch (error: any) {
      Alert.alert(
        'Lỗi',
        'Mật khẩu không chính xác, vui lòng thử lại'
      );
    } finally {
      setIsLoading(false);
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
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Title */}
            <Text style={styles.title}>
              Nhập mật khẩu của tài khoản gắn với số điện thoại
            </Text>
            
            {/* Formatted Phone Number */}
            <Text style={styles.phoneNumberDisplay}>
              {formatPhoneNumber(phoneNumber as string)}
            </Text>

            {/* Password Input Box */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Nhập mật khẩu"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoFocus={true}
              />
              
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons 
                  name={showPassword ? "eye-outline" : "eye-off-outline"} 
                  size={20} 
                  color="#333" 
                />
              </TouchableOpacity>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.button, 
                password.length > 0 ? styles.buttonActive : styles.buttonDisabled
              ]}
              onPress={handleLogin}
              disabled={!password || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[
                  styles.buttonText,
                  password.length > 0 ? styles.buttonTextActive : styles.buttonTextDisabled
                ]}>
                  Tiếp tục
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Link - Separate from ScrollView to avoid "shaking" */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Quên mật khẩu?</Text>
          </TouchableOpacity>
        </View>
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
  },
  header: {
    paddingHorizontal: 15,
    paddingTop: 45, // Đẩy nút quay về xuống thấp hơn
    height: 60,
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 20,
  },
  title: {
    fontSize: 10, // Giảm về 10
    color: '#363636',
    textAlign: 'center',
    marginBottom: 8,
  },
  phoneNumberDisplay: {
    fontSize: 17, // Giảm thêm 1px về 17
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 30,
  },
  inputContainer: {
    width: '100%',
    height: 52,
    borderWidth: 1.5,
    borderColor: '#0068ff', // Zalo Blue
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 25,
  },
  input: {
    flex: 1,
    fontSize: 11, // Giảm về 11
    color: '#000',
  },
  eyeIcon: {
    padding: 5,
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#e0e0e0', // Light grey for disabled state
  },
  buttonActive: {
    backgroundColor: '#0068ff',
  },
  buttonText: {
    fontSize: 11, // Giảm về 11
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#a0a0a0',
  },
  buttonTextActive: {
    color: '#fff',
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  forgotBtn: {
    padding: 10,
  },
  forgotText: {
    color: '#0068ff',
    fontSize: 11, // Giảm về 11
    fontWeight: '600',
  },
});
