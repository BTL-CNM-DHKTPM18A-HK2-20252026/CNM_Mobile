import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    alert(`Bar code with type ${type} and data ${data} has been scanned!`);
    // Here you can navigate back or handle the data
    setTimeout(() => setScanned(false), 2000); // Allow re-scanning after 2 seconds
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
  }
});
