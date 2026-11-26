import type { AdminRole } from "./types";

/** Granular admin permissions with separation of duties (spec §26). */
export const PERMISSIONS = [
  "metrics.read",
  "users.read",
  "users.suspend",
  "users.delete",
  "identity.read_status",
  "identity.review_exception",
  "providers.review",
  "providers.approve",
  "credentials.verify",
  "categories.manage",
  "regions.manage",
  "settings.manage",
  "bookings.read",
  "bookings.intervene",
  "finance.read",
  "finance.refund",
  "finance.export",
  "support.manage",
  "disputes.manage",
  "reviews.moderate",
  "reports.manage",
  "audit.read",
  "admins.manage",
  "announcements.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  operations_manager: [
    "metrics.read",
    "users.read",
    "users.suspend",
    "identity.read_status",
    "providers.review",
    "bookings.read",
    "bookings.intervene",
    "disputes.manage",
    "reports.manage",
    "support.manage",
    "audit.read",
    "announcements.manage",
  ],
  verification_officer: [
    "users.read",
    "identity.read_status",
    "identity.review_exception",
    "providers.review",
    "providers.approve",
    "credentials.verify",
  ],
  support_agent: ["users.read", "bookings.read", "support.manage", "reports.manage", "reviews.moderate"],
  finance_admin: ["metrics.read", "bookings.read", "finance.read", "finance.refund", "finance.export"],
  marketplace_manager: [
    "metrics.read",
    "categories.manage",
    "regions.manage",
    "settings.manage",
    "bookings.read",
    "announcements.manage",
  ],
  read_only_analyst: ["metrics.read"],
};

export function hasPermission(role: AdminRole | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}
