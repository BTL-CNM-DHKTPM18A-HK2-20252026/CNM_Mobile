import api from '@/services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendService } from '@/services/friendService';
import { getAvatarSource } from '@/services/mediaUtils';

// Interface cập nhật khớp với Backend thực tế
interface UserDocument {
  userId: string;
  displayName: string;
  avatarUrl: string;
  email: string;
}

interface SearchResultUser {
  document: UserDocument;
  friendshipStatus: 'FRIEND' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'NONE' | 'SELF';
  highlights?: any;
}

interface MessageDocument {
  messageId: string;
  content: string;
  senderName: string;
  senderAvatar: string;
  conversationId: string;
}

interface SearchHistory {
  id: string;
  query?: string;
  targetId?: string;
  targetName?: string;
  targetAvatar?: string;
  targetType?: string;
}

const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [friendRequestModalVisible, setFriendRequestModalVisible] = useState(false);
  const [selectedUserForRequest, setSelectedUserForRequest] = useState<SearchResultUser | null>(null);
  const [friendRequestMessage, setFriendRequestMessage] = useState('');
  const [isSubmittingFriendRequest, setIsSubmittingFriendRequest] = useState(false);

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const res: any = await api.get('/search/history?limit=15');
      if (res.success) {
        setHistory(res.data);
      }
    } catch (err) {
      console.error("Lỗi lấy lịch sử:", err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 1) {
        performGlobalSearch();
      } else {
        setResults(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const performGlobalSearch = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/search/global?q=${query}&page=0&size=10`);
      if (res.success) {
        setResults(res.data);
      }
    } catch (err) {
      console.error("Lỗi tìm kiếm:", err);
    } finally {
      setLoading(false);
    }
  };

  // Hàm xử lý khi nhấn vào một người dùng (Lưu lịch sử + Chuyển trang)
  const handleUserPress = async (item: SearchResultUser) => {
    const user = item.document;
    try {
      // Gọi API lưu tương tác
      await api.post('/search/history/click', {
        targetId: user.userId,
        name: user.displayName,
        avatar: user.avatarUrl,
        type: 'USER'
      });
      
      // Load lại lịch sử để cập nhật danh sách "vừa tìm"
      loadSearchHistory();

      // Chuyển hướng sang trang chat
      // router.push(`/chat/${user.userId}`);
    } catch (err) {
      console.error("Lỗi lưu tương tác:", err);
    }
  };

  const updateUserFriendshipStatus = (userId: string, status: SearchResultUser['friendshipStatus']) => {
    setResults((current: any) => {
      if (!current?.users?.content) return current;
      return {
        ...current,
        users: {
          ...current.users,
          content: current.users.content.map((item: SearchResultUser) =>
            item.document.userId === userId ? { ...item, friendshipStatus: status } : item
          ),
        },
      };
    });
  };

  const handleSendFriendRequest = async (item: SearchResultUser) => {
    setSelectedUserForRequest(item);
    setFriendRequestMessage('');
    setFriendRequestModalVisible(true);
  };

  const handleSubmitFriendRequest = async () => {
    if (!selectedUserForRequest) return;
    
    setIsSubmittingFriendRequest(true);
    try {
      const res: any = await friendService.sendRequest(
        selectedUserForRequest.document.userId,
        friendRequestMessage || undefined
      );
      if (res.success) {
        updateUserFriendshipStatus(selectedUserForRequest.document.userId, 'PENDING_SENT');
        Alert.alert('Thành công', 'Đã gửi lời mời kết bạn.');
        setFriendRequestModalVisible(false);
        setSelectedUserForRequest(null);
        setFriendRequestMessage('');
      }
    } catch (err) {
      console.error('Lỗi gửi lời mời:', err);
      Alert.alert('Lỗi', 'Không thể gửi lời mời kết bạn.');
    } finally {
      setIsSubmittingFriendRequest(false);
    }
  };

  const handleAcceptFriendRequest = async (item: SearchResultUser) => {
    try {
      const res: any = await friendService.acceptRequestBySender(item.document.userId);
      if (res.success) {
        updateUserFriendshipStatus(item.document.userId, 'FRIEND');
        Alert.alert('Thành công', 'Đã chấp nhận lời mời kết bạn.');
      }
    } catch (err) {
      console.error('Lỗi chấp nhận lời mời:', err);
      Alert.alert('Lỗi', 'Không thể chấp nhận lời mời kết bạn.');
    }
  };

  // Render nút hành động dựa trên trạng thái quan hệ
  const renderUserAction = (item: SearchResultUser) => {
    console.log(item);
    const status = item.friendshipStatus;
    if (status === 'FRIEND' || status === 'SELF') return null;

    if (status === 'PENDING_SENT') {
      return (
        <View style={[styles.actionButton, { backgroundColor: '#F0F0F0' }]}> 
          <Text style={{ color: '#888', fontWeight: '600' }}>Đã gửi</Text>
        </View>
      );
    }
    if (status === 'PENDING_RECEIVED') {
      return (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#0084FF' }]}
          onPress={() => handleAcceptFriendRequest(item)}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Đồng ý</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={styles.actionButton} onPress={() => handleSendFriendRequest(item)}>
        <Text style={styles.actionButtonText}>Kết bạn</Text>
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = ({ item }: { item: SearchHistory }) => (
    <TouchableOpacity style={styles.historyItem}>
      <View style={styles.historyAvatarContainer}>
        {item.targetId ? (
          <Image source={getAvatarSource(item.targetAvatar)} style={styles.historyAvatar} />
        ) : (
          <View style={[styles.historyAvatar, styles.searchIconCircle]}>
             <Ionicons name="search" size={24} color="#666" />
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={styles.historyName}>
        {item.targetName || item.query}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0084FF" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Tìm kiếm"
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => router.push('/qr-scan')}>
            <MaterialCommunityIcons name="qrcode-scan" size={22} color="#fff" style={styles.qrButton} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {query.length === 0 ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Liên hệ đã tìm</Text>
              <TouchableOpacity><Text style={styles.editLink}>Sửa</Text></TouchableOpacity>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={renderHistoryItem}
              contentContainerStyle={{ paddingLeft: 15 }}
            />
            <TouchableOpacity style={styles.manageHistory}>
              <Text style={styles.manageHistoryText}>Quản lý lịch sử tìm kiếm {'>'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {loading && <ActivityIndicator color="#0084FF" style={{ marginTop: 20 }} />}
            
            {results?.users?.content.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>Liên hệ ({results.users.totalElements})</Text>
                {results.users.content.map((item: SearchResultUser) => (
                  <TouchableOpacity 
                    key={item.document.userId} 
                    style={styles.userRow}
                    onPress={() => handleUserPress(item)}
                  >
                    <Image source={getAvatarSource(item.document.avatarUrl)} style={styles.userAvatar} />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.document.displayName}</Text>
                      <Text style={styles.userSub}>
                        {item.friendshipStatus === 'FRIEND' ? 'Bạn bè' : 'Người lạ'}
                      </Text>
                    </View>
                    {renderUserAction(item)}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.seeMore}><Text style={styles.seeMoreText}>Xem thêm ∨</Text></TouchableOpacity>
              </View>
            )}

            {results?.messages?.content.length > 0 && (
              <View style={[styles.resultSection, { borderTopWidth: 8, borderColor: '#F2F2F2' }]}>
                <Text style={styles.resultSectionTitle}>Tin nhắn ({results.messages.totalElements})</Text>
                {results.messages.content.map((msg: MessageDocument) => (
                  <TouchableOpacity key={msg.messageId} style={styles.messageRow}>
                    <Image source={getAvatarSource(msg.senderAvatar)} style={styles.msgAvatar} />
                    <View style={styles.msgInfo}>
                      <Text style={styles.msgName}>{msg.senderName}</Text>
                      <Text numberOfLines={1} style={styles.msgContent}>{msg.content}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal Kết Bạn */}
      <Modal
        visible={friendRequestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isSubmittingFriendRequest) setFriendRequestModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedUserForRequest && (
              <>
                <Text style={styles.modalTitle}>Gửi lời mời kết bạn</Text>
                
                {/* Avatar và tên người nhận lời mời */}
                <View style={styles.modalUserSection}>
                  <Image
                    source={getAvatarSource(selectedUserForRequest.document.avatarUrl)}
                    style={styles.modalAvatar}
                  />
                  <Text style={styles.modalUserName}>
                    {selectedUserForRequest.document.displayName}
                  </Text>
                </View>

                {/* Ô nhập tin nhắn */}
                <View style={styles.modalInputSection}>
                  <Text style={styles.modalInputLabel}>Tin nhắn (tùy chọn)</Text>
                  <TextInput
                    style={styles.modalMessageInput}
                    placeholder="Nhập tin nhắn..."
                    placeholderTextColor="#999"
                    value={friendRequestMessage}
                    onChangeText={setFriendRequestMessage}
                    multiline
                    maxLength={500}
                    editable={!isSubmittingFriendRequest}
                  />
                  <Text style={styles.charCount}>
                    {friendRequestMessage.length}/500
                  </Text>
                </View>

                {/* Nút hành động */}
                <View style={styles.modalButtonGroup}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      if (!isSubmittingFriendRequest) setFriendRequestModalVisible(false);
                    }}
                    disabled={isSubmittingFriendRequest}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.submitButton]}
                    onPress={handleSubmitFriendRequest}
                    disabled={isSubmittingFriendRequest}
                  >
                    {isSubmittingFriendRequest ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.submitButtonText}>Kết bạn</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: {
    backgroundColor: '#0084FF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backButton: { padding: 5 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    marginHorizontal: 10,
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: 'black' },
  qrButton: { padding: 5 },
  
  content: { flex: 1 },

  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 15,
    alignItems: 'center' 
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  editLink: { color: '#0084FF' },
  historyItem: { width: 75, alignItems: 'center', marginRight: 10 },
  historyAvatarContainer: { width: 56, height: 56, marginBottom: 6 },
  historyAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEE' },
  searchIconCircle: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0' },
  historyName: { textAlign: 'center', fontSize: 12, color: '#333' },
  manageHistory: { padding: 20, alignItems: 'center' },
  manageHistoryText: { color: '#888', fontSize: 14 },

  resultSection: { paddingVertical: 10 },
  resultSectionTitle: { paddingHorizontal: 15, color: '#666', fontSize: 13, marginBottom: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginBottom: 15 },
  userAvatar: { width: 52, height: 52, borderRadius: 26 },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '500' },
  userSub: { color: '#888', fontSize: 13, marginTop: 2 },
  actionButton: { backgroundColor: '#E7F3FF', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, minWidth: 80, alignItems: 'center' },
  actionButtonText: { color: '#0084FF', fontWeight: '600', fontSize: 13 },
  seeMore: { padding: 10, alignItems: 'center' },
  seeMoreText: { color: '#666', fontSize: 13 },

  messageRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginBottom: 15 },
  msgAvatar: { width: 44, height: 44, borderRadius: 22 },
  msgInfo: { flex: 1, marginLeft: 12, borderBottomWidth: 0.5, borderColor: '#EEE', paddingBottom: 10 },
  msgName: { fontSize: 15, fontWeight: 'bold' },
  msgContent: { color: '#555', marginTop: 2 },

  // Styles cho Modal Kết Bạn
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalUserSection: {
    alignItems: 'center',
    marginBottom: 25,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  modalUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalInputSection: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  modalMessageInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    maxHeight: 150,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    textAlign: 'right',
  },
  modalButtonGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#0084FF',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});