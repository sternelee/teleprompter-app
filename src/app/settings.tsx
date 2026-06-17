import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing, Radius, Shadows, MaxContentWidth } from "@/constants/theme";
import { useApp } from "@/contexts/app-context";
import { generateDialogue } from "@/services/openai";

export default function SettingsScreen() {
  const router = useRouter();
  const { apiKey, setApiKey, clearStoredApiKey } = useApp();
  const [pressed, setPressed] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [clearPressed, setClearPressed] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <ThemedText type="link" style={styles.backLink}>
              ← Back
            </ThemedText>
          </Pressable>
          <ThemedText type="heading" style={styles.title}>
            Settings
          </ThemedText>
          <View style={{ width: 50 }} />
        </View>

        <ThemedView type="backgroundContent" style={styles.card}>
          <View style={styles.iconRow}>
            <ThemedText style={styles.keyBadge}>KEY</ThemedText>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              DeepSeek API Key
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Your API key is stored only in memory and never sent to any server
            other than DeepSeek.
          </ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Paste your DeepSeek API key"
            placeholderTextColor="#c4b89e"
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
          onPress={async () => {
            setTestStatus("testing");
            setTestMessage("Checking connection…");
            try {
              await generateDialogue(
                "A one-line English greeting",
                apiKey,
              );
              setTestStatus("success");
              setTestMessage("Key is valid and DeepSeek is reachable.");
            } catch (error) {
              setTestStatus("error");
              setTestMessage(
                error instanceof Error
                  ? error.message
                  : "Could not verify the key. Please check it and try again.",
              );
            }
          }}
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
                ? "Testing…"
                : "Test connection"}
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
              <ThemedText
                type="smallBold"
                style={styles.clearButtonText}
              >
                Clear stored key
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
              Done
            </ThemedText>
          </ThemedView>
        </Pressable>
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
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  backLink: {
    fontSize: 16,
    width: 50,
  },
  title: {
    textAlign: "center",
    flex: 1,
    color: "#794f27",
  },
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: "#c4b89e",
    ...Shadows.input,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  keyBadge: {
    backgroundColor: "#e6f9f6",
    borderRadius: Radius.sm,
    color: "#19c8b9",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  cardTitle: {
    color: "#794f27",
    letterSpacing: 0.02,
  },
  testButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: "center",
    ...Shadows.btn,
  },
  disabledButton: {
    opacity: 0.6,
  },
  testMessageCard: {
    borderRadius: Radius.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  testMessageSuccess: {
    backgroundColor: "rgba(111, 186, 44, 0.12)",
  },
  testMessageError: {
    backgroundColor: "#fff0f0",
  },
  testMessageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  testMessageTextSuccess: {
    color: "#4f7f2c",
  },
  testMessageTextError: {
    color: "#e05a5a",
  },
  clearButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: "center",
    ...Shadows.btn,
  },
  clearButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  clearButtonText: {
    color: "#794f27",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.02,
  },
  input: {
    borderWidth: 2.5,
    borderColor: "#c4b89e",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    fontFamily: "Nunito",
    fontWeight: "500",
    color: "#725d42",
    backgroundColor: "#f7f3df",
    marginTop: Spacing.sm,
    ...Shadows.input,
  },
  doneButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: "center",
    ...Shadows.btn,
  },
  doneButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.02,
  },
});
