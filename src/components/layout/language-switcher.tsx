"use client";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LOCALE_COOKIE, LOCALE_NAMES } from "@/lib/i18n/core";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/domain/types";

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { locale, t } = useT();
  const router = useRouter();
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink">
      <Globe className="size-4 text-trust" aria-hidden />
      <span className="sr-only">{t("nav.language")}</span>
      <select
        value={locale}
        onChange={(e) => {
          document.cookie = `${LOCALE_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className="cursor-pointer appearance-none bg-transparent pr-1 font-medium focus:outline-none"
      >
        {(Object.keys(LOCALE_NAMES) as Locale[]).map((l) => (
          <option key={l} value={l}>
            {compact ? l.toUpperCase() : LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
