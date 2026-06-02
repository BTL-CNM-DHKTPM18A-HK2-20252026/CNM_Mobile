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
  isFirstInBlock?: boolean;
  onReactionPress?: () => void;
  isCompactBubble?: boolean;
  statusLabel?: string | null;
  onAvatarPress?: () => void;
  isMediaMessage?: boolean;
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
  isFirstInBlock = false,
  onReactionPress,
  isCompactBubble = false,
  statusLabel = null,
  onAvatarPress,
  isMediaMessage = false,
}) => {
  const bubbleStyle = isMediaMessage
    ? [
        styles.mediaBubble,
        isCurrentUserMessage ? styles.mediaBubbleRight : styles.mediaBubbleLeft,
      ]
    : [
        styles.messageBubble,
        isCompactBubble && styles.messageBubbleCompact,
        !isFirstInBlock && styles.messageBubbleStackedTop,
        !isLastInBlock && styles.messageBubbleStackedBottom,
        isCurrentUserMessage ? styles.userBubble : [styles.otherBubble, { backgroundColor: colors.card }],
      ];

  return (
    <View
      style={[
        styles.messageContainer,
        { marginBottom: isLastInBlock ? (showTimestamp ? 12 : 6) : 1 },
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
            <TouchableOpacity activeOpacity={1} onLongPress={onLongPress} delayLongPress={220} style={bubbleStyle}>
              {mediaContent}
              {!isMediaMessage && showTimestamp ? <Text style={[styles.timestamp, styles.timestampInlineRight]}>{timeLabel}</Text> : null}
              {!isMediaMessage && statusLabel ? <Text style={[styles.timestamp, styles.timestampInlineRight, { marginTop: 1, opacity: 0.85 }]}>{statusLabel}</Text> : null}
            </TouchableOpacity>

            <ReactionChips reactions={reactionSummary as any} messageId={item.messageId} styles={styles} align="right" onPress={onReactionPress} />
          </View>
          {isMediaMessage && showTimestamp ? <Text style={[styles.timestamp, styles.timestampRight]}>{timeLabel}</Text> : null}
          {isMediaMessage && statusLabel ? <Text style={[styles.timestamp, styles.timestampRight, { marginTop: 1, opacity: 0.85 }]}>{statusLabel}</Text> : null}
        </View>
      ) : (
        <View style={styles.otherMessageBlock}>
          <View style={styles.otherAvatarSlot}>
            {showAvatar && senderAvatarSource ? (
              onAvatarPress ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={onAvatarPress}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Image source={senderAvatarSource} style={styles.peerAvatar} />
                </TouchableOpacity>
              ) : (
                <Image source={senderAvatarSource} style={styles.peerAvatar} />
              )
            ) : null}
          </View>
          <View style={styles.otherContentBlock}>
            {showSenderName ? (
              <Text style={[styles.groupSenderName, { color: colors.textSecondary }]} numberOfLines={1}>
                {senderDisplayName}
              </Text>
            ) : null}
            <View style={styles.bubbleWrapper}>
              <TouchableOpacity activeOpacity={1} onLongPress={onLongPress} delayLongPress={220} style={bubbleStyle}>
                {mediaContent}
                {!isMediaMessage && showTimestamp ? <Text style={[styles.timestamp, styles.timestampInlineLeft]}>{timeLabel}</Text> : null}
              </TouchableOpacity>

              <ReactionChips reactions={reactionSummary as any} messageId={item.messageId} styles={styles} align="right" onPress={onReactionPress} />
            </View>
            {isMediaMessage && showTimestamp ? <Text style={[styles.timestamp, styles.timestampLeft]}>{timeLabel}</Text> : null}
          </View>
        </View>
      )}
    </View>
  );
};

export default React.memo(MessageItem);
