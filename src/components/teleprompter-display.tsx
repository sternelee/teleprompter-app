import { useCallback } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Radius, NookPalette } from '@/constants/theme';
import { DialogueSegment, Word, Correction } from '@/types/dialogue';

interface TeleprompterDisplayProps {
  segments: DialogueSegment[];
  currentWordIndex: number;
  corrections: Correction[];
  onWordLayout: (index: number, y: number) => void;
  isGenerating: boolean;
}

function segmentToWords(segments: DialogueSegment[]): Word[] {
  const words: Word[] = [];
  let globalIndex = 0;
  segments.forEach((segment, segIdx) => {
    const tokens = segment.text.match(/\S+\s*|\s+/g) || [];
    tokens.forEach((token, localIdx) => {
      if (token.trim().length > 0) {
        words.push({
          text: token,
          globalIndex,
          segmentIndex: segIdx,
          localIndex: localIdx,
          isSpoken: false,
        });
        globalIndex++;
      }
    });
  });
  return words;
}

export function TeleprompterDisplay({
  segments,
  currentWordIndex,
  corrections,
  onWordLayout,
  isGenerating,
}: TeleprompterDisplayProps) {
  const words = segmentToWords(segments);
  const correctionMap = new Map(corrections.map((c) => [c.wordIndex, c]));

  const handleWordLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { y } = event.nativeEvent.layout;
      onWordLayout(index, y);
    },
    [onWordLayout]
  );

  if (words.length === 0) {
    return (
      <ThemedView style={styles.empty}>
        <ThemedText themeColor="textSecondary">🌱 No dialogue yet.</ThemedText>
      </ThemedView>
    );
  }

  const segmentWords: Word[][] = [];
  segments.forEach((_, segIdx) => {
    segmentWords.push(words.filter((w) => w.segmentIndex === segIdx));
  });

  return (
    <View style={styles.container}>
      {segmentWords.map((segWords, segIdx) => {
        const segment = segments[segIdx];
        const isAi = segment.speaker === 'ai';
        const palette = NookPalette[segIdx % NookPalette.length];

        return (
          <View
            key={segment.id}
            style={[styles.segmentRow, isAi ? styles.aiRow : styles.userRow]}
          >
            <View
              style={[
                styles.bubble,
                isAi ? styles.aiBubble : styles.userBubble,
                { backgroundColor: palette.bg },
              ]}
            >
              <ThemedText
                type="smallBold"
                style={[styles.speakerLabel, { color: palette.text }]}
              >
                {isAi ? '🐻 AI' : '👤 You'}
              </ThemedText>
              <View style={styles.textRow}>
                {segWords.map((word) => {
                  const isSpoken = word.globalIndex <= currentWordIndex;
                  const isCurrent = word.globalIndex === currentWordIndex;
                  const correction = correctionMap.get(word.globalIndex);

                  return (
                    <View
                      key={word.globalIndex}
                      onLayout={handleWordLayout(word.globalIndex)}
                      style={[
                        styles.wordWrap,
                        isSpoken && styles.spokenWrap,
                        isCurrent && styles.currentWrap,
                        correction && styles.errorWrap,
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.word,
                          { color: palette.text },
                          isSpoken && styles.spokenText,
                          isCurrent && styles.currentText,
                        ]}
                      >
                        {word.text}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        );
      })}

      {isGenerating && (
        <View style={styles.loadingRow}>
          <ThemedText type="small" themeColor="textSecondary">
            🌱 Growing next part...
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  empty: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  segmentRow: {
    flexDirection: 'row',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  bubble: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    maxWidth: '88%',
    gap: Spacing.xs,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  aiBubble: {
    borderBottomLeftRadius: Spacing.xs,
  },
  userBubble: {
    borderBottomRightRadius: Spacing.xs,
  },
  speakerLabel: {
    opacity: 0.7,
    letterSpacing: 0.02,
  },
  textRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  wordWrap: {
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 4,
  },
  word: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
  },
  spokenWrap: {
    backgroundColor: 'rgba(111, 186, 44, 0.25)',
    borderRadius: 6,
  },
  spokenText: {
    fontWeight: '800',
  },
  currentWrap: {
    backgroundColor: 'rgba(245, 195, 28, 0.35)',
    borderRadius: 6,
  },
  currentText: {
    fontWeight: '800',
  },
  errorWrap: {
    borderBottomWidth: 2.5,
    borderBottomColor: '#e05a5a',
    borderRadius: 2,
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
});
