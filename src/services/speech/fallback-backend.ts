/**
 * Failover + retry decorator around two backends.
 *
 * Same role as Echo-Loop's `OfflineAsrBackend`: keep the session alive when the
 * preferred engine cannot serve this device. Two behaviours make that work:
 *
 * - transient failures (network hiccups, engine restarts) are retried with
 *   backoff instead of ending the session after two seconds;
 * - failures that mean "this backend can never work here" (no Google access,
 *   no recognizer service) switch to the other backend once.
 */

import { createSpeechError } from "./errors";
import type {
  SpeechBackend,
  SpeechBackendCallbacks,
  SpeechBackendId,
  SpeechStartOptions,
  SpeechRecognitionError,
} from "./types";

const RETRY_DELAYS_MS = [600, 1500, 3000];

/** Errors that mean the backend is unusable on this device/network. */
const SWITCH_CODES = new Set([
  "network",
  "service-not-allowed",
  "language-not-supported",
]);

export type FallbackOptions = {
  /** Called when the active engine changes, so the UI can reflect it. */
  onBackendChange?: (id: SpeechBackendId) => void;
};

export class FailoverSpeechBackend implements SpeechBackend {
  private readonly primary: SpeechBackend;
  private readonly secondary: SpeechBackend | null;
  private readonly options: FallbackOptions;

  private active: SpeechBackend;
  private callbacks: SpeechBackendCallbacks | null = null;
  private startOptions: SpeechStartOptions | null = null;
  private retryIndex = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private switched = false;
  private running = false;
  /** Suppresses the intermediate "inactive" event while switching engines. */
  private isSwitching = false;

  constructor(
    primary: SpeechBackend,
    secondary: SpeechBackend | null,
    options: FallbackOptions = {},
  ) {
    this.primary = primary;
    this.secondary = secondary;
    this.active = primary;
    this.options = options;
  }

  get id(): SpeechBackendId {
    return this.active.id;
  }

  get capabilities() {
    return this.active.capabilities;
  }

  /** The engine currently producing text. */
  get activeId(): SpeechBackendId {
    return this.active.id;
  }

  async isAvailable(): Promise<boolean> {
    if (await this.primary.isAvailable()) return true;
    return this.secondary ? this.secondary.isAvailable() : false;
  }

  async start(
    callbacks: SpeechBackendCallbacks,
    options: SpeechStartOptions,
  ): Promise<void> {
    this.callbacks = callbacks;
    this.startOptions = options;
    this.retryIndex = 0;
    this.switched = false;
    this.running = true;

    // Skip an engine that is not usable on this device.
    if (!(await this.primary.isAvailable())) {
      const secondary = this.secondary;
      if (secondary && (await secondary.isAvailable())) {
        this.active = secondary;
        this.switched = true;
        this.options.onBackendChange?.(secondary.id);
      }
    } else {
      this.active = this.primary;
      this.options.onBackendChange?.(this.primary.id);
    }

    await this.startActive();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.clearRetryTimer();
    this.unsubscribeCallbacks();
    await this.active.stop();
    this.callbacks = null;
    this.startOptions = null;
  }

  async dispose(): Promise<void> {
    await this.stop();
    await this.primary.dispose();
    if (this.secondary) {
      await this.secondary.dispose();
    }
  }

  private async startActive(): Promise<void> {
    const options = this.startOptions;
    if (!options || !this.running) return;

    await this.active.start(this.buildCallbacks(), options);
  }

  private buildCallbacks(): SpeechBackendCallbacks {
    return {
      onPartial: (text) => this.callbacks?.onPartial(text),
      onFinal: (text) => this.callbacks?.onFinal(text),
      onActiveChange: (active) => {
        if (this.isSwitching) return;
        this.callbacks?.onActiveChange(active);
      },
      onError: (error) => this.handleError(error),
    };
  }

  private handleError(error: SpeechRecognitionError) {
    const callbacks = this.callbacks;
    if (!callbacks || !this.running) return;

    if (error.code === "permission") {
      callbacks.onError(error);
      void this.stop();
      return;
    }

    // Usable-elsewhere failure: switch engines rather than retry.
    if (SWITCH_CODES.has(error.code) && this.canSwitch()) {
      console.warn(
        `[speech] ${this.active.id} failed (${error.code}${
          error.raw ? `: ${error.raw}` : ""
        }), switching engine`,
      );
      void this.switchEngine();
      return;
    }

    if (error.retryable && this.retryIndex < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[this.retryIndex];
      this.retryIndex += 1;
      callbacks.onActiveChange(false);
      this.clearRetryTimer();
      this.retryTimer = setTimeout(() => {
        void this.restartActive();
      }, delay);
      return;
    }

    // Retries exhausted — fall back to the other engine if we still can.
    if (this.canSwitch()) {
      console.warn(
        `[speech] ${this.active.id} failed (${error.code}${
          error.raw ? `: ${error.raw}` : ""
        }) and cannot be retried, switching engine`,
      );
      void this.switchEngine();
      return;
    }

    callbacks.onError(error);
    void this.stop();
  }

  private canSwitch(): boolean {
    return Boolean(this.secondary) && !this.switched;
  }

  private async switchEngine(): Promise<void> {
    const secondary = this.secondary;
    const callbacks = this.callbacks;
    if (!secondary || !callbacks) return;

    if (!(await secondary.isAvailable())) {
      callbacks.onError(createSpeechError("service-not-allowed"));
      await this.stop();
      return;
    }

    this.isSwitching = true;
    try {
      await this.active.stop();
      this.active = secondary;
      this.switched = true;
      this.retryIndex = 0;
      console.warn(`[speech] engine is now ${secondary.id}`);
      this.options.onBackendChange?.(secondary.id);
      await this.startActive();
    } finally {
      this.isSwitching = false;
    }
  }

  private async restartActive(): Promise<void> {
    if (!this.running) return;
    try {
      await this.active.stop();
    } catch {
      // Ignore; we are restarting anyway.
    }
    await this.startActive();
  }

  private clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private unsubscribeCallbacks() {
    this.clearRetryTimer();
  }
}
