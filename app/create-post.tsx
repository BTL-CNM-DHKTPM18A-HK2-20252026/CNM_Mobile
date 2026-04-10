import { AntDesign, Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');
const GRID_COLS = 3;

const DUMMY_IMAGES = [
  'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=800&q=60',
  'https://images.unsplash.com/photo-1511765224389-37f0e77cf0eb?w=800&q=60',
  'https://images.unsplash.com/photo-1492447166138-50c3889fccb1?w=800&q=60',
  'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=800&q=60',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=60',
  'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=800&q=60',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=60',
  'https://images.unsplash.com/photo-1526045612212-70caf35c14df?w=800&q=60',
];

export default function CreatePostScreen({ navigation }: any) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(120);
  const [useTextBg, setUseTextBg] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [imageActive, setImageActive] = useState(true);

  const images = useMemo(() => {
    // first item will be camera placeholder represented by id 'camera'
    return [{ id: 'camera' }, ...DUMMY_IMAGES.map((u, i) => ({ id: String(i), uri: u }))];
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => ({ ...s, [id]: !s[id] }));
  };

  const handlePost = () => {
    const selected = Object.keys(selectedIds).filter((k) => selectedIds[k]);
    Alert.alert('Đăng bài', `Nội dung: ${text || '(trống)'}\nẢnh đã chọn: ${selected.length}`);
  };

  function Header() {
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color="#111" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Bạn bè Zalo</Text>
          <Text style={styles.headerSubtitle}>Trừ bạn bè đã bị chặn xem</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.aaBtn} onPress={() => setUseTextBg((v) => !v)}>
            <Text style={{ fontWeight: '700' }}>Aa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postBtn} onPress={handlePost}>
            <Text style={styles.postBtnText}>Đăng</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function PostInput() {
    return (
      <View style={styles.inputWrap}>
        <View style={[styles.inputBox, useTextBg ? styles.inputBoxBg : null, { minHeight: inputHeight }]}> 
          <TextInput
            placeholder="Bạn đang nghĩ gì?"
            placeholderTextColor="#999"
            multiline
            value={text}
            onChangeText={setText}
            onContentSizeChange={(e) => setInputHeight(Math.max(120, e.nativeEvent.contentSize.height + 24))}
            style={styles.textInput}
          />

          <TouchableOpacity
            style={[styles.floatingAa, useTextBg ? { backgroundColor: '#fff' } : { backgroundColor: '#eef6ff' }]}
            onPress={() => setUseTextBg((v) => !v)}
            accessible
            accessibilityLabel="Toggle text background"
          >
            <Text style={{ fontWeight: '700', color: useTextBg ? '#222' : '#007aff' }}>Aa</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function MediaOptions() {
    return (
      <View style={styles.mediaOptionsRow}>
        <TouchableOpacity style={styles.mediaOption}>
          <Ionicons name="musical-notes" size={18} color="#007aff" />
          <Text style={styles.mediaOptionText}>Nhạc</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mediaOption}>
          <Feather name="image" size={18} color="#ff9500" />
          <Text style={styles.mediaOptionText}>Album</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mediaOption}>
          <Feather name="user-plus" size={18} color="#34c759" />
          <Text style={styles.mediaOptionText}>Với bạn bè</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function Toolbar() {
    return (
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn}>
          <MaterialIcons name="insert-emoticon" size={22} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarBtn, imageActive ? styles.toolbarBtnActive : null]}
          onPress={() => setImageActive((v) => !v)}
        >
          <Feather name="image" size={20} color={imageActive ? '#fff' : '#666'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarBtn}>
          <Feather name="video" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarBtn}>
          <Feather name="link" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarBtn}>
          <Feather name="map-pin" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    );
  }

  function ImageCell({ item }: { item: any }) {
    if (item.id === 'camera') {
      return (
        <TouchableOpacity style={styles.cameraCell} onPress={() => Alert.alert('Chụp ảnh', 'Mở camera (demo)')}>
          <AntDesign name="camera" size={28} color="#007aff" />
          <Text style={styles.cameraText}>Chụp ảnh</Text>
        </TouchableOpacity>
      );
    }

    const selected = !!selectedIds[item.id];
    return (
      <TouchableOpacity
        style={[styles.imageCell, selected ? styles.imageCellSelected : null]}
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.9}
      >
        <Image source={{ uri: item.uri }} style={styles.thumb} />
        <TouchableOpacity style={[styles.selectCircle, selected ? styles.selectCircleActive : null]} onPress={() => toggleSelect(item.id)}>
          {selected ? <Feather name="check" size={14} color="#fff" /> : <View style={{ width: 14, height: 14, borderRadius: 7 }} />}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Header />

        <PostInput />

        <MediaOptions />

        <Toolbar />

        {imageActive && (
          <View style={styles.gridWrap}>
            <FlatList
              data={images}
              keyExtractor={(it) => it.id}
              numColumns={GRID_COLS}
              renderItem={({ item }) => <ImageCell item={item} />}
              scrollEnabled={false}
            />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 24, backgroundColor: '#f5f6fa' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 18, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  headerSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  aaBtn: { marginRight: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18, backgroundColor: '#eef6ff', alignItems: 'center', justifyContent: 'center' },
  postBtn: { backgroundColor: '#007aff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  postBtnText: { color: '#fff', fontWeight: '700' },

  inputWrap: { padding: 12, backgroundColor: '#f5f6fa' },
  inputBox: { backgroundColor: '#fff', borderRadius: 12, padding: 12, position: 'relative', overflow: 'visible' },
  inputBoxBg: { backgroundColor: '#fff8e6' },
  textInput: { fontSize: 16, color: '#111', minHeight: 80, textAlignVertical: 'top' },
  floatingAa: { position: 'absolute', left: 12, bottom: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, elevation: 2 },

  mediaOptionsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, backgroundColor: 'transparent' },
  mediaOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.03, elevation: 1 },
  mediaOptionText: { marginLeft: 8, color: '#333', fontWeight: '600' },

  toolbar: { flexDirection: 'row', justifyContent: 'space-around', padding: 12, borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  toolbarBtn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toolbarBtnActive: { backgroundColor: '#007aff', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  gridWrap: { padding: 12, backgroundColor: '#f5f6fa' },
  imageCell: { flex: 1 / GRID_COLS, aspectRatio: 1, margin: 6, borderRadius: 12, overflow: 'hidden', backgroundColor: '#ddd' },
  imageCellSelected: { borderWidth: 3, borderColor: '#007aff' },
  thumb: { width: (width - 12 * 2 - 6 * (GRID_COLS * 2)) / GRID_COLS, height: undefined, aspectRatio: 1 },
  selectCircle: { position: 'absolute', right: 8, top: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  selectCircleActive: { backgroundColor: '#007aff' },

  cameraCell: { flex: 1 / GRID_COLS, aspectRatio: 1, margin: 6, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
  cameraText: { marginTop: 8, color: '#007aff', fontWeight: '700' },
});
