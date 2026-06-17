import { useCallback, useEffect, useRef, useState } from "react";
import * as Speech from "expo-speech";

export function useWordSpeech() {
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const isAvailableRef = useRef(true);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speak = useCallback((word: string) => {
    if (!isAvailableRef.current) return;

    Speech.stop();
    setSpeakingWord(word);

    Speech.speak(word, {
      language: "en-US",
      pitch: 1,
      rate: 0.9,
      onDone: () => setSpeakingWord((current) =>
        current === word ? null : current
      ),
      onError: () => setSpeakingWord((current) =>
        current === word ? null : current
      ),
    });
  }, []);

  return { speak, speakingWord };
}
