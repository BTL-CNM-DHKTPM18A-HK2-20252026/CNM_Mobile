import React from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export type ShareContactContentProps = any;

export const ShareContactContent: React.FC<ShareContactContentProps> = ({ scFriends = [], scLoading, scSelected, setScSelected, scSearch, setScSearch, onSend, scSending, scIncludePhone, setScIncludePhone, colors, styles, t, onClose }) => {
  return (
    <>
      <View style={[styles.fwdHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose}><Text style={{ color: colors.text }}>✕</Text></TouchableOpacity>
        <Text style={[styles.fwdTitle, { color: colors.text }]}>Gửi danh thiếp</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.scToggleRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.scToggleLabel, { color: colors.text }]}>Bao gồm số điện thoại</Text>
        <TouchableOpacity style={[styles.scToggle, { backgroundColor: scIncludePhone ? '#0068FF' : colors.border }]} onPress={() => setScIncludePhone?.(!scIncludePhone)}>
          <View style={[styles.scToggleThumb, { left: scIncludePhone ? 18 : 2 }]} />
        </TouchableOpacity>
      </View>

      <View style={[styles.fwdSearchRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text>🔍</Text>
        <TextInput style={[styles.fwdSearchInput, { color: colors.text }]} placeholder="Tìm bạn bè..." placeholderTextColor={colors.textSecondary} value={scSearch} onChangeText={setScSearch} />
      </View>

      {scFriends.length === 0 && !scLoading ? (
        <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center' }} onPress={() => {}}>
          <Text style={{ color: '#0068FF', fontSize: 13 }}>Tải danh bạ</Text>
        </TouchableOpacity>
      ) : null}

      <ScrollView style={styles.fwdList}>
        {scLoading ? <ActivityIndicator style={{ marginTop: 20 }} color="#2F87F2" /> : (
          scFriends.filter((f: any) => {
            const name: string = f.displayName || f.display_name || f.fullName || '';
            const phone: string = f.phoneNumber || f.phone_number || '';
            const q = scSearch.toLowerCase();
            return name.toLowerCase().includes(q) || phone.includes(q);
          }).map((f: any) => {
            const fId: string = f.userId || f.user_id || f.id;
            const fName: string = f.displayName || f.display_name || f.fullName || 'Người dùng';
            const fPhone: string = f.phoneNumber || f.phone_number || '';
            const fAvatar: string = f.avatarUrl || f.avatar_url || f.avatar || '';
            const isSelected = scSelected.has(fId);
            return (
              <TouchableOpacity key={fId} style={[styles.fwdItem, { borderBottomColor: colors.border }]} onPress={() => {
                setScSelected((prev: Set<string>) => {
                  const next = new Set(prev);
                  if (isSelected) { next.delete(fId); } else if (next.size < 9) { next.add(fId); }
                  return next;
                });
              }}>
                <View style={styles.fwdItemAvatar}>
                  {fAvatar ? <Image source={{ uri: fAvatar }} style={{ width: 36, height: 36, borderRadius: 18 }} /> : <Text style={styles.fwdItemAvatarText}>{fName.charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fwdItemName, { color: colors.text }]} numberOfLines={1}>{fName}</Text>
                  {fPhone ? <Text style={{ fontSize: 12, color: colors.textSecondary }}>{fPhone}</Text> : null}
                </View>
                <View style={[styles.fwdCheckbox, isSelected && styles.fwdCheckboxSelected, { borderColor: isSelected ? '#0068FF' : colors.border }]}>
                  {isSelected ? <Text>✓</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.fwdFooter, { borderTopColor: colors.border }]}>
        {scSelected.size > 0 ? (
          <Text style={[styles.fwdSelectedCount, { color: colors.textSecondary }]}>{`Đã chọn ${scSelected.size}/9`}</Text>
        ) : <View />}
        <TouchableOpacity style={[styles.fwdSendBtn, { opacity: scSelected.size === 0 || scSending ? 0.5 : 1 }]} disabled={scSelected.size === 0 || scSending} onPress={onSend}>
          {scSending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.fwdSendBtnText}>Gửi</Text>}
        </TouchableOpacity>
      </View>
    </>
  );
};

export default ShareContactContent;
