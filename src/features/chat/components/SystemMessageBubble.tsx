import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SystemMessageBubbleProps {
  content: string;
}

export const SystemMessageBubble = React.memo(({ content }: SystemMessageBubbleProps) => {
  return (
    <View style={styles.systemMessageRow}>
      <View style={styles.systemMessageBubble}>
        <Text style={styles.systemMessageText}>{content}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  systemMessageRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    paddingHorizontal: 20,
  },
  systemMessageBubble: {
    maxWidth: '88%',
    backgroundColor: 'rgba(120, 128, 140, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  systemMessageText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#6C7584',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default SystemMessageBubble;