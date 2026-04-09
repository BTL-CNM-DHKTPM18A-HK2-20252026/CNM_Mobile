import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import '@/i18n';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

function RootLayoutContent() {
  const { isDark } = useTheme();

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
        <Stack.Screen name="qr-scan" />
        <Stack.Screen name="search" />
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
