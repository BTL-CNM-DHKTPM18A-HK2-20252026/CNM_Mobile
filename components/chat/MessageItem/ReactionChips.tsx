import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ReactionSummaryItem {
  emoji: string;
  count: number | string;
}

interface Props {
  reactions: ReactionSummaryItem[];
  messageId: string;
  styles: any;
  align?: 'left' | 'right';
  onPress?: () => void;
}

export const ReactionChips: React.FC<Props> = ({ reactions, messageId, styles, align = 'right', onPress }) => {
  if (!reactions || reactions.length === 0) return null;
  return (
    <View style={styles[align === 'left' ? 'reactionRowLeft' : 'reactionRowRight'] || styles.reactionRowRight}>
      <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress} style={styles.reactionChipWrap} disabled={!onPress}>
        {reactions.slice(0, 3).map((reaction) => (
          <View key={`${messageId}-${reaction.emoji}`} style={styles.reactionChip}>
            <Text style={styles.reactionChipText}>{reaction.emoji}</Text>
          </View>
        ))}
        <Text style={styles.reactionTotalText}>{reactions.reduce((sum, reaction) => sum + Number(reaction.count || 0), 0)}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ReactionChips;
