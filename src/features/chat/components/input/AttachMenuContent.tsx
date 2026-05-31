import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export type AttachMenuContentProps = any;

export const AttachMenuContent: React.FC<AttachMenuContentProps> = ({ onPickImage, onPickVideo, onPickFile, onTakePhoto, onShareContact, onCreatePoll, colors, styles }) => {
  return (
    <>
      <Text style={[styles.attachMenuTitle, { color: colors.text }]}>Gửi tệp đính kèm</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionGridItem} onPress={onPickImage}>
          <View style={[styles.actionGridIcon, { backgroundColor: '#E8F5E9' }]}>
            <Text>🖼️</Text>
          </View>
          <Text style={[styles.actionGridLabel, { color: colors.text }]}>Hình ảnh</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionGridItem} onPress={onPickVideo}>
          <View style={[styles.actionGridIcon, { backgroundColor: '#E3F2FD' }]}>
            <Text>🎬</Text>
          </View>
          <Text style={[styles.actionGridLabel, { color: colors.text }]}>Video</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionGridItem} onPress={onPickFile}>
          <View style={[styles.actionGridIcon, { backgroundColor: '#FFF3E0' }]}>
            <Text>📄</Text>
          </View>
          <Text style={[styles.actionGridLabel, { color: colors.text }]}>Tệp</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionGridItem} onPress={onTakePhoto}>
          <View style={[styles.actionGridIcon, { backgroundColor: '#FCE4EC' }]}>
            <Text>📷</Text>
          </View>
          <Text style={[styles.actionGridLabel, { color: colors.text }]}>Chụp ảnh</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionGridItem} onPress={onShareContact}>
          <View style={[styles.actionGridIcon, { backgroundColor: '#E8F4FD' }]}>
            <Text>👤</Text>
          </View>
          <Text style={[styles.actionGridLabel, { color: colors.text }]}>Danh thiếp</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionGridItem} onPress={onCreatePoll}>
          <View style={[styles.actionGridIcon, { backgroundColor: '#F3E8FF' }]}>
            <Text>📊</Text>
          </View>
          <Text style={[styles.actionGridLabel, { color: colors.text }]}>Bình chọn</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

export default AttachMenuContent;
