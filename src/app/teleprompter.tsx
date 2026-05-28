import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TeleprompterDisplay } from '@/components/teleprompter-display';
import { Spacing, Radius, Shadows, MaxContentWidth } from '@/constants/theme';
import { useApp } from '@/contexts/app-context';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { useWordMatcher } from '@/hooks/use-word-matcher';
import { generateDialogue } from '@/services/openai';

const AUTO_CONTINUE_THRESHOLD = 8;

export default function TeleprompterScreen() {
  const router = useRouter();
  const { apiKey, scene, segments, appendSegments, isGenerating, setIsGenerating } = useApp();
  const [isReading, setIsReading] = useState(false);
  const [btnPressed, setBtnPressed] = useState(false);
  const [resetPressed, setResetPressed] = useState(false);
  const [blinkVisible, setBlinkVisible] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const wordPositionsRef = useRef<Map<number, number>>(new Map());
  const fetchingRef = useRef(false);

  // Blinking dot for listening indicator
  useEffect(() => {
    if (!isReading) return;
    const interval = setInterval(() => setBlinkVisible((v) => !v), 600);
    return () => clearInterval(interval);
  }, [isReading]);

  const allWords = useMemo(() => {
    return segments.flatMap((seg, segIdx) => {
      const words = seg.text.match(/\S+\s*|\s+/g) || [];
      let globalIdx = 0;
      for (let i = 0; i < segIdx; i++) {
        const prevWords = segments[i].text.match(/\S+/g) || [];
        globalIdx += prevWords.length;
      }
      return words
        .filter((t) => t.trim().length > 0)
        .map((text, localIdx) => ({
          text,
          globalIndex: globalIdx + localIdx,
          segmentIndex: segIdx,
          localIndex: localIdx,
          isSpoken: false,
        }));
    });
  }, [segments]);

  const { currentWordIndex, corrections, updateProgress, resetProgress } = useWordMatcher(allWords);

  const totalWords = useMemo(
    () => segments.reduce((sum, seg) => sum + (seg.text.match(/\S+/g) || []).length, 0),
    [segments]
  );

  const handleSpeechResult = useCallback(
    (text: string) => {
      updateProgress(text);
    },
    [updateProgress]
  );

  const { isListening, hasPermission } = useSpeechRecognition({
    onResult: handleSpeechResult,
    enabled: isReading,
  });

  // Auto-scroll
  useEffect(() => {
    if (currentWordIndex < 0) return;
    const y = wordPositionsRef.current.get(currentWordIndex);
    if (y == null || !scrollViewRef.current) return;

    scrollViewRef.current.scrollTo({
      y: Math.max(0, y - 200),
      animated: true,
    });
  }, [currentWordIndex]);

  // Auto-continue
  useEffect(() => {
    const wordsRemaining = totalWords - currentWordIndex;
    if (
      wordsRemaining <= AUTO_CONTINUE_THRESHOLD &&
      wordsRemaining > 0 &&
      !isGenerating &&
      !fetchingRef.current &&
      totalWords > 10
    ) {
      fetchingRef.current = true;
      setIsGenerating(true);
      generateDialogue(scene, apiKey, segments)
        .then((newSegments) => {
          appendSegments(newSegments);
        })
        .catch(() => {
          // Silent fail, will retry on next threshold check
        })
        .finally(() => {
          setIsGenerating(false);
          fetchingRef.current = false;
        });
    }
  }, [
    currentWordIndex,
    totalWords,
    isGenerating,
    scene,
    apiKey,
    segments,
    appendSegments,
    setIsGenerating,
  ]);

  const handleWordLayout = useCallback((index: number, y: number) => {
    wordPositionsRef.current.set(index, y);
  }, []);

  const handleToggleReading = useCallback(() => {
    if (isReading) {
      setIsReading(false);
    } else {
      resetProgress();
      setIsReading(true);
    }
  }, [isReading, resetProgress]);

  const handleRestart = useCallback(() => {
    setIsReading(false);
    resetProgress();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [resetProgress]);

  const handleBack = useCallback(() => {
    setIsReading(false);
    router.back();
  }, [router]);

  const progress = totalWords > 0 ? ((currentWordIndex + 1) / totalWords) * 100 : 0;
  const spokenCount = currentWordIndex >= 0 ? currentWordIndex + 1 : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack}>
            <ThemedText type="link" style={styles.backLink}>← Back</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.sceneTitle}>
            {scene}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.percent}>
            {Math.round(progress)}%
          </ThemedText>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.min(100, progress)}%` }]} />
        </View>

        {/* Word count */}
        <View style={styles.wordCountRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {spokenCount} / {totalWords} words
          </ThemedText>
        </View>

        {/* Teleprompter content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TeleprompterDisplay
            segments={segments}
            currentWordIndex={currentWordIndex}
            corrections={corrections}
            onWordLayout={handleWordLayout}
            isGenerating={isGenerating}
          />
        </ScrollView>

        {/* Listening indicator */}
        {isListening && (
          <View style={styles.listeningBar}>
            <View
              style={[
                styles.listeningDot,
                { opacity: blinkVisible ? 1 : 0.35 },
              ]}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.listeningText}>
              Listening... speak clearly
            </ThemedText>
          </View>
        )}

        {!hasPermission && (
          <View style={styles.permissionBar}>
            <ThemedText type="small" style={styles.permissionWarning}>
              🎤 Microphone permission required for speech recognition
            </ThemedText>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <Pressable
              onPress={handleRestart}
              onPressIn={() => setResetPressed(true)}
              onPressOut={() => setResetPressed(false)}
              style={styles.resetButtonWrap}
            >
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.resetButton,
                  resetPressed && styles.resetButtonActive,
                ]}
              >
                <ThemedText type="smallBold" style={styles.resetButtonText}>
                  🔄 Restart
                </ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable
              onPress={handleToggleReading}
              onPressIn={() => setBtnPressed(true)}
              onPressOut={() => setBtnPressed(false)}
              style={styles.mainControlWrap}
            >
              <ThemedView
                type={isReading ? 'error' : 'primary'}
                style={[
                  styles.controlButton,
                  btnPressed && styles.controlButtonActive,
                ]}
              >
                <ThemedText type="smallBold" style={styles.controlButtonText}>
                  {isReading ? '⏸ Pause' : '🎤 Start Speaking'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>

          {corrections.length > 0 && (
            <ThemedView type="backgroundContent" style={styles.correctionsPanel}>
              <ThemedText type="smallBold" style={styles.tipTitle}>🌿 Practice Tips</ThemedText>
              {corrections.slice(-3).map((c, i) => (
                <ThemedText key={i} type="small" themeColor="textSecondary">
                  Try &quot;{c.expected}&quot; (you said: {c.actual})
                </ThemedText>
              ))}
            </ThemedView>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  backLink: {
    fontSize: 16,
    width: 50,
  },
  sceneTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#794f27',
  },
  percent: {
    width: 40,
    textAlign: 'right',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#e6f9f6',
    marginHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#c4b89e',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6fba2c',
    borderRadius: Radius.pill,
  },
  wordCountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  listeningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(25, 200, 185, 0.08)',
    borderTopWidth: 1,
    borderTopColor: '#e6f9f6',
  },
  listeningDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#19c8b9',
  },
  listeningText: {
    fontWeight: '600',
  },
  permissionBar: {
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(224, 90, 90, 0.08)',
    borderTopWidth: 1,
    borderTopColor: '#f8d7da',
  },
  permissionWarning: {
    color: '#e05a5a',
    textAlign: 'center',
    fontWeight: '600',
  },
  controls: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderTopWidth: 2,
    borderTopColor: '#e6f9f6',
    backgroundColor: '#f8f8f0',
  },
  controlRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  resetButtonWrap: {
    width: 100,
  },
  resetButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#c4b89e',
    ...Shadows.btn,
  },
  resetButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  resetButtonText: {
    color: '#794f27',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.02,
  },
  mainControlWrap: {
    flex: 1,
  },
  controlButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: 'center',
    ...Shadows.btn,
  },
  controlButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  controlButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.02,
  },
  correctionsPanel: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.xs,
    borderWidth: 2,
    borderColor: '#c4b89e',
  },
  tipTitle: {
    color: '#794f27',
    letterSpacing: 0.02,
  },
});
