"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { signOut } from "@/lib/auth-client";
import { LOCALE_COOKIE, LOCALE_NAMES } from "@/lib/i18n/core";
import { RegionPicker, type RegionOption } from "@/components/forms/region-picker";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function LogoutButton() {
  const { t } = useT();
  const router = useRouter();
  return <Button variant="secondary" size="sm" onClick={async () => { await signOut(); router.push("/"); router.refresh(); }}><LogOut className="size-4" /> {t("nav.logout")}</Button>;
}

export function ProfileForm({ initial, regions }: { initial: { displayName: string; locale: string; subCityId: string; neighborhoodId: string | null }; regions: RegionOption[] }) {
  const { t } = useT();
  const { run, busy, error } = useAction();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      setSaved(false);
      document.cookie = `${LOCALE_COOKIE}=${f.locale}; path=/; max-age=31536000; samesite=lax`;
      const r = await run("/api/v1/account", { displayName: f.displayName, locale: f.locale, ...(f.subCityId ? { subCityId: f.subCityId, neighborhoodId: f.neighborhoodId } : {}) }, { method: "PATCH" });
      if (r) setSaved(true);
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("auth.name")} htmlFor="p-name"><Input id="p-name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
        <Field label={t("auth.language")} htmlFor="p-loc"><Select id="p-loc" value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}>{Object.entries(LOCALE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      </div>
      <RegionPicker regions={regions} subCityId={f.subCityId} neighborhoodId={f.neighborhoodId} onChange={(v) => setF({ ...f, ...v })} idPrefix="p" required={false} />
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">{t("account.saved")}</Alert>}
      <Button type="submit" loading={busy}>{t("account.save")}</Button>
    </form>
  );
}

export function AddressManager({ addresses, regions }: { addresses: { id: string; label: string; subCityId: string; landmark: string }[]; regions: RegionOption[] }) {
  const { t } = useT();
  const { run, busy, error } = useAction();
  const [f, setF] = useState({ label: "", area: { subCityId: "", neighborhoodId: null as string | null }, landmark: "", directions: "" });
  const name = (id: string) => regions.find((r) => r.id === id)?.name ?? id;
  return (
    <div className="space-y-4">
      {addresses.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-center justify-between p-3 text-sm">
              <span><span className="font-semibold">{a.label}</span> · {name(a.subCityId)}{a.landmark ? ` · ${a.landmark}` : ""}</span>
              <button type="button" aria-label={`${t("common.delete")} ${a.label}`} className="text-muted hover:text-danger" onClick={() => run("/api/v1/account/addresses", { id: a.id }, { method: "DELETE" })}><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <form className="space-y-4 rounded-xl bg-canvas p-4" onSubmit={async (e) => {
        e.preventDefault();
        const r = await run("/api/v1/account/addresses", { label: f.label, subCityId: f.area.subCityId, neighborhoodId: f.area.neighborhoodId, landmark: f.landmark, directions: f.directions });
        if (r) setF({ label: "", area: { subCityId: "", neighborhoodId: null }, landmark: "", directions: "" });
      }}>
        <Field label={t("account.label")} htmlFor="a-label" hint={t("account.labelHint")}><Input id="a-label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} required maxLength={40} /></Field>
        <RegionPicker regions={regions} subCityId={f.area.subCityId} neighborhoodId={f.area.neighborhoodId} onChange={(v) => setF({ ...f, area: v })} idPrefix="a" />
        <Field label={t("booking.landmark")} htmlFor="a-lm" hint={t("booking.landmarkHint")}><Input id="a-lm" value={f.landmark} onChange={(e) => setF({ ...f, landmark: e.target.value })} maxLength={120} /></Field>
        <Field label={t("booking.directions")} htmlFor="a-dir" hint={t("booking.directionsHint")}><Textarea id="a-dir" value={f.directions} onChange={(e) => setF({ ...f, directions: e.target.value })} maxLength={400} className="min-h-20" /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" variant="secondary" loading={busy} disabled={!f.label || !f.area.subCityId}>{t("account.addAddress")}</Button>
      </form>
    </div>
  );
}

export function BecomeProvider() {
  const { t } = useT();
  const router = useRouter();
  const { run, busy, error } = useAction();
  const [type, setType] = useState("individual");
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label={t("auth.providerType")} htmlFor="bp-type"><Select id="bp-type" value={type} onChange={(e) => setType(e.target.value)}><option value="individual">{t("auth.individual")}</option><option value="business">{t("auth.business")}</option></Select></Field>
      <Button variant="accent" loading={busy} onClick={async () => { const r = await run("/api/v1/account/become-provider", { providerType: type }, { refresh: false }); if (r) router.push("/pro/onboarding"); }}>{t("landing.becomeHelper")}</Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

export function SupportForm() {
  const { t } = useT();
  const { run, busy, error } = useAction();
  const [f, setF] = useState({ type: "general", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  if (sent) return <Alert tone="success">{t("account.supportSent")}</Alert>;
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const r = await run("/api/v1/support", f, { refresh: false }); if (r) setSent(true); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("account.supportSubject")} htmlFor="s-sub"><Input id="s-sub" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required minLength={3} maxLength={120} /></Field>
        <Field label="Topic" htmlFor="s-type"><Select id="s-type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["general", "booking", "payment", "account", "verification"].map((x) => <option key={x} value={x}>{x}</option>)}</Select></Field>
      </div>
      <Field label={t("account.supportMessage")} htmlFor="s-msg"><Textarea id="s-msg" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} required minLength={10} maxLength={3000} /></Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" variant="secondary" loading={busy}>{t("common.submit")}</Button>
    </form>
  );
}

export function DeleteAccount({ pending }: { pending: boolean }) {
  const { t } = useT();
  const { run, busy, error } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  if (pending) return <Alert tone="info">Your deletion request is being processed.</Alert>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t("account.deleteBody")}</p>
      {!confirm ? (
        <Button variant="secondary" onClick={() => setConfirm(true)}><Trash2 className="size-4" /> {t("account.deleteAccount")}</Button>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run("/api/v1/account/deletion", { reason }); }}>
          <Field label={t("booking.reason")} htmlFor="del-reason"><Textarea id="del-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} className="min-h-20" /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex gap-2"><Button type="submit" variant="danger" loading={busy}>{t("account.deleteConfirm")}</Button><Button type="button" variant="ghost" onClick={() => setConfirm(false)}>{t("common.cancel")}</Button></div>
        </form>
      )}
    </div>
  );
}
