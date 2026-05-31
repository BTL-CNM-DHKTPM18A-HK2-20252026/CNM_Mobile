import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';

interface ImageGroupMessageProps {
  attachments: { url: string }[];
  onPressImage?: (url: string) => void;
  onLongPress?: () => void;
}

export function ImageGroupMessage({ attachments, onPressImage, onLongPress }: ImageGroupMessageProps) {
  const imgs = attachments;
  const count = imgs.length;
  const gridWidth = 280;
  const gap = 2;

  if (count === 1) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => onPressImage?.(imgs[0].url)} onLongPress={onLongPress} delayLongPress={220}>
        <Image source={{ uri: imgs[0].url }} style={{ width: gridWidth, height: gridWidth * 0.75, borderRadius: 8 }} resizeMode="cover" />
      </TouchableOpacity>
    );
  }

  if (count === 2) {
    const half = (gridWidth - gap) / 2;
    return (
      <View style={{ flexDirection: 'row', gap, width: gridWidth, borderRadius: 8, overflow: 'hidden' }}>
        {imgs.map((att, i) => (
          <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => onPressImage?.(att.url)} onLongPress={onLongPress} delayLongPress={220}>
            <Image source={{ uri: att.url }} style={{ width: half, height: half }} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // 4+ images: dynamic rows
  const numRows = Math.ceil(count / 3);
  const rows: typeof imgs[number][][] = [];
  let startIdx = 0;
  let rem = count;
  for (let r = 0; r < numRows; r++) {
    const rowsLeft = numRows - r;
    const perRow = Math.floor(rem / rowsLeft);
    rows.push(imgs.slice(startIdx, startIdx + perRow));
    startIdx += perRow;
    rem -= perRow;
  }

  return (
    <View style={{ borderRadius: 8, overflow: 'hidden', width: gridWidth }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap, marginTop: ri > 0 ? gap : 0 }}>
          {row.map((att, ci) => {
            const itemWidth = (gridWidth - gap * (row.length - 1)) / row.length;
            return (
              <TouchableOpacity key={ci} activeOpacity={0.85} onPress={() => onPressImage?.(att.url)} onLongPress={onLongPress} delayLongPress={220}>
                <Image source={{ uri: att.url }} style={{ width: itemWidth, height: itemWidth }} resizeMode="cover" />
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}
