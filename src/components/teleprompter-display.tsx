import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  createShadows,
  NookPalette,
  Radius,
  Spacing,
  type ThemePalette,
} from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useI18n } from "@/i18n";
import type { Correction, DialogueSegment, Word } from "@/types/dialogue";
import type { PracticeMode } from "@/types/session";

type TeleprompterDisplayProps = {
  activeSegmentIndex?: number;
  corrections: Correction[];
  currentWordIndex: number;
  onSegmentLayout?: (segmentIndex: number, y: number) => void;
  onWordLongPress?: (word: Word) => void;
  onWordPress?: (word: Word) => void;
  onWordSpeech?: (word: Word) => void;
  practiceMode?: PracticeMode;
  segments: DialogueSegment[];
  speakingWord?: string | null;
  spokenThroughWordIndex?: number;
  words: Word[];
};

export const TeleprompterDisplay = memo(function TeleprompterDisplay({
  activeSegmentIndex = -1,
  corrections,
  currentWordIndex,
  onSegmentLayout,
  onWordLongPress,
  onWordPress,
  onWordSpeech,
  practiceMode = "full",
  segments,
  speakingWord,
  spokenThroughWordIndex = -1,
  words,
}: TeleprompterDisplayProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const correctionIndexes = new Set(
    corrections.map((correction) => correction.wordIndex),
  );
  const longPressHandledRef = useRef(false);
  const isAndroid = Platform.OS === "android";

  // Workaround for the Android 15/16 text clipping bug in React Native 0.85
  // (facebook/react-native#53286, reintroduced in 0.85.0 by #56282, tracked as
  // #56402; Expo SDK 56 pins RN 0.85.x so no fixed upgrade exists yet).
  //
  // Text nodes inside content-sized `flexWrap` rows can be measured too
  // narrow while new siblings are being appended, so a freshly appended word
  // renders clipped (e.g. "By" shows only "B") until some style change forces
  // a re-measure — which is why highlighting the word "fixes" it.
  //
  // Once the appended words have settled, bump a tick that nudges every
  // word's text style with a tiny (sub-pixel per step) padding epsilon. The
  // changed style invalidates RN's text measure cache and re-measures each
  // word at the now-stable container width, reproducing the "highlight fixes
  // it" effect for the whole segment. The epsilon is strictly monotonic so a
  // poisoned cache entry from a mid-append measurement is never reused.
  const [remeasureTick, setRemeasureTick] = useState(0);

  useEffect(() => {
    if (!isAndroid) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      // Give Yoga one extra beat to commit the appended layout before forcing
      // the re-measure pass.
      timer = setTimeout(() => {
        setRemeasureTick((tick) => tick + 1);
      }, 50);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [isAndroid, segments.length]);

  // 0.1px per append: invisible in practice (a 30-append marathon session
  // accumulates only 3px) while guaranteeing a fresh measure cache key.
  const wordMeasureNudge = isAndroid
    ? { paddingRight: 0.1 * remeasureTick }
    : null;

  const handleWordPress = (word: Word) => {
    if (longPressHandledRef.current) {
      longPressHandledRef.current = false;
      return;
    }

    onWordPress?.(word);
  };

  const handleWordLongPress = (word: Word) => {
    longPressHandledRef.current = true;
    onWordLongPress?.(word);
  };

  return (
    <View style={styles.container}>
      {segments.map((segment, segmentIndex) => {
        const segmentWords = words.filter(
          (word) => word.segmentIndex === segmentIndex,
        );
        const isUserSegment = segment.speaker === "user";
        const isActive = activeSegmentIndex === segmentIndex;
        const isPracticeable = practiceMode === "full" || isUserSegment;
        const hasActiveTarget =
          isPracticeable &&
          activeSegmentIndex >= 0 &&
          segmentWords.some((word) => word.globalIndex === currentWordIndex);
        const isDimmed = activeSegmentIndex >= 0 && !isActive;
        const palette = NookPalette[segmentIndex % NookPalette.length];
        const bubbleTextColor = isUserSegment ? palette.text : theme.text;

        return (
          <View
            key={`${segment.speaker}-${segmentIndex}-${segment.text}`}
            onLayout={(event: LayoutChangeEvent) =>
              onSegmentLayout?.(segmentIndex, event.nativeEvent.layout.y)
            }
            style={[
              styles.segmentRow,
              isUserSegment ? styles.userRow : styles.aiRow,
            ]}
          >
            <ThemedView
              style={[
                styles.segmentBubble,
                isUserSegment
                  ? { backgroundColor: palette.bg }
                  : styles.partnerBubble,
                isDimmed && styles.segmentBubbleDimmed,
                isActive && styles.segmentBubbleActive,
                !isPracticeable && styles.partnerBubbleMuted,
              ]}
            >
              <View style={styles.segmentHeader}>
                <ThemedText style={[styles.speaker, { color: bubbleTextColor }]}>
                  {isUserSegment
                    ? t("teleprompter.speakerYou")
                    : t("teleprompter.speakerPartner")}
                </ThemedText>
                {isActive ? (
                  <ThemedView
                    style={[
                      styles.activeBadge,
                      !isUserSegment && styles.partnerBadge,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.activeBadgeText,
                        !isUserSegment && styles.partnerBadgeText,
                      ]}
                    >
                      {!isUserSegment && practiceMode === "role"
                        ? t("teleprompter.autoRead")
                        : hasActiveTarget
                          ? t("teleprompter.speakNow")
                          : t("teleprompter.reviewed")}
                    </ThemedText>
                  </ThemedView>
                ) : null}
              </View>

              <View style={styles.wordsRow}>
                {segmentWords.map((word) => {
                  const isSpoken =
                    isPracticeable &&
                    word.globalIndex <= spokenThroughWordIndex;
                  const isCurrent =
                    isPracticeable && word.globalIndex === currentWordIndex;
                  const isCorrection =
                    isPracticeable && correctionIndexes.has(word.globalIndex);

                  return (
                    <Pressable
                      key={`${segmentIndex}-${word.globalIndex}-${word.text}`}
                      disabled={!onWordPress && !onWordLongPress}
                      delayLongPress={280}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      onLongPress={() => handleWordLongPress(word)}
                      onPress={() => handleWordPress(word)}
                      onPressIn={() => {
                        longPressHandledRef.current = false;
                      }}
                      style={styles.wordPressable}
                    >
                      <ThemedText
                        style={[
                          styles.word,
                          wordMeasureNudge,
                          { color: bubbleTextColor },
                          !isUserSegment && styles.partnerWord,
                          isSpoken && styles.wordSpoken,
                          isCurrent && styles.wordCurrent,
                          isCorrection && styles.wordCorrection,
                        ]}
                      >
                        {word.text}
                      </ThemedText>
                      {isCurrent && onWordSpeech ? (
                        <Pressable
                          hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}
                          onPress={() => onWordSpeech(word)}
                          style={styles.speechTrigger}
                        >
                          <View
                            style={[
                              styles.speechBar,
                              speakingWord === word.text &&
                                styles.speechBarActive,
                            ]}
                          />
                        </Pressable>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ThemedView>
          </View>
        );
      })}
    </View>
  );
});

function createStyles(theme: ThemePalette) {
  const shadows = createShadows(theme);

  return StyleSheet.create({
    activeBadge: {
      alignItems: "center",
      backgroundColor: theme.onBubbleDim,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
    },
    activeBadgeText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "800",
    },
    aiRow: {
      alignItems: "flex-start",
    },
    container: {
      gap: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    partnerBadge: {
      backgroundColor: theme.backgroundElement,
    },
    partnerBadgeText: {
      color: theme.textMuted,
    },
    partnerBubble: {
      backgroundColor: theme.backgroundContent,
      borderColor: theme.borderBubble,
    },
    partnerBubbleMuted: {
      opacity: 0.85,
    },
    partnerWord: {
      fontWeight: "600",
      opacity: 0.88,
    },
    segmentBubble: {
      borderColor: theme.borderFaint,
      borderRadius: Radius.lg,
      borderWidth: 1,
      maxWidth: "92%",
      minWidth: "62%",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      ...shadows.card,
    },
    segmentBubbleActive: {
      borderColor: theme.primary,
      borderWidth: 2,
      opacity: 1,
      transform: [{ translateY: -2 }],
    },
    segmentBubbleDimmed: {
      opacity: 0.72,
    },
    segmentHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: Spacing.sm,
    },
    segmentRow: {
      width: "100%",
    },
    speaker: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    speechBar: {
      backgroundColor: theme.onBubbleSubtle,
      borderRadius: 1,
      height: 2,
      width: "70%",
    },
    speechBarActive: {
      backgroundColor: theme.onBubbleStrong,
    },
    speechTrigger: {
      alignItems: "center",
      height: 8,
      justifyContent: "center",
      marginTop: 2,
    },
    userRow: {
      alignItems: "flex-end",
    },
    word: {
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 32,
    },
    wordCorrection: {
      color: theme.error,
      textDecorationLine: "underline",
    },
    wordCurrent: {
      backgroundColor: theme.highlightBg,
      borderRadius: Radius.sm,
      color: theme.highlightText,
      overflow: "hidden",
      paddingHorizontal: 4,
    },
    wordPressable: {
      marginBottom: 2,
      marginRight: 4,
    },
    wordsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    wordSpoken: {
      color: theme.spoken,
    },
  });
}
