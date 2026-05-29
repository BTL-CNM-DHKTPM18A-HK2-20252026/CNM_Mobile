import React from 'react';
import { FlatList } from 'react-native';

export type MessageListProps = any;

export const MessageList: React.FC<MessageListProps> = ({ messages, listRef, ...rest }) => {
  return (
    <FlatList<any>
      ref={listRef}
      data={messages}
      keyExtractor={(item) => String((item as any).messageId)}
      {...(rest as any)}
    />
  );
};
