import { ShieldCheck } from "lucide-react";
import type { TFunction } from "@/lib/i18n/core";
import { ButtonLink } from "@/components/ui";

export function VerifyRequired({ t, next }: { t: TFunction; next?: string }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] border border-trust/15 bg-trust-50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-trust text-smart"><ShieldCheck className="size-5" aria-hidden /></span>
        <div>
          <p className="font-semibold text-trust">{t("verify.title")}</p>
          <p className="text-sm text-ink/75">{t("verify.required")}</p>
        </div>
      </div>
      <ButtonLink href={`/account/verify${next ? `?next=${encodeURIComponent(next)}` : ""}`} size="sm">{t("verify.verifyNow")}</ButtonLink>
    </div>
  );
}
