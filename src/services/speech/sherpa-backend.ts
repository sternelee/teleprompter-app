/**
 * On-device streaming recognition via sherpa-onnx.
 *
 * This is the backend that works without Google Play services or any network
 * access — required on mainland Android devices where the system recognizer
 * returns `ERROR_NETWORK`.
 *
 * Two decisions worth keeping:
 *
 * 1. `provider: 'cpu'` — Echo-Loop hit native aborts with NNAPI on some
 *    devices and standardised on CPU; this follows suit.
 * 2. Only the current utterance is emitted, and the stream is reset at every
 *    endpoint. `useWordMatcher` searches for the spoken words in a window
 *    around its current position, so it expects the recent words rather than
 *    the whole session transcript.
 */

import { Platform } from "react-native";
import type { PcmLiveStreamHandle } from "react-native-sherpa-onnx/audio";
import type {
  StreamingSttEngine,
  SttStream,
} from "react-native-sherpa-onnx/stt";

import { createSpeechError } from "./errors";
import { isModelReady, getModelPath } from "./model-manager";
import {
  DEFAULT_SPEECH_MODEL,
  type SpeechModelDefinition,
} from "./model-registry";
import type {
  SpeechBackend,
  SpeechBackendCallbacks,
  SpeechStartOptions,
} from "./types";

/** Enough threads for real-time decoding without competing with the UI. */
const NUM_THREADS = 2;

/**
 * sherpa-onnx registers its TurboModule with `getEnforcing`, which throws at
 * import time on platforms without a native build (web, and any native build
 * that forgot to autolink it). Loading lazily keeps the web bundle working.
 */
let audioModule: typeof import("react-native-sherpa-onnx/audio") | null = null;
let sttModule: typeof import("react-native-sherpa-onnx/stt") | null = null;

async function loadAudio() {
  if (!audioModule) {
    audioModule = await import("react-native-sherpa-onnx/audio");
  }
  return audioModule;
}

async function loadStt() {
  if (!sttModule) {
    sttModule = await import("react-native-sherpa-onnx/stt");
  }
  return sttModule;
}

export class OfflineSpeechBackend implements SpeechBackend {
  readonly id = "offline" as const;

  readonly capabilities = {
    partialResults: true,
    offline: true,
    requiresModel: true,
  } as const;

  private readonly model: SpeechModelDefinition;

  private engine: StreamingSttEngine | null = null;
  private stream: SttStream | null = null;
  private pcm: PcmLiveStreamHandle | null = null;
  private callbacks: SpeechBackendCallbacks | null = null;

  /**
   * Async work is serialised through this chain: sherpa requires chunks to be
   * decoded in order, and a late callback from a previous session must not
   * touch the new one.
   */
  private queue: Promise<void> = Promise.resolve();
  private generation = 0;
  private unsubscribeData: (() => void) | null = null;
  private unsubscribeError: (() => void) | null = null;

  constructor(model: SpeechModelDefinition = DEFAULT_SPEECH_MODEL) {
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    if (Platform.OS === "web") return false;
    return isModelReady(this.model);
  }

  async start(
    callbacks: SpeechBackendCallbacks,
    options: SpeechStartOptions,
  ): Promise<void> {
    // `options.language` is not forwarded: the downloaded model is English-only,
    // so the language is fixed by the model itself.
    void options;

    if (!isModelReady(this.model)) {
      callbacks.onError(createSpeechError("model-missing"));
      return;
    }

    this.callbacks = callbacks;
    this.generation += 1;
    const generation = this.generation;

    try {
      const { createStreamingSTT } = await loadStt();
      const { createPcmLiveStream } = await loadAudio();

      if (!this.engine) {
        this.engine = await createStreamingSTT({
          modelPath: { type: "file", path: getModelPath(this.model) },
          modelType: this.model.modelType,
          enableEndpoint: true,
          numThreads: NUM_THREADS,
          provider: "cpu",
          debug: false,
        });
      }

      if (this.generation !== generation) return;

      this.stream = await this.engine.createStream();

      if (this.generation !== generation) return;

      this.pcm = createPcmLiveStream({
        sampleRate: this.model.sampleRate,
        channelCount: 1,
      });

      this.unsubscribeError = this.pcm.onError((message) => {
        if (this.generation !== generation) return;
        callbacks.onError(createSpeechError(message));
      });

      this.unsubscribeData = this.pcm.onData((samples) => {
        // Chain instead of awaiting so the native callback returns immediately.
        this.queue = this.queue.then(() =>
          this.processChunk(samples, generation),
        );
      });

      await this.pcm.start();

      if (this.generation !== generation) return;
      callbacks.onActiveChange(true);
    } catch (error) {
      if (this.generation !== generation) return;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[speech] offline model failed to load from ${getModelPath(this.model)}: ${message}`,
      );
      callbacks.onError({
        code: "model-load-failed",
        raw: message,
        retryable: false,
      });
    }
  }

  async stop(): Promise<void> {
    this.generation += 1;
    this.unsubscribeData?.();
    this.unsubscribeError?.();
    this.unsubscribeData = null;
    this.unsubscribeError = null;

    try {
      await this.pcm?.stop();
    } catch {
      // Stopping an already-stopped capture is not an error worth surfacing.
    }
    this.pcm = null;

    // Wait for in-flight chunks, then release the stream. The engine is kept
    // alive so restarting does not reload ~42 MB of weights.
    try {
      await this.queue;
      await this.stream?.inputFinished();
      await this.stream?.release();
    } catch {
      // Ignore teardown failures.
    }

    this.stream = null;
    this.callbacks?.onActiveChange(false);
    this.callbacks = null;
  }

  async dispose(): Promise<void> {
    await this.stop();
    try {
      await this.engine?.destroy();
    } catch {
      // Ignore.
    }
    this.engine = null;
  }

  private async processChunk(
    samples: Float32Array,
    generation: number,
  ): Promise<void> {
    if (this.generation !== generation) return;

    const stream = this.stream;
    if (!stream) return;

    try {
      const { result, isEndpoint } = await stream.processAudioChunk(
        samples,
        this.model.sampleRate,
      );

      if (this.generation !== generation) return;

      const text = result.text.trim();
      if (text) {
        this.callbacks?.onPartial(text);
      }

      if (isEndpoint) {
        if (text) {
          this.callbacks?.onFinal(text);
        }
        await stream.reset();
      }
    } catch (error) {
      if (this.generation !== generation) return;
      this.callbacks?.onError({
        code: "unknown",
        raw: error instanceof Error ? error.message : String(error),
        retryable: true,
      });
    }
  }
}
