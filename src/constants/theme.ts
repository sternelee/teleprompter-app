import { Platform } from 'react-native';

// ===== Animal Crossing Style Design System =====

export const Colors = {
  light: {
    // Backgrounds
    background: '#f8f8f0',
    backgroundContent: '#f7f3df',
    backgroundElement: '#f0e8d8',
    backgroundSelected: '#e6f9f6',

    // Text
    text: '#794f27',
    textBody: '#725d42',
    textSecondary: '#9f927d',
    textMuted: '#8a7b66',
    textDisabled: '#c4b89e',

    // Primary (mint teal)
    primary: '#19c8b9',
    primaryHover: '#3dd4c6',
    primaryActive: '#11a89b',
    primaryBg: '#e6f9f6',

    // Borders
    border: '#c4b89e',
    borderHover: '#a89878',

    // Status
    spoken: '#6fba2c',
    current: '#f5c31c',
    error: '#e05a5a',

    // Focus
    focusYellow: '#ffcc00',

    // 3D Shadow colors
    shadowBtn: '#bdaea0',
    shadowInput: '#d4c9b4',
  },
  dark: {
    background: '#2b2118',
    backgroundContent: '#3d3028',
    backgroundElement: '#4a3d32',
    backgroundSelected: '#1a4a45',

    text: '#e8d5bc',
    textBody: '#d4c4a8',
    textSecondary: '#a89878',
    textMuted: '#8a7b66',
    textDisabled: '#6b5e50',

    primary: '#3dd4c6',
    primaryHover: '#5ce0d4',
    primaryActive: '#2bc4b6',
    primaryBg: '#1a4a45',

    border: '#6b5e50',
    borderHover: '#8a7b66',

    spoken: '#7ec94a',
    current: '#f7d04d',
    error: '#e87a7a',

    focusYellow: '#e0b800',

    shadowBtn: '#4a3d32',
    shadowInput: '#5a4d42',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'Nunito',
    serif: 'Nunito',
    rounded: 'Nunito',
    mono: 'Nunito',
  },
  default: {
    sans: 'Nunito',
    serif: 'Nunito',
    rounded: 'Nunito',
    mono: 'Nunito',
  },
  web: {
    sans: 'Nunito, -apple-system, BlinkMacSystemFont, sans-serif',
    serif: 'Nunito, Georgia, serif',
    rounded: 'Nunito, sans-serif',
    mono: 'Nunito, monospace',
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

export const Shadows = {
  btn: { shadowColor: '#bdaea0', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 0 },
  btnHover: { shadowColor: '#bdaea0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 0 },
  btnActive: { shadowColor: '#bdaea0', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 0, elevation: 0 },
  input: { shadowColor: '#d4c9b4', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 0 },
  inputSmall: { shadowColor: '#d4c9b4', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 0 },
  card: { shadowColor: 'rgba(61, 52, 40, 0.10)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
};

export const MaxContentWidth = 800;

// App-specific NookPhone-inspired accent palette for segments
export const NookPalette = [
  { bg: '#f8a6b2', text: '#fff' },
  { bg: '#b77dee', text: '#fff' },
  { bg: '#889df0', text: '#fff' },
  { bg: '#f7cd67', text: '#725d42' },
  { bg: '#e59266', text: '#fff' },
  { bg: '#82d5bb', text: '#fff' },
  { bg: '#8ac68a', text: '#fff' },
  { bg: '#fc736d', text: '#fff' },
  { bg: '#d1da49', text: '#3d5a1a' },
  { bg: '#ecdf52', text: '#725d42' },
  { bg: '#9a835a', text: '#fff' },
  { bg: '#e18c6f', text: '#fff' },
] as const;
