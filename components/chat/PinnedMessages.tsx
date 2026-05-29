import React from 'react';
import { View } from 'react-native';

export type PinnedMessagesProps = {
  children?: React.ReactNode;
};

export const PinnedMessages: React.FC<PinnedMessagesProps> = ({ children }) => {
  return <View>{children}</View>;
};
