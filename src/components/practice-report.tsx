import { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  createShadows,
  Radius,
  Spacing,
  type ThemePalette,
} from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useI18n, type MessageKey } from "@/i18n";
import type { PracticeAssessment } from "@/types/assessment";
import type { Correction } from "@/types/dialogue";

type PracticeReportProps = {
  /** Validated AI coach assessment for this round, when available. */
  assessment?: PracticeAssessment | null;
  assessmentPending?: boolean;
  corrections: Correction[];
  onClose: () => void;
  onRestart: () => void;
  spokenCount: number;
  totalWords: number;
  visible: boolean;
};

function getSummaryKey(percent: number): MessageKey {
  if (percent >= 80) return "teleprompter.reportSummaryGreat";
  if (percent >= 40) return "teleprompter.reportSummaryOk";
  return "teleprompter.reportSummaryLow";
}

function outcomeKey(outcome: PracticeAssessment["outcome"]): MessageKey {
  switch (outcome) {
    case "success":
      return "teleprompter.reportCoachOutcomeSuccess";
    case "breakdown":
      return "teleprompter.reportCoachOutcomeBreakdown";
    default:
      return "teleprompter.reportCoachOutcomePartial";
  }
}

export function PracticeReport({
  assessment,
  assessmentPending = false,
  corrections,
  onClose,
  onRestart,
  spokenCount,
  totalWords,
  visible,
}: PracticeReportProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const percent =
    totalWords > 0 ? Math.round((spokenCount / totalWords) * 100) : 0;
  const attempted = spokenCount + corrections.length;
  const accuracy =
    attempted > 0 ? Math.round((spokenCount / attempted) * 100) : 0;

  const weakWords = useMemo(() => {
    const seen = new Set<string>();

    return corrections
      .map((correction) => correction.expected.trim())
      .filter((word) => {
        const key = word.toLowerCase();
        if (!word || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10);
  }, [corrections]);

  const stats: { label: MessageKey; value: string }[] = [
    { label: "teleprompter.reportCompletion", value: `${percent}%` },
    {
      label: "teleprompter.reportPracticed",
      value: `${Math.min(spokenCount, totalWords)}`,
    },
    {
      label: "teleprompter.reportRevisit",
      value: `${corrections.length}`,
    },
    { label: "teleprompter.reportAccuracy", value: `${accuracy}%` },
  ];

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <ThemedView type="backgroundContent" style={styles.card}>
          <ThemedText type="heading" style={styles.title}>
            {t("teleprompter.reportTitle")}
          </ThemedText>

          <ThemedText style={styles.summary}>
            {t(getSummaryKey(percent), { percent })}
          </ThemedText>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>

          <View style={styles.statGrid}>
            {stats.map((stat) => (
              <ThemedView
                key={stat.label}
                type="backgroundElement"
                style={styles.statCard}
              >
                <ThemedText type="small" style={styles.statLabel}>
                  {t(stat.label)}
                </ThemedText>
                <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
              </ThemedView>
            ))}
          </View>

          <View style={styles.weakBlock}>
            <ThemedText type="smallBold" style={styles.weakTitle}>
              {t("teleprompter.reportWeakWords")}
            </ThemedText>
            {weakWords.length > 0 ? (
              <ScrollView
                style={styles.weakScroll}
                contentContainerStyle={styles.weakWrap}
              >
                {weakWords.map((word) => (
                  <ThemedView key={word} style={styles.weakChip}>
                    <ThemedText type="smallBold" style={styles.weakChipText}>
                      {word}
                    </ThemedText>
                  </ThemedView>
                ))}
              </ScrollView>
            ) : (
              <ThemedText type="small" style={styles.weakEmpty}>
                {t("teleprompter.reportNoWeakWords")}
              </ThemedText>
            )}
          </View>

          {assessmentPending ? (
            <View style={styles.coachBlock}>
              <ThemedText type="smallBold" style={styles.weakTitle}>
                {t("teleprompter.reportCoachTitle")}
              </ThemedText>
              <ThemedText type="small" style={styles.coachPending}>
                {t("teleprompter.reportCoachPending")}
              </ThemedText>
            </View>
          ) : assessment ? (
            <View style={styles.coachBlock}>
              <ThemedText type="smallBold" style={styles.weakTitle}>
                {t("teleprompter.reportCoachTitle")}
              </ThemedText>
              <View style={styles.coachRow}>
                <ThemedView
                  style={[
                    styles.coachOutcomeChip,
                    assessment.outcome === "success" && {
                      backgroundColor: theme.spoken,
                    },
                    assessment.outcome === "partial" && {
                      backgroundColor: theme.current,
                    },
                    assessment.outcome === "breakdown" && {
                      backgroundColor: theme.error,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.coachOutcomeText,
                      assessment.outcome === "partial" &&
                        styles.coachOutcomeTextDark,
                    ]}
                  >
                    {t(outcomeKey(assessment.outcome))}
                  </ThemedText>
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  {t("teleprompter.reportCoachLevel", {
                    level: assessment.suggestedLevel,
                  })}
                </ThemedText>
              </View>
              {assessment.capability ? (
                <ThemedText type="small" style={styles.coachText}>
                  {assessment.capability}
                </ThemedText>
              ) : null}
              {assessment.nextGoal ? (
                <View style={styles.coachGoal}>
                  <ThemedText type="small" style={styles.coachGoalLabel}>
                    {t("teleprompter.reportCoachNextGoal")}
                  </ThemedText>
                  <ThemedText type="small" style={styles.coachText}>
                    {assessment.nextGoal}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={onRestart} style={styles.action}>
              <ThemedView type="primary" style={styles.primaryButton}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {t("teleprompter.reportAgain")}
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable onPress={onClose} style={styles.action}>
              <ThemedView type="backgroundElement" style={styles.closeButton}>
                <ThemedText type="smallBold" style={styles.closeButtonText}>
                  {t("teleprompter.reportClose")}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

function createStyles(theme: ThemePalette) {
  const shadows = createShadows(theme);

  return StyleSheet.create({
    action: {
      flex: 1,
    },
    coachBlock: {
      gap: Spacing.sm,
    },
    coachGoal: {
      gap: 2,
    },
    coachGoalLabel: {
      color: theme.textMuted,
      fontWeight: "800",
    },
    coachOutcomeChip: {
      alignItems: "center",
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 4,
    },
    coachOutcomeText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.02,
    },
    coachOutcomeTextDark: {
      color: theme.text,
    },
    coachPending: {
      color: theme.textMuted,
    },
    coachRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: Spacing.sm,
    },
    coachText: {
      color: theme.textBodySoft,
      lineHeight: 20,
    },
    actions: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    backdrop: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      flex: 1,
      justifyContent: "center",
      padding: Spacing.lg,
    },
    card: {
      borderRadius: Radius.lg,
      gap: Spacing.md,
      maxWidth: 460,
      padding: Spacing.lg,
      width: "100%",
      ...shadows.card,
    },
    closeButton: {
      alignItems: "center",
      borderRadius: Radius.pill,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    closeButtonText: {
      color: theme.text,
    },
    primaryButton: {
      alignItems: "center",
      borderRadius: Radius.pill,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    primaryButtonText: {
      color: "#ffffff",
    },
    progressFill: {
      backgroundColor: theme.spoken,
      borderRadius: Radius.pill,
      height: "100%",
    },
    progressTrack: {
      backgroundColor: theme.backgroundElement,
      borderRadius: Radius.pill,
      height: 10,
      overflow: "hidden",
    },
    statCard: {
      borderRadius: Radius.base,
      flexBasis: "47%",
      flexGrow: 1,
      gap: 2,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    statLabel: {
      color: theme.textMuted,
    },
    statValue: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "900",
    },
    summary: {
      color: theme.textBodySoft,
      fontSize: 15,
      lineHeight: 22,
    },
    title: {
      color: theme.text,
    },
    weakBlock: {
      gap: Spacing.sm,
    },
    weakChip: {
      backgroundColor: theme.warningWash,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
    },
    weakChipText: {
      color: theme.text,
    },
    weakEmpty: {
      color: theme.textMuted,
    },
    weakScroll: {
      maxHeight: 120,
    },
    weakTitle: {
      color: theme.text,
    },
    weakWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
  });
}
