import en from "@/messages/en.json";
import am from "@/messages/am.json";
import om from "@/messages/om.json";
import ti from "@/messages/ti.json";
import so from "@/messages/so.json";
import type { Locale } from "@/domain/types";

/**
 * Minimal, dependency-free i18n. Catalogues are nested JSON; keys are dot paths.
 * Missing keys fall back to English, so partially translated locales stay usable.
 */
export type Messages = typeof en;
type Tree = { [k: string]: string | string[] | Tree };

const CATALOGUES: Record<Locale, Tree> = { en, am, om, ti, so } as unknown as Record<Locale, Tree>;

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  am: "አማርኛ",
  om: "Afaan Oromoo",
  ti: "ትግርኛ",
  so: "Soomaali",
};

export const LOCALE_COOKIE = "hs_locale";

function node(tree: Tree, key: string): unknown {
  let cur: unknown = tree;
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Tree)[part];
  }
  return cur;
}

function lookup(tree: Tree, key: string): string | undefined {
  const n = node(tree, key);
  return typeof n === "string" ? n : undefined;
}

export function makeList(locale: Locale) {
  const cat = CATALOGUES[locale] ?? CATALOGUES.en;
  return (key: string): string[] => {
    const n = node(cat, key) ?? node(CATALOGUES.en, key);
    return Array.isArray(n) ? (n as string[]) : [];
  };
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export function makeT(locale: Locale): TFunction {
  const cat = CATALOGUES[locale] ?? CATALOGUES.en;
  return (key, vars) => {
    let s = lookup(cat, key) ?? lookup(CATALOGUES.en, key) ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && v in CATALOGUES;
}

export function intlTag(locale: Locale) {
  return { en: "en-ET", am: "am-ET", om: "om-ET", ti: "ti-ET", so: "so-ET" }[locale];
}

/** Dates always render in Africa/Addis_Ababa, Gregorian calendar (Ethiopian calendar display is Phase Two). */
export function formatDate(ms: number, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  try {
    return new Intl.DateTimeFormat(intlTag(locale), { timeZone: "Africa/Addis_Ababa", ...opts }).format(ms);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", ...opts }).format(ms);
  }
}
