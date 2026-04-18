import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import '@/i18n';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import { authService } from '@/services/authService';

const AUTH_ROUTES = new Set(['index', 'login', 'password', 'forgot-password', 'register']);

function RootLayoutContent() {
  const { isDark } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let isMounted = true;

    const guardRoutes = async () => {
      const authenticated = await authService.isAuthenticated();
      if (!isMounted) {
        return;
      }

      const rootSegment = (segments[0] as string | undefined) ?? 'index';
      const isAuthRoute = AUTH_ROUTES.has(rootSegment);

      // Logged-in users should never stay on auth stack screens.
      if (authenticated && isAuthRoute) {
        router.replace('/(tabs)/chat');
        return;
      }

      // Logged-out users must not access non-auth routes.
      if (!authenticated && !isAuthRoute) {
        router.replace('/');
      }
    };

    void guardRoutes();

    return () => {
      isMounted = false;
    };
  }, [router, segments]);

  return (
    <NavigationProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="password" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="chat-detail" />
        <Stack.Screen name="qr-scan" />
        <Stack.Screen name="search" />
        <Stack.Screen name="friend-requests" />
        <Stack.Screen name="create-group" />
      </Stack>
      <StatusBar style={isDark ? "light" : "dark"} />
    </NavigationProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}
