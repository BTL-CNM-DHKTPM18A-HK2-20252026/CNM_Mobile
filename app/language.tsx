import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

const LANGUAGES = [
  {
    id: 'VI',
    name: 'Tiếng Việt',
    flag: 'https://flagcdn.com/w40/vn.png',
  },
  {
    id: 'EN',
    name: 'English',
    flag: 'https://flagcdn.com/w40/us.png',
  }
];

export default function LanguageScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language.toUpperCase());

  const handleLanguageChange = (langId: string) => {
    setCurrentLang(langId);
    i18n.changeLanguage(langId);
    // In a real app, you might want to save this to storage
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.headerContainer}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('language.header')}</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.languageList}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity 
              key={lang.id}
              style={styles.languageItem}
              onPress={() => handleLanguageChange(lang.id)}
              activeOpacity={0.7}
            >
              <Image source={{ uri: lang.flag }} style={styles.flagIcon} />
              <Text style={styles.languageName}>{lang.name}</Text>
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
    backgroundColor: '#F2F2F7',
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
    backgroundColor: '#fff',
    marginTop: 1,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  flagIcon: {
    width: 24,
    height: 18,
    marginRight: 16,
  },
  languageName: {
    flex: 1,
    fontSize: 14,
    color: '#000',
  },
});
