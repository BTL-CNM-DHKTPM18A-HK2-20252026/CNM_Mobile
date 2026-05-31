import React, { useMemo } from 'react';
import {
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

interface LinkPreviewCardProps {
  url: string;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

export default function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const { colors } = useTheme();

  const domain = useMemo(() => extractDomain(url), [url]);
  const faviconUri = useMemo(() => getFaviconUrl(domain), [domain]);

  const handleOpen = () => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handleOpen}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Image
          source={{ uri: faviconUri }}
          style={styles.favicon}
          defaultSource={{ uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAARFJREFUWEftlr0OAQEURs9vpdCoKBQKhUIhEolE4hF4CK/gkVQKhUKhUCgoFEpPQo8nMDazk2z2SpBsMeecOTPfuTORsPAPC/0DMGAYDAwDA8NgYBgYDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBgbDwDAwDAyDgWEwMAwMg4FhMDAMBuYLBlT/fBHQt18AAAAASUVORK5CYII=' }}
        />
        <Text style={[styles.domain, { color: colors.textSecondary }]} numberOfLines={1}>
          {domain}
        </Text>
      </View>
      <View style={styles.urlRow}>
        <Ionicons name="link-outline" size={14} color={colors.textSecondary} />
        <Text style={[styles.url, { color: '#0068FF' }]} numberOfLines={1}>
          {url}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    maxWidth: 280,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  favicon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 6,
  },
  domain: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  url: {
    fontSize: 12,
    flexShrink: 1,
  },
});
