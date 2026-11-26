import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { pageProvider } from "@/server/page-guards";
import { listBookings } from "@/server/services/bookings";
import { formatDate } from "@/lib/i18n/core";
import { formatEtb } from "@/domain/pricing";
import { EmptyState, PageHeader, SectionHeading } from "@/components/ui";
import { BookingPill } from "@/components/trust";

export const metadata = { title: "Jobs" };

/** Jobs list grouped by day (Africa/Addis_Ababa) — the MVP calendar view. */
export default async function ProJobs() {
  const u = await pageProvider("/pro/jobs");
  const { t, locale } = await getT();
  const all = await listBookings(u.uid, "provider", { limit: 200 });
  const upcoming = all.filter((b) => ["confirmed", "provider_en_route", "in_progress"].includes(b.status)).sort((a, b) => (a.scheduledFor ?? a.createdAt) - (b.scheduledFor ?? b.createdAt));
  const history = all.filter((b) => ["completed", "cancelled", "disputed", "refunded", "refund_pending"].includes(b.status));
  const groups = new Map<string, typeof upcoming>();
  for (const b of upcoming) {
    const key = formatDate(b.scheduledFor ?? b.createdAt, locale, { weekday: "long", day: "numeric", month: "long" });
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return (
    <div className="space-y-8">
      <PageHeader title={t("nav.jobs")} subtitle={t("pro.calendar")} />
      {upcoming.length === 0 ? <EmptyState title={t("home.noUpcoming")} /> : [...groups.entries()].map(([day, items]) => (
        <section key={day}>
          <SectionHeading title={day} />
          <ul className="space-y-2">{items.map((b) => (
            <li key={b.id}><Link href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-white p-4 hover:border-trust/30"><div><p className="font-semibold">{b.scheduledFor ? formatDate(b.scheduledFor, locale, { timeStyle: "short" }) : t("booking.now")} · {b.customerName.split(" ")[0]}</p><p className="text-sm text-muted">{b.area.neighborhoodName ?? b.area.subCityName} · {b.reference}</p></div><BookingPill status={b.status} t={t} /></Link></li>
          ))}</ul>
        </section>
      ))}
      <section>
        <SectionHeading title={t("booking.past")} />
        {history.length === 0 ? <EmptyState title={t("booking.none")} /> : (
          <ul className="space-y-2">{history.map((b) => (
            <li key={b.id}><Link href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-white p-4"><div><p className="font-semibold">{b.reference}</p><p className="text-sm text-muted">{formatDate(b.completedAt ?? b.createdAt, locale, { dateStyle: "medium" })}{b.breakdown ? ` · ${formatEtb(b.breakdown.serviceAmountMinor, locale)}` : ""}</p></div><BookingPill status={b.status} t={t} /></Link></li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
