import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import ExpandableText from '@/components/chat/ExpandableText';

interface ImageMessageProps {
  uri: string;
  caption?: string;
  isLocalUri?: boolean;
  isCurrentUserMessage?: boolean;
  colors: any;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function ImageMessage({ uri, caption, isLocalUri, colors, onPress, onLongPress }: ImageMessageProps) {
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={220}
      >
        <Image
          source={{ uri }}
          style={{ width: 280, height: 210, borderRadius: 8 }}
          resizeMode="cover"
        />
        {caption ? (
          <ExpandableText
            text={caption}
            previewWords={120}
            previewLines={8}
            containerStyle={{ marginTop: 6 }}
            textStyle={{ fontSize: 15, lineHeight: 22, color: colors.text }}
          />
        ) : null}
        {isLocalUri && (
          <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
            {/* Loading overlay could be passed as prop */}
          </View>
        )}
      </TouchableOpacity>
    </>
  );
}
