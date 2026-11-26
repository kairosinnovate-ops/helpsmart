import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { categoryPerformance, executiveMetrics, geographicPerformance } from "@/server/services/admin";
import { formatEtb } from "@/domain/pricing";
import { Alert, PageHeader, SectionHeading, Stat, Table, Td } from "@/components/ui";

export const metadata = { title: "Admin" };

export default async function AdminOverview() {
  await pageAdmin("metrics.read");
  const { t, locale } = await getT();
  const [m, cats, geo] = await Promise.all([executiveMetrics(), categoryPerformance(), geographicPerformance()]);
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const stats: [string, string | number][] = [
    ["customers", m.customers], ["providers", m.providers], ["verifiedCustomers", m.verifiedCustomers], ["verifiedProviders", m.verifiedProviders],
    ["approved", m.approvedProviders], ["pending", m.pendingApplications], ["active", m.activeProfessionals], ["bookings", m.totalBookings],
    ["completed", m.completedBookings], ["cancellation", pct(m.cancellationRate)], ["rating", m.averageRating != null ? m.averageRating.toFixed(2) : "—"], ["disputes", m.openDisputes],
    ["gmv", formatEtb(m.gmvMinor, locale)], ["revenue", formatEtb(m.platformRevenueMinor, locale)], ["providerEarnings", formatEtb(m.providerEarningsMinor, locale)],
  ];
  return (
    <div className="space-y-8">
      <PageHeader title={t("admin.title")} subtitle={`Environment: ${m.environment}`} />
      <Alert tone="info">{t("admin.metricsNote")}</Alert>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{stats.map(([k, v]) => <Stat key={k} label={t(`admin.metrics.${k}`)} value={v} />)}</div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section><SectionHeading title="Service category performance" /><Table head={["Category", "Bookings", "Listed providers"]}>{cats.map((c) => <tr key={c.id}><Td>{c.name}</Td><Td>{c.bookings}</Td><Td>{c.providers}</Td></tr>)}</Table></section>
        <section><SectionHeading title="Geographic performance" /><Table head={["Sub-city", "Bookings"]}>{geo.sort((a, b) => b.bookings - a.bookings).map((g) => <tr key={g.id}><Td>{g.name}</Td><Td>{g.bookings}</Td></tr>)}</Table></section>
      </div>
    </div>
  );
}
