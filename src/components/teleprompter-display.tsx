import { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  Pressable,
  Platform,
} from 'react-native';

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
    tokens.forEach((token, _localIdx) => {
      if (token.trim().length > 0) {
        words.push({
          text: token,
          globalIndex,
          segmentIndex: segIdx,
          localIndex: _localIdx,
          isSpoken: false,
        });
        globalIndex++;
      }
    });
  });
  return words;
}

function speakText(text: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
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
  const [pressedTts, setPressedTts] = useState<number | null>(null);

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
              <View style={styles.bubbleHeader}>
                <ThemedText
                  type="smallBold"
                  style={[styles.speakerLabel, { color: palette.text }]}
                >
                  {isAi ? '🐻 AI' : '👤 You'}
                </ThemedText>
                {isAi && (
                  <Pressable
                    onPress={() => speakText(segment.text)}
                    onPressIn={() => setPressedTts(segIdx)}
                    onPressOut={() => setPressedTts(null)}
                    hitSlop={8}
                  >
                    <ThemedText
                      style={[
                        styles.ttsButton,
                        pressedTts === segIdx && styles.ttsButtonPressed,
                      ]}
                    >
                      🔊
                    </ThemedText>
                  </Pressable>
                )}
              </View>
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
          <View style={styles.loadingDots}>
            <View style={[styles.loadingDot, styles.loadingDot1]} />
            <View style={[styles.loadingDot, styles.loadingDot2]} />
            <View style={[styles.loadingDot, styles.loadingDot3]} />
          </View>
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
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speakerLabel: {
    opacity: 0.7,
    letterSpacing: 0.02,
  },
  ttsButton: {
    fontSize: 16,
    opacity: 0.6,
  },
  ttsButtonPressed: {
    opacity: 1,
    transform: [{ scale: 1.2 }],
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
    backgroundColor: 'rgba(245, 195, 28, 0.45)',
    borderRadius: 6,
    transform: [{ scale: 1.05 }],
  },
  currentText: {
    fontWeight: '900',
    fontSize: 20,
  },
  errorWrap: {
    borderBottomWidth: 2.5,
    borderBottomColor: '#e05a5a',
    borderRadius: 2,
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#19c8b9',
  },
  loadingDot1: {
    opacity: 0.4,
  },
  loadingDot2: {
    opacity: 0.7,
  },
  loadingDot3: {
    opacity: 1,
  },
});
