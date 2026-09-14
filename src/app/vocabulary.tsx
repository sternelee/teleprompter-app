import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
import { projectVocabulary, type VocabularyEntry } from "@/services/vocabulary";
import { formatRelativeTime } from "@/utils/time";

function labelKey(label: VocabularyEntry["label"]): MessageKey {
  switch (label) {
    case "new":
      return "vocabulary.labelNew";
    case "fragile":
      return "vocabulary.labelFragile";
    case "growing":
      return "vocabulary.labelGrowing";
    default:
      return "vocabulary.labelSteady";
  }
}

export default function VocabularyScreen() {
  const router = useRouter();
  const { sessions } = useApp();
  const { t } = useI18n();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Recall strength is derived from the saved sessions on every visit, so it
  // always reflects the latest practice evidence (and decays over time).
  const entries = useMemo(() => projectVocabulary(sessions), [sessions]);
  const dueCount = entries.filter((entry) => entry.isDue).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ThemedText type="link" style={styles.backLink}>
                {t("common.back")}
              </ThemedText>
            </Pressable>
            <ThemedText type="heading" style={styles.title}>
              {t("vocabulary.title")}
            </ThemedText>
            <View style={styles.headerSpacer} />
          </View>

          <ThemedView type="backgroundContent" style={styles.summaryCard}>
            <ThemedText type="small" themeColor="textSecondary">
              {t("vocabulary.subtitle")}
            </ThemedText>
            {dueCount > 0 ? (
              <View style={styles.summaryRow}>
                <ThemedView style={styles.dueBadge}>
                  <ThemedText style={styles.dueBadgeText}>
                    {t("vocabulary.dueCount", { count: dueCount })}
                  </ThemedText>
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  {t("vocabulary.reviewReady")}
                </ThemedText>
              </View>
            ) : null}
          </ThemedView>

          {entries.length === 0 ? (
            <ThemedView type="backgroundContent" style={styles.card}>
              <ThemedText type="smallBold" style={styles.emptyTitle}>
                {t("vocabulary.empty")}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t("vocabulary.emptyHint")}
              </ThemedText>
            </ThemedView>
          ) : (
            entries.map((entry) => (
              <ThemedView
                key={entry.key}
                type="backgroundContent"
                style={styles.card}
              >
                <View style={styles.wordRow}>
                  <ThemedText style={styles.word}>{entry.key}</ThemedText>
                  <View style={styles.bars}>
                    {[0, 1, 2].map((bar) => (
                      <View
                        key={bar}
                        style={[
                          styles.bar,
                          { height: 8 + bar * 5 },
                          bar < entry.bars
                            ? { backgroundColor: theme.spoken }
                            : styles.barEmpty,
                        ]}
                      />
                    ))}
                  </View>
                </View>

                {entry.meaning ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {entry.meaning}
                  </ThemedText>
                ) : null}

                <View style={styles.metaRow}>
                  <ThemedView
                    style={[styles.labelChip, entry.isDue && styles.labelChipDue]}
                  >
                    <ThemedText
                      type="small"
                      style={[
                        styles.labelChipText,
                        entry.isDue && styles.labelChipTextDue,
                      ]}
                    >
                      {entry.isDue
                        ? t("vocabulary.due")
                        : t(labelKey(entry.label))}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t("vocabulary.spokenTimes", {
                      count: entry.independentCount,
                    })}
                  </ThemedText>
                  {entry.lapseCount > 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t("vocabulary.missedTimes", { count: entry.lapseCount })}
                    </ThemedText>
                  ) : null}
                  {entry.contexts.length > 1 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t("vocabulary.scenesCount", {
                        count: entry.contexts.length,
                      })}
                    </ThemedText>
                  ) : null}
                </View>

                <ThemedText type="small" themeColor="textMuted">
                  {formatRelativeTime(entry.lastSeenAt, t)}
                </ThemedText>
              </ThemedView>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function createStyles(theme: ThemePalette) {
  const shadows = createShadows(theme);

  return StyleSheet.create({
    backLink: {
      fontSize: 14,
    },
    bar: {
      borderRadius: 2,
      width: 6,
    },
    barEmpty: {
      backgroundColor: theme.backgroundElement,
    },
    bars: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: 3,
      height: 20,
    },
    card: {
      borderColor: theme.borderFaint,
      borderRadius: Radius.lg,
      borderWidth: 1,
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      width: "100%",
      ...shadows.card,
    },
    container: {
      flex: 1,
    },
    dueBadge: {
      alignItems: "center",
      backgroundColor: theme.primaryBg,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
    },
    dueBadgeText: {
      color: theme.primaryActive,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.02,
    },
    emptyTitle: {
      fontSize: 15,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: Spacing.sm,
      paddingTop: Spacing.lg,
    },
    headerSpacer: {
      width: 64,
    },
    labelChip: {
      backgroundColor: theme.backgroundElement,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
    },
    labelChipDue: {
      backgroundColor: theme.error,
    },
    labelChipText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.02,
    },
    labelChipTextDue: {
      color: "#ffffff",
    },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    safeArea: {
      alignSelf: "center",
      flex: 1,
      maxWidth: MaxContentWidth,
      paddingHorizontal: Spacing.lg,
      width: "100%",
    },
    scrollContent: {
      gap: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    summaryCard: {
      borderRadius: Radius.lg,
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      width: "100%",
    },
    summaryRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    title: {
      fontSize: 22,
    },
    word: {
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: 0.01,
      textTransform: "lowercase",
    },
    wordRow: {
      alignItems: "flex-end",
      flexDirection: "row",
      justifyContent: "space-between",
    },
  });
}
