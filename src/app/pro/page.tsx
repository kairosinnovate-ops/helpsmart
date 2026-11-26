import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { pageProvider } from "@/server/page-guards";
import { getProviderWorkspace } from "@/server/services/providers";
import { listBookings, providerEarnings } from "@/server/services/bookings";
import { listConversations } from "@/server/services/messaging";
import { ACTIVE_BOOKING_STATUSES } from "@/domain/booking";
import { formatEtb } from "@/domain/pricing";
import { formatDate } from "@/lib/i18n/core";
import { Alert, ButtonLink, Card, EmptyState, PageHeader, SectionHeading, Stat, Stars } from "@/components/ui";
import { ApprovalPill, BookingPill, IdentityPill } from "@/components/trust";
import { AvailabilityToggle } from "./pro-client";

export const metadata = { title: "HelpSmart Pro" };

export default async function ProDashboard() {
  const u = await pageProvider("/pro");
  const { t, locale } = await getT();
  const ws = await getProviderWorkspace(u.uid, u.verified);
  const [bookings, earnings, convs] = await Promise.all([listBookings(u.uid, "provider", { limit: 100 }), providerEarnings(u.uid), listConversations(u.uid)]);
  const incoming = bookings.filter((b) => b.status === "awaiting_provider_response" || b.status === "awaiting_quote");
  const active = bookings.filter((b) => ["confirmed", "provider_en_route", "in_progress"].includes(b.status));
  const completed = bookings.filter((b) => b.status === "completed");
  const unread = convs.reduce((s, c) => s + c.unread, 0);
  const stats = (ws.profile?.stats ?? {}) as { ratingAverage?: number; ratingCount?: number };
  const approved = ws.application.status === "approved";

  return (
    <div className="space-y-8">
      <PageHeader title={t("pro.welcome", { name: u.doc.displayName.split(" ")[0] })} subtitle={t("pro.completion", { percent: ws.completion.percent })} actions={approved ? <AvailabilityToggle initial={!!(ws.profile?.availability as { availableNow?: boolean } | undefined)?.availableNow} /> : <ButtonLink href="/pro/onboarding">{t("pro.continueSetup")}</ButtonLink>} />
      <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={ws.completion.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("pro.completion", { percent: ws.completion.percent })}>
        <div className="h-full rounded-full bg-trust" style={{ width: `${ws.completion.percent}%` }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center justify-between p-5"><span className="text-sm text-muted">{t("pro.identityStatus")}</span><IdentityPill status={u.doc.identityStatus} t={t} /></Card>
        <Card className="flex items-center justify-between p-5"><span className="text-sm text-muted">{t("pro.approvalStatus")}</span><ApprovalPill status={ws.application.status} t={t} /></Card>
      </div>
      {!approved && <Alert tone="info">{t("pro.notDiscoverable")}</Alert>}
      {ws.application.status === "info_required" && ws.application.notes && <Alert tone="warning" title={t("pro.approval.info_required")}>{ws.application.notes}</Alert>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("pro.incoming")} value={incoming.length} />
        <Stat label={t("pro.active")} value={active.length} />
        <Stat label={t("pro.completed")} value={completed.length} />
        <Stat label={t("pro.unread")} value={unread} />
        <Stat label={t("pro.confirmedNet")} value={formatEtb(earnings.confirmedNet, locale)} />
        <Stat label={t("pro.pending")} value={formatEtb(earnings.pendingNet, locale)} hint="Estimate" />
        <Card className="col-span-2 p-5"><p className="text-sm text-muted">{t("pro.rating")}</p><div className="mt-2"><Stars value={stats.ratingAverage ?? 0} count={stats.ratingCount ?? 0} size="md" /></div></Card>
      </div>

      <section>
        <SectionHeading title={t("pro.incoming")} action={<Link href="/pro/requests" className="inline-flex items-center gap-1 text-sm font-semibold text-trust">{t("home.seeAll")} <ArrowRight className="size-4" /></Link>} />
        {incoming.length === 0 ? <EmptyState title={t("requests.noOpen")} /> : (
          <ul className="space-y-3">{incoming.slice(0, 5).map((b) => (
            <li key={b.id}><Link href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-white p-4 hover:border-trust/30"><div><p className="font-semibold">{b.customerName.split(" ")[0]} · {b.area.neighborhoodName ?? b.area.subCityName}</p><p className="text-sm text-muted">{b.scheduledFor ? formatDate(b.scheduledFor, locale) : t("booking.now")}</p></div><BookingPill status={b.status} t={t} /></Link></li>
          ))}</ul>
        )}
      </section>
      <section>
        <SectionHeading title={t("pro.upcoming")} />
        {active.length === 0 ? <EmptyState title={t("home.noUpcoming")} /> : (
          <ul className="space-y-3">{active.filter((b) => ACTIVE_BOOKING_STATUSES.includes(b.status)).slice(0, 5).map((b) => (
            <li key={b.id}><Link href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-white p-4 hover:border-trust/30"><div><p className="font-semibold">{b.reference}</p><p className="text-sm text-muted">{b.scheduledFor ? formatDate(b.scheduledFor, locale) : t("booking.now")}</p></div><BookingPill status={b.status} t={t} /></Link></li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
