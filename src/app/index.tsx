import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Radius, Shadows, MaxContentWidth } from '@/constants/theme';
import { useApp } from '@/contexts/app-context';
import { generateDialogue } from '@/services/openai';

const SCENE_SUGGESTIONS = [
  '☕ Ordering coffee at Starbucks',
  '💼 Job interview',
  '✈️ At the airport',
  '🏨 Hotel check-in',
  '🍜 Ordering at a restaurant',
  '🛒 Grocery shopping',
];

export default function SceneInputScreen() {
  const router = useRouter();
  const { apiKey, setApiKey, setScene, setSegments, isGenerating, setIsGenerating, setGenerationError, generationError } = useApp();
  const [inputScene, setInputScene] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);
  const [buttonPressed, setButtonPressed] = useState(false);

  const handleStart = async () => {
    if (!inputScene.trim()) return;
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setScene(inputScene.trim());

    try {
      const segments = await generateDialogue(inputScene.trim(), apiKey);
      setSegments(segments);
      router.push('/teleprompter');
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Failed to generate dialogue');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setInputScene(suggestion);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoider}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Decorative top leaf */}
            <View style={styles.leafDecoration}>
              <ThemedText style={styles.leafEmoji}>🌿</ThemedText>
            </View>

            <ThemedText type="title" style={styles.title}>
              Speaking Practice
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary" style={styles.subtitle}>
              Enter a scene and practice speaking English with AI-powered dialogue
            </ThemedText>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContainer}
            >
              {SCENE_SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => handleSuggestionPress(suggestion)}
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <ThemedText type="small" style={styles.chipText}>
                    {suggestion}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {showKeyInput ? (
              <ThemedView type="backgroundContent" style={styles.card}>
                <ThemedText type="smallBold" style={styles.cardTitle}>
                  🔑 BigModel API Key
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="sk-..."
                  placeholderTextColor="#c4b89e"
                  value={apiKey}
                  onChangeText={setApiKey}
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setShowKeyInput(false)}
                  onPressIn={() => setButtonPressed(true)}
                  onPressOut={() => setButtonPressed(false)}
                >
                  <ThemedView
                    type="primary"
                    style={[
                      styles.pillButton,
                      buttonPressed && styles.pillButtonActive,
                    ]}
                  >
                    <ThemedText type="smallBold" style={styles.pillButtonText}>
                      Done
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </ThemedView>
            ) : (
              <View style={styles.keyLinkContainer}>
                <Pressable onPress={() => setShowKeyInput(true)}>
                  <ThemedText type="link" style={styles.link}>
                    {apiKey ? '🔑 API Key configured ✓' : '🔑 Configure API Key'}
                  </ThemedText>
                </Pressable>
                {apiKey ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.keyHelper}>
                    Using BigModel GLM-4.7-Flash
                  </ThemedText>
                ) : null}
              </View>
            )}

            <ThemedView type="backgroundContent" style={styles.card}>
              <ThemedText type="smallBold" style={styles.cardTitle}>
                🎭 Scene Description
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g., ordering coffee at Starbucks"
                placeholderTextColor="#c4b89e"
                value={inputScene}
                onChangeText={setInputScene}
                multiline
                numberOfLines={3}
              />
            </ThemedView>

            <Pressable
              onPress={handleStart}
              disabled={isGenerating || !inputScene.trim()}
              onPressIn={() => setButtonPressed(true)}
              onPressOut={() => setButtonPressed(false)}
            >
              <ThemedView
                type={isGenerating || !inputScene.trim() ? 'backgroundElement' : 'primary'}
                style={[
                  styles.mainButton,
                  (isGenerating || !inputScene.trim()) && styles.mainButtonDisabled,
                  buttonPressed && !isGenerating && inputScene.trim() && styles.mainButtonActive,
                ]}
              >
                {isGenerating ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator size="small" color="#fff" />
                    <ThemedText type="smallBold" style={styles.mainButtonText}>
                      {' '}🌱 Generating...
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText type="smallBold" style={styles.mainButtonText}>
                    🎤 Start Practice
                  </ThemedText>
                )}
              </ThemedView>
            </Pressable>

            {generationError && (
              <ThemedText style={styles.error}>{generationError}</ThemedText>
            )}

            {/* Decorative bottom */}
            <View style={styles.bottomDecoration}>
              <ThemedText style={styles.leafEmoji}>🍃 🌸 🍃</ThemedText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  },
  keyboardAvoider: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  leafDecoration: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  leafEmoji: {
    fontSize: 28,
    lineHeight: 36,
  },
  title: {
    textAlign: 'center',
    color: '#794f27',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  chipsContainer: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  chip: {
    backgroundColor: '#eaddc5',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: '#c4b89e',
    marginRight: Spacing.sm,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    color: '#725d42',
    fontWeight: '600',
  },
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: '#c4b89e',
    marginBottom: Spacing.md,
    ...Shadows.input,
  },
  cardTitle: {
    color: '#794f27',
    letterSpacing: 0.02,
  },
  input: {
    borderWidth: 2.5,
    borderColor: '#c4b89e',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '500',
    color: '#725d42',
    backgroundColor: '#f7f3df',
    ...Shadows.input,
  },
  textArea: {
    minHeight: 90,
    borderRadius: Radius.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    textAlignVertical: 'top',
  },
  pillButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: Spacing.sm,
    ...Shadows.btn,
  },
  pillButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  pillButtonText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.02,
  },
  mainButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.btn,
  },
  mainButtonDisabled: {
    opacity: 0.6,
  },
  mainButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  mainButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.02,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLinkContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  link: {
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  keyHelper: {
    textAlign: 'center',
    marginTop: -Spacing.xs,
  },
  error: {
    color: '#e05a5a',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  bottomDecoration: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
});
