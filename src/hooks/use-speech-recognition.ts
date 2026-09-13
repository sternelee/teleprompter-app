import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { Platform } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";

type UseSpeechRecognitionOptions = {
  language?: string;
  /** Localized fallbacks so the hook stays presentation-agnostic. */
  messages?: {
    permissionRequired?: string;
    failed?: string;
  };
  onError?: (message: string) => void;
  onResult: (transcript: string) => void;
};

type SpeechPermissionResponse = {
  granted?: boolean;
};

function formatErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function useSpeechRecognition({
  language = "en-US",
  messages,
  onError,
  onResult,
}: UseSpeechRecognitionOptions) {
  const permissionMessage =
    messages?.permissionRequired ??
    "Microphone permission is required to practice speaking.";
  const failureMessage =
    messages?.failed ?? "Speech recognition failed. Please try again.";
  const [permissionResponse, setPermissionResponse] =
    useState<SpeechPermissionResponse | null>(null);
  const [isListening, setIsListening] = useState(false);
  const shouldAutoRestartRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptTallyRef = useRef("");
  const isRestartingRef = useRef(false);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const emitError = useCallback(
    (message: string) => {
      shouldAutoRestartRef.current = false;
      clearRestartTimer();
      setIsListening(false);
      onError?.(message);
    },
    [clearRestartTimer, onError],
  );

  const requestPermission = useCallback(async () => {
    const permission =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    setPermissionResponse(permission);
    return permission;
  }, []);

  const doStart = useCallback(async () => {
    if (isRestartingRef.current) {
      return;
    }
    isRestartingRef.current = true;

    try {
      await ExpoSpeechRecognitionModule.start({
        addsPunctuation: false,
        continuous: true,
        interimResults: true,
        lang: language,
        maxAlternatives: 1,
        androidIntentOptions: Platform.OS === "android" ? {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 30000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 15000,
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 5000,
        } : undefined,
      });
    } catch (error) {
      emitError(formatErrorMessage(error, failureMessage));
    } finally {
      // Give a small buffer before allowing another start
      setTimeout(() => {
        isRestartingRef.current = false;
      }, 500);
    }
  }, [emitError, failureMessage, language]);

  const startListening = useCallback(async () => {
    const granted =
      permissionResponse?.granted === true
        ? true
        : (await requestPermission()).granted;

    if (!granted) {
      emitError(permissionMessage);
      return;
    }

    shouldAutoRestartRef.current = true;
    clearRestartTimer();
    transcriptTallyRef.current = "";

    await doStart();
  }, [
    clearRestartTimer,
    doStart,
    emitError,
    permissionMessage,
    permissionResponse?.granted,
    requestPermission,
  ]);

  const stopListening = useCallback(async () => {
    shouldAutoRestartRef.current = false;
    clearRestartTimer();
    transcriptTallyRef.current = "";

    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      emitError(formatErrorMessage(error, failureMessage));
    }
  }, [clearRestartTimer, emitError, failureMessage]);

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript =
      event.results[0]?.transcript ?? event.results.at(-1)?.transcript ?? "";

    if (!transcript) return;

    // On Android, after a restart, the transcript is new text only.
    // We need to accumulate final results and prepend them to interim results.
    if (event.isFinal) {
      transcriptTallyRef.current += transcript + " ";
      onResult(transcriptTallyRef.current.trim());
    } else {
      onResult((transcriptTallyRef.current + transcript).trim());
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);

    if (!shouldAutoRestartRef.current) {
      return;
    }

    clearRestartTimer();
    restartTimerRef.current = setTimeout(() => {
      void doStart();
    }, 400);
  });

  useSpeechRecognitionEvent("error", (event) => {
    // "no-speech" is common when user pauses; auto-restart handles it.
    if (event.error === "no-speech" && shouldAutoRestartRef.current) {
      return;
    }
    emitError(event.error ?? failureMessage);
  });

  useEffect(() => {
    void ExpoSpeechRecognitionModule.getPermissionsAsync()
      .then(setPermissionResponse)
      .catch(() => {
        setPermissionResponse(null);
      });

    return () => {
      shouldAutoRestartRef.current = false;
      clearRestartTimer();
    };
  }, [clearRestartTimer]);

  return {
    isListening,
    permissionResponse,
    requestPermission,
    startListening,
    stopListening,
  };
}
