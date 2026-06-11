import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Radius, Shadows, Spacing } from "@/constants/theme";
import { useApp } from "@/contexts/app-context";
import { generateDialogue } from "@/services/openai";

const MAX_CONTENT_WIDTH = 880;

const promptSuggestions = [
  {
    label: "Coffee run",
    scene:
      "Ordering coffee at a busy cafe before work while asking for a smaller cup size.",
  },
  {
    label: "Job intro",
    scene: "Introducing yourself to a new teammate on your first day at work.",
  },
  {
    label: "Hotel check-in",
    scene: "Checking into a hotel late at night after a delayed flight.",
  },
  {
    label: "Doctor visit",
    scene:
      "Explaining a mild headache and asking for advice at a clinic reception desk.",
  },
];

const practiceSteps = [
  {
    title: "Describe the moment",
    detail: "Name the place, roles, and your goal.",
  },
  {
    title: "Generate your lines",
    detail: "DeepSeek builds a natural back-and-forth scene.",
  },
  {
    title: "Speak with cues",
    detail: "Practice aloud with live highlighting and prompts.",
  },
];

function getSceneReadiness(scene: string) {
  const wordCount = scene.split(/\s+/).filter(Boolean).length;

  if (!scene) {
    return {
      detail:
        "Add a real-life situation so the AI can build a useful speaking script.",
      label: "Waiting",
      tone: "neutral" as const,
    };
  }

  if (wordCount >= 9) {
    return {
      detail: "Nice. You gave enough context for a realistic dialogue.",
      label: "Ready",
      tone: "success" as const,
    };
  }

  if (wordCount >= 5) {
    return {
      detail: "Good start. Add one more detail like urgency, tone, or goal.",
      label: "Almost",
      tone: "warning" as const,
    };
  }

  return {
    detail: "Try adding who you are talking to and what you want to achieve.",
    label: "Need detail",
    tone: "warning" as const,
  };
}

function shortenScene(scene: string) {
  if (scene.length <= 120) {
    return scene;
  }

  return `${scene.slice(0, 117).trimEnd()}...`;
}

export default function HomeScreen() {
  const {
    apiKey,
    generationError,
    isGenerating,
    scene,
    setGenerationError,
    setIsGenerating,
    setScene,
    setSegments,
  } = useApp();
  const [generatePressed, setGeneratePressed] = useState(false);
  const [settingsPressed, setSettingsPressed] = useState(false);

  const trimmedScene = scene.trim();
  const readiness = useMemo(
    () => getSceneReadiness(trimmedScene),
    [trimmedScene],
  );

  const handleSceneChange = useCallback(
    (value: string) => {
      setScene(value);

      if (generationError) {
        setGenerationError(null);
      }
    },
    [generationError, setGenerationError, setScene],
  );

  const handleSuggestionPress = useCallback(
    (nextScene: string) => {
      handleSceneChange(nextScene);
    },
    [handleSceneChange],
  );

  const handleGenerate = useCallback(async () => {
    const nextScene = trimmedScene;

    if (!apiKey) {
      setGenerationError(
        "Add your DeepSeek API key in Settings before generating a scene.",
      );
      router.push("/settings");
      return;
    }

    if (!nextScene) {
      setGenerationError(
        "Describe a speaking scene before generating dialogue.",
      );
      return;
    }

    setGenerationError(null);
    setIsGenerating(true);
    setScene(nextScene);

    try {
      const nextSegments = await generateDialogue(nextScene, apiKey);
      setSegments(nextSegments);
      router.push("/teleprompter");
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Could not generate dialogue. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [
    apiKey,
    setGenerationError,
    setIsGenerating,
    setScene,
    setSegments,
    trimmedScene,
  ]);

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ThemedView style={styles.page}>
        <ThemedView style={styles.heroCard}>
          <ThemedView style={styles.heroBadge}>
            <ThemedText style={styles.heroBadgeText}>AI scene coach</ThemedText>
          </ThemedView>

          <ThemedText type="title" style={styles.title}>
            Practice real conversations before they happen.
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Turn a scene into a guided English role-play, then speak through it
            with a live teleprompter.
          </ThemedText>

          <View style={styles.stepsRow}>
            {practiceSteps.map((step, index) => (
              <ThemedView key={step.title} style={styles.stepCard}>
                <ThemedView style={styles.stepNumber}>
                  <ThemedText style={styles.stepNumberText}>
                    {index + 1}
                  </ThemedText>
                </ThemedView>
                <ThemedText type="default" weight="700" style={styles.stepTitle}>
                  {step.title}
                </ThemedText>
                <ThemedText style={styles.stepDetail}>{step.detail}</ThemedText>
              </ThemedView>
            ))}
          </View>
        </ThemedView>

        <ThemedView style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.headerCopy}>
              <ThemedText type="subtitle" style={styles.panelTitle}>
                Build your practice scene
              </ThemedText>
              <ThemedText style={styles.panelDescription}>
                The more specific your scene is, the more natural and useful the
                dialogue becomes.
              </ThemedText>
            </View>

            <ThemedView
              style={[
                styles.statusPill,
                readiness.tone === "success"
                  ? styles.statusPillSuccess
                  : readiness.tone === "warning"
                    ? styles.statusPillWarning
                    : styles.statusPillNeutral,
              ]}
            >
              <ThemedText style={styles.statusPillText}>
                {readiness.label}
              </ThemedText>
            </ThemedView>
          </View>

          <TextInput
            multiline
            onChangeText={handleSceneChange}
            placeholder="e.g. Ordering coffee before a meeting, asking for oat milk, and checking if the cup size is smaller."
            placeholderTextColor="rgba(121, 79, 39, 0.45)"
            style={styles.sceneInput}
            textAlignVertical="top"
            value={scene}
          />

          <ThemedText style={styles.helperText}>{readiness.detail}</ThemedText>

          {trimmedScene ? (
            <ThemedView style={styles.previewCard}>
              <ThemedText type="default" weight="700" style={styles.previewTitle}>
                Practice preview
              </ThemedText>
              <ThemedText style={styles.previewBody}>
                {shortenScene(trimmedScene)}
              </ThemedText>
              <View style={styles.previewMetaRow}>
                <ThemedText style={styles.previewMeta}>
                  Scene saved for this session
                </ThemedText>
                <ThemedText style={styles.previewMeta}>
                  {trimmedScene.split(/\s+/).filter(Boolean).length} words
                </ThemedText>
              </View>
            </ThemedView>
          ) : null}

          <View style={styles.suggestionsWrap}>
            {promptSuggestions.map((suggestion) => (
              <Pressable
                key={suggestion.label}
                onPress={() => handleSuggestionPress(suggestion.scene)}
                style={styles.suggestionPressable}
              >
                <ThemedView style={styles.suggestionChip}>
                  <ThemedText style={styles.suggestionText}>
                    {suggestion.label}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </View>
        </ThemedView>

        <ThemedView style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.headerCopy}>
              <ThemedText type="subtitle" style={styles.panelTitle}>
                Session setup
              </ThemedText>
              <ThemedText style={styles.panelDescription}>
                Keep your API key in Settings, then jump into role-plays from
                here.
              </ThemedText>
            </View>

            <ThemedView
              style={[
                styles.statusPill,
                apiKey ? styles.statusPillSuccess : styles.statusPillWarning,
              ]}
            >
              <ThemedText style={styles.statusPillText}>
                {apiKey ? "Configured" : "Required"}
              </ThemedText>
            </ThemedView>
          </View>

          <ThemedText style={styles.sessionBody}>
            {apiKey
              ? "Your key is ready. Generate a scene when the prompt feels realistic enough to rehearse."
              : "Add your DeepSeek API key once so dialogue generation is ready when inspiration hits."}
          </ThemedText>

          <Pressable
            onPress={() => router.push("/settings")}
            onPressIn={() => setSettingsPressed(true)}
            onPressOut={() => setSettingsPressed(false)}
          >
            <ThemedView
              style={[
                styles.secondaryButton,
                settingsPressed && styles.secondaryButtonPressed,
              ]}
            >
              <ThemedText style={styles.secondaryButtonText}>
                Open Settings
              </ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>

        {generationError ? (
          <ThemedView style={styles.errorCard}>
            <ThemedText style={styles.errorTitle}>
              Something needs attention
            </ThemedText>
            <ThemedText style={styles.errorBody}>{generationError}</ThemedText>
          </ThemedView>
        ) : null}

        <Pressable
          disabled={isGenerating}
          onPress={handleGenerate}
          onPressIn={() => setGeneratePressed(true)}
          onPressOut={() => setGeneratePressed(false)}
        >
          <ThemedView
            style={[
              styles.primaryButton,
              (generatePressed || isGenerating) && styles.primaryButtonPressed,
              isGenerating && styles.primaryButtonDisabled,
            ]}
          >
            <ThemedText style={styles.primaryButtonText}>
              {isGenerating
                ? "Generating dialogue..."
                : "Start speaking practice"}
            </ThemedText>
          </ThemedView>
        </Pressable>

        <ThemedText style={styles.footerNote}>
          Tip: mention the place, relationship, and your goal for better
          follow-up lines and more realistic speaking turns.
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  errorBody: {
    color: Colors.light.text,
    fontSize: 15,
    lineHeight: 22,
  },
  errorCard: {
    backgroundColor: "#fff0f0",
    borderColor: "rgba(224, 90, 90, 0.24)",
    borderRadius: Radius.base,
    borderWidth: 1,
    gap: Spacing.xs,
    padding: Spacing.lg,
    width: "100%",
  },
  errorTitle: {
    color: Colors.light.error,
    fontSize: 16,
    fontWeight: "800",
  },
  footerNote: {
    color: "rgba(121, 79, 39, 0.72)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  helperText: {
    color: "rgba(121, 79, 39, 0.72)",
    fontSize: 14,
    lineHeight: 20,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(25, 200, 185, 0.12)",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: Colors.light.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroCard: {
    backgroundColor: "#fff9ef",
    borderRadius: Radius.lg,
    gap: Spacing.md,
    padding: Spacing.xl,
    width: "100%",
    ...Shadows.card,
  },
  page: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.lg,
    maxWidth: MAX_CONTENT_WIDTH,
    width: "100%",
  },
  panel: {
    backgroundColor: Colors.light.backgroundContent,
    borderRadius: Radius.lg,
    gap: Spacing.md,
    padding: Spacing.xl,
    width: "100%",
    ...Shadows.card,
  },
  panelDescription: {
    color: "rgba(121, 79, 39, 0.72)",
    fontSize: 14,
    lineHeight: 20,
  },
  panelHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  panelTitle: {
    color: Colors.light.text,
  },
  previewBody: {
    color: Colors.light.text,
    fontSize: 15,
    lineHeight: 22,
  },
  previewCard: {
    backgroundColor: "#f8fff7",
    borderColor: "rgba(111, 186, 44, 0.16)",
    borderRadius: Radius.base,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  previewMeta: {
    color: "rgba(121, 79, 39, 0.62)",
    fontSize: 13,
    fontWeight: "700",
  },
  previewMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  previewTitle: {
    color: "#4f7f2c",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: Colors.light.primary,
    borderRadius: Radius.pill,
    minWidth: 280,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    ...Shadows.btn,
  },
  primaryButtonDisabled: {
    opacity: 0.82,
  },
  primaryButtonPressed: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  sceneInput: {
    backgroundColor: Colors.light.background,
    borderColor: "rgba(121, 79, 39, 0.14)",
    borderRadius: Radius.base,
    borderWidth: 1,
    color: Colors.light.text,
    fontSize: 18,
    lineHeight: 28,
    minHeight: 150,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  scrollContent: {
    alignItems: "center",
    backgroundColor: Colors.light.background,
    minHeight: "100%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#f1ead7",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Shadows.btn,
  },
  secondaryButtonPressed: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  secondaryButtonText: {
    color: Colors.light.text,
    fontSize: 15,
    fontWeight: "800",
  },
  sessionBody: {
    color: Colors.light.text,
    fontSize: 15,
    lineHeight: 22,
  },
  statusPill: {
    alignItems: "center",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  statusPillNeutral: {
    backgroundColor: "#ece6d8",
  },
  statusPillSuccess: {
    backgroundColor: "rgba(111, 186, 44, 0.16)",
  },
  statusPillText: {
    color: Colors.light.text,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  statusPillWarning: {
    backgroundColor: "rgba(255, 209, 102, 0.24)",
  },
  stepCard: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: Radius.base,
    flex: 1,
    gap: Spacing.xs,
    minWidth: 180,
    padding: Spacing.lg,
  },
  stepDetail: {
    color: "rgba(121, 79, 39, 0.72)",
    fontSize: 14,
    lineHeight: 20,
  },
  stepNumber: {
    alignItems: "center",
    backgroundColor: Colors.light.primary,
    borderRadius: Radius.pill,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  stepNumberText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  stepTitle: {
    color: Colors.light.text,
    fontSize: 16,
  },
  stepsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  subtitle: {
    color: "rgba(121, 79, 39, 0.78)",
    fontSize: 16,
    lineHeight: 24,
  },
  suggestionChip: {
    backgroundColor: "#f1ead7",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  suggestionPressable: {
    marginBottom: Spacing.sm,
  },
  suggestionText: {
    color: Colors.light.text,
    fontSize: 14,
    fontWeight: "700",
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  title: {
    color: Colors.light.text,
    maxWidth: 680,
  },
});
