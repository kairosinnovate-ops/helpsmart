import Link from "next/link";
import { LayoutDashboard, Users, ShieldCheck, ClipboardCheck, CalendarCheck, Tags, Wallet, LifeBuoy, Settings, ScrollText, ArrowLeftRight } from "lucide-react";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/server/auth/session";
import { hasPermission, type Permission } from "@/domain/permissions";
import { SideShell } from "@/components/layout/side-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  if (!u) redirect("/login?next=/admin");
  if (!u.adminRole) redirect("/home");
  const { t } = await getT();
  const all: { href: string; label: string; icon: React.ReactNode; perm: Permission; exact?: boolean }[] = [
    { href: "/admin", label: t("admin.nav.overview"), icon: <LayoutDashboard className="size-5" />, perm: "metrics.read", exact: true },
    { href: "/admin/users", label: t("admin.nav.users"), icon: <Users className="size-5" />, perm: "users.read" },
    { href: "/admin/verification", label: t("admin.nav.verification"), icon: <ShieldCheck className="size-5" />, perm: "identity.read_status" },
    { href: "/admin/applications", label: t("admin.nav.applications"), icon: <ClipboardCheck className="size-5" />, perm: "providers.review" },
    { href: "/admin/bookings", label: t("admin.nav.bookings"), icon: <CalendarCheck className="size-5" />, perm: "bookings.read" },
    { href: "/admin/categories", label: t("admin.nav.categories"), icon: <Tags className="size-5" />, perm: "categories.manage" },
    { href: "/admin/finance", label: t("admin.nav.finance"), icon: <Wallet className="size-5" />, perm: "finance.read" },
    { href: "/admin/support", label: t("admin.nav.support"), icon: <LifeBuoy className="size-5" />, perm: "support.manage" },
    { href: "/admin/settings", label: t("admin.nav.settings"), icon: <Settings className="size-5" />, perm: "settings.manage" },
    { href: "/admin/audit", label: t("admin.nav.audit"), icon: <ScrollText className="size-5" />, perm: "audit.read" },
  ];
  const items = all.filter((i) => hasPermission(u.adminRole, i.perm));
  return (
    <SideShell suffix="Admin" homeHref="/admin" items={items} footer={<><p className="text-xs text-muted">Role: <span className="font-semibold text-ink">{u.adminRole.replace(/_/g, " ")}</span></p><Link href="/home" className="flex items-center gap-2 font-medium text-trust"><ArrowLeftRight className="size-4" /> {t("nav.switchToCustomer")}</Link></>}>
      {children}
    </SideShell>
  );
}
