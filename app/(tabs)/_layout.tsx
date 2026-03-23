import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { HapticTab } from '@/components/common/HapticTab';
import { COLORS } from '@/constants/theme';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';

const TabBadge = ({ count, type = 'number' }: { count?: string | number, type?: 'number' | 'dot' | 'n' }) => {
  const { colors } = useTheme();
  if (!count && type !== 'dot') return null;
  
  return (
      <View style={[
        styles.badge, 
        type === 'dot' && styles.dotBadge,
        { borderColor: colors.tabBar }
      ]}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  );
};

const CustomTabIcon = ({
  focused,
  color,
  iconName,
  iconType = 'ionicons',
  label,
  badge = null
}: {
  focused: boolean,
  color: string,
  iconName: string,
  iconType?: 'ionicons' | 'mci',
  label: string,
  badge?: React.ReactNode
}) => {
  return (
    <View style={styles.tabIconGroup}>
      <View style={styles.iconContainer}>
        {iconType === 'ionicons' ? (
          <Ionicons
            name={focused ? (iconName as any) : (`${iconName}-outline` as any)}
            size={24}
            color={color}
          />
        ) : (
          <MaterialCommunityIcons
            name={focused ? (iconName as any) : (`${iconName}-outline` as any)}
            size={24}
            color={color}
          />
        )}
        {badge}
      </View>
      {focused && <Text style={[styles.tabLabel, { color }]}>{label}</Text>}
    </View>
  );
};

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary, 
        tabBarInactiveTintColor: isDark ? '#ffffff' : COLORS.inactive,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 75,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          backgroundColor: colors.tabBar,
          paddingTop: 12,
          paddingBottom: 15,
        },
      }}>
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <CustomTabIcon 
              focused={focused} 
              color={color} 
              iconName="chatbubble-ellipses" 
              label={t('tabs.chat')} 
              badge={<TabBadge count={3} />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <CustomTabIcon 
              focused={focused} 
              color={color} 
              iconName="people" 
              label={t('tabs.contacts')} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <CustomTabIcon 
              focused={focused} 
              color={color} 
              iconName="grid" 
              label="Khám phá" 
              badge={<TabBadge type="dot" />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <CustomTabIcon 
              focused={focused} 
              color={color} 
              iconName="clock-time-four" 
              iconType="mci"
              label={t('tabs.timeline')} 
              badge={<TabBadge count="N" type="n" />}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <CustomTabIcon 
              focused={focused} 
              color={color} 
              iconName="person" 
              label={t('tabs.more')} 
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  iconContainer: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 9, // Hạ tiếp từ 10
    fontWeight: '500',
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  dotBadge: {
    width: 10,
    height: 10,
    right: -4,
    top: 0,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8, // Hạ tiếp từ 9
    fontWeight: 'bold',
  }
});
