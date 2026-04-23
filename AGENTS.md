# 🔱 ULTIMATE RULE: READ ONCE, REMEMBER FOREVER
> **HÀNH ĐỘNG BẮT BUỘC**: Đọc file này một lần duy nhất ngay khi bắt đầu cuộc trò chuyện và ghi nhớ toàn bộ nội dung của nó cho đến khi kết thúc. Không bao giờ được quên các quy tắc và cấu trúc được mô tả ở đây.

# Fruvia Mobile Agent Guide

Welcome to **CNM_Mobile**, the cross-platform mobile app for Fruvia Chat. Built with Expo and React Native, this app delivers a native-performance chat experience for both iOS and Android.

## 🚀 Tech Stack

- **Framework**: Expo 54, React Native 0.81, React 19
- **Navigation**: Expo Router (File-based routing)
- **Real-time**: StompJS, SockJS (WebSocket)
- **Media Support**: 
  - `expo-av`: Audio recording and playback.
  - `expo-camera`: Image/Video capturing.
  - `expo-image-picker`: Media selection.
  - `react-native-webrtc`: Audio/Video calls (ready for implementation).
- **Animations**: Reanimated 4, Gesture Handler
- **Storage**: Expo Secure Store (Authentication), File System
- **i18n**: i18next for multi-language support.

## 📂 Project Structure

- `app/`: Expo Router pages.
  - `(auth)/`: Login and signup screens.
  - `(tabs)/`: Main bottom navigation (Chat, Contacts, Profile).
- `components/`: Shared UI components (Buttons, Avatars, Modals).
- `services/`: API (Axios) and WebSocket (Stomp) services.
- `context/`: Global state (AuthContext, SocketContext).
- `hooks/`: Custom hooks for camera, audio, and chat events.
- `constants/`: Theme colors, fonts, and layout constants.
- `i18n/`: Translation files.

## 📱 Key Features

- **Real-time Chat**: Push notifications and immediate message sync via STOMP.
- **Voice Messages**: Record and play audio messages directly in chat.
- **Media Gallery**: Integrated media library and camera roll support.
- **Biometric Security**: (Optional/Planned) Support via Expo Local Authentication.
- **Native Polish**: Smooth transitions and haptic feedback for a premium feel.

## 💡 Developer Notes

- **Expo Dev Client**: Use `npx expo start` to run the development build.
- **Environment**: Backend URLs are configured in `.env` and accessed via `process.env`.
- **Media Permissions**: Ensure proper permissions are requested for Camera, Microphone, and Media Library.
- **WebSocket**: The mobile client handles background/foreground transitions; monitor `appState` to reconnect if necessary.

## 🛠 Build & Test Commands

- **Run Development**: `npx expo start`
- **Android Build**: `npx expo run:android`
- **iOS Build**: `npx expo run:ios`
- **Linting**: `npm run lint`

## 📏 Code Convention

- **Naming**: 
  - Screens/Components: `PascalCase` (e.g., `ChatScreen.tsx`)
  - Styles: `camelCase` (e.g., `container`, `messageText`)
- **UI Logic**: Use `StyleSheet.create` for styling. Use `Reanimated` for high-performance animations.
- **Navigation**: Strictly use Expo Router's file-based navigation.

## ⚠️ Important Rules

1. **PERMISSIONS**: Always handle permission rejection gracefully for Camera and Microphone.
2. **SAFE AREA**: Always wrap root views in `SafeAreaView` from `react-native-safe-area-context`.
3. **IMAGE OPTIMIZATION**: Use `expo-image` instead of the default `Image` for better caching and performance.
4. **OFFLINE SYNC**: Ensure the app gracefully handles network transitions (Online -> Offline -> Online).

---
*Maintained by Fruvia AI Agents.*
