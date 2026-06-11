import { useRef } from "react";
import {
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  Colors,
  NookPalette,
  Radius,
  Shadows,
  Spacing,
} from "@/constants/theme";
import type { Correction, DialogueSegment, Word } from "@/types/dialogue";

type TeleprompterDisplayProps = {
  activeSegmentIndex?: number;
  corrections: Correction[];
  currentWordIndex: number;
  onSegmentLayout?: (segmentIndex: number, y: number) => void;
  onWordLongPress?: (word: Word) => void;
  onWordPress?: (word: Word) => void;
  segments: DialogueSegment[];
  spokenThroughWordIndex?: number;
  words: Word[];
};

function speakerLabel(speaker: DialogueSegment["speaker"]) {
  return speaker === "user" ? "You" : "Partner";
}

export function TeleprompterDisplay({
  activeSegmentIndex = -1,
  corrections,
  currentWordIndex,
  onSegmentLayout,
  onWordLongPress,
  onWordPress,
  segments,
  spokenThroughWordIndex = -1,
  words,
}: TeleprompterDisplayProps) {
  const correctionIndexes = new Set(
    corrections.map((correction) => correction.wordIndex),
  );
  const longPressHandledRef = useRef(false);

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
        const isPracticeSegment = segment.speaker === "user";
        const isActive = activeSegmentIndex === segmentIndex;
        const hasActiveTarget =
          activeSegmentIndex >= 0 &&
          segmentWords.some((word) => word.globalIndex === currentWordIndex);
        const isDimmed = activeSegmentIndex >= 0 && !isActive;
        const palette = NookPalette[segmentIndex % NookPalette.length];
        const bubbleTextColor = isPracticeSegment
          ? palette.text
          : Colors.light.text;

        return (
          <View
            key={`${segment.speaker}-${segmentIndex}-${segment.text}`}
            onLayout={(event: LayoutChangeEvent) =>
              onSegmentLayout?.(segmentIndex, event.nativeEvent.layout.y)
            }
            style={[
              styles.segmentRow,
              segment.speaker === "user" ? styles.userRow : styles.aiRow,
            ]}
          >
            <ThemedView
              style={[
                styles.segmentBubble,
                isPracticeSegment
                  ? { backgroundColor: palette.bg }
                  : styles.partnerBubble,
                isDimmed && styles.segmentBubbleDimmed,
                isActive && styles.segmentBubbleActive,
              ]}
            >
              <View style={styles.segmentHeader}>
                <ThemedText
                  style={[styles.speaker, { color: bubbleTextColor }]}
                >
                  {speakerLabel(segment.speaker)}
                </ThemedText>
                {isActive ? (
                  <ThemedView
                    style={[
                      styles.activeBadge,
                      !isPracticeSegment && styles.partnerBadge,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.activeBadgeText,
                        !isPracticeSegment && styles.partnerBadgeText,
                      ]}
                    >
                      {hasActiveTarget ? "Speak now" : "Reviewed"}
                    </ThemedText>
                  </ThemedView>
                ) : null}
              </View>

              <View style={styles.wordsRow}>
                {segmentWords.map((word) => {
                  const isSpoken =
                    isPracticeSegment &&
                    word.globalIndex <= spokenThroughWordIndex;
                  const isCurrent =
                    isPracticeSegment && word.globalIndex === currentWordIndex;
                  const isCorrection =
                    isPracticeSegment && correctionIndexes.has(word.globalIndex);

                  return (
                    <Pressable
                      key={`${segmentIndex}-${word.globalIndex}-${word.text}`}
                      disabled={!isPracticeSegment && !onWordLongPress}
                      delayLongPress={280}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      onLongPress={() => handleWordLongPress(word)}
                      onPress={() => {
                        if (isPracticeSegment) {
                          handleWordPress(word);
                        }
                      }}
                      onPressIn={() => {
                        longPressHandledRef.current = false;
                      }}
                      style={styles.wordPressable}
                    >
                      <ThemedText
                        style={[
                          styles.word,
                          { color: bubbleTextColor },
                          !isPracticeSegment && styles.partnerWord,
                          isSpoken && styles.wordSpoken,
                          isCurrent && styles.wordCurrent,
                          isCorrection && styles.wordCorrection,
                        ]}
                      >
                        {word.text}
                      </ThemedText>
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
}

const styles = StyleSheet.create({
  activeBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
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
    backgroundColor: Colors.light.backgroundElement,
  },
  partnerBadgeText: {
    color: Colors.light.textMuted,
  },
  partnerBubble: {
    backgroundColor: Colors.light.backgroundContent,
    borderColor: "rgba(121, 79, 39, 0.16)",
  },
  partnerWord: {
    fontWeight: "600",
    opacity: 0.88,
  },
  segmentBubble: {
    borderColor: "rgba(121, 79, 39, 0.1)",
    borderRadius: Radius.lg,
    borderWidth: 1,
    maxWidth: "92%",
    minWidth: "62%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Shadows.card,
  },
  segmentBubbleActive: {
    borderColor: Colors.light.primary,
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
  userRow: {
    alignItems: "flex-end",
  },
  word: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 32,
  },
  wordCorrection: {
    color: Colors.light.error,
    textDecorationLine: "underline",
  },
  wordCurrent: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderRadius: Radius.sm,
    color: "#6a4a1f",
    overflow: "hidden",
    paddingHorizontal: 4,
  },
  wordPressable: {
    marginBottom: 2,
    marginRight: 4,
  },
  wordSpoken: {
    color: Colors.light.spoken,
  },
  wordsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
