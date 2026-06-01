import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchConversationMembers } from '@/services/chatConversationMembers';
import { getAvatarSource } from '@/services/mediaUtils';
import { MAX_GROUP_MEMBERS, buildSectionedList, getRemainingGroupMemberSlots, isGroupAtCapacity } from '@/utils/group/groupMembers';
import GroupPermissionsModal from '@chat/components/group/GroupPermissionsModal';
import { SCREEN_WIDTH } from '@chat/constants/chatConstants';
import { chatFileService } from '@chat/services/chatFileService';
import { chatService } from '@chat/services/chatService';
import type { Message, PinnedMessageItem } from '@chat/types/chatTypes';
import { getMessageMillis } from '@chat/utils/chatHelpers';
import { chatDetailStyles as styles } from '@features/chat/styles/chatDetailStyles';
import { friendService } from '@friends/services/friendService';
import {
    getPinnedMessagePreviewText,
    getPinnedMessageThumbnailUrl,
} from '../../../../components/chat/pinnedMessageDisplay';
import {
    checkAddMembersPermission,
    checkEditGroupInfoPermission,
    type MemberRole,
} from '../../../../utils/permissionHelper';

interface ChatInfoPanelProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  currentUserId: string | null;
  conversationDisplayName: string;
  conversationAvatarUrl: string;
  isAiConversation: boolean;
  isCloudConversation: boolean;
  isGroupConversation: boolean;
  messages: Message[];
  onNameUpdated: (name: string) => void;
  onAvatarUpdated: (url: string) => void;
  onChatCleared: () => void;
  onGroupLeft: () => void;
  onJumpToPinnedMessage: (messageId: string) => Promise<void>;
}

export default function ChatInfoPanel(props: ChatInfoPanelProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [infoMembers, setInfoMembers] = useState<any[]>([]);
  const [infoMediaItems, setInfoMediaItems] = useState<any[]>([]);
  const [infoFileItems, setInfoFileItems] = useState<any[]>([]);
  const [infoStorageStats, setInfoStorageStats] = useState<any>(null);
  const [infoShowMedia, setInfoShowMedia] = useState(true);
  const [infoShowFiles, setInfoShowFiles] = useState(false);
  const [infoShowPinned, setInfoShowPinned] = useState(true);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessageItem[]>([]);
  const [infoAddMemberVisible, setInfoAddMemberVisible] = useState(false);
  const [infoAddMemberSearch, setInfoAddMemberSearch] = useState('');
  const [infoFriendsList, setInfoFriendsList] = useState<any[]>([]);
  const [infoSelectedMembers, setInfoSelectedMembers] = useState<string[]>([]);
  const [infoAddingMembers, setInfoAddingMembers] = useState(false);
  const [infoMemberMenuId, setInfoMemberMenuId] = useState<string | null>(null);
  const [infoShowTransferModal, setInfoShowTransferModal] = useState(false);
  const [infoTransferReason, setInfoTransferReason] = useState<'transfer' | 'leave'>('transfer');
  const [infoTransferSearch, setInfoTransferSearch] = useState('');
  const [infoTransferSelectedId, setInfoTransferSelectedId] = useState<string | null>(null);
  const [infoTransferSelectedName, setInfoTransferSelectedName] = useState<string | null>(null);
  const [isInfoMediaGalleryVisible, setIsInfoMediaGalleryVisible] = useState(false);
  const [infoMediaGalleryStartIndex, setInfoMediaGalleryStartIndex] = useState(0);
  const [infoMediaGalleryIndex, setInfoMediaGalleryIndex] = useState(0);
  const [isInfoGalleryMenuVisible, setIsInfoGalleryMenuVisible] = useState(false);
  const [infoGalleryPlayingMediaId, setInfoGalleryPlayingMediaId] = useState<string | null>(null);
  const [isInfoGalleryVideoLoading, setIsInfoGalleryVideoLoading] = useState(false);
  const [infoVideoThumbnailsByMediaId, setInfoVideoThumbnailsByMediaId] = useState<Record<string, string>>({});
  const [isJumpingToMessage, setIsJumpingToMessage] = useState(false);
  const [isDownloadingInfoMedia, setIsDownloadingInfoMedia] = useState(false);
  const [infoDownloadProgress, setInfoDownloadProgress] = useState(0);
  const [isInfoMediaBrowserVisible, setIsInfoMediaBrowserVisible] = useState(false);
  const [infoMediaBrowserFilter, setInfoMediaBrowserFilter] = useState<'ALL' | 'IMAGE' | 'VIDEO'>('ALL');
  const [infoEditNameVisible, setInfoEditNameVisible] = useState(false);
  const [infoEditNameValue, setInfoEditNameValue] = useState('');
  const [infoUpdatingGroupName, setInfoUpdatingGroupName] = useState(false);
  const [infoUpdatingGroupAvatar, setInfoUpdatingGroupAvatar] = useState(false);
  const [infoPermissionsVisible, setInfoPermissionsVisible] = useState(false);
  const [currentPermissions, setCurrentPermissions] = useState<any>({});
  const [infoCurrentUserRole, setInfoCurrentUserRole] = useState<MemberRole | null>(null);

  const infoVideoThumbGeneratingRef = useRef<Set<string>>(new Set());
  const infoMediaGalleryRef = useRef<FlatList>(null);
  const infoSkipPermissionsFetchRef = useRef(false);

  const fetchPinnedMessages = useCallback(async () => {
    if (!props.conversationId) {
      setPinnedMessages([]);
      return;
    }
    try {
      const response = await chatService.getPinnedMessages(props.conversationId);
      const rawList = chatService.unwrapApiPayload<any>(response);
      const list = Array.isArray(rawList) ? rawList : [];
      setPinnedMessages(list.map((item: any) => ({
        id: String(item.id ?? item.messageId ?? ''),
        messageId: String(item.messageId ?? ''),
        content: String(item.content ?? ''),
        messageType: item.messageType ? String(item.messageType) : undefined,
        contentUrl: item.contentUrl ? String(item.contentUrl) : item.mediaUrl ? String(item.mediaUrl) : undefined,
        thumbnailUrl: item.thumbnailUrl ? String(item.thumbnailUrl) : undefined,
        fileName: item.fileName ? String(item.fileName) : undefined,
        senderName: item.senderName ? String(item.senderName) : undefined,
      })));
    } catch {
      setPinnedMessages([]);
    }
  }, [props.conversationId]);

  const fetchInfoMembers = useCallback(async () => {
    if (!props.conversationId || !props.isGroupConversation) return;
    try {
      const members = await fetchConversationMembers(props.conversationId);
      setInfoMembers(members);
      // Get current user's role
      const currentMember = members.find((m: any) => m.userId === props.currentUserId);
      setInfoCurrentUserRole(currentMember?.role || 'MEMBER');
    } catch {
      setInfoMembers([]);
      setInfoCurrentUserRole(null);
    }
  }, [props.conversationId, props.isGroupConversation, props.currentUserId]);

  const fetchInfoPermissions = useCallback(async () => {
    if (!props.conversationId || !props.isGroupConversation) return;
    if (infoSkipPermissionsFetchRef.current) {
      setCurrentPermissions(null);
      return;
    }
    try {
      const response = await chatService.getPermissions(props.conversationId);
      const permsData = response?.data || response;
      setCurrentPermissions({
        canEditInfo: permsData?.canEditInfo,
        canPinMessages: permsData?.canPinMessages,
        canSendMessages: permsData?.canSendMessages,
        isMemberApprovalRequired: permsData?.isMemberApprovalRequired,
      });
    } catch (err: any) {
      const status = Number(err?.response?.status ?? 0);
      if (status === 404 || status === 405 || status >= 500) {
        infoSkipPermissionsFetchRef.current = true;
        console.warn('Permissions endpoint unavailable in ChatInfoPanel, using role-only checks');
      }
      setCurrentPermissions(null);
    }
  }, [props.conversationId, props.isGroupConversation]);

  const normalizeInfoMediaItems = useCallback((source: any[]) => {
    const items = Array.isArray(source) ? source : [];
    const normalized: any[] = [];
    items.forEach((item: any, idx: number) => {
      if (item?.isRecalled) return;
      const messageType = String(item?.messageType ?? '').toUpperCase();
      if (messageType === 'IMAGE' || messageType === 'VIDEO') {
        const mediaUrl = String(item?.content ?? item?.mediaUrl ?? item?.url ?? '').trim();
        if (!mediaUrl) return;
        normalized.push(item);
        return;
      }
      if (messageType === 'IMAGE_GROUP' && Array.isArray(item?.attachments)) {
        const baseMessageId = String(item?.messageId ?? item?.id ?? `media-group-${idx}`);
        item.attachments.forEach((attachment: any, ai: number) => {
          const url = String(attachment?.url ?? attachment?.content ?? attachment?.mediaUrl ?? attachment?.fileUrl ?? attachment?.path ?? (typeof attachment === 'string' ? attachment : '')).trim();
          if (!url) return;
          normalized.push({
            ...item, id: `${baseMessageId}-attachment-${ai}`, messageType: 'IMAGE', content: url,
            thumbnailUrl: attachment?.thumbnailUrl ?? item?.thumbnailUrl, parentMessageId: baseMessageId,
          });
        });
      }
    });
    return normalized;
  }, []);

  const getInfoMediaSortMillis = useCallback((item: any) => {
    const primary = getMessageMillis(item?.updatedAt ?? item?.createdAt);
    if (!Number.isNaN(primary)) return primary;
    const fallback = Number(item?.createdAt ?? item?.updatedAt ?? 0);
    return Number.isNaN(fallback) ? 0 : fallback;
  }, []);

  const sortInfoMediaItems = useCallback((items: any[]) => {
    return [...items].sort((a, b) => {
      const timeA = getInfoMediaSortMillis(a);
      const timeB = getInfoMediaSortMillis(b);
      if (timeA !== timeB) return timeB - timeA;
      const idA = String(a?.messageId ?? a?.id ?? '');
      const idB = String(b?.messageId ?? b?.id ?? '');
      return idB.localeCompare(idA);
    });
  }, [getInfoMediaSortMillis]);

  const fetchInfoMedia = useCallback(async () => {
    if (!props.conversationId || props.isAiConversation) return;
    try {
      const res = chatService.unwrapApiPayload<any[]>(await chatService.getConversationMedia(props.conversationId));
      const items = Array.isArray(res) ? res : [];
      setInfoMediaItems(sortInfoMediaItems(normalizeInfoMediaItems(items)));
      setInfoFileItems(items.filter((m: any) => m.messageType === 'MEDIA'));
    } catch {
      setInfoMediaItems([]);
      setInfoFileItems([]);
    }
  }, [props.conversationId, props.isAiConversation, normalizeInfoMediaItems, sortInfoMediaItems]);

  const fetchInfoStorageStats = useCallback(async () => {
    if (!props.isCloudConversation) return;
    try {
      const res = await chatService.getStorageStats();
      setInfoStorageStats(res);
    } catch {
      setInfoStorageStats(null);
    }
  }, [props.isCloudConversation]);

  const getPinnedPreviewText = useCallback((item: PinnedMessageItem) => {
    const text = getPinnedMessagePreviewText(item);
    if (text === '[Tin nhắn]') {
      return t('chat.empty_message', 'Tin nhắn trống');
    }
    return text;
  }, [t]);

  const getPinnedPreviewThumb = useCallback((item: PinnedMessageItem) => {
    return getPinnedMessageThumbnailUrl(item);
  }, []);

  const handleUnpinFromPinnedList = useCallback(async (messageId: string) => {
    try {
      await chatService.unpinMessage(messageId);
      await fetchPinnedMessages();
      props.onJumpToPinnedMessage(messageId);
    } catch (error) {
      console.error('Failed to unpin message from list:', error);
    }
  }, [fetchPinnedMessages, props]);

  const getInfoMediaUrl = useCallback((item: any) => String(item?.content ?? item?.mediaUrl ?? item?.url ?? '').trim(), []);
  const getInfoMediaId = useCallback((item: any, index?: number) => String(item?.messageId ?? item?.id ?? `info-media-${index ?? 0}`), []);
  const getInfoMediaType = useCallback((item: any) => String(item?.messageType ?? '').toUpperCase(), []);

  const requestMediaSavePermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const existing = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
      if (existing.granted) return true;
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
      return status === 'granted';
    }
    const existing = await MediaLibrary.getPermissionsAsync();
    if (existing.granted) return true;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  }, []);

  const closeInfoMediaGallery = useCallback(() => {
    setIsInfoMediaGalleryVisible(false);
    setIsInfoGalleryMenuVisible(false);
    setInfoGalleryPlayingMediaId(null);
    setIsInfoGalleryVideoLoading(false);
    setInfoDownloadProgress(0);
  }, []);

  const handleOpenInfoMediaGallery = useCallback((startIndex: number) => {
    if (!Array.isArray(infoMediaItems) || infoMediaItems.length === 0) return;
    const safeIndex = Math.max(0, Math.min(startIndex, infoMediaItems.length - 1));
    setInfoMediaGalleryStartIndex(safeIndex);
    setInfoMediaGalleryIndex(safeIndex);
    setInfoGalleryPlayingMediaId(null);
    setIsInfoGalleryVideoLoading(false);
    setIsInfoGalleryMenuVisible(false);
    setIsInfoMediaGalleryVisible(true);
  }, [infoMediaItems]);

  const handlePlayInfoGalleryVideo = useCallback((item: any, index: number) => {
    const mediaId = getInfoMediaId(item, index);
    setInfoGalleryPlayingMediaId(mediaId);
    setIsInfoGalleryVideoLoading(true);
  }, [getInfoMediaId]);

  const handleDownloadInfoGalleryCurrent = useCallback(async () => {
    const currentItem = infoMediaItems[infoMediaGalleryIndex];
    if (!currentItem) return;
    const mediaUrl = getInfoMediaUrl(currentItem);
    if (!mediaUrl) { Alert.alert('Lỗi', 'Không tìm thấy đường dẫn media'); return; }
    try {
      setIsDownloadingInfoMedia(true);
      setInfoDownloadProgress(0);
      const hasPermission = await requestMediaSavePermission();
      if (!hasPermission) { Alert.alert('Quyền truy cập', 'Bạn cần cho phép quyền thư viện để lưu media'); return; }
      const mediaType = getInfoMediaType(currentItem);
      let localUri = mediaUrl;
      if (/^https?:\/\//i.test(mediaUrl)) {
        const cleanUrl = mediaUrl.split('?')[0];
        const ext = cleanUrl.includes('.') ? `.${cleanUrl.split('.').pop()?.slice(0, 6) || ''}` : (mediaType === 'VIDEO' ? '.mp4' : '.jpg');
        const destinationFile = new File(Paths.cache, `fruvia_media_${Date.now()}${ext}`);
        const resumable = FileSystemLegacy.createDownloadResumable(mediaUrl, destinationFile.uri, {},
          (progressData) => {
            const total = progressData.totalBytesExpectedToWrite;
            if (typeof total === 'number' && total > 0) setInfoDownloadProgress(Math.max(0, Math.min(100, Math.round((progressData.totalBytesWritten / total) * 100))));
          });
        const downloaded = await resumable.downloadAsync();
        localUri = downloaded?.uri || destinationFile.uri;
      } else setInfoDownloadProgress(100);
      const asset = await MediaLibrary.createAssetAsync(localUri);
      const albumName = 'Fruvia';
      const album = await MediaLibrary.getAlbumAsync(albumName);
      if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      else await MediaLibrary.createAlbumAsync(albumName, asset, false);
      Alert.alert('Thành công', 'Đã tải media về thiết bị');
    } catch (error: any) { Alert.alert('Lỗi', error?.message || 'Không thể tải media'); }
    finally { setIsDownloadingInfoMedia(false); setTimeout(() => setInfoDownloadProgress(0), 200); }
  }, [getInfoMediaType, getInfoMediaUrl, infoMediaGalleryIndex, infoMediaItems, requestMediaSavePermission]);

  const openInfoMediaBrowser = useCallback(() => {
    setInfoMediaBrowserFilter('ALL');
    setIsInfoMediaBrowserVisible(true);
  }, []);

  useEffect(() => {
    if (!props.visible) return;
    void Promise.all([fetchInfoMembers(), fetchInfoPermissions(), fetchInfoMedia(), fetchInfoStorageStats(), fetchPinnedMessages()]);
  }, [props.visible, fetchInfoMembers, fetchInfoPermissions, fetchInfoMedia, fetchInfoStorageStats, fetchPinnedMessages]);

  const infoMediaBrowserItems = useMemo(() => infoMediaItems.filter((item: any) => {
    const mediaType = getInfoMediaType(item);
    if (infoMediaBrowserFilter === 'ALL') return true;
    if (infoMediaBrowserFilter === 'IMAGE') return mediaType === 'IMAGE';
    return mediaType === 'VIDEO';
  }), [getInfoMediaType, infoMediaBrowserFilter, infoMediaItems]);

  const infoMediaPreviewItems = useMemo(() => infoMediaItems.slice(0, 4), [infoMediaItems]);

  const handleViewOriginalMessageFromGallery = useCallback(() => {
    const currentItem = infoMediaItems[infoMediaGalleryIndex];
    const targetMessageId = String(currentItem?.messageId ?? '').trim();
    closeInfoMediaGallery();
    if (!targetMessageId) return;
    setTimeout(() => { void props.onJumpToPinnedMessage(targetMessageId); }, 180);
  }, [closeInfoMediaGallery, infoMediaGalleryIndex, infoMediaItems, props]);

  const infoIsAdmin = infoCurrentUserRole === 'ADMIN';
  const infoIsDeputy = infoCurrentUserRole === 'DEPUTY';
  const infoCanAddMembers = infoIsAdmin || infoIsDeputy;
  const infoCanEditGroupInfo = checkEditGroupInfoPermission('GROUP', infoCurrentUserRole, currentPermissions).allowed;
  const infoMemberCount = infoMembers.length;
  const infoRemainingMemberSlots = getRemainingGroupMemberSlots(infoMemberCount);
  const infoGroupIsFull = isGroupAtCapacity(infoMemberCount);

  const handleOpenInfoEditNameModal = useCallback(() => {
    setInfoEditNameValue(String(props.conversationDisplayName ?? '').trim());
    setInfoEditNameVisible(true);
  }, [props.conversationDisplayName]);

  const handleInfoUpdateGroupAvatar = useCallback(async (avatarUri: string) => {
    if (!props.conversationId || !props.isGroupConversation || infoUpdatingGroupAvatar) return;
    
    // ========== CHECK EDIT GROUP INFO PERMISSION ==========
    const permCheck = checkEditGroupInfoPermission('GROUP', infoCurrentUserRole, currentPermissions);
    if (!permCheck.allowed) {
      Alert.alert('Không thể cập nhật ảnh đại diện', permCheck.reason || 'Bạn không có quyền chỉnh sửa thông tin nhóm');
      return;
    }
    
    setInfoUpdatingGroupAvatar(true);
    try {
      let finalAvatarUrl = avatarUri.trim();
      if (finalAvatarUrl && !/^https?:\/\//i.test(finalAvatarUrl)) {
        const now = Date.now();
        const lowerUri = finalAvatarUrl.toLowerCase();
        const ext = lowerUri.includes('.png') ? 'png' : 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const PickedMedia = { uri: finalAvatarUrl, fileName: `group_avatar_${now}.${ext}`, fileSize: 0, mimeType, mediaType: 'IMAGE' as const };
        finalAvatarUrl = await chatFileService.uploadMedia(PickedMedia);
      }
      const response = await chatService.updateGroupConversationInfo(props.conversationId, { conversationAvatarUrl: finalAvatarUrl || undefined });
      const payload = chatService.unwrapApiPayload<any>(response) ?? {};
      const nextAvatar = String(payload.conversationAvatarUrl ?? payload.avatarUrl ?? finalAvatarUrl ?? '').trim();
      props.onAvatarUpdated(nextAvatar);
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện nhóm');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) Alert.alert('Không có quyền', 'Bạn chưa có quyền đổi ảnh đại diện nhóm');
      else Alert.alert('Lỗi', err?.message || 'Không thể cập nhật ảnh đại diện nhóm');
    } finally { setInfoUpdatingGroupAvatar(false); }
  }, [props.conversationId, props.isGroupConversation, infoUpdatingGroupAvatar, props, infoCurrentUserRole, currentPermissions]);

  const handlePickInfoGroupAvatar = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) { Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập thư viện ảnh'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled && result.assets[0]) await handleInfoUpdateGroupAvatar(result.assets[0].uri);
  }, [handleInfoUpdateGroupAvatar]);

  const handleTakeInfoGroupAvatar = useCallback(async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) { Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập camera'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled && result.assets[0]) await handleInfoUpdateGroupAvatar(result.assets[0].uri);
  }, [handleInfoUpdateGroupAvatar]);

  const handleSelectInfoGroupAvatarSource = useCallback(() => {
    Alert.alert('Ảnh đại diện nhóm', 'Chọn cách cập nhật ảnh đại diện nhóm', [
      { text: 'Thư viện', onPress: () => { void handlePickInfoGroupAvatar(); } },
      { text: 'Chụp ảnh', onPress: () => { void handleTakeInfoGroupAvatar(); } },
      { text: 'Hủy', style: 'cancel' },
    ]);
  }, [handlePickInfoGroupAvatar, handleTakeInfoGroupAvatar]);

  const handleInfoUpdateGroupName = useCallback(async () => {
    if (!props.conversationId || !props.isGroupConversation || infoUpdatingGroupName) return;
    
    // ========== CHECK EDIT GROUP INFO PERMISSION ==========
    const permCheck = checkEditGroupInfoPermission('GROUP', infoCurrentUserRole, currentPermissions);
    if (!permCheck.allowed) {
      Alert.alert('Không thể cập nhật', permCheck.reason || 'Bạn không có quyền chỉnh sửa thông tin nhóm');
      return;
    }
    
    const trimmedName = infoEditNameValue.trim();
    if (!trimmedName) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nhóm'); return; }
    setInfoUpdatingGroupName(true);
    try {
      const response = await chatService.updateGroupConversationInfo(props.conversationId, { conversationName: trimmedName });
      const payload = chatService.unwrapApiPayload<any>(response) ?? {};
      const nextName = String(payload.conversationName ?? trimmedName).trim();
      props.onNameUpdated(nextName || trimmedName);
      setInfoEditNameVisible(false);
      Alert.alert('Thành công', 'Đã cập nhật tên nhóm');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) Alert.alert('Không có quyền', 'Bạn chưa có quyền đổi tên nhóm');
      else Alert.alert('Lỗi', err?.message || 'Không thể cập nhật tên nhóm');
    } finally { setInfoUpdatingGroupName(false); }
  }, [props.conversationId, props.isGroupConversation, infoUpdatingGroupName, infoEditNameValue, infoCurrentUserRole, currentPermissions, props]);

  const getFriendId = useCallback((friend: any) => String(friend?.user_id ?? friend?.userId ?? friend?.id ?? '').trim(), []);
  const getFriendDisplayName = useCallback((friend: any) => String(friend?.display_name ?? friend?.displayName ?? friend?.full_name ?? friend?.name ?? 'Unknown'), []);
  const getFriendAvatar = useCallback((friend: any) => friend?.avatar_url || friend?.avatarUrl || friend?.avatar, []);

  const fetchInfoFriendsForAdd = useCallback(async () => {
    try {
      const res = chatService.unwrapApiPayload<any[]>(await friendService.getFriendsList());
      const list = Array.isArray(res) ? res : [];
      const existingIds = new Set(infoMembers.map((m: any) => String(m.userId)));
      setInfoFriendsList(list.filter((f: any) => { const id = getFriendId(f); return Boolean(id) && !existingIds.has(id); }));
    } catch { setInfoFriendsList([]); }
  }, [getFriendId, infoMembers]);

  const filteredInfoFriendsList = useMemo(() => {
    const keyword = infoAddMemberSearch.trim().toLowerCase();
    if (!keyword) return infoFriendsList;
    return infoFriendsList.filter((friend: any) => {
      const displayName = getFriendDisplayName(friend).toLowerCase();
      const email = String(friend.email ?? '').toLowerCase();
      const phone = String(friend.phone ?? friend.phone_number ?? friend.phoneNumber ?? '').toLowerCase();
      return displayName.includes(keyword) || email.includes(keyword) || phone.includes(keyword);
    });
  }, [getFriendDisplayName, infoAddMemberSearch, infoFriendsList]);

  const infoAddMemberListData = useMemo(() => buildSectionedList(filteredInfoFriendsList, (f: any) => getFriendId(f), (f: any) => getFriendDisplayName(f).trim()), [filteredInfoFriendsList, getFriendDisplayName, getFriendId]);

  const handleOpenInfoAddMemberModal = useCallback(async () => {
    if (infoGroupIsFull) { Alert.alert('Giới hạn nhóm', `Nhóm chỉ có tối đa ${MAX_GROUP_MEMBERS} thành viên.`); return; }
    setInfoAddMemberVisible(true);
    setInfoAddMemberSearch('');
    setInfoSelectedMembers([]);
    await fetchInfoFriendsForAdd();
  }, [fetchInfoFriendsForAdd, infoGroupIsFull]);

  const handleCloseInfoAddMemberModal = useCallback(() => {
    setInfoAddMemberVisible(false);
    setInfoAddMemberSearch('');
    setInfoSelectedMembers([]);
  }, []);

  const handleInfoAddMembers = useCallback(async () => {
    const validMemberIds = Array.from(new Set(infoSelectedMembers.map((id) => String(id).trim()).filter(Boolean)));
    if (validMemberIds.length === 0 || infoAddingMembers || !props.conversationId) return;
    
    // ========== CHECK ADD MEMBERS PERMISSION ==========
    const permCheck = checkAddMembersPermission('GROUP', infoCurrentUserRole, currentPermissions);
    if (!permCheck.allowed) {
      Alert.alert('Không thể thêm thành viên', permCheck.reason || 'Bạn không có quyền thêm thành viên vào nhóm');
      return;
    }
    
    if (validMemberIds.length > infoRemainingMemberSlots) { Alert.alert('Giới hạn nhóm', `Nhóm chỉ còn chỗ cho ${infoRemainingMemberSlots} thành viên.`); return; }
    setInfoAddingMembers(true);
    try {
      await chatService.addConversationMembers(props.conversationId, validMemberIds);
      handleCloseInfoAddMemberModal();
      await fetchInfoMembers();
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message || err?.response?.data?.error || err?.response?.data?.data?.message || err?.message;
      Alert.alert('Lỗi', backendMessage || 'Không thể thêm thành viên');
    } finally { setInfoAddingMembers(false); }
  }, [props.conversationId, fetchInfoMembers, handleCloseInfoAddMemberModal, infoAddingMembers, infoRemainingMemberSlots, infoSelectedMembers, infoCurrentUserRole, currentPermissions]);

  const handleInfoRemoveMember = useCallback((memberId: string, memberName: string) => {
    Alert.alert('Xóa thành viên', `Bạn có chắc muốn xóa ${memberName} khỏi nhóm?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
          try { await chatService.removeConversationMember(props.conversationId!, memberId); await fetchInfoMembers(); }
          catch (err: any) { Alert.alert('Lỗi', err?.message || 'Không thể xóa thành viên'); }
        } },
    ]);
  }, [props.conversationId, fetchInfoMembers]);

  const handleInfoChangeRole = useCallback((targetUserId: string, targetName: string, newRole: 'DEPUTY' | 'MEMBER') => {
    const roleLabel = newRole === 'DEPUTY' ? 'Phó nhóm' : 'Thành viên';
    Alert.alert('Thay đổi quyền', `Đổi quyền ${targetName} thành ${roleLabel}?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xác nhận', onPress: async () => {
          try { await chatService.changeMemberRole(props.conversationId!, targetUserId, newRole); await fetchInfoMembers(); }
          catch (err: any) { Alert.alert('Lỗi', err?.message || 'Không thể thay đổi quyền'); }
        } },
    ]);
    setInfoMemberMenuId(null);
  }, [props.conversationId, fetchInfoMembers]);

  const handleInfoLeaveGroup = useCallback(() => {
    if (infoIsAdmin) { setInfoTransferReason('leave'); setInfoShowTransferModal(true); return; }
    Alert.alert('Rời nhóm', 'Bạn có chắc muốn rời khỏi nhóm?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Rời nhóm', style: 'destructive', onPress: async () => {
          try { await chatService.leaveConversation(props.conversationId!); props.onClose(); props.onGroupLeft(); }
          catch (err: any) { Alert.alert('Lỗi', err?.message || 'Không thể rời nhóm'); }
        } },
    ]);
  }, [props.conversationId, infoIsAdmin, props]);

  const handleInfoDissolveGroup = useCallback(() => {
    Alert.alert('Giải tán nhóm', 'Hành động này không thể hoàn tác. Bạn có chắc muốn giải tán nhóm?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Giải tán', style: 'destructive', onPress: async () => {
          try { await chatService.dissolveConversation(props.conversationId!); props.onClose(); props.onGroupLeft(); }
          catch (err: any) { Alert.alert('Lỗi', err?.message || 'Không thể giải tán nhóm'); }
        } },
    ]);
  }, [props.conversationId, props]);

  const handleInfoTransferOwnership = useCallback((newAdminId: string, newAdminName: string) => {
    Alert.alert('Chuyển quyền trưởng nhóm', `Chuyển quyền trưởng nhóm cho ${newAdminName}?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xác nhận', onPress: async () => {
          try {
            if (infoTransferReason === 'leave') { await chatService.leaveConversation(props.conversationId!, newAdminId); props.onClose(); props.onGroupLeft(); }
            else { await chatService.transferOwnership(props.conversationId!, newAdminId); await fetchInfoMembers(); }
            setInfoShowTransferModal(false);
          } catch (err: any) { Alert.alert('Lỗi', err?.message || 'Không thể chuyển quyền'); }
        } },
    ]);
  }, [props.conversationId, fetchInfoMembers, infoTransferReason, props]);

  const handleInfoClearChat = useCallback(() => {
    Alert.alert('Xóa lịch sử', 'Bạn có chắc muốn xóa toàn bộ lịch sử chat?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
          try { await chatService.clearConversation(props.conversationId!); props.onChatCleared(); }
          catch (err: any) { Alert.alert('Lỗi', err?.message || 'Không thể xóa lịch sử'); }
        } },
    ]);
  }, [props.conversationId, props]);

  const peerAvatarSource = useMemo(() => getAvatarSource(props.conversationAvatarUrl), [props.conversationAvatarUrl]);

  const generateVideoThumbnail = useCallback(async (videoUri: string): Promise<string | undefined> => {
    if (!videoUri) return undefined;
    try {
      const { VideoThumbnails } = require('expo-video-thumbnails');
      const result = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 800, quality: 0.6 });
      return result.uri;
    } catch { return undefined; }
  }, []);

  useEffect(() => {
    if (!props.visible) return;
    infoMediaItems.forEach((item, index) => {
      if (getInfoMediaType(item) !== 'VIDEO') return;
      const mediaId = getInfoMediaId(item, index);
      if (infoVideoThumbnailsByMediaId[mediaId] || infoVideoThumbGeneratingRef.current.has(mediaId)) return;
      const mediaUrl = getInfoMediaUrl(item);
      if (!mediaUrl || mediaUrl.startsWith('data:')) return;
      infoVideoThumbGeneratingRef.current.add(mediaId);
      void generateVideoThumbnail(mediaUrl).then((thumbUri) => {
        if (!thumbUri) return;
        setInfoVideoThumbnailsByMediaId((prev) => (prev[mediaId] === thumbUri ? prev : { ...prev, [mediaId]: thumbUri }));
      }).finally(() => infoVideoThumbGeneratingRef.current.delete(mediaId));
    });
  }, [props.visible, generateVideoThumbnail, getInfoMediaId, getInfoMediaType, getInfoMediaUrl, infoMediaItems, infoVideoThumbnailsByMediaId]);

  useEffect(() => {
    if (!isInfoMediaGalleryVisible || infoMediaItems.length === 0) return;
    const safeIndex = Math.max(0, Math.min(infoMediaGalleryStartIndex, infoMediaItems.length - 1));
    setInfoMediaGalleryIndex(safeIndex);
    requestAnimationFrame(() => { infoMediaGalleryRef.current?.scrollToIndex({ index: safeIndex, animated: false }); });
  }, [infoMediaGalleryStartIndex, infoMediaItems.length, isInfoMediaGalleryVisible]);

  return (
    <>
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <SafeAreaView style={[styles.infoPanelContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.infoPanelHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.infoPanelTitle, { color: colors.text }]}>Thông tin hội thoại</Text>
          <TouchableOpacity onPress={props.onClose}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.infoPanelScroll} showsVerticalScrollIndicator={false}>
          {/* Profile section */}
          <View style={[styles.infoPanelProfile, { borderBottomColor: colors.border }]}>
            <View style={styles.infoPanelAvatarWrap}>
              {props.isAiConversation ? (
                <View style={styles.infoPanelAiAvatar}><Ionicons name="sparkles" size={34} color="#FFFFFF" /></View>
              ) : props.isCloudConversation ? (
                <View style={[styles.infoPanelCloudAvatar]}><Ionicons name="cloud" size={36} color="#FFFFFF" /></View>
              ) : props.conversationAvatarUrl ? (
                <Image source={peerAvatarSource} style={styles.infoPanelAvatarImg} />
              ) : (
                <View style={styles.infoPanelDefaultAvatar}>
                  <Text style={styles.infoPanelDefaultAvatarText}>{(String(props.conversationDisplayName ?? '?')).charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.infoPanelNameRow}>
              <Text style={[styles.infoPanelName, { color: colors.text }]} numberOfLines={2}>{props.conversationDisplayName}</Text>
              {props.isGroupConversation && infoCanEditGroupInfo && (
                <TouchableOpacity style={styles.infoPanelNameEditBtn} onPress={handleOpenInfoEditNameModal}>
                  <Ionicons name="pencil" size={16} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>
            {props.isGroupConversation && infoMembers.length > 0 && (
              <Text style={[styles.infoPanelSubName, { color: colors.textSecondary }]}>{infoMembers.length} thành viên</Text>
            )}
            {props.isGroupConversation && (
              <View style={styles.infoPanelQuickActions}>
                <TouchableOpacity style={styles.infoPanelQuickAction} onPress={() => Alert.alert('Tìm tin nhắn', 'Chức năng đang phát triển')}>
                  <View style={[styles.infoPanelQuickActionIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="search" size={22} color={colors.text} />
                  </View>
                  <Text style={[styles.infoPanelQuickActionLabel, { color: colors.text }]}>Tìm {'\n'}tin nhắn</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.infoPanelQuickAction, infoGroupIsFull && { opacity: 0.45 }]} onPress={() => { void handleOpenInfoAddMemberModal(); }}>
                  <View style={[styles.infoPanelQuickActionIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="person-add-outline" size={22} color={colors.text} />
                  </View>
                  <Text style={[styles.infoPanelQuickActionLabel, { color: colors.text }]}>Thêm {'\n'}thành viên</Text>
                </TouchableOpacity>
                {infoCanEditGroupInfo && (
                  <TouchableOpacity style={styles.infoPanelQuickAction} onPress={handleSelectInfoGroupAvatarSource}>
                    <View style={[styles.infoPanelQuickActionIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Ionicons name="camera" size={22} color={colors.text} />
                    </View>
                    <Text style={[styles.infoPanelQuickActionLabel, { color: colors.text }]}>Đổi ảnh {'\n'}đại diện</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.infoPanelQuickAction} onPress={() => Alert.alert('Tắt thông báo', 'Chức năng đang phát triển')}>
                  <View style={[styles.infoPanelQuickActionIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="notifications-off-outline" size={22} color={colors.text} />
                  </View>
                  <Text style={[styles.infoPanelQuickActionLabel, { color: colors.text }]}>Tắt {'\n'}thông báo</Text>
                </TouchableOpacity>
                {(infoIsAdmin || infoIsDeputy) && (
                  <TouchableOpacity style={styles.infoPanelQuickAction} onPress={() => setInfoPermissionsVisible(true)}>
                    <View style={[styles.infoPanelQuickActionIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Ionicons name="settings-outline" size={22} color={colors.text} />
                    </View>
                    <Text style={[styles.infoPanelQuickActionLabel, { color: colors.text }]}>Phân {'\n'}quyền</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* AI Info */}
          {props.isAiConversation && (
            <View style={[styles.infoPanelSection, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoPanelSectionTitle, { color: colors.text }]}>Khả năng của Fruvia Chatbot</Text>
              {['Trả lời câu hỏi thông minh về mọi chủ đề', 'Tạo hình ảnh từ mô tả văn bản', 'Hỗ trợ phân tích tài liệu và file cá nhân'].map((cap) => (
                <Text key={cap} style={[styles.infoPanelCapItem, { color: colors.textSecondary }]}>• {cap}</Text>
              ))}
              <TouchableOpacity style={styles.infoPanelDangerBtn} onPress={handleInfoClearChat}>
                <Ionicons name="trash-outline" size={16} color="#F04343" />
                <Text style={styles.infoPanelDangerBtnText}>Xóa lịch sử chat</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cloud storage */}
          {props.isCloudConversation && infoStorageStats && (
            <View style={[styles.infoPanelSection, { borderBottomColor: colors.border }]}>
              <View style={styles.infoPanelStorageHeader}>
                <Text style={[styles.infoPanelSectionTitle, { color: colors.text }]}>Dung lượng lưu trữ</Text>
                <Text style={[styles.infoPanelStorageUsed, { color: colors.textSecondary }]}>{infoStorageStats.totalSizeFormatted ?? '0 B'} / 500 MB</Text>
              </View>
              <View style={styles.infoPanelStorageBar}>
                {infoStorageStats.totalSize > 0 && (
                  <>
                    <View style={[styles.infoPanelStorageSegment, { backgroundColor: '#F97316', flex: (infoStorageStats.imageSize ?? 0) / infoStorageStats.totalSize }]} />
                    <View style={[styles.infoPanelStorageSegment, { backgroundColor: '#3B82F6', flex: (infoStorageStats.videoSize ?? 0) / infoStorageStats.totalSize }]} />
                    <View style={[styles.infoPanelStorageSegment, { backgroundColor: '#22C55E', flex: (infoStorageStats.fileSize ?? 0) / infoStorageStats.totalSize }]} />
                    <View style={[styles.infoPanelStorageSegment, { backgroundColor: '#EC4899', flex: (infoStorageStats.voiceSize ?? 0) / infoStorageStats.totalSize }]} />
                  </>
                )}
              </View>
              <View style={styles.infoPanelStorageLegend}>
                {[{ color: '#F97316', label: `Ảnh ${infoStorageStats.imageSizeFormatted ? `(${infoStorageStats.imageSizeFormatted})` : ''}` },
                  { color: '#3B82F6', label: `Video ${infoStorageStats.videoSizeFormatted ? `(${infoStorageStats.videoSizeFormatted})` : ''}` },
                  { color: '#22C55E', label: `File ${infoStorageStats.fileSizeFormatted ? `(${infoStorageStats.fileSizeFormatted})` : ''}` },
                  { color: '#EC4899', label: `Giọng nói ${infoStorageStats.voiceSizeFormatted ? `(${infoStorageStats.voiceSizeFormatted})` : ''}` },
                ].map((item) => (
                  <View key={item.color} style={styles.infoPanelLegendItem}>
                    <View style={[styles.infoPanelLegendDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.infoPanelLegendText, { color: colors.textSecondary }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Group Members */}
          {props.isGroupConversation && (
            <TouchableOpacity
              style={[styles.infoPanelSection, { borderBottomColor: colors.border }]}
              activeOpacity={0.85}
              onPress={() => {
                router.push({
                  pathname: '/member-detail',
                  params: {
                    members: encodeURIComponent(JSON.stringify(infoMembers)),
                    currentUserId: props.currentUserId ?? '',
                  },
                });
              }}
            >
              <View style={styles.infoPanelSectionToggleLeft}>
                <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.infoPanelSectionTitle, { color: colors.text, marginLeft: 8 }]}>Xem Thành viên ({infoMembers.length})</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Pinned Messages */}
          {!props.isAiConversation && (
            <View style={[styles.infoPanelSection, { borderBottomColor: colors.border }]}>
              <TouchableOpacity style={styles.infoPanelSectionToggle} onPress={() => setInfoShowPinned((v) => !v)}>
                <View style={styles.infoPanelSectionToggleLeft}>
                  <Ionicons name="pin-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.infoPanelSectionTitle, { color: colors.text, marginLeft: 8 }]}>Tin nhắn đã ghim {pinnedMessages.length > 0 ? `(${pinnedMessages.length})` : ''}</Text>
                </View>
                <Ionicons name={infoShowPinned ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {infoShowPinned && (
                <View>
                  {pinnedMessages.length === 0 ? (
                    <Text style={[styles.infoPanelEmpty, { color: colors.textSecondary }]}>Chưa có tin nhắn ghim</Text>
                  ) : pinnedMessages.map((pin, idx) => (
                    <TouchableOpacity key={pin.id || pin.messageId} style={[styles.infoPanelPinnedRow, { borderBottomColor: colors.border }]} onPress={() => { void props.onJumpToPinnedMessage(pin.messageId); }}>
                      <View style={styles.infoPanelPinnedIndex}><Text style={styles.infoPanelPinnedIndexText}>{idx + 1}</Text></View>
                      <View style={styles.infoPanelPinnedContent}>
                        <Text style={[styles.infoPanelPinnedSender, { color: '#0068FF' }]} numberOfLines={1}>{pin.senderName}</Text>
                        <View style={styles.infoPanelPinnedPreviewRow}>
                          <Text style={[styles.infoPanelPinnedText, { color: colors.text }]} numberOfLines={2}>{getPinnedPreviewText(pin)}</Text>
                          {getPinnedPreviewThumb(pin) ? <Image source={{ uri: getPinnedPreviewThumb(pin) }} style={styles.infoPanelPinnedThumb} resizeMode="cover" /> : null}
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => { void handleUnpinFromPinnedList(pin.messageId); }}>
                        <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Media */}
          <View style={[styles.infoPanelSection, { borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.infoPanelSectionToggle} onPress={() => setInfoShowMedia((v) => !v)}>
              <View style={styles.infoPanelSectionToggleLeft}>
                <Ionicons name="images-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.infoPanelSectionTitle, { color: colors.text, marginLeft: 8 }]}>Ảnh &amp; Video</Text>
              </View>
              <Ionicons name={infoShowMedia ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {infoShowMedia && (
              <View>
                {infoMediaItems.length === 0 ? (
                  <Text style={[styles.infoPanelEmpty, { color: colors.textSecondary }]}>Chưa có ảnh hoặc video</Text>
                ) : (
                  <>
                    <View style={styles.infoPanelMediaGridHeader}>
                      <Text style={[styles.infoPanelMediaGridHint, { color: colors.textSecondary }]}>Tổng {infoMediaItems.length} ảnh/video</Text>
                      <TouchableOpacity style={styles.infoPanelMediaExpandBtn} onPress={openInfoMediaBrowser}>
                        <Text style={styles.infoPanelMediaExpandBtnText}>Chi tiết</Text>
                        <Ionicons name="arrow-forward" size={14} color="#0068FF" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.infoPanelMediaGrid}>
                      {infoMediaPreviewItems.map((m: any, i: number) => (
                        <TouchableOpacity key={`${getInfoMediaId(m, i)}-${m?.content ?? ''}-${i}`} style={styles.infoPanelMediaThumb} onPress={() => handleOpenInfoMediaGallery(i)}>
                          {m.messageType === 'IMAGE' ? (
                            <Image source={{ uri: m.content }} style={styles.infoPanelMediaThumbImg} resizeMode="cover" />
                          ) : (
                            <View style={[styles.infoPanelMediaThumbImg, { backgroundColor: '#101010', justifyContent: 'center', alignItems: 'center' }]}>
                              {(() => {
                                const mediaId = getInfoMediaId(m, i);
                                const thumbUri = String(m?.thumbnailUrl ?? infoVideoThumbnailsByMediaId[mediaId] ?? '').trim();
                                return thumbUri ? <Image source={{ uri: thumbUri }} style={styles.infoPanelMediaThumbImg} resizeMode="cover" /> : null;
                              })()}
                              <View style={styles.infoPanelMediaPlayOverlay}><Ionicons name="play" size={14} color="#FFFFFF" /></View>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Files */}
          <View style={[styles.infoPanelSection, { borderBottomColor: colors.border, marginBottom: 32 }]}>
            <TouchableOpacity style={styles.infoPanelSectionToggle} onPress={() => setInfoShowFiles((v) => !v)}>
              <View style={styles.infoPanelSectionToggleLeft}>
                <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.infoPanelSectionTitle, { color: colors.text, marginLeft: 8 }]}>Tệp đính kèm</Text>
              </View>
              <Ionicons name={infoShowFiles ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {infoShowFiles && (
              <View>
                {infoFileItems.length === 0 ? (
                  <Text style={[styles.infoPanelEmpty, { color: colors.textSecondary }]}>Chưa có tệp đính kèm</Text>
                ) : infoFileItems.slice(0, 10).map((f: any, i: number) => {
                  const rawName = (f.content ?? '').split('/').pop()?.split('_').slice(1).join('_') || 'Tệp đính kèm';
                  const fileName = decodeURIComponent(rawName);
                  const ext = fileName.split('.').pop()?.toLowerCase() || '';
                  const extColor = ext === 'pdf' ? '#F40F02' : ['doc', 'docx'].includes(ext) ? '#0068FF' : ['xls', 'xlsx'].includes(ext) ? '#217346' : '#6B7280';
                  return (
                    <TouchableOpacity key={f.id || i} style={styles.infoPanelFileRow} onPress={() => f.content && Linking.openURL(f.content)}>
                      <View style={[styles.infoPanelFileIcon, { backgroundColor: extColor }]}>
                        <Text style={styles.infoPanelFileExt}>{ext.toUpperCase().slice(0, 3) || 'FILE'}</Text>
                      </View>
                      <View style={styles.infoPanelFileInfo}>
                        <Text style={[styles.infoPanelFileName, { color: colors.text }]} numberOfLines={1}>{fileName}</Text>
                        {f.fileSize ? <Text style={[styles.infoPanelFileSize, { color: colors.textSecondary }]}>{chatFileService.formatFileSize(f.fileSize)}</Text> : null}
                      </View>
                      <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Footer */}
          {props.isGroupConversation && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <TouchableOpacity style={styles.infoPanelDangerBtn} onPress={handleInfoLeaveGroup}>
                <Ionicons name="exit-outline" size={16} color="#F04343" />
                <Text style={styles.infoPanelDangerBtnText}>{infoIsAdmin ? 'Chuyển quyền & rời nhóm' : 'Rời nhóm'}</Text>
              </TouchableOpacity>
              {infoIsAdmin && (
                <TouchableOpacity style={[styles.infoPanelDangerBtn, { marginTop: 6 }]} onPress={handleInfoDissolveGroup}>
                  <Ionicons name="warning-outline" size={16} color="#DC2626" />
                  <Text style={[styles.infoPanelDangerBtnText, { color: '#DC2626' }]}>Giải tán nhóm</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Media Gallery */}
      <Modal visible={isInfoMediaGalleryVisible} transparent animationType="fade" onRequestClose={closeInfoMediaGallery}>
        <View style={styles.infoMediaGalleryBackdrop}>
          <View style={styles.infoMediaGalleryTopBar}>
            <TouchableOpacity onPress={closeInfoMediaGallery}><Text style={styles.infoMediaGalleryCloseText}>X</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setIsInfoGalleryMenuVisible(true)}><Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" /></TouchableOpacity>
          </View>
          <FlatList
            ref={infoMediaGalleryRef}
            data={infoMediaItems}
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.max(0, Math.min(infoMediaGalleryStartIndex, Math.max(infoMediaItems.length - 1, 0)))}
            keyExtractor={(item: any, index) => String(item?.id ?? `${item?.messageId ?? 'media'}-${item?.content ?? ''}-${index}`)}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (!Number.isNaN(nextIndex)) {
                setInfoMediaGalleryIndex(Math.max(0, Math.min(nextIndex, infoMediaItems.length - 1)));
                setInfoGalleryPlayingMediaId(null); setIsInfoGalleryVideoLoading(false); setIsInfoGalleryMenuVisible(false);
              }
            }}
            onScrollToIndexFailed={(info) => { infoMediaGalleryRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false }); }}
            renderItem={({ item, index }) => {
              const mediaType = getInfoMediaType(item);
              const mediaUrl = getInfoMediaUrl(item);
              const mediaId = getInfoMediaId(item, index);
              const isVideo = mediaType === 'VIDEO';
              const isPlayingVideo = infoGalleryPlayingMediaId === mediaId;
              const fallbackThumb = String(item?.thumbnailUrl ?? infoVideoThumbnailsByMediaId[mediaId] ?? '').trim();
              return (
                <View style={styles.infoMediaGalleryItem}>
                  {isVideo ? (
                    isPlayingVideo ? (
                      <View style={styles.infoMediaGalleryVideoWrap}>
                        <Video source={{ uri: mediaUrl }} style={styles.infoMediaGalleryVideo} useNativeControls shouldPlay resizeMode={ResizeMode.CONTAIN}
                          onLoadStart={() => setIsInfoGalleryVideoLoading(true)} onReadyForDisplay={() => setIsInfoGalleryVideoLoading(false)} onError={() => setIsInfoGalleryVideoLoading(false)} />
                        {isInfoGalleryVideoLoading ? <View style={styles.infoMediaGalleryVideoLoadingOverlay}><ActivityIndicator size="large" color="#FFFFFF" /></View> : null}
                      </View>
                    ) : (
                      <TouchableOpacity activeOpacity={0.85} style={styles.infoMediaGalleryVideoPosterWrap} onPress={() => handlePlayInfoGalleryVideo(item, index)}>
                        {fallbackThumb ? <Image source={{ uri: fallbackThumb }} style={styles.infoMediaGalleryImage} resizeMode="contain" /> : <View style={styles.infoMediaGalleryVideoPlaceholder} />}
                        <View style={styles.infoMediaGalleryVideoPlayButton}><Ionicons name="play" size={28} color="#FFFFFF" /></View>
                      </TouchableOpacity>
                    )
                  ) : (
                    <Image source={{ uri: mediaUrl }} style={styles.infoMediaGalleryImage} resizeMode="contain" />
                  )}
                </View>
              );
            }}
          />
          <Modal visible={isInfoGalleryMenuVisible} transparent animationType="fade" onRequestClose={() => setIsInfoGalleryMenuVisible(false)}>
            <Pressable style={styles.infoMediaActionSheetBackdrop} onPress={() => setIsInfoGalleryMenuVisible(false)}>
              <Pressable style={styles.infoMediaActionSheet} onPress={(e) => e.stopPropagation()}>
                <TouchableOpacity style={styles.infoMediaActionSheetItem} onPress={() => { setIsInfoGalleryMenuVisible(false); void handleDownloadInfoGalleryCurrent(); }}>
                  <Text style={styles.infoMediaActionSheetItemText}>Tải về</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.infoMediaActionSheetItem} onPress={() => { setIsInfoGalleryMenuVisible(false); handleViewOriginalMessageFromGallery(); }}>
                  <Text style={styles.infoMediaActionSheetItemText}>Xem tin nhắn gốc</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      </Modal>

      {/* Global Busy */}
      <Modal visible={isJumpingToMessage || isDownloadingInfoMedia} transparent animationType="fade">
        <View style={styles.globalBusyOverlay}>
          <View style={styles.globalBusyCard}>
            {isDownloadingInfoMedia ? (
              <>
                <View style={styles.globalProgressTrack}><View style={[styles.globalProgressFill, { width: `${Math.max(0, Math.min(100, infoDownloadProgress))}%` }]} /></View>
                <Text style={styles.globalBusyPercent}>{`${Math.max(0, Math.min(100, infoDownloadProgress))}%`}</Text>
              </>
            ) : (<ActivityIndicator size="large" color="#FFFFFF" />)}
            <Text style={styles.globalBusyText}>{isDownloadingInfoMedia ? 'Đang tải media...' : 'Đang tải đoạn hội thoại...'}</Text>
          </View>
        </View>
      </Modal>

      {/* Media Browser */}
      <Modal visible={isInfoMediaBrowserVisible} animationType="slide" onRequestClose={() => setIsInfoMediaBrowserVisible(false)}>
        <SafeAreaView style={styles.infoMediaBrowserContainer}>
          <View style={styles.infoMediaBrowserHeader}>
            <TouchableOpacity onPress={() => setIsInfoMediaBrowserVisible(false)}><Ionicons name="arrow-back" size={24} color="#FFFFFF" /></TouchableOpacity>
            <Text style={styles.infoMediaBrowserTitle}>Ảnh, video</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.infoMediaBrowserFilterRow}>
            {(['ALL', 'IMAGE', 'VIDEO'] as const).map((f) => (
              <TouchableOpacity key={f} style={[styles.infoMediaBrowserFilterBtn, infoMediaBrowserFilter === f && styles.infoMediaBrowserFilterBtnActive]}
                onPress={() => setInfoMediaBrowserFilter(f)}>
                <Text style={[styles.infoMediaBrowserFilterText, infoMediaBrowserFilter === f && styles.infoMediaBrowserFilterTextActive]}>
                  {f === 'ALL' ? 'Tất cả' : f === 'IMAGE' ? 'Ảnh' : 'Video'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlatList data={infoMediaBrowserItems} keyExtractor={(item: any, index) => String(item?.id ?? `${item?.messageId ?? 'media'}-${item?.content ?? ''}-${index}`)}
            numColumns={3} contentContainerStyle={styles.infoMediaBrowserGrid} columnWrapperStyle={styles.infoMediaBrowserRow}
            renderItem={({ item, index }) => {
              const mediaType = getInfoMediaType(item);
              const mediaId = getInfoMediaId(item, index);
              const thumbUri = String(item?.thumbnailUrl ?? infoVideoThumbnailsByMediaId[mediaId] ?? '').trim();
              return (
                <TouchableOpacity style={styles.infoMediaBrowserThumb} onPress={() => { setIsInfoMediaBrowserVisible(false); handleOpenInfoMediaGallery(index); }}>
                  {mediaType === 'IMAGE' ? (
                    <Image source={{ uri: getInfoMediaUrl(item) }} style={styles.infoMediaBrowserThumbImage} resizeMode="cover" />
                  ) : (
                    <>
                      {thumbUri ? <Image source={{ uri: thumbUri }} style={styles.infoMediaBrowserThumbImage} resizeMode="cover" /> : null}
                      <View style={styles.infoMediaBrowserThumbOverlay}><Ionicons name="play" size={20} color="#FFFFFF" /></View>
                    </>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.infoMediaBrowserEmpty}>Không có media</Text>}
          />
        </SafeAreaView>
      </Modal>

      {/* Edit Name Modal */}
      <Modal visible={infoEditNameVisible} transparent animationType="fade" onRequestClose={() => setInfoEditNameVisible(false)}>
        <Pressable style={styles.infoNameModalBackdrop} onPress={() => setInfoEditNameVisible(false)}>
          <Pressable style={[styles.infoNameModalCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.infoNameModalTitle, { color: colors.text }]}>Đổi tên nhóm</Text>
            <TextInput value={infoEditNameValue} onChangeText={setInfoEditNameValue} maxLength={100} autoFocus placeholder="Nhập tên nhóm"
              placeholderTextColor={colors.textSecondary} style={[styles.infoNameModalInput, { color: colors.text, borderColor: colors.border }]} />
            <View style={styles.infoNameModalActions}>
              <TouchableOpacity style={[styles.infoNameModalBtn, { borderColor: colors.border }]} onPress={() => setInfoEditNameVisible(false)}>
                <Text style={[styles.infoNameModalBtnText, { color: colors.textSecondary }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.infoNameModalBtnPrimary, (infoUpdatingGroupName || !infoEditNameValue.trim()) && styles.infoNameModalBtnPrimaryDisabled]}
                onPress={() => { void handleInfoUpdateGroupName(); }} disabled={infoUpdatingGroupName || !infoEditNameValue.trim()}>
                <Text style={styles.infoNameModalBtnPrimaryText}>{infoUpdatingGroupName ? '...' : 'Lưu'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Member Modal */}
      <Modal visible={infoAddMemberVisible} animationType="slide" onRequestClose={handleCloseInfoAddMemberModal}>
        <SafeAreaView style={[styles.addMemberModalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.addMemberModalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.addMemberModalBackBtn} onPress={handleCloseInfoAddMemberModal}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.addMemberModalHeaderCenter}>
              <Text style={[styles.addMemberModalTitle, { color: colors.text }]}>Thêm thành viên</Text>
              <Text style={[styles.addMemberModalSubtitle, { color: colors.textSecondary }]}>Đã có: {infoMemberCount}/{MAX_GROUP_MEMBERS}</Text>
            </View>
            <TouchableOpacity style={[styles.addMemberModalActionBtn, (!infoSelectedMembers.length || infoAddingMembers) && styles.addMemberModalActionBtnDisabled]}
              onPress={handleInfoAddMembers} disabled={!infoSelectedMembers.length || infoAddingMembers}>
              <Text style={styles.addMemberModalActionBtnText}>{infoAddingMembers ? '...' : 'Thêm'}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.searchWrap, { backgroundColor: colors.surface }]}>
            <Ionicons name="search" size={26} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput value={infoAddMemberSearch} onChangeText={setInfoAddMemberSearch} placeholder="Tìm tên hoặc số điện thoại"
              placeholderTextColor={colors.textSecondary} style={[styles.addMemberSearchInput, { color: colors.text }]} />
          </View>
          <View style={styles.addMemberListWrap}>
            <FlatList data={infoAddMemberListData} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false} contentContainerStyle={styles.addMemberListContent}
              renderItem={({ item }: { item: any }) => {
                if (item.type === 'header') {
                  return (<View style={[styles.addMemberLetterRow, { borderTopColor: colors.border }]}><Text style={[styles.addMemberLetterText, { color: colors.text }]}>{item.letter}</Text></View>);
                }
                const friend = item.item;
                const friendId = getFriendId(friend);
                const friendName = getFriendDisplayName(friend);
                const friendAvatar = getFriendAvatar(friend);
                const selected = infoSelectedMembers.includes(friendId);
                return (
                  <TouchableOpacity style={[styles.addMemberFriendRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (!friendId) return;
                      setInfoSelectedMembers((prev) => (prev.includes(friendId) ? prev.filter((id: string) => id !== friendId)
                        : (prev.length >= infoRemainingMemberSlots ? (Alert.alert('Giới hạn nhóm', `Nhóm chỉ còn chỗ cho ${infoRemainingMemberSlots} thành viên.`), prev) : [...prev, friendId])));
                    }}>
                    {friendAvatar ? <Image source={getAvatarSource(friendAvatar)} style={styles.addMemberAvatar} /> : (
                      <View style={[styles.addMemberAvatar, { backgroundColor: '#4A90D9' }]}><Text style={styles.addMemberAvatarText}>{friendName.charAt(0).toUpperCase()}</Text></View>
                    )}
                    <View style={styles.addMemberFriendInfo}>
                      <Text style={[styles.addMemberFriendName, { color: colors.text }]} numberOfLines={1}>{friendName}</Text>
                      {friend.email ? <Text style={[styles.addMemberFriendSub, { color: colors.textSecondary }]} numberOfLines={1}>{friend.email}</Text> : null}
                    </View>
                    <View style={[styles.addMemberCheckCircle, selected && styles.addMemberCheckCircleSelected]}>
                      {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<View style={styles.addMemberEmptyWrap}><Text style={[styles.addMemberEmptyText, { color: colors.textSecondary }]}>Không tìm thấy bạn bè phù hợp</Text></View>}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </Modal>

      {/* Group Permissions Modal */}
      <GroupPermissionsModal
        visible={infoPermissionsVisible}
        onClose={() => setInfoPermissionsVisible(false)}
        conversationId={props.conversationId}
        currentPermissions={currentPermissions}
      />
    </>
  );
}
