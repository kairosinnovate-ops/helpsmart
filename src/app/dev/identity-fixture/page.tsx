import { notFound } from "next/navigation";
import { randomBytes } from "node:crypto";
import { isDevFixtureAllowed } from "@/server/env";
import { Alert, Card } from "@/components/ui";
import { Logo } from "@/components/layout/brand";

/**
 * DEVELOPMENT-ONLY stand-in for the Fayda authorisation page. Returns 404 unless
 * APP_ENV=development|test and IDENTITY_MODE=dev_fixture. Results are stored as `dev_fixture`
 * and never produce a Fayda Verified badge.
 */
export default async function IdentityFixture({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (!isDevFixtureAllowed()) notFound();
  const { state } = await searchParams;
  if (!state) notFound();
  const seed = randomBytes(6).toString("hex");
  const cb = (q: string) => `/api/identity/callback?state=${encodeURIComponent(state)}&${q}`;
  const options = [
    { label: "Successful verification (new identity)", href: cb(`code=fixture.success.${seed}`) },
    { label: "Same identity as another account (duplicate → additional review)", href: cb("code=fixture.success.shared-duplicate-identity") },
    { label: "User cancels at Fayda", href: cb("error=access_denied") },
    { label: "Invalid token signature", href: cb(`code=fixture.invalid_signature.${seed}`) },
    { label: "Fayda unavailable", href: cb(`code=fixture.unavailable.${seed}`) },
  ];
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-12">
      <Logo />
      <Card className="mt-8 p-6">
        <h1 className="text-xl font-semibold text-ink">Development identity fixture</h1>
        <Alert tone="warning" className="mt-4" title="Not Fayda. Not a real verification.">
          This page exists only in development to exercise the verification workflow. Staging and production refuse this mode.
        </Alert>
        <ul className="mt-6 space-y-2">
          {options.map((o) => (
            <li key={o.label}>
              <a href={o.href} className="block rounded-xl border border-line px-4 py-3 text-sm font-medium text-trust hover:bg-trust-50">{o.label}</a>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
