import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { authService } from '@/services/authService';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type MenuAction = 'info' | 'avatar' | 'cover' | 'bio';

export default function PersonalMenuScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [loadingAction, setLoadingAction] = useState<MenuAction | null>(null);

  const pickAndUploadImage = async (action: Exclude<MenuAction, 'info' | 'bio'>) => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập thư viện ảnh');
      return;
    }

    const isAvatar = action === 'avatar';
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: isAvatar ? [1, 1] : [16, 9],
      quality: 0.85,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    const fileName = asset.fileName || `${action}_${Date.now()}.jpg`;
    const fileType = asset.mimeType || 'image/jpeg';

    try {
      setLoadingAction(action);

      const presignedUrl = isAvatar
        ? await authService.getAvatarPresignedUrl(fileName, fileType)
        : await authService.getCoverPresignedUrl(fileName, fileType);

      await authService.uploadToS3(presignedUrl, asset.uri, fileType);
      const cleanUrl = presignedUrl.split('?')[0];

      const success = isAvatar
        ? await authService.updateAvatar(cleanUrl)
        : await authService.updateCoverPhoto(cleanUrl);

      if (success) {
        Alert.alert('Thành công', isAvatar ? 'Đã cập nhật ảnh đại diện' : 'Đã cập nhật ảnh bìa');
      }
    } catch (error) {
      console.error(`Upload ${action} error:`, error);
      Alert.alert('Lỗi', 'Không thể upload ảnh');
    } finally {
      setLoadingAction(null);
    }
  };

  const MenuItem = ({
    icon,
    title,
    subtitle,
    onPress,
    destructive = false,
    action,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    onPress: () => void;
    destructive?: boolean;
    action?: MenuAction;
  }) => (
    <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.iconWrap, destructive && styles.destructiveIconWrap]}>
        {loadingAction === action ? (
          <ActivityIndicator size="small" color={destructive ? '#ef4444' : COLORS.primary} />
        ) : (
          <Ionicons name={icon} size={22} color={destructive ? '#ef4444' : COLORS.primary} />
        )}
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={isDark ? colors.textSecondary : '#C7C7CC'} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top > 0 ? 0 : 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu trang cá nhân</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={[styles.content, { backgroundColor: colors.chatBackground }]} bounces={false}>
        <View style={styles.sectionGap} />

        <MenuItem
          icon="person-outline"
          title="Thông tin"
          subtitle="Xem trang hồ sơ cá nhân"
          onPress={() => router.push('/profile')}
        />

        <MenuItem
          icon="image-outline"
          title="Đổi ảnh đại diện"
          subtitle="Chọn ảnh mới cho tài khoản"
          action="avatar"
          onPress={() => void pickAndUploadImage('avatar')}
        />

        <MenuItem
          icon="color-filter-outline"
          title="Đổi ảnh bìa"
          subtitle="Cập nhật ảnh bìa trang cá nhân"
          action="cover"
          onPress={() => void pickAndUploadImage('cover')}
        />

        <View style={styles.sectionGap} />
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
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  sectionGap: {
    height: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 104, 255, 0.08)',
    marginRight: 12,
  },
  destructiveIconWrap: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  textWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});