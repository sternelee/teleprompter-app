import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Radius, Shadows, MaxContentWidth } from '@/constants/theme';
import { useApp } from '@/contexts/app-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { apiKey, setApiKey } = useApp();
  const [pressed, setPressed] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <ThemedText type="link" style={styles.backLink}>← Back</ThemedText>
          </Pressable>
          <ThemedText type="heading" style={styles.title}>Settings</ThemedText>
          <View style={{ width: 50 }} />
        </View>

        <ThemedView type="backgroundContent" style={styles.card}>
          <View style={styles.iconRow}>
            <ThemedText style={styles.keyBadge}>KEY</ThemedText>
            <ThemedText type="smallBold" style={styles.cardTitle}>DeepSeek API Key</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Your API key is stored only in memory and never sent to any server other than DeepSeek.
          </ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Paste your DeepSeek API key"
            placeholderTextColor="#c4b89e"
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </ThemedView>

        <Pressable
          onPress={() => router.back()}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
        >
          <ThemedView
            type="primary"
            style={[styles.doneButton, pressed && styles.doneButtonActive]}
          >
            <ThemedText type="smallBold" style={styles.doneButtonText}>Done</ThemedText>
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
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  backLink: {
    fontSize: 16,
    width: 50,
  },
  title: {
    textAlign: 'center',
    flex: 1,
    color: '#794f27',
  },
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: '#c4b89e',
    ...Shadows.input,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  keyBadge: {
    backgroundColor: '#e6f9f6',
    borderRadius: Radius.sm,
    color: '#19c8b9',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
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
    marginTop: Spacing.sm,
    ...Shadows.input,
  },
  doneButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: 'center',
    ...Shadows.btn,
  },
  doneButtonActive: {
    transform: [{ translateY: 2 }],
    ...Shadows.btnActive,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.02,
  },
});
