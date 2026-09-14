/**
 * System recognizer backend (Google on Android, SFSpeechRecognizer on iOS,
 * Web Speech API on web).
 *
 * Behaviour is carried over from the original `useSpeechRecognition` hook:
 * continuous listening is emulated by restarting the recognizer on every
 * `end` event, and finalized segments are tallied so the transcript keeps
 * growing across restarts.
 *
 * On mainland Android this backend fails with `ERROR_NETWORK` because the
 * recognizer needs to reach Google's servers — see `OfflineSpeechBackend`.
 */

import { Platform } from "react-native";
import type { EventSubscription } from "expo-modules-core";
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";

import { normalizeSpeechError } from "./errors";
import type {
  SpeechBackend,
  SpeechBackendCallbacks,
  SpeechStartOptions,
} from "./types";

/** Delay before re-arming the recognizer after the platform closes it. */
const RESTART_DELAY_MS = 400;
/** Buffer between a manual start and the previous stop settling. */
const START_GUARD_MS = 500;

export class PlatformSpeechBackend implements SpeechBackend {
  readonly id = "platform" as const;

  readonly capabilities = {
    partialResults: true,
    offline: false,
    requiresModel: false,
  } as const;

  private callbacks: SpeechBackendCallbacks | null = null;
  private subscriptions: EventSubscription[] = [];
  private shouldAutoRestart = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private isRestarting = false;
  /** Finalized text accumulated across recognizer restarts. */
  private tally = "";
  private generation = 0;

  async isAvailable(): Promise<boolean> {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      // The probe itself is missing on some platforms (e.g. web shim).
      return Platform.OS === "web";
    }
  }

  async start(
    callbacks: SpeechBackendCallbacks,
    options: SpeechStartOptions,
  ): Promise<void> {
    this.callbacks = callbacks;
    this.shouldAutoRestart = true;
    this.tally = "";
    this.generation += 1;
    const generation = this.generation;

    this.subscribe(generation);
    await this.launch(options.language, generation);
  }

  async stop(): Promise<void> {
    this.shouldAutoRestart = false;
    this.generation += 1;
    this.clearRestartTimer();
    this.tally = "";
    this.unsubscribe();

    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch {
      // Stopping an idle recognizer is not an error worth surfacing.
    }

    this.callbacks?.onActiveChange(false);
    this.callbacks = null;
  }

  async dispose(): Promise<void> {
    await this.stop();
  }

  private subscribe(generation: number) {
    this.unsubscribe();

    this.subscriptions = [
      ExpoSpeechRecognitionModule.addListener("start", () => {
        if (this.generation !== generation) return;
        this.callbacks?.onActiveChange(true);
      }),

      ExpoSpeechRecognitionModule.addListener(
        "result",
        (event: ExpoSpeechRecognitionResultEvent) => {
          if (this.generation !== generation) return;

          const transcript =
            event.results[0]?.transcript ??
            event.results.at(-1)?.transcript ??
            "";

          if (!transcript) return;

          if (event.isFinal) {
            this.tally += `${transcript} `;
            this.callbacks?.onPartial(this.tally.trim());
            this.callbacks?.onFinal(this.tally.trim());
          } else {
            this.callbacks?.onPartial(
              `${this.tally}${transcript}`.trim(),
            );
          }
        },
      ),

      ExpoSpeechRecognitionModule.addListener("end", () => {
        if (this.generation !== generation) return;
        this.callbacks?.onActiveChange(false);

        if (!this.shouldAutoRestart) return;

        this.clearRestartTimer();
        this.restartTimer = setTimeout(() => {
          void this.launch();
        }, RESTART_DELAY_MS);
      }),

      ExpoSpeechRecognitionModule.addListener(
        "error",
        (event: ExpoSpeechRecognitionErrorEvent) => {
          if (this.generation !== generation) return;

          // A pause in speech routinely ends the stream on Android; the
          // auto-restart below handles it, so it is not a user-facing error.
          if (event.error === "no-speech" && this.shouldAutoRestart) {
            return;
          }

          const code = normalizeSpeechError(event.error);
          this.shouldAutoRestart = false;
          this.clearRestartTimer();
          this.callbacks?.onActiveChange(false);
          this.callbacks?.onError({
            code,
            raw: event.error,
            retryable: code === "network" || code === "no-match",
          });
        },
      ),
    ];
  }

  private unsubscribe() {
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
  }

  private clearRestartTimer() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private async launch(
    language?: string,
    generation?: number,
  ): Promise<void> {
    if (this.isRestarting) return;
    this.isRestarting = true;

    try {
      await ExpoSpeechRecognitionModule.start({
        addsPunctuation: false,
        continuous: true,
        interimResults: true,
        lang: language ?? "en-US",
        maxAlternatives: 1,
        androidIntentOptions:
          Platform.OS === "android"
            ? {
                // Keep a single Android recognition session alive instead of
                // letting it finalize on every short pause.
                EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 30000,
                EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 15000,
                EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 5000,
              }
            : undefined,
      });
    } catch (error) {
      if (generation !== undefined && this.generation !== generation) return;

      this.callbacks?.onError({
        code: "unknown",
        raw: error instanceof Error ? error.message : String(error),
        retryable: true,
      });
    } finally {
      setTimeout(() => {
        this.isRestarting = false;
      }, START_GUARD_MS);
    }
  }
}
