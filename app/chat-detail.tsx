import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'other';
  timestamp: string;
  senderName?: string;
}

const MOCK_MESSAGES: Message[] = [
  { id: '1', text: 'Dạ thưa cô em tên là Nguyễn Thị Thái Hòa', sender: 'other', timestamp: '10:30', senderName: 'Nguyễn Thị Thái Hòa' },
  { id: '2', text: 'Chào em! Rất vui được gặp', sender: 'user', timestamp: '10:31' },
  { id: '3', text: 'Em mới vào lớp tuần này ạ', sender: 'other', timestamp: '10:32', senderName: 'Nguyễn Thị Thái Hòa' },
  { id: '4', text: 'Chào mừng em tới lớp 😊', sender: 'user', timestamp: '10:33' },
  { id: '5', text: 'Cảm ơn chị 😊', sender: 'other', timestamp: '10:34', senderName: 'Nguyễn Thị Thái Hòa' },
  { id: '6', text: 'Nếu em có thắc mắc gì hãy hỏi chị nhé', sender: 'user', timestamp: '10:35' },
];

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (inputText.trim() === '') return;

    const newMessage: Message = {
      id: (messages.length + 1).toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...messages, newMessage]);
    setInputText('');
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.sender === 'user' ? styles.userMessage : styles.otherMessage
    ]}>
      {item.sender === 'other' && (
        <Text style={[styles.senderName, { color: colors.textSecondary }]}>{item.senderName}</Text>
      )}
      <View style={[
        styles.messageBubble,
        item.sender === 'user'
          ? { backgroundColor: COLORS.primary }
          : { backgroundColor: colors.card }
      ]}>
        <Text style={[
          styles.messageText,
          item.sender === 'user'
            ? { color: '#fff' }
            : { color: colors.text }
        ]}>
          {item.text}
        </Text>
      </View>
      <Text style={[styles.timestamp, { color: colors.textSecondary }]}>{item.timestamp}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right', 'top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Đang hoạt động</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="call" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="videocam" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        scrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      />

      {/* Input Area */}
      <SafeAreaView style={[styles.inputArea, { backgroundColor: colors.background, borderTopColor: colors.border }]} edges={['left', 'right', 'bottom']}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border, maxHeight: 100 }]}
          placeholder={t('chat.search')}
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: inputText.trim() ? COLORS.primary : colors.border }]}
          onPress={handleSendMessage}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  headerSubtitle: { fontSize: 12 },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerIcon: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  messagesList: { paddingHorizontal: 12, paddingVertical: 16, flexGrow: 1, justifyContent: 'flex-end' },
  messageContainer: { marginBottom: 8 },
  userMessage: { alignItems: 'flex-end' },
  otherMessage: { alignItems: 'flex-start' },
  senderName: { fontSize: 11, marginBottom: 4, marginLeft: 8 },
  messageBubble: { maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  messageText: { fontSize: 14 },
  timestamp: { fontSize: 11, marginTop: 2 },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, gap: 8 },
  attachButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 14 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
