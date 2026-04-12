import { AntDesign, Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
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
    Modal,
    Platform,
    Pressable,
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

    const [profile, setProfile] = useState<any>(null);

    const [text, setText] = useState('');
    const [inputHeight, setInputHeight] = useState(120);
    const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
    const [activePanel, setActivePanel] = useState<'none' | 'images' | 'videos'>('none');
    const [keyboardHeight, setKeyboardHeight] = useState(300);

    const [images, setImages] = useState(() => [{ id: 'camera' }] as any[]);
    const textRef = useRef<TextInput | null>(null);

    const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [privacyOption, setPrivacyOption] = useState<string>('friends');

    const PRIVACY_OPTIONS = [
        { key: 'friends', label: 'Bạn bè zalo' },
        { key: 'only_me', label: 'Mình tôi' },
        { key: 'some_friends', label: 'Một số bạn bè' },
        { key: 'except_friends', label: 'Bạn bè ngoại trừ' },
    ];

    const [showPrivacyModal, setShowPrivacyModal] = useState(false);

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
            setKeyboardHeight(e.endCoordinates.height);
            setActivePanel('none');
        });
        return () => {
            showSubscription.remove();
        };
    }, []);

    useEffect(() => {
        setTimeout(() => textRef.current?.focus(), 200);
    }, []);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await authService.getProfile();
                if (mounted && data) setProfile(data);
            } catch (e) {
                // ignore
            }
        })();

        return () => { mounted = false; };
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
                    mediaType: ['photo', 'video'],
                    first: 24,
                    sortBy: [MediaLibrary.SortBy.creationTime],
                });

                const mapped = res.assets.map((a: any) => ({
                    id: a.id,
                    uri: a.uri,
                    type: (a.mediaType === 'video' || a.mediaType === 'Video' || a.type === 'video') ? 'video' : 'image',
                }));

                setImages([{ id: 'camera' }, ...mapped]);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const toggleImagesPanel = () => {
        if (activePanel === 'images') {
            setActivePanel('none');
        } else {
            Keyboard.dismiss();
            setActivePanel('images');
        }
    };

    const toggleVideosPanel = () => {
        if (activePanel === 'videos') {
            setActivePanel('none');
        } else {
            Keyboard.dismiss();
            setActivePanel('videos');
        }
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

    const filteredImages = images.filter(img => {
        if (img.id === 'camera') return true;
        if (activePanel === 'images') return img.type === 'image';
        if (activePanel === 'videos') return img.type === 'video';
        return true;
    });

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#fff' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <View style={{ flex: 1 }}>
                <ScrollView
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.container}
                    style={{ flex: 1 }}
                >
                    {/* HEADER */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Feather name="chevron-left" size={24} />
                        </TouchableOpacity>

                        <View style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'stretch',
                        }}>
                            <Text style={styles.headerTitle}>Bạn bè Zalo</Text>
                            <TouchableOpacity style={[styles.privacySelector, styles.privacyPillActive]} onPress={() => setShowPrivacyModal(true)}>
                                <Text style={[styles.privacyTextActive]}>{PRIVACY_OPTIONS.find(o => o.key === privacyOption)?.label}</Text>
                                <Feather name="chevron-down" size={14} color="#333" style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.postBtn} onPress={handlePost} disabled={submitting}>
                            <Text style={{ color: '#fff' }}>{submitting ? 'Đang đăng...' : 'Đăng'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* INPUT */}
                    <View style={styles.inputWrap}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12 }}>
                            <View style={[styles.inputBox, { minHeight: inputHeight, flex: 1, marginLeft: 10 }]}>
                                <TextInput
                                    ref={textRef}
                                    placeholder="Bạn đang nghĩ gì?"
                                    multiline
                                    value={text}
                                    onFocus={() => setActivePanel('none')}
                                    onChangeText={setText}
                                    onContentSizeChange={(e) =>
                                        setInputHeight(Math.max(120, e.nativeEvent.contentSize.height + 20))
                                    }
                                    style={styles.textInput}
                                />
                            </View>
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

                </ScrollView>

                {/* FOOTER - DOCKED */}
                <View style={styles.footer}>
                    {/* OPTIONS */}
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.option}>
                            <Ionicons name="musical-notes" size={18} color="#8e8e93" />
                            <Text>Nhạc</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.option} onPress={toggleImagesPanel}>
                            <MaterialIcons name="photo" size={18} color="#007aff" />
                            <Text>Album</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.option}>
                            <MaterialIcons name="person-add" size={18} color="#333" />
                            <Text>Bạn bè</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.toolbar}>
                        <TouchableOpacity style={styles.toolbarBtn}>
                            <MaterialIcons name="insert-emoticon" size={24} color="#8e8e93" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.toolbarBtn} onPress={toggleImagesPanel}>
                            <MaterialIcons name="photo" size={24} color={activePanel === 'images' ? '#007aff' : "#8e8e93"} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.toolbarBtn} onPress={toggleVideosPanel}>
                            <MaterialIcons name="videocam" size={24} color={activePanel === 'videos' ? '#ff3b30' : "#8e8e93"} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.toolbarBtn}>
                            <MaterialIcons name="format-color-fill" size={24} color="#8e8e93" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.toolbarBtn}>
                            <Feather name="more-horizontal" size={24} color="#8e8e93" />
                        </TouchableOpacity>
                    </View>

                    {activePanel !== 'none' && (
                        <View style={[styles.panel, { height: keyboardHeight }]}>
                            <FlatList
                                data={filteredImages}
                                numColumns={GRID_COLS}
                                keyExtractor={(i) => i.id}
                                showsVerticalScrollIndicator={false}
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
                                            {item.type === 'video' ? (
                                                <View style={styles.videoThumb}>
                                                    <MaterialIcons name="play-arrow" size={36} color="#fff" />
                                                </View>
                                            ) : (
                                                <Image source={{ uri: item.uri }} style={styles.img} />
                                            )}
                                            {selected && (
                                                <View style={styles.selectedBadge}>
                                                    <MaterialIcons name="check-circle" size={20} color="#007aff" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    )}
                </View>
            </View>

            {/* Privacy Modal (bottom sheet) */}
            <Modal visible={showPrivacyModal} transparent animationType="slide" onRequestClose={() => setShowPrivacyModal(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setShowPrivacyModal(false)}>
                    <Pressable style={styles.modalContainer} onPress={() => {}}>
                        <View style={styles.modalHandle} />
                        {PRIVACY_OPTIONS.map((opt) => (
                            <TouchableOpacity
                                key={opt.key}
                                onPress={() => { setPrivacyOption(opt.key); setShowPrivacyModal(false); }}
                                style={[styles.modalOption, privacyOption === opt.key && styles.modalOptionActive]}
                            >
                                <Text style={[styles.modalOptionText, privacyOption === opt.key && styles.modalOptionTextActive]}>{opt.label}</Text>
                                {privacyOption === opt.key ? <MaterialIcons name="check" size={20} color="#007aff" /> : null}
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPrivacyModal(false)}>
                            <Text style={styles.modalCancelText}>Hủy</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 45 : 20,
        paddingBottom: 15,
        paddingHorizontal: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
    },

    headerTitle: {
        fontWeight: '700',
        fontSize: 16,
    },

    postBtn: {
        backgroundColor: '#007aff',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 16,
    },

    inputWrap: {
        padding: 12,
    },

    inputBox: {
        backgroundColor: '#fff',
        padding: 12,
    },

    textInput: {
        fontSize: 18,
        color: '#333',
        textAlignVertical: 'top',
    },

    row: {
        flexDirection: 'row',
        padding: 10,
        gap: 10,
    },

    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f5f6fa',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
    },

    footer: {
        borderTopWidth: 1,
        borderTopColor: '#f1f1f1',
        backgroundColor: '#fff',
    },

    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
    },

    toolbarBtn: {
        padding: 8,
        marginRight: 12,
    },

    panel: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f1f1f1',
    },

    imgBox: {
        flex: 1 / GRID_COLS,
        aspectRatio: 1,
        margin: 1,
        overflow: 'hidden',
        position: 'relative',
    },

    img: {
        width: '100%',
        height: '100%',
    },

    selectedBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#fff',
        borderRadius: 10,
    },

    inputAvatar: { width: 44, height: 44, borderRadius: 22 },

    videoThumb: { width: '100%', height: '100%', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },

    privacySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },

    privacyPillActive: {},
    privacyTextActive: {
        fontSize: 13,
        color: '#666',
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },

    modalContainer: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 24,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },

    modalHandle: {
        width: 40,
        height: 5,
        backgroundColor: '#e0e0e0',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 10,
    },

    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
    },

    modalOptionActive: {
        backgroundColor: '#f6fbff',
    },

    modalOptionText: {
        fontSize: 16,
        color: '#333',
    },

    modalOptionTextActive: {
        color: '#007aff',
        fontWeight: '700',
    },

    modalCancel: {
        marginTop: 8,
        paddingVertical: 14,
        alignItems: 'center',
    },

    modalCancelText: {
        color: '#007aff',
        fontSize: 16,
        fontWeight: '700',
    },

    camera: {
        flex: 1 / GRID_COLS,
        aspectRatio: 1,
        margin: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f6fa',
    },
    errorBanner: {
        backgroundColor: '#ffe6e6',
        borderLeftWidth: 4,
        borderLeftColor: '#ff4d4f',
        padding: 10,
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