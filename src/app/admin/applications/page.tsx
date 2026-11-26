import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { listApplications } from "@/server/services/admin";
import { formatDate } from "@/lib/i18n/core";
import { PageHeader, Table, Td } from "@/components/ui";
import { ApprovalPill, IdentityPill } from "@/components/trust";
import type { IdentityStatus, ProviderApprovalStatus } from "@/domain/types";

const FILTERS = ["submitted", "under_review", "info_required", "approved", "rejected", "suspended", "draft"];

export default async function AdminApplications({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "submitted" } = await searchParams;
  await pageAdmin("providers.review");
  const { t, locale } = await getT();
  const apps = await listApplications(FILTERS.includes(status) ? status : "submitted");
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.nav.applications")} />
      <nav className="flex flex-wrap gap-2">{FILTERS.map((f) => <Link key={f} href={`/admin/applications?status=${f}`} className={`rounded-full px-3 py-1.5 text-sm font-medium ${f === status ? "bg-trust text-white" : "bg-white text-ink"}`}>{t(`pro.approval.${f}`)}</Link>)}</nav>
      <Table head={["Provider", "Identity", "Status", "Submitted", ""]}>
        {apps.map((a) => (
          <tr key={a.uid}>
            <Td className="font-semibold">{a.displayName}</Td>
            <Td><IdentityPill status={a.identityStatus as IdentityStatus} t={t} />{a.identitySource === "dev_fixture" && <span className="ml-1 text-xs text-warning">dev fixture</span>}</Td>
            <Td><ApprovalPill status={a.status as ProviderApprovalStatus} t={t} /></Td>
            <Td>{a.submittedAt ? formatDate(a.submittedAt, locale) : "—"}</Td>
            <Td><Link href={`/admin/applications/${a.uid}`} className="font-semibold text-trust">{t("common.view")}</Link></Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
