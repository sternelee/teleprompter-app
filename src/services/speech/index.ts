/**
 * Picks the recognition engines for the current platform and user preference.
 *
 * Mirrors the selection logic of Echo-Loop's `speechPracticeBackendProvider`:
 * one preferred engine plus an optional alternative, combined by
 * `FailoverSpeechBackend`.
 *
 * Platform defaults:
 * - iOS   — the system recognizer (SFSpeechRecognizer) is accurate, supports
 *           on-device recognition and always reachable; prefer it, and keep the
 *           offline model as the safety net.
 * - Android — Google's recognizer is unreachable in mainland China and the
 *           OEM engines (HONOR MagicVoice) silently ignore `en-US`, so the
 *           offline model is preferred whenever it has been downloaded. That
 *           avoids a guaranteed ~3 s failure before switching.
 * - Web   — only the Web Speech API is available.
 */

import { Platform } from "react-native";

import { FailoverSpeechBackend } from "./fallback-backend";
import { isModelReady } from "./model-manager";
import { OfflineSpeechBackend } from "./sherpa-backend";
import { PlatformSpeechBackend } from "./platform-backend";
import type {
  SpeechBackend,
  SpeechBackendId,
  SpeechBackendPreference,
} from "./types";

export type ResolveOptions = {
  preference: SpeechBackendPreference;
  onBackendChange?: (id: SpeechBackendId) => void;
};

export function resolveSpeechBackend({
  preference,
  onBackendChange,
}: ResolveOptions): SpeechBackend {
  const platform = new PlatformSpeechBackend();
  const offline = new OfflineSpeechBackend();
  const offlineReady = Platform.OS !== "web" && isModelReady();

  if (preference === "offline") {
    return offline;
  }

  if (preference === "platform" || Platform.OS === "web") {
    return platform;
  }

  // `auto`.
  if (Platform.OS === "ios") {
    return new FailoverSpeechBackend(
      platform,
      offlineReady ? offline : null,
      { onBackendChange },
    );
  }

  return new FailoverSpeechBackend(
    offlineReady ? offline : platform,
    offlineReady ? platform : null,
    { onBackendChange },
  );
}

export { OfflineSpeechBackend } from "./sherpa-backend";
export { PlatformSpeechBackend } from "./platform-backend";
export { FailoverSpeechBackend } from "./fallback-backend";
export { describeSpeechError, normalizeSpeechError } from "./errors";
export {
  DEFAULT_SPEECH_MODEL,
  SPEECH_MODELS,
  formatModelSize,
  type SpeechModelDefinition,
} from "./model-registry";
export {
  deleteModel,
  downloadModel,
  getModelPath,
  isModelReady,
  verifyModel,
  type ModelProgress,
} from "./model-manager";
export type {
  SpeechBackend,
  SpeechBackendCallbacks,
  SpeechBackendId,
  SpeechBackendPreference,
  SpeechErrorCode,
  SpeechRecognitionError,
  SpeechStartOptions,
} from "./types";
