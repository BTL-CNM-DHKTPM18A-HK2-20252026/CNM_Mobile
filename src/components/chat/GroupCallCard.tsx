import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GroupCallCardProps {
  senderName: string;
  onJoin: () => void;
}

export const GroupCallCard: React.FC<GroupCallCardProps> = ({ senderName, onJoin }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="videocam" size={22} color="#FFF" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Cuộc gọi video nhóm</Text>
          <Text style={styles.subtitle}>{senderName} đã bắt đầu</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.joinBtn} onPress={onJoin} activeOpacity={0.8}>
        <Text style={styles.joinText}>Tham gia</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C5D5E7',
    overflow: 'hidden',
    width: 260,
  },
  header: {
    backgroundColor: '#0068FF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
  },
  joinBtn: {
    backgroundColor: '#FFF',
    paddingVertical: 10,
    alignItems: 'center',
  },
  joinText: {
    color: '#0068FF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default GroupCallCard;
