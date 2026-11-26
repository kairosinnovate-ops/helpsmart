import { BadgeCheck, ShieldCheck, Award, Star, HeartHandshake, Medal, FlaskConical } from "lucide-react";
import clsx from "clsx";
import type { BadgeId } from "@/domain/badges";
import type { BookingStatus, IdentityStatus, PaymentStatus, ProviderApprovalStatus } from "@/domain/types";
import type { TFunction } from "@/lib/i18n/core";
import { Pill, type Tone } from "@/components/ui";

const BADGE_STYLE: Record<BadgeId, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  fayda_verified: { icon: ShieldCheck, cls: "bg-trust text-white" },
  dev_identity_fixture: { icon: FlaskConical, cls: "bg-warning-50 text-warning border border-warning/30" },
  helpsmart_approved: { icon: BadgeCheck, cls: "bg-smart text-trust" },
  certified_professional: { icon: Award, cls: "bg-trust-50 text-trust" },
  top_rated: { icon: Star, cls: "bg-trust-50 text-trust" },
  care_qualified: { icon: HeartHandshake, cls: "bg-trust-50 text-trust" },
  experienced_professional: { icon: Medal, cls: "bg-trust-50 text-trust" },
};

export function TrustBadge({ id, t, size = "sm" }: { id: BadgeId; t: TFunction; size?: "sm" | "md" }) {
  const s = BADGE_STYLE[id];
  const Icon = s.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full font-semibold", s.cls, size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs")}>
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {t(`badges.${id}`)}
    </span>
  );
}

export function BadgeRow({ ids, t, size }: { ids: BadgeId[]; t: TFunction; size?: "sm" | "md" }) {
  if (!ids.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((b) => (
        <TrustBadge key={b} id={b} t={t} size={size} />
      ))}
    </div>
  );
}

const IDENTITY_TONE: Record<IdentityStatus, Tone> = {
  unverified: "neutral",
  in_progress: "blue",
  fayda_verified: "green",
  failed: "red",
  additional_review: "amber",
  expired_revoked: "red",
  suspended: "red",
};
export const IdentityPill = ({ status, t }: { status: IdentityStatus; t: TFunction }) => <Pill tone={IDENTITY_TONE[status]}>{t(`verify.status.${status}`)}</Pill>;

const APPROVAL_TONE: Record<ProviderApprovalStatus, Tone> = {
  draft: "neutral",
  submitted: "blue",
  under_review: "blue",
  info_required: "amber",
  approved: "green",
  rejected: "red",
  suspended: "red",
};
export const ApprovalPill = ({ status, t }: { status: ProviderApprovalStatus; t: TFunction }) => <Pill tone={APPROVAL_TONE[status]}>{t(`pro.approval.${status}`)}</Pill>;

const BOOKING_TONE: Record<BookingStatus, Tone> = {
  draft: "neutral",
  requested: "blue",
  awaiting_provider_response: "amber",
  awaiting_quote: "amber",
  awaiting_customer_confirmation: "amber",
  confirmed: "brand",
  provider_en_route: "blue",
  in_progress: "blue",
  completed: "green",
  cancelled: "neutral",
  disputed: "red",
  refund_pending: "amber",
  refunded: "neutral",
};
export const BookingPill = ({ status, t }: { status: BookingStatus; t: TFunction }) => <Pill tone={BOOKING_TONE[status]}>{t(`booking.statuses.${status}`)}</Pill>;

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  unpaid: "neutral",
  pending: "amber",
  paid: "green",
  failed: "red",
  partially_refunded: "amber",
  refund_pending: "amber",
  refunded: "neutral",
  disputed: "red",
};
export const PaymentPill = ({ status, t }: { status: PaymentStatus; t: TFunction }) => <Pill tone={PAYMENT_TONE[status]}>{t(`booking.paymentStatuses.${status}`)}</Pill>;
