import { countWords } from '@/utils/chat/countWords';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

export interface ExpandableTextProps {
  text: string;
  previewWords?: number;
  previewLines?: number;
  textStyle?: StyleProp<TextStyle>;
  actionTextStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  expandLabel?: string;
  collapseLabel?: string;
}

const DEFAULT_PREVIEW_WORDS = 120;
const DEFAULT_PREVIEW_LINES = 8;
const WORDS_PER_LINE_FALLBACK = 12;
const MIN_CHARACTER_FALLBACK = 800;

const countLogicalLines = (value: string) => {
  const normalized = String(value ?? '').replace(/\r\n/g, '\n');
  if (!normalized) {
    return 0;
  }

  return normalized.split('\n').length;
};

const getCharacterFallbackThreshold = (previewWords: number) => {
  return Math.max(MIN_CHARACTER_FALLBACK, previewWords * WORDS_PER_LINE_FALLBACK);
};

export const ExpandableText: React.FC<ExpandableTextProps> = React.memo(({
  text,
  previewWords = DEFAULT_PREVIEW_WORDS,
  previewLines = DEFAULT_PREVIEW_LINES,
  textStyle,
  actionTextStyle,
  containerStyle,
  expandLabel = 'Xem thêm',
  collapseLabel = 'Thu gọn',
}) => {
  const rawText = String(text ?? '');
  const renderedText = rawText.replace(/\r\n/g, '\n');
  const analysisText = renderedText.trim();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [analysisText]);

  const metrics = useMemo(() => {
    const wordCount = countWords(analysisText);
    const lineCount = countLogicalLines(renderedText);
    const characterFallbackThreshold = getCharacterFallbackThreshold(previewWords);

    return {
      wordCount,
      lineCount,
      shouldCollapse:
        wordCount > previewWords ||
        lineCount > previewLines ||
        analysisText.length > characterFallbackThreshold,
    };
  }, [analysisText, previewLines, previewWords, renderedText]);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  if (!metrics.shouldCollapse) {
    return (
      <View style={containerStyle}>
        <Text style={textStyle}>{renderedText}</Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text
        style={textStyle}
        numberOfLines={isExpanded ? undefined : previewLines}
        ellipsizeMode={isExpanded ? undefined : 'tail'}
      >
        {renderedText}
      </Text>

      <Pressable onPress={handleToggle} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.actionText, actionTextStyle]}>
          {isExpanded ? collapseLabel : expandLabel}
        </Text>
      </Pressable>
    </View>
  );
});

ExpandableText.displayName = 'ExpandableText';

const styles = StyleSheet.create({
  actionText: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#0068FF',
    textDecorationLine: 'underline',
    textDecorationColor: '#0068FF',
    textDecorationStyle: 'solid',
  },
});

export default ExpandableText;
