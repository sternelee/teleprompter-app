/**
 * Platform-agnostic speech recognition contract.
 *
 * The teleprompter only ever needs a stream of text; it does not care whether
 * that text comes from the OS recognizer (Google / Apple) or an on-device
 * model. Backends implement this interface so the matching engine and UI stay
 * untouched.
 */

/** Backend identifiers. */
export type SpeechBackendId = "platform" | "offline";

/** User-facing engine preference. `auto` lets the resolver decide. */
export type SpeechBackendPreference = SpeechBackendId | "auto";

export interface SpeechBackendCapabilities {
  /** Emits interim results while the learner is still speaking. */
  partialResults: boolean;
  /** Works without a network connection. */
  offline: boolean;
  /** Needs a downloaded model before it can start. */
  requiresModel: boolean;
}

/**
 * Normalized error codes.
 *
 * Deliberately domain-level rather than raw platform codes: every backend maps
 * its own failures onto this set so the UI can show one localized message.
 */
export type SpeechErrorCode =
  | "network"
  | "permission"
  | "no-speech"
  | "no-match"
  | "audio-capture"
  | "busy"
  | "language-not-supported"
  | "service-not-allowed"
  | "model-missing"
  | "model-load-failed"
  | "unknown";

export interface SpeechRecognitionError {
  code: SpeechErrorCode;
  /** Original platform code, for logging only — never shown to the user. */
  raw?: string;
  /** Transient failures are worth retrying; fatal ones should stop the session. */
  retryable: boolean;
}

export interface SpeechBackendCallbacks {
  /** Interim transcript. The full transcript so far, not a delta. */
  onPartial: (text: string) => void;
  /** Final transcript for the current utterance. */
  onFinal: (text: string) => void;
  onError: (error: SpeechRecognitionError) => void;
  /**
   * Fired when the recognition session actually starts/stops.
   *
   * Not all recognizers emit a "ready" callback, so backends report this
   * themselves instead of the UI inferring it from a single platform event.
   */
  onActiveChange: (active: boolean) => void;
}

export interface SpeechStartOptions {
  /** BCP-47 tag, e.g. `en-US`. */
  language: string;
}

/**
 * Note: sherpa-onnx hotwords are deliberately not supported here. They require
 * `modeling_unit` plus a bpe vocabulary, and the streaming English model we ship
 * has no `bpe.model` — passing a hotwords string made sherpa abort with a
 * use-after-free on device. Revisit only with a model that bundles the vocab.
 */

export interface SpeechBackend {
  readonly id: SpeechBackendId;
  readonly capabilities: SpeechBackendCapabilities;
  /** Whether this backend can run right now (model downloaded, service present, ...). */
  isAvailable: () => Promise<boolean>;
  start: (
    callbacks: SpeechBackendCallbacks,
    options: SpeechStartOptions,
  ) => Promise<void>;
  stop: () => Promise<void>;
  /** Release native resources. The backend is unusable afterwards. */
  dispose: () => Promise<void>;
}
