import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_SELECTION = 30;
const PAGE_SIZE = 50;

type Asset = MediaLibrary.Asset;
type Album = MediaLibrary.Album;

type PickerAlbum = Album | { id: null; title: string; assetCount?: number };

type CustomImagePickerProps = {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (selectedUris: string[]) => void | Promise<void>;
  maxSelection?: number;
};

type AlbumSheetItemProps = {
  album: PickerAlbum;
  active: boolean;
  onPress: () => void;
};

type AssetGridItemProps = {
  asset: Asset;
  selectedIndex: number | null;
  onPress: () => void;
};

const AlbumSheetItem = memo(({ album, active, onPress }: AlbumSheetItemProps) => {
  return (
    <Pressable onPress={onPress} style={[styles.albumItem, active && styles.albumItemActive]}>
      <View style={styles.albumThumb}>
        <Ionicons name="image-outline" size={18} color={active ? '#E85A86' : '#667085'} />
      </View>
      <View style={styles.albumTextWrap}>
        <Text style={[styles.albumTitle, active && styles.albumTitleActive]} numberOfLines={1}>
          {album.title}
        </Text>
        <Text style={styles.albumCount} numberOfLines={1}>
          {'assetCount' in album && typeof album.assetCount === 'number' ? `${album.assetCount} ảnh` : 'Tất cả ảnh'}
        </Text>
      </View>
      {active ? <Ionicons name="checkmark-circle" size={20} color="#E85A86" /> : null}
    </Pressable>
  );
});

const AssetGridItem = memo(({ asset, selectedIndex, onPress }: AssetGridItemProps) => {
  return (
    <Pressable onPress={onPress} style={styles.assetCell}>
      <Image source={{ uri: asset.uri }} style={styles.assetImage} resizeMode="cover" />
      {typeof selectedIndex === 'number' ? (
        <View style={styles.assetSelectedBadge}>
          <Text style={styles.assetSelectedText}>{selectedIndex + 1}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

export const CustomImagePicker = ({ isVisible, onClose, onConfirm, maxSelection = MAX_SELECTION }: CustomImagePickerProps) => {
  const [albums, setAlbums] = useState<PickerAlbum[]>([]);
  const [selectedAlbumIndex, setSelectedAlbumIndex] = useState(0);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [onEndReachedCalled, setOnEndReachedCalled] = useState(false);
  const [albumMenuVisible, setAlbumMenuVisible] = useState(false);

  const currentAlbum = albums[selectedAlbumIndex] ?? null;
  const selectedAssetIds = useMemo(() => new Set(selectedAssets.map((item) => item.id)), [selectedAssets]);
  const insets = useSafeAreaInsets();

  const ensurePermission = useCallback(async () => {
    console.log('[CustomImagePicker] ensurePermission: checking');
    const existing = await MediaLibrary.getPermissionsAsync(false, ['photo']);
    console.log('[CustomImagePicker] ensurePermission: existing', existing.status);
    if (existing.status === 'granted') {
      return true;
    }

    const requested = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
    console.log('[CustomImagePicker] ensurePermission: requested', requested.status);
    return requested.status === 'granted';
  }, []);

  const loadAlbums = useCallback(async () => {
    setLoadingAlbums(true);
    try {
      console.log('[CustomImagePicker] loadAlbums: start');
      const granted = await ensurePermission();
      console.log('[CustomImagePicker] loadAlbums: granted=', granted);
      if (!granted) {
        Alert.alert('Quyền truy cập', 'Bạn cần cho phép truy cập thư viện ảnh để chọn ảnh.');
        onClose();
        return;
      }

      const systemAlbums = await MediaLibrary.getAlbumsAsync();
      console.log('[CustomImagePicker] loadAlbums: got', systemAlbums.length, 'albums');
      const nextAlbums: PickerAlbum[] = [
        { id: null, title: 'Tất cả ảnh' },
        ...systemAlbums.filter((album) => album.assetCount > 0),
      ];

      setAlbums(nextAlbums);
      setSelectedAlbumIndex(0);
    } catch (error) {
      console.warn('[CustomImagePicker] Failed to load albums:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách album.');
    } finally {
      setLoadingAlbums(false);
    }
  }, [ensurePermission, onClose]);

  const loadAssets = useCallback(
    async (album: PickerAlbum | null, reset = false, after?: string) => {
      setLoadingAssets(true);
      try {
        console.log('[CustomImagePicker] loadAssets: start', { albumId: album?.id ?? null, reset, after });
        const query: MediaLibrary.GetAssetsOptions = {
          first: PAGE_SIZE,
          mediaType: ['photo'],
          // request assets ordered by creation time (newest first)
          sortBy: [MediaLibrary.SortBy.creationTime],
        };

        // If a specific album is provided, pass its id (string) to the query.
        if (album && typeof (album as Album).id === 'string') {
          // @ts-expect-error - MediaLibrary accepts album id or Album depending on platform
          query.album = (album as Album).id;
        }

        if (!reset && after) {
          query.after = after;
        }

        const result = await MediaLibrary.getAssetsAsync(query);
        console.log('[CustomImagePicker] loadAssets: got', result.assets.length, 'assets, hasNextPage=', result.hasNextPage);

        setAssets((prev) => {
          // merge results and ensure newest->oldest order by creationTime
          const combined = reset ? result.assets.slice() : [...prev, ...result.assets];
          // dedupe by id while preserving newest-first order
          const seen = new Set<string>();
          const deduped = combined
            .slice()
            .sort((a, b) => (b.creationTime ?? 0) - (a.creationTime ?? 0))
            .filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });

          return deduped;
        });

        setHasNextPage(Boolean(result.hasNextPage));
        setEndCursor(result.endCursor ?? undefined);
      } catch (error) {
        console.warn('[CustomImagePicker] Failed to load assets:', error);
        Alert.alert('Lỗi', 'Không thể tải ảnh trong album này.');
      } finally {
        setLoadingAssets(false);
        // allow subsequent onEndReached calls after this load finishes
        setOnEndReachedCalled(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isVisible) {
      setAssets([]);
      setAlbums([]);
      setSelectedAssets([]);
      setSelectedAlbumIndex(0);
      setHasNextPage(false);
      setEndCursor(undefined);
      setAlbumMenuVisible(false);
      return;
    }

    void loadAlbums();
  }, [isVisible, loadAlbums]);

  useEffect(() => {
    if (!isVisible || albums.length === 0) {
      return;
    }

    setAssets([]);
    setEndCursor(undefined);
    setHasNextPage(false);
    setOnEndReachedCalled(false);
    void loadAssets(currentAlbum, true, undefined);
  }, [isVisible, albums, currentAlbum, loadAssets]);

  const selectedIndexById = useMemo(() => {
    const map = new Map<string, number>();
    selectedAssets.forEach((item, index) => {
      map.set(item.id, index);
    });
    return map;
  }, [selectedAssets]);

  const toggleAsset = useCallback((asset: Asset) => {
    setSelectedAssets((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === asset.id);
      if (existingIndex >= 0) {
        console.log('[CustomImagePicker] toggleAsset: removing', asset.id);
        return prev.filter((item) => item.id !== asset.id);
      }

      if (prev.length >= maxSelection) {
        Alert.alert(
          'Chọn ảnh gửi đi',
          'Bạn chỉ có thể gửi tối đa 30 hình ảnh trong một lần. Vui lòng bỏ bớt một vài ảnh nhé!'
        );
        console.log('[CustomImagePicker] toggleAsset: reached maxSelection');
        return prev;
      }

      console.log('[CustomImagePicker] toggleAsset: adding', asset.id);

      return [...prev, asset];
    });
  }, [maxSelection]);

  const handleConfirm = useCallback(async () => {
    if (selectedAssets.length > maxSelection) {
      Alert.alert(
        'Chọn ảnh gửi đi',
        'Bạn chỉ có thể gửi tối đa 30 hình ảnh trong một lần. Vui lòng bỏ bớt một vài ảnh nhé!'
      );
      return;
    }

    const selectedUris = selectedAssets.map((item) => item.uri);
    await Promise.resolve(onConfirm(selectedUris));
    onClose();
  }, [maxSelection, onClose, onConfirm, selectedAssets]);

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || loadingAssets || onEndReachedCalled) {
      return;
    }

    setOnEndReachedCalled(true);
    void loadAssets(currentAlbum, false, endCursor);
  }, [currentAlbum, hasNextPage, loadAssets, loadingAssets, endCursor, onEndReachedCalled]);

  const handleSelectAlbum = useCallback((index: number) => {
    setSelectedAlbumIndex(index);
    setAlbumMenuVisible(false);
  }, []);

  const renderAssetItem = useCallback(({ item }: { item: Asset }) => {
    return (
      <AssetGridItem
        asset={item}
        selectedIndex={selectedIndexById.get(item.id) ?? null}
        onPress={() => toggleAsset(item)}
      />
    );
  }, [selectedIndexById, toggleAsset]);

  const renderAlbumItem = useCallback(({ item, index }: { item: PickerAlbum; index: number }) => {
    return (
      <AlbumSheetItem
        album={item}
        active={index === selectedAlbumIndex}
        onPress={() => handleSelectAlbum(index)}
      />
    );
  }, [handleSelectAlbum, selectedAlbumIndex]);

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: 18 + insets.top }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color="#111827" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.albumPicker} onPress={() => setAlbumMenuVisible(true)}>
            <Text style={styles.albumPickerText} numberOfLines={1}>
              {currentAlbum?.title ?? 'Tất cả ảnh'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#E85A86" />
          </TouchableOpacity>

          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          renderItem={renderAssetItem}
          numColumns={4}
          contentContainerStyle={[styles.gridContent, { paddingBottom: 136 + insets.bottom }]}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.7}
          refreshing={loadingAssets}
          onRefresh={() => {
            setOnEndReachedCalled(false);
            void loadAssets(currentAlbum, true, undefined);
          }}
          onMomentumScrollBegin={() => setOnEndReachedCalled(false)}
          initialNumToRender={20}
          windowSize={5}
          removeClippedSubviews
          getItemLayout={(data, index) => {
            const { width } = Dimensions.get('window');
            // grid has 4 columns, cell padding creates small gaps; compute approximate item size
            const totalPadding = 8; // gridContent padding + cell padding approximation
            const itemSize = Math.floor((width - totalPadding) / 4);
            const row = Math.floor(index / 4);
            return { length: itemSize, offset: row * itemSize, index };
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {loadingAlbums || loadingAssets ? 'Đang tải ảnh...' : 'Không có ảnh nào trong album này.'}
              </Text>
            </View>
          }
        />

        <View style={[styles.footer, { paddingBottom: 18 + insets.bottom }]}>
          <View style={styles.selectedStrip}>
            <FlatList
              data={selectedAssets}
              horizontal
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedStripContent}
              renderItem={({ item }) => {
                const index = selectedIndexById.get(item.id) ?? 0;
                return (
                  <View style={styles.selectedThumbWrap}>
                    <Image source={{ uri: item.uri }} style={styles.selectedThumb} />
                    <View style={styles.selectedThumbBadge}>
                      <Text style={styles.selectedThumbBadgeText}>{index + 1}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeSelectedBtn}
                      onPress={() => toggleAsset(item)}
                    >
                      <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={styles.selectedHint}>Chưa chọn ảnh nào</Text>}
            />
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, selectedAssets.length === 0 && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={selectedAssets.length === 0}
          >
            <Text style={styles.confirmButtonText}>
              {`Gửi (${selectedAssets.length}/${maxSelection})`}
            </Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={albumMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAlbumMenuVisible(false)}
        >
          <Pressable style={styles.albumMenuBackdrop} onPress={() => setAlbumMenuVisible(false)}>
            <Pressable style={styles.albumMenuSheet} onPress={() => undefined}>
              <Text style={styles.albumMenuTitle}>Chọn album</Text>
              <FlatList
                data={albums}
                keyExtractor={(item, index) => `${item.id ?? 'all'}-${index}`}
                renderItem={renderAlbumItem}
                style={styles.albumMenuList}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </View>
      </SafeAreaView>
    </Modal>
  );
};

export default CustomImagePicker;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF7FA',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF7FA',
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7FA',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  albumPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(232, 90, 134, 0.08)',
    maxWidth: '70%',
  },
  albumPickerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    maxWidth: 180,
  },
  gridContent: {
    paddingHorizontal: 4,
    paddingBottom: 136,
  },
  assetCell: {
    width: '25%',
    aspectRatio: 1,
    padding: 3,
  },
  assetImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  assetSelectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E85A86',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  assetSelectedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyWrap: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 247, 250, 0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(232, 90, 134, 0.12)',
  },
  selectedStrip: {
    minHeight: 78,
  },
  selectedStripContent: {
    alignItems: 'center',
    gap: 10,
  },
  selectedThumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginRight: 10,
  },
  selectedThumb: {
    width: '100%',
    height: '100%',
  },
  selectedThumbBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E85A86',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedThumbBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  removeSelectedBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  selectedHint: {
    fontSize: 13,
    color: '#6B7280',
    paddingVertical: 24,
  },
  confirmButton: {
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#E85A86',
  },
  confirmButtonDisabled: {
    opacity: 0.45,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  albumMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  albumMenuSheet: {
    maxHeight: '72%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  albumMenuTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  albumMenuList: {
    flexGrow: 0,
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  albumItemActive: {
    backgroundColor: 'rgba(232, 90, 134, 0.08)',
  },
  albumThumb: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumTextWrap: {
    flex: 1,
  },
  albumTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  albumTitleActive: {
    color: '#E85A86',
  },
  albumCount: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
});