import React from 'react';
import { FlatList } from 'react-native';

export type MessageListProps = {
  messages: any[];
  renderItem: ({ item, index }: { item: any; index: number }) => React.ReactElement | null;
  listRef?: React.RefObject<FlatList<any>>;
};

export const MessageList: React.FC<MessageListProps> = ({ messages, renderItem, listRef }) => {
  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => String((item as any).messageId)}
      renderItem={renderItem as any}
    />
  );
};
