import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getPinnedMessagePreviewText, getPinnedMessageThumbnailUrl } from './pinnedMessageDisplay';

export type PinnedListContentProps = any;

export const PinnedListContent: React.FC<PinnedListContentProps> = ({ pinnedMessages = [], onClose, onJump, onUnpin, colors, styles, t }) => {
  return (
    <SafeAreaView edges={['left', 'right', 'top']}>
      <View style={styles.pinnedHeader}>
        <Text style={[styles.pinnedTitle, { color: colors.text }]}>{t('chat.pinned_title', 'Tin nhắn đã ghim')}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: colors.textSecondary }}>X</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.pinnedList}>
        {pinnedMessages.length === 0 ? (
          <Text style={[styles.pinnedEmpty, { color: colors.textSecondary }]}>{t('chat.pinned_empty', 'Chưa có tin nhắn ghim')}</Text>
        ) : pinnedMessages.map((item: any) => (
          <TouchableOpacity
            key={item.id || item.messageId}
            style={[styles.pinnedItem, { borderBottomColor: colors.border }]}
            onPress={() => onJump?.(item.messageId)}
          >
            <View style={styles.pinnedItemMain}>
              <Text style={[styles.pinnedSender, { color: colors.text }]} numberOfLines={1}>{item.senderName || t('chat.unknown_user', 'Người dùng')}</Text>
              <View style={styles.pinnedContentRow}>
                <Text style={[styles.pinnedContent, { color: colors.textSecondary }]} numberOfLines={2}>
                  {getPinnedMessagePreviewText(item)}
                </Text>
                {getPinnedMessageThumbnailUrl(item) ? (
                  <Image source={{ uri: getPinnedMessageThumbnailUrl(item) }} style={styles.pinnedItemThumb} resizeMode="cover" />
                ) : null}
              </View>
            </View>
            <TouchableOpacity onPress={() => onUnpin?.(item.messageId)} style={styles.unpinButton} accessibilityRole="button" accessibilityLabel={t('chat.pinned_remove', 'Xóa ghim')}>
              <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default PinnedListContent;
