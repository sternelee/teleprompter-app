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
import { nunitoFamily } from "@/constants/fonts";
import {
  createShadows,
  MaxContentWidth,
  Radius,
  Spacing,
  type ThemePalette,
} from "@/constants/theme";
import { useApp } from "@/contexts/app-context";
import { useTheme } from "@/hooks/use-theme";
import { useI18n, type MessageKey } from "@/i18n";
import { generateDialogue } from "@/services/openai";
import { latestAssessmentGuidance } from "@/services/assessment";
import {
  projectVocabulary,
  selectReviewWords,
  type VocabularyEntry,
} from "@/services/vocabulary";
import { formatRelativeTime } from "@/utils/time";

const MAX_CONTENT_WIDTH = MaxContentWidth;

const promptSuggestions: {
  key: "coffee" | "jobIntro" | "hotel" | "doctor";
}[] = [
  { key: "coffee" },
  { key: "jobIntro" },
  { key: "hotel" },
  { key: "doctor" },
];

const homeTabs = [
  { helper: "tabs.sceneHelper", key: "scene", title: "tabs.scene" },
  { helper: "tabs.keyHelper", key: "key", title: "tabs.key" },
  { helper: "tabs.startHelper", key: "review", title: "tabs.start" },
] as const satisfies readonly {
  helper: MessageKey;
  key: string;
  title: MessageKey;
}[];

type HomeTabKey = (typeof homeTabs)[number]["key"];

const readinessByTone = {
  neutral: {
    label: "home.readinessWaiting",
    detail: "home.detailWaiting",
  },
  success: {
    label: "home.readinessReady",
    detail: "home.detailReady",
  },
  warning: {
    label: "home.readinessAlmost",
    detail: "home.detailAlmost",
  },
  weak: {
    label: "home.readinessNeedDetail",
    detail: "home.detailNeedDetail",
  },
} as const satisfies Record<
  string,
  { label: MessageKey; detail: MessageKey }
>;

type ReadinessTone = keyof typeof readinessByTone;

function getSceneReadinessTone(scene: string): ReadinessTone {
  const wordCount = scene.split(/\s+/).filter(Boolean).length;

  if (!scene) {
    return "neutral";
  }

  if (wordCount >= 9) {
    return "success";
  }

  if (wordCount >= 5) {
    return "warning";
  }

  return "weak";
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
    removeSession,
    setGenerationError,
    setIsGenerating,
    setScene,
  } = useApp();
  const { t } = useI18n();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const vocabularyEntries = useMemo<VocabularyEntry[]>(
    () => projectVocabulary(sessions),
    [sessions],
  );
  const vocabularyDueCount = useMemo(
    () => vocabularyEntries.filter((entry) => entry.isDue).length,
    [vocabularyEntries],
  );
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const [activeTab, setActiveTab] = useState<HomeTabKey>("scene");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [backPressed, setBackPressed] = useState(false);
  const [primaryPressed, setPrimaryPressed] = useState(false);
  const [settingsPressed, setSettingsPressed] = useState(false);

  const trimmedScene = scene.trim();
  const hasScene = Boolean(trimmedScene);
  const hasApiKey = Boolean(apiKey);
  const readinessTone = useMemo(
    () => getSceneReadinessTone(trimmedScene),
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
      setGenerationError(t("home.errorMissingKey"));
      setActiveTab("key");
      return;
    }

    if (!nextScene) {
      setGenerationError(t("home.errorMissingScene"));
      setActiveTab("scene");
      return;
    }

    setActiveTab("review");
    setGenerationError(null);
    setIsGenerating(true);
    setScene(nextScene);

    try {
      // Weave overdue review words from past sessions into the new dialogue
      // and adapt difficulty to the latest validated assessment.
      const reviewWords = selectReviewWords(projectVocabulary(sessions));
      const guidance = latestAssessmentGuidance(sessions);
      const nextSegments = await generateDialogue(nextScene, apiKey, {
        reviewWords,
        learnerLevel: guidance?.level,
        teachingFocus: guidance?.nextGoal,
      });
      startNewSession(nextScene, nextSegments);
      router.push("/teleprompter");
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : t("home.errorGenerateFailed"),
      );
    } finally {
      setIsGenerating(false);
    }
  }, [
    apiKey,
    sessions,
    setGenerationError,
    setIsGenerating,
    setScene,
    startNewSession,
    t,
    trimmedScene,
  ]);

  const handlePrimaryAction = useCallback(() => {
    if (activeTab === "scene") {
      if (!hasScene) {
        setGenerationError(t("home.errorSceneBeforeSetup"));
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
    t,
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
      return t("home.actionContinue");
    }

    if (activeTab === "key") {
      if (isLoadingApiKey) {
        return t("home.actionLoadingKey");
      }
      return hasApiKey ? t("home.actionReviewSetup") : t("home.actionAddKey");
    }

    return isGenerating ? t("home.actionGenerating") : t("home.actionStart");
  }, [activeTab, hasApiKey, isGenerating, isLoadingApiKey, t]);

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
            <ThemedView style={[styles.page, isCompact && styles.pageCompact]}>
              <View style={styles.header}>
                <ThemedView style={styles.heroBadge}>
                  <ThemedText style={styles.heroBadgeText}>
                    {t("home.badge")}
                  </ThemedText>
                </ThemedView>

                <ThemedText
                  type="title"
                  style={[styles.title, isCompact && styles.titleCompact]}
                >
                  {t("home.title")}
                </ThemedText>
                <ThemedText
                  style={[styles.subtitle, isCompact && styles.subtitleCompact]}
                >
                  {t("home.subtitle")}
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
                        style={[styles.tabItem, isActive && styles.tabItemActive]}
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
                            {t(tab.title)}
                          </ThemedText>
                          {!isCompact ? (
                            <ThemedText
                              style={styles.tabHelper}
                              numberOfLines={1}
                            >
                              {t(tab.helper)}
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
                      {t("home.step", {
                        current: activeTabIndex + 1,
                        total: homeTabs.length,
                      })}
                    </ThemedText>
                    <ThemedText type="subtitle" style={styles.panelTitle}>
                      {activeTab === "scene"
                        ? t("home.panelScene")
                        : activeTab === "key"
                          ? t("home.panelKey")
                          : t("home.panelReview")}
                    </ThemedText>
                  </View>

                  <ThemedView
                    style={[
                      styles.statusPill,
                      activeTab === "scene"
                        ? readinessTone === "success"
                          ? styles.statusPillSuccess
                          : readinessTone === "neutral"
                            ? styles.statusPillNeutral
                            : styles.statusPillWarning
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
                        ? t(readinessByTone[readinessTone].label)
                        : activeTab === "key"
                          ? hasApiKey
                            ? t("home.keyConfigured")
                            : t("home.keyRequired")
                          : hasScene && hasApiKey
                            ? t("common.ready")
                            : t("common.check")}
                    </ThemedText>
                  </ThemedView>
                </View>

                {activeTab === "scene" ? (
                  <View style={styles.stepBody}>
                    <TextInput
                      multiline
                      onChangeText={handleSceneChange}
                      placeholder={t("home.scenePlaceholder")}
                      placeholderTextColor={theme.placeholder}
                      style={[
                        styles.sceneInput,
                        isCompact && styles.sceneInputCompact,
                      ]}
                      textAlignVertical="top"
                      value={scene}
                    />

                    <View style={styles.helperRow}>
                      <ThemedText style={styles.helperText}>
                        {t(readinessByTone[readinessTone].detail)}
                      </ThemedText>
                      {hasScene ? (
                        <ThemedText style={styles.wordCount}>
                          {t("home.wordCount", { count: sceneWordCount })}
                        </ThemedText>
                      ) : null}
                    </View>

                    <View style={styles.suggestionsBlock}>
                      <ThemedText style={styles.sectionLabel}>
                        {t("home.quickStarts")}
                      </ThemedText>
                      <View style={styles.suggestionsWrap}>
                        {promptSuggestions.map((suggestion) => (
                          <Pressable
                            key={suggestion.key}
                            onPress={() =>
                              handleSuggestionPress(t(`scenes.${suggestion.key}`))
                            }
                            style={styles.suggestionPressable}
                          >
                            <ThemedView style={styles.suggestionChip}>
                              <ThemedText style={styles.suggestionText}>
                                {t(`suggestions.${suggestion.key}`)}
                              </ThemedText>
                            </ThemedView>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    {vocabularyEntries.length > 0 ? (
                      <Pressable
                        onPress={() => router.push("/vocabulary")}
                        style={styles.vocabPressable}
                      >
                        <ThemedView style={styles.vocabCard}>
                          <View style={styles.vocabRow}>
                            <ThemedText style={styles.vocabTitle}>
                              {t("vocabulary.title")}
                            </ThemedText>
                            {vocabularyDueCount > 0 ? (
                              <ThemedView style={styles.vocabDueBadge}>
                                <ThemedText style={styles.vocabDueText}>
                                  {t("vocabulary.dueCount", {
                                    count: vocabularyDueCount,
                                  })}
                                </ThemedText>
                              </ThemedView>
                            ) : (
                              <ThemedText style={styles.vocabCount}>
                                {vocabularyEntries.length}
                              </ThemedText>
                            )}
                          </View>
                          <ThemedText style={styles.vocabHint}>
                            {t("vocabulary.subtitle")}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    ) : null}

                    {sessions.length > 0 ? (
                      <View style={styles.sessionsBlock}>
                        <View style={styles.sectionHeader}>
                          <ThemedText style={styles.sectionLabel}>
                            {t("home.recentSessions")}
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
                                sum +
                                segment.text.split(/\s+/).filter(Boolean).length,
                              0,
                            );
                            const practiced = Math.min(
                              totalWords,
                              Math.max(0, session.currentWordIndex + 1),
                            );
                            const progress =
                              totalWords > 0
                                ? Math.round((practiced / totalWords) * 100)
                                : 0;
                            const isPendingDelete =
                              pendingDeleteId === session.id;

                            return (
                              <Pressable
                                key={session.id}
                                delayLongPress={350}
                                onPress={() => {
                                  if (isPendingDelete) return;
                                  loadSession(session);
                                  router.push("/teleprompter");
                                }}
                                onLongPress={() => {
                                  setPendingDeleteId(session.id);
                                }}
                                accessibilityHint={t("home.deleteSessionTitle")}
                                style={styles.sessionCardPressable}
                              >
                                <ThemedView
                                  style={[
                                    styles.sessionCard,
                                    isPendingDelete && styles.sessionCardDanger,
                                  ]}
                                >
                                  <ThemedText
                                    style={styles.sessionTitle}
                                    numberOfLines={2}
                                  >
                                    {session.title || session.scene}
                                  </ThemedText>
                                  <View style={styles.sessionMeta}>
                                    <ThemedText style={styles.sessionTime}>
                                      {formatRelativeTime(session.updatedAt, t)}
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

                                  {isPendingDelete ? (
                                    <View style={styles.deleteBlock}>
                                      <ThemedText style={styles.deletePrompt}>
                                        {t("home.deleteSessionTitle")}
                                      </ThemedText>
                                      <View style={styles.deleteRow}>
                                        <Pressable
                                          onPress={() => {
                                            removeSession(session.id);
                                            setPendingDeleteId(null);
                                          }}
                                          style={styles.deleteAction}
                                        >
                                          <ThemedView
                                            style={styles.deleteButton}
                                          >
                                            <ThemedText
                                              style={styles.deleteButtonText}
                                            >
                                              {t("common.delete")}
                                            </ThemedText>
                                          </ThemedView>
                                        </Pressable>
                                        <Pressable
                                          onPress={() =>
                                            setPendingDeleteId(null)
                                          }
                                          style={styles.deleteAction}
                                        >
                                          <ThemedView
                                            style={styles.cancelButton}
                                          >
                                            <ThemedText
                                              style={styles.cancelButtonText}
                                            >
                                              {t("common.cancel")}
                                            </ThemedText>
                                          </ThemedView>
                                        </Pressable>
                                      </View>
                                    </View>
                                  ) : null}
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
                        ? t("home.keyChecking")
                        : hasApiKey
                          ? t("home.keySaved")
                          : t("home.keyMissing")}
                    </ThemedText>

                    <ThemedView style={styles.keyStatusCard}>
                      <View style={styles.keyBadge}>
                        <ThemedText style={styles.keyBadgeText}>
                          {hasApiKey ? "OK" : "KEY"}
                        </ThemedText>
                      </View>
                      <View style={styles.keyStatusCopy}>
                        <ThemedText style={styles.keyStatusTitle}>
                          {hasApiKey
                            ? t("home.keyConnected")
                            : t("home.keyRequiredTitle")}
                        </ThemedText>
                        <ThemedText style={styles.keyStatusDetail}>
                          {t("home.keyStorageNote")}
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
                            {t("home.updateKey")}
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
                            {t("home.reviewScene")}
                          </ThemedText>
                          <ThemedText
                            style={styles.reviewDetail}
                            numberOfLines={hasScene ? 3 : 1}
                          >
                            {hasScene
                              ? shortenScene(trimmedScene)
                              : t("home.reviewSceneEmpty")}
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
                          {hasScene ? t("common.ready") : t("common.needed")}
                        </ThemedText>
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.reviewRow}>
                        <View style={styles.reviewCopy}>
                          <ThemedText style={styles.reviewTitle}>
                            {t("home.reviewProvider")}
                          </ThemedText>
                          <ThemedText style={styles.reviewDetail}>
                            {hasApiKey
                              ? t("home.reviewKeyReady")
                              : t("home.reviewKeyMissing")}
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
                          {hasApiKey ? t("common.ready") : t("common.needed")}
                        </ThemedText>
                      </View>
                    </ThemedView>
                  </View>
                ) : null}

                {generationError ? (
                  <ThemedView style={styles.errorCard}>
                    <ThemedText style={styles.errorTitle}>
                      {t("home.needsAttention")}
                    </ThemedText>
                    <ThemedText style={styles.errorBody}>
                      {generationError}
                    </ThemedText>
                  </ThemedView>
                ) : null}

                <View
                  style={[styles.actionRow, isCompact && styles.actionRowCompact]}
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
                          {t("common.back")}
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

function createStyles(theme: ThemePalette) {
  const shadows = createShadows(theme);

  return StyleSheet.create({
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
      backgroundColor: theme.chip,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    backButtonText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0,
    },
    backPressable: {
      flexShrink: 0,
    },
    bodyText: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 22,
    },
    cancelButton: {
      alignItems: "center",
      backgroundColor: theme.chip,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    cancelButtonText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "800",
    },
    deleteAction: {
      flexShrink: 0,
    },
    deleteBlock: {
      borderColor: theme.borderSoft,
      borderTopWidth: 1,
      gap: Spacing.xs,
      paddingTop: Spacing.sm,
    },
    deleteButton: {
      alignItems: "center",
      backgroundColor: theme.errorSurface,
      borderColor: theme.errorBorder,
      borderRadius: Radius.pill,
      borderWidth: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    deleteButtonText: {
      color: theme.error,
      fontSize: 13,
      fontWeight: "800",
    },
    deletePrompt: {
      color: theme.textSoft,
      fontSize: 12,
      fontWeight: "700",
    },
    deleteRow: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    divider: {
      backgroundColor: theme.borderSoft,
      height: 1,
    },
    errorBody: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 20,
    },
    errorCard: {
      backgroundColor: theme.errorSurface,
      borderColor: theme.errorBorder,
      borderRadius: Radius.base,
      borderWidth: 1,
      gap: Spacing.xs,
      padding: Spacing.md,
      width: "100%",
    },
    errorTitle: {
      color: theme.error,
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
      color: theme.textSoft,
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
    },
    heroBadge: {
      alignSelf: "flex-start",
      backgroundColor: theme.primaryWash,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
    },
    heroBadgeText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    keyBadge: {
      alignItems: "center",
      backgroundColor: theme.primaryBg,
      borderRadius: Radius.base,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    keyBadgeText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
    },
    keyStatusCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.borderSoft,
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
      color: theme.textSoft,
      fontSize: 13,
      lineHeight: 18,
    },
    keyStatusTitle: {
      color: theme.text,
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
      color: theme.text,
      letterSpacing: 0,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: Radius.pill,
      minHeight: 54,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    primaryButtonDisabled: {
      opacity: 0.82,
    },
    primaryButtonPressed: {
      transform: [{ translateY: 2 }],
      ...shadows.btnActive,
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
      backgroundColor: theme.card,
      borderColor: theme.borderSoft,
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
      color: theme.textSoft,
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
      backgroundColor: theme.warningWash,
      color: theme.text,
    },
    reviewStateReady: {
      backgroundColor: theme.successWash,
      color: theme.successText,
    },
    reviewTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0,
    },
    safeArea: {
      flex: 1,
    },
    sceneInput: {
      backgroundColor: theme.background,
      borderColor: theme.borderInput,
      borderRadius: Radius.base,
      borderWidth: 1,
      color: theme.text,
      fontFamily: nunitoFamily("500"),
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
    screen: {
      flex: 1,
    },
    scrollContent: {
      alignItems: "center",
      backgroundColor: theme.background,
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
      backgroundColor: theme.chip,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    secondaryButtonPressed: {
      transform: [{ translateY: 2 }],
      ...shadows.btnActive,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: Spacing.sm,
    },
    vocabPressable: {
      width: "100%",
    },
    vocabCard: {
      backgroundColor: theme.card,
      borderColor: theme.borderSoft,
      borderRadius: Radius.base,
      borderWidth: 1,
      flexDirection: "column",
      gap: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      width: "100%",
      ...shadows.card,
    },
    vocabRow: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: Spacing.sm,
      justifyContent: "space-between",
    },
    vocabTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0,
    },
    vocabHint: {
      color: theme.textSoft,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0,
    },
    vocabCount: {
      color: theme.textSoft,
      fontSize: 12,
      fontWeight: "800",
    },
    vocabDueBadge: {
      alignItems: "center",
      backgroundColor: theme.primaryBg,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
    },
    vocabDueText: {
      color: theme.primaryActive,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.02,
    },
    sectionLabel: {
      color: theme.textSoft,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
    },
    sessionCard: {
      backgroundColor: theme.card,
      borderColor: theme.borderSoft,
      borderRadius: Radius.base,
      borderWidth: 1,
      gap: Spacing.sm,
      padding: Spacing.md,
    },
    sessionCardDanger: {
      borderColor: theme.errorBorder,
    },
    sessionCardPressable: {
      width: 220,
    },
    sessionCount: {
      backgroundColor: theme.borderFaint,
      borderRadius: Radius.pill,
      color: theme.text,
      fontSize: 12,
      fontWeight: "800",
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
    },
    sessionMeta: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    sessionProgress: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "900",
    },
    sessionProgressBar: {
      backgroundColor: theme.borderFaint,
      borderRadius: Radius.pill,
      height: 6,
      overflow: "hidden",
    },
    sessionProgressFill: {
      backgroundColor: theme.spoken,
      borderRadius: Radius.pill,
      height: "100%",
    },
    sessionsBlock: {
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    sessionsContent: {
      gap: Spacing.sm,
      paddingRight: Spacing.lg,
    },
    sessionTime: {
      color: theme.textSofter,
      fontSize: 12,
      fontWeight: "700",
    },
    sessionTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 21,
      minHeight: 42,
    },
    statusPill: {
      alignItems: "center",
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
    },
    statusPillNeutral: {
      backgroundColor: theme.neutral,
    },
    statusPillSuccess: {
      backgroundColor: theme.successWash,
    },
    statusPillText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    statusPillWarning: {
      backgroundColor: theme.warningWash,
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
      color: theme.textSofter,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
    },
    stepPanel: {
      backgroundColor: theme.backgroundContent,
      borderRadius: Radius.lg,
      gap: Spacing.lg,
      padding: Spacing.lg,
      width: "100%",
      ...shadows.card,
    },
    subtitle: {
      color: theme.textBodySoft,
      fontSize: 16,
      lineHeight: 24,
      maxWidth: 560,
    },
    subtitleCompact: {
      fontSize: 15,
      lineHeight: 22,
    },
    suggestionChip: {
      backgroundColor: theme.chip,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    suggestionPressable: {
      marginBottom: Spacing.xs,
    },
    suggestionsBlock: {
      gap: Spacing.sm,
    },
    suggestionsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    suggestionText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0,
    },
    tabBar: {
      backgroundColor: theme.tabBar,
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
      color: theme.textSoftest,
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
      backgroundColor: theme.backgroundContent,
      borderRadius: Radius.lg,
      ...shadows.inputSmall,
    },
    tabNumber: {
      alignItems: "center",
      backgroundColor: theme.borderSoft,
      borderRadius: Radius.pill,
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    tabNumberActive: {
      backgroundColor: theme.primary,
    },
    tabNumberComplete: {
      backgroundColor: theme.successWashStrong,
    },
    tabNumberText: {
      color: theme.text,
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
      color: theme.text,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
    },
    tabTitleActive: {
      color: theme.primaryActive,
    },
    title: {
      color: theme.text,
      fontSize: 36,
      letterSpacing: 0,
      lineHeight: 42,
    },
    titleCompact: {
      fontSize: 28,
      lineHeight: 34,
    },
    wordCount: {
      color: theme.textSofter,
      flexShrink: 0,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
    },
  });
}
