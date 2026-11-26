import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { verificationOverview } from "@/server/services/admin";
import { hasPermission } from "@/domain/permissions";
import { formatDate } from "@/lib/i18n/core";
import { Alert, Card, PageHeader, Pill, SectionHeading, Stat, Table, Td } from "@/components/ui";
import { AdminAction } from "../admin-client";

export default async function AdminVerification() {
  const a = await pageAdmin("identity.read_status");
  const { t, locale } = await getT();
  const v = await verificationOverview();
  const canReview = hasPermission(a.adminRole, "identity.review_exception");
  return (
    <div className="space-y-8">
      <PageHeader title={t("admin.nav.verification")} subtitle="Status metadata only. Identity attributes are encrypted and not viewable here." />
      <Card className="p-6">
        <SectionHeading title="Fayda integration" />
        <dl className="grid gap-4 sm:grid-cols-4">
          <div><dt className="text-sm text-muted">Mode</dt><dd className="font-semibold">{v.integration.mode}</dd></div>
          <div><dt className="text-sm text-muted">Configured</dt><dd><Pill tone={v.integration.configured ? "green" : "red"}>{v.integration.configured ? "Yes" : "No"}</Pill></dd></div>
          <div><dt className="text-sm text-muted">Issuer reachable</dt><dd><Pill tone={v.integration.reachable ? "green" : v.integration.reachable === false ? "red" : "neutral"}>{v.integration.reachable == null ? "n/a" : v.integration.reachable ? "Yes" : "No"}</Pill></dd></div>
          <div><dt className="text-sm text-muted">Environment</dt><dd className="font-semibold">{v.integration.environment}</dd></div>
        </dl>
        {!v.integration.configured && <Alert tone="warning" className="mt-4" title="Verification is fail-closed">{v.integration.missing.length ? `Missing configuration: ${v.integration.missing.join(", ")}` : "Identity verification is disabled in this environment."}</Alert>}
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Object.entries(v.counts).map(([k, n]) => <Stat key={k} label={t(`verify.status.${k}`)} value={n as number} />)}</div>
      <section>
        <SectionHeading title="Recent verification attempts" />
        <Table head={["When", "User", "Provider", "Outcome", "Reason", "Actions"]}>
          {v.recent.map((r) => (
            <tr key={r.id}>
              <Td>{r.at ? formatDate(r.at, locale) : "—"}</Td>
              <Td className="font-mono text-xs">{r.uid}</Td>
              <Td>{r.provider}</Td>
              <Td><Pill tone={r.outcome === "verified" ? "green" : r.outcome === "additional_review" ? "amber" : "red"}>{r.outcome}</Pill></Td>
              <Td>{r.reason ?? "—"}</Td>
              <Td className="space-x-2 whitespace-nowrap">{canReview && r.outcome === "additional_review" && (<><AdminAction path={`/api/admin/identity/${r.uid}`} body={{ decision: "confirm" }} label="Confirm" withNote /><AdminAction path={`/api/admin/identity/${r.uid}`} body={{ decision: "reject" }} label="Reject" variant="danger" withNote /></>)}</Td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-xs text-muted">“Confirm” is only possible when a validated Fayda result exists on record. Administrators cannot create a Fayda Verified status manually.</p>
      </section>
    </div>
  );
}
