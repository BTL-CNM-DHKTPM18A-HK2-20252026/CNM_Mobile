import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

const LANGUAGES = [
  {
    id: 'VI',
    name: 'Tiếng Việt',
    flag: 'https://flagcdn.com/w40/vn.png',
  },
  {
    id: 'EN',    // Should be 'en' but we match what's currently in i18n
    name: 'English',
    flag: 'https://flagcdn.com/w40/us.png',
  }
];

export default function LanguageScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Normalize current lang comparison
  const normalizedLang = i18n.language.toUpperCase() === 'VI' ? 'VI' : 'EN';
  const [currentLang, setCurrentLang] = useState(normalizedLang);

  const handleLanguageChange = (langId: string) => {
    const languageCode = langId.toLowerCase();
    setCurrentLang(langId);
    i18n.changeLanguage(languageCode);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.headerContainer, { 
        backgroundColor: isDark ? colors.header : COLORS.primary,
        paddingTop: insets.top
      }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('language.header')}</Text>
        </View>
      </View>

      <ScrollView style={[styles.content, { backgroundColor: colors.chatBackground }]}>
        <View style={[styles.languageList, { backgroundColor: colors.card }]}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity 
              key={lang.id}
              style={[styles.languageItem, { borderBottomColor: colors.border }]}
              onPress={() => handleLanguageChange(lang.id)}
              activeOpacity={0.7}
            >
              <Image source={{ uri: lang.flag }} style={styles.flagIcon} />
              <Text style={[styles.languageName, { color: colors.text }]}>{lang.name}</Text>
              {currentLang === lang.id && (
                <Ionicons name="checkmark" size={24} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  languageList: {
    marginTop: 1,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  flagIcon: {
    width: 24,
    height: 18,
    marginRight: 16,
  },
  languageName: {
    flex: 1,
    fontSize: 14,
  },
});
