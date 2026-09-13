/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useMemo } from "react";

import { Colors, Tokens, type ThemePalette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useTheme(): ThemePalette {
  const scheme = useColorScheme();

  return useMemo(() => {
    const variant = scheme === "dark" ? "dark" : "light";
    return { ...Colors[variant], ...Tokens[variant] };
  }, [scheme]);
}
