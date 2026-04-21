/**
 * MOCK WebRTC Service - DÙNG CHO EXPO GO
 * (Tính năng Video Call yêu cầu Development Build, không chạy được trên Expo Go)
 */

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

class WebRTCService {
  private callState: CallState = 'idle';
  private callInfo: CallInfo | null = null;
  private stateListeners: Set<CallStateListener> = new Set();
  
  // Dummy streams
  private localStream: any = null;
  private remoteStream: any = null;

  setSignalSender(fn: any) {
    console.log('[WebRTC Mock] Signal sender attached');
  }

  getCallState(): CallState { return this.callState; }
  getCallInfo(): CallInfo | null { return this.callInfo; }
  getLocalStream(): any { return null; }
  getRemoteStream(): any { return null; }

  onStateChange(listener: CallStateListener) {
    this.stateListeners.add(listener);
    return () => { this.stateListeners.delete(listener); };
  }

  onLocalStream(cb: any) {}
  onRemoteStream(cb: any) {}
  onMediaError(cb: any) {}

  handleIncomingSignal(signal: any) {
    console.log('[WebRTC Mock] Incoming signal ignored in Expo Go:', signal.type);
  }

  async startCall(...args: any[]) {
    alert('Tính năng Video Call yêu cầu Development Build. Không hỗ trợ trên Expo Go.');
  }

  async acceptCall(userId: string) {}
  rejectCall(userId: string) {}
  endCall(userId: string) {}

  toggleMute() { return false; }
  toggleCamera() { return false; }
  cleanup() {
    this.callState = 'idle';
    this.callInfo = null;
  }
}

export const webrtcService = new WebRTCService();
