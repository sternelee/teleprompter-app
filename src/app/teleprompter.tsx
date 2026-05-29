import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TeleprompterDisplay } from '@/components/teleprompter-display';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useApp } from '@/contexts/app-context';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { useWordMatcher } from '@/hooks/use-word-matcher';
import { generateDialogue } from '@/services/openai';

const AUTO_CONTINUE_THRESHOLD = 8;
const CUE_PREVIEW_WORDS = 8;

type TeleprompterWord = {
  text: string;
  globalIndex: number;
  wordIndex: number;
  segmentIndex: number;
  localIndex: number;
  isSpoken: boolean;
};

function getSpeakerLabel(speaker?: 'ai' | 'user') {
  return speaker === 'user' ? 'You' : 'AI';
}

function getCuePreview(words: TeleprompterWord[], startIndex = 0) {
  const preview = words
    .slice(startIndex, startIndex + CUE_PREVIEW_WORDS)
    .map((word) => word.text.trim())
    .join(' ')
    .trim();

  if (!preview) {
    return '—';
  }

  return preview.length > 88 ? `${preview.slice(0, 85).trimEnd()}…` : preview;
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
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fetchingRef = useRef(false);

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
            wordIndex: index,
            segmentIndex,
            localIndex,
            isSpoken: false,
          };
        })
    );
  }, [segments]);

  const wordsBySegment = useMemo(() => {
    const grouped = segments.map(() => [] as TeleprompterWord[]);

    allWords.forEach((word) => {
      grouped[word.segmentIndex]?.push(word);
    });

    return grouped;
  }, [allWords, segments]);

  const {
    currentWordIndex,
    corrections,
    updateProgress,
    resetProgress,
  } = useWordMatcher(allWords);

  const handleSpeechResult = useCallback(
    (text: string) => {
      updateProgress(text);
    },
    [updateProgress]
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

  const totalWords = allWords.length;
  const spokenCount = currentWordIndex >= 0 ? Math.min(totalWords, currentWordIndex + 1) : 0;
  const remainingWords = Math.max(totalWords - spokenCount, 0);
  const progressPercent = totalWords > 0 ? (spokenCount / totalWords) * 100 : 0;
  const needsPermission = permissionResponse?.granted === false;
  const hasSessionProgress = spokenCount > 0 || corrections.length > 0;
  const activeWord = currentWordIndex >= 0 ? allWords[currentWordIndex] : undefined;
  const activeSegmentIndex =
    segments.length === 0 ? -1 : activeWord?.segmentIndex ?? 0;
  const nextSegment = activeSegmentIndex >= 0 ? segments[activeSegmentIndex + 1] : undefined;

  const currentCue = useMemo(() => {
    if (activeSegmentIndex < 0) {
      return { label: 'AI', text: 'Add a scene to start practicing.' };
    }

    const segmentWords = wordsBySegment[activeSegmentIndex] ?? [];
    const segment = segments[activeSegmentIndex];
    const startIndex = activeWord?.segmentIndex === activeSegmentIndex ? activeWord.localIndex : 0;

    return {
      label: getSpeakerLabel(segment?.speaker),
      text: getCuePreview(segmentWords, startIndex),
    };
  }, [activeSegmentIndex, activeWord, segments, wordsBySegment]);

  const nextCue = useMemo(() => {
    if (nextSegment) {
      const nextWords = wordsBySegment[activeSegmentIndex + 1] ?? [];

      return {
        label: getSpeakerLabel(nextSegment.speaker),
        text: getCuePreview(nextWords),
      };
    }

    if (isGenerating) {
      return { label: 'AI', text: 'Writing the next exchange…' };
    }

    return { label: 'Coach', text: 'You are on the final cue.' };
  }, [activeSegmentIndex, isGenerating, nextSegment, wordsBySegment]);

  const statusMeta = useMemo(() => {
    if (needsPermission) {
      return {
        label: 'Permission Needed',
        detail: 'Allow microphone access to practice out loud.',
        color: Colors.light.error,
        backgroundColor: Colors.light.backgroundElement,
      };
    }

    if (isGenerating) {
      return {
        label: 'Generating',
        detail: 'Adding fresh lines so the conversation keeps flowing.',
        color: Colors.light.primary,
        backgroundColor: Colors.light.primaryBg,
      };
    }

    if (isReading) {
      return {
        label: 'Listening',
        detail: isListening ? 'Follow the live cue and keep speaking.' : 'Warming up the microphone…',
        color: Colors.light.spoken,
        backgroundColor: Colors.light.backgroundSelected,
      };
    }

    if (hasSessionProgress) {
      return {
        label: 'Paused',
        detail: 'Resume anytime without losing your place.',
        color: Colors.light.current,
        backgroundColor: Colors.light.backgroundContent,
      };
    }

    return {
      label: 'Ready',
      detail: 'Start when you want to rehearse the scene.',
      color: Colors.light.text,
      backgroundColor: Colors.light.backgroundElement,
    };
  }, [hasSessionProgress, isGenerating, isListening, isReading, needsPermission]);

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
    if (currentWordIndex < 0 || !scrollViewRef.current || totalWords === 0) {
      return;
    }

    const scrollableHeight = Math.max(contentHeight - viewportHeight, 0);

    if (scrollableHeight <= 0) {
      return;
    }

    const progressRatio = totalWords > 1 ? currentWordIndex / (totalWords - 1) : 0;
    const targetY = Math.max(
      0,
      Math.min(scrollableHeight, scrollableHeight * progressRatio - viewportHeight * 0.18)
    );

    scrollViewRef.current.scrollTo({ y: targetY, animated: true });
  }, [contentHeight, currentWordIndex, totalWords, viewportHeight]);

  useEffect(() => {
    const wordsRemaining = totalWords - currentWordIndex;

    if (
      !scene ||
      !apiKey ||
      isGenerating ||
      fetchingRef.current ||
      wordsRemaining > AUTO_CONTINUE_THRESHOLD ||
      wordsRemaining <= 0
    ) {
      return;
    }

    fetchingRef.current = true;
    void generateDialogue(scene, apiKey, segments)
      .then((newSegments) => {
        if (newSegments.length > 0) {
          appendSegments(newSegments);
        }
      })
      .catch((error: unknown) => {
        console.warn('Failed to auto-continue dialogue:', error);
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  }, [appendSegments, apiKey, currentWordIndex, isGenerating, scene, segments, totalWords]);

  useEffect(() => {
    return () => {
      void stopListening();
    };
  }, [stopListening]);

  const handleToggleReading = useCallback(async () => {
    if (isReading) {
      setIsReading(false);
      setBlinkVisible(true);
      setSpeechError(null);
      await stopListening();
      return;
    }

    setSpeechError(null);

    if (!permissionResponse?.granted) {
      const permission = await requestPermission();

      if (!permission.granted) {
        setIsReading(false);
        setSpeechError('Microphone permission is required to keep practicing.');
        return;
      }
    }

    setBlinkVisible(true);
    setIsReading(true);
    await startListening();
  }, [isReading, permissionResponse?.granted, requestPermission, startListening, stopListening]);

  const handleRestart = useCallback(() => {
    setIsReading(false);
    setBlinkVisible(true);
    setSpeechError(null);
    void stopListening();
    resetProgress();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [resetProgress, stopListening]);

  const handleBack = useCallback(() => {
    setIsReading(false);
    setBlinkVisible(true);
    void stopListening();
    router.back();
  }, [router, stopListening]);

  const primaryActionLabel = isReading
    ? '⏸ Pause'
    : needsPermission
      ? '🎤 Enable Mic'
      : hasSessionProgress
        ? '▶️ Resume Listening'
        : '🎤 Start Speaking';

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={8}>
          <ThemedText style={styles.backButton}>← Back</ThemedText>
        </Pressable>
        <ThemedText style={styles.title}>Teleprompter Practice</ThemedText>
      </View>

      <View style={styles.content}>
        <ThemedView type="backgroundContent" style={styles.sceneCard}>
          <ThemedText type="small" style={styles.sceneLabel}>
            Scene
          </ThemedText>
          <ThemedText style={styles.sceneText}>{scene}</ThemedText>
        </ThemedView>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        <ThemedView type="backgroundContent" style={styles.coachPanel}>
          <View style={styles.coachHeader}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusMeta.backgroundColor },
              ]}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusMeta.color, opacity: isReading ? (blinkVisible ? 1 : 0.45) : 1 },
                ]}
              />
              <ThemedText type="smallBold" style={styles.statusText}>
                {statusMeta.label}
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.statusDetail}>
              {speechError ?? statusMeta.detail}
            </ThemedText>
          </View>

          <View style={styles.metricRow}>
            <ThemedView type="backgroundElement" style={styles.metricCard}>
              <ThemedText type="small" style={styles.metricLabel}>
                Spoken
              </ThemedText>
              <ThemedText type="title" style={styles.metricValue}>
                {spokenCount}
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.metricCard}>
              <ThemedText type="small" style={styles.metricLabel}>
                Remaining
              </ThemedText>
              <ThemedText type="title" style={styles.metricValue}>
                {remainingWords}
              </ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.metricCard}>
              <ThemedText type="small" style={styles.metricLabel}>
                Corrections
              </ThemedText>
              <ThemedText type="title" style={styles.metricValue}>
                {corrections.length}
              </ThemedText>
            </ThemedView>
          </View>

          <View style={styles.cueStack}>
            <ThemedView type="backgroundElement" style={styles.cueCard}>
              <ThemedText type="small" style={styles.cueLabel}>
                Current cue · {currentCue.label}
              </ThemedText>
              <ThemedText style={styles.cueText}>{currentCue.text}</ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.cueCard}>
              <ThemedText type="small" style={styles.cueLabel}>
                Next cue · {nextCue.label}
              </ThemedText>
              <ThemedText style={styles.cueText}>{nextCue.text}</ThemedText>
            </ThemedView>
          </View>
        </ThemedView>

        <ScrollView
          ref={scrollViewRef}
          style={styles.teleprompterContainer}
          contentContainerStyle={styles.teleprompterContent}
          onContentSizeChange={(_, height) => setContentHeight(height)}
          onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}>
          <TeleprompterDisplay
            corrections={corrections}
            currentWordIndex={currentWordIndex}
            segments={segments}
            words={allWords}
            activeSegmentIndex={activeSegmentIndex}
          />
        </ScrollView>

        {generationError ? (
          <ThemedText style={styles.errorText}>{generationError}</ThemedText>
        ) : null}

        <View style={styles.controls}>
          <Pressable
            onPress={handleToggleReading}
            onPressIn={() => setBtnPressed(true)}
            onPressOut={() => setBtnPressed(false)}>
            <ThemedView
              type={isReading ? 'error' : 'primary'}
              style={[
                styles.controlButton,
                btnPressed && styles.controlButtonActive,
              ]}>
              <ThemedText type="default" weight="700" style={styles.controlButtonText}>
                {primaryActionLabel}
              </ThemedText>
            </ThemedView>
          </Pressable>

          <Pressable
            onPress={handleRestart}
            onPressIn={() => setResetPressed(true)}
            onPressOut={() => setResetPressed(false)}>
            <ThemedView
              type="backgroundElement"
              style={[
                styles.secondaryButton,
                resetPressed && styles.secondaryButtonActive,
              ]}>
              <ThemedText type="default" weight="700" style={styles.secondaryButtonText}>
                🔄 Restart
              </ThemedText>
            </ThemedView>
          </Pressable>
        </View>

        {corrections.length > 0 ? (
          <ThemedView type="backgroundContent" style={styles.correctionsBox}>
            <ThemedText type="smallBold" style={styles.correctionsTitle}>
              Practice Tips
            </ThemedText>
            {corrections.slice(-3).map((correction, index) => (
              <ThemedText key={index} type="small" style={styles.correctionText}>
                • Remember: <ThemedText type="default" weight="700">{correction.expected}</ThemedText>
              </ThemedText>
            ))}
          </ThemedView>
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    backgroundColor: '#f6f3e8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    color: '#19c8b9',
    fontSize: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#794f27',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.md,
  },
  sceneCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  sceneLabel: {
    color: '#8a6d46',
    marginBottom: Spacing.xs,
  },
  sceneText: {
    fontSize: 17,
    lineHeight: 24,
    color: '#794f27',
  },
  progressBar: {
    height: 10,
    backgroundColor: '#e5dbc8',
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6fba2c',
    borderRadius: Radius.pill,
  },
  coachPanel: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.md,
    ...Shadows.card,
  },
  coachHeader: {
    gap: Spacing.sm,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
  statusText: {
    color: '#794f27',
  },
  statusDetail: {
    color: '#8a6d46',
    lineHeight: 18,
  },
  metricRow: {
    flexDirection: 'row',
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
    color: '#8a6d46',
  },
  metricValue: {
    color: '#794f27',
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
    color: '#8a6d46',
  },
  cueText: {
    color: '#794f27',
    fontSize: 15,
    lineHeight: 22,
  },
  teleprompterContainer: {
    flex: 1,
  },
  teleprompterContent: {
    paddingBottom: Spacing.xl,
  },
  errorText: {
    color: '#e05a5a',
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  controlButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    minWidth: 180,
    alignItems: 'center',
    ...Shadows.btn,
  },
  controlButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  controlButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: 'center',
    ...Shadows.btn,
  },
  secondaryButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  secondaryButtonText: {
    color: '#794f27',
  },
  correctionsBox: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  correctionsTitle: {
    marginBottom: Spacing.sm,
    color: '#794f27',
  },
  correctionText: {
    color: '#8a6d46',
    marginBottom: 4,
  },
});
