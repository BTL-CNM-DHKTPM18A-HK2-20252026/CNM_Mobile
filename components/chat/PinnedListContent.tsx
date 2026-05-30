import React from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export type PinnedListContentProps = any;

export const PinnedListContent: React.FC<PinnedListContentProps> = ({ pinnedMessages = [], onClose, onJump, onUnpin, colors, styles, t }) => {
  return (
    <>
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
                  {item.content}
                </Text>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.pinnedItemThumb} resizeMode="cover" />
                ) : null}
              </View>
            </View>
            <TouchableOpacity onPress={() => onUnpin?.(item.messageId)} style={styles.unpinButton}>
              <Text style={{ color: colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
};

export default PinnedListContent;
