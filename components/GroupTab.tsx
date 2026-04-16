import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Image,
	ActivityIndicator,
	RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { COLORS } from '@/constants/theme';
import { chatService } from '@/services/chatService';
import { getAvatarSource } from '@/services/mediaUtils';
import { router, useFocusEffect } from 'expo-router';

type GroupItem = {
	id: string;
	name: string;
	preview: string;
	time: string;
	unreadCount?: number;
	updatedAt: number;
	members: Array<{
		key: string;
		label: string;
		color: string;
		avatarUrl?: string | null;
	}>;
};

const WEEK_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const AVATAR_COLORS = ['#EAF4FF', '#FDE9E7', '#E8F5E9', '#FFF4DF', '#F4EBFF', '#E7F0FF'];

type ConversationMember = {
	userId?: string;
	user_id?: string;
	id?: string;
	displayName?: string;
	display_name?: string;
	fullName?: string;
	full_name?: string;
	avatarUrl?: string;
	avatar_url?: string;
};

type ConversationRaw = {
	conversationId?: string;
	id?: string;
	conversationType?: string;
	type?: string;
	kind?: string;
	conversationName?: string;
	name?: string;
	lastMessageContent?: string;
	lastMessage?: string;
	preview?: string;
	snippet?: string;
	lastMessageSenderName?: string;
	lastMessageTime?: string;
	updatedAt?: string;
	lastUpdated?: string;
	time?: string;
	unreadCount?: number;
	unread?: number;
	members?: ConversationMember[];
	conversationAvatarUrl?: string;
	conversation_avatar_url?: string;
	avatarUrl?: string;
	avatar_url?: string;
};

function toTimeText(value: unknown): string {
	if (!value) return 'Mới';

	const parsed = new Date(value as string);
	if (Number.isNaN(parsed.getTime())) return 'Mới';

	const now = new Date();
	const diffMs = now.getTime() - parsed.getTime();
	const diffMinutes = Math.floor(diffMs / 60000);

	if (diffMinutes < 1) return 'Mới';
	if (diffMinutes < 60) return `${diffMinutes} phút`;

	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours} giờ`;

	const dayDiff = Math.floor(diffHours / 24);
	if (dayDiff < 7) return WEEK_DAYS[parsed.getDay()];

	return parsed.toLocaleDateString('vi-VN', {
		day: '2-digit',
		month: '2-digit',
	});
}

function getMemberLabel(member: ConversationMember, fallback: string): string {
	const fullName =
		member.displayName ??
		member.display_name ??
		member.fullName ??
		member.full_name ??
		fallback;

	if (!fullName.trim()) return '?';
	return fullName.trim().charAt(0).toUpperCase();
}

function normalizeGroupConversations(rawData: ConversationRaw[]): GroupItem[] {
	if (!Array.isArray(rawData)) {
		return [];
	}

	return rawData
		.filter((item) => {
			const conversationType = String(item.conversationType ?? item.type ?? item.kind ?? '').toUpperCase();
			return conversationType === 'GROUP';
		})
		.map((item, index) => {
			const members = Array.isArray(item.members) ? item.members.slice(0, 3) : [];
			const rawName = String(item.conversationName ?? item.name ?? '').trim();
			const lastContent = String(item.lastMessageContent ?? item.lastMessage ?? item.preview ?? item.snippet ?? '').trim();
			const senderPrefix = item.lastMessageSenderName ? `${item.lastMessageSenderName}: ` : '';
			const preview = lastContent ? `${senderPrefix}${lastContent}` : 'Chưa có tin nhắn';

			const timeSource = item.lastMessageTime ?? item.updatedAt ?? item.lastUpdated ?? item.time;
			const updatedTimestamp = Date.parse(String(timeSource ?? ''));

			return {
				id: String(item.conversationId ?? item.id ?? `group-${index}`),
				name: rawName || `Nhóm ${index + 1}`,
				preview,
				time: toTimeText(timeSource),
				updatedAt: Number.isNaN(updatedTimestamp) ? 0 : updatedTimestamp,
				unreadCount: Number(item.unreadCount ?? item.unread ?? 0),
				members: members.map((member, memberIndex) => ({
					key: String(member.userId ?? member.user_id ?? member.id ?? `${index}-${memberIndex}`),
					label: getMemberLabel(member, String(memberIndex + 1)),
					color: AVATAR_COLORS[(index + memberIndex) % AVATAR_COLORS.length],
					avatarUrl: member.avatarUrl ?? member.avatar_url ?? null,
				})),
			};
		})
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

export default function GroupTab() {
	const { colors, isDark } = useTheme();
	const [groups, setGroups] = useState<GroupItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const groupCountText = useMemo(() => `Nhóm đang tham gia (${groups.length})`, [groups.length]);

	const fetchGroups = async (isPullRefresh = false) => {
		if (isPullRefresh) {
			setRefreshing(true);
		} else {
			setLoading(true);
		}

		setError(null);

		try {
			const response = (await chatService.getConversations(0, 80)) as any;
			const data = Array.isArray(response)
				? response
				: response?.conversations ?? response?.items ?? response?.data ?? [];

			setGroups(normalizeGroupConversations(data));
		} catch {
			setGroups([]);
			setError('Không thể tải danh sách nhóm');
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	useEffect(() => {
		fetchGroups();
	}, []);

	useFocusEffect(
		useCallback(() => {
			fetchGroups();
		}, [])
	);

	return (
		<ScrollView
			style={[styles.container, { backgroundColor: colors.background }]}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={() => fetchGroups(true)}
					tintColor={COLORS.primary}
				/>
			}
		>
			<TouchableOpacity
				style={[styles.createCard, { backgroundColor: colors.card }]}
				activeOpacity={0.85}
				onPress={() => router.push('/create-group')}
			>
				<View style={styles.createIconWrap}>
					<View style={styles.createIconCircle}>
						<Ionicons name="people-outline" size={20} color={COLORS.primary} />
						<View style={styles.createPlusBadge}>
							<Ionicons name="add" size={9} color="#fff" />
						</View>
					</View>
				</View>
				<Text style={[styles.createText, { color: colors.text }]}>Tạo nhóm mới</Text>
			</TouchableOpacity>

			<View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
				<Text style={[styles.sectionTitle, { color: colors.text }]}>{groupCountText}</Text>
				<TouchableOpacity style={styles.sortButton} activeOpacity={0.7}>
					<MaterialCommunityIcons
						name="sort-descending"
						size={16}
						color={isDark ? colors.textSecondary : '#8e8e93'}
						style={styles.sortIcon}
					/>
					<Text style={[styles.sortText, { color: colors.textSecondary }]}>Hoạt động cuối</Text>
				</TouchableOpacity>
			</View>

			<View style={[styles.listWrap, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
				{loading ? (
					<View style={styles.loadingWrap}>
						<ActivityIndicator size="small" color={COLORS.primary} />
					</View>
				) : null}

				{!loading && groups.map((item) => (
					<TouchableOpacity
						key={item.id}
						style={[styles.groupRow, { borderBottomColor: colors.border }]}
						activeOpacity={0.75}
						onPress={() =>
							router.push(
								`/chat-detail?id=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.name)}&type=GROUP`
							)
						}
					>
						<View style={styles.avatarStack}>
							{item.members.map((member, index) => (
								<View
									key={member.key}
									style={[
										styles.memberAvatar,
										{
											backgroundColor: member.color,
											left: index * 18,
											zIndex: item.members.length - index,
										},
									]}
								>
									{member.avatarUrl ? (
										<Image source={getAvatarSource(member.avatarUrl)} style={styles.memberAvatarImage} />
									) : (
										<Text style={styles.memberLabel}>{member.label}</Text>
									)}
								</View>
							))}
							{item.unreadCount ? (
								<View style={styles.unreadBadge}>
									<Text style={styles.unreadBadgeText}>{item.unreadCount >= 99 ? '99+' : item.unreadCount}</Text>
								</View>
							) : null}
						</View>

						<View style={styles.groupContent}>
							<View style={styles.groupTopRow}>
								<Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
									{item.name}
								</Text>
								<Text style={[styles.groupTime, { color: colors.textSecondary }]}>{item.time}</Text>
							</View>
							<Text style={[styles.groupPreview, { color: colors.textSecondary }]} numberOfLines={1}>
								{item.preview}
							</Text>
						</View>
					</TouchableOpacity>
				))}

				{!loading && groups.length === 0 ? (
					<View style={styles.emptyWrap}>
						<Text style={[styles.emptyText, { color: colors.textSecondary }]}>
							{error ?? 'Bạn chưa tham gia nhóm nào'}
						</Text>
					</View>
				) : null}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { 
        flex: 1,
    },
	content: { paddingBottom: 24 },
	createCard: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 18,
		paddingVertical: 18,
        borderBottomColor: '#e6e8eb',
        borderBottomWidth: 8,
	},
	createIconWrap: {
		width: 54,
		alignItems: 'center',
		justifyContent: 'center',
	},
	createIconCircle: {
		width: 54,
		height: 54,
		borderRadius: 27,
		backgroundColor: '#EAF4FF',
		alignItems: 'center',
		justifyContent: 'center',
	},
	createPlusBadge: {
		position: 'absolute',
		right: 7,
		top: 7,
		width: 16,
		height: 16,
		borderRadius: 8,
		backgroundColor: COLORS.primary,
		alignItems: 'center',
		justifyContent: 'center',
	},
	createText: {
		marginLeft: 16,
		fontSize: 14,
		fontWeight: '500',
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingTop: 18,
		paddingBottom: 10,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: '700',
	},
	sortButton: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	sortIcon: {
		marginRight: 2,
	},
	sortText: {
		fontSize: 12,
		fontWeight: '500',
	},
	listWrap: {
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	groupRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		minHeight: 72,
	},
	avatarStack: {
		width: 74,
		height: 48,
		marginRight: 12,
		position: 'relative',
		justifyContent: 'center',
	},
	memberAvatar: {
		position: 'absolute',
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1.5,
		borderColor: '#fff',
	},
	memberAvatarImage: {
		width: '100%',
		height: '100%',
		borderRadius: 16,
	},
	memberLabel: {
		fontSize: 9,
		fontWeight: '700',
		color: '#2f2f2f',
	},
	unreadBadge: {
		position: 'absolute',
		left: 48,
		bottom: -1,
		minWidth: 22,
		height: 22,
		borderRadius: 11,
		backgroundColor: '#e6e8eb',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 5,
	},
	unreadBadgeText: {
		color: '#6f7378',
		fontSize: 10,
		fontWeight: '700',
	},
	groupContent: {
		flex: 1,
		minWidth: 0,
	},
	groupTopRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
	},
	groupName: {
		flex: 1,
		fontSize: 14,
		fontWeight: '500',
		paddingRight: 10,
	},
	groupTime: {
		fontSize: 11,
		paddingTop: 2,
	},
	groupPreview: {
		marginTop: 4,
		fontSize: 12,
		lineHeight: 16,
	},
	loadingWrap: {
		paddingVertical: 20,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyWrap: {
		paddingVertical: 22,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyText: {
		fontSize: 12,
	},
});
