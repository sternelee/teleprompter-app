import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TeleprompterDisplay } from "@/components/teleprompter-display";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  Colors,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
} from "@/constants/theme";
import { useApp } from "@/contexts/app-context";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { normalizeWord, useWordMatcher } from "@/hooks/use-word-matcher";
import { generateDialogue } from "@/services/openai";
import type { Word } from "@/types/dialogue";

const AUTO_CONTINUE_THRESHOLD = 8;
const CUE_PREVIEW_WORDS = 8;
const DICTIONARY_NAME = "Cambridge Dictionary";

function getSpeakerLabel(speaker?: "ai" | "user") {
  return speaker === "user" ? "You" : "Partner";
}

function getCuePreview(words: Word[], startIndex = 0) {
  const preview = words
    .slice(startIndex, startIndex + CUE_PREVIEW_WORDS)
    .map((word) => word.text.trim())
    .join(" ")
    .trim();

  if (!preview) {
    return "—";
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
    appendSegments,
  } = useApp();

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
  const scrollViewRef = useRef<ScrollView>(null);
  const fetchingRef = useRef(false);
  const segmentOffsetsRef = useRef<Record<number, number>>({});

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

  const practiceWords = allWords;

  const {
    currentWordIndex,
    corrections,
    jumpToWord,
    updateProgress,
    resetProgress,
  } = useWordMatcher(practiceWords);

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

  const {
    isListening,
    permissionResponse,
    requestPermission,
    startListening,
    stopListening,
  } = useSpeechRecognition({
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
  const nextPracticeWord =
    activeSegmentIndex >= 0
      ? practiceWords.find(
          (word) =>
            word.segmentIndex > activeSegmentIndex &&
            word.globalIndex > (activeWord?.globalIndex ?? -1),
        )
      : undefined;
  const displayCurrentWordIndex = targetPracticeWord?.globalIndex ?? -1;

  const currentCue = useMemo(() => {
    if (totalWords === 0) {
      return {
        label: "Coach",
        text: "This dialogue has no words to practice yet.",
      };
    }

    if (!targetPracticeWord) {
      return {
        label: "Complete",
        text: "All dialogue lines are marked as practiced.",
      };
    }

    const segmentWords = wordsBySegment[targetPracticeWord.segmentIndex] ?? [];
    const segment = segments[targetPracticeWord.segmentIndex];

    return {
      label: getSpeakerLabel(segment?.speaker),
      text: getCuePreview(segmentWords, targetPracticeWord.localIndex),
    };
  }, [segments, targetPracticeWord, totalWords, wordsBySegment]);

  const nextCue = useMemo(() => {
    if (nextPracticeWord) {
      const nextWords = wordsBySegment[nextPracticeWord.segmentIndex] ?? [];
      const nextSegment = segments[nextPracticeWord.segmentIndex];

      return {
        label: getSpeakerLabel(nextSegment?.speaker),
        text: getCuePreview(nextWords, nextPracticeWord.localIndex),
      };
    }

    if (isGenerating || isContinuing) {
      return { label: "Partner", text: "Writing the next exchange…" };
    }

    return {
      label: "Coach",
      text:
        remainingWords === 0
          ? "Session complete. Restart to rehearse it again."
          : "You are on the final dialogue line.",
    };
  }, [
    isContinuing,
    isGenerating,
    nextPracticeWord,
    remainingWords,
    segments,
    wordsBySegment,
  ]);

  const statusMeta = useMemo(() => {
    if (totalWords === 0) {
      return {
        label: "No Dialogue",
        detail: "Generate a scene with dialogue to practice.",
        color: Colors.light.error,
        backgroundColor: Colors.light.backgroundElement,
      };
    }

    if (needsPermission) {
      return {
        label: "Permission Needed",
        detail: "Allow microphone access to practice out loud.",
        color: Colors.light.error,
        backgroundColor: Colors.light.backgroundElement,
      };
    }

    if (isGenerating || isContinuing) {
      return {
        label: "Generating",
        detail: "Adding fresh lines so the conversation keeps flowing.",
        color: Colors.light.primary,
        backgroundColor: Colors.light.primaryBg,
      };
    }

    if (isReading) {
      return {
        label: "Listening",
        detail: isListening
          ? "Follow the live cue and keep speaking."
          : "Warming up the microphone…",
        color: Colors.light.spoken,
        backgroundColor: Colors.light.backgroundSelected,
      };
    }

    if (hasSessionProgress) {
      return {
        label: "Paused",
        detail: "Resume anytime without losing your place.",
        color: Colors.light.current,
        backgroundColor: Colors.light.backgroundContent,
      };
    }

    return {
      label: "Ready",
      detail: "Start when you want to rehearse the scene.",
      color: Colors.light.text,
      backgroundColor: Colors.light.backgroundElement,
    };
  }, [
    hasSessionProgress,
    isContinuing,
    isGenerating,
    isListening,
    isReading,
    needsPermission,
    totalWords,
  ]);

  const interactionHint = dictionaryFeedback
    ? dictionaryFeedback
    : `Tap any word to jump. Long press any word to open ${DICTIONARY_NAME}.`;
  const statusDetailText =
    speechError ?? dictionaryFeedback ?? statusMeta.detail;
  const progressSummary =
    totalWords > 0 ? `${spokenCount}/${totalWords}` : "No lines";

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
    const wordsRemaining = remainingWords;

    if (
      !scene ||
      !apiKey ||
      isGenerating ||
      isContinuing ||
      fetchingRef.current ||
      spokenCount === 0 ||
      wordsRemaining > AUTO_CONTINUE_THRESHOLD ||
      wordsRemaining <= 0
    ) {
      return;
    }

    fetchingRef.current = true;
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
            : "Could not add follow-up lines. You can keep practicing or generate a new scene.",
        );
      })
      .finally(() => {
        fetchingRef.current = false;
        setIsContinuing(false);
      });
  }, [
    appendSegments,
    apiKey,
    isContinuing,
    isGenerating,
    remainingWords,
    scene,
    segments,
    spokenCount,
  ]);

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

    setSpeechError(null);
    setAutoContinueError(null);

    if (totalWords === 0) {
      setSpeechError("This script has no dialogue to practice.");
      return;
    }

    if (!permissionResponse?.granted) {
      const permission = await requestPermission();

      if (!permission.granted) {
        setIsReading(false);
        setSpeechError("Microphone permission is required to keep practicing.");
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
    totalWords,
  ]);

  const handleRestart = useCallback(() => {
    setIsReading(false);
    setIsCoachPanelExpanded(false);
    setBlinkVisible(true);
    setDictionaryFeedback(null);
    setSpeechError(null);
    setAutoContinueError(null);
    void stopListening();
    resetProgress();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [resetProgress, stopListening]);

  const handleBack = useCallback(() => {
    setIsReading(false);
    setIsCoachPanelExpanded(false);
    setBlinkVisible(true);
    void stopListening();
    router.back();
  }, [router, stopListening]);

  const handleSegmentLayout = useCallback((segmentIndex: number, y: number) => {
    segmentOffsetsRef.current[segmentIndex] = y;
  }, []);

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
        setDictionaryFeedback(
          "This token cannot be looked up in the dictionary.",
        );
        return;
      }

      if (isReading) {
        setIsReading(false);
        setBlinkVisible(true);
        await stopListening();
      }

      setSpeechError(null);
      setDictionaryFeedback(`Opening ${DICTIONARY_NAME} for "${lookupWord}"…`);

      try {
        await WebBrowser.openBrowserAsync(getDictionaryUrl(lookupWord));
        setDictionaryFeedback(
          `Opened ${DICTIONARY_NAME} for "${lookupWord}". Resume when ready.`,
        );
      } catch (error) {
        setDictionaryFeedback(
          error instanceof Error
            ? error.message
            : `Could not open ${DICTIONARY_NAME} for "${lookupWord}".`,
        );
      }
    },
    [isReading, stopListening],
  );

  const primaryActionLabel = isReading
    ? "Pause"
    : needsPermission
      ? "Enable microphone"
      : hasSessionProgress
        ? "Resume listening"
        : "Start speaking";

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={8}>
            <ThemedText style={styles.backButton}>← Back</ThemedText>
          </Pressable>
          <ThemedText style={styles.title}>Teleprompter Practice</ThemedText>
        </View>

        <View style={styles.content}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
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
                  {isCoachPanelExpanded ? "Hide" : "Details"}
                </ThemedText>
              </View>
            </Pressable>

            {isCoachPanelExpanded ? (
              <>
                <View style={styles.sceneSummary}>
                  <ThemedText type="smallBold" style={styles.sceneLabel}>
                    Scene
                  </ThemedText>
                  <ThemedText style={styles.sceneText}>{scene}</ThemedText>
                </View>

                <View style={styles.metricRow}>
                  <ThemedView
                    type="backgroundElement"
                    style={styles.metricCard}
                  >
                    <ThemedText type="small" style={styles.metricLabel}>
                      Practiced
                    </ThemedText>
                    <ThemedText type="title" style={styles.metricValue}>
                      {spokenCount}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView
                    type="backgroundElement"
                    style={styles.metricCard}
                  >
                    <ThemedText type="small" style={styles.metricLabel}>
                      Left
                    </ThemedText>
                    <ThemedText type="title" style={styles.metricValue}>
                      {remainingWords}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView
                    type="backgroundElement"
                    style={styles.metricCard}
                  >
                    <ThemedText type="small" style={styles.metricLabel}>
                      Revisit
                    </ThemedText>
                    <ThemedText type="title" style={styles.metricValue}>
                      {corrections.length}
                    </ThemedText>
                  </ThemedView>
                </View>

                <View style={styles.cueStack}>
                  <ThemedView type="backgroundElement" style={styles.cueCard}>
                    <ThemedText type="small" style={styles.cueLabel}>
                      Current focus · {currentCue.label}
                    </ThemedText>
                    <ThemedText style={styles.cueText}>
                      {currentCue.text}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView type="backgroundElement" style={styles.cueCard}>
                    <ThemedText type="small" style={styles.cueLabel}>
                      Coming up · {nextCue.label}
                    </ThemedText>
                    <ThemedText style={styles.cueText}>
                      {nextCue.text}
                    </ThemedText>
                  </ThemedView>
                </View>

                <ThemedView
                  type="backgroundElement"
                  style={styles.interactionHintCard}
                >
                  <ThemedText
                    type="smallBold"
                    style={styles.interactionHintTitle}
                  >
                    Word actions
                  </ThemedText>
                  <ThemedText type="small" style={styles.interactionHintText}>
                    {interactionHint}
                  </ThemedText>
                </ThemedView>
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
              segments={segments}
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
                  Restart
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>

          {corrections.length > 0 ? (
            <ThemedView type="backgroundContent" style={styles.correctionsBox}>
              <ThemedText type="smallBold" style={styles.correctionsTitle}>
                Words to revisit
              </ThemedText>
              {corrections.slice(-3).map((correction, index) => (
                <ThemedText
                  key={index}
                  type="small"
                  style={styles.correctionText}
                >
                  Practice:{" "}
                  <ThemedText type="default" weight="700">
                    {correction.expected}
                  </ThemedText>
                </ThemedText>
              ))}
            </ThemedView>
          ) : null}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f6f3e8",
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  backButton: {
    color: "#19c8b9",
    fontSize: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#794f27",
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    gap: Spacing.md,
  },
  sceneLabel: {
    color: "#8a6d46",
  },
  sceneSummary: {
    borderColor: "rgba(121, 79, 39, 0.12)",
    borderTopWidth: 1,
    gap: Spacing.xs,
    paddingTop: Spacing.md,
  },
  sceneText: {
    color: "#794f27",
    fontSize: 15,
    lineHeight: 21,
  },
  progressBar: {
    height: 10,
    backgroundColor: "#e5dbc8",
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6fba2c",
    borderRadius: Radius.pill,
  },
  coachPanel: {
    borderRadius: Radius.lg,
    gap: Spacing.md,
    padding: Spacing.md,
    ...Shadows.card,
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
  expandLabel: {
    color: "#19c8b9",
    fontSize: 13,
    fontWeight: "800",
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
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
  statusText: {
    color: "#794f27",
  },
  statusDetail: {
    color: "#8a6d46",
    flexShrink: 1,
    lineHeight: 18,
  },
  progressSummary: {
    color: "#794f27",
    fontSize: 16,
    fontWeight: "900",
  },
  metricRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    borderRadius: Radius.base,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  metricLabel: {
    color: "#8a6d46",
  },
  metricValue: {
    color: "#794f27",
    fontSize: 24,
  },
  cueStack: {
    gap: Spacing.sm,
  },
  cueCard: {
    borderRadius: Radius.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  cueLabel: {
    color: "#8a6d46",
  },
  cueText: {
    color: "#794f27",
    fontSize: 15,
    lineHeight: 22,
  },
  interactionHintCard: {
    borderRadius: Radius.base,
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  interactionHintText: {
    color: "#8a6d46",
    lineHeight: 18,
  },
  interactionHintTitle: {
    color: "#794f27",
  },
  teleprompterContainer: {
    flex: 1,
  },
  teleprompterContent: {
    paddingBottom: Spacing.xl,
  },
  errorText: {
    color: "#e05a5a",
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  controlButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    minWidth: 180,
    alignItems: "center",
    ...Shadows.btn,
  },
  controlButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  controlButtonText: {
    color: "#ffffff",
  },
  secondaryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: "center",
    ...Shadows.btn,
  },
  secondaryButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  secondaryButtonText: {
    color: "#794f27",
  },
  correctionsBox: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  correctionsTitle: {
    marginBottom: Spacing.sm,
    color: "#794f27",
  },
  correctionText: {
    color: "#8a6d46",
    marginBottom: 4,
  },
});
