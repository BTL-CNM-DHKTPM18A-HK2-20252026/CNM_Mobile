import React from 'react';
import { Modal, View } from 'react-native';

export type MediaViewerProps = {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
};

export const MediaViewer: React.FC<MediaViewerProps> = ({ visible, onClose, children }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>{children}</View>
    </Modal>
  );
};
