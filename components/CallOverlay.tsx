import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { webrtcService, CallState, CallInfo } from '../services/webrtcService';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';

// Tránh lỗi trên Expo Go khi component native không tồn tại
let RTCView: any = View;
try {
  const WebRTC = require('react-native-webrtc');
  if (WebRTC && WebRTC.RTCView) {
    RTCView = WebRTC.RTCView;
  }
} catch (e) {
  console.log('[CallOverlay] RTCView not available, using fallback View');
}

const { width, height } = Dimensions.get('window');

export const CallOverlay = ({ currentUserId }: { currentUserId: string }) => {
  const { colors } = useTheme() as any;
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = webrtcService.onStateChange((state, info) => {
      setCallState(state);
      setCallInfo(info);
    });

    webrtcService.onLocalStream((stream) => setLocalStream(stream));
    webrtcService.onRemoteStream((stream) => setRemoteStream(stream));

    return unsubscribe;
  }, []);

  if (callState === 'idle') return null;

  const handleAccept = () => webrtcService.acceptCall(currentUserId);
  const handleReject = () => webrtcService.rejectCall(currentUserId);
  const handleEnd = () => webrtcService.endCall(currentUserId);
  const handleToggleMute = () => webrtcService.toggleMute();
  const handleToggleVideo = () => webrtcService.toggleCamera();

  if (callState === 'incoming') {
    return (
      <View style={styles.incomingContainer}>
        <Text style={styles.callerName}>{callInfo?.peerName} đang gọi video...</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={handleReject}>
            <Ionicons name="call" size={24} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={handleAccept}>
            <Ionicons name="call" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.callContainer}>
      {remoteStream && remoteStream.toURL ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={StyleSheet.absoluteFillObject}
          objectFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#FFF' }}>[Video Call không khả dụng trên Expo Go]</Text>
        </View>
      )}
      
      {localStream && localStream.toURL && (
        <View style={styles.localVideoContainer}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            zOrder={1}
          />
        </View>
      )}

      <View style={styles.controlsOverlay}>
        <Text style={styles.statusText}>
          {callState === 'connecting' || callState === 'requesting' ? 'Đang kết nối...' : 'Đang trong cuộc gọi'}
        </Text>
        <Text style={styles.peerNameText}>{callInfo?.peerName}</Text>
        
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={handleToggleMute}>
            <Ionicons name="mic-off" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: '#EF4444' }]} onPress={handleEnd}>
            <Ionicons name="call" size={24} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={handleToggleVideo}>
            <Ionicons name="videocam-off" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  incomingContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    alignItems: 'center',
    zIndex: 9999,
  },
  callerName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 40,
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000',
    zIndex: 9998,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 100,
    height: 150,
    backgroundColor: '#333',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#444',
  },
  localVideo: {
    flex: 1,
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 30,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
  },
  statusText: {
    color: '#DDD',
    fontSize: 14,
  },
  peerNameText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 30,
    marginTop: 20,
  },
  controlBtn: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
