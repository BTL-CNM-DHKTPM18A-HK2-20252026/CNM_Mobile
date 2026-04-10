import { AntDesign, Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { authService } from '../services/authService';
import postService from '../services/postService';

const { width } = Dimensions.get('window');
const GRID_COLS = 3;

export default function CreatePostScreen() {
    const router = useRouter();

    const [text, setText] = useState('');
    const [inputHeight, setInputHeight] = useState(120);
    const [useTextBg, setUseTextBg] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
    const [imageActive, setImageActive] = useState(true);

    const [images, setImages] = useState(() => [{ id: 'camera' }]);
    const textRef = useRef<TextInput | null>(null);

    const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setTimeout(() => textRef.current?.focus(), 200);
    }, []);

    useEffect(() => {
        let mounted = true;
        (async () => {
            const statusRes = await MediaLibrary.getPermissionsAsync();
            if (!mounted) return;

            const granted = statusRes.granted || statusRes.status === 'granted';
            setHasMediaPermission(granted);

            if (granted) {
                const res = await MediaLibrary.getAssetsAsync({
                    mediaType: ['photo'],
                    first: 24,
                    sortBy: [MediaLibrary.SortBy.creationTime],
                });

                const mapped = res.assets.map((a) => ({
                    id: a.id,
                    uri: a.uri,
                }));

                setImages([{ id: 'camera' }, ...mapped]);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const pickImages = async () => {
        Keyboard.dismiss();
        setImageActive(true);

        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
            Alert.alert('Lỗi', 'Không có quyền truy cập ảnh');
            return;
        }

        const res = await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (res.canceled) return;

        const added = res.assets.map((a) => ({
            id: `local-${Date.now()}-${Math.random()}`,
            uri: a.uri,
        }));

        setImages((prev) => [{ id: 'camera' }, ...prev.slice(1), ...added]);

        setSelectedIds((prev) => {
            const copy = { ...prev };
            added.forEach((it) => (copy[it.id] = true));
            return copy;
        });
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((s) => ({ ...s, [id]: !s[id] }));
    };

    const handlePost = async () => {
        setErrorMessage(null);
        setSubmitting(true);
        try {
            const profile = await authService.getProfile();
            const userId = profile?.id || profile?.userId;

            console.log("USER ID:", userId);

            if (!userId) {
                Alert.alert("Lỗi", "Không lấy được userId");
                return;
            }

            // Only send text content for now
            const payload = {
                content: (text || '').trim(),
            };

            if (!payload.content) {
                Alert.alert('Lỗi', 'Vui lòng nhập nội dung bài viết');
                return;
            }

            await postService.createPost(userId, payload);

            Alert.alert('Thành công', 'Đã đăng bài');
            setText('');
            setSelectedIds({});
            router.back();
        } catch (err: any) {
            console.error('Create post error', err);
            const status = err?.response?.status;
            const serverMessage = err?.response?.data?.message;
            let msg = 'Không thể đăng bài, vui lòng thử lại.';

            if (status === 500) {
                msg = 'Lỗi máy chủ (500). Vui lòng thử lại sau.';
            } else if (serverMessage) {
                msg = serverMessage;
            } else if (err?.message) {
                msg = err.message;
            }

            setErrorMessage(msg);
            Alert.alert('Lỗi', msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.container}
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Feather name="chevron-left" size={24} />
                    </TouchableOpacity>

                    <View style={{
                        flex: 1,
                        justifyContent: 'center',     // Căn giữa theo chiều dọc
                        alignItems: 'stretch',        // Trải đều theo chiều ngang (full width)
                    }}>
                        <Text style={styles.headerTitle}>Bạn bè Zalo</Text>
                        <Text style={styles.headerSub}>Trừ bạn bè bị chặn</Text>
                    </View>

                    <TouchableOpacity style={styles.postBtn} onPress={handlePost}>
                        <Text style={{ color: '#fff' }}>Đăng</Text>
                    </TouchableOpacity>
                </View>

                {/* INPUT */}
                <View style={styles.inputWrap}>
                    <View style={[styles.inputBox, { minHeight: inputHeight }]}>
                        <TextInput
                            ref={textRef}
                            placeholder="Bạn đang nghĩ gì?"
                            multiline
                            value={text}
                            onFocus={() => setImageActive(false)}
                            onChangeText={setText}
                            onContentSizeChange={(e) =>
                                setInputHeight(e.nativeEvent.contentSize.height + 20)
                            }
                            style={styles.textInput}
                        />
                    </View>
                    {errorMessage && (
                        <View style={styles.errorBanner}>
                            <Text style={styles.errorText}>{errorMessage}</Text>
                            <View style={styles.errorActions}>
                                <TouchableOpacity onPress={() => setErrorMessage(null)} style={styles.errorBtn}>
                                    <Text style={styles.errorBtnText}>Đóng</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handlePost} style={styles.errorBtn}>
                                    <Text style={styles.errorBtnText}>Thử lại</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* OPTIONS */}
                <View style={styles.row}>
                    <TouchableOpacity style={styles.option}>
                        <Ionicons name="musical-notes" size={18} />
                        <Text>Nhạc</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.option} onPress={pickImages}>
                        <Feather name="image" size={18} />
                        <Text>Album</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.option}>
                        <Feather name="user-plus" size={18} />
                        <Text>Bạn bè</Text>
                    </TouchableOpacity>
                </View>

                {/* TOOLBAR */}
                <View style={styles.toolbar}>
                    <MaterialIcons name="insert-emoticon" size={22} />
                    <Feather name="image" size={22} />
                    <Feather name="video" size={22} />
                    <Feather name="link" size={22} />
                </View>

                {/* GRID */}
                {imageActive && (
                    <FlatList
                        data={images}
                        numColumns={GRID_COLS}
                        keyExtractor={(i) => i.id}
                        scrollEnabled={false}
                        renderItem={({ item }) => {
                            if (item.id === 'camera') {
                                return (
                                    <TouchableOpacity style={styles.camera}>
                                        <AntDesign name="camera" size={26} />
                                        <Text>Chụp</Text>
                                    </TouchableOpacity>
                                );
                            }

                            const selected = selectedIds[item.id];

                            return (
                                <TouchableOpacity
                                    style={[
                                        styles.imgBox,
                                        selected && { borderColor: '#007aff', borderWidth: 2 },
                                    ]}
                                    onPress={() => toggleSelect(item.id)}
                                >
                                    <Image source={{ uri: item.uri }} style={styles.img} />
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}

                <View style={{ height: 80 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f5f6fa',
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 35,
        paddingHorizontal: 8,
        backgroundColor: '#fff',
    },

    headerTitle: {
        fontWeight: '700',
    },

    headerSub: {
        fontSize: 12,
        color: '#666',
    },

    postBtn: {
        backgroundColor: '#007aff',
        padding: 8,
        borderRadius: 16,
    },

    inputWrap: {
        padding: 12,
    },

    inputBox: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
    },

    textInput: {
        fontSize: 16,
    },

    row: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 10,
    },

    option: {
        flexDirection: 'row',
        gap: 6,
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 20,
    },

    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 10,
        backgroundColor: '#fff',
    },

    imgBox: {
        flex: 1 / GRID_COLS,
        aspectRatio: 1,
        margin: 4,
        borderRadius: 10,
        overflow: 'hidden',
    },

    img: {
        width: '100%',
        height: '100%',
    },

    camera: {
        flex: 1 / GRID_COLS,
        aspectRatio: 1,
        margin: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
    },
    errorBanner: {
        backgroundColor: '#ffe6e6',
        borderLeftWidth: 4,
        borderLeftColor: '#ff4d4f',
        padding: 10,
        marginHorizontal: 12,
        marginTop: 10,
        borderRadius: 8,
    },
    errorText: {
        color: '#7a0a0a',
        marginBottom: 8,
    },
    errorActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    errorBtn: {
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    errorBtnText: {
        color: '#007aff',
        fontWeight: '600',
    },
});