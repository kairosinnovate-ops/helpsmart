import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { listBookings } from "@/server/services/bookings";
import { ACTIVE_BOOKING_STATUSES } from "@/domain/booking";
import { formatDate } from "@/lib/i18n/core";
import { formatEtb } from "@/domain/pricing";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { BookingPill } from "@/components/trust";

export const metadata = { title: "My bookings" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const u = await pageUser("/bookings");
  const { t, locale } = await getT();
  const all = await listBookings(u.uid, "customer", { limit: 100 });
  const active = all.filter((b) => ACTIVE_BOOKING_STATUSES.includes(b.status));
  const past = all.filter((b) => !ACTIVE_BOOKING_STATUSES.includes(b.status));
  const shown = tab === "past" ? past : active;
  return (
    <div>
      <PageHeader title={t("booking.listTitle")} actions={<ButtonLink href="/requests" variant="secondary" size="sm">{t("requests.mine")}</ButtonLink>} />
      <div className="mb-5 inline-flex rounded-full border border-line bg-white p-1" role="tablist">
        {[["active", t("booking.active"), active.length], ["past", t("booking.past"), past.length]].map(([k, label, n]) => (
          <Link key={k as string} role="tab" aria-selected={(tab === "past") === (k === "past")} href={`/bookings?tab=${k}`} className={`rounded-full px-4 py-1.5 text-sm font-medium ${(tab === "past") === (k === "past") ? "bg-trust text-white" : "text-ink"}`}>
            {label} ({n})
          </Link>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="size-6" />} title={t("booking.none")} body={t("booking.noneBody")} action={<ButtonLink href="/explore">{t("nav.explore")}</ButtonLink>} />
      ) : (
        <ul className="space-y-3">
          {shown.map((b) => (
            <li key={b.id}>
              <Link href={`/bookings/${b.id}`} className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4 hover:border-trust/30 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-ink">{b.providerName}</p>
                  <p className="text-sm text-muted">{b.reference} · {b.scheduledFor ? formatDate(b.scheduledFor, locale) : formatDate(b.createdAt, locale)} · {b.area.neighborhoodName ?? b.area.subCityName}</p>
                </div>
                <div className="flex items-center gap-3">
                  {b.breakdown && <span className="text-sm font-semibold text-trust">{formatEtb(b.breakdown.customerTotalMinor, locale)}</span>}
                  <BookingPill status={b.status} t={t} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
