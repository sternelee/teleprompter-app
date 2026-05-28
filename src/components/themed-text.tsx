import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code' | 'heading' | 'body';
  themeColor?: ThemeColor;
  weight?: '400' | '500' | '600' | '700' | '800' | '900';
};

export function ThemedText({ style, type = 'default', themeColor, weight, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles.base,
        type === 'default' && styles.default,
        type === 'body' && styles.body,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'heading' && styles.heading,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        weight && { fontWeight: weight },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Fonts?.sans ?? 'Nunito',
    letterSpacing: 0.01,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0.01,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.02,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0.01,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '500',
    letterSpacing: 0.01,
    color: '#725d42',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 48,
    letterSpacing: 0.02,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: 0.02,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: 0.02,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontWeight: '600',
    color: '#19c8b9',
    letterSpacing: 0.02,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontWeight: '600',
    color: '#19c8b9',
    letterSpacing: 0.02,
  },
  code: {
    fontFamily: Fonts?.mono ?? 'monospace',
    fontWeight: Platform.select({ android: '700', default: '600' }) as any,
    fontSize: 12,
    letterSpacing: 0.01,
  },
});
