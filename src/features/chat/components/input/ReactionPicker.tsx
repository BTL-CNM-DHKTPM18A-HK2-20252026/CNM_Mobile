import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export type ReactionPickerProps = {
  emojis?: string[];
  onSelect?: (emoji: string) => void;
  style?: any;
};

export const ReactionPicker: React.FC<ReactionPickerProps> = ({ emojis = [], onSelect, style }) => {
  return (
    <View style={style}>
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        {emojis.map((emoji) => (
          <TouchableOpacity key={emoji} style={{ paddingHorizontal: 8 }} onPress={() => onSelect?.(emoji)}>
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default ReactionPicker;
