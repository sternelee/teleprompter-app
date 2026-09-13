import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";

type SpeakOptions = {
  /** Highlighted word while it is being spoken. Omit for sentence playback. */
  highlightAs?: string | null;
};

export function useWordSpeech() {
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const isAvailableRef = useRef(true);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      if (!isAvailableRef.current || !text.trim()) return;

      const highlight = options.highlightAs ?? null;

      Speech.stop();
      setSpeakingWord(highlight);

      Speech.speak(text, {
        language: "en-US",
        pitch: 1,
        rate: 0.9,
        onDone: () =>
          setSpeakingWord((current) =>
            current === highlight ? null : current,
          ),
        onError: () =>
          setSpeakingWord((current) =>
            current === highlight ? null : current,
          ),
      });
    },
    [],
  );

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setSpeakingWord(null);
  }, []);

  return { speak, speakingWord, stopSpeaking };
}
