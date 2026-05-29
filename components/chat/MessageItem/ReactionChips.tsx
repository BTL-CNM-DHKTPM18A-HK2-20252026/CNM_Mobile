import React from 'react';
import { Text, View } from 'react-native';

interface ReactionSummaryItem {
  emoji: string;
  count: number | string;
}

interface Props {
  reactions: ReactionSummaryItem[];
  messageId: string;
  styles: any;
}

export const ReactionChips: React.FC<Props> = ({ reactions, messageId, styles }) => {
  if (!reactions || reactions.length === 0) return null;
  return (
    <View style={styles.reactionRowRight || styles.reactionRowLeft}>
      {reactions.map((reaction) => (
        <View key={`${messageId}-${reaction.emoji}`} style={styles.reactionChip}>
          <Text style={styles.reactionChipText}>{reaction.emoji} {String(reaction.count)}</Text>
        </View>
      ))}
    </View>
  );
};

export default ReactionChips;
