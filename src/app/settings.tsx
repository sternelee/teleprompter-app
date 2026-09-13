import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
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
import { useI18n } from "@/i18n";
import { generateDialogue } from "@/services/openai";

export default function SettingsScreen() {
  const router = useRouter();
  const {
    apiKey,
    setApiKey,
    clearStoredApiKey,
    sessions,
    clearAllSessions,
  } = useApp();
  const { t, language, setLanguage } = useI18n();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pressed, setPressed] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [clearPressed, setClearPressed] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestMessage(t("settings.checking"));

    try {
      await generateDialogue("A one-line English greeting", apiKey);
      setTestStatus("success");
      setTestMessage(t("settings.testSuccess"));
    } catch (error) {
      setTestStatus("error");
      setTestMessage(
        error instanceof Error ? error.message : t("settings.testFailed"),
      );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ThemedText type="link" style={styles.backLink}>
              {t("common.back")}
            </ThemedText>
          </Pressable>
          <ThemedText type="heading" style={styles.title}>
            {t("settings.title")}
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ThemedView type="backgroundContent" style={styles.card}>
          <View style={styles.iconRow}>
            <ThemedText style={styles.keyBadge}>KEY</ThemedText>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              {t("settings.apiKeyTitle")}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t("settings.apiKeyNote")}
          </ThemedText>
          <TextInput
            style={styles.input}
            placeholder={t("settings.apiKeyPlaceholder")}
            placeholderTextColor={theme.placeholder}
            value={apiKey}
            onChangeText={(key) => {
              setApiKey(key);
              if (testStatus !== "idle") {
                setTestStatus("idle");
                setTestMessage(null);
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          {testMessage ? (
            <ThemedView
              style={[
                styles.testMessageCard,
                testStatus === "success" && styles.testMessageSuccess,
                testStatus === "error" && styles.testMessageError,
              ]}
            >
              <ThemedText
                type="small"
                style={[
                  styles.testMessageText,
                  testStatus === "success" && styles.testMessageTextSuccess,
                  testStatus === "error" && styles.testMessageTextError,
                ]}
              >
                {testMessage}
              </ThemedText>
            </ThemedView>
          ) : null}
        </ThemedView>

        <Pressable
          disabled={!apiKey || testStatus === "testing"}
          onPress={handleTestConnection}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
        >
          <ThemedView
            type="primary"
            style={[
              styles.testButton,
              pressed && styles.doneButtonActive,
              (!apiKey || testStatus === "testing") && styles.disabledButton,
            ]}
          >
            <ThemedText type="smallBold" style={styles.doneButtonText}>
              {testStatus === "testing"
                ? t("settings.testing")
                : t("settings.testConnection")}
            </ThemedText>
          </ThemedView>
        </Pressable>

        {apiKey ? (
          <Pressable
            onPress={() => {
              clearStoredApiKey();
              setTestStatus("idle");
              setTestMessage(null);
            }}
            onPressIn={() => setClearPressed(true)}
            onPressOut={() => setClearPressed(false)}
          >
            <ThemedView
              type="backgroundElement"
              style={[
                styles.clearButton,
                clearPressed && styles.clearButtonActive,
              ]}
            >
              <ThemedText type="smallBold" style={styles.clearButtonText}>
                {t("settings.clearKey")}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}

        <ThemedView type="backgroundContent" style={styles.card}>
          <ThemedText type="smallBold" style={styles.cardTitle}>
            {t("settings.languageTitle")}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t("settings.languageNote")}
          </ThemedText>
          <View style={styles.languageRow}>
            {(
              [
                { label: t("settings.languageEnglish"), value: "en" },
                { label: t("settings.languageChinese"), value: "zh" },
              ] as const
            ).map((option) => {
              const isActive = language === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setLanguage(option.value)}
                  style={styles.languagePressable}
                >
                  <ThemedView
                    style={[
                      styles.languageOption,
                      isActive && styles.languageOptionActive,
                    ]}
                  >
                    <ThemedText
                      type="smallBold"
                      style={[
                        styles.languageOptionText,
                        isActive && styles.languageOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>
        </ThemedView>

        {sessions.length > 0 ? (
          <Pressable
            onPress={() => {
              if (!isClearingHistory) {
                setIsClearingHistory(true);
                return;
              }

              clearAllSessions();
              setIsClearingHistory(false);
            }}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
          >
            <ThemedView
              style={[
                styles.dangerButton,
                isClearingHistory && styles.dangerButtonArmed,
              ]}
            >
              <ThemedText style={styles.dangerButtonText}>
                {isClearingHistory
                  ? `${t("common.delete")}?`
                  : `${t("settings.clearHistory")} (${sessions.length})`}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}

        {isClearingHistory ? (
          <Pressable onPress={() => setIsClearingHistory(false)}>
            <ThemedView type="backgroundElement" style={styles.clearButton}>
              <ThemedText type="smallBold" style={styles.clearButtonText}>
                {t("common.cancel")}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.back()}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
        >
          <ThemedView
            type="primary"
            style={[styles.doneButton, pressed && styles.doneButtonActive]}
          >
            <ThemedText type="smallBold" style={styles.doneButtonText}>
              {t("common.done")}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function createStyles(theme: ThemePalette) {
  const shadows = createShadows(theme);

  return StyleSheet.create({
    backLink: {
      fontSize: 16,
      width: 64,
    },
    card: {
      borderColor: theme.border,
      borderRadius: Radius.lg,
      borderWidth: 2,
      gap: Spacing.sm,
      padding: Spacing.lg,
      ...shadows.input,
    },
    cardTitle: {
      color: theme.text,
      letterSpacing: 0.02,
    },
    clearButton: {
      alignItems: "center",
      borderRadius: Radius.pill,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    clearButtonActive: {
      transform: [{ translateY: 2 }],
      ...shadows.btnActive,
    },
    clearButtonText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 0.02,
    },
    container: {
      flex: 1,
    },
    dangerButton: {
      alignItems: "center",
      backgroundColor: theme.errorSurface,
      borderColor: theme.errorBorder,
      borderRadius: Radius.pill,
      borderWidth: 1,
      paddingVertical: Spacing.md,
    },
    dangerButtonArmed: {
      borderWidth: 2,
    },
    dangerButtonText: {
      color: theme.error,
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 0.02,
    },
    disabledButton: {
      opacity: 0.6,
    },
    doneButton: {
      alignItems: "center",
      borderRadius: Radius.pill,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    doneButtonActive: {
      transform: [{ translateY: 2 }],
      ...shadows.btnActive,
    },
    doneButtonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 0.02,
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
    iconRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: Spacing.sm,
    },
    input: {
      backgroundColor: theme.backgroundContent,
      borderColor: theme.border,
      borderRadius: Radius.pill,
      borderWidth: 2.5,
      color: theme.textBody,
      fontFamily: "Nunito",
      fontSize: 16,
      fontWeight: "500",
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      ...shadows.input,
    },
    keyBadge: {
      backgroundColor: theme.primaryBg,
      borderRadius: Radius.sm,
      color: theme.primary,
      fontSize: 12,
      fontWeight: "900",
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
    },
    languageOption: {
      alignItems: "center",
      backgroundColor: theme.chip,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    languageOptionActive: {
      backgroundColor: theme.primary,
    },
    languageOptionText: {
      color: theme.text,
    },
    languageOptionTextActive: {
      color: "#ffffff",
    },
    languagePressable: {
      flex: 1,
    },
    languageRow: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    safeArea: {
      alignSelf: "center",
      flex: 1,
      gap: Spacing.lg,
      maxWidth: MaxContentWidth,
      paddingHorizontal: Spacing.lg,
      width: "100%",
    },
    testButton: {
      alignItems: "center",
      borderRadius: Radius.pill,
      paddingVertical: Spacing.md,
      ...shadows.btn,
    },
    testMessageCard: {
      borderRadius: Radius.base,
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    testMessageError: {
      backgroundColor: theme.errorSurface,
    },
    testMessageSuccess: {
      backgroundColor: theme.successWash,
    },
    testMessageText: {
      fontSize: 13,
      lineHeight: 18,
    },
    testMessageTextError: {
      color: theme.error,
    },
    testMessageTextSuccess: {
      color: theme.successText,
    },
    title: {
      color: theme.text,
      flex: 1,
      textAlign: "center",
    },
  });
}
