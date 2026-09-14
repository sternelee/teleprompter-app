/**
 * Offline model download, verification and lifecycle.
 *
 * Ported from the design of Echo-Loop's `AsrModelManager`, but implemented on
 * top of expo-file-system so no extra native dependency is required.
 */

import { Directory, File, Paths } from "expo-file-system";

import {
  DEFAULT_SPEECH_MODEL,
  type SpeechModelDefinition,
  type SpeechModelFile,
} from "./model-registry";

const MODELS_ROOT = "offline-asr";

export type ModelProgress =
  | { status: "absent" }
  | {
      status: "downloading";
      bytesWritten: number;
      totalBytes: number;
      /** 1-based, for "file 2 of 4" style copy. */
      fileIndex: number;
      fileCount: number;
      fileName: string;
    }
  | { status: "verifying"; fileIndex: number; fileCount: number }
  | { status: "ready" }
  | { status: "error"; message: string };

export function getModelDirectory(
  model: SpeechModelDefinition = DEFAULT_SPEECH_MODEL,
): Directory {
  return new Directory(Paths.document, MODELS_ROOT, model.id);
}

/** Directory URI handed to sherpa-onnx as `{ type: 'file', path }`. */
const FILE_SCHEME = /^file:\/\//;

/**
 * Filesystem path for sherpa-onnx.
 *
 * expo-file-system exposes `file:///...` URIs, but sherpa-onnx resolves `file`
 * model paths with `java.io.File`, which treats the scheme as part of the path
 * and then reports "path does not exist". Strip the scheme and decode any
 * percent-escapes so the native side sees a plain absolute path.
 */
export function getModelPath(
  model: SpeechModelDefinition = DEFAULT_SPEECH_MODEL,
): string {
  const uri = getModelDirectory(model).uri;
  const withoutScheme = uri.replace(FILE_SCHEME, "");

  try {
    return decodeURIComponent(withoutScheme);
  } catch {
    return withoutScheme;
  }
}

function getModelFile(
  model: SpeechModelDefinition,
  name: string,
): File {
  return new File(getModelDirectory(model), name);
}

/**
 * Cheap readiness check: every file present with exactly the expected size.
 *
 * Size alone is enough to detect a truncated download, which is the failure
 * mode that actually happens. Full hash verification runs once after a
 * download and on demand from the settings screen.
 */
export function isModelReady(
  model: SpeechModelDefinition = DEFAULT_SPEECH_MODEL,
): boolean {
  try {
    if (!getModelDirectory(model).exists) return false;

    return model.files.every((spec) => {
      const file = getModelFile(model, spec.name);
      return file.exists && file.size === spec.size;
    });
  } catch {
    return false;
  }
}

/** Full MD5 verification of an installed model. */
export function verifyModel(
  model: SpeechModelDefinition = DEFAULT_SPEECH_MODEL,
): boolean {
  try {
    if (!getModelDirectory(model).exists) return false;

    return model.files.every((spec) => {
      const file = getModelFile(model, spec.name);
      if (!file.exists || file.size !== spec.size) return false;
      return (file.md5 ?? "").toLowerCase() === spec.md5;
    });
  } catch {
    return false;
  }
}

export function deleteModel(
  model: SpeechModelDefinition = DEFAULT_SPEECH_MODEL,
): void {
  const dir = getModelDirectory(model);
  if (dir.exists) {
    dir.delete();
  }
}

function buildUrl(model: SpeechModelDefinition, base: string, name: string) {
  return `${base}/${model.remoteDir}/${name}`;
}

async function downloadFile(
  model: SpeechModelDefinition,
  spec: SpeechModelFile,
  onProgress: (written: number) => void,
  signal: AbortSignal,
): Promise<void> {
  const destination = getModelFile(model, spec.name);
  if (destination.exists) {
    destination.delete();
  }

  let lastError: unknown;

  for (const base of model.baseUrls) {
    if (signal.aborted) throw new Error("aborted");

    const url = buildUrl(model, base, spec.name);
    const task = File.createDownloadTask(url, destination);

    const subscription = task.addListener("progress", (progress) => {
      // `totalBytes` is -1 when the server omits Content-Length; fall back to
      // the pinned size so progress still advances sensibly.
      onProgress(progress.bytesWritten);
    });

    try {
      const result = await task.downloadAsync();
      subscription.remove();
      task.release();

      if (!result) {
        throw new Error(`empty response for ${spec.name}`);
      }

      return;
    } catch (error) {
      subscription.remove();
      task.release();
      lastError = error;
      // Try the next mirror.
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`could not download ${spec.name}`);
}

/**
 * Downloads every file of the model, verifying size and MD5 as it goes.
 *
 * Files that are already present and valid are skipped, so an interrupted
 * download resumes from where it stopped.
 */
export async function downloadModel(
  model: SpeechModelDefinition = DEFAULT_SPEECH_MODEL,
  onProgress: (progress: ModelProgress) => void = () => {},
  signal: AbortSignal = new AbortController().signal,
): Promise<void> {
  const directory = getModelDirectory(model);
  if (!directory.exists) {
    directory.create({ intermediates: true });
  }

  const fileCount = model.files.length;

  try {
    for (let index = 0; index < fileCount; index += 1) {
      const spec = model.files[index];
      const file = getModelFile(model, spec.name);

      if (signal.aborted) throw new Error("aborted");

      // Skip files that are already complete and valid.
      if (
        file.exists &&
        file.size === spec.size &&
        (file.md5 ?? "").toLowerCase() === spec.md5
      ) {
        continue;
      }

      onProgress({
        status: "downloading",
        bytesWritten: 0,
        totalBytes: spec.size,
        fileIndex: index + 1,
        fileCount,
        fileName: spec.name,
      });

      await downloadFile(
        model,
        spec,
        (written) =>
          onProgress({
            status: "downloading",
            bytesWritten: written,
            totalBytes: spec.size,
            fileIndex: index + 1,
            fileCount,
            fileName: spec.name,
          }),
        signal,
      );

      onProgress({ status: "verifying", fileIndex: index + 1, fileCount });

      const sizeOk = file.size === spec.size;
      const md5Ok = (file.md5 ?? "").toLowerCase() === spec.md5;

      if (!sizeOk || !md5Ok) {
        file.delete();
        throw new Error(
          `${spec.name} failed verification (size ${file.size}/${spec.size})`,
        );
      }
    }

    onProgress({ status: "ready" });
  } catch (error) {
    onProgress({
      status: "error",
      message: error instanceof Error ? error.message : "download failed",
    });
    throw error;
  }
}
