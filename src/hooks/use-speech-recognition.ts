import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

interface UseSpeechRecognitionOptions {
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  enabled: boolean;
}

export function useSpeechRecognition({ onResult, onError, enabled }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const accumulatedRef = useRef('');
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    ExpoSpeechRecognitionModule.requestPermissionsAsync().then((res) => {
      setHasPermission(res.granted);
    });
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const result = event.results[0];
    if (!result) return;

    const transcript = result.transcript;
    const final = event.isFinal;

    if (final) {
      accumulatedRef.current = accumulatedRef.current
        ? accumulatedRef.current + ' ' + transcript
        : transcript;
      onResult(accumulatedRef.current, true);
    } else {
      const interim = accumulatedRef.current
        ? accumulatedRef.current + ' ' + transcript
        : transcript;
      onResult(interim, false);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') {
      return;
    }
    onError?.(event.message);
    setIsListening(false);
  });

  useSpeechRecognitionEvent('end', () => {
    if (enabledRef.current) {
      setTimeout(() => {
        if (enabledRef.current) {
          startListeningInternal();
        }
      }, 200);
    } else {
      setIsListening(false);
    }
  });

  const startListeningInternal = useCallback(() => {
    if (!hasPermission) return;

    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      addsPunctuation: false,
      iosTaskHint: 'dictation',
    });
  }, [hasPermission]);

  const startListening = useCallback(() => {
    if (!hasPermission) return;
    accumulatedRef.current = '';
    setIsListening(true);
    startListeningInternal();
  }, [hasPermission, startListeningInternal]);

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }
    return () => {
      ExpoSpeechRecognitionModule.abort();
    };
  }, [enabled, startListening, stopListening]);

  return { isListening, hasPermission, startListening, stopListening };
}
