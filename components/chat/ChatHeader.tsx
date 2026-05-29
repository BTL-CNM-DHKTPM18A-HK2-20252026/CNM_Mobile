import React from 'react';
import { View } from 'react-native';

export type ChatHeaderProps = {
  children?: React.ReactNode;
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({ children }) => {
  return <View>{children}</View>;
};
