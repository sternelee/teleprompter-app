import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";

type UseSpeechRecognitionOptions = {
  language?: string;
  onError?: (message: string) => void;
  onResult: (transcript: string) => void;
};

type SpeechPermissionResponse = {
  granted?: boolean;
};

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Speech recognition failed. Please try again.";
}

export function useSpeechRecognition({
  language = "en-US",
  onError,
  onResult,
}: UseSpeechRecognitionOptions) {
  const [permissionResponse, setPermissionResponse] =
    useState<SpeechPermissionResponse | null>(null);
  const [isListening, setIsListening] = useState(false);
  const shouldAutoRestartRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const startListening = useCallback(async () => {
    const granted =
      permissionResponse?.granted === true
        ? true
        : (await requestPermission()).granted;

    if (!granted) {
      emitError("Microphone permission is required to practice speaking.");
      return;
    }

    shouldAutoRestartRef.current = true;
    clearRestartTimer();

    try {
      await ExpoSpeechRecognitionModule.start({
        addsPunctuation: false,
        continuous: true,
        interimResults: true,
        lang: language,
        maxAlternatives: 1,
      });
    } catch (error) {
      emitError(formatErrorMessage(error));
    }
  }, [
    clearRestartTimer,
    emitError,
    language,
    permissionResponse?.granted,
    requestPermission,
  ]);

  const stopListening = useCallback(async () => {
    shouldAutoRestartRef.current = false;
    clearRestartTimer();

    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      emitError(formatErrorMessage(error));
    }
  }, [clearRestartTimer, emitError]);

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript =
      event.results[0]?.transcript ?? event.results.at(-1)?.transcript ?? "";

    if (transcript) {
      onResult(transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);

    if (!shouldAutoRestartRef.current) {
      return;
    }

    clearRestartTimer();
    restartTimerRef.current = setTimeout(() => {
      void startListening();
    }, 250);
  });

  useSpeechRecognitionEvent("error", (event) => {
    emitError(event.error ?? "Speech recognition failed. Please try again.");
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
