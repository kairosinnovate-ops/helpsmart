import { notFound } from "next/navigation";
import { MapPin, CalendarClock, Repeat, Lock } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { getBookingForUser } from "@/server/services/bookings";
import { getCategory } from "@/server/services/reference";
import { adminDb } from "@/server/firebase/admin";
import { C } from "@/server/collections";
import { formatDate } from "@/lib/i18n/core";
import { formatEtb } from "@/domain/pricing";
import { ApiError } from "@/server/errors";
import { Alert, Card, PageHeader, SectionHeading } from "@/components/ui";
import { BookingPill, PaymentPill } from "@/components/trust";
import { BookingActions, PaymentPanel, ReviewForm, FeedbackForm, OpenConversation } from "./booking-client";

export const metadata = { title: "Booking" };

export default async function BookingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const u = await pageUser(`/bookings/${id}`);
  const { t, locale } = await getT();
  let b;
  try {
    b = await getBookingForUser(u.uid, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const cat = await getCategory(b.categoryId);
  const payment = await adminDb().collection(C.payments).doc(id).get();
  const confirmations = (payment.get("confirmations") ?? {}) as Record<string, unknown>;
  const feedbackGiven = b.viewerRole === "provider" ? (await adminDb().collection("providerFeedback").doc(id).get()).exists : false;
  const other = b.viewerRole === "customer" ? b.providerName : b.customerName;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {created && <Alert tone="success" title={t("booking.submitted")} />}
        <PageHeader title={cat?.names[locale] ?? cat?.names.en ?? b.categoryId} subtitle={`${t("booking.reference")} ${b.reference}`} actions={<BookingPill status={b.status} t={t} />} />
        <Card className="p-6">
          <SectionHeading title={t("booking.details")} />
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm text-muted">{b.viewerRole === "customer" ? t("booking.professional") : t("booking.customer")}</dt><dd className="font-semibold">{other}</dd></div>
            <div><dt className="flex items-center gap-1 text-sm text-muted"><CalendarClock className="size-4" /> {t("booking.when")}</dt><dd className="font-semibold">{b.scheduledFor ? formatDate(b.scheduledFor, locale) : t("booking.now")}</dd></div>
            <div><dt className="flex items-center gap-1 text-sm text-muted"><MapPin className="size-4" /> {t("booking.address")}</dt><dd className="font-semibold">{b.area.neighborhoodName ? `${b.area.neighborhoodName}, ` : ""}{b.area.subCityName}</dd>
              {b.exactAddress ? (
                <dd className="mt-1 text-sm text-ink/80">{[b.exactAddress.landmark, b.exactAddress.directions].filter(Boolean).join(" — ") || "—"}</dd>
              ) : (
                <dd className="mt-1 flex items-center gap-1 text-xs text-muted"><Lock className="size-3" /> {t("booking.addressHidden")}</dd>
              )}
            </div>
            {b.recurrence && <div><dt className="flex items-center gap-1 text-sm text-muted"><Repeat className="size-4" /> {t("booking.repeat")}</dt><dd className="font-semibold">{t(`booking.${b.recurrence.frequency}`)} × {b.recurrence.occurrences}</dd></div>}
          </dl>
          <p className="mt-5 whitespace-pre-line rounded-xl bg-canvas p-4 text-sm text-ink/80">{b.description}</p>
          {b.cancelReason && <p className="mt-3 text-sm text-muted">{t("booking.reason")}: {b.cancelReason}</p>}
        </Card>

        {b.quote && (
          <Card className="p-6">
            <SectionHeading title={t("booking.quoteFromProvider", { name: b.providerName })} />
            <p className="text-2xl font-semibold text-trust">{formatEtb(b.quote.amountMinor, locale)}</p>
            {b.quote.estimatedDuration && <p className="text-sm text-muted">{t("booking.estimatedDuration")}: {b.quote.estimatedDuration}</p>}
            {b.quote.note && <p className="mt-2 text-sm text-ink/80">{b.quote.note}</p>}
          </Card>
        )}

        <BookingActions booking={{ id: b.id, actions: b.actions, viewerRole: b.viewerRole }} />

        {b.viewerRole === "customer" && b.status === "completed" && (b.reviewId ? <Alert tone="success">{t("booking.reviewed")}</Alert> : <ReviewForm bookingId={b.id} />)}
        {b.viewerRole === "provider" && b.status === "completed" && !feedbackGiven && <FeedbackForm bookingId={b.id} />}

        <Card className="p-6">
          <SectionHeading title={t("booking.timeline")} />
          <ol className="relative space-y-4 border-l-2 border-line pl-5">
            {b.events.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-white bg-trust" aria-hidden />
                <p className="text-sm font-semibold text-ink">{t(`booking.statuses.${e.to}`)}</p>
                <p className="text-xs text-muted">{e.at ? formatDate(e.at, locale) : ""} · {e.actorRole}{e.note ? ` — ${e.note}` : ""}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="p-6">
          <SectionHeading title={t("booking.paymentTitle")} action={<PaymentPill status={b.paymentStatus} t={t} />} />
          {b.breakdown ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{t("booking.serviceAmount")}</dt><dd>{formatEtb(b.breakdown.serviceAmountMinor, locale)}</dd></div>
              {b.breakdown.customerServiceFeeMinor > 0 && <div className="flex justify-between"><dt className="text-muted">{t("booking.serviceFee")}</dt><dd>{formatEtb(b.breakdown.customerServiceFeeMinor, locale)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>{t("booking.total")}</dt><dd>{formatEtb(b.breakdown.customerTotalMinor, locale)}</dd></div>
              {b.viewerRole === "provider" && (
                <>
                  <div className="flex justify-between pt-2 text-muted"><dt>{t("pro.commission")} ({Math.round(b.breakdown.commissionRate * 100)}%)</dt><dd>−{formatEtb(b.breakdown.commissionMinor, locale)}</dd></div>
                  <div className="flex justify-between font-semibold"><dt>{t("pro.confirmedNet")}</dt><dd>{formatEtb(b.breakdown.providerNetMinor, locale)}</dd></div>
                </>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted">{t("booking.quotePending")}</p>
          )}
          <p className="mt-3 text-xs text-muted">{b.paymentMethod === "cash" ? t("booking.cash") : t("booking.bankTransfer")}</p>
          {payment.exists && ["in_progress", "completed"].includes(b.status) && ["unpaid", "pending"].includes(b.paymentStatus) && (
            <PaymentPanel bookingId={b.id} role={b.viewerRole as "customer" | "provider"} alreadyConfirmed={!!confirmations[b.viewerRole]} />
          )}
        </Card>
        <OpenConversation otherUid={b.viewerRole === "customer" ? b.providerId : b.customerId} bookingId={b.id} />
        <p className="px-2 text-xs text-muted">{t("booking.disputeHint")}</p>
      </aside>
    </div>
  );
}
