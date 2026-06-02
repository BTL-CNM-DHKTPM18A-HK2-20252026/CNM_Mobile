import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Image, StatusBar } from 'react-native';
import { webrtcService, CallState, CallInfo } from '@chat/services/webrtcService';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// Tránh lỗi trên Expo Go khi component native không tồn tại
let RTCView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WebRTC = require('react-native-webrtc');
  if (WebRTC && WebRTC.RTCView) {
    RTCView = WebRTC.RTCView;
  }
} catch {
  // not available in Expo Go
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const CallOverlay = ({ currentUserId }: { currentUserId: string }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused = currentUserId;
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [duration, setDuration] = useState(0);
  const ringtoneRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsubscribe = webrtcService.onStateChange((state, info) => {
      setCallState(state);
      setCallInfo(info);
      if (state === 'connected') {
        setDuration(0);
        durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      } else {
        if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
        if (state === 'idle') { setDuration(0); setIsMuted(false); setIsCameraOff(false); setIsSpeaker(true); }
      }
    });
    webrtcService.onLocalStream((stream) => setLocalStream(stream));
    webrtcService.onRemoteStream((stream) => setRemoteStream(stream));
    return () => { unsubscribe(); if (durationRef.current) clearInterval(durationRef.current); };
  }, []);

  // Ringing vibration
  useEffect(() => {
    if (callState === 'requesting' || callState === 'incoming') {
      const pattern = [500, 1000, 500, 2000];
      Vibration.vibrate(pattern, false);
      ringtoneRef.current = setInterval(() => Vibration.vibrate(pattern, false), 4000);
    } else {
      if (ringtoneRef.current) { clearInterval(ringtoneRef.current); ringtoneRef.current = null; }
      Vibration.cancel();
    }
    return () => {
      if (ringtoneRef.current) clearInterval(ringtoneRef.current);
      Vibration.cancel();
    };
  }, [callState]);

  const handleAccept = useCallback(() => webrtcService.acceptCall(), []);
  const handleReject = useCallback(() => webrtcService.rejectCall(), []);
  const handleEnd = useCallback(() => webrtcService.endCall(), []);
  const handleToggleMute = useCallback(() => { const m = webrtcService.toggleMute(); setIsMuted(m); }, []);
  const handleToggleCamera = useCallback(() => { const off = webrtcService.toggleCamera(); setIsCameraOff(off); }, []);
  const handleToggleSpeaker = useCallback(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const InCallManager = require('react-native-incall-manager').default;
      const next = !isSpeaker;
      InCallManager.setForceSpeakerphoneOn(next);
      setIsSpeaker(next);
    } catch { setIsSpeaker(s => !s); }
  }, [isSpeaker]);

  if (callState === 'idle') return null;

  const isVideo = callInfo?.callType !== 'VOICE';
  const isConnected = callState === 'connected';
  const isConnecting = callState === 'connecting' || callState === 'requesting';

  // ── Incoming call banner ──────────────────────────────────────────────
  if (callState === 'incoming') {
    return (
      <View style={styles.incomingContainer}>
        <StatusBar backgroundColor="#1E293B" barStyle="light-content" />
        {callInfo?.peerAvatar ? (
          <Image source={{ uri: callInfo.peerAvatar }} style={styles.incomingAvatar} />
        ) : (
          <View style={[styles.incomingAvatar, styles.incomingAvatarFallback]}>
            <Ionicons name="person" size={32} color="#94A3B8" />
          </View>
        )}
        <Text style={styles.incomingName}>{callInfo?.peerName}</Text>
        <Text style={styles.incomingSubtitle}>
          {isVideo ? 'Đang gọi video...' : 'Đang gọi thoại...'}
        </Text>
        <View style={styles.incomingBtnRow}>
          <View style={styles.incomingBtnWrap}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={handleReject}>
              <Ionicons name="call" size={26} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <Text style={styles.btnLabel}>Từ chối</Text>
          </View>
          <View style={styles.incomingBtnWrap}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={handleAccept}>
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={26} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.btnLabel}>Trả lời</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Active call screen ────────────────────────────────────────────────
  return (
    <View style={styles.callContainer}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />

      {/* Remote video / audio background */}
      {isVideo ? (
        remoteStream && remoteStream.toURL && RTCView ? (
          <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFillObject} objectFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.noVideoBackground]}>
            {callInfo?.peerAvatar ? (
              <Image source={{ uri: callInfo.peerAvatar }} style={styles.bgAvatar} blurRadius={8} />
            ) : null}
            <View style={styles.noVideoCenterOverlay}>
              {callInfo?.peerAvatar ? (
                <Image source={{ uri: callInfo.peerAvatar }} style={styles.centerAvatar} />
              ) : (
                <View style={[styles.centerAvatar, styles.centerAvatarFallback]}>
                  <Ionicons name="person" size={48} color="#94A3B8" />
                </View>
              )}
              <Text style={styles.waitText}>
                {isConnecting ? 'Đang kết nối...' : 'Không có video'}
              </Text>
            </View>
          </View>
        )
      ) : (
        /* Voice call background */
        <View style={[StyleSheet.absoluteFillObject, styles.voiceBackground]}>
          {callInfo?.peerAvatar ? (
            <Image source={{ uri: callInfo.peerAvatar }} style={styles.bgAvatar} blurRadius={20} />
          ) : null}
          <View style={styles.voiceDimOverlay} />
          <View style={styles.noVideoCenterOverlay}>
            {callInfo?.peerAvatar ? (
              <Image source={{ uri: callInfo.peerAvatar }} style={styles.centerAvatar} />
            ) : (
              <View style={[styles.centerAvatar, styles.centerAvatarFallback]}>
                <Ionicons name="person" size={48} color="#94A3B8" />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Local video pip */}
      {isVideo && localStream && localStream.toURL && RTCView && (
        <View style={styles.localVideoContainer}>
          <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" zOrder={1} />
        </View>
      )}

      {/* Top bar */}
      <SafeAreaView edges={['top']} style={styles.topBarSafe}>
        <View style={styles.topBar}>
          <Text style={styles.topBarName} numberOfLines={1}>{callInfo?.peerName}</Text>
          <Text style={styles.topBarStatus}>
            {isConnected ? formatDuration(duration) : isConnecting ? 'Đang kết nối...' : 'Cuộc gọi kết thúc'}
          </Text>
        </View>
      </SafeAreaView>

      {/* Controls */}
      <SafeAreaView edges={['bottom']} style={styles.controlsSafe}>
        <View style={styles.controlsRow}>
          <View style={styles.ctrlWrap}>
            <TouchableOpacity style={[styles.controlBtn, isMuted && styles.controlBtnActive]} onPress={handleToggleMute}>
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.ctrlLabel}>{isMuted ? 'Bỏ tắt mic' : 'Tắt mic'}</Text>
          </View>
          {isVideo ? (
            <View style={styles.ctrlWrap}>
              <TouchableOpacity style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]} onPress={handleToggleCamera}>
                <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.ctrlLabel}>{isCameraOff ? 'Bật camera' : 'Tắt camera'}</Text>
            </View>
          ) : (
            <View style={styles.ctrlWrap}>
              <TouchableOpacity style={[styles.controlBtn, isSpeaker && styles.controlBtnSpeaker]} onPress={handleToggleSpeaker}>
                <Ionicons name={isSpeaker ? 'volume-high' : 'volume-low'} size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.ctrlLabel}>{isSpeaker ? 'Loa ngoài' : 'Loa trong'}</Text>
            </View>
          )}
          <View style={styles.ctrlWrap}>
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: '#EF4444' }]} onPress={handleEnd}>
              <Ionicons name="call" size={26} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <Text style={styles.ctrlLabel}>Kết thúc</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  incomingContainer: {
    position: 'absolute',
    top: 50, left: 16, right: 16,
    backgroundColor: '#0F172A',
    paddingVertical: 20, paddingHorizontal: 20,
    borderRadius: 20,
    elevation: 10,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    alignItems: 'center',
    zIndex: 9999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  incomingAvatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  incomingAvatarFallback: { backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  incomingName: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  incomingSubtitle: { color: '#94A3B8', fontSize: 14, marginBottom: 24 },
  incomingBtnRow: { flexDirection: 'row', gap: 48 },
  incomingBtnWrap: { alignItems: 'center', gap: 8 },
  actionBtn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  btnLabel: { color: '#CBD5E1', fontSize: 12 },
  callContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 9998 },
  noVideoBackground: { backgroundColor: '#0F172A' },
  voiceBackground: { backgroundColor: '#0F172A' },
  voiceDimOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  bgAvatar: { ...StyleSheet.absoluteFillObject as any, width: '100%', height: '100%', resizeMode: 'cover' as any },
  noVideoCenterOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16, borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  centerAvatarFallback: { backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  waitText: { color: '#94A3B8', fontSize: 14 },
  localVideoContainer: { position: 'absolute', top: 80, right: 16, width: 96, height: 140, backgroundColor: '#111', borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  localVideo: { flex: 1 },
  topBarSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  topBar: { paddingHorizontal: 20, paddingVertical: 8, alignItems: 'center' },
  topBarName: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  topBarStatus: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  controlsSafe: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'rgba(0,0,0,0.55)' },
  ctrlWrap: { alignItems: 'center', gap: 6, minWidth: 64 },
  controlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  controlBtnActive: { backgroundColor: 'rgba(239,68,68,0.4)' },
  controlBtnSpeaker: { backgroundColor: 'rgba(59,130,246,0.4)' },
  ctrlLabel: { color: '#CBD5E1', fontSize: 11, textAlign: 'center' },
});

