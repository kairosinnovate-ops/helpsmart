import Link from "next/link";
import { Bell, CalendarCheck, Compass, Home, MessageCircle, User, Briefcase, Shield, MapPin } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionUser } from "@/server/auth/session";
import { adminDb } from "@/server/firebase/admin";
import { C } from "@/server/collections";
import { ButtonLink } from "@/components/ui";
import { Logo } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { NavLink } from "./nav-link";

async function unreadCount(uid: string) {
  try {
    return (await adminDb().collection(C.notifications).where("uid", "==", uid).where("read", "==", false).count().get()).data().count;
  } catch {
    return 0;
  }
}

export async function AppShell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  const { t } = await getT();
  const unread = user ? await unreadCount(user.uid) : 0;
  const isProvider = user?.doc?.roles.includes("provider");
  const nav = [
    { href: "/home", label: t("nav.home"), icon: <Home className="size-5" /> },
    { href: "/explore", label: t("nav.explore"), icon: <Compass className="size-5" /> },
    { href: "/bookings", label: t("nav.bookings"), icon: <CalendarCheck className="size-5" /> },
    { href: "/messages", label: t("nav.messages"), icon: <MessageCircle className="size-5" /> },
    { href: "/account", label: t("nav.profile"), icon: <User className="size-5" /> },
  ];
  const area = user?.doc?.onboarding?.subCityId;
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo href={user ? "/home" : "/"} />
            <nav aria-label="App" className="hidden items-center gap-1 md:flex">
              {nav.slice(0, 4).map((n) => (
                <NavLink key={n.href} href={n.href} variant="top">
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Link href="/account#location" className="hidden items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink sm:flex">
                <MapPin className="size-4 text-trust" aria-hidden />
                <span className="sr-only">{t("home.location")}: </span>
                <span className="capitalize">{area ? area.replace(/-/g, " ") : "Addis Ababa"}</span>
              </Link>
            )}
            <div className="hidden sm:block">
              <LanguageSwitcher compact />
            </div>
            {user ? (
              <>
                {isProvider && (
                  <Link href="/pro" className="hidden items-center gap-1 rounded-full bg-smart px-3 py-1.5 text-sm font-semibold text-trust lg:flex">
                    <Briefcase className="size-4" aria-hidden /> Pro
                  </Link>
                )}
                {user.adminRole && (
                  <Link href="/admin" className="hidden items-center gap-1 rounded-full bg-trust px-3 py-1.5 text-sm font-semibold text-white lg:flex">
                    <Shield className="size-4" aria-hidden /> {t("nav.admin")}
                  </Link>
                )}
                <Link href="/notifications" className="relative grid size-10 place-items-center rounded-full border border-line bg-white text-trust" aria-label={`${t("nav.notifications")}${unread ? ` (${unread})` : ""}`}>
                  <Bell className="size-5" aria-hidden />
                  {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
                </Link>
                <Link href="/account" className="hidden size-10 place-items-center rounded-full bg-trust-50 text-sm font-semibold text-trust md:grid" aria-label={t("nav.profile")}>
                  {user.doc?.displayName?.[0]?.toUpperCase() ?? "U"}
                </Link>
              </>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">
                  {t("nav.login")}
                </ButtonLink>
                <ButtonLink href="/signup" size="sm" className="hidden sm:inline-flex">
                  {t("nav.getStarted")}
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      {/* Mobile bottom navigation */}
      <nav aria-label="Bottom" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {nav.map((n) => (
            <li key={n.href}>
              <NavLink href={n.href} variant="bottom" icon={n.icon}>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
