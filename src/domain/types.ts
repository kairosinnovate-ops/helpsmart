/**
 * Core HelpSmart domain types shared by the web app, API and (later) mobile apps.
 * Keep this file free of framework and Firebase imports.
 */

export const IDENTITY_STATUSES = [
  "unverified",
  "in_progress",
  "fayda_verified",
  "failed",
  "additional_review",
  "expired_revoked",
  "suspended",
] as const;
export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

/** Where an identity result came from. Only `fayda_oidc` can ever earn the Fayda Verified badge. */
export type IdentitySource = "fayda_oidc" | "dev_fixture" | "alternative_manual";

export const PROVIDER_APPROVAL_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "info_required",
  "approved",
  "rejected",
  "suspended",
] as const;
export type ProviderApprovalStatus = (typeof PROVIDER_APPROVAL_STATUSES)[number];

export const BOOKING_STATUSES = [
  "draft",
  "requested",
  "awaiting_provider_response",
  "awaiting_quote",
  "awaiting_customer_confirmation",
  "confirmed",
  "provider_en_route",
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
  "refund_pending",
  "refunded",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "partially_refunded",
  "refund_pending",
  "refunded",
  "disputed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentMethod = "cash" | "bank_transfer" | "telebirr" | "cbe_birr" | "chapa" | "international_card";

export type PriceModel = "hourly" | "daily" | "fixed" | "negotiable" | "quote";

export type UserRole = "customer" | "provider";

export const ADMIN_ROLES = [
  "super_admin",
  "operations_manager",
  "verification_officer",
  "support_agent",
  "finance_admin",
  "marketplace_manager",
  "read_only_analyst",
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export type Locale = "en" | "am" | "om" | "ti" | "so";
export const LOCALES: Locale[] = ["en", "am", "om", "ti", "so"];

/** Money is always stored as integer minor units (santim for ETB). */
export interface Money {
  amountMinor: number;
  currency: "ETB";
}

export interface GeoPoint {
  lat: number;
  lng: number;
}
