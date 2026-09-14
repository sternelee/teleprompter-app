import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { nunitoFamily, webMonoStack } from "@/constants/fonts";
import { ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedTextProps = TextProps & {
  type?:
    | "default"
    | "title"
    | "small"
    | "smallBold"
    | "subtitle"
    | "link"
    | "linkPrimary"
    | "code"
    | "heading"
    | "body";
  themeColor?: ThemeColor;
  weight?: "400" | "500" | "600" | "700" | "800" | "900";
};

export function ThemedText({
  style,
  type = "default",
  themeColor,
  weight,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const resolvedColor = themeColor
    ? theme[themeColor]
    : type === "body"
      ? theme.textBody
      : type === "link" || type === "linkPrimary"
        ? theme.primary
        : theme.text;

  const flattened = StyleSheet.flatten([
    styles.base,
    type === "default" && styles.default,
    type === "body" && styles.body,
    type === "title" && styles.title,
    type === "small" && styles.small,
    type === "smallBold" && styles.smallBold,
    type === "subtitle" && styles.subtitle,
    type === "heading" && styles.heading,
    type === "link" && styles.link,
    type === "linkPrimary" && styles.linkPrimary,
    type === "code" && styles.code,
    weight && { fontWeight: weight },
    { color: resolvedColor },
    style,
  ]) as TextStyle;

  // Native text stacks cannot resolve `fontWeight` against a custom family,
  // so map the effective weight onto the matching bundled Nunito face
  // (see src/constants/fonts.ts). Web keeps the CSS family stacks.
  const fontFamily =
    type === "code" && Platform.OS === "web"
      ? webMonoStack
      : nunitoFamily(flattened.fontWeight);

  return <Text style={[flattened, { fontFamily }]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    letterSpacing: 0.01,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    letterSpacing: 0.01,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    letterSpacing: 0.02,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    letterSpacing: 0.01,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: "500",
    letterSpacing: 0.01,
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 48,
    letterSpacing: 0.02,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 32,
    letterSpacing: 0.02,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: 0.02,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.02,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.02,
  },
  code: {
    fontWeight: Platform.select({ android: "700", default: "600" }) as any,
    fontSize: 12,
    letterSpacing: 0.01,
  },
});
