import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { getApplicationDetail } from "@/server/services/admin";
import { hasPermission } from "@/domain/permissions";
import { formatEtb } from "@/domain/pricing";
import { Alert, Card, PageHeader, Pill, SectionHeading, Table, Td } from "@/components/ui";
import { ApprovalPill, IdentityPill } from "@/components/trust";
import { AdminAction } from "../../admin-client";
import { CredentialLink } from "./credential-link";
import type { IdentityStatus, ProviderApprovalStatus } from "@/domain/types";

export default async function ApplicationDetail({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const a = await pageAdmin("providers.review");
  const { t, locale } = await getT();
  const d = await getApplicationDetail(uid);
  const p = (d.profile ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const status = d.application.status as ProviderApprovalStatus;
  const canApprove = hasPermission(a.adminRole, "providers.approve");
  const canVerify = hasPermission(a.adminRole, "credentials.verify");
  const path = `/api/admin/applications/${uid}`;
  return (
    <div className="space-y-6">
      <PageHeader title={d.user.displayName} subtitle={d.user.email} actions={<><IdentityPill status={d.user.identityStatus as IdentityStatus} t={t} /><ApprovalPill status={status} t={t} /></>} />
      {d.user.identityStatus !== "fayda_verified" && <Alert tone="warning">Identity is not verified. Approval is blocked until a validated Fayda result exists.</Alert>}
      {d.user.identitySource === "dev_fixture" && <Alert tone="warning">This identity comes from a development fixture. It would be rejected in staging and production.</Alert>}
      {canApprove && (
        <Card className="flex flex-wrap gap-2 p-5">
          {status === "submitted" && <AdminAction path={path} body={{ decision: "start_review" }} label="Start review" />}
          {["submitted", "under_review"].includes(status) && <AdminAction path={path} body={{ decision: "approve" }} label="Approve" variant="primary" withNote />}
          {["submitted", "under_review"].includes(status) && <AdminAction path={path} body={{ decision: "request_info" }} label="Request information" withNote />}
          {["submitted", "under_review", "info_required"].includes(status) && <AdminAction path={path} body={{ decision: "reject" }} label="Reject" variant="danger" withNote />}
          {status === "approved" && <AdminAction path={path} body={{ decision: "suspend" }} label="Suspend listing" variant="danger" withNote />}
          {status === "suspended" && <AdminAction path={path} body={{ decision: "reinstate" }} label="Reinstate" withNote />}
        </Card>
      )}
      <Card className="p-6">
        <SectionHeading title="Professional information" />
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Title</dt><dd className="font-semibold">{p.title ?? "—"}</dd></div>
          <div><dt className="text-muted">Type</dt><dd className="font-semibold">{p.providerType}{p.businessName ? ` · ${p.businessName}` : ""}</dd></div>
          <div><dt className="text-muted">Experience</dt><dd className="font-semibold">{p.yearsExperience ?? 0} years</dd></div>
          <div><dt className="text-muted">Categories</dt><dd className="font-semibold">{(p.categoryIds ?? []).join(", ") || "—"}</dd></div>
          <div><dt className="text-muted">Area</dt><dd className="font-semibold">{p.serviceArea ? `${p.serviceArea.neighborhoodName ?? ""} ${p.serviceArea.subCityName} · ${p.serviceArea.radiusKm} km` : "—"}</dd></div>
          <div><dt className="text-muted">Pricing</dt><dd className="font-semibold">{p.pricing ? `${p.pricing.model}${p.pricing.rateMinor ? ` · ${formatEtb(p.pricing.rateMinor, locale)}` : ""}` : "—"}</dd></div>
        </dl>
        {p.bio && <p className="mt-4 whitespace-pre-line rounded-xl bg-canvas p-4 text-sm">{p.bio}</p>}
      </Card>
      <section>
        <SectionHeading title="Credentials" />
        <Table head={["Type", "Title", "Issuer", "Expires", "File", "Status", ""]}>
          {d.credentials.map((c: Record<string, any>) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
            <tr key={c.id}>
              <Td>{c.type}</Td><Td>{c.title}</Td><Td>{c.issuer || "—"}</Td><Td>{c.expiresAt ?? "—"}</Td>
              <Td><CredentialLink path={c.storagePath} /></Td>
              <Td><Pill tone={c.status === "verified" ? "green" : c.status === "rejected" ? "red" : "amber"}>{c.status}</Pill></Td>
              <Td className="space-x-2 whitespace-nowrap">{canVerify && c.status === "pending" && <><AdminAction path={`/api/admin/credentials/${c.id}`} body={{ status: "verified" }} label="Verify" /><AdminAction path={`/api/admin/credentials/${c.id}`} body={{ status: "rejected" }} label="Reject" variant="danger" /></>}</Td>
            </tr>
          ))}
        </Table>
      </section>
      <section>
        <SectionHeading title="References" />
        <Table head={["Name", "Relationship", "Phone", "Status", ""]}>
          {d.references.map((r) => (
            <tr key={r.id}><Td>{r.name}</Td><Td>{r.relationship}</Td><Td>{r.phoneE164}</Td><Td><Pill tone={r.status === "verified" ? "green" : "amber"}>{r.status}</Pill></Td>
              <Td className="space-x-2 whitespace-nowrap">{canVerify && r.status === "pending" && <><AdminAction path={`/api/admin/references/${r.id}`} body={{ status: "verified" }} label="Verified by call" /><AdminAction path={`/api/admin/references/${r.id}`} body={{ status: "rejected" }} label="Reject" variant="danger" /></>}</Td></tr>
          ))}
        </Table>
      </section>
      <section>
        <SectionHeading title="History" />
        <ul className="space-y-1 text-sm text-muted">{(d.application.history as { status: string; at: number; by: string }[]).map((h, i) => <li key={i}>{new Date(h.at).toISOString()} — {h.status} — {h.by}</li>)}</ul>
      </section>
    </div>
  );
}
