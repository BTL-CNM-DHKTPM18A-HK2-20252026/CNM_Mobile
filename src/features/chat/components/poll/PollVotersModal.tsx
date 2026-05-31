import React, { useMemo, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PollOption {
  optionId: string;
  content: string;
  voterIds?: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  options: PollOption[];
  membersMap: Record<string, any>;
  currentUserId?: string;
  colors?: any;
}

export default function PollVotersModal({ visible, onClose, options, membersMap, currentUserId, colors }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  const allMemberIds = useMemo(() => Object.keys(membersMap || {}), [membersMap]);

  const optionLists = useMemo(() => {
    const lists: Array<{ id: string; title: string; members: string[] }> = [];
    (options || []).forEach((opt) => {
      lists.push({ id: opt.optionId, title: opt.content || '—', members: Array.isArray(opt.voterIds) ? opt.voterIds.map(String) : [] });
    });
    // not voted
    const voted = new Set<string>();
    lists.forEach((l) => l.members.forEach((m) => voted.add(String(m))));
    const notVoted = allMemberIds.filter((id) => !voted.has(id));
    lists.push({ id: '__not_voted', title: 'Chưa bình chọn', members: notVoted });
    return lists;
  }, [options, allMemberIds]);

  const active = optionLists[activeIdx] || { title: '', members: [] };

  const renderMemberRow = (memberId: string) => {
    const member = membersMap?.[memberId] ?? null;
    const name = member?.displayName || member?.fullName || member?.name || member?.username || memberId;
    const avatar = member?.avatarUrl || member?.avatar || member?.profilePicture || null;
    return (
      <View key={memberId} style={styles.row}>
        {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]} />}
        <Text style={[styles.name, { color: colors?.text ?? '#111' }]}>{name}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors?.background ?? '#fff' }]}> 
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors?.text ?? '#111' }]}>Người đã bình chọn</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Text style={{ color: '#0068FF', fontWeight: '700' }}>Đóng</Text></TouchableOpacity>
          </View>

          <View style={styles.tabsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
              {optionLists.map((opt, idx) => (
                <TouchableOpacity key={opt.id} onPress={() => setActiveIdx(idx)} style={[styles.tabItem, activeIdx === idx && styles.tabItemActive]}>
                  <Text style={[styles.tabText, { color: activeIdx === idx ? '#0068FF' : colors?.textSecondary ?? '#666' }]} numberOfLines={1}>{opt.title}</Text>
                  <Text style={[styles.tabCount, { color: activeIdx === idx ? '#0068FF' : colors?.textSecondary ?? '#666' }]}>{`(${opt.members.length})`}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.contentArea}>
            <Text style={[styles.sectionTitle, { color: colors?.textSecondary ?? '#666' }]}>{`${active.title} — ${active.members.length} người`}</Text>
            <ScrollView style={{ marginTop: 8 }}>
              {active.members.length === 0 ? (
                <Text style={[styles.empty, { color: colors?.textSecondary ?? '#666' }]}>Không có người nào</Text>
              ) : (
                active.members.map((mid) => renderMemberRow(mid))
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  container: { maxHeight: '80%', borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderColor: '#EEE' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 6 },
  tabsRow: { borderBottomWidth: 1, borderColor: '#F1F1F1', paddingVertical: 8 },
  tabItem: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 20, marginHorizontal: 6, backgroundColor: 'transparent' },
  tabItemActive: { backgroundColor: '#F0F8FF' },
  tabText: { fontSize: 13, fontWeight: '700', marginRight: 6, maxWidth: 140 },
  tabCount: { fontSize: 12, fontWeight: '700' },
  contentArea: { padding: 12, minHeight: 120 },
  sectionTitle: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F2F2F2' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#E6EEF9' },
  avatarFallback: { backgroundColor: '#D8E6F6' },
  name: { fontSize: 15, fontWeight: '600' },
  empty: { padding: 12, textAlign: 'center' },
});
