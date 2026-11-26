"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

/**
 * Client-side language context for the bilingual (English/Gujarati) site.
 * Preference is remembered in localStorage.
 */
export const SUPPORTED_LANGS = ["en", "gu"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const DEFAULT_LANG: SupportedLang = "en";

export function useLanguage() {
  const [lang, setLangState] = useState<SupportedLang>(DEFAULT_LANG);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ranj_lang") as SupportedLang | null;
    const initial = stored && SUPPORTED_LANGS.includes(stored) ? stored : DEFAULT_LANG;
    setLangState(initial);
    setReady(true);
  }, []);

  const setLang = useCallback((next: SupportedLang) => {
    setLangState(next);
    try { localStorage.setItem("ranj_lang", next); } catch {}
  }, []);

  return { lang, setLang, ready, isGujarati: lang === "gu" };
}

/** Bilingual text helper: returns the value for the current language. */
export function t<T extends Record<string, string>>(
  item: T | null | undefined,
  lang: SupportedLang
): string {
  if (!item) return "";
  return item[`name_${lang}`] ?? item.name_en ?? "";
}

export function tx<T extends Record<string, string>>(
  item: T | null | undefined,
  lang: SupportedLang,
  fallbackKey: keyof T = "description_en"
): string {
  if (!item) return "";
  return item[`description_${lang}`] ?? item[fallbackKey] ?? "";
}
