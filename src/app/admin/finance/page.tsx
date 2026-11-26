import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { executiveMetrics, listPayments } from "@/server/services/admin";
import { hasPermission } from "@/domain/permissions";
import { formatEtb } from "@/domain/pricing";
import { formatDate } from "@/lib/i18n/core";
import { Alert, ButtonLink, PageHeader, SectionHeading, Stat, Table, Td } from "@/components/ui";
import { PaymentPill } from "@/components/trust";
import type { PaymentStatus } from "@/domain/types";

export default async function AdminFinance() {
  const a = await pageAdmin("finance.read");
  const { t, locale } = await getT();
  const [m, payments] = await Promise.all([executiveMetrics(), listPayments()]);
  return (
    <div className="space-y-8">
      <PageHeader title={t("admin.nav.finance")} actions={hasPermission(a.adminRole, "finance.export") ? <ButtonLink href="/api/admin/finance/export" variant="secondary" size="sm">Export CSV</ButtonLink> : undefined} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("admin.metrics.gmv")} value={formatEtb(m.gmvMinor, locale)} hint="Confirmed paid service value" />
        <Stat label={t("admin.metrics.revenue")} value={formatEtb(m.platformRevenueMinor, locale)} hint="Commission + customer fees" />
        <Stat label={t("admin.metrics.providerEarnings")} value={formatEtb(m.providerEarningsMinor, locale)} />
      </div>
      <Alert tone="info">Live gateways (Telebirr, CBE Birr, Chapa) are not connected. Cash and bank-transfer payments are recorded only when both parties confirm. Commission on those jobs is owed by the provider and must be invoiced and reconciled.</Alert>
      <section>
        <SectionHeading title="Payments" />
        <Table head={["Booking", "Date", "Method", "Customer total", "Commission", "Status"]}>
          {payments.map((p) => <tr key={p.id}><Td className="font-mono text-xs">{p.id}</Td><Td>{formatDate(p.createdAt, locale, { dateStyle: "short" })}</Td><Td>{p.method}</Td><Td>{formatEtb(p.amountMinor, locale)}</Td><Td>{formatEtb(p.commissionMinor, locale)}</Td><Td><PaymentPill status={p.status as PaymentStatus} t={t} /></Td></tr>)}
        </Table>
      </section>
    </div>
  );
}
