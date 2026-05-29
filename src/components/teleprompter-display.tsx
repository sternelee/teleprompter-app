import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, NookPalette, Radius, Shadows, Spacing } from '@/constants/theme';
import type { Correction, DialogueSegment, Word } from '@/types/dialogue';

type TeleprompterDisplayProps = {
  activeSegmentIndex?: number;
  corrections: Correction[];
  currentWordIndex: number;
  segments: DialogueSegment[];
  words: Word[];
};

function speakerLabel(speaker: DialogueSegment['speaker']) {
  return speaker === 'user' ? 'You' : 'AI';
}

export function TeleprompterDisplay({
  activeSegmentIndex = -1,
  corrections,
  currentWordIndex,
  segments,
  words,
}: TeleprompterDisplayProps) {
  const correctionIndexes = new Set(corrections.map((correction) => correction.wordIndex));

  return (
    <View style={styles.container}>
      {segments.map((segment, segmentIndex) => {
        const segmentWords = words.filter((word) => word.segmentIndex === segmentIndex);
        const isActive = activeSegmentIndex === segmentIndex;
        const hasActiveTarget =
          activeSegmentIndex >= 0 &&
          segmentWords.some((word) => word.wordIndex === currentWordIndex);
        const isDimmed = activeSegmentIndex >= 0 && !isActive;

        return (
          <View
            key={`${segment.speaker}-${segmentIndex}-${segment.text}`}
            style={[
              styles.segmentRow,
              segment.speaker === 'user' ? styles.userRow : styles.aiRow,
            ]}>
            <ThemedView
              style={[
                styles.segmentBubble,
                {
                  backgroundColor: NookPalette[segmentIndex % NookPalette.length],
                },
                isDimmed && styles.segmentBubbleDimmed,
                isActive && styles.segmentBubbleActive,
              ]}>
              <View style={styles.segmentHeader}>
                <ThemedText style={styles.speaker}>{speakerLabel(segment.speaker)}</ThemedText>
                {isActive ? (
                  <ThemedView style={styles.activeBadge}>
                    <ThemedText style={styles.activeBadgeText}>
                      {hasActiveTarget ? 'Live cue' : 'Up next'}
                    </ThemedText>
                  </ThemedView>
                ) : null}
              </View>

              <View style={styles.wordsRow}>
                {segmentWords.map((word) => {
                  const isSpoken = word.wordIndex < currentWordIndex;
                  const isCurrent = word.wordIndex === currentWordIndex;
                  const isCorrection = correctionIndexes.has(word.wordIndex);

                  return (
                    <ThemedText
                      key={`${segmentIndex}-${word.wordIndex}-${word.text}`}
                      style={[
                        styles.word,
                        isSpoken && styles.wordSpoken,
                        isCurrent && styles.wordCurrent,
                        isCorrection && styles.wordCorrection,
                      ]}>
                      {word.text}{' '}
                    </ThemedText>
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
    alignItems: 'center',
    backgroundColor: 'rgba(25, 200, 185, 0.14)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  activeBadgeText: {
    color: Colors.light.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  aiRow: {
    alignItems: 'flex-start',
  },
  container: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  segmentBubble: {
    borderColor: 'rgba(121, 79, 39, 0.1)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    maxWidth: '92%',
    minWidth: '62%',
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
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  segmentRow: {
    width: '100%',
  },
  speaker: {
    color: '#794f27',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  userRow: {
    alignItems: 'flex-end',
  },
  word: {
    color: Colors.light.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 32,
  },
  wordCorrection: {
    color: Colors.light.error,
    textDecorationLine: 'underline',
  },
  wordCurrent: {
    backgroundColor: 'rgba(255, 209, 102, 0.7)',
    borderRadius: Radius.sm,
    color: '#6a4a1f',
    overflow: 'hidden',
    paddingHorizontal: 2,
  },
  wordSpoken: {
    color: Colors.light.spoken,
  },
  wordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
