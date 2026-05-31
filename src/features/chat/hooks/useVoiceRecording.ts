import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type VoiceRecordingResult = {
  uri: string | null;
  durationSeconds: number;
  fileName: string;
  mimeType: string;
  tempId: string;
};

export type UseVoiceRecordingReturn = {
  isRecording: boolean;
  recordingTime: number; // seconds
  startRecording: () => Promise<boolean>;
  stopRecording: (discard?: boolean) => Promise<VoiceRecordingResult | null>;
  playingVoiceId: string | null;
  togglePlayVoice: (uri: string | null, id: string) => Promise<void>;
  stopPlayback: () => Promise<void>;
};

/**
 * Hook: useVoiceRecording
 * Responsibilities:
 * - Manage recording lifecycle (start/stop), timers and refs
 * - Provide playback helpers (togglePlayVoice / stopPlayback)
 * - Return a minimal record object on stop so caller can upload/send
 */
export default function useVoiceRecording(): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (isRecording) return false;
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return false;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
      return true;
    } catch (err) {
      console.error('[useVoiceRecording] startRecording failed', err);
      return false;
    }
  }, [isRecording]);

  const stopRecording = useCallback(async (discard = false): Promise<VoiceRecordingResult | null> => {
    const recording = recordingRef.current;
    if (!recording) return null;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsRecording(false);
    const duration = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);

    // detach ref immediately to prevent double-stop
    recordingRef.current = null;
    setRecordingTime(0);

    try {
      if (!discard) {
        await recording.stopAndUnloadAsync();
      } else {
        // if discarding, attempt to stop (best-effort) and return null
        try { await recording.stopAndUnloadAsync(); } catch { }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        return null;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      const isIos = Platform.OS === 'ios';
      const ext = isIos ? 'm4a' : '3gpp';
      const mimeType = isIos ? 'audio/m4a' : 'audio/3gpp';
      const fileName = `voice_${Date.now()}.${ext}`;
      const tempId = `temp-voice-${Date.now()}`;

      const res: VoiceRecordingResult = {
        uri: uri ?? null,
        durationSeconds: duration,
        fileName,
        mimeType,
        tempId,
      };

      return res;
    } catch (err) {
      console.error('[useVoiceRecording] stopRecording failed', err);
      return null;
    }
  }, []);

  const stopPlayback = useCallback(async (): Promise<void> => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (err) {
      console.warn('[useVoiceRecording] stopPlayback error', err);
    } finally {
      setPlayingVoiceId(null);
    }
  }, []);

  const togglePlayVoice = useCallback(async (uri: string | null, id: string) => {
    if (!uri) return;
    try {
      // if same id playing -> stop
      if (playingVoiceId === id) {
        await stopPlayback();
        return;
      }

      // stop previous
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch { }
        try { await soundRef.current.unloadAsync(); } catch { }
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      setPlayingVoiceId(id);

      soundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (!status) return;
        const didFinish = (status as any)?.didJustFinish ?? false;
        if (didFinish) {
          // finished
          void (async () => {
            try { await soundRef.current?.unloadAsync(); } catch { }
            soundRef.current = null;
            setPlayingVoiceId(null);
          })();
        }
      });
      await sound.playAsync();
    } catch (err) {
      console.error('[useVoiceRecording] togglePlayVoice error', err);
      setPlayingVoiceId(null);
    }
  }, [playingVoiceId, stopPlayback]);

  useEffect(() => {
    return () => {
      // cleanup recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      // cleanup sound
      if (soundRef.current) {
        void (async () => {
          try { await soundRef.current?.stopAsync(); } catch { }
          try { await soundRef.current?.unloadAsync(); } catch { }
          soundRef.current = null;
        })();
      }
    };
  }, []);

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    playingVoiceId,
    togglePlayVoice,
    stopPlayback,
  };
}
