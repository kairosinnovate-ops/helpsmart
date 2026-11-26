"use client";
import { createContext, useContext, useMemo } from "react";
import { makeT, type TFunction } from "./core";
import type { Locale } from "@/domain/types";

const Ctx = createContext<{ locale: Locale; t: TFunction }>({ locale: "en", t: makeT("en") });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx);
}
