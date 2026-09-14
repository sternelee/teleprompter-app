import { Platform, type TextStyle } from "react-native";
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from "@expo-google-fonts/nunito";

/**
 * Bundled Nunito faces, loaded once in `app/_layout.tsx` via `useFonts`.
 * Each face registers under its own family name because React Native's
 * native text stacks do not resolve `fontWeight` against a custom family —
 * styles must point at the exact face they want.
 */
export const nunitoFonts = {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
};

/** Weight used when a style declares no explicit `fontWeight`. */
export const DEFAULT_NUNITO_WEIGHT = "500";

const NATIVE_FAMILIES: Record<string, string> = {
  normal: "Nunito_400Regular",
  "100": "Nunito_400Regular",
  "200": "Nunito_400Regular",
  "300": "Nunito_400Regular",
  "400": "Nunito_400Regular",
  "500": "Nunito_500Medium",
  "600": "Nunito_600SemiBold",
  "700": "Nunito_700Bold",
  "800": "Nunito_800ExtraBold",
  "900": "Nunito_900Black",
  bold: "Nunito_700Bold",
};

/** Web mono stack for the `code` text type (matches global.css --font-mono). */
export const webMonoStack =
  "Nunito, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

/**
 * Resolve the font family for a given weight.
 *
 * - Native: the exact bundled Nunito face (`Nunito_700Bold` etc.).
 * - Web: the plain `Nunito` family — the full weight range is already
 *   loaded from Google Fonts by `src/global.css`.
 */
export function nunitoFamily(
  fontWeight?: TextStyle["fontWeight"],
): string {
  if (Platform.OS === "web") {
    return "Nunito";
  }

  const key = fontWeight === undefined || fontWeight === null
    ? DEFAULT_NUNITO_WEIGHT
    : String(fontWeight);

  return NATIVE_FAMILIES[key] ?? NATIVE_FAMILIES[DEFAULT_NUNITO_WEIGHT];
}
