"use client";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, Upload } from "lucide-react";
import { ref, uploadBytes } from "firebase/storage";
import { firebase } from "@/lib/firebase/client";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { makeList, LOCALE_NAMES } from "@/lib/i18n/core";
import { RegionPicker, type RegionOption } from "@/components/forms/region-picker";
import { Alert, Button, ButtonLink, Card, Checkbox, Field, Input, Pill, Select, Textarea } from "@/components/ui";
import type { ProviderWorkspace } from "@/server/services/providers";

const STEPS = ["identity", "profile", "categories", "qualifications", "area", "pricing", "availability", "review"] as const;
type Step = (typeof STEPS)[number];

interface Props {
  uid: string;
  initialStep?: string;
  verified: boolean;
  identityStatus: string;
  workspace: ProviderWorkspace;
  categories: { id: string; name: string }[];
  gatedCategories: string[];
  regions: RegionOption[];
}

type P = Record<string, unknown> & {
  title?: string; bio?: string; yearsExperience?: number; languages?: string[]; providerType?: string; businessName?: string; employmentPreferences?: string[];
  categoryIds?: string[];
  serviceArea?: { subCityId: string; neighborhoodId: string | null; radiusKm: number; travelPreference: string };
  pricing?: { model: string; rateMinor: number | null; callOutFeeMinor: number; cancellationPolicy: string };
  availability?: { availableNow: boolean; workingDays: number[]; startTime: string; endTime: string; acceptsRecurring: boolean };
};

export function Wizard({ uid, initialStep, verified, identityStatus, workspace, categories, gatedCategories, regions }: Props) {
  const { t, locale } = useT();
  const days = makeList(locale)("common.days");
  const p = (workspace.profile ?? {}) as P;
  const start = (STEPS as readonly string[]).includes(initialStep ?? "") ? (initialStep as Step) : verified ? "profile" : "identity";
  const [step, setStep] = useState<Step>(start);
  const { run, busy, error, fieldErrors } = useAction();
  const locked = ["submitted", "under_review"].includes(workspace.application.status);
  const next = () => setStep(STEPS[Math.min(STEPS.indexOf(step) + 1, STEPS.length - 1)]);
  const save = async (section: string, body: unknown) => { const r = await run(`/api/v1/pro/profile/${section}`, body, { method: "PUT" }); if (r) next(); };

  const [profile, setProfile] = useState({ title: p.title ?? "", bio: p.bio ?? "", yearsExperience: p.yearsExperience ?? 0, languages: p.languages ?? ["am"], providerType: p.providerType ?? "individual", businessName: p.businessName ?? "", employmentPreferences: p.employmentPreferences ?? ["on_demand", "scheduled"] });
  const [cats, setCats] = useState<string[]>(p.categoryIds ?? []);
  const [area, setArea] = useState({ subCityId: p.serviceArea?.subCityId ?? "", neighborhoodId: p.serviceArea?.neighborhoodId ?? null, radiusKm: p.serviceArea?.radiusKm ?? 5, travelPreference: p.serviceArea?.travelPreference ?? "within_radius" });
  const [pricing, setPricing] = useState({ model: p.pricing?.model ?? "hourly", rate: p.pricing?.rateMinor != null ? String(p.pricing.rateMinor / 100) : "", callOut: p.pricing?.callOutFeeMinor ? String(p.pricing.callOutFeeMinor / 100) : "", cancellationPolicy: p.pricing?.cancellationPolicy ?? "moderate" });
  const [avail, setAvail] = useState({ availableNow: p.availability?.availableNow ?? false, workingDays: p.availability?.workingDays ?? [1, 2, 3, 4, 5, 6], startTime: p.availability?.startTime ?? "08:00", endTime: p.availability?.endTime ?? "18:00", acceptsRecurring: p.availability?.acceptsRecurring ?? true });
  const [cred, setCred] = useState({ type: "certificate", title: "", issuer: "", expiresAt: "", file: null as File | null });
  const [refForm, setRefForm] = useState({ name: "", relationship: "", phone: "" });
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const done: Record<Step, boolean> = {
    identity: verified,
    profile: !workspace.completion.missing.includes("profile"),
    categories: !workspace.completion.missing.includes("categories"),
    qualifications: workspace.credentials.length > 0 || workspace.references.length > 0,
    area: !workspace.completion.missing.includes("area"),
    pricing: !workspace.completion.missing.includes("pricing"),
    availability: !workspace.completion.missing.includes("availability"),
    review: ["submitted", "under_review", "approved"].includes(workspace.application.status),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Onboarding steps">
        <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => setStep(s)} aria-current={step === s ? "step" : undefined} className={clsx("flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium", step === s ? "bg-trust text-white" : "text-ink hover:bg-white")}>
                <span className={clsx("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", done[s] ? "bg-success text-white" : step === s ? "bg-smart text-trust" : "bg-line text-ink")}>{done[s] ? <Check className="size-3.5" /> : i + 1}</span>
                {t(`pro.steps.${s}`)}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <Card className="p-6 sm:p-8">
        {locked && step !== "review" && <Alert tone="info" className="mb-6">{t("pro.submitted")}</Alert>}
        {error && <Alert tone="danger" className="mb-6">{error}</Alert>}

        {step === "identity" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">{t("verify.title")}</h2>
            <p className="text-muted">{t("verify.body")}</p>
            <Pill tone={verified ? "green" : "neutral"}>{t(`verify.status.${identityStatus}`)}</Pill>
            <p className="text-sm text-muted">{t("provider.identityNote")}</p>
            {verified ? <Button onClick={next}>{t("auth.continue")}</Button> : <ButtonLink href="/account/verify?next=/pro/onboarding?step=profile">{t("verify.cta")}</ButtonLink>}
          </div>
        )}

        {step === "profile" && (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void save("profile", { ...profile, yearsExperience: Number(profile.yearsExperience), businessName: profile.businessName || undefined }); }}>
            <h2 className="text-xl font-semibold text-ink">{t("pro.steps.profile")}</h2>
            <Field label={t("pro.titleField")} htmlFor="w-title" hint={t("pro.titleHint")} error={fieldErrors.title} required><Input id="w-title" value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} required maxLength={80} /></Field>
            <Field label={t("pro.bio")} htmlFor="w-bio" hint={t("pro.bioHint")} error={fieldErrors.bio} required><Textarea id="w-bio" value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} minLength={30} maxLength={1500} required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("pro.years")} htmlFor="w-years"><Input id="w-years" type="number" min={0} max={60} value={profile.yearsExperience} onChange={(e) => setProfile({ ...profile, yearsExperience: Number(e.target.value) })} /></Field>
              <Field label={t("auth.providerType")} htmlFor="w-ptype"><Select id="w-ptype" value={profile.providerType} onChange={(e) => setProfile({ ...profile, providerType: e.target.value })}><option value="individual">{t("auth.individual")}</option><option value="business">{t("auth.business")}</option></Select></Field>
            </div>
            {profile.providerType === "business" && <Field label={t("pro.businessName")} htmlFor="w-biz"><Input id="w-biz" value={profile.businessName} onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} /></Field>}
            <fieldset><legend className="mb-2 text-sm font-medium">{t("pro.languagesSpoken")}</legend><div className="flex flex-wrap gap-2">{Object.entries(LOCALE_NAMES).map(([k, v]) => <Chip key={k} on={profile.languages.includes(k)} onClick={() => setProfile({ ...profile, languages: toggle(profile.languages, k) })}>{v}</Chip>)}</div></fieldset>
            <fieldset><legend className="mb-2 text-sm font-medium">{t("pro.employment")}</legend><div className="flex flex-wrap gap-2">{["on_demand", "scheduled", "recurring", "long_term"].map((k) => <Chip key={k} on={profile.employmentPreferences.includes(k)} onClick={() => setProfile({ ...profile, employmentPreferences: toggle(profile.employmentPreferences, k) })}>{t(`pro.employmentTypes.${k}`)}</Chip>)}</div></fieldset>
            <Button type="submit" loading={busy} disabled={locked}>{t("pro.saveContinue")}</Button>
          </form>
        )}

        {step === "categories" && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-ink">{t("pro.selectCategories")}</h2>
            <div className="grid gap-2 sm:grid-cols-2">{categories.map((c) => <Chip key={c.id} on={cats.includes(c.id)} onClick={() => setCats(toggle(cats, c.id).slice(0, 5))} block>{c.name}</Chip>)}</div>
            {gatedCategories.length > 0 && <p className="text-sm text-muted">{gatedCategories.join(", ")}: {t("pro.safeguardingNote")}</p>}
            <Button loading={busy} disabled={locked || !cats.length} onClick={() => save("categories", { categoryIds: cats })}>{t("pro.saveContinue")}</Button>
          </div>
        )}

        {step === "qualifications" && (
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-ink">{t("pro.credentials")}</h2>
              {workspace.credentials.length > 0 && <ul className="divide-y divide-line rounded-xl border border-line">{workspace.credentials.map((c) => <li key={c.id} className="flex items-center justify-between p-3 text-sm"><span>{c.title} · {t(`pro.credentialTypes.${c.type}`)}</span><Pill tone={c.status === "verified" ? "green" : c.status === "rejected" ? "red" : "amber"}>{c.status === "verified" ? t("pro.statusVerified") : c.status === "rejected" ? t("pro.statusRejected") : t("pro.statusPending")}</Pill></li>)}</ul>}
              <form className="space-y-4 rounded-xl bg-canvas p-4" onSubmit={async (e) => {
                e.preventDefault();
                setUploadErr(null);
                if (!cred.file) return;
                const okType = ["application/pdf", "image/jpeg", "image/png"].includes(cred.file.type);
                if (!okType || cred.file.size > 5 * 1024 * 1024) { setUploadErr(t("pro.uploadHint")); return; }
                const ext = cred.file.type === "application/pdf" ? "pdf" : cred.file.type === "image/png" ? "png" : "jpg";
                const path = `credentials/${uid}/${crypto.randomUUID()}.${ext}`;
                try { await uploadBytes(ref(firebase().storage, path), cred.file, { contentType: cred.file.type }); } catch { setUploadErr(t("common.error")); return; }
                const r = await run("/api/v1/pro/credentials", { type: cred.type, title: cred.title, issuer: cred.issuer, storagePath: path, expiresAt: cred.expiresAt || null });
                if (r) setCred({ type: "certificate", title: "", issuer: "", expiresAt: "", file: null });
              }}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("pro.credentialType")} htmlFor="c-type"><Select id="c-type" value={cred.type} onChange={(e) => setCred({ ...cred, type: e.target.value })}>{["certificate", "trade_license", "training", "care", "safeguarding", "portfolio"].map((k) => <option key={k} value={k}>{t(`pro.credentialTypes.${k}`)}</option>)}</Select></Field>
                  <Field label={t("pro.credentialTitle")} htmlFor="c-title"><Input id="c-title" value={cred.title} onChange={(e) => setCred({ ...cred, title: e.target.value })} required /></Field>
                  <Field label={t("pro.issuer")} htmlFor="c-issuer"><Input id="c-issuer" value={cred.issuer} onChange={(e) => setCred({ ...cred, issuer: e.target.value })} /></Field>
                  <Field label={t("pro.expires")} htmlFor="c-exp"><Input id="c-exp" type="date" value={cred.expiresAt} onChange={(e) => setCred({ ...cred, expiresAt: e.target.value })} /></Field>
                </div>
                <Field label={t("pro.upload")} htmlFor="c-file" hint={t("pro.uploadHint")}><input id="c-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setCred({ ...cred, file: e.target.files?.[0] ?? null })} className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-trust file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" required /></Field>
                {uploadErr && <Alert tone="danger">{uploadErr}</Alert>}
                <Button type="submit" variant="secondary" loading={busy} disabled={locked}><Upload className="size-4" /> {t("pro.add")}</Button>
              </form>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-ink">{t("pro.references")}</h2>
              {workspace.references.length > 0 && <ul className="divide-y divide-line rounded-xl border border-line">{workspace.references.map((r) => <li key={r.id} className="flex items-center justify-between p-3 text-sm"><span>{r.name} · {r.relationship}</span><Pill tone={r.status === "verified" ? "green" : "amber"}>{r.status === "verified" ? t("pro.statusVerified") : t("pro.statusPending")}</Pill></li>)}</ul>}
              <form className="grid gap-4 rounded-xl bg-canvas p-4 sm:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); const r = await run("/api/v1/pro/references", refForm); if (r) setRefForm({ name: "", relationship: "", phone: "" }); }}>
                <Field label={t("pro.referenceName")} htmlFor="r-name"><Input id="r-name" value={refForm.name} onChange={(e) => setRefForm({ ...refForm, name: e.target.value })} required /></Field>
                <Field label={t("pro.relationship")} htmlFor="r-rel"><Input id="r-rel" value={refForm.relationship} onChange={(e) => setRefForm({ ...refForm, relationship: e.target.value })} required /></Field>
                <Field label={t("pro.referencePhone")} htmlFor="r-phone"><Input id="r-phone" type="tel" value={refForm.phone} onChange={(e) => setRefForm({ ...refForm, phone: e.target.value })} required /></Field>
                <div className="sm:col-span-3"><Button type="submit" variant="secondary" loading={busy} disabled={locked}>{t("pro.add")}</Button></div>
              </form>
            </div>
            <Button onClick={next}>{t("auth.continue")}</Button>
          </div>
        )}

        {step === "area" && (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void save("area", { ...area, radiusKm: Number(area.radiusKm) }); }}>
            <h2 className="text-xl font-semibold text-ink">{t("pro.steps.area")}</h2>
            <RegionPicker regions={regions} subCityId={area.subCityId} neighborhoodId={area.neighborhoodId} onChange={(v) => setArea({ ...area, ...v })} idPrefix="w" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("pro.radius")} htmlFor="w-radius"><Input id="w-radius" type="number" min={1} max={40} value={area.radiusKm} onChange={(e) => setArea({ ...area, radiusKm: Number(e.target.value) })} /></Field>
              <Field label={t("pro.travel")} htmlFor="w-travel"><Select id="w-travel" value={area.travelPreference} onChange={(e) => setArea({ ...area, travelPreference: e.target.value })}>{["neighbourhood_only", "within_radius", "anywhere_in_city"].map((k) => <option key={k} value={k}>{t(`pro.travelTypes.${k}`)}</option>)}</Select></Field>
            </div>
            <p className="text-sm text-muted">{t("pro.areaNote")}</p>
            <Button type="submit" loading={busy} disabled={locked || !area.subCityId}>{t("pro.saveContinue")}</Button>
          </form>
        )}

        {step === "pricing" && (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void save("pricing", { model: pricing.model, rateMinor: pricing.rate ? Math.round(Number(pricing.rate) * 100) : null, callOutFeeMinor: pricing.callOut ? Math.round(Number(pricing.callOut) * 100) : 0, cancellationPolicy: pricing.cancellationPolicy }); }}>
            <h2 className="text-xl font-semibold text-ink">{t("pro.steps.pricing")}</h2>
            <Field label={t("pro.priceModel")} htmlFor="w-model"><Select id="w-model" value={pricing.model} onChange={(e) => setPricing({ ...pricing, model: e.target.value })}>{["hourly", "daily", "fixed", "negotiable", "quote"].map((k) => <option key={k} value={k}>{t(`pro.priceModels.${k}`)}</option>)}</Select></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("pro.rate")} htmlFor="w-rate" required={["hourly", "daily", "fixed"].includes(pricing.model)}><Input id="w-rate" type="number" min={0} inputMode="decimal" value={pricing.rate} onChange={(e) => setPricing({ ...pricing, rate: e.target.value })} /></Field>
              <Field label={t("pro.callOut")} htmlFor="w-callout"><Input id="w-callout" type="number" min={0} inputMode="decimal" value={pricing.callOut} onChange={(e) => setPricing({ ...pricing, callOut: e.target.value })} /></Field>
            </div>
            <Field label={t("pro.cancellationPolicy")} htmlFor="w-cancel"><Select id="w-cancel" value={pricing.cancellationPolicy} onChange={(e) => setPricing({ ...pricing, cancellationPolicy: e.target.value })}>{["flexible", "moderate", "strict"].map((k) => <option key={k} value={k}>{t(`provider.cancellationPolicies.${k}`)}</option>)}</Select></Field>
            <Button type="submit" loading={busy} disabled={locked}>{t("pro.saveContinue")}</Button>
          </form>
        )}

        {step === "availability" && (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void save("availability", { ...avail, blockedDates: [] }); }}>
            <h2 className="text-xl font-semibold text-ink">{t("pro.steps.availability")}</h2>
            <fieldset><legend className="mb-2 text-sm font-medium">{t("pro.workingDays")}</legend><div className="flex flex-wrap gap-2">{days.map((d, i) => <Chip key={d} on={avail.workingDays.includes(i)} onClick={() => setAvail({ ...avail, workingDays: toggle(avail.workingDays, i).sort() })}>{d}</Chip>)}</div></fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("pro.from")} htmlFor="w-start"><Input id="w-start" type="time" value={avail.startTime} onChange={(e) => setAvail({ ...avail, startTime: e.target.value })} /></Field>
              <Field label={t("pro.to")} htmlFor="w-end"><Input id="w-end" type="time" value={avail.endTime} onChange={(e) => setAvail({ ...avail, endTime: e.target.value })} /></Field>
            </div>
            <Checkbox id="w-now" checked={avail.availableNow} onChange={(e) => setAvail({ ...avail, availableNow: e.target.checked })} label={t("pro.availableToggle")} />
            <Checkbox id="w-rec" checked={avail.acceptsRecurring} onChange={(e) => setAvail({ ...avail, acceptsRecurring: e.target.checked })} label={t("pro.acceptsRecurring")} />
            <Button type="submit" loading={busy} disabled={locked}>{t("pro.saveContinue")}</Button>
          </form>
        )}

        {step === "review" && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-ink">{t("pro.steps.review")}</h2>
            <ul className="space-y-2">{STEPS.filter((s) => s !== "review").map((s) => <li key={s} className="flex items-center gap-2 text-sm"><span className={clsx("grid size-5 place-items-center rounded-full", done[s] ? "bg-success text-white" : "bg-line")}>{done[s] && <Check className="size-3" />}</span>{t(`pro.steps.${s}`)}</li>)}</ul>
            {done.review ? <Alert tone="success">{t("pro.submitted")}</Alert> : (
              <>
                <p className="text-sm text-muted">{t("pro.notDiscoverable")}</p>
                <Button size="lg" loading={busy} disabled={workspace.completion.missing.length > 0} onClick={() => run("/api/v1/pro/submit")}>{t("pro.submitApplication")}</Button>
              </>
            )}
            <Link href="/pro" className="block text-sm font-medium text-trust">{t("nav.dashboard")}</Link>
          </div>
        )}
      </Card>
    </div>
  );
}

function Chip({ on, onClick, children, block }: { on: boolean; onClick: () => void; children: React.ReactNode; block?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={clsx("rounded-full border px-4 py-2 text-sm font-medium transition", block && "w-full rounded-xl text-left", on ? "border-trust bg-trust text-white" : "border-line bg-white text-ink hover:border-trust/40")}>
      {children}
    </button>
  );
}
