import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    FlatList,
    StatusBar,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { COLORS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { friendService } from '@/services/friendService';
import { chatService } from '@/services/chatService';
import { getAvatarSource } from '@/services/mediaUtils';

interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data: T;
}

// Interface cho FriendRequest
interface FriendRequest {
    requestId: string;
    senderId: string;
    senderName: string;
    senderAvatarUrl?: string;
    receiverId: string;
    receiverName: string;
    receiverAvatarUrl?: string;
    status: string;
    message?: string;
    createdAt: string;
}

export default function FriendRequestsScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
    const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
    const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());

    // Fetch dữ liệu từ API với Type Casting
    const fetchRequests = async () => {
        try {
            setRefreshing(true);

            // Ép kiểu trực tiếp kết quả trả về sang ApiResponse
            const [receivedRes, sentRes] = await Promise.all([
                friendService.getReceivedRequests() as unknown as ApiResponse<FriendRequest[]>,
                friendService.getSentRequests() as unknown as ApiResponse<FriendRequest[]>,
            ]);

            if (receivedRes.success) {
                setReceivedRequests(receivedRes.data || []);
            }
            if (sentRes.success) {
                setSentRequests(sentRes.data || []);
            }
        } catch (error) {
            console.error('Error fetching friend requests:', error);
            Alert.alert('Lỗi', 'Không thể tải danh sách lời mời kết bạn');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    // Hàm xử lý hành động (Chấp nhận/Từ chối/Thu hồi)
    const handleAction = async (requestId: string, actionType: 'accept' | 'reject' | 'recall', senderInfo?: { senderId: string; senderName: string; senderAvatarUrl?: string }) => {
        if (processingRequests.has(requestId)) return;

        setProcessingRequests(prev => new Set(prev).add(requestId));
        try {
            let res: ApiResponse;

            if (actionType === 'accept') {
                res = await friendService.acceptRequest(requestId) as unknown as ApiResponse;
            } else if (actionType === 'reject') {
                res = await friendService.rejectRequest(requestId) as unknown as ApiResponse;
            } else {
                // Thu hồi (Dùng unfriend theo logic cũ của bạn)
                res = await friendService.unfriend(requestId) as unknown as ApiResponse;
            }

            if (res.success) {
                fetchRequests(); // Tải lại danh sách

                // Auto mở chat private sau khi chấp nhận (giống Web: handleAccept → onSelectUser)
                if (actionType === 'accept' && senderInfo) {
                    try {
                        const convRes: any = await chatService.getPrivateConversation(senderInfo.senderId);
                        const convId = convRes?.conversationId ?? convRes?.conversation_id ?? convRes?.data?.conversationId ?? convRes?.data?.conversation_id;
                        if (convId) {
                            router.push(`/chat-detail?id=${encodeURIComponent(convId)}&name=${encodeURIComponent(senderInfo.senderName)}`);
                        }
                    } catch (chatErr) {
                        console.error('Lỗi mở chat sau khi chấp nhận:', chatErr);
                    }
                }
            } else {
                Alert.alert('Thông báo', res.message || 'Thao tác thất bại');
            }
        } catch (error) {
            console.error(`Error ${actionType} request:`, error);
            Alert.alert('Lỗi', 'Đã có lỗi xảy ra trong quá trình xử lý');
        } finally {
            setProcessingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(requestId);
                return newSet;
            });
        }
    };

    const renderItem = ({ item }: { item: FriendRequest }) => {
        const isReceived = activeTab === 'received';
        const displayName = isReceived ? item.senderName : item.receiverName;
        const avatarUrl = isReceived ? item.senderAvatarUrl : item.receiverAvatarUrl;

        const displayAvatarSource = getAvatarSource(avatarUrl);

        const date = new Date(item.createdAt).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
        });

        return (
            <View style={[styles.requestItem, { backgroundColor: colors.card }]}>
                <Image
                    source={displayAvatarSource}
                    style={styles.avatar}
                />
                <View style={styles.infoContainer}>
                    <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
                    <Text style={[styles.date, { color: colors.textSecondary }]}>{date}</Text>
                    {item.message ? (
                        <Text style={[styles.requestMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                            "{item.message}"
                        </Text>
                    ) : null}

                    <View style={styles.buttonRow}>
                        {isReceived ? (
                            <>
                                <TouchableOpacity
                                    style={[styles.button, { backgroundColor: isDark ? colors.border : '#f0f2f5' }]}
                                    onPress={() => handleAction(item.requestId, 'reject')}
                                    disabled={processingRequests.has(item.requestId)}
                                >
                                    <Text style={[styles.buttonText, { color: colors.text }]}>
                                        {processingRequests.has(item.requestId) ? '...' : 'TỪ CHỐI'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, { backgroundColor: '#e7f3ff' }]}
                                    onPress={() => handleAction(item.requestId, 'accept', {
                                        senderId: item.senderId,
                                        senderName: item.senderName,
                                        senderAvatarUrl: item.senderAvatarUrl,
                                    })}
                                    disabled={processingRequests.has(item.requestId)}
                                >
                                    <Text style={[styles.buttonText, { color: '#0068ff' }]}>
                                        {processingRequests.has(item.requestId) ? '...' : 'ĐỒNG Ý'}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: isDark ? colors.border : '#f0f2f5', flex: 1 }]}
                                onPress={() => handleAction(item.requestId, 'recall')}
                                disabled={processingRequests.has(item.requestId)}
                            >
                                <Text style={[styles.buttonText, { color: colors.text }]}>
                                    {processingRequests.has(item.requestId) ? '...' : 'THU HỒI'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" translucent />

            {/* Header đồng bộ phong cách chat.tsx */}
            <View style={{
                backgroundColor: isDark ? colors.header : COLORS.primary,
                paddingTop: insets.top,
                flexDirection: 'row',
                alignItems: 'center',
                height: insets.top + 56,
                paddingHorizontal: 15,
            }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Lời mời kết bạn</Text>
                <TouchableOpacity style={{ marginLeft: 'auto' }}>
                    <Ionicons name="settings-outline" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Tabs Đã nhận / Đã gửi */}
            <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={() => setActiveTab('received')}
                    style={[styles.tabItem, activeTab === 'received' && { borderBottomColor: isDark ? colors.text : '#000', borderBottomWidth: 2 }]}
                >
                    <Text style={[styles.tabLabel, { color: activeTab === 'received' ? (isDark ? colors.text : '#000') : colors.textSecondary }]}>
                        Đã nhận {receivedRequests.length}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('sent')}
                    style={[styles.tabItem, activeTab === 'sent' && { borderBottomColor: isDark ? colors.text : '#000', borderBottomWidth: 2 }]}
                >
                    <Text style={[styles.tabLabel, { color: activeTab === 'sent' ? (isDark ? colors.text : '#000') : colors.textSecondary }]}>
                        Đã gửi {sentRequests.length}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Danh sách lời mời */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'received' ? receivedRequests : sentRequests}
                    keyExtractor={(item) => item.requestId}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshing={refreshing}
                    onRefresh={fetchRequests}
                    ListEmptyComponent={() => (
                        <View style={styles.centerContainer}>
                            <Text style={{ color: colors.textSecondary }}>
                                {activeTab === 'received' ? 'Không có lời mời kết bạn nào' : 'Không có lời mời đã gửi nào'}
                            </Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '500',
        marginLeft: 20,
    },
    tabBar: {
        flexDirection: 'row',
        height: 48,
        borderBottomWidth: 0.5,
    },
    tabItem: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 20,
    },
    requestItem: {
        flexDirection: 'row',
        padding: 15,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    infoContainer: {
        flex: 1,
        marginLeft: 15,
    },
    name: {
        fontSize: 16,
        fontWeight: '500',
    },
    date: {
        fontSize: 12,
        marginTop: 2,
        marginBottom: 4,
    },
    requestMessage: {
        fontSize: 13,
        fontStyle: 'italic',
        marginBottom: 8,
    },
    buttonRow: {
        flexDirection: 'row',
    },
    button: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 10,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
});