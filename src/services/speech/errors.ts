import type { MessageKey } from "@/i18n";

import type { SpeechErrorCode, SpeechRecognitionError } from "./types";

/**
 * Per-code metadata: whether a retry can help, and which localized message to
 * show. Keeping this in one table means the UI never displays a raw platform
 * error such as `network` or `audio-capture`.
 */
const ERROR_META: Record<
  SpeechErrorCode,
  { retryable: boolean; messageKey: MessageKey }
> = {
  network: { retryable: true, messageKey: "speechErrors.network" },
  permission: { retryable: false, messageKey: "speechErrors.permission" },
  "no-speech": { retryable: true, messageKey: "speechErrors.noSpeech" },
  "no-match": { retryable: true, messageKey: "speechErrors.noMatch" },
  "audio-capture": { retryable: true, messageKey: "speechErrors.audioCapture" },
  busy: { retryable: true, messageKey: "speechErrors.busy" },
  "language-not-supported": {
    retryable: false,
    messageKey: "speechErrors.languageNotSupported",
  },
  "service-not-allowed": {
    retryable: false,
    messageKey: "speechErrors.serviceNotAllowed",
  },
  "model-missing": { retryable: false, messageKey: "speechErrors.modelMissing" },
  "model-load-failed": {
    retryable: false,
    messageKey: "speechErrors.modelLoadFailed",
  },
  unknown: { retryable: true, messageKey: "speechErrors.unknown" },
};

/**
 * Maps a raw platform error code onto a normalized code.
 *
 * Recognizer implementations report a mix of Web Speech API names
 * (`no-speech`, `audio-capture`) and Android constants (`network`,
 * `client`, `server`, `speech-timeout`).
 */
export function normalizeSpeechError(raw: string | undefined): SpeechErrorCode {
  switch ((raw ?? "").toLowerCase()) {
    case "network":
    case "server":
      return "network";
    case "not-allowed":
    case "permission":
    case "not-allowed-error":
      return "permission";
    case "no-speech":
    case "speech-timeout":
    case "no_speech":
      return "no-speech";
    case "no-match":
      return "no-match";
    case "audio-capture":
    case "audio":
      return "audio-capture";
    case "busy":
    case "client":
    case "aborted":
      return "busy";
    case "language-not-supported":
    case "language_not_supported":
      return "language-not-supported";
    case "service-not-allowed":
    case "service_not_allowed":
      return "service-not-allowed";
    case "model-missing":
      return "model-missing";
    case "model-load-failed":
      return "model-load-failed";
    default:
      return "unknown";
  }
}

export function createSpeechError(raw?: string): SpeechRecognitionError {
  const code = normalizeSpeechError(raw);
  return { code, raw, retryable: ERROR_META[code].retryable };
}

export function describeSpeechError(
  error: SpeechRecognitionError,
  t: (key: MessageKey) => string,
): string {
  return t(ERROR_META[error.code].messageKey);
}
