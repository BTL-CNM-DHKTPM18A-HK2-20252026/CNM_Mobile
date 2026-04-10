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

const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isEditingHistory, setIsEditingHistory] = useState(false); // Trạng thái Sửa/Xong

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

  const handleUserPress = async (item: SearchResultUser | SearchHistory) => {
    const userId = 'document' in item ? item.document.userId : item.targetId;
    const name = 'document' in item ? item.document.displayName : item.targetName;
    const avatar = 'document' in item ? item.document.avatarUrl : item.targetAvatar;

    if (!userId) return;

    try {
      await api.post('/search/history/click', {
        targetId: userId,
        name: name,
        avatar: avatar,
        type: 'USER'
      });
      loadSearchHistory();
      // Chuyển sang profile hoặc chat tùy logic (router.push(`/user/${userId}`))
    } catch (err) {
      console.error("Lỗi lưu tương tác:", err);
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      // Gọi API xóa theo ID vừa viết ở Backend
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
        
        {/* Dấu X xóa khi ở chế độ chỉnh sửa */}
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
    if (status === 'FRIEND' || status === 'SELF') return null;

    return (
      <TouchableOpacity 
        style={styles.actionButton} 
        onPress={() => {
            if(status === 'PENDING_RECEIVED') {
                // Logic chấp nhận
            } else {
                setSelectedUserForRequest(item);
                setFriendRequestModalVisible(true);
            }
        }}
      >
        <Text style={styles.actionButtonText}>
            {status === 'PENDING_SENT' ? 'Đã gửi' : (status === 'PENDING_RECEIVED' ? 'Đồng ý' : 'Kết bạn')}
        </Text>
      </TouchableOpacity>
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
            
            {results?.users?.content.map((item: SearchResultUser) => (
              <TouchableOpacity key={item.document.userId} style={styles.userRow} onPress={() => handleUserPress(item)}>
                <Image source={getAvatarSource(item.document.avatarUrl)} style={styles.userAvatar} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.document.displayName}</Text>
                  <Text style={styles.userSub}>
                    {item.friendshipStatus === 'SELF' ? 'Bản thân' : (
                      item.friendshipStatus === 'FRIEND' ? 'Bạn bè' : 'Người lạ'
                    )}
                  </Text>
                </View>
                {renderUserAction(item)}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { backgroundColor: '#0084FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  backButton: { padding: 5 },
  searchBar: { flex: 1, flexDirection: 'row', backgroundColor: 'white', borderRadius: 8, marginHorizontal: 10, alignItems: 'center', paddingHorizontal: 10, height: 38 },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: 'black' },
  qrButton: { padding: 5 },
  content: { flex: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  editLink: { color: '#0084FF', fontWeight: '500' },
  historyItem: { width: 75, alignItems: 'center', marginRight: 10 },
  historyAvatarContainer: { width: 56, height: 56, marginBottom: 6, position: 'relative' },
  historyAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEE' },
  deleteBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: 'white', borderRadius: 11 },
  searchIconCircle: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0' },
  historyName: { textAlign: 'center', fontSize: 12, color: '#333' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginBottom: 15 },
  userAvatar: { width: 52, height: 52, borderRadius: 26 },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '500' },
  userSub: { color: '#888', fontSize: 13 },
  actionButton: { backgroundColor: '#E7F3FF', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20 },
  actionButtonText: { color: '#0084FF', fontWeight: '600', fontSize: 13 },
});