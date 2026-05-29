import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

export type MessageItemProps = any;

export const MessageItem: React.FC<MessageItemProps> = ({
  item,
  dateSepLabel,
  isCurrentUserMessage,
  showAvatar,
  showSenderName,
  senderDisplayName,
  senderAvatarSource,
  mediaContent,
  reactionSummary,
  showTimestamp,
  timeLabel,
  highlighted,
  onLongPress,
  colors,
  styles,
  playingVoiceId,
}) => {
  return (
    <View
      style={[
        styles.messageContainer,
        { marginBottom: showTimestamp ? 10 : 4 },
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
          <TouchableOpacity activeOpacity={1} onLongPress={onLongPress} delayLongPress={220} style={[styles.messageBubble, styles.userBubble]}>
            {mediaContent}
          </TouchableOpacity>

          {reactionSummary && reactionSummary.length > 0 ? (
            <View style={styles.reactionRowRight}>
              {reactionSummary.map((reaction: any) => (
                <View key={`${item.messageId}-${reaction.emoji}`} style={styles.reactionChip}>
                  <Text style={styles.reactionChipText}>{reaction.emoji} {reaction.count}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {showTimestamp ? <Text style={[styles.timestamp, styles.timestampRight]}>{timeLabel}</Text> : null}
        </View>
      ) : (
        <View style={styles.otherMessageBlock}>
          <View style={[styles.otherAvatarSlot, { marginBottom: showTimestamp ? 18 : 2 }]}>
            {showAvatar && senderAvatarSource ? <Image source={senderAvatarSource} style={styles.peerAvatar} /> : null}
          </View>
          <View style={styles.otherContentBlock}>
            {showSenderName ? (
              <Text style={[styles.groupSenderName, { color: colors.textSecondary }]} numberOfLines={1}>
                {senderDisplayName}
              </Text>
            ) : null}
            <TouchableOpacity activeOpacity={1} onLongPress={onLongPress} delayLongPress={220} style={[styles.messageBubble, styles.otherBubble, { backgroundColor: colors.card }]}>
              {mediaContent}
            </TouchableOpacity>

            {reactionSummary && reactionSummary.length > 0 ? (
              <View style={styles.reactionRowLeft}>
                {reactionSummary.map((reaction: any) => (
                  <View key={`${item.messageId}-${reaction.emoji}`} style={styles.reactionChip}>
                    <Text style={styles.reactionChipText}>{reaction.emoji} {reaction.count}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {showTimestamp ? <Text style={[styles.timestamp, styles.timestampLeft]}>{timeLabel}</Text> : null}
          </View>
        </View>
      )}
    </View>
  );
};

export default MessageItem;
