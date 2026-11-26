import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { listCollection } from "@/server/services/admin";
import { hasPermission } from "@/domain/permissions";
import { formatDate } from "@/lib/i18n/core";
import { PageHeader, Pill, SectionHeading, Table, Td } from "@/components/ui";
import { AdminAction } from "../admin-client";

export default async function AdminSupport() {
  const a = await pageAdmin("support.manage");
  const { t, locale } = await getT();
  const [tickets, incidents, reviewReports] = await Promise.all([listCollection("supportTickets"), listCollection("incidentReports"), listCollection("reviewReports")]);
  const canReports = hasPermission(a.adminRole, "reports.manage");
  const canModerate = hasPermission(a.adminRole, "reviews.moderate");
  const actions = (coll: string, id: string, status: unknown) => status === "resolved" || status === "dismissed" ? null : (
    <span className="space-x-2 whitespace-nowrap">
      <AdminAction path={`/api/admin/cases/${coll}/${id}`} body={{ status: "resolved" }} label="Resolve" withNote />
      <AdminAction path={`/api/admin/cases/${coll}/${id}`} body={{ status: "dismissed" }} label="Dismiss" variant="ghost" withNote />
    </span>
  );
  const when = (v: unknown) => (typeof v === "number" ? formatDate(v, locale, { dateStyle: "short", timeStyle: "short" }) : "—");
  return (
    <div className="space-y-8">
      <PageHeader title={t("admin.nav.support")} />
      <section>
        <SectionHeading title="Safety and abuse reports" />
        <Table head={["When", "Type", "Priority", "Subject", "Description", "Status", ""]}>
          {incidents.map((r) => <tr key={r.id as string}><Td>{when(r.createdAt)}</Td><Td>{r.type as string}</Td><Td><Pill tone={r.priority === "high" ? "red" : "neutral"}>{r.priority as string}</Pill></Td><Td className="font-mono text-xs">{r.subjectId as string}</Td><Td className="max-w-xs truncate">{r.description as string}</Td><Td>{r.status as string}</Td><Td>{canReports && actions("incidentReports", r.id as string, r.status)}</Td></tr>)}
        </Table>
      </section>
      <section>
        <SectionHeading title="Support tickets" />
        <Table head={["When", "Type", "Subject", "Status", ""]}>
          {tickets.map((r) => <tr key={r.id as string}><Td>{when(r.createdAt)}</Td><Td>{r.type as string}</Td><Td>{r.subject as string}</Td><Td>{r.status as string}</Td><Td>{actions("supportTickets", r.id as string, r.status)}</Td></tr>)}
        </Table>
      </section>
      <section>
        <SectionHeading title="Reported reviews" />
        <Table head={["When", "Review", "Reason", "Status", ""]}>
          {reviewReports.map((r) => <tr key={r.id as string}><Td>{when(r.createdAt)}</Td><Td className="font-mono text-xs">{r.reviewId as string}</Td><Td className="max-w-xs truncate">{r.reason as string}</Td><Td>{r.status as string}</Td>
            <Td className="space-x-2 whitespace-nowrap">{canModerate && r.status === "open" && <AdminAction path={`/api/admin/reviews/${r.reviewId}`} body={{ action: "hide" }} label="Hide review" variant="danger" withNote />}{canReports && actions("reviewReports", r.id as string, r.status)}</Td></tr>)}
        </Table>
      </section>
    </div>
  );
}
