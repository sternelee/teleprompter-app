import { Platform } from "react-native";

// ===== Animal Crossing Style Design System =====

export interface ThemeColors {
  // Backgrounds
  background: string;
  backgroundContent: string;
  backgroundElement: string;
  backgroundSelected: string;

  // Text
  text: string;
  textBody: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;

  // Primary (mint teal)
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryBg: string;

  // Borders
  border: string;
  borderHover: string;

  // Status
  spoken: string;
  current: string;
  error: string;

  // Focus
  focusYellow: string;

  // 3D Shadow colors
  shadowBtn: string;
  shadowInput: string;
}

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    // Backgrounds
    background: "#f8f8f0",
    backgroundContent: "#f7f3df",
    backgroundElement: "#f0e8d8",
    backgroundSelected: "#e6f9f6",

    // Text
    text: "#794f27",
    textBody: "#725d42",
    textSecondary: "#9f927d",
    textMuted: "#8a7b66",
    textDisabled: "#c4b89e",

    // Primary (mint teal)
    primary: "#19c8b9",
    primaryHover: "#3dd4c6",
    primaryActive: "#11a89b",
    primaryBg: "#e6f9f6",

    // Borders
    border: "#c4b89e",
    borderHover: "#a89878",

    // Status
    spoken: "#6fba2c",
    current: "#f5c31c",
    error: "#e05a5a",

    // Focus
    focusYellow: "#ffcc00",

    // 3D Shadow colors
    shadowBtn: "#bdaea0",
    shadowInput: "#d4c9b4",
  },
  dark: {
    background: "#2b2118",
    backgroundContent: "#3d3028",
    backgroundElement: "#4a3d32",
    backgroundSelected: "#1a4a45",

    text: "#e8d5bc",
    textBody: "#d4c4a8",
    textSecondary: "#a89878",
    textMuted: "#9c8b74",
    textDisabled: "#6b5e50",

    primary: "#3dd4c6",
    primaryHover: "#5ce0d4",
    primaryActive: "#2bc4b6",
    primaryBg: "#1a4a45",

    border: "#6b5e50",
    borderHover: "#8a7b66",

    spoken: "#7ec94a",
    current: "#f7d04d",
    error: "#e87a7a",

    focusYellow: "#e0b800",

    shadowBtn: "#1f1811",
    shadowInput: "#241d15",
  },
};

/**
 * Semantic surfaces / overlays that are not part of the base color ramp.
 * Kept separate so `ThemeColor` stays a small, stable union for <ThemedView type=... />.
 */
export interface ThemeTokens {
  /** Raised card surface (session cards, review cards). */
  card: string;
  /** Beige "secondary button / chip" surface. */
  chip: string;
  /** Segmented control track. */
  tabBar: string;
  /** Neutral status pill. */
  neutral: string;
  /** Error card surface. */
  errorSurface: string;
  /** Readable green on a success-wash surface. */
  successText: string;
  /** Placeholder text inside inputs. */
  placeholder: string;

  /** Hairline borders, strongest → faintest. */
  borderInput: string;
  borderBubble: string;
  borderSoft: string;
  borderFaint: string;

  /** Softened body copy, strongest → faintest. */
  textBodySoft: string;
  textSoft: string;
  textSofter: string;
  textSoftest: string;

  /** Tinted washes used behind status pills. */
  primaryWash: string;
  successWash: string;
  successWashStrong: string;
  warningWash: string;
  errorBorder: string;

  /** Word highlight while it is the active target. */
  highlightBg: string;
  highlightText: string;

  /** Foregrounds drawn on top of the pastel NookPalette bubbles. */
  onBubbleDim: string;
  onBubbleSubtle: string;
  onBubbleStrong: string;
}

const lightTokens: ThemeTokens = {
  card: "#fff9ef",
  chip: "#f1ead7",
  tabBar: "#efe7d5",
  neutral: "#ece6d8",
  errorSurface: "#fff0f0",
  successText: "#4f7f2c",
  placeholder: "rgba(121, 79, 39, 0.45)",

  borderInput: "rgba(121, 79, 39, 0.14)",
  borderBubble: "rgba(121, 79, 39, 0.16)",
  borderSoft: "rgba(121, 79, 39, 0.12)",
  borderFaint: "rgba(121, 79, 39, 0.10)",

  textBodySoft: "rgba(121, 79, 39, 0.78)",
  textSoft: "rgba(121, 79, 39, 0.72)",
  textSofter: "rgba(121, 79, 39, 0.62)",
  textSoftest: "rgba(121, 79, 39, 0.58)",

  primaryWash: "rgba(25, 200, 185, 0.12)",
  successWash: "rgba(111, 186, 44, 0.16)",
  successWashStrong: "rgba(111, 186, 44, 0.22)",
  warningWash: "rgba(255, 209, 102, 0.24)",
  errorBorder: "rgba(224, 90, 90, 0.24)",

  highlightBg: "rgba(255, 255, 255, 0.82)",
  highlightText: "#6a4a1f",

  onBubbleDim: "rgba(255, 255, 255, 0.18)",
  onBubbleSubtle: "rgba(255, 255, 255, 0.35)",
  onBubbleStrong: "rgba(255, 255, 255, 0.75)",
};

const darkTokens: ThemeTokens = {
  card: "#382c23",
  chip: "#4a3d32",
  tabBar: "#33291f",
  neutral: "#463a2e",
  errorSurface: "#43272a",
  successText: "#8fd45f",
  placeholder: "rgba(232, 213, 188, 0.42)",

  borderInput: "rgba(232, 213, 188, 0.20)",
  borderBubble: "rgba(232, 213, 188, 0.18)",
  borderSoft: "rgba(232, 213, 188, 0.14)",
  borderFaint: "rgba(232, 213, 188, 0.10)",

  textBodySoft: "rgba(232, 213, 188, 0.80)",
  textSoft: "rgba(232, 213, 188, 0.74)",
  textSofter: "rgba(232, 213, 188, 0.62)",
  textSoftest: "rgba(232, 213, 188, 0.56)",

  primaryWash: "rgba(61, 212, 198, 0.16)",
  successWash: "rgba(126, 201, 74, 0.18)",
  successWashStrong: "rgba(126, 201, 74, 0.26)",
  warningWash: "rgba(247, 208, 77, 0.20)",
  errorBorder: "rgba(232, 122, 122, 0.32)",

  highlightBg: "rgba(232, 213, 188, 0.92)",
  highlightText: "#2b2118",

  onBubbleDim: "rgba(255, 255, 255, 0.18)",
  onBubbleSubtle: "rgba(255, 255, 255, 0.35)",
  onBubbleStrong: "rgba(255, 255, 255, 0.75)",
};

export const Tokens: { light: ThemeTokens; dark: ThemeTokens } = {
  light: lightTokens,
  dark: darkTokens,
};

export type ThemeColor = keyof ThemeColors;

/** Fully-resolved palette handed out by `useTheme()`. */
export type ThemePalette = ThemeColors & ThemeTokens;

export const Fonts = Platform.select({
  ios: {
    sans: "Nunito",
    serif: "Nunito",
    rounded: "Nunito",
    mono: "Nunito",
  },
  default: {
    sans: "Nunito",
    serif: "Nunito",
    rounded: "Nunito",
    mono: "Nunito",
  },
  web: {
    sans: "Nunito, -apple-system, BlinkMacSystemFont, sans-serif",
    serif: "Nunito, Georgia, serif",
    rounded: "Nunito, sans-serif",
    mono: "Nunito, monospace",
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  // Legacy aliases for backward compat during migration
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 12,
  base: 18,
  lg: 24,
  pill: 50,
} as const;

export interface ThemeShadows {
  btn: object;
  btnHover: object;
  btnActive: object;
  input: object;
  inputSmall: object;
  card: object;
}

/** Builds the 3D "Animal Crossing" shadow set for the active palette. */
export function createShadows(theme: ThemePalette): ThemeShadows {
  const isDark = theme.background === Colors.dark.background;

  return {
    btn: {
      shadowColor: theme.shadowBtn,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: isDark ? 0.55 : 1,
      shadowRadius: 0,
      elevation: 0,
    },
    btnHover: {
      shadowColor: theme.shadowBtn,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.55 : 1,
      shadowRadius: 0,
      elevation: 0,
    },
    btnActive: {
      shadowColor: theme.shadowBtn,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.55 : 1,
      shadowRadius: 0,
      elevation: 0,
    },
    input: {
      shadowColor: theme.shadowInput,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.5 : 1,
      shadowRadius: 0,
      elevation: 0,
    },
    inputSmall: {
      shadowColor: theme.shadowInput,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.5 : 1,
      shadowRadius: 0,
      elevation: 0,
    },
    card: {
      shadowColor: isDark ? "#000000" : "rgba(61, 52, 40, 0.10)",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.4 : 1,
      shadowRadius: 10,
      elevation: 5,
    },
  };
}

export const MaxContentWidth = 800;

// App-specific NookPhone-inspired accent palette for segments.
// Pastels with strong contrast text, readable on both light and dark canvases.
export const NookPalette = [
  { bg: "#f8a6b2", text: "#fff" },
  { bg: "#b77dee", text: "#fff" },
  { bg: "#889df0", text: "#fff" },
  { bg: "#f7cd67", text: "#725d42" },
  { bg: "#e59266", text: "#fff" },
  { bg: "#82d5bb", text: "#fff" },
  { bg: "#8ac68a", text: "#fff" },
  { bg: "#fc736d", text: "#fff" },
  { bg: "#d1da49", text: "#3d5a1a" },
  { bg: "#ecdf52", text: "#725d42" },
  { bg: "#9a835a", text: "#fff" },
  { bg: "#e18c6f", text: "#fff" },
] as const;
