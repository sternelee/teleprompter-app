/**
 * Offline speech model catalogue.
 *
 * Mirrors the approach used by Echo-Loop's `AsrModelManager`: every file is
 * pinned by size *and* hash so a truncated or corrupted download is detected
 * instead of silently producing a broken recognizer.
 *
 * The archives published on GitHub carry several weight variants (fp32, int8,
 * fp16) and are ~120 MB; only the int8 set is needed, so the files are fetched
 * individually from the Hugging Face mirror instead (~42 MB).
 */

export interface SpeechModelFile {
  /** File name inside the model directory. */
  name: string;
  /** Exact byte size, used as the cheap first check. */
  size: number;
  /** MD5, verified natively by expo-file-system. */
  md5: string;
  /** SHA-256, kept for auditing and CI verification. */
  sha256: string;
}

export interface SpeechModelDefinition {
  id: string;
  displayName: string;
  /** `sherpa-onnx` online model family. */
  modelType: "transducer";
  sampleRate: number;
  /** Tried in order; the first entry is the China-accessible mirror. */
  baseUrls: string[];
  /** Repository-relative directory the files live in. */
  remoteDir: string;
  files: SpeechModelFile[];
  /** Sum of `files[].size`, surfaced before the download starts. */
  totalBytes: number;
}

const REPO = "csukuangfj/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17";

/**
 * Streaming English zipformer (20M params, int8).
 *
 * Streaming-capable, so it can drive word-by-word highlighting in real time —
 * an offline Whisper model would only emit text per utterance and make the
 * highlight jump.
 */
export const STREAMING_EN_20M: SpeechModelDefinition = {
  id: "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17",
  displayName: "English streaming (zipformer 20M, int8)",
  modelType: "transducer",
  sampleRate: 16000,
  baseUrls: ["https://hf-mirror.com", "https://huggingface.co"],
  remoteDir: `${REPO}/resolve/main`,
  files: [
    {
      name: "encoder-epoch-99-avg-1.int8.onnx",
      size: 42845182,
      md5: "1bab9f89495c24cb8198e0de2ffb4c90",
      sha256:
        "3810755ce7c3ab26b42a8bcf39d191308fa27fb0f53358823ba46141d03b7eb3",
    },
    {
      name: "decoder-epoch-99-avg-1.int8.onnx",
      size: 539499,
      md5: "1a24a28b2ad0616acb7ac076f235811e",
      sha256:
        "21e2a2acd961b3ac72f55be2f10f1a285e1b0b0ba010d7c0b6eab141411b163c",
    },
    {
      name: "joiner-epoch-99-avg-1.int8.onnx",
      size: 259572,
      md5: "ef8180eb67373d1c08895fe73e1e7353",
      sha256:
        "e085d73b593cf9b0707f370dbd656d58327d3fe36d80d849202ef81df02cb01e",
    },
    {
      name: "tokens.txt",
      size: 5048,
      md5: "1f0910eef8d4c3cd919da96e75bf940c",
      sha256:
        "49e3c2646595fd907228b3c6787069658f67b17377c60aeb8619c4551b2316fb",
    },
  ],
  totalBytes: 42845182 + 539499 + 259572 + 5048,
};

export const SPEECH_MODELS: SpeechModelDefinition[] = [STREAMING_EN_20M];

/** Model used when the user has not picked one. */
export const DEFAULT_SPEECH_MODEL = STREAMING_EN_20M;

export function formatModelSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
