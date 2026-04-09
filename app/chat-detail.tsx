import { COLORS } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { chatService } from '@/services/chatService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
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
  messageId: string;
  content: string;
  senderId: string;
  sender: 'user' | 'other';
  createdAt: string;
  senderName?: string;
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const { messages, setMessages, sendMessage, isTyping, isConnected } = useChatWebSocket(id);

  useEffect(() => {
    const getUserId = async () => {
      const uid = await SecureStore.getItemAsync('user_id');
      setCurrentUserId(uid);
    };
    getUserId();
    loadMessages();
  }, [id]);

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const response = await chatService.getMessages(id, 0, 50);
      const data = Array.isArray(response)
        ? response
        : response?.content ?? [];
      const normalizedMessages = normalizeMessages(data);
      setMessages(normalizedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const normalizeMessages = (data: any[]): Message[] => {
    return data.map((msg) => ({
      messageId: msg.messageId,
      content: msg.content,
      senderId: msg.senderId,
      sender: msg.senderId === currentUserId ? 'user' : 'other',
      createdAt: msg.createdAt,
      senderName: msg.senderName || 'Unknown',
    }));
  };

  const handleSendMessage = () => {
    if (inputText.trim() === '') return;

    sendMessage(inputText.trim());
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
          {item.content}
        </Text>
      </View>
      <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
        {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
      </Text>
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
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {isConnected ? (isTyping ? 'Đang nhập...' : 'Đang hoạt động') : 'Đang kết nối...'}
          </Text>
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
        keyExtractor={(item) => item.messageId}
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
