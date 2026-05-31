import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Vibration, Platform } from 'react-native';
import { webrtcService, CallState, CallInfo } from '@chat/services/webrtcService';
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
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const ringtoneRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsubscribe = webrtcService.onStateChange((state, info) => {
      setCallState(state);
      setCallInfo(info);
    });

    webrtcService.onLocalStream((stream) => setLocalStream(stream));
    webrtcService.onRemoteStream((stream) => setRemoteStream(stream));

    return unsubscribe;
  }, []);

  // Ringing vibration pattern when calling or incoming
  useEffect(() => {
    if (callState === 'requesting' || callState === 'incoming') {
      // Vibrate in ring pattern: 500ms on, 1000ms off, repeat
      const pattern = [500, 1000, 500, 2000];
      ringtoneRef.current = setInterval(() => {
        Vibration.vibrate(pattern, false);
      }, 4000);
      Vibration.vibrate(pattern, false);
    } else {
      if (ringtoneRef.current) {
        clearInterval(ringtoneRef.current);
        ringtoneRef.current = null;
      }
      Vibration.cancel();
    }

    return () => {
      if (ringtoneRef.current) clearInterval(ringtoneRef.current);
      Vibration.cancel();
    };
  }, [callState]);

  if (callState === 'idle') return null;

  const handleAccept = () => webrtcService.acceptCall();
  const handleReject = () => webrtcService.rejectCall();
  const handleEnd = () => webrtcService.endCall();
  const handleToggleMute = () => { const muted = webrtcService.toggleMute(); setIsMuted(muted); };
  const handleToggleVideo = () => { const off = webrtcService.toggleCamera(); setIsCameraOff(off); };

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
          <Text style={{ color: '#AAA' }}>Đang kết nối video...</Text>
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
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: '#EF4444' }]} onPress={handleEnd}>
            <Ionicons name="call" size={24} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={handleToggleVideo}>
            <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={24} color="#FFF" />
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
