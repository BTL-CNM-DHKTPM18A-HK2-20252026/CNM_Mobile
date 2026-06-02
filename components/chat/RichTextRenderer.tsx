import React, { useMemo } from 'react';
import { Image, Linking, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import emojiPack from '../../constants/emoji-pack.json';

export interface TiptapMark {
  type: 'bold' | 'italic' | 'link';
  attrs?: {
    href?: string;
    target?: '_blank';
  };
}

export interface TiptapTextNode {
  type: 'text';
  text: string;
  marks?: TiptapMark[];
}

export interface TiptapZaloEmojiNode {
  type: 'zaloEmoji';
  attrs?: {
    shortcode?: string;
  };
}

export interface TiptapParagraphNode {
  type: 'paragraph';
  content?: (TiptapTextNode | TiptapZaloEmojiNode)[];
}

export interface TiptapDocNode {
  type: 'doc';
  content: TiptapParagraphNode[];
}

export type RichTextContent = string | TiptapDocNode | null | undefined;

export interface RichTextRendererStyles {
  container?: StyleProp<ViewStyle>;
  paragraph?: StyleProp<TextStyle>;
  text?: StyleProp<TextStyle>;
  bold?: StyleProp<TextStyle>;
  italic?: StyleProp<TextStyle>;
  underline?: StyleProp<TextStyle>;
  link?: StyleProp<TextStyle>;
}

export interface RichTextRendererProps {
  content?: RichTextContent;
  value?: RichTextContent;
  customStyles?: RichTextRendererStyles;
  paragraphSpacing?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const DEFAULT_PARAGRAPH_SPACING = 8;
const DEFAULT_TEXT_COLOR = '#111827';
const DEFAULT_LINK_COLOR = '#2563eb';
const DEFAULT_LINE_HEIGHT = 22;
const S3_BASE_URL = process.env.EXPO_PUBLIC_S3_BASE_URL || 'https://fruvia-asset.s3.ap-southeast-2.amazonaws.com/public';
const ZALO_EMOJI_REGEX = /(:zalo_\d+_\d+:)/g;

const emojiMap: Record<string, string> = {};
(emojiPack.categories as { icons: { shortcode: string; src: string }[] }[]).forEach((category) => {
  category.icons.forEach((icon) => {
    emojiMap[icon.shortcode] = icon.src.startsWith('http://') || icon.src.startsWith('https://')
      ? icon.src
      : `${S3_BASE_URL}${icon.src.replace('/fruvia_emoji', '')}`;
  });
});

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },
  paragraph: {
    marginBottom: DEFAULT_PARAGRAPH_SPACING,
  },
  emptyParagraph: {
    minHeight: DEFAULT_LINE_HEIGHT,
    marginBottom: DEFAULT_PARAGRAPH_SPACING,
  },
  text: {
    fontSize: 15,
    lineHeight: DEFAULT_LINE_HEIGHT,
    color: DEFAULT_TEXT_COLOR,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  link: {
    color: DEFAULT_LINK_COLOR,
    textDecorationLine: 'underline',
  },
  emojiImage: {
    width: 22,
    height: 22,
    marginHorizontal: 1,
    transform: [{ translateY: 4 }],
  },
});

const isTiptapTextNode = (value: unknown): value is TiptapTextNode => {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).type === 'text');
};

const isTiptapZaloEmojiNode = (value: unknown): value is TiptapZaloEmojiNode => {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).type === 'zaloEmoji');
};

const isTiptapParagraphNode = (value: unknown): value is TiptapParagraphNode => {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).type === 'paragraph');
};

const isTiptapDocNode = (value: unknown): value is TiptapDocNode => {
  return (
    Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).type === 'doc') &&
    Array.isArray((value as TiptapDocNode).content)
  );
};

const parseDoc = (content: RichTextContent): TiptapDocNode | null => {
  if (!content) {
    return null;
  }

  if (isTiptapDocNode(content)) {
    return content;
  }

  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (!trimmed) {
      return null;
    }

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (isTiptapDocNode(parsed)) {
          return parsed;
        }
      } catch {
        return null;
      }
    }
  }

  return null;
};

const collectPlainTextFromDoc = (doc: TiptapDocNode): string => {
  return doc.content
    .map((paragraph) => {
      if (!isTiptapParagraphNode(paragraph) || !Array.isArray(paragraph.content)) {
        return '';
      }

      return paragraph.content
        .map((node) => {
          if (isTiptapTextNode(node)) {
            return node.text;
          }

          if (isTiptapZaloEmojiNode(node)) {
            return String(node.attrs?.shortcode ?? '');
          }

          return '';
        })
        .join('');
    })
    .join('\n');
};

export const extractRichTextPlainText = (content: RichTextContent): string => {
  const doc = parseDoc(content);
  if (doc) {
    return collectPlainTextFromDoc(doc);
  }

  if (typeof content === 'string') {
    return content;
  }

  return '';
};

const getMarkStyle = (mark: TiptapMark, customStyles?: RichTextRendererStyles): StyleProp<TextStyle> | undefined => {
  switch (mark.type) {
    case 'bold':
      return [styles.bold, customStyles?.bold];
    case 'italic':
      return [styles.italic, customStyles?.italic];
    case 'underline':
      return [styles.underline, customStyles?.underline];
    case 'link':
      return [styles.link, customStyles?.link];
    default:
      return undefined;
  }
};

const getLinkHref = (mark: TiptapMark): string | null => {
  if (!mark.attrs?.href) {
    return null;
  }

  const rawHref = String(mark.attrs.href).trim();
  if (!rawHref) {
    return null;
  }

  return rawHref.startsWith('www.') ? `https://${rawHref}` : rawHref;
};

const openLink = async (href: string): Promise<void> => {
  try {
    const supported = await Linking.canOpenURL(href);
    if (supported) {
      await Linking.openURL(href);
    }
  } catch {
    // ignore
  }
};

const renderTextWithZaloEmoji = (content: string, keyPrefix = 'text'): React.ReactNode[] | string => {
  const parts = content.split(ZALO_EMOJI_REGEX);
  if (parts.length === 1) {
    return content;
  }

  return parts.map((part, index) => {
    const src = emojiMap[part];
    if (!src) {
      return part;
    }

    return (
      <Image
        key={`${keyPrefix}-emoji-${index}`}
        source={{ uri: src }}
        style={styles.emojiImage}
        resizeMode="contain"
        accessibilityLabel={part}
      />
    );
  });
};

const renderZaloEmojiNode = (node: TiptapZaloEmojiNode, key: string): React.ReactNode => {
  const shortcode = String(node.attrs?.shortcode ?? '');
  const src = emojiMap[shortcode];

  if (!src) {
    return shortcode;
  }

  return (
    <Image
      key={key}
      source={{ uri: src }}
      style={styles.emojiImage}
      resizeMode="contain"
      accessibilityLabel={shortcode}
    />
  );
};

const renderTextNode = (
  node: TiptapTextNode,
  textStyle?: StyleProp<TextStyle>,
  customStyles?: RichTextRendererStyles,
  key?: string
): React.ReactNode => {
  const content = String(node.text ?? '');
  const marks = Array.isArray(node.marks) ? node.marks.filter(Boolean) : [];
  const renderedContent = renderTextWithZaloEmoji(content, key);

  const baseTextStyle = [styles.text, customStyles?.text, textStyle] as StyleProp<TextStyle>;
  const inner = marks.reduceRight<React.ReactNode>((children, mark, index) => {
    const linkHref = mark.type === 'link' ? getLinkHref(mark) : null;
    const markStyle = getMarkStyle(mark, customStyles);

    if (linkHref) {
      return (
        <Text
          key={`mark-${index}`}
          style={[styles.link, customStyles?.link, textStyle]}
          onPress={() => void openLink(linkHref)}
          accessibilityRole="link"
        >
          {children}
        </Text>
      );
    }

    if (markStyle) {
      return (
        <Text key={`mark-${index}`} style={[markStyle, textStyle]}>
          {children}
        </Text>
      );
    }

    return children;
  }, content ? renderedContent : '\u00A0');

  return (
    <Text key={key} style={baseTextStyle}>
      {inner}
    </Text>
  );
};

const renderParagraphNode = (
  paragraph: TiptapParagraphNode,
  textStyle?: StyleProp<TextStyle>,
  customStyles?: RichTextRendererStyles,
  paragraphSpacing?: number,
  index?: number
): React.ReactNode => {
  const paragraphStyle = [styles.paragraph, customStyles?.paragraph, paragraphSpacing !== undefined ? { marginBottom: paragraphSpacing } : undefined] as StyleProp<TextStyle>;

  if (!Array.isArray(paragraph.content) || paragraph.content.length === 0) {
    return <View key={`paragraph-${index}`} style={[styles.emptyParagraph, paragraphStyle]} />;
  }

  return (
    <Text key={`paragraph-${index}`} style={[styles.paragraph, paragraphStyle, customStyles?.text, textStyle]}>
      {paragraph.content.map((child, childIndex) => {
        if (isTiptapTextNode(child)) {
          return renderTextNode(child, [styles.text, customStyles?.text, textStyle], customStyles, `paragraph-${index}-text-${childIndex}`);
        }

        if (isTiptapZaloEmojiNode(child)) {
          return renderZaloEmojiNode(child, `paragraph-${index}-emoji-${childIndex}`);
        }

        return null;
      })}
    </Text>
  );
};

const renderDoc = (
  doc: TiptapDocNode,
  textStyle?: StyleProp<TextStyle>,
  customStyles?: RichTextRendererStyles,
  paragraphSpacing?: number
): React.ReactNode => {
  return (
    <View style={[styles.container, customStyles?.container]}>
      {doc.content.map((paragraph, index) => {
        if (!isTiptapParagraphNode(paragraph)) {
          return (
            <View
              key={`paragraph-${index}`}
              style={[styles.emptyParagraph, customStyles?.paragraph, paragraphSpacing !== undefined ? { marginBottom: paragraphSpacing } : undefined]}
            />
          );
        }

        return renderParagraphNode(paragraph, textStyle, customStyles, paragraphSpacing, index);
      })}
    </View>
  );
};

export const RichTextRenderer: React.FC<RichTextRendererProps> = React.memo(({ content, value, customStyles, paragraphSpacing, style, textStyle }) => {
  const resolvedContent = content ?? value;
  const parsedDoc = useMemo(() => parseDoc(resolvedContent), [resolvedContent]);

  if (parsedDoc) {
    return <View style={style}>{renderDoc(parsedDoc, [styles.text, customStyles?.text, textStyle], customStyles, paragraphSpacing)}</View>;
  }

  if (typeof resolvedContent === 'string') {
    return (
      <View style={style}>
        <Text style={[styles.text, textStyle]}>{renderTextWithZaloEmoji(resolvedContent, 'plain')}</Text>
      </View>
    );
  }

  return null;
});

RichTextRenderer.displayName = 'RichTextRenderer';

export default RichTextRenderer;
