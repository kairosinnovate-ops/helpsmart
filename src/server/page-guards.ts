import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser } from "./auth/session";
import { isIdentityVerified } from "./auth/guards";
import { hasPermission, type Permission } from "@/domain/permissions";

/** Page-level guards: redirect instead of throwing. APIs still enforce on their own. */
export async function pageUser(next: string) {
  const u = await getSessionUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!u.doc) redirect("/signup");
  if (u.doc.accountStatus === "suspended") redirect("/suspended");
  return { ...u, doc: u.doc, verified: isIdentityVerified(u) };
}

export async function pageProvider(next: string) {
  const u = await pageUser(next);
  if (!u.doc.roles.includes("provider")) redirect("/account?become=provider");
  return u;
}

export async function pageAdmin(perm: Permission) {
  const u = await getSessionUser();
  if (!u) redirect("/login?next=/admin");
  if (!u.adminRole || !hasPermission(u.adminRole, perm)) redirect("/home");
  return u;
}
