import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { pageProvider } from "@/server/page-guards";
import { listOpenRequestsForProvider } from "@/server/services/requests";
import { listBookings } from "@/server/services/bookings";
import { formatEtb } from "@/domain/pricing";
import { formatDistance } from "@/domain/geo";
import { formatDate } from "@/lib/i18n/core";
import { Alert, Card, EmptyState, PageHeader, SectionHeading } from "@/components/ui";
import { BookingPill } from "@/components/trust";
import { QuoteForm } from "./quote-form";

export const metadata = { title: "Requests" };

export default async function ProRequests() {
  const u = await pageProvider("/pro/requests");
  const { t, locale } = await getT();
  const incoming = (await listBookings(u.uid, "provider", { statuses: ["awaiting_provider_response", "awaiting_quote"] }));
  let open: Awaited<ReturnType<typeof listOpenRequestsForProvider>> = [];
  let notApproved = false;
  try {
    open = await listOpenRequestsForProvider(u.uid);
  } catch {
    notApproved = true;
  }
  return (
    <div className="space-y-8">
      <PageHeader title={t("nav.requests")} />
      <section>
        <SectionHeading title={t("pro.incoming")} />
        {incoming.length === 0 ? <EmptyState title={t("requests.noOpen")} /> : (
          <ul className="space-y-3">{incoming.map((b) => (
            <li key={b.id}><Link href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-white p-4 hover:border-trust/30"><div><p className="font-semibold">{b.reference} · {b.area.neighborhoodName ?? b.area.subCityName}</p><p className="line-clamp-1 text-sm text-muted">{b.description}</p></div><BookingPill status={b.status} t={t} /></Link></li>
          ))}</ul>
        )}
      </section>
      <section>
        <SectionHeading title={t("requests.openRequests")} />
        {notApproved ? <Alert tone="info">{t("pro.notDiscoverable")}</Alert> : open.length === 0 ? <EmptyState title={t("requests.noOpen")} /> : (
          <ul className="space-y-4">{open.map((r) => (
            <li key={r.id}>
              <Card className="p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <p className="font-semibold text-ink">{r.title}</p>
                  <p className="text-sm text-muted">{r.neighborhoodName ?? r.subCityName}{r.distanceKm != null ? ` · ${formatDistance(r.distanceKm)}` : ""}</p>
                </div>
                <p className="mt-2 text-sm text-ink/80">{r.description}</p>
                <p className="mt-2 text-xs text-muted">{[r.preferredDate && `${t("requests.preferredDate")}: ${r.preferredDate}`, r.budgetMinor && `${t("requests.budget")}: ${formatEtb(r.budgetMinor, locale)}`, formatDate(r.createdAt, locale, { dateStyle: "medium" })].filter(Boolean).join(" · ")}</p>
                <div className="mt-4">{r.myQuote ? <p className="text-sm font-semibold text-trust">{t("requests.quoted", { price: formatEtb(r.myQuote.amountMinor, locale) })}</p> : <QuoteForm requestId={r.id} />}</div>
              </Card>
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
