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

const extractTiptapText = (node: any): string => {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (Array.isArray(node.content)) return node.content.map(extractTiptapText).join('');
  return '';
};

const renderTiptapNode = (node: any, textStyle: any, key: string = 'root'): React.ReactNode => {
  if (!node) return null;
  if (node.type === 'text') {
    const textStr: string = node.text ?? '';
    const marks: any[] = node.marks ?? [];
    const style: any = { ...StyleSheet.flatten(textStyle) };
    for (const mark of marks) {
      if (mark.type === 'bold') style.fontWeight = '700';
      if (mark.type === 'italic') style.fontStyle = 'italic';
      if (mark.type === 'underline') style.textDecorationLine = 'underline';
      if (mark.type === 'strike') style.textDecorationLine = 'line-through';
      if (mark.type === 'textStyle' && mark.attrs?.color) style.color = mark.attrs.color;
    }
    return <Text key={key} style={style}>{textStr}</Text>;
  }
  const children = (node.content ?? []).map((child: any, idx: number) =>
    renderTiptapNode(child, textStyle, `${key}-${idx}`)
  );
  if (node.type === 'hardBreak') return <Text key={key}>{`\n`}</Text>;
  if (node.type === 'paragraph') return <Text key={key}>{children}{`\n`}</Text>;
  if (node.type === 'heading') return <Text key={key} style={[textStyle, { fontWeight: '700', fontSize: 16 }]}>{children}{`\n`}</Text>;
  if (node.type === 'blockquote') return <Text key={key} style={[textStyle, { fontStyle: 'italic' }]}>{children}</Text>;
  if (node.type === 'bulletList' || node.type === 'orderedList') return <Text key={key}>{children}</Text>;
  if (node.type === 'listItem') return <Text key={key}>{'\u2022 '}{children}</Text>;
  if (node.type === 'doc') return <React.Fragment key={key}>{children}</React.Fragment>;
  return <Text key={key}>{children}</Text>;
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
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse JSON if applicable
  const parsedData = useMemo(() => {
    if (rawText.trim().startsWith('{') && rawText.trim().endsWith('}')) {
      try {
        const json = JSON.parse(rawText);
        if (json && typeof json === 'object' && json.type === 'doc') {
          const plainText = extractTiptapText(json).trim();
          return { isJson: true, json, plainText };
        }
      } catch {
        // Fall back to plain text
      }
    }
    return { isJson: false, json: null, plainText: rawText.replace(/\r\n/g, '\n') };
  }, [rawText]);

  const analysisText = parsedData.plainText.trim();

  useEffect(() => {
    setIsExpanded(false);
  }, [analysisText]);

  const metrics = useMemo(() => {
    const wordCount = countWords(analysisText);
    const lineCount = countLogicalLines(parsedData.plainText);
    const characterFallbackThreshold = getCharacterFallbackThreshold(previewWords);

    return {
      wordCount,
      lineCount,
      shouldCollapse:
        wordCount > previewWords ||
        lineCount > previewLines ||
        analysisText.length > characterFallbackThreshold,
    };
  }, [analysisText, previewLines, previewWords, parsedData.plainText]);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  if (!metrics.shouldCollapse) {
    return (
      <View style={containerStyle}>
        <Text style={textStyle}>
          {parsedData.isJson
            ? renderTiptapNode(parsedData.json, textStyle)
            : parsedData.plainText}
        </Text>
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
        {parsedData.isJson
          ? renderTiptapNode(parsedData.json, textStyle)
          : parsedData.plainText}
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
