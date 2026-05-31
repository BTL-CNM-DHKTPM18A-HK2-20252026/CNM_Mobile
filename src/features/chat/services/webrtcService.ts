/**
 * Real WebRTC Service - Cho Development Build
 * Tương thích signaling protocol với Web (CNM_Web).
 * 
 * Signaling via STOMP: /app/call/signal (send), /user/queue/call-signal (receive)
 * Signal types: CALL_REQUEST | CALL_ACCEPTED | CALL_REJECTED | OFFER | ANSWER | ICE_CANDIDATE | END_CALL | PEER_BUSY
 */

import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';

export type CallState = 'idle' | 'requesting' | 'incoming' | 'connecting' | 'connected' | 'ended';

export interface CallSignal {
  type: string;
  senderId: string;
  receiverId: string;
  callId: string;
  conversationId?: string;
  callerName?: string;
  callerAvatar?: string;
  payload?: any;
}

export interface CallInfo {
  callId: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string;
  conversationId: string;
  isCaller: boolean;
}

type CallStateListener = (state: CallState, info: CallInfo | null) => void;
type StreamListener = (stream: MediaStream | null) => void;
type MediaErrorListener = (error: string) => void;
type SignalSender = (signal: Partial<CallSignal>) => boolean;

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Own TURN server on api.fruvia.id.vn
  {
    urls: 'turn:api.fruvia.id.vn:3478',
    username: 'fruvia',
    credential: 'FrUV!aTURN2026_',
  },
  {
    urls: 'turn:api.fruvia.id.vn:3478?transport=tcp',
    username: 'fruvia',
    credential: 'FrUV!aTURN2026_',
  },
];

class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callState: CallState = 'idle';
  private callInfo: CallInfo | null = null;

  private stateListeners = new Set<CallStateListener>();
  private localStreamListeners = new Set<StreamListener>();
  private remoteStreamListeners = new Set<StreamListener>();
  private mediaErrorListeners = new Set<MediaErrorListener>();
  private signalSender: SignalSender | null = null;
  private pendingCandidates: any[] = [];
  private recentSignalKeys = new Set<string>();
  private connectingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private incomingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isCleaningUp = false;

  // ── State ──────────────────────────────────────────

  private setState(state: CallState) {
    if (this.callState === state) return;
    console.log(`[WebRTC] State ${this.callState} -> ${state}`);
    this.callState = state;
    this.stateListeners.forEach((fn) => fn(state, this.callInfo));
  }

  getCallState(): CallState { return this.callState; }
  getCallInfo(): CallInfo | null { return this.callInfo; }
  getLocalStream(): MediaStream | null { return this.localStream; }
  getRemoteStream(): MediaStream | null { return this.remoteStream; }

  setSignalSender(fn: SignalSender) {
    this.signalSender = fn;
    console.log('[WebRTC] Signal sender attached');
  }

  onStateChange(listener: CallStateListener) {
    this.stateListeners.add(listener);
    return () => { this.stateListeners.delete(listener); };
  }

  onLocalStream(cb: StreamListener) {
    this.localStreamListeners.add(cb);
    return () => { this.localStreamListeners.delete(cb); };
  }

  onRemoteStream(cb: StreamListener) {
    this.remoteStreamListeners.add(cb);
    return () => { this.remoteStreamListeners.delete(cb); };
  }

  onMediaError(cb: MediaErrorListener) {
    this.mediaErrorListeners.add(cb);
    return () => { this.mediaErrorListeners.delete(cb); };
  }

  // ── Signal Sending ────────────────────────────────

  private sendSignal(signal: Partial<CallSignal>): boolean {
    console.log('[WebRTC] Sending', signal.type, 'to', signal.receiverId);
    if (!this.signalSender) {
      console.error('[WebRTC] No signal sender');
      return false;
    }
    return this.signalSender(signal);
  }

  // ── Incoming Signal Router ─────────────────────────

  handleIncomingSignal(rawSignal: any) {
    try {
      const signal: CallSignal = typeof rawSignal === 'string' ? JSON.parse(rawSignal) : rawSignal;

      const signalKey = `${signal.type}:${signal.callId}:${signal.senderId}`;
      if (this.recentSignalKeys.has(signalKey)) return;
      this.recentSignalKeys.add(signalKey);
      setTimeout(() => this.recentSignalKeys.delete(signalKey), 5000);

      console.log(`[WebRTC] RECEIVED: ${signal.type}`);

      switch (signal.type) {
        case 'CALL_REQUEST': this.handleIncomingCall(signal); break;
        case 'CALL_ACCEPTED': this.handleCallAccepted(signal); break;
        case 'CALL_REJECTED':
        case 'PEER_BUSY': this.handleCallRejected(); break;
        case 'OFFER': this.handleOffer(signal); break;
        case 'ANSWER': this.handleAnswer(signal); break;
        case 'ICE_CANDIDATE': this.handleIceCandidate(signal); break;
        case 'END_CALL':
        case 'CALL_END': this.handleRemoteEnd(); break;
      }
    } catch (err) {
      console.error('[WebRTC] Signal error:', err);
    }
  }

  // ── Start Call (Caller) ────────────────────────────

  startCall(
    currentUserId: string,
    peerId: string,
    peerName: string,
    peerAvatar?: string,
    conversationId?: string,
    callerName?: string,
    callerAvatar?: string,
  ) {
    if (this.callState !== 'idle') {
      console.warn('[WebRTC] Cannot start — not idle');
      return;
    }

    const callId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.callInfo = {
      callId,
      peerId,
      peerName,
      peerAvatar,
      conversationId: conversationId || '',
      isCaller: true,
    };

    console.log('[WebRTC] Starting call →', peerName, callId);
    this.setState('requesting');

    this.connectingTimeoutId = setTimeout(() => {
      if (this.callState === 'requesting' || this.callState === 'connecting') {
        console.warn('[WebRTC] Call timeout');
        this.endCall();
      }
    }, 30_000);

    this.sendSignal({
      type: 'CALL_REQUEST',
      senderId: currentUserId,
      receiverId: peerId,
      callId,
      callerName: callerName || 'Bạn',
      callerAvatar,
      conversationId: conversationId || '',
    });
  }

  // ── Incoming Call ──────────────────────────────────

  private handleIncomingCall(signal: CallSignal) {
    if (this.callState !== 'idle') {
      console.warn('[WebRTC] Busy — auto-rejecting');
      this.sendSignal({
        type: 'PEER_BUSY',
        senderId: signal.receiverId,
        receiverId: signal.senderId,
        callId: signal.callId,
      });
      return;
    }

    this.callInfo = {
      callId: signal.callId,
      peerId: signal.senderId,
      peerName: signal.callerName || 'Unknown',
      peerAvatar: signal.callerAvatar,
      conversationId: signal.conversationId || '',
      isCaller: false,
    };

    console.log('[WebRTC] Incoming from', this.callInfo.peerName);
    this.setState('incoming');

    this.incomingTimeoutId = setTimeout(() => {
      if (this.callState === 'incoming') {
        console.warn('[WebRTC] Incoming timeout');
        this.rejectCall();
      }
    }, 30_000);
  }

  // ── Accept / Reject / End ──────────────────────────

  async acceptCall() {
    if (!this.callInfo || this.callState !== 'incoming') return;

    if (this.incomingTimeoutId) {
      clearTimeout(this.incomingTimeoutId);
      this.incomingTimeoutId = null;
    }

    console.log('[WebRTC] Accepting call...');
    this.setState('connecting');
    await this.acquireMedia();

    this.sendSignal({
      type: 'CALL_ACCEPTED',
      receiverId: this.callInfo.peerId,
      callId: this.callInfo.callId,
    });
  }

  rejectCall() {
    if (!this.callInfo) return;
    console.log('[WebRTC] Rejecting');
    this.sendSignal({
      type: 'CALL_REJECTED',
      receiverId: this.callInfo.peerId,
      callId: this.callInfo.callId,
    });
    this.cleanup();
  }

  endCall() {
    if (!this.callInfo) { this.cleanup(); return; }
    console.log('[WebRTC] Ending');
    this.sendSignal({
      type: 'END_CALL',
      receiverId: this.callInfo.peerId,
      callId: this.callInfo.callId,
    });
    this.cleanup();
  }

  // ── Signal Handlers ────────────────────────────────

  private handleCallRejected() {
    console.log('[WebRTC] Rejected by peer');
    this.cleanup();
  }

  private handleRemoteEnd() {
    console.log('[WebRTC] Remote ended');
    this.cleanup();
  }

  private async handleCallAccepted(_signal: CallSignal) {
    if (!this.callInfo?.isCaller) return;
    console.log('[WebRTC] Call accepted — handshake...');
    this.setState('connecting');
    await this.acquireMedia();
    this.createPeerConnection();
    await this.createAndSendOffer();
  }

  private async handleOffer(signal: CallSignal) {
    if (!this.callInfo) return;

    // Wait for media if not ready yet
    if (!this.localStream) {
      console.log('[WebRTC] OFFER before media — waiting...');
      const start = Date.now();
      while (!this.localStream && Date.now() - start < 5000) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!this.localStream) {
        console.error('[WebRTC] Media timeout');
        this.endCall();
        return;
      }
    }

    console.log('[WebRTC] Processing OFFER');
    this.createPeerConnection();

    try {
      await this.pc!.setRemoteDescription(new RTCSessionDescription(signal.payload));
      await this.flushPendingCandidates();

      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);

      this.sendSignal({
        type: 'ANSWER',
        receiverId: signal.senderId,
        callId: signal.callId,
        payload: answer,
      });
    } catch (err) {
      console.error('[WebRTC] Offer error:', err);
      this.endCall();
    }
  }

  private async handleAnswer(signal: CallSignal) {
    if (!this.pc) return;
    console.log('[WebRTC] Processing ANSWER');
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
      await this.flushPendingCandidates();
    } catch (err) {
      console.error('[WebRTC] Answer error:', err);
    }
  }

  private async handleIceCandidate(signal: CallSignal) {
    if (this.pc?.remoteDescription) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(signal.payload));
      } catch (err) {
        console.error('[WebRTC] ICE error:', err);
      }
    } else {
      this.pendingCandidates.push(signal.payload);
    }
  }

  // ── Media ──────────────────────────────────────────

  private async acquireMedia() {
    try {
      console.log('[WebRTC] Getting media...');
      const stream = await mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        audio: true,
      });

      this.localStream = stream as unknown as MediaStream;
      console.log('[WebRTC] Media ready');
      this.localStreamListeners.forEach((cb) => cb(this.localStream));
    } catch (err: any) {
      console.warn('[WebRTC] Video failed, audio only:', err.message);
      try {
        const audioStream = await mediaDevices.getUserMedia({ video: false, audio: true });
        this.localStream = audioStream as unknown as MediaStream;
        this.mediaErrorListeners.forEach((cb) => cb('Chỉ có audio (Camera không khả dụng)'));
        this.localStreamListeners.forEach((cb) => cb(this.localStream));
      } catch (err2: any) {
        console.error('[WebRTC] No media:', err2.message);
        this.localStream = new MediaStream();
        this.mediaErrorListeners.forEach((cb) => cb('Không thể mở camera/mic'));
        this.localStreamListeners.forEach((cb) => cb(this.localStream));
      }
    }
  }

  // ── PeerConnection ─────────────────────────────────

  private createPeerConnection() {
    if (this.pc) return;

    console.log('[WebRTC] Creating PeerConnection');
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.remoteStream = new MediaStream();

    if (this.localStream) {
      let hasAudio = false, hasVideo = false;
      this.localStream.getTracks().forEach((track: any) => {
        this.pc!.addTrack(track, this.localStream!);
        if (track.kind === 'audio') hasAudio = true;
        if (track.kind === 'video') hasVideo = true;
      });
      if (!hasAudio) this.pc.addTransceiver('audio', { direction: 'recvonly' });
      if (!hasVideo) this.pc.addTransceiver('video', { direction: 'recvonly' });
    } else {
      this.pc.addTransceiver('audio', { direction: 'recvonly' });
      this.pc.addTransceiver('video', { direction: 'recvonly' });
    }

    this.pc.ontrack = (event: any) => {
      if (event.track) this.remoteStream!.addTrack(event.track);
      this.remoteStreamListeners.forEach((cb) => cb(this.remoteStream));
    };

    this.pc.onicecandidate = (event: any) => {
      if (event.candidate && this.callInfo) {
        this.sendSignal({
          type: 'ICE_CANDIDATE',
          receiverId: this.callInfo.peerId,
          callId: this.callInfo.callId,
          payload: event.candidate,
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection: ${this.pc?.connectionState}`);
      switch (this.pc?.connectionState) {
        case 'connected':
          if (this.disconnectTimeoutId) { clearTimeout(this.disconnectTimeoutId); this.disconnectTimeoutId = null; }
          this.setState('connected');
          break;
        case 'failed':
          console.warn('[WebRTC] Connection failed');
          this.cleanup();
          break;
        case 'disconnected':
          this.disconnectTimeoutId = setTimeout(() => {
            if (this.pc?.connectionState === 'disconnected') this.cleanup();
          }, 10_000);
          break;
        case 'closed':
          this.cleanup();
          break;
      }
    };
  }

  private async createAndSendOffer() {
    if (!this.pc || !this.callInfo) return;
    console.log('[WebRTC] Creating OFFER...');
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.sendSignal({
        type: 'OFFER',
        receiverId: this.callInfo.peerId,
        callId: this.callInfo.callId,
        payload: offer,
      });
      console.log('[WebRTC] OFFER sent');
    } catch (err) {
      console.error('[WebRTC] Offer creation failed:', err);
      this.endCall();
    }
  }

  private async flushPendingCandidates() {
    if (this.pendingCandidates.length === 0) return;
    console.log(`[WebRTC] Flushing ${this.pendingCandidates.length} ICE candidates`);
    for (const c of this.pendingCandidates) {
      try { await this.pc!.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    this.pendingCandidates = [];
  }

  // ── Media Controls ─────────────────────────────────

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const tracks = this.localStream.getAudioTracks();
    if (tracks.length > 0) {
      tracks[0].enabled = !tracks[0].enabled;
      return !tracks[0].enabled; // true = muted
    }
    return false;
  }

  toggleCamera(): boolean {
    if (!this.localStream) return false;
    const tracks = this.localStream.getVideoTracks();
    if (tracks.length > 0) {
      tracks[0].enabled = !tracks[0].enabled;
      return !tracks[0].enabled; // true = off
    }
    return false;
  }

  // ── Cleanup ────────────────────────────────────────

  cleanup() {
    if (this.isCleaningUp) return;
    if (this.callState === 'idle' && !this.pc && !this.localStream) return;

    this.isCleaningUp = true;
    console.log('[WebRTC] Cleanup');

    if (this.connectingTimeoutId) { clearTimeout(this.connectingTimeoutId); this.connectingTimeoutId = null; }
    if (this.incomingTimeoutId) { clearTimeout(this.incomingTimeoutId); this.incomingTimeoutId = null; }
    if (this.disconnectTimeoutId) { clearTimeout(this.disconnectTimeoutId); this.disconnectTimeoutId = null; }

    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t: any) => t.stop());
      this.localStream = null;
      this.localStreamListeners.forEach((cb) => cb(null));
    }

    this.remoteStream = null;
    this.remoteStreamListeners.forEach((cb) => cb(null));
    this.pendingCandidates = [];
    this.recentSignalKeys.clear();
    this.callInfo = null;
    this.setState('idle');
    this.isCleaningUp = false;
  }
}

export const webrtcService = new WebRTCService();
