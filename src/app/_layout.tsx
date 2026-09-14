import { useEffect } from "react";
import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Platform, StatusBar, useColorScheme } from "react-native";

import { nunitoFonts } from "@/constants/fonts";
import { Colors } from "@/constants/theme";
import { AppProvider } from "@/contexts/app-context";
import { I18nProvider } from "@/i18n";

// Keep the splash screen up while the bundled Nunito faces load so text
// never flashes in with the fallback system font.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already prevented or not running under a splash screen (e.g. web) */
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  // On web the full Nunito family is loaded from Google Fonts by
  // src/global.css, so there is nothing to load here.
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS === "web" ? {} : nunitoFonts,
  );

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
            <Stack.Screen name="vocabulary" />
            <Stack.Screen name="teleprompter" />
          </Stack>
        </AppProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
