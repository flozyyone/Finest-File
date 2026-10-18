import React, { createContext, useContext, useMemo } from "react";
import { SupportedLanguage, LanguageInfo, TranslationDictionary, TextDirection } from "./types";
import { en } from "./locales/en";
import { tr } from "./locales/tr";
import { ur } from "./locales/ur";
import { fr } from "./locales/fr";
import { de } from "./locales/de";
import { ar } from "./locales/ar";
import { ru } from "./locales/ru";
import { es } from "./locales/es";

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl" },
  { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr" },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr" },
];

export const DICTIONARIES: Record<SupportedLanguage, TranslationDictionary> = {
  en,
  tr,
  ur,
  fr,
  de,
  ar,
  ru,
  es,
};

export function getLanguageInfo(code: string): LanguageInfo {
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return match || SUPPORTED_LANGUAGES[0]; // fallback to English
}

export function detectInitialLanguage(): SupportedLanguage {
  if (typeof navigator !== "undefined" && navigator.language) {
    const raw = navigator.language.toLowerCase();
    for (const lang of SUPPORTED_LANGUAGES) {
      if (raw.startsWith(lang.code)) {
        return lang.code;
      }
    }
  }
  return "en";
}

export function formatWithParams(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce((acc, [key, val]) => {
    return acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(val));
  }, template);
}

export function getDictionary(lang: SupportedLanguage): TranslationDictionary {
  return DICTIONARIES[lang] || DICTIONARIES.en;
}

interface I18nContextValue {
  language: SupportedLanguage;
  dir: TextDirection;
  dict: TranslationDictionary;
  setLanguage: (lang: SupportedLanguage) => void;
  formatNumber: (n: number) => string;
  formatDate: (timestampSeconds: number) => string;
  formatDateTime: (timestampSeconds: number) => string;
}

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  dir: "ltr",
  dict: en,
  setLanguage: () => {},
  formatNumber: (n) => n.toLocaleString(),
  formatDate: (s) => new Date(s * 1000).toLocaleDateString(),
  formatDateTime: (s) => new Date(s * 1000).toLocaleString(),
});

export const I18nProvider: React.FC<{
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  children: React.ReactNode;
}> = ({ language, onLanguageChange, children }) => {
  const langInfo = useMemo(() => getLanguageInfo(language), [language]);
  const dict = useMemo(() => getDictionary(langInfo.code), [langInfo.code]);

  const formatNumber = useMemo(() => {
    return (n: number) => n.toLocaleString(langInfo.code);
  }, [langInfo.code]);

  const formatDate = useMemo(() => {
    return (timestampSeconds: number) => {
      const d = new Date(timestampSeconds * 1000);
      return d.toLocaleDateString(langInfo.code, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };
  }, [langInfo.code]);

  const formatDateTime = useMemo(() => {
    return (timestampSeconds: number) => {
      const d = new Date(timestampSeconds * 1000);
      return d.toLocaleString(langInfo.code, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };
  }, [langInfo.code]);

  const value = useMemo(
    () => ({
      language: langInfo.code,
      dir: langInfo.dir,
      dict,
      setLanguage: onLanguageChange,
      formatNumber,
      formatDate,
      formatDateTime,
    }),
    [langInfo, dict, onLanguageChange, formatNumber, formatDate, formatDateTime]
  );

  return React.createElement(I18nContext.Provider, { value }, children);
};

export function useI18n() {
  return useContext(I18nContext);
}
