import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar, Dimensions, Alert, Modal, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { authService } from '@/services/authService';

const { width, height } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingUuid, setPendingUuid] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      // 1. Check if it's a Fruvia login QR (we expect something like 'frv:auth:UUID')
      let uuid = data;
      if (data.startsWith('frv:auth:')) {
        uuid = data.split(':')[2];
      }

      // 2. We need to verify the user is logged in first
      const loggedIn = await authService.isAuthenticated();
      if (!loggedIn) {
        Alert.alert('Chưa đăng nhập', 'Bạn cần đăng nhập trên điện thoại trước khi xác nhận quét mã QR.');
        setScanned(false);
        return;
      }

      // Notify backend that QR was scanned (to show user info on Web)
      authService.notifyQrScanned(uuid);

      // 3. Show custom confirmation dialog
      setPendingUuid(uuid);
      setShowConfirm(true);
    } catch (error: any) {
      console.error('QR Scan error:', error);
      Alert.alert('Lỗi', error.toString());
      setScanned(false);
    }
  };

  const handleConfirmLogin = async () => {
    if (!pendingUuid) return;
    setConfirming(true);
    try {
      const success = await authService.confirmQrLogin(pendingUuid);
      if (success) {
        setShowConfirm(false);
        setScanned(false);
        setPendingUuid(null);
        Alert.alert('Thành công', 'Web của bạn đã được đăng nhập!');
        router.back();
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.toString());
      setShowConfirm(false);
      setScanned(false);
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelLogin = () => {
    setShowConfirm(false);
    setScanned(false);
    setPendingUuid(null);
  };

  if (!permission) {
    // Camera permissions are still loading.
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Chúng tôi cần quyền truy cập camera để quét mã QR</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
          <Text style={styles.permissionBtnText}>Cấp quyền</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Real Camera Preview */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />

      {/* Overlay Layer */}
      <View style={styles.overlay}>
        {/* Top Header */}
        <SafeAreaView style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.myQrBtn}>
            <MaterialCommunityIcons name="account-details" size={20} color="white" />
            <Text style={styles.myQrText}>Mã QR của tôi</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="ellipsis-horizontal" size={24} color="white" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Combined Guidance and Scan Area (Xích lại gần nhau) */}
        <View style={styles.mainScanSection}>
            <Text style={styles.guidanceText}>Quét mọi mã QR</Text>
            
            <View style={styles.scanFrame}>
                {/* Corners */}
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
            </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.footerActions}>
            <View style={styles.actionItem}>
                <TouchableOpacity style={styles.actionIconCircle}>
                    <Ionicons name="image" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Ảnh có sẵn</Text>
            </View>
        </View>
      </View>

      {/* Custom Confirmation Modal */}
      <Modal
        visible={showConfirm}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelLogin}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="desktop-outline" size={24} color="#0068ff" />
              </View>
              <Text style={styles.modalTitle}>Đăng nhập trên Web</Text>
              <Text style={styles.modalSubtitle}>
                Bạn có muốn cho phép đăng nhập trên trình duyệt Web không?
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={handleCancelLogin}
                disabled={confirming}
              >
                <Text style={styles.cancelBtnText}>Từ chối</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]} 
                onPress={handleConfirmLogin}
                disabled={confirming}
              >
                {confirming ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.confirmBtnText}>Cho phép</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)', // Semi-transparent for all screen
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 40,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  myQrText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  mainScanSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -80, // Pushes everything up
  },
  guidanceText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 20, // Small gap for close-together effect
    fontWeight: '500',
  },
  scanFrame: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: 'rgba(255,255,255,0.8)',
    borderWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 20,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 20,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 20,
  },
  footerActions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: 60,
      paddingHorizontal: 20,
  },
  actionItem: {
      alignItems: 'center',
  },
  actionIconCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
  },
  actionLabel: {
      color: 'white',
      fontSize: 11,
  },
  permissionText: {
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  permissionBtn: {
    backgroundColor: '#0068ff',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  permissionBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    alignItems: 'center',
    paddingBottom: 32,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#f0f7ff',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 50,
  },
  modalFooter: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f0f0f0',
  },
  confirmBtn: {
    backgroundColor: '#0068ff',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#666',
  },
  confirmBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'white',
  }
});
