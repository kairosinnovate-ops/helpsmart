"use client";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useT } from "@/lib/i18n/client";
import { Alert, Button, Checkbox } from "@/components/ui";

export function StartVerification({ disabled }: { disabled?: boolean }) {
  const { t } = useT();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ redirectUrl: string }>("/api/identity/start", { body: { consent } });
      // Full-page redirect to the official Fayda (or dev fixture) authorisation page.
      window.location.assign(r.redirectUrl);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : t("common.error"));
      setBusy(false);
    }
  }
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl bg-canvas p-4">
        <p className="mb-2 text-sm font-semibold text-ink">{t("verify.consentTitle")}</p>
        <Checkbox id="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t("verify.consent")} />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button size="lg" className="w-full" disabled={!consent || disabled} loading={busy} onClick={start}>
        {t("verify.cta")}
      </Button>
    </div>
  );
}
