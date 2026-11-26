"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { Briefcase, Home, ChevronLeft } from "lucide-react";
import clsx from "clsx";
import { firebase } from "@/lib/firebase/client";
import { api, ApiClientError } from "@/lib/api";
import { establishSession, firebaseErrorKey } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/client";
import { LOCALE_NAMES } from "@/lib/i18n/core";
import { normalizeEthiopianPhone } from "@/domain/phone";
import { Alert, Button, Checkbox, Field, Input, Select } from "@/components/ui";

type AccountType = "customer" | "provider";

export function SignupForm({ initialType, completeOnly = false }: { initialType: AccountType | null; completeOnly?: boolean }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [type, setType] = useState<AccountType | null>(initialType);
  const [form, setForm] = useState({ displayName: "", phone: "", email: "", password: "", locale, providerType: "individual", accept: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!type) {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-trust">{t("auth.signupTitle")}</h1>
        <p className="mt-2 text-muted">{t("auth.signupSubtitle")}</p>
        <div className="mt-8 grid gap-4">
          {([
            ["customer", Home, t("auth.needService"), t("auth.needServiceBody")],
            ["provider", Briefcase, t("auth.provideService"), t("auth.provideServiceBody")],
          ] as const).map(([k, Icon, title, body]) => (
            <button
              key={k}
              type="button"
              onClick={() => setType(k)}
              className={clsx("flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-white p-6 text-left transition hover:border-trust/40 hover:shadow-[var(--shadow-card)]")}
            >
              <span className={clsx("grid size-12 shrink-0 place-items-center rounded-2xl", k === "customer" ? "bg-smart/60 text-trust" : "bg-trust text-smart")}>
                <Icon className="size-6" aria-hidden />
              </span>
              <span>
                <span className="block text-lg font-semibold text-ink">{title}</span>
                <span className="mt-1 block text-sm text-muted">{body}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted">
          {t("auth.haveAccount")} <Link href="/login" className="font-semibold text-trust">{t("auth.login")}</Link>
        </p>
      </div>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.displayName.trim().length < 2) errs.displayName = t("auth.errors.generic");
    if (!normalizeEthiopianPhone(form.phone)) errs.phone = t("auth.phoneHint");
    if (!completeOnly && form.password.length < 8) errs.password = t("auth.errors.weakPassword");
    if (!form.accept) errs.accept = t("auth.errors.generic");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    try {
      if (!completeOnly) {
        const { auth } = firebase();
        const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        await updateProfile(cred.user, { displayName: form.displayName.trim() });
        await sendEmailVerification(cred.user).catch(() => undefined);
        await establishSession(cred.user);
      }
      await api("/api/v1/account", {
        body: {
          accountType: type,
          displayName: form.displayName.trim(),
          phone: form.phone,
          locale: form.locale,
          acceptTerms: true,
          acceptPrivacy: true,
          providerType: type === "provider" ? form.providerType : undefined,
        },
      });
      router.push(type === "provider" ? "/account/verify?next=/pro/onboarding" : "/account/verify?next=/account/onboarding");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError(t(firebaseErrorKey((err as { code?: string }).code)));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <button type="button" onClick={() => setType(null)} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-trust">
        <ChevronLeft className="size-4" /> {t("auth.back")}
      </button>
      <h1 className="text-3xl font-semibold tracking-tight text-trust">{t("auth.createAccount")}</h1>
      <p className="mt-2 text-muted">{type === "customer" ? t("auth.needService") : t("auth.provideService")}</p>
      <div className="mt-8 space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t("auth.name")} htmlFor="name" error={errors.displayName} required>
          <Input id="name" autoComplete="name" value={form.displayName} onChange={set("displayName")} aria-invalid={!!errors.displayName} required />
        </Field>
        <Field label={t("auth.phone")} htmlFor="phone" hint={t("auth.phoneHint")} error={errors.phone} required>
          <div className="flex">
            <span className="inline-flex h-12 items-center rounded-l-xl border border-r-0 border-line bg-canvas px-3 text-sm font-medium text-ink">+251</span>
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" className="rounded-l-none" value={form.phone} onChange={set("phone")} aria-invalid={!!errors.phone} aria-describedby="phone-hint" placeholder="911 234 567" required />
          </div>
        </Field>
        {!completeOnly && (
          <>
            <Field label={t("auth.email")} htmlFor="email" required>
              <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
            </Field>
            <Field label={t("auth.password")} htmlFor="password" hint={t("auth.passwordHint")} error={errors.password} required>
              <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} aria-invalid={!!errors.password} minLength={8} required />
            </Field>
          </>
        )}
        <Field label={t("auth.language")} htmlFor="locale">
          <Select id="locale" value={form.locale} onChange={set("locale")}>
            {Object.entries(LOCALE_NAMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        {type === "provider" && (
          <Field label={t("auth.providerType")} htmlFor="ptype">
            <Select id="ptype" value={form.providerType} onChange={set("providerType")}>
              <option value="individual">{t("auth.individual")}</option>
              <option value="business">{t("auth.business")}</option>
            </Select>
          </Field>
        )}
        <div>
          <Checkbox
            id="accept"
            checked={form.accept}
            onChange={set("accept")}
            label={
              <>
                {t("auth.acceptTerms").split(/\{terms\}|\{privacy\}/).reduce<React.ReactNode[]>((acc, part, i) => {
                  acc.push(<span key={`p${i}`}>{part}</span>);
                  if (i === 0) acc.push(<Link key="terms" href="/legal/terms" target="_blank" className="font-semibold text-trust underline">{t("footer.terms")}</Link>);
                  if (i === 1) acc.push(<Link key="privacy" href="/legal/privacy" target="_blank" className="font-semibold text-trust underline">{t("footer.privacy")}</Link>);
                  return acc;
                }, [])}
              </>
            }
          />
          {errors.accept && <p className="mt-1 text-xs font-medium text-danger">{t("auth.errors.generic")}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {t("auth.continue")}
        </Button>
      </div>
    </form>
  );
}
