"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { firebase } from "@/lib/firebase/client";
import { establishSession, firebaseErrorKey } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/client";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const { t } = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(firebase().auth, email.trim(), password);
      await establishSession(cred.user);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(t(firebaseErrorKey((err as { code?: string }).code)));
      setBusy(false);
    }
  }

  async function reset() {
    if (!email) return setError(t("auth.email"));
    await sendPasswordResetEmail(firebase().auth, email.trim()).catch(() => undefined);
    setInfo(t("auth.resetSent"));
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-3xl font-semibold tracking-tight text-trust">{t("auth.loginTitle")}</h1>
      <p className="mt-2 text-muted">{t("auth.loginSubtitle")}</p>
      <div className="mt-8 space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}
        <Field label={t("auth.email")} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={t("auth.password")} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button type="button" onClick={reset} className="text-sm font-semibold text-trust">{t("auth.forgot")}</button>
        <Button type="submit" size="lg" className="w-full" loading={busy}>{t("auth.login")}</Button>
      </div>
      <p className="mt-8 text-center text-sm text-muted">
        {t("auth.noAccount")} <Link href="/signup" className="font-semibold text-trust">{t("nav.getStarted")}</Link>
      </p>
    </form>
  );
}
