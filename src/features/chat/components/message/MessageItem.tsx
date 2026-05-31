import type { ChatUiReaction } from '@/services/chatMessageAdapter';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import ReactionChips from './MessageItem/ReactionChips';

type ReactionSummaryItem = { emoji: string; count: number };

export interface MessageItemProps {
  item: { messageId: string } & Record<string, any>;
  index?: number;
  dateSepLabel?: string | null;
  isCurrentUserMessage: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  senderDisplayName?: string;
  senderAvatarSource?: any;
  mediaContent?: React.ReactNode;
  reactionSummary?: ReactionSummaryItem[] | Array<Pick<ChatUiReaction, 'emoji'>>;
  showTimestamp?: boolean;
  timeLabel?: string;
  highlighted?: boolean;
  onLongPress?: () => void;
  colors?: any;
  styles: any;
  playingVoiceId?: string | null;
  isLastInBlock?: boolean;
  onReactionPress?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  item,
  dateSepLabel = null,
  isCurrentUserMessage,
  showAvatar,
  showSenderName,
  senderDisplayName,
  senderAvatarSource,
  mediaContent,
  reactionSummary = [],
  showTimestamp = false,
  timeLabel,
  highlighted = false,
  onLongPress,
  colors,
  styles,
  playingVoiceId,
  isLastInBlock = false,
  onReactionPress,
}) => {
  return (
    <View
      style={[
        styles.messageContainer,
        { marginBottom: isLastInBlock ? (showTimestamp ? 12 : 6) : 2 },
        highlighted && styles.messageContainerHighlighted,
      ]}
    >
      {dateSepLabel ? (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{dateSepLabel}</Text>
        </View>
      ) : null}

      {isCurrentUserMessage ? (
        <View style={styles.userMessageBlock}>
          <View style={styles.bubbleWrapper}>
            <TouchableOpacity activeOpacity={1} onLongPress={onLongPress} delayLongPress={220} style={[styles.messageBubble, styles.userBubble]}>
              {mediaContent}
            </TouchableOpacity>

            <ReactionChips reactions={reactionSummary as any} messageId={item.messageId} styles={styles} align="right" onPress={onReactionPress} />
          </View>

          {showTimestamp ? <Text style={[styles.timestamp, styles.timestampRight]}>{timeLabel}</Text> : null}
        </View>
      ) : (
        <View style={styles.otherMessageBlock}>
          <View style={[styles.otherAvatarSlot, { marginBottom: isLastInBlock ? 2 : 2 }]}>
            {showAvatar && senderAvatarSource ? <Image source={senderAvatarSource} style={styles.peerAvatar} /> : null}
          </View>
          <View style={styles.otherContentBlock}>
            {showSenderName ? (
              <Text style={[styles.groupSenderName, { color: colors.textSecondary }]} numberOfLines={1}>
                {senderDisplayName}
              </Text>
            ) : null}
            <View style={styles.bubbleWrapper}>
              <TouchableOpacity activeOpacity={1} onLongPress={onLongPress} delayLongPress={220} style={[styles.messageBubble, styles.otherBubble, { backgroundColor: colors.card }]}>
                {mediaContent}
              </TouchableOpacity>

              <ReactionChips reactions={reactionSummary as any} messageId={item.messageId} styles={styles} align="right" onPress={onReactionPress} />
            </View>

            {showTimestamp ? <Text style={[styles.timestamp, styles.timestampLeft]}>{timeLabel}</Text> : null}
          </View>
        </View>
      )}
    </View>
  );
};

export default React.memo(MessageItem);
