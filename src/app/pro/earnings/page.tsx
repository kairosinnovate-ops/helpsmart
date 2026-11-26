import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { pageProvider } from "@/server/page-guards";
import { providerEarnings } from "@/server/services/bookings";
import { formatEtb } from "@/domain/pricing";
import { formatDate } from "@/lib/i18n/core";
import { Alert, EmptyState, PageHeader, SectionHeading, Stat, Table, Td } from "@/components/ui";
import { PaymentPill } from "@/components/trust";
import type { PaymentStatus } from "@/domain/types";

export const metadata = { title: "Earnings" };

export default async function ProEarnings() {
  const u = await pageProvider("/pro/earnings");
  const { t, locale } = await getT();
  const e = await providerEarnings(u.uid);
  return (
    <div className="space-y-8">
      <PageHeader title={t("pro.earningsTitle")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("pro.confirmedGross")} value={formatEtb(e.confirmedGross, locale)} />
        <Stat label={t("pro.commission")} value={formatEtb(e.confirmedCommission, locale)} />
        <Stat label={t("pro.confirmedNet")} value={formatEtb(e.confirmedNet, locale)} />
        <Stat label={t("pro.pending")} value={formatEtb(e.pendingNet, locale)} hint="Estimate — not yet confirmed" />
      </div>
      <Alert tone="info">{t("pro.commissionNote")}</Alert>
      <section>
        <SectionHeading title={t("pro.history")} />
        {e.history.length === 0 ? <EmptyState title={t("booking.none")} /> : (
          <Table head={["Booking", "Date", "Method", "Service", "Commission", "Net", "Status"]}>
            {e.history.map((h) => (
              <tr key={h.bookingId}>
                <Td><Link href={`/bookings/${h.bookingId}`} className="font-semibold text-trust">{h.bookingId.slice(0, 8)}</Link></Td>
                <Td>{formatDate(h.createdAt, locale, { dateStyle: "medium" })}</Td>
                <Td>{h.method === "cash" ? t("booking.cash") : t("booking.bankTransfer")}</Td>
                <Td>{formatEtb(h.serviceAmountMinor, locale)}</Td>
                <Td>−{formatEtb(h.commissionMinor, locale)}</Td>
                <Td className="font-semibold">{formatEtb(h.netMinor, locale)}</Td>
                <Td><PaymentPill status={h.status as PaymentStatus} t={t} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
