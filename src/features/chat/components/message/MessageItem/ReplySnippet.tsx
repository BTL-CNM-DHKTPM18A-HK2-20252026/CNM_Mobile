import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

interface Props {
  senderLabel: string;
  snippet: string;
  onPress: () => void;
  isCurrentUserMessage?: boolean;
  styles: any;
  colors?: any;
}

export const ReplySnippet: React.FC<Props> = ({ senderLabel, snippet, onPress, isCurrentUserMessage, styles }) => {
  return (
    <TouchableOpacity
      style={[styles.replySnippetBlock, isCurrentUserMessage ? styles.replySnippetBlockUser : styles.replySnippetBlockOther]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.replySnippetSender} numberOfLines={1}>
        {senderLabel}
      </Text>
      <Text style={[styles.replySnippetText, { color: '#4B5563' }]} numberOfLines={2}>
        {snippet}
      </Text>
    </TouchableOpacity>
  );
};

export default ReplySnippet;
