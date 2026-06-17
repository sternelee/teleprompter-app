import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Radius, Shadows, Spacing } from "@/constants/theme";
import { useApp } from "@/contexts/app-context";
import { generateDialogue } from "@/services/openai";
import { formatRelativeTime } from "@/utils/time";

const MAX_CONTENT_WIDTH = 760;

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

const homeTabs = [
  {
    helper: "Write the moment",
    key: "scene",
    title: "Scene",
  },
  {
    helper: "Connect AI",
    key: "key",
    title: "Key",
  },
  {
    helper: "Check setup",
    key: "review",
    title: "Start",
  },
] as const;

type HomeTabKey = (typeof homeTabs)[number]["key"];

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
      detail: "Enough context for a natural role-play.",
      label: "Ready",
      tone: "success" as const,
    };
  }

  if (wordCount >= 5) {
    return {
      detail: "Add one more detail like urgency, tone, or your goal.",
      label: "Almost",
      tone: "warning" as const,
    };
  }

  return {
    detail: "Add who you are talking to and what you want to achieve.",
    label: "Need detail",
    tone: "warning" as const,
  };
}

function shortenScene(scene: string) {
  if (scene.length <= 128) {
    return scene;
  }

  return `${scene.slice(0, 125).trimEnd()}...`;
}

export default function HomeScreen() {
  const {
    apiKey,
    generationError,
    isGenerating,
    isLoadingApiKey,
    scene,
    sessions,
    startNewSession,
    loadSession,
    setGenerationError,
    setIsGenerating,
    setScene,
  } = useApp();
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const [activeTab, setActiveTab] = useState<HomeTabKey>("scene");
  const [backPressed, setBackPressed] = useState(false);
  const [primaryPressed, setPrimaryPressed] = useState(false);
  const [settingsPressed, setSettingsPressed] = useState(false);

  const trimmedScene = scene.trim();
  const hasScene = Boolean(trimmedScene);
  const hasApiKey = Boolean(apiKey);
  const readiness = useMemo(
    () => getSceneReadiness(trimmedScene),
    [trimmedScene],
  );
  const sceneWordCount = useMemo(
    () => trimmedScene.split(/\s+/).filter(Boolean).length,
    [trimmedScene],
  );
  const activeTabIndex = homeTabs.findIndex((tab) => tab.key === activeTab);

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
      setActiveTab("scene");
    },
    [handleSceneChange],
  );

  const handleGenerate = useCallback(async () => {
    const nextScene = trimmedScene;

    if (!apiKey) {
      setGenerationError(
        "Add your DeepSeek API key in Settings before generating a scene.",
      );
      setActiveTab("key");
      return;
    }

    if (!nextScene) {
      setGenerationError(
        "Describe a speaking scene before generating dialogue.",
      );
      setActiveTab("scene");
      return;
    }

    setActiveTab("review");
    setGenerationError(null);
    setIsGenerating(true);
    setScene(nextScene);

    try {
      const nextSegments = await generateDialogue(nextScene, apiKey);
      startNewSession(nextScene, nextSegments);
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
    startNewSession,
    trimmedScene,
  ]);

  const handlePrimaryAction = useCallback(() => {
    if (activeTab === "scene") {
      if (!hasScene) {
        setGenerationError(
          "Describe a speaking scene before moving to setup.",
        );
        return;
      }

      setGenerationError(null);
      setActiveTab("key");
      return;
    }

    if (activeTab === "key") {
      if (!hasApiKey) {
        router.push("/settings");
        return;
      }

      setGenerationError(null);
      setActiveTab("review");
      return;
    }

    void handleGenerate();
  }, [
    activeTab,
    handleGenerate,
    hasApiKey,
    hasScene,
    setGenerationError,
  ]);

  const handleBack = useCallback(() => {
    if (activeTab === "review") {
      setActiveTab("key");
      return;
    }

    if (activeTab === "key") {
      setActiveTab("scene");
    }
  }, [activeTab]);

  const primaryActionLabel = useMemo(() => {
    if (activeTab === "scene") {
      return "Continue";
    }

    if (activeTab === "key") {
      if (isLoadingApiKey) {
        return "Loading key…";
      }
      return hasApiKey ? "Review setup" : "Add DeepSeek key";
    }

    return isGenerating ? "Generating dialogue..." : "Start speaking practice";
  }, [activeTab, hasApiKey, isGenerating, isLoadingApiKey]);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              isCompact && styles.scrollContentCompact,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ThemedView
              style={[styles.page, isCompact && styles.pageCompact]}
            >
              <View style={styles.header}>
                <ThemedView style={styles.heroBadge}>
                  <ThemedText style={styles.heroBadgeText}>
                    AI scene coach
                  </ThemedText>
                </ThemedView>

                <ThemedText
                  type="title"
                  style={[styles.title, isCompact && styles.titleCompact]}
                >
                  Build a speaking drill
                </ThemedText>
                <ThemedText
                  style={[styles.subtitle, isCompact && styles.subtitleCompact]}
                >
                  Write the moment, connect DeepSeek, then rehearse with live
                  cues.
                </ThemedText>
              </View>

              <View style={styles.tabBar}>
                {homeTabs.map((tab, index) => {
                  const isActive = tab.key === activeTab;
                  const isComplete =
                    tab.key === "scene"
                      ? hasScene
                      : tab.key === "key"
                        ? hasApiKey
                        : hasScene && hasApiKey;

                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setActiveTab(tab.key)}
                      style={styles.tabPressable}
                    >
                      <ThemedView
                        style={[
                          styles.tabItem,
                          isActive && styles.tabItemActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.tabNumber,
                            isComplete && styles.tabNumberComplete,
                            isActive && styles.tabNumberActive,
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.tabNumberText,
                              isActive && styles.tabNumberTextActive,
                            ]}
                          >
                            {index + 1}
                          </ThemedText>
                        </View>
                        <View style={styles.tabCopy}>
                          <ThemedText
                            style={[
                              styles.tabTitle,
                              isActive && styles.tabTitleActive,
                            ]}
                            numberOfLines={1}
                          >
                            {tab.title}
                          </ThemedText>
                          {!isCompact ? (
                            <ThemedText
                              style={styles.tabHelper}
                              numberOfLines={1}
                            >
                              {tab.helper}
                            </ThemedText>
                          ) : null}
                        </View>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedView style={styles.stepPanel}>
                <View style={styles.stepHeader}>
                  <View style={styles.headerCopy}>
                    <ThemedText style={styles.stepKicker}>
                      Step {activeTabIndex + 1} of {homeTabs.length}
                    </ThemedText>
                    <ThemedText type="subtitle" style={styles.panelTitle}>
                      {activeTab === "scene"
                        ? "Describe the scene"
                        : activeTab === "key"
                          ? "Connect DeepSeek"
                          : "Ready check"}
                    </ThemedText>
                  </View>

                  <ThemedView
                    style={[
                      styles.statusPill,
                      activeTab === "scene"
                        ? readiness.tone === "success"
                          ? styles.statusPillSuccess
                          : readiness.tone === "warning"
                            ? styles.statusPillWarning
                            : styles.statusPillNeutral
                        : activeTab === "key"
                          ? hasApiKey
                            ? styles.statusPillSuccess
                            : styles.statusPillWarning
                          : hasScene && hasApiKey
                            ? styles.statusPillSuccess
                            : styles.statusPillWarning,
                    ]}
                  >
                    <ThemedText style={styles.statusPillText}>
                      {activeTab === "scene"
                        ? readiness.label
                        : activeTab === "key"
                          ? hasApiKey
                            ? "Configured"
                            : "Required"
                          : hasScene && hasApiKey
                            ? "Ready"
                            : "Check"}
                    </ThemedText>
                  </ThemedView>
                </View>

                {activeTab === "scene" ? (
                  <View style={styles.stepBody}>
                    <TextInput
                      multiline
                      onChangeText={handleSceneChange}
                      placeholder="e.g. Ordering coffee before a meeting, asking for oat milk, and checking if the cup size is smaller."
                      placeholderTextColor="rgba(121, 79, 39, 0.45)"
                      style={[
                        styles.sceneInput,
                        isCompact && styles.sceneInputCompact,
                      ]}
                      textAlignVertical="top"
                      value={scene}
                    />

                    <View style={styles.helperRow}>
                      <ThemedText style={styles.helperText}>
                        {readiness.detail}
                      </ThemedText>
                      {hasScene ? (
                        <ThemedText style={styles.wordCount}>
                          {sceneWordCount} words
                        </ThemedText>
                      ) : null}
                    </View>

                    <View style={styles.suggestionsBlock}>
                      <ThemedText style={styles.sectionLabel}>
                        Quick starts
                      </ThemedText>
                      <View style={styles.suggestionsWrap}>
                        {promptSuggestions.map((suggestion) => (
                          <Pressable
                            key={suggestion.label}
                            onPress={() =>
                              handleSuggestionPress(suggestion.scene)
                            }
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
                    </View>

                    {sessions.length > 0 ? (
                      <View style={styles.sessionsBlock}>
                        <View style={styles.sectionHeader}>
                          <ThemedText style={styles.sectionLabel}>
                            Recent sessions
                          </ThemedText>
                          <ThemedText style={styles.sessionCount}>
                            {sessions.length}
                          </ThemedText>
                        </View>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.sessionsContent}
                        >
                          {sessions.map((session) => {
                            const totalWords = session.segments.reduce(
                              (sum, segment) =>
                                sum + segment.text.split(/\s+/).filter(Boolean).length,
                              0,
                            );
                            const practiced =
                              session.currentWordIndex >= 0
                                ? session.segments
                                    .flatMap((s) => s.text.split(/\s+/).filter(Boolean))
                                    .findIndex(
                                      (_, index) => index > session.currentWordIndex,
                                    )
                                : 0;
                            const progress =
                              totalWords > 0
                                ? Math.min(
                                    100,
                                    Math.round((practiced / totalWords) * 100),
                                  )
                                : 0;

                            return (
                              <Pressable
                                key={session.id}
                                onPress={() => {
                                  loadSession(session);
                                  router.push("/teleprompter");
                                }}
                                style={styles.sessionCardPressable}
                              >
                                <ThemedView style={styles.sessionCard}>
                                  <ThemedText
                                    style={styles.sessionTitle}
                                    numberOfLines={2}
                                  >
                                    {session.title || session.scene}
                                  </ThemedText>
                                  <View style={styles.sessionMeta}>
                                    <ThemedText style={styles.sessionTime}>
                                      {formatRelativeTime(session.updatedAt)}
                                    </ThemedText>
                                    <ThemedText style={styles.sessionProgress}>
                                      {progress}%
                                    </ThemedText>
                                  </View>
                                  <View style={styles.sessionProgressBar}>
                                    <View
                                      style={[
                                        styles.sessionProgressFill,
                                        { width: `${progress}%` },
                                      ]}
                                    />
                                  </View>
                                </ThemedView>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {activeTab === "key" ? (
                  <View style={styles.stepBody}>
                    <ThemedText style={styles.bodyText}>
                      {isLoadingApiKey
                        ? "Checking for a saved key on this device…"
                        : hasApiKey
                          ? "Your DeepSeek key is saved on this device and ready to use."
                          : "Add a DeepSeek API key once, then return here to generate role-play lines."}
                    </ThemedText>

                    <ThemedView style={styles.keyStatusCard}>
                      <View style={styles.keyBadge}>
                        <ThemedText style={styles.keyBadgeText}>
                          {hasApiKey ? "OK" : "KEY"}
                        </ThemedText>
                      </View>
                      <View style={styles.keyStatusCopy}>
                        <ThemedText style={styles.keyStatusTitle}>
                          {hasApiKey ? "Connected" : "API key required"}
                        </ThemedText>
                        <ThemedText style={styles.keyStatusDetail}>
                          Stored only in memory and used only for DeepSeek
                          requests.
                        </ThemedText>
                      </View>
                    </ThemedView>

                    {hasApiKey ? (
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
                            Update key
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {activeTab === "review" ? (
                  <View style={styles.stepBody}>
                    <ThemedView style={styles.reviewCard}>
                      <View style={styles.reviewRow}>
                        <View style={styles.reviewCopy}>
                          <ThemedText style={styles.reviewTitle}>
                            Practice scene
                          </ThemedText>
                          <ThemedText
                            style={styles.reviewDetail}
                            numberOfLines={hasScene ? 3 : 1}
                          >
                            {hasScene
                              ? shortenScene(trimmedScene)
                              : "Add a speaking scene first."}
                          </ThemedText>
                        </View>
                        <ThemedText
                          style={[
                            styles.reviewState,
                            hasScene
                              ? styles.reviewStateReady
                              : styles.reviewStateMissing,
                          ]}
                        >
                          {hasScene ? "Ready" : "Needed"}
                        </ThemedText>
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.reviewRow}>
                        <View style={styles.reviewCopy}>
                          <ThemedText style={styles.reviewTitle}>
                            DeepSeek
                          </ThemedText>
                          <ThemedText style={styles.reviewDetail}>
                            {hasApiKey
                              ? "Key configured for this session."
                              : "Add your API key before generating dialogue."}
                          </ThemedText>
                        </View>
                        <ThemedText
                          style={[
                            styles.reviewState,
                            hasApiKey
                              ? styles.reviewStateReady
                              : styles.reviewStateMissing,
                          ]}
                        >
                          {hasApiKey ? "Ready" : "Needed"}
                        </ThemedText>
                      </View>
                    </ThemedView>
                  </View>
                ) : null}

                {generationError ? (
                  <ThemedView style={styles.errorCard}>
                    <ThemedText style={styles.errorTitle}>
                      Needs attention
                    </ThemedText>
                    <ThemedText style={styles.errorBody}>
                      {generationError}
                    </ThemedText>
                  </ThemedView>
                ) : null}

                <View
                  style={[
                    styles.actionRow,
                    isCompact && styles.actionRowCompact,
                  ]}
                >
                  {activeTab !== "scene" ? (
                    <Pressable
                      disabled={isGenerating}
                      onPress={handleBack}
                      onPressIn={() => setBackPressed(true)}
                      onPressOut={() => setBackPressed(false)}
                      style={[
                        styles.backPressable,
                        isCompact && styles.fullWidthAction,
                      ]}
                    >
                      <ThemedView
                        style={[
                          styles.backButton,
                          backPressed && styles.secondaryButtonPressed,
                        ]}
                      >
                        <ThemedText style={styles.backButtonText}>
                          Back
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  ) : null}

                  <Pressable
                    disabled={isGenerating}
                    onPress={handlePrimaryAction}
                    onPressIn={() => setPrimaryPressed(true)}
                    onPressOut={() => setPrimaryPressed(false)}
                    style={[
                      styles.primaryPressable,
                      isCompact && styles.fullWidthAction,
                    ]}
                  >
                    <ThemedView
                      style={[
                        styles.primaryButton,
                        (primaryPressed || isGenerating) &&
                          styles.primaryButtonPressed,
                        isGenerating && styles.primaryButtonDisabled,
                      ]}
                    >
                      <ThemedText style={styles.primaryButtonText}>
                        {primaryActionLabel}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                </View>
              </ThemedView>
            </ThemedView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  actionRowCompact: {
    alignItems: "stretch",
    flexDirection: "column-reverse",
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#f1ead7",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    ...Shadows.btn,
  },
  backButtonText: {
    color: Colors.light.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  backPressable: {
    flexShrink: 0,
  },
  bodyText: {
    color: Colors.light.text,
    fontSize: 15,
    lineHeight: 22,
  },
  divider: {
    backgroundColor: "rgba(121, 79, 39, 0.12)",
    height: 1,
  },
  errorBody: {
    color: Colors.light.text,
    fontSize: 14,
    lineHeight: 20,
  },
  errorCard: {
    backgroundColor: "#fff0f0",
    borderColor: "rgba(224, 90, 90, 0.24)",
    borderRadius: Radius.base,
    borderWidth: 1,
    gap: Spacing.xs,
    padding: Spacing.md,
    width: "100%",
  },
  errorTitle: {
    color: Colors.light.error,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  fullWidthAction: {
    width: "100%",
  },
  header: {
    gap: Spacing.sm,
    width: "100%",
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  helperRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  helperText: {
    color: "rgba(121, 79, 39, 0.72)",
    flex: 1,
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
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  keyBadge: {
    alignItems: "center",
    backgroundColor: Colors.light.primaryBg,
    borderRadius: Radius.base,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  keyBadgeText: {
    color: Colors.light.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
  },
  keyStatusCard: {
    alignItems: "center",
    backgroundColor: "#fff9ef",
    borderColor: "rgba(121, 79, 39, 0.12)",
    borderRadius: Radius.base,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.md,
  },
  keyStatusCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  keyStatusDetail: {
    color: "rgba(121, 79, 39, 0.7)",
    fontSize: 13,
    lineHeight: 18,
  },
  keyStatusTitle: {
    color: Colors.light.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  keyboardView: {
    flex: 1,
  },
  page: {
    flex: 1,
    gap: Spacing.lg,
    maxWidth: MAX_CONTENT_WIDTH,
    width: "100%",
  },
  pageCompact: {
    gap: Spacing.md,
  },
  panelTitle: {
    color: Colors.light.text,
    letterSpacing: 0,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: Colors.light.primary,
    borderRadius: Radius.pill,
    minHeight: 54,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
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
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0,
  },
  primaryPressable: {
    flex: 1,
  },
  reviewCard: {
    backgroundColor: "#fff9ef",
    borderColor: "rgba(121, 79, 39, 0.12)",
    borderRadius: Radius.base,
    borderWidth: 1,
    gap: Spacing.md,
    padding: Spacing.md,
  },
  reviewCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  reviewDetail: {
    color: "rgba(121, 79, 39, 0.72)",
    fontSize: 14,
    lineHeight: 20,
  },
  reviewRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  reviewState: {
    borderRadius: Radius.pill,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    overflow: "hidden",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  reviewStateMissing: {
    backgroundColor: "rgba(255, 209, 102, 0.24)",
    color: Colors.light.text,
  },
  reviewStateReady: {
    backgroundColor: "rgba(111, 186, 44, 0.16)",
    color: "#4f7f2c",
  },
  reviewTitle: {
    color: Colors.light.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  safeArea: {
    flex: 1,
  },
  sceneInput: {
    backgroundColor: Colors.light.background,
    borderColor: "rgba(121, 79, 39, 0.14)",
    borderRadius: Radius.base,
    borderWidth: 1,
    color: Colors.light.text,
    fontFamily: "Nunito",
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 26,
    minHeight: 152,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  sceneInputCompact: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 132,
  },
  sessionsBlock: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sessionsContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  sessionCount: {
    backgroundColor: "rgba(121, 79, 39, 0.1)",
    borderRadius: Radius.pill,
    color: Colors.light.text,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  sessionCardPressable: {
    width: 220,
  },
  sessionCard: {
    backgroundColor: "#fff9ef",
    borderColor: "rgba(121, 79, 39, 0.12)",
    borderRadius: Radius.base,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  sessionTitle: {
    color: Colors.light.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    minHeight: 42,
  },
  sessionMeta: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sessionTime: {
    color: "rgba(121, 79, 39, 0.62)",
    fontSize: 12,
    fontWeight: "700",
  },
  sessionProgress: {
    color: Colors.light.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  sessionProgressBar: {
    backgroundColor: "rgba(121, 79, 39, 0.1)",
    borderRadius: Radius.pill,
    height: 6,
    overflow: "hidden",
  },
  sessionProgressFill: {
    backgroundColor: Colors.light.spoken,
    borderRadius: Radius.pill,
    height: "100%",
  },
  screen: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    backgroundColor: Colors.light.background,
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  scrollContentCompact: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
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
    letterSpacing: 0,
  },
  sectionLabel: {
    color: "rgba(121, 79, 39, 0.72)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
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
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  statusPillWarning: {
    backgroundColor: "rgba(255, 209, 102, 0.24)",
  },
  stepBody: {
    gap: Spacing.md,
  },
  stepHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  stepKicker: {
    color: "rgba(121, 79, 39, 0.62)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
  stepPanel: {
    backgroundColor: Colors.light.backgroundContent,
    borderRadius: Radius.lg,
    gap: Spacing.lg,
    padding: Spacing.lg,
    width: "100%",
    ...Shadows.card,
  },
  subtitle: {
    color: "rgba(121, 79, 39, 0.78)",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 560,
  },
  subtitleCompact: {
    fontSize: 15,
    lineHeight: 22,
  },
  suggestionChip: {
    backgroundColor: "#f1ead7",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  suggestionPressable: {
    marginBottom: Spacing.xs,
  },
  suggestionText: {
    color: Colors.light.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
  },
  suggestionsBlock: {
    gap: Spacing.sm,
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  tabBar: {
    backgroundColor: "#efe7d5",
    borderRadius: Radius.lg,
    flexDirection: "row",
    gap: Spacing.xs,
    overflow: "hidden",
    padding: Spacing.xs,
    width: "100%",
  },
  tabCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  tabHelper: {
    color: "rgba(121, 79, 39, 0.58)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
  },
  tabItem: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: Radius.base,
    flexDirection: "row",
    gap: Spacing.sm,
    minHeight: 56,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  tabItemActive: {
    backgroundColor: Colors.light.backgroundContent,
    borderRadius: Radius.lg,
    ...Shadows.inputSmall,
  },
  tabNumber: {
    alignItems: "center",
    backgroundColor: "rgba(121, 79, 39, 0.12)",
    borderRadius: Radius.pill,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  tabNumberActive: {
    backgroundColor: Colors.light.primary,
  },
  tabNumberComplete: {
    backgroundColor: "rgba(111, 186, 44, 0.22)",
  },
  tabNumberText: {
    color: Colors.light.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
  },
  tabNumberTextActive: {
    color: "#ffffff",
  },
  tabPressable: {
    flex: 1,
  },
  tabTitle: {
    color: Colors.light.text,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0,
  },
  tabTitleActive: {
    color: Colors.light.primaryActive,
  },
  title: {
    color: Colors.light.text,
    fontSize: 36,
    letterSpacing: 0,
    lineHeight: 42,
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 34,
  },
  wordCount: {
    color: "rgba(121, 79, 39, 0.62)",
    flexShrink: 0,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
});
