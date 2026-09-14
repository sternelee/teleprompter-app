/**
 * Speech recognition, resolved to whichever engine suits the current platform.
 *
 * The public shape is unchanged from the previous platform-only version so the
 * teleprompter and the word matcher need no changes: callers still get
 * `startListening` / `stopListening` / `isListening` and a transcript callback.
 *
 * Differences worth knowing:
 * - `isListening` now reflects the engine actually being ready, reported by the
 *   backend itself. On-device engines never emit `onReadyForSpeech`, so relying
 *   on that single platform event used to leave the UI stuck on "warming up".
 * - errors arrive already normalized and localized, never as raw codes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

import { useApp } from "@/contexts/app-context";
import { useI18n } from "@/i18n";
import { resolveSpeechBackend } from "@/services/speech";
import { describeSpeechError } from "@/services/speech/errors";
import type {
  SpeechBackend,
  SpeechBackendId,
} from "@/services/speech/types";

type UseSpeechRecognitionOptions = {
  language?: string;
  onError?: (message: string) => void;
  onResult: (transcript: string) => void;
};

type SpeechPermissionResponse = {
  granted?: boolean;
};

export function useSpeechRecognition({
  language = "en-US",
  onError,
  onResult,
}: UseSpeechRecognitionOptions) {
  const { speechEngine } = useApp();
  const { t } = useI18n();

  const [permissionResponse, setPermissionResponse] =
    useState<SpeechPermissionResponse | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [activeBackendId, setActiveBackendId] =
    useState<SpeechBackendId | null>(null);

  const backendRef = useRef<SpeechBackend | null>(null);

  // Keep the newest callbacks reachable from the backend without rebuilding it.
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const tRef = useRef(t);
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
    tRef.current = t;
  }, [onError, onResult, t]);

  useEffect(() => {
    const backend = resolveSpeechBackend({
      preference: speechEngine,
      onBackendChange: setActiveBackendId,
    });
    backendRef.current = backend;

    return () => {
      backendRef.current = null;
      setIsListening(false);
      void backend.dispose();
    };
  }, [speechEngine]);

  const requestPermission = useCallback(async () => {
    const permission =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    setPermissionResponse(permission);
    return permission;
  }, []);

  const startListening = useCallback(async () => {
    const backend = backendRef.current;
    if (!backend) return;

    const granted =
      permissionResponse?.granted === true
        ? true
        : (await requestPermission()).granted;

    if (!granted) {
      setIsListening(false);
      onErrorRef.current?.(tRef.current("speechErrors.permission"));
      return;
    }

    await backend.start(
      {
        onPartial: (text) => onResultRef.current(text),
        onFinal: (text) => onResultRef.current(text),
        onError: (error) =>
          onErrorRef.current?.(describeSpeechError(error, tRef.current)),
        onActiveChange: (active) => setIsListening(active),
      },
      { language },
    );
  }, [language, permissionResponse?.granted, requestPermission]);

  const stopListening = useCallback(async () => {
    setIsListening(false);
    await backendRef.current?.stop();
  }, []);

  useEffect(() => {
    void ExpoSpeechRecognitionModule.getPermissionsAsync()
      .then(setPermissionResponse)
      .catch(() => {
        setPermissionResponse(null);
      });
  }, []);

  return {
    isListening,
    permissionResponse,
    requestPermission,
    startListening,
    stopListening,
    /** Which engine is actually serving this session. */
    activeBackendId,
  };
}
