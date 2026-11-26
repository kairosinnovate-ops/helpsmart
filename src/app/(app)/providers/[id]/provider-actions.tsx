"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Share2, Flag } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Alert, Button, ButtonLink, Textarea } from "@/components/ui";

export function ProviderActions({ providerId, signedIn, verified, saved, quoteOnly }: { providerId: string; signedIn: boolean; verified: boolean; saved: boolean; quoteOnly: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const { run, busy, error } = useAction();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const loginHref = `/login?next=/providers/${providerId}`;

  if (!signedIn) {
    return (
      <div className="space-y-2">
        <ButtonLink href={loginHref} className="w-full">{t("provider.bookNow")}</ButtonLink>
        <ButtonLink href={loginHref} variant="secondary" className="w-full">{t("provider.requestQuote")}</ButtonLink>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {!quoteOnly && <ButtonLink href={verified ? `/providers/${providerId}/book` : `/account/verify?next=/providers/${providerId}/book`} className="w-full">{t("provider.bookNow")}</ButtonLink>}
      <ButtonLink href={verified ? `/providers/${providerId}/book?quote=1` : `/account/verify?next=/providers/${providerId}/book?quote=1`} variant={quoteOnly ? "primary" : "secondary"} className="w-full">{t("provider.requestQuote")}</ButtonLink>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={!verified}
          loading={busy}
          onClick={async () => {
            const r = await run<{ id: string }>("/api/v1/conversations", { otherUid: providerId }, { refresh: false });
            if (r) router.push(`/messages/${r.id}`);
          }}
        >
          <MessageCircle className="size-4" /> {t("provider.message")}
        </Button>
        <Button variant="secondary" onClick={() => run("/api/v1/providers/saved", { providerId, save: !saved })} aria-pressed={saved}>
          <Heart className={saved ? "size-4 fill-danger stroke-danger" : "size-4"} /> {saved ? t("provider.saved") : t("provider.save")}
        </Button>
      </div>
      <div className="flex justify-between pt-2 text-sm">
        <button type="button" className="inline-flex items-center gap-1 font-medium text-trust" onClick={() => { void navigator.clipboard?.writeText(window.location.href); }}>
          <Share2 className="size-4" /> {t("provider.share")}
        </button>
        <button type="button" className="inline-flex items-center gap-1 font-medium text-muted hover:text-danger" onClick={() => setReporting((r) => !r)} aria-expanded={reporting}>
          <Flag className="size-4" /> {t("provider.report")}
        </button>
      </div>
      {reporting && !reported && (
        <form className="space-y-2 pt-2" onSubmit={async (e) => { e.preventDefault(); const r = await run("/api/v1/reports", { type: "profile", subjectId: providerId, description: reason }, { refresh: false }); if (r) setReported(true); }}>
          <label htmlFor="report-reason" className="sr-only">{t("provider.report")}</label>
          <Textarea id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} required />
          <Button type="submit" variant="danger" size="sm" loading={busy}>{t("common.submit")}</Button>
        </form>
      )}
      {reported && <Alert tone="success">{t("account.supportSent")}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
