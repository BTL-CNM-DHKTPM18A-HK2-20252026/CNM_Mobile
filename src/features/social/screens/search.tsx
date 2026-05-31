import api from '@/services/api';
import { chatService } from '@/services/chatService';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
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

// --- Interfaces ---
interface UserDocument {
  userId: string;
  displayName: string;
  avatarUrl: string;
  email: string;
}

interface SearchResultUser {
  document: UserDocument;
  friendshipStatus: 'FRIEND' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'NONE' | 'SELF';
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

const MAX_FRIEND_MSG_LENGTH = 150;

const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isEditingHistory, setIsEditingHistory] = useState(false);

  // Modal Kết bạn
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

  // Map FriendSearchItem (backend) -> SearchResultUser (mobile)
  const mapFriendItem = (item: any): SearchResultUser => ({
    document: {
      userId: item.userId,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl,
      email: item.phoneNumber || '',
    },
    friendshipStatus:
      item.friendshipStatus === 'ACCEPTED' ? 'FRIEND'
      : item.friendshipStatus === 'PENDING_SENT' ? 'PENDING_SENT'
      : item.friendshipStatus === 'PENDING_RECEIVED' ? 'PENDING_RECEIVED'
      : 'NONE',
  });

  const performGlobalSearch = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/search/global?q=${query}&page=0&size=10`);
      if (res.success) {
        const data = res.data;
        // Merge friends + globalUsers thành 1 list duy nhất (đã loại self, có friendshipStatus)  
        const allUsers = [
          ...(data.friends || []).map(mapFriendItem),
          ...(data.globalUsers || []).map(mapFriendItem),
        ];
        setResults({ ...data, _allUsers: allUsers });
      }
    } catch (err) {
      console.error("Lỗi tìm kiếm:", err);
    } finally {
      setLoading(false);
    }
  };

  // ====== Mở chat private (copy flow từ Web: handleStartP2PChat) ======
  const navigateToPrivateChat = async (userId: string, displayName: string, avatarUrl?: string) => {
    try {
      const res: any = await chatService.getPrivateConversation(userId);
      const convId = res?.conversationId ?? res?.conversation_id ?? res?.data?.conversationId ?? res?.data?.conversation_id;
      if (convId) {
        router.push(`/chat-detail?id=${encodeURIComponent(convId)}&name=${encodeURIComponent(displayName)}`);
      } else {
        Alert.alert('Lỗi', 'Không thể mở cuộc trò chuyện.');
      }
    } catch (err) {
      console.error('Lỗi mở chat private:', err);
      Alert.alert('Lỗi', 'Không thể mở cuộc trò chuyện.');
    }
  };

  // ====== Gửi lời mời kết bạn (copy flow từ Web: AddFriendModal) ======
  const handleSendFriendRequest = async () => {
    if (!selectedUserForRequest) return;
    setIsSubmittingFriendRequest(true);
    try {
      const res: any = await friendService.sendRequest(
        selectedUserForRequest.document.userId,
        friendRequestMessage.trim() || undefined,
      );
      if (res.success) {
        Alert.alert('Thành công', 'Đã gửi lời mời kết bạn!');
        setFriendRequestModalVisible(false);
        setFriendRequestMessage('');
        setSelectedUserForRequest(null);
        // Cập nhật trạng thái trong kết quả tìm kiếm
        if (results?._allUsers) {
          setResults((prev: any) => ({
            ...prev,
            _allUsers: prev._allUsers.map((u: SearchResultUser) =>
              u.document.userId === selectedUserForRequest.document.userId
                ? { ...u, friendshipStatus: 'PENDING_SENT' as const }
                : u
            ),
          }));
        }
      } else {
        Alert.alert('Thông báo', res.message || 'Gửi lời mời thất bại');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error?.response?.data?.message || 'Không thể gửi lời mời kết bạn.');
    } finally {
      setIsSubmittingFriendRequest(false);
    }
  };

  // ====== Chấp nhận lời mời từ kết quả tìm kiếm + auto mở chat (copy flow từ Web: handleAccept) ======
  const handleAcceptFromSearch = async (item: SearchResultUser) => {
    try {
      const res: any = await friendService.acceptRequestBySender(item.document.userId);
      if (res.success) {
        Alert.alert('Thành công', 'Đã chấp nhận lời mời kết bạn!');
        // Cập nhật status thành FRIEND
        if (results?._allUsers) {
          setResults((prev: any) => ({
            ...prev,
            _allUsers: prev._allUsers.map((u: SearchResultUser) =>
              u.document.userId === item.document.userId
                ? { ...u, friendshipStatus: 'FRIEND' as const }
                : u
            ),
          }));
        }
        // Auto mở chat private (giống Web)
        navigateToPrivateChat(item.document.userId, item.document.displayName, item.document.avatarUrl);
      } else {
        Alert.alert('Thông báo', res.message || 'Thao tác thất bại');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error?.message || 'Không thể chấp nhận lời mời.');
    }
  };

  // ====== Thu hồi lời mời đã gửi ======
  const handleRecallRequest = async (item: SearchResultUser) => {
    try {
      const res: any = await friendService.unfriend(item.document.userId);
      if (res.success) {
        Alert.alert('Thành công', 'Đã thu hồi lời mời kết bạn.');
        if (results?._allUsers) {
          setResults((prev: any) => ({
            ...prev,
            _allUsers: prev._allUsers.map((u: SearchResultUser) =>
              u.document.userId === item.document.userId
                ? { ...u, friendshipStatus: 'NONE' as const }
                : u
            ),
          }));
        }
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error?.message || 'Không thể thu hồi lời mời.');
    }
  };

  const handleUserPress = async (item: SearchResultUser | SearchHistory) => {
    const userId = 'document' in item ? item.document.userId : item.targetId;
    const name = 'document' in item ? item.document.displayName : item.targetName;
    const avatar = 'document' in item ? item.document.avatarUrl : item.targetAvatar;

    if (!userId) return;

    // Lưu lịch sử tìm kiếm
    try {
      await api.post('/search/history/click', {
        targetId: userId,
        name: name,
        avatar: avatar,
        type: 'USER'
      });
      loadSearchHistory();
    } catch (err) {
      console.error("Lỗi lưu tương tác:", err);
    }

    // Nếu là bạn bè hoặc bản thân → mở chat private (giống Web)
    if ('document' in item) {
      const status = (item as SearchResultUser).friendshipStatus;
      if (status === 'FRIEND' || status === 'SELF') {
        navigateToPrivateChat(userId, name || 'Chat', avatar);
        return;
      }
    } else {
      // Từ history → mở chat private
      navigateToPrivateChat(userId, name || 'Chat', avatar);
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      const res: any = await api.delete(`/search/history/${id}`);
      if (res.success) {
        setHistory(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error("Lỗi xóa mục lịch sử:", err);
      Alert.alert("Lỗi", "Không thể xóa lịch sử tìm kiếm.");
    }
  };

  const renderHistoryItem = ({ item }: { item: SearchHistory }) => (
    <TouchableOpacity 
      style={styles.historyItem}
      onPress={() => !isEditingHistory && handleUserPress(item)}
      disabled={isEditingHistory}
    >
      <View style={styles.historyAvatarContainer}>
        {item.targetId ? (
          <Image source={getAvatarSource(item.targetAvatar)} style={styles.historyAvatar} />
        ) : (
          <View style={[styles.historyAvatar, styles.searchIconCircle]}>
             <Ionicons name="search" size={24} color="#666" />
          </View>
        )}
        
        {isEditingHistory && (
          <TouchableOpacity 
            style={styles.deleteBadge} 
            onPress={() => handleDeleteHistoryItem(item.id)}
          >
            <Ionicons name="close-circle" size={22} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      <Text numberOfLines={2} style={styles.historyName}>
        {item.targetName || item.query}
      </Text>
    </TouchableOpacity>
  );

  const renderUserAction = (item: SearchResultUser) => {
    const status = item.friendshipStatus;

    if (status === 'SELF') return null;

    // Bạn bè → Nút "Nhắn tin" để mở chat private
    if (status === 'FRIEND') {
      return (
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#E7F3FF' }]}
          onPress={() => navigateToPrivateChat(item.document.userId, item.document.displayName, item.document.avatarUrl)}
        >
          <Text style={styles.actionButtonText}>Nhắn tin</Text>
        </Pressable>
      );
    }

    // Đã gửi lời mời → Thu hồi
    if (status === 'PENDING_SENT') {
      return (
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#F0F2F5' }]}
          onPress={() => handleRecallRequest(item)}
        >
          <Text style={[styles.actionButtonText, { color: '#65676B' }]}>Thu hồi</Text>
        </Pressable>
      );
    }

    // Nhận được lời mời → Đồng ý
    if (status === 'PENDING_RECEIVED') {
      return (
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#E7F3FF' }]}
          onPress={() => handleAcceptFromSearch(item)}
        >
          <Text style={styles.actionButtonText}>Đồng ý</Text>
        </Pressable>
      );
    }

    // Chưa kết bạn → Kết bạn (mở modal)
    return (
      <Pressable
        style={styles.actionButton}
        onPress={() => {
          setSelectedUserForRequest(item);
          setFriendRequestMessage('');
          setFriendRequestModalVisible(true);
        }}
      >
        <Text style={styles.actionButtonText}>Kết bạn</Text>
      </Pressable>
    );
  };

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
              <TouchableOpacity onPress={() => setIsEditingHistory(!isEditingHistory)}>
                <Text style={styles.editLink}>{isEditingHistory ? "Xong" : "Sửa"}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={renderHistoryItem}
              contentContainerStyle={{ paddingLeft: 15 }}
            />
          </View>
        ) : (
          <View style={{ paddingTop: 15 }}>
            {loading && <ActivityIndicator color="#0084FF" style={{ marginTop: 20 }} />}
            
            {results?._allUsers?.map((item: SearchResultUser) => (
              <View key={item.document.userId} style={styles.userRow}>
                <Pressable style={styles.userRowLeft} onPress={() => handleUserPress(item)}>
                  <Image source={getAvatarSource(item.document.avatarUrl)} style={styles.userAvatar} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.document.displayName}</Text>
                    <Text style={styles.userSub}>
                      {item.friendshipStatus === 'FRIEND' ? 'Bạn bè' : (
                        item.friendshipStatus === 'PENDING_SENT' ? 'Đã gửi lời mời' : (
                          item.friendshipStatus === 'PENDING_RECEIVED' ? 'Muốn kết bạn' : 'Người lạ'
                        )
                      )}
                    </Text>
                  </View>
                </Pressable>
                {renderUserAction(item)}
              </View>
            ))}

            {results?.messages?.content?.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.sectionTitle2}>Tin nhắn</Text>
                {results.messages.content.map((msg: { document: MessageDocument }) => (
                  <TouchableOpacity
                    key={msg.document.messageId}
                    style={styles.userRow}
                    onPress={() =>
                      router.push(
                        `/chat-detail?id=${encodeURIComponent(msg.document.conversationId)}&name=${encodeURIComponent(msg.document.senderName)}`
                      )
                    }
                  >
                    <Image source={getAvatarSource(msg.document.senderAvatar)} style={styles.userAvatar} />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{msg.document.senderName}</Text>
                      <Text style={styles.userSub} numberOfLines={1}>{msg.document.content}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ====== Modal Gửi Lời Mời Kết Bạn (copy flow từ Web: AddFriendModal) ====== */}
      <Modal
        visible={friendRequestModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFriendRequestModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gửi lời mời kết bạn</Text>
              <TouchableOpacity onPress={() => { setFriendRequestModalVisible(false); setSelectedUserForRequest(null); }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Thông tin user */}
            {selectedUserForRequest && (
              <View style={styles.modalUserInfo}>
                <Image
                  source={getAvatarSource(selectedUserForRequest.document.avatarUrl)}
                  style={styles.modalAvatar}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.modalUserName}>{selectedUserForRequest.document.displayName}</Text>
                  <Text style={styles.modalUserEmail}>{selectedUserForRequest.document.email}</Text>
                </View>
              </View>
            )}

            {/* Nhập lời nhắn */}
            <Text style={styles.modalLabel}>Lời nhắn (tùy chọn)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Xin chào, mình muốn kết bạn với bạn!"
              placeholderTextColor="#999"
              value={friendRequestMessage}
              onChangeText={(text) => {
                if (text.length <= MAX_FRIEND_MSG_LENGTH) setFriendRequestMessage(text);
              }}
              multiline
              maxLength={MAX_FRIEND_MSG_LENGTH}
            />
            <Text style={styles.modalCharCount}>
              {friendRequestMessage.length}/{MAX_FRIEND_MSG_LENGTH}
            </Text>

            {/* Nút gửi */}
            <TouchableOpacity
              style={[styles.modalSendButton, isSubmittingFriendRequest && { opacity: 0.6 }]}
              onPress={handleSendFriendRequest}
              disabled={isSubmittingFriendRequest}
            >
              {isSubmittingFriendRequest ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSendButtonText}>Gửi lời mời</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { backgroundColor: '#0084FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  backButton: { padding: 5 },
  searchBar: { flex: 1, flexDirection: 'row', backgroundColor: 'white', borderRadius: 8, marginHorizontal: 10, alignItems: 'center', paddingHorizontal: 10, height: 36 },
  searchIcon: { marginRight: 6 },
  input: { flex: 1, fontSize: 14, color: 'black', paddingVertical: 0, height: 36 },
  qrButton: { padding: 5 },
  content: { flex: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  sectionTitle2: { fontSize: 14, fontWeight: '600', color: '#333', paddingHorizontal: 15, marginBottom: 10 },
  editLink: { color: '#0084FF', fontWeight: '500' },
  historyItem: { width: 75, alignItems: 'center', marginRight: 10 },
  historyAvatarContainer: { width: 56, height: 56, marginBottom: 6, position: 'relative' },
  historyAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEE' },
  deleteBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: 'white', borderRadius: 11 },
  searchIconCircle: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0' },
  historyName: { textAlign: 'center', fontSize: 12, color: '#333' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginBottom: 15 },
  userRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  userAvatar: { width: 52, height: 52, borderRadius: 26 },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '500' },
  userSub: { color: '#888', fontSize: 13 },
  actionButton: { backgroundColor: '#E7F3FF', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20 },
  actionButtonText: { color: '#0084FF', fontWeight: '600', fontSize: 13 },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  modalContainer: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  modalUserInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, padding: 10, backgroundColor: '#F8F9FA', borderRadius: 10 },
  modalAvatar: { width: 40, height: 40, borderRadius: 20 },
  modalUserName: { fontSize: 15, fontWeight: '600', color: '#333' },
  modalUserEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  modalLabel: { fontSize: 13, fontWeight: '500', color: '#333', marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 10, fontSize: 14, color: '#333', minHeight: 50, textAlignVertical: 'top' },
  modalCharCount: { fontSize: 11, color: '#999', textAlign: 'right', marginTop: 4, marginBottom: 12 },
  modalSendButton: { backgroundColor: '#0084FF', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalSendButtonText: { color: 'white', fontSize: 15, fontWeight: '600' },
});