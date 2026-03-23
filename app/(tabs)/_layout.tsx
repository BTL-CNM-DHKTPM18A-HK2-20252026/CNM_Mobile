import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { HapticTab } from '@/components/common/HapticTab';
import { COLORS } from '@/constants/theme';
import { View, Text, StyleSheet } from 'react-native';

const TabBadge = ({ count, type = 'number' }: { count?: string | number, type?: 'number' | 'dot' | 'n' }) => {
  if (!count && type !== 'dot') return null;
  
  return (
    <View style={[styles.badge, type === 'dot' && styles.dotBadge]}>
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
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary, 
        tabBarInactiveTintColor: COLORS.inactive,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 75,
          borderTopWidth: 1,
          borderTopColor: '#f2f2f2',
          elevation: 0,
          backgroundColor: '#fff',
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
              label="Tin nhắn" 
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
              label="Danh bạ" 
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
              label="Nhật ký" 
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
              label="Cá nhân" 
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
    fontSize: 10,
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
    fontSize: 9,
    fontWeight: 'bold',
  }
});
