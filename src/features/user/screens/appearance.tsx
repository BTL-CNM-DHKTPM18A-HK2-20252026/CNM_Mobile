import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';

export default function AppearanceScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { theme, setTheme, colors, isDark } = useTheme();

  const ThemeOption = ({ id, label, isSelected }: { id: string, label: string, isSelected: boolean }) => (
    <TouchableOpacity
      style={styles.themeOption}
      onPress={() => setTheme(id as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.themePreview, isSelected && { borderColor: COLORS.primary }, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
        {id === 'light' ? (
          <View style={styles.lightPreview}>
            <View style={styles.previewHeader} />
            <View style={styles.previewContent}>
              <View style={styles.previewBubbleLeft} />
              <View style={styles.previewBubbleRight} />
            </View>
          </View>
        ) : id === 'dark' ? (
          <View style={styles.darkPreview}>
            <View style={styles.previewHeaderDark} />
            <View style={styles.previewContent}>
              <View style={styles.previewBubbleLeftDark} />
              <View style={styles.previewBubbleRightDark} />
            </View>
          </View>
        ) : (
          <View style={styles.systemPreview}>
            <View style={styles.previewSideLeft}>
              <View style={[styles.previewHeader, { backgroundColor: '#E5E5E5' }]} />
              <View style={styles.previewContent}>
                <View style={styles.previewBubbleLeft} />
              </View>
            </View>
            <View style={styles.previewSideRight}>
              <View style={styles.previewHeaderDark} />
              <View style={styles.previewContent}>
                <View style={styles.previewBubbleRightDark} />
              </View>
            </View>
          </View>
        )}
      </View>
      <View style={styles.radioRow}>
        <View style={[styles.radioButton, { borderColor: isSelected ? COLORS.primary : colors.border }, isSelected && { backgroundColor: COLORS.primary }]}>
          <View style={[styles.radioInner, isSelected && { opacity: 1 }]} />
        </View>
        <Text style={[styles.radioLabel, { color: colors.text }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.headerContainer, { backgroundColor: colors.header }]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={isDark ? colors.text : "#fff"} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: isDark ? colors.text : "#fff" }]}>{t('appearance.header')}</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView style={[styles.content, { backgroundColor: colors.chatBackground }]}>
        {/* Appearance Section */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={styles.sectionTitle}>{t('appearance.section_ui')}</Text>
          <View style={styles.themeRow}>
            <ThemeOption id="light" label={t('appearance.theme_light')} isSelected={theme === 'light'} />
            <ThemeOption id="dark" label={t('appearance.theme_dark')} isSelected={theme === 'dark'} />
            <ThemeOption id="system" label={t('appearance.theme_system')} isSelected={theme === 'system'} />
          </View>
        </View>

        <View style={[styles.menuSection, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={[styles.menuText, { color: colors.text }]}>{t('appearance.change_font')}</Text>
            <View style={styles.rightSide}>
              <Text style={styles.valueText}>{t('appearance.default_font')}</Text>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={[styles.menuText, { color: colors.text }]}>{t('appearance.change_font_size')}</Text>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionDivider, { backgroundColor: colors.chatBackground }]} />

        {/* Language Section */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={styles.sectionTitle}>{t('appearance.section_lang')}</Text>
        </View>

        <View style={[styles.menuSectionLast, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/language')}>
            <Text style={[styles.menuText, { color: colors.text }]}>{t('appearance.change_lang')}</Text>
            <View style={styles.rightSide}>
              <View style={styles.languageBadge}>
                <Image
                  source={{ uri: i18n.language === 'VI' ? 'https://flagcdn.com/w40/vn.png' : 'https://flagcdn.com/w40/us.png' }}
                  style={styles.flagIcon}
                />
                <Text style={styles.valueText}>{t('appearance.current_lang')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </View>
          </TouchableOpacity>
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
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 16,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  themeOption: {
    width: '30%',
    alignItems: 'center',
  },
  themePreview: {
    width: '100%',
    aspectRatio: 0.8,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  lightPreview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  darkPreview: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  systemPreview: {
    flex: 1,
    flexDirection: 'row',
  },
  previewSideLeft: {
    flex: 1,
    backgroundColor: '#fff',
  },
  previewSideRight: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  previewHeader: {
    height: '25%',
    backgroundColor: '#F5F5F5',
  },
  previewHeaderDark: {
    height: '25%',
    backgroundColor: '#2C2C2E',
  },
  previewContent: {
    flex: 1,
    padding: 6,
    gap: 6,
  },
  previewBubbleLeft: {
    width: '70%',
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
  },
  previewBubbleRight: {
    width: '70%',
    height: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    alignSelf: 'flex-end',
    opacity: 0.3,
  },
  previewBubbleLeftDark: {
    width: '70%',
    height: 8,
    backgroundColor: '#3A3A3C',
    borderRadius: 4,
  },
  previewBubbleRightDark: {
    width: '70%',
    height: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    opacity: 0,
  },
  radioLabel: {
    fontSize: 11,
  },
  menuSection: {
    borderTopWidth: 0.5,
  },
  menuSectionLast: {
    borderTopWidth: 0.5,
    paddingBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  menuText: {
    fontSize: 12,
  },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 11,
    color: '#8e8e93',
    marginRight: 4,
  },
  sectionDivider: {
    height: 8,
  },
  languageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  flagIcon: {
    width: 18,
    height: 12,
    marginRight: 6,
  },
});
