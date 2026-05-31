import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

interface Props {
  forwardedFromSenderName: string;
  isCurrentUserMessage?: boolean;
  styles: any;
}

export const ForwardedBanner: React.FC<Props> = ({ forwardedFromSenderName, isCurrentUserMessage, styles }) => {
  return (
    <View style={styles.forwardedBanner}>
      <Ionicons name="return-up-forward-outline" size={12} color={isCurrentUserMessage ? '#90CAF9' : '#0068FF'} />
      <Text style={[styles.forwardedBannerText, { color: isCurrentUserMessage ? '#90CAF9' : '#0068FF' }]}>
        {`Chuyển tiếp từ ${forwardedFromSenderName}`}
      </Text>
    </View>
  );
};

export default ForwardedBanner;
