import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, FlatList, Dimensions, NativeScrollEvent, NativeSyntheticEvent, Modal, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES } from '@/constants/theme';
import { authService } from '@/services/authService';
import { useEffect } from 'react';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Fruvia Chat',
    description: 'Chào mừng bạn tới với Fruvia Chat',
    image: require('../assets/images/login/fruvia_logo.png'),
    isLogo: true,
  },
  {
    id: '2',
    title: 'Gọi video ổn định',
    description: 'Trò chuyện thật đã với chất lượng video ổn định mọi lúc, mọi nơi',
    image: require('../assets/images/login/slide2.png'),
  },
  {
    id: '3',
    title: 'Chat nhóm tiện ích',
    description: 'Nơi cùng nhau trao đổi, giữ liên lạc với gia đình, bạn bè, đồng nghiệp...',
    image: require('../assets/images/login/slide3.png'),
  },
  {
    id: '4',
    title: 'Gửi ảnh nhanh chóng',
    description: 'Trao đổi hình ảnh chất lượng cao với bạn bè và người thân thật nhanh và dễ dàng',
    image: require('../assets/images/login/slide4.png'),
  },
  {
    id: '5',
    title: 'Nhật ký bạn bè',
    description: 'Nơi cập nhật hoạt động mới nhất của những người bạn quan tâm',
    image: require('../assets/images/login/slide5.png'),
  },
];

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        if (authenticated) {
          router.replace('/(tabs)/chat');
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  if (isCheckingAuth) {
    return <View style={{ flex: 1, backgroundColor: '#ffffff' }} />;
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollOffset / width);
    setActiveIndex(index);
  };

  const getTranslatedSlide = (item: typeof SLIDES[0]) => {
    if (item.isLogo) {
      return {
        title: item.title,
        description: t('welcome.greeting')
      };
    }
    const id = item.id;
    return {
      title: t(`welcome.slide${id}_title`),
      description: t(`welcome.slide${id}_desc`)
    };
  };

  const renderItem = ({ item }: { item: typeof SLIDES[0] }) => {
    const translated = getTranslatedSlide(item);
    return (
      <View style={styles.slide}>
        <View style={styles.contentContainer}>
          {item.isLogo ? (
            <View style={styles.logoAndBgContainer}>
              <View style={styles.slideBgContainer}>
                <Image
                  source={require('../assets/images/login/zalo_bg.png')}
                  style={styles.bgImage}
                  contentFit="contain"
                />
              </View>
              <Image
                source={item.image}
                style={styles.logoImage}
                contentFit="contain"
              />
              <View style={[styles.textContainer, { marginTop: 0 }]}>
                <Text style={[styles.description, { color: COLORS.light.text, fontSize: SIZES.h4, fontWeight: '800' }]}>
                  {translated.description}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Image
                source={item.image}
                style={styles.illustrationImage}
                contentFit="contain"
              />
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: COLORS.light.text }]}>{translated.title}</Text>
                <Text style={[styles.description, { color: COLORS.light.textSecondary }]}>{translated.description}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#ffffff' }]}>
      <StatusBar barStyle="dark-content" />
      {/* Top Bar with Segmented Language Toggle */}
      <View style={styles.topBar}>
        <View style={styles.languageToggle}>
          <TouchableOpacity
            style={[styles.langSegment, i18n.language === 'VI' && styles.activeSegment]}
            onPress={() => i18n.changeLanguage('VI')}
            activeOpacity={0.8}
          >
            <Text style={[styles.langToggleText, i18n.language === 'VI' && styles.activeToggleText]}>
              VI
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langSegment, i18n.language === 'EN' && styles.activeSegment]}
            onPress={() => i18n.changeLanguage('EN')}
            activeOpacity={0.8}
          >
            <Text style={[styles.langToggleText, i18n.language === 'EN' && styles.activeToggleText]}>
              EN
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
      />

      {/* Pagination Indicator */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <View
            key={`dot-${index}`}
            style={[
              styles.dot, 
              { backgroundColor: index === activeIndex ? COLORS.primary : '#e0e0e0' }
            ]}
          />
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.loginButton}
          activeOpacity={0.8}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.loginText}>{t('welcome.login')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.registerButton, { backgroundColor: COLORS.light.surface }]}
          activeOpacity={0.8}
          onPress={() => router.push('/register')}
        >
          <Text style={[styles.registerText, { color: COLORS.light.text }]}>{t('welcome.register')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    width: '100%',
    paddingHorizontal: SIZES.padding,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    position: 'absolute',
    top: 50,
    right: 0,
    zIndex: 100,
  },
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f2f6',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: '#eee',
  },
  langSegment: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 17,
  },
  activeSegment: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  langToggleText: {
    fontSize: SIZES.h7,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeToggleText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  bgContainer: {
    position: 'absolute',
    bottom: '22%',
    width: '100%',
    height: '50%',
    opacity: 0.4,
    zIndex: -1,
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  logoAndBgContainer: {
    width: width,
    height: 480,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideBgContainer: {
    position: 'absolute',
    bottom: -20,
    width: '120%',
    height: '100%',
    opacity: 0.4,
  },
  slide: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: -50,
  },
  logoImage: {
    width: 300,
    height: 150,
    marginTop: -180,
  },
  illustrationImage: {
    width: 250,
    height: 250,
    marginBottom: 30,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: SIZES.body1,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: SIZES.body3,
    textAlign: 'center',
    lineHeight: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 50,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: COLORS.primary,
  },
  footer: {
    paddingHorizontal: SIZES.padding * 1.5,
    paddingBottom: 40,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: SIZES.radiusFull,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  loginText: {
    color: COLORS.textWhite,
    fontSize: SIZES.body4,
    fontWeight: '600',
  },
  registerButton: {
    backgroundColor: COLORS.surface,
    height: 52,
    borderRadius: SIZES.radiusFull,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: SIZES.body4,
    fontWeight: '600',
  },
});
