/**
 * Offline speech model manager card.
 *
 * Shows download state, drives the download with progress, and lets the user
 * remove the model to reclaim space.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  createShadows,
  Radius,
  Spacing,
  type ThemePalette,
} from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useI18n } from "@/i18n";
import {
  DEFAULT_SPEECH_MODEL,
  deleteModel,
  downloadModel,
  formatModelSize,
  isModelReady,
  type ModelProgress,
} from "@/services/speech";

type ModelCardState = { isInstalled: boolean; progress: ModelProgress };

/**
 * Reads the installed state synchronously on first render.
 *
 * expo-file-system's API is synchronous (JSI), so no effect is needed to
 * discover whether the model is already on disk.
 */
function readModelState(): ModelCardState {
  const ready = isModelReady(DEFAULT_SPEECH_MODEL);
  return {
    isInstalled: ready,
    progress: ready ? { status: "ready" } : { status: "absent" },
  };
}

export function OfflineModelCard() {
  const { t } = useI18n();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [state, setState] = useState<ModelCardState>(readModelState);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const { isInstalled, progress } = state;

  const startDownload = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;

    const onProgress = (next: ModelProgress) =>
      setState((prev) => ({ ...prev, progress: next }));

    try {
      await downloadModel(DEFAULT_SPEECH_MODEL, onProgress, controller.signal);
      setState({ isInstalled: true, progress: { status: "ready" } });
    } catch {
      // `downloadModel` already reported a specific failure via onProgress;
      // only re-check whether anything usable landed on disk.
      const ready = isModelReady(DEFAULT_SPEECH_MODEL);
      setState((prev) => ({ ...prev, isInstalled: ready }));
    } finally {
      abortRef.current = null;
    }
  }, []);

  const removeModel = useCallback(() => {
    abortRef.current?.abort();
    deleteModel(DEFAULT_SPEECH_MODEL);
    setState({ isInstalled: false, progress: { status: "absent" } });
  }, []);

  const isBusy =
    progress.status === "downloading" || progress.status === "verifying";

  /** Overall progress across all files, which is what the user cares about. */
  const percent = useMemo(() => {
    if (progress.status === "ready") return 100;
    if (progress.status !== "downloading") return 0;

    const files = DEFAULT_SPEECH_MODEL.files;
    const completed = files
      .slice(0, progress.fileIndex - 1)
      .reduce((sum, file) => sum + file.size, 0);

    return Math.min(
      100,
      Math.round(
        ((completed + progress.bytesWritten) / DEFAULT_SPEECH_MODEL.totalBytes) *
          100,
      ),
    );
  }, [progress]);

  const statusText = useMemo(() => {
    switch (progress.status) {
      case "ready":
        return t("offlineModel.statusReady");
      case "downloading":
        return t("offlineModel.statusDownloading", {
          file: t("offlineModel.fileProgress", {
            index: progress.fileIndex,
            count: progress.fileCount,
          }),
        });
      case "verifying":
        return t("offlineModel.statusVerifying", {
          file: t("offlineModel.fileProgress", {
            index: progress.fileIndex,
            count: progress.fileCount,
          }),
        });
      case "error":
        return `${t("offlineModel.statusError")} — ${progress.message}`;
      default:
        return t("offlineModel.statusAbsent");
    }
  }, [progress, t]);

  const statusTone =
    progress.status === "ready"
      ? styles.statusReady
      : progress.status === "error"
        ? styles.statusError
        : styles.statusIdle;

  return (
    <ThemedView type="backgroundContent" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.title}>
          {t("offlineModel.title")}
        </ThemedText>
        <ThemedView style={[styles.statusPill, statusTone]}>
          <ThemedText type="small" style={styles.statusText}>
            {statusText}
          </ThemedText>
        </ThemedView>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {t("offlineModel.note")}
      </ThemedText>

      {isBusy ? (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          <ThemedText type="small" style={styles.progressLabel}>
            {t("offlineModel.percent", { percent })}
          </ThemedText>
        </>
      ) : null}

      <View style={styles.actions}>
        {isInstalled && !isBusy ? (
          <Pressable onPress={removeModel} style={styles.action}>
            <ThemedView style={styles.secondaryButton}>
              <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                {t("offlineModel.remove")}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}

        {!isInstalled && !isBusy ? (
          <Pressable onPress={() => void startDownload()} style={styles.action}>
            <ThemedView style={styles.primaryButton}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                {progress.status === "error"
                  ? t("offlineModel.retry")
                  : t("offlineModel.download", {
                      size: formatModelSize(DEFAULT_SPEECH_MODEL.totalBytes),
                    })}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}

        {isBusy ? (
          <Pressable
            onPress={() => abortRef.current?.abort()}
            style={styles.action}
          >
            <ThemedView style={styles.secondaryButton}>
              <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                {t("offlineModel.cancel")}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}

function createStyles(theme: ThemePalette) {
  const shadows = createShadows(theme);

  return StyleSheet.create({
    action: {
      flexGrow: 1,
    },
    actions: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    card: {
      borderRadius: Radius.lg,
      borderWidth: 2,
      borderColor: theme.border,
      gap: Spacing.sm,
      padding: Spacing.lg,
      ...shadows.input,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: Spacing.sm,
      justifyContent: "space-between",
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: Radius.pill,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    primaryButtonText: {
      color: "#ffffff",
    },
    progressFill: {
      backgroundColor: theme.primary,
      borderRadius: Radius.pill,
      height: "100%",
    },
    progressLabel: {
      color: theme.textMuted,
      textAlign: "right",
    },
    progressTrack: {
      backgroundColor: theme.backgroundElement,
      borderRadius: Radius.pill,
      height: 8,
      overflow: "hidden",
      marginTop: Spacing.sm,
    },
    secondaryButton: {
      alignItems: "center",
      borderRadius: Radius.pill,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    secondaryButtonText: {
      color: theme.text,
    },
    statusError: {
      backgroundColor: theme.errorSurface,
    },
    statusIdle: {
      backgroundColor: theme.neutral,
    },
    statusPill: {
      borderRadius: Radius.pill,
      flexShrink: 1,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
    },
    statusReady: {
      backgroundColor: theme.successWash,
    },
    statusText: {
      color: theme.text,
    },
    title: {
      color: theme.text,
      flexShrink: 0,
    },
  });
}
