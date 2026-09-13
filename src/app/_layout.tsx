import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { StatusBar, useColorScheme } from "react-native";

import { Colors } from "@/constants/theme";
import { AppProvider } from "@/contexts/app-context";
import { I18nProvider } from "@/i18n";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <I18nProvider>
        <AppProvider>
          <StatusBar
            backgroundColor={theme.background}
            barStyle={isDark ? "light-content" : "dark-content"}
          />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="settings" options={{ presentation: "modal" }} />
            <Stack.Screen name="teleprompter" />
          </Stack>
        </AppProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
