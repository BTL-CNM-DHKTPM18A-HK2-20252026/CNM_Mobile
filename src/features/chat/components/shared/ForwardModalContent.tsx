import React from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export type ForwardModalContentProps = any;

export const ForwardModalContent: React.FC<ForwardModalContentProps> = ({
  forwardingMsg,
  filteredFwdConversations = [],
  fwdLoading,
  fwdSelected,
  onToggleSelect,
  onLoadConversations,
  fwdSearch,
  setFwdSearch,
  onSend,
  fwdSending,
  getForwardAttachmentUrls,
  getForwardPreviewText,
  videoThumbnailsByMessageId,
  colors,
  styles,
  t,
  onClose,
}) => {
  return (
    <>
      <View style={[styles.fwdHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: colors.text }}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.fwdTitle, { color: colors.text }]}>Chuyển tiếp tin nhắn</Text>
        <View style={{ width: 22 }} />
      </View>

      {forwardingMsg ? (
        <View style={[styles.fwdPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.fwdPreviewText, { color: colors.textSecondary }]} numberOfLines={2}>
            {getForwardPreviewText(forwardingMsg)}
          </Text>
        </View>
      ) : null}

      <View style={[styles.fwdSearchRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text>🔍</Text>
        <TextInput
          style={[styles.fwdSearchInput, { color: colors.text }]}
          placeholder="Tìm cuộc trò chuyện..."
          placeholderTextColor={colors.textSecondary}
          value={fwdSearch}
          onChangeText={setFwdSearch}
          onFocus={() => { if (filteredFwdConversations.length === 0 && !fwdLoading) onLoadConversations?.(fwdSearch); }}
        />
      </View>

      {filteredFwdConversations.length === 0 && !fwdLoading ? (
        <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center' }} onPress={() => onLoadConversations?.(fwdSearch)}>
          <Text style={{ color: '#0068FF', fontSize: 13 }}>Tải danh sách</Text>
        </TouchableOpacity>
      ) : null}

      <ScrollView style={styles.fwdList}>
        {fwdLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color="#2F87F2" />
        ) : (
          filteredFwdConversations.map((c: any) => {
            const cId = c.id;
            const cName = c.name || 'Cuộc trò chuyện';
            const isSelected = fwdSelected.has(cId);
            return (
              <TouchableOpacity key={cId} style={[styles.fwdItem, { borderBottomColor: colors.border }]} onPress={() => onToggleSelect?.(cId)}>
                <View style={styles.fwdItemAvatar}>
                  {c.avatarUrl ? <Image source={{ uri: c.avatarUrl }} style={styles.fwdItemAvatarImage} /> : <Text style={styles.fwdItemAvatarText}>{cName.charAt(0).toUpperCase()}</Text>}
                </View>
                <Text style={[styles.fwdItemName, { color: colors.text }]} numberOfLines={1}>{cName}</Text>
                <View style={[styles.fwdCheckbox, isSelected && styles.fwdCheckboxSelected, { borderColor: isSelected ? '#0068FF' : colors.border }]}>
                  {isSelected ? <Text>✓</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.fwdFooter, { borderTopColor: colors.border }]}>
        {fwdSelected.size > 0 ? (
          <Text style={[styles.fwdSelectedCount, { color: colors.textSecondary }]}>{`Đã chọn ${fwdSelected.size} cuộc trò chuyện`}</Text>
        ) : <View />}
        <TouchableOpacity style={[styles.fwdSendBtn, { opacity: fwdSelected.size === 0 || fwdSending ? 0.5 : 1 }]} disabled={fwdSelected.size === 0 || fwdSending} onPress={onSend}>
          {fwdSending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.fwdSendBtnText}>Gửi</Text>}
        </TouchableOpacity>
      </View>
    </>
  );
};

export default ForwardModalContent;
