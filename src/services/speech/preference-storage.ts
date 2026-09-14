/**
 * Persists the user's engine preference (`auto` / `platform` / `offline`).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SpeechBackendPreference } from "./types";

const STORAGE_KEY = "speech_engine_preference";

export const DEFAULT_SPEECH_PREFERENCE: SpeechBackendPreference = "auto";

function isPreference(value: unknown): value is SpeechBackendPreference {
  return value === "auto" || value === "platform" || value === "offline";
}

export async function loadSpeechPreference(): Promise<SpeechBackendPreference> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : DEFAULT_SPEECH_PREFERENCE;
  } catch (error) {
    console.warn("Failed to load speech engine preference:", error);
    return DEFAULT_SPEECH_PREFERENCE;
  }
}

export async function saveSpeechPreference(
  preference: SpeechBackendPreference,
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, preference);
  } catch (error) {
    console.warn("Failed to save speech engine preference:", error);
  }
}
