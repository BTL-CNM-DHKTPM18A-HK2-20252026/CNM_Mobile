import React from 'react';
import { View } from 'react-native';

export type MessageInputProps = {
  children?: React.ReactNode;
};

export const MessageInput: React.FC<MessageInputProps> = ({ children }) => {
  return <View>{children}</View>;
};
