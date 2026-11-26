import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ExternalLink, Lock } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { identityProvider } from "@/server/identity/providers";
import { Alert, ButtonLink, Card } from "@/components/ui";
import { IdentityPill } from "@/components/trust";
import { StartVerification } from "./start-verification";

export const metadata: Metadata = { title: "Verify your identity" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ result?: string; next?: string }> }) {
  const sp = await searchParams;
  const u = await pageUser("/account/verify");
  const { t } = await getT();
  const avail = identityProvider();
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/home";
  const status = u.doc.identityStatus;
  const resultTone = sp.result === "verified" ? "success" : sp.result === "cancelled" || sp.result === "additional_review" ? "warning" : "danger";

  return (
    <div className="mx-auto max-w-xl">
      {sp.result && <Alert tone={resultTone} className="mb-6">{t(`verify.result.${sp.result}`)}</Alert>}
      <Card className="p-6 sm:p-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-trust text-smart"><ShieldCheck className="size-7" aria-hidden /></span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-trust sm:text-3xl">{t("verify.title")}</h1>
        <p className="mt-2 leading-relaxed text-ink/75">{t("verify.body")}</p>
        <div className="mt-4"><IdentityPill status={status} t={t} /></div>

        {status === "fayda_verified" ? (
          <div className="mt-8 space-y-4">
            <Alert tone="success">{t("verify.result.verified")}</Alert>
            <ButtonLink href={next} className="w-full">{t("auth.continue")}</ButtonLink>
          </div>
        ) : !avail.ok ? (
          <div className="mt-8 space-y-4">
            <Alert tone="info" title={t("verify.unavailableTitle")}>{t("verify.unavailableBody")}</Alert>
            <ButtonLink href={next} variant="secondary" className="w-full">{t("verify.skip")}</ButtonLink>
          </div>
        ) : (
          <>
            {avail.provider.source === "dev_fixture" && <Alert tone="warning" className="mt-6">{t("verify.devFixture")}</Alert>}
            <h2 className="mt-8 font-semibold text-ink">{t("verify.what")}</h2>
            <ol className="mt-3 space-y-3 text-sm text-ink/80">
              {[t("verify.step1"), t("verify.step2"), t("verify.step3")].map((s, i) => (
                <li key={s} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-trust-50 text-xs font-bold text-trust">{i + 1}</span>{s}</li>
              ))}
            </ol>
            <StartVerification disabled={status === "suspended"} />
            <Link href={next} className="mt-4 block text-center text-sm font-medium text-muted hover:text-trust">{t("verify.skip")}</Link>
          </>
        )}
        <p className="mt-8 flex items-start gap-2 border-t border-line pt-5 text-xs text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t("provider.identityNote")} <Link href="/legal/identity-consent" className="inline-flex items-center gap-0.5 font-semibold text-trust">{t("verify.consentTitle")} <ExternalLink className="size-3" /></Link></span>
        </p>
      </Card>
    </div>
  );
}
