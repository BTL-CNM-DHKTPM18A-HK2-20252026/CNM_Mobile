import React from 'react';
import { Modal, View } from 'react-native';

export type AttachmentsViewerProps = {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
};

export const AttachmentsViewer: React.FC<AttachmentsViewerProps> = ({ visible, onClose, children }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>{children}</View>
    </Modal>
  );
};
