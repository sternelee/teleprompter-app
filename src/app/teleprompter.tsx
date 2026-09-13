import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PracticeReport } from "@/components/practice-report";
import { TeleprompterDisplay } from "@/components/teleprompter-display";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  createShadows,
  MaxContentWidth,
  Radius,
  Spacing,
  type ThemePalette,
} from "@/constants/theme";
import { useApp } from "@/contexts/app-context";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useTheme } from "@/hooks/use-theme";
import { useWordSpeech } from "@/hooks/use-word-speech";
import { normalizeWord, useWordMatcher } from "@/hooks/use-word-matcher";
import { useI18n } from "@/i18n";
import { generateDialogue } from "@/services/openai";
import type { Word } from "@/types/dialogue";
import type { PracticeMode } from "@/types/session";

const CUE_PREVIEW_WORDS = 8;
const DICTIONARY_NAME = "Cambridge Dictionary";
/** Fetch the next batch once the learner is this close to the end. */
const AUTO_CONTINUE_REMAINING = 8;

function getCuePreview(
  words: Word[],
  fallback: string,
  startIndex = 0,
): string {
  const preview = words
    .slice(startIndex, startIndex + CUE_PREVIEW_WORDS)
    .map((word) => word.text.trim())
    .join(" ")
    .trim();

  if (!preview) {
    return fallback;
  }

  return preview.length > 88 ? `${preview.slice(0, 85).trimEnd()}…` : preview;
}

function getDictionaryUrl(word: string) {
  return `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`;
}

export default function TeleprompterScreen() {
  const router = useRouter();
  const {
    apiKey,
    scene,
    segments,
    isGenerating,
    generationError,
    currentSessionId,
    sessions,
    saveCurrentSession,
    appendSegments,
  } = useApp();
  const { t } = useI18n();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Reading `theme.current` inside a memo makes the React Compiler treat it as a
  // ref access, so hoist the "current word" accent out of the memo.
  const currentAccent = theme.current;

  const [isReading, setIsReading] = useState(false);
  const [btnPressed, setBtnPressed] = useState(false);
  const [blinkVisible, setBlinkVisible] = useState(true);
  const [resetPressed, setResetPressed] = useState(false);
  const [dictionaryFeedback, setDictionaryFeedback] = useState<string | null>(
    null,
  );
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [autoContinueError, setAutoContinueError] = useState<string | null>(
    null,
  );
  const [isCoachPanelExpanded, setIsCoachPanelExpanded] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(
    () =>
      sessions.find((session) => session.id === currentSessionId)
        ?.practiceMode ?? "full",
  );

  const scrollViewRef = useRef<ScrollView>(null);
  const fetchingRef = useRef(false);
  const lastAutoContinueSegmentIdRef = useRef<string | null>(null);
  const segmentOffsetsRef = useRef<Record<number, number>>({});
  const spokenPartnerSegmentsRef = useRef<Set<string>>(new Set());
  const reportShownRef = useRef(false);
  const modeResetRef = useRef<PracticeMode | null>(null);

  const allWords = useMemo(() => {
    let wordIndex = 0;

    return segments.flatMap((segment, segmentIndex) =>
      segment.text
        .split(/\s+/)
        .filter(Boolean)
        .map((text, localIndex) => {
          const index = wordIndex++;

          return {
            text,
            globalIndex: index,
            segmentIndex,
            localIndex,
            isSpoken: false,
          };
        }),
    );
  }, [segments]);

  const wordsBySegment = useMemo(() => {
    const grouped = segments.map(() => [] as Word[]);

    allWords.forEach((word) => {
      grouped[word.segmentIndex]?.push(word);
    });

    return grouped;
  }, [allWords, segments]);

  // In role mode the learner only speaks their own lines; partner lines are
  // read aloud by TTS and skipped by the matcher.
  const practiceWords = useMemo(
    () =>
      practiceMode === "role"
        ? allWords.filter(
            (word) => segments[word.segmentIndex]?.speaker === "user",
          )
        : allWords,
    [allWords, practiceMode, segments],
  );

  const initialMatcherState = useMemo(() => {
    if (!currentSessionId) {
      return { currentWordIndex: -1, corrections: [] };
    }

    const session = sessions.find((s) => s.id === currentSessionId);
    return {
      currentWordIndex: session?.currentWordIndex ?? -1,
      corrections: session?.corrections ?? [],
    };
  }, [currentSessionId, sessions]);

  const {
    currentWordIndex,
    corrections,
    jumpToWord,
    updateProgress,
    resetProgress,
  } = useWordMatcher(practiceWords, {
    initialCurrentWordIndex: initialMatcherState.currentWordIndex,
    initialCorrections: initialMatcherState.corrections,
  });

  // Persist progress back to AsyncStorage whenever it changes.
  useEffect(() => {
    if (!currentSessionId) return;

    saveCurrentSession({ currentWordIndex, corrections, practiceMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWordIndex, corrections.length, currentSessionId, practiceMode]);

  // Switching between full-script and role mode changes which words make up the
  // practice order, so the matcher has to restart from the top.
  useEffect(() => {
    if (modeResetRef.current === null) {
      modeResetRef.current = practiceMode;
      return;
    }

    if (modeResetRef.current === practiceMode) return;

    modeResetRef.current = practiceMode;
    resetProgress();
  }, [practiceMode, resetProgress]);

  const handleSpeechResult = useCallback(
    (text: string) => {
      updateProgress(text);
    },
    [updateProgress],
  );

  const handleSpeechError = useCallback((message: string) => {
    setSpeechError(message);
    setIsReading(false);
  }, []);

  const { speak, speakingWord, stopSpeaking } = useWordSpeech();

  const speechMessages = useMemo(
    () => ({
      permissionRequired: t("speech.permissionRequired"),
      failed: t("speech.failed"),
    }),
    [t],
  );

  const {
    isListening,
    permissionResponse,
    requestPermission,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    messages: speechMessages,
    onResult: handleSpeechResult,
    onError: handleSpeechError,
  });

  const currentPracticePosition = useMemo(
    () =>
      currentWordIndex >= 0
        ? practiceWords.findIndex(
            (word) => word.globalIndex === currentWordIndex,
          )
        : -1,
    [currentWordIndex, practiceWords],
  );
  const totalWords = practiceWords.length;
  const spokenCount =
    currentPracticePosition >= 0
      ? Math.min(totalWords, currentPracticePosition + 1)
      : 0;
  const remainingWords = Math.max(totalWords - spokenCount, 0);
  const progressPercent = totalWords > 0 ? (spokenCount / totalWords) * 100 : 0;
  const needsPermission = permissionResponse?.granted === false;
  const hasSessionProgress = spokenCount > 0 || corrections.length > 0;
  const targetPracticeWord =
    totalWords > 0 && spokenCount < totalWords
      ? practiceWords[spokenCount]
      : undefined;
  const activeWord =
    targetPracticeWord ??
    (currentPracticePosition >= 0
      ? practiceWords[currentPracticePosition]
      : practiceWords[0]);
  const activeSegmentIndex = activeWord?.segmentIndex ?? -1;
  const finalSegment =
    segments.length > 0 ? segments[segments.length - 1] : undefined;
  const isOnFinalSegment =
    activeSegmentIndex >= 0 && activeSegmentIndex === segments.length - 1;
  const nextPracticeWord =
    activeSegmentIndex >= 0
      ? practiceWords.find(
          (word) =>
            word.segmentIndex > activeSegmentIndex &&
            word.globalIndex > (activeWord?.globalIndex ?? -1),
        )
      : undefined;
  const displayCurrentWordIndex = targetPracticeWord?.globalIndex ?? -1;
  const isComplete = totalWords > 0 && remainingWords === 0;
  const completedOnMountRef = useRef(isComplete);

  const speakerLabel = useCallback(
    (speaker?: "ai" | "user") =>
      speaker === "user"
        ? t("teleprompter.speakerYou")
        : t("teleprompter.speakerPartner"),
    [t],
  );

  const currentCue = useMemo(() => {
    if (totalWords === 0) {
      return {
        label: t("teleprompter.speakerPartner"),
        text: t("teleprompter.cueNoWords"),
      };
    }

    if (!targetPracticeWord) {
      return {
        label: t("teleprompter.speakerPartner"),
        text: t("teleprompter.cueAllPracticed"),
      };
    }

    const segmentWords = wordsBySegment[targetPracticeWord.segmentIndex] ?? [];
    const segment = segments[targetPracticeWord.segmentIndex];

    return {
      label: speakerLabel(segment?.speaker),
      text: getCuePreview(
        segmentWords,
        t("teleprompter.cueEmpty"),
        targetPracticeWord.localIndex,
      ),
    };
  }, [segments, speakerLabel, t, targetPracticeWord, totalWords, wordsBySegment]);

  const nextCue = useMemo(() => {
    if (nextPracticeWord) {
      const nextWords = wordsBySegment[nextPracticeWord.segmentIndex] ?? [];
      const nextSegment = segments[nextPracticeWord.segmentIndex];

      return {
        label: speakerLabel(nextSegment?.speaker),
        text: getCuePreview(
          nextWords,
          t("teleprompter.cueEmpty"),
          nextPracticeWord.localIndex,
        ),
      };
    }

    if (isGenerating || isContinuing) {
      return {
        label: t("teleprompter.speakerPartner"),
        text: t("teleprompter.cueWriting"),
      };
    }

    return {
      label: t("teleprompter.speakerPartner"),
      text:
        remainingWords === 0
          ? t("teleprompter.cueComplete")
          : t("teleprompter.cueFinalLine"),
    };
  }, [
    isContinuing,
    isGenerating,
    nextPracticeWord,
    remainingWords,
    segments,
    speakerLabel,
    t,
    wordsBySegment,
  ]);

  const statusMeta = useMemo(() => {
    if (totalWords === 0) {
      return {
        label: t("teleprompter.statusNoDialogue"),
        detail: t("teleprompter.statusNoDialogueDetail"),
        color: theme.error,
        backgroundColor: theme.backgroundElement,
      };
    }

    if (needsPermission) {
      return {
        label: t("teleprompter.statusPermission"),
        detail: t("teleprompter.statusPermissionDetail"),
        color: theme.error,
        backgroundColor: theme.backgroundElement,
      };
    }

    if (isGenerating || isContinuing) {
      return {
        label: t("teleprompter.statusGenerating"),
        detail: t("teleprompter.statusGeneratingDetail"),
        color: theme.primary,
        backgroundColor: theme.primaryBg,
      };
    }

    if (isReading) {
      return {
        label: t("teleprompter.statusListening"),
        detail: isListening
          ? t("teleprompter.statusListeningDetail")
          : t("teleprompter.statusWarming"),
        color: theme.spoken,
        backgroundColor: theme.backgroundSelected,
      };
    }

    if (hasSessionProgress) {
      return {
        label: t("teleprompter.statusPaused"),
        detail: t("teleprompter.statusPausedDetail"),
        color: currentAccent,
        backgroundColor: theme.backgroundContent,
      };
    }

    return {
      label: t("teleprompter.statusReady"),
      detail: t("teleprompter.statusReadyDetail"),
      color: theme.text,
      backgroundColor: theme.backgroundElement,
    };
  }, [
    currentAccent,
    hasSessionProgress,
    isContinuing,
    isGenerating,
    isListening,
    isReading,
    needsPermission,
    t,
    theme,
    totalWords,
  ]);

  const interactionHint = dictionaryFeedback
    ? dictionaryFeedback
    : t("teleprompter.wordActionsHint", { dictionary: DICTIONARY_NAME });
  const statusDetailText =
    speechError ?? dictionaryFeedback ?? statusMeta.detail;
  const progressSummary =
    totalWords > 0
      ? t("teleprompter.progress", { done: spokenCount, total: totalWords })
      : t("teleprompter.noLines");

  useEffect(() => {
    if (!isReading) {
      return;
    }

    const interval = setInterval(() => {
      setBlinkVisible((prev) => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, [isReading]);

  useEffect(() => {
    if (
      activeSegmentIndex < 0 ||
      !scrollViewRef.current ||
      totalWords === 0 ||
      viewportHeight <= 0
    ) {
      return;
    }

    const scrollableHeight = Math.max(contentHeight - viewportHeight, 0);
    const progressPosition = targetPracticeWord
      ? spokenCount
      : Math.max(currentPracticePosition, 0);
    const progressRatio =
      totalWords > 1 ? progressPosition / (totalWords - 1) : 0;
    let targetY = scrollableHeight * progressRatio;

    if (activeSegmentIndex >= 0) {
      const segmentOffset = segmentOffsetsRef.current[activeSegmentIndex];

      if (segmentOffset !== undefined) {
        targetY = segmentOffset;

        if (activeWord) {
          const segmentWords = wordsBySegment[activeSegmentIndex] ?? [];
          const nextSegmentOffset =
            segmentOffsetsRef.current[activeSegmentIndex + 1];
          const localProgress =
            segmentWords.length > 1
              ? activeWord.localIndex / (segmentWords.length - 1)
              : 0;

          if (
            nextSegmentOffset !== undefined &&
            nextSegmentOffset > segmentOffset
          ) {
            targetY =
              segmentOffset +
              (nextSegmentOffset - segmentOffset) * localProgress;
          }
        }
      }
    }

    targetY = Math.max(
      0,
      Math.min(scrollableHeight, targetY - viewportHeight * 0.18),
    );

    scrollViewRef.current.scrollTo({ y: targetY, animated: true });
  }, [
    activeSegmentIndex,
    activeWord,
    contentHeight,
    currentPracticePosition,
    spokenCount,
    targetPracticeWord,
    totalWords,
    viewportHeight,
    wordsBySegment,
  ]);

  useEffect(() => {
    if (
      !scene ||
      !apiKey ||
      !finalSegment ||
      !isOnFinalSegment ||
      remainingWords > AUTO_CONTINUE_REMAINING ||
      spokenCount === 0 ||
      isGenerating ||
      isContinuing ||
      fetchingRef.current ||
      lastAutoContinueSegmentIdRef.current === finalSegment.id
    ) {
      return;
    }

    fetchingRef.current = true;
    lastAutoContinueSegmentIdRef.current = finalSegment.id;
    setAutoContinueError(null);
    setIsContinuing(true);
    void generateDialogue(scene, apiKey, segments)
      .then((newSegments) => {
        if (newSegments.length > 0) {
          appendSegments(newSegments);
        }
      })
      .catch((error: unknown) => {
        console.warn("Failed to auto-continue dialogue:", error);
        setAutoContinueError(
          error instanceof Error
            ? error.message
            : t("home.errorGenerateFailed"),
        );
      })
      .finally(() => {
        fetchingRef.current = false;
        setIsContinuing(false);
      });
  }, [
    appendSegments,
    apiKey,
    finalSegment,
    isContinuing,
    isGenerating,
    isOnFinalSegment,
    remainingWords,
    scene,
    segments,
    spokenCount,
    t,
  ]);

  // Role mode: read every partner line the learner has reached out loud.
  useEffect(() => {
    if (practiceMode !== "role" || totalWords === 0) {
      return;
    }

    if (!targetPracticeWord) {
      return;
    }

    const pending = segments.filter(
      (segment, index) =>
        segment.speaker === "ai" &&
        index <= targetPracticeWord.segmentIndex &&
        !spokenPartnerSegmentsRef.current.has(segment.id),
    );

    if (pending.length === 0) {
      return;
    }

    pending.forEach((segment) =>
      spokenPartnerSegmentsRef.current.add(segment.id),
    );
    speak(pending.map((segment) => segment.text).join(" "));
  }, [practiceMode, segments, speak, targetPracticeWord, totalWords]);

  // Show the end-of-session report exactly once per completion.
  useEffect(() => {
    if (!isComplete) {
      reportShownRef.current = false;
      return;
    }

    // Re-opening an already finished session should not pop the report.
    if (completedOnMountRef.current) {
      reportShownRef.current = true;
      return;
    }

    if (reportShownRef.current) {
      return;
    }

    reportShownRef.current = true;
    setIsReading(false);
    stopSpeaking();
    void stopListening();
    setReportVisible(true);
  }, [isComplete, stopListening, stopSpeaking]);

  useEffect(() => {
    return () => {
      void stopListening();
    };
  }, [stopListening]);

  const handleToggleReading = useCallback(async () => {
    if (isReading) {
      setIsReading(false);
      setIsCoachPanelExpanded(false);
      setBlinkVisible(true);
      setSpeechError(null);
      await stopListening();
      return;
    }

    stopSpeaking();
    setSpeechError(null);
    setAutoContinueError(null);

    if (totalWords === 0) {
      setSpeechError(t("teleprompter.errorNoDialogue"));
      return;
    }

    if (!permissionResponse?.granted) {
      const permission = await requestPermission();

      if (!permission.granted) {
        setIsReading(false);
        setSpeechError(t("teleprompter.errorPermission"));
        return;
      }
    }

    setBlinkVisible(true);
    setIsCoachPanelExpanded(false);
    setIsReading(true);
    await startListening();
  }, [
    isReading,
    permissionResponse?.granted,
    requestPermission,
    startListening,
    stopListening,
    stopSpeaking,
    t,
    totalWords,
  ]);

  const handleRestart = useCallback(() => {
    setIsReading(false);
    setIsCoachPanelExpanded(false);
    setBlinkVisible(true);
    setDictionaryFeedback(null);
    setSpeechError(null);
    setAutoContinueError(null);
    setReportVisible(false);
    reportShownRef.current = false;
    void stopListening();
    stopSpeaking();
    lastAutoContinueSegmentIdRef.current = null;
    spokenPartnerSegmentsRef.current.clear();
    resetProgress();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [resetProgress, stopListening, stopSpeaking]);

  const handleBack = useCallback(() => {
    setIsReading(false);
    setIsCoachPanelExpanded(false);
    setBlinkVisible(true);
    void stopListening();
    stopSpeaking();
    router.back();
  }, [router, stopListening, stopSpeaking]);

  const handleModeChange = useCallback(
    async (next: PracticeMode) => {
      if (next === practiceMode) return;

      if (isReading) {
        setIsReading(false);
        setBlinkVisible(true);
        await stopListening();
      }

      stopSpeaking();
      spokenPartnerSegmentsRef.current.clear();
      setReportVisible(false);
      setPracticeMode(next);
    },
    [isReading, practiceMode, stopListening, stopSpeaking],
  );

  const handleSegmentLayout = useCallback((segmentIndex: number, y: number) => {
    segmentOffsetsRef.current[segmentIndex] = y;
  }, []);

  const handleWordSpeech = useCallback(
    (word: Word) => {
      speak(word.text, { highlightAs: word.text });
    },
    [speak],
  );

  const handleWordPress = useCallback(
    async (word: Word) => {
      const shouldResume = isReading;

      setSpeechError(null);
      setDictionaryFeedback(null);

      if (shouldResume) {
        await stopListening();
      }

      jumpToWord(word.globalIndex);
      setBlinkVisible(true);

      if (shouldResume) {
        await startListening();
      }
    },
    [isReading, jumpToWord, startListening, stopListening],
  );

  const handleWordLongPress = useCallback(
    async (word: Word) => {
      const lookupWord = normalizeWord(word.text);

      if (!lookupWord) {
        setDictionaryFeedback(t("teleprompter.lookupInvalid"));
        return;
      }

      if (isReading) {
        setIsReading(false);
        setBlinkVisible(true);
        await stopListening();
      }

      setSpeechError(null);
      setDictionaryFeedback(
        t("teleprompter.lookupOpening", {
          dictionary: DICTIONARY_NAME,
          word: lookupWord,
        }),
      );

      try {
        await WebBrowser.openBrowserAsync(getDictionaryUrl(lookupWord));
        setDictionaryFeedback(
          t("teleprompter.lookupOpened", {
            dictionary: DICTIONARY_NAME,
            word: lookupWord,
          }),
        );
      } catch (error) {
        setDictionaryFeedback(
          error instanceof Error
            ? error.message
            : t("teleprompter.lookupFailed", {
                dictionary: DICTIONARY_NAME,
                word: lookupWord,
              }),
        );
      }
    },
    [isReading, stopListening, t],
  );

  const primaryActionLabel = isReading
    ? t("teleprompter.actionPause")
    : needsPermission
      ? t("teleprompter.actionEnableMic")
      : hasSessionProgress
        ? t("teleprompter.actionResume")
        : t("teleprompter.actionStart");

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={8}>
            <ThemedText style={styles.backButton}>{t("common.back")}</ThemedText>
          </Pressable>
          <View style={styles.titleWrapper}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {t("teleprompter.title")}
            </ThemedText>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>

          <View style={styles.modeRow}>
            <ThemedText type="small" style={styles.modeLabel}>
              {t("teleprompter.modeLabel")}
            </ThemedText>
            <View style={styles.modeSwitch}>
              {(["full", "role"] as const).map((mode) => {
                const isActive = practiceMode === mode;

                return (
                  <Pressable
                    key={mode}
                    onPress={() => void handleModeChange(mode)}
                    style={styles.modePressable}
                  >
                    <ThemedView
                      style={[
                        styles.modeOption,
                        isActive && styles.modeOptionActive,
                      ]}
                    >
                      <ThemedText
                        type="smallBold"
                        style={[
                          styles.modeOptionText,
                          isActive && styles.modeOptionTextActive,
                        ]}
                      >
                        {mode === "full"
                          ? t("teleprompter.modeFull")
                          : t("teleprompter.modeRole")}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ThemedView type="backgroundContent" style={styles.coachPanel}>
            <Pressable
              hitSlop={6}
              onPress={() => setIsCoachPanelExpanded((value) => !value)}
              style={styles.coachSummary}
            >
              <View style={styles.coachSummaryMain}>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: statusMeta.backgroundColor },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: statusMeta.color,
                        opacity: isReading ? (blinkVisible ? 1 : 0.45) : 1,
                      },
                    ]}
                  />
                  <ThemedText type="smallBold" style={styles.statusText}>
                    {statusMeta.label}
                  </ThemedText>
                </View>
                <ThemedText
                  type="small"
                  style={styles.statusDetail}
                  numberOfLines={1}
                >
                  {statusDetailText}
                </ThemedText>
              </View>

              <View style={styles.coachSummaryMeta}>
                <ThemedText style={styles.progressSummary}>
                  {progressSummary}
                </ThemedText>
                <ThemedText style={styles.expandLabel}>
                  {isCoachPanelExpanded
                    ? t("teleprompter.hide")
                    : t("teleprompter.details")}
                </ThemedText>
              </View>
            </Pressable>

            {isCoachPanelExpanded ? (
              <>
                <View style={styles.sceneSummary}>
                  <ThemedText type="smallBold" style={styles.sceneLabel}>
                    {t("teleprompter.scene")}
                  </ThemedText>
                  <ThemedText style={styles.sceneText}>{scene}</ThemedText>
                </View>

                <View style={styles.metricRow}>
                  <ThemedView type="backgroundElement" style={styles.metricCard}>
                    <ThemedText type="small" style={styles.metricLabel}>
                      {t("teleprompter.metricPracticed")}
                    </ThemedText>
                    <ThemedText type="title" style={styles.metricValue}>
                      {spokenCount}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView type="backgroundElement" style={styles.metricCard}>
                    <ThemedText type="small" style={styles.metricLabel}>
                      {t("teleprompter.metricLeft")}
                    </ThemedText>
                    <ThemedText type="title" style={styles.metricValue}>
                      {remainingWords}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView type="backgroundElement" style={styles.metricCard}>
                    <ThemedText type="small" style={styles.metricLabel}>
                      {t("teleprompter.metricRevisit")}
                    </ThemedText>
                    <ThemedText type="title" style={styles.metricValue}>
                      {corrections.length}
                    </ThemedText>
                  </ThemedView>
                </View>

                <View style={styles.cueStack}>
                  <ThemedView type="backgroundElement" style={styles.cueCard}>
                    <ThemedText type="small" style={styles.cueLabel}>
                      {t("teleprompter.currentFocus", {
                        label: currentCue.label,
                      })}
                    </ThemedText>
                    <ThemedText style={styles.cueText}>
                      {currentCue.text}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView type="backgroundElement" style={styles.cueCard}>
                    <ThemedText type="small" style={styles.cueLabel}>
                      {t("teleprompter.comingUp", { label: nextCue.label })}
                    </ThemedText>
                    <ThemedText style={styles.cueText}>
                      {nextCue.text}
                    </ThemedText>
                  </ThemedView>
                </View>

                {practiceMode === "role" ? (
                  <ThemedView
                    type="backgroundElement"
                    style={styles.interactionHintCard}
                  >
                    <ThemedText type="small" style={styles.interactionHintText}>
                      {t("teleprompter.modePartnerHint")}
                    </ThemedText>
                  </ThemedView>
                ) : null}

                <ThemedView
                  type="backgroundElement"
                  style={styles.interactionHintCard}
                >
                  <ThemedText
                    type="smallBold"
                    style={styles.interactionHintTitle}
                  >
                    {t("teleprompter.wordActionsTitle")}
                  </ThemedText>
                  <ThemedText type="small" style={styles.interactionHintText}>
                    {interactionHint}
                  </ThemedText>
                </ThemedView>

                {totalWords > 0 ? (
                  <Pressable onPress={() => setReportVisible(true)}>
                    <ThemedView
                      type="backgroundElement"
                      style={styles.reportButton}
                    >
                      <ThemedText type="smallBold" style={styles.reportButtonText}>
                        {t("teleprompter.reportButton")}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </ThemedView>

          <ScrollView
            ref={scrollViewRef}
            style={styles.teleprompterContainer}
            contentContainerStyle={styles.teleprompterContent}
            onContentSizeChange={(_, height) => setContentHeight(height)}
            onLayout={(event) =>
              setViewportHeight(event.nativeEvent.layout.height)
            }
          >
            <TeleprompterDisplay
              activeSegmentIndex={activeSegmentIndex}
              corrections={corrections}
              currentWordIndex={displayCurrentWordIndex}
              onSegmentLayout={handleSegmentLayout}
              onWordLongPress={handleWordLongPress}
              onWordPress={handleWordPress}
              onWordSpeech={handleWordSpeech}
              practiceMode={practiceMode}
              segments={segments}
              speakingWord={speakingWord}
              spokenThroughWordIndex={currentWordIndex}
              words={allWords}
            />
          </ScrollView>

          {generationError || autoContinueError ? (
            <ThemedText style={styles.errorText}>
              {generationError ?? autoContinueError}
            </ThemedText>
          ) : null}

          <View style={styles.controls}>
            <Pressable
              onPress={handleToggleReading}
              onPressIn={() => setBtnPressed(true)}
              onPressOut={() => setBtnPressed(false)}
            >
              <ThemedView
                type={isReading ? "error" : "primary"}
                style={[
                  styles.controlButton,
                  btnPressed && styles.controlButtonActive,
                ]}
              >
                <ThemedText
                  type="default"
                  weight="700"
                  style={styles.controlButtonText}
                >
                  {primaryActionLabel}
                </ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable
              onPress={handleRestart}
              onPressIn={() => setResetPressed(true)}
              onPressOut={() => setResetPressed(false)}
            >
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.secondaryButton,
                  resetPressed && styles.secondaryButtonActive,
                ]}
              >
                <ThemedText
                  type="default"
                  weight="700"
                  style={styles.secondaryButtonText}
                >
                  {t("teleprompter.actionRestart")}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>

          {corrections.length > 0 ? (
            <ThemedView type="backgroundContent" style={styles.correctionsBox}>
              <ThemedText type="smallBold" style={styles.correctionsTitle}>
                {t("teleprompter.wordsToRevisit")}
              </ThemedText>
              {corrections.slice(-3).map((correction, index) => (
                <ThemedText
                  key={`${correction.wordIndex}-${index}`}
                  type="small"
                  style={styles.correctionText}
                >
                  {t("teleprompter.practiceWord")}
                  <ThemedText type="default" weight="700">
                    {correction.expected}
                  </ThemedText>
                </ThemedText>
              ))}
            </ThemedView>
          ) : null}
        </View>

        <PracticeReport
          corrections={corrections}
          onClose={() => setReportVisible(false)}
          onRestart={handleRestart}
          spokenCount={spokenCount}
          totalWords={totalWords}
          visible={reportVisible}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function createStyles(theme: ThemePalette) {
  const shadows = createShadows(theme);

  return StyleSheet.create({
    backButton: {
      color: theme.primary,
      flexShrink: 0,
      fontSize: 16,
    },
    coachPanel: {
      borderRadius: Radius.lg,
      gap: Spacing.md,
      padding: Spacing.md,
      ...shadows.card,
    },
    coachSummary: {
      alignItems: "center",
      flexDirection: "row",
      gap: Spacing.md,
      justifyContent: "space-between",
    },
    coachSummaryMain: {
      flex: 1,
      gap: Spacing.xs,
      minWidth: 0,
    },
    coachSummaryMeta: {
      alignItems: "flex-end",
      flexShrink: 0,
      gap: 2,
    },
    container: {
      backgroundColor: theme.background,
      flex: 1,
    },
    content: {
      alignSelf: "center",
      flex: 1,
      gap: Spacing.md,
      maxWidth: MaxContentWidth,
      width: "100%",
    },
    controlButton: {
      alignItems: "center",
      borderRadius: Radius.pill,
      minWidth: 180,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    controlButtonActive: {
      transform: [{ translateY: 2 }],
      ...shadows.btnActive,
    },
    controlButtonText: {
      color: "#ffffff",
    },
    controls: {
      alignItems: "center",
      flexDirection: "row",
      gap: Spacing.md,
      justifyContent: "center",
      marginTop: Spacing.sm,
    },
    correctionText: {
      color: theme.textMuted,
      marginBottom: 4,
    },
    correctionsBox: {
      borderRadius: Radius.lg,
      padding: Spacing.md,
      ...shadows.card,
    },
    correctionsTitle: {
      color: theme.text,
      marginBottom: Spacing.sm,
    },
    cueCard: {
      borderRadius: Radius.base,
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    cueLabel: {
      color: theme.textMuted,
    },
    cueStack: {
      gap: Spacing.sm,
    },
    cueText: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 22,
    },
    errorText: {
      color: theme.error,
      textAlign: "center",
    },
    expandLabel: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: "800",
    },
    header: {
      alignItems: "center",
      alignSelf: "center",
      flexDirection: "row",
      gap: Spacing.sm,
      justifyContent: "space-between",
      marginBottom: Spacing.lg,
      maxWidth: MaxContentWidth,
      width: "100%",
    },
    interactionHintCard: {
      borderRadius: Radius.base,
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    interactionHintText: {
      color: theme.textMuted,
      lineHeight: 18,
    },
    interactionHintTitle: {
      color: theme.text,
    },
    metricCard: {
      borderRadius: Radius.base,
      flex: 1,
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    metricLabel: {
      color: theme.textMuted,
    },
    metricRow: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    metricValue: {
      color: theme.text,
      fontSize: 24,
    },
    modeLabel: {
      color: theme.textMuted,
    },
    modeOption: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
    },
    modeOptionActive: {
      backgroundColor: theme.backgroundContent,
      ...shadows.inputSmall,
    },
    modeOptionText: {
      color: theme.textSofter,
    },
    modeOptionTextActive: {
      color: theme.text,
    },
    modePressable: {
      flex: 1,
    },
    modeRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: Spacing.sm,
      justifyContent: "space-between",
    },
    modeSwitch: {
      backgroundColor: theme.backgroundElement,
      borderRadius: Radius.pill,
      flexDirection: "row",
      gap: Spacing.xs,
      padding: Spacing.xs,
    },
    progressBar: {
      backgroundColor: theme.backgroundElement,
      borderRadius: Radius.pill,
      height: 10,
      overflow: "hidden",
    },
    progressFill: {
      backgroundColor: theme.spoken,
      borderRadius: Radius.pill,
      height: "100%",
    },
    progressSummary: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
    },
    reportButton: {
      alignItems: "center",
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    reportButtonText: {
      color: theme.primary,
    },
    safeArea: {
      flex: 1,
      paddingBottom: Spacing.xl,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
    },
    sceneLabel: {
      color: theme.textMuted,
    },
    sceneSummary: {
      borderColor: theme.borderSoft,
      borderTopWidth: 1,
      gap: Spacing.xs,
      paddingTop: Spacing.md,
    },
    sceneText: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 21,
    },
    secondaryButton: {
      alignItems: "center",
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    secondaryButtonActive: {
      transform: [{ translateY: 2 }],
      ...shadows.btnActive,
    },
    secondaryButtonText: {
      color: theme.text,
    },
    statusDetail: {
      color: theme.textMuted,
      flexShrink: 1,
      lineHeight: 18,
    },
    statusDot: {
      borderRadius: Radius.pill,
      height: 10,
      width: 10,
    },
    statusPill: {
      alignItems: "center",
      alignSelf: "flex-start",
      borderRadius: Radius.pill,
      flexDirection: "row",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    statusText: {
      color: theme.text,
    },
    teleprompterContainer: {
      flex: 1,
    },
    teleprompterContent: {
      paddingBottom: Spacing.xl,
    },
    title: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "700",
    },
    titleWrapper: {
      alignItems: "flex-end",
      flex: 1,
    },
  });
}
