import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import {
  dictionaries,
  type Language,
  type TranslationKeys,
} from "@/i18n/strings";

const LANGUAGE_KEY = "app_language";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? P extends ""
      ? K
      : `${P}.${K}`
    : Leaves<T[K], P extends "" ? K : `${P}.${K}`>;
}[keyof T & string];

export type MessageKey = Leaves<TranslationKeys>;

export type TranslateParams = Record<string, string | number>;

type I18nState = {
  language: Language;
  isLanguageReady: boolean;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
};

const I18nContext = createContext<I18nState | null>(null);

function detectDeviceLanguage(): Language {
  try {
    const locale =
      Platform.OS === "web"
        ? typeof navigator !== "undefined"
          ? navigator.language
          : "en"
        : Intl.DateTimeFormat().resolvedOptions().locale;

    if (locale?.toLowerCase().startsWith("zh")) {
      return "zh";
    }
  } catch {
    // Intl can be unavailable on some Hermes builds — fall through to English.
  }

  return "en";
}

function resolveMessage(language: Language, key: MessageKey): string {
  const segments = key.split(".");
  let node: unknown = dictionaries[language];

  for (const segment of segments) {
    if (typeof node !== "object" || node === null) {
      return key;
    }
    node = (node as Record<string, unknown>)[segment];
  }

  return typeof node === "string" ? node : key;
}

function interpolate(message: string, params?: TranslateParams): string {
  if (!params) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLanguageReady, setIsLanguageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(LANGUAGE_KEY)
      .then((stored) => {
        if (cancelled) return;

        if (stored === "en" || stored === "zh") {
          setLanguageState(stored);
        } else {
          setLanguageState(detectDeviceLanguage());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLanguageState(detectDeviceLanguage());
        }
      })
      .finally(() => {
        if (!cancelled) setIsLanguageReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    void AsyncStorage.setItem(LANGUAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) =>
      interpolate(resolveMessage(language, key), params),
    [language],
  );

  const value = useMemo<I18nState>(
    () => ({ language, isLanguageReady, setLanguage, t }),
    [isLanguageReady, language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export type { Language };
