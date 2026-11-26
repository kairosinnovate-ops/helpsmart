import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/server/auth/session";
import { ButtonLink } from "@/components/ui";
import { Logo } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";

export async function PublicHeader() {
  const { t } = await getT();
  const user = await getSessionUser();
  const links = [
    { href: "/explore", label: t("nav.findServices") },
    { href: "/how-it-works", label: t("nav.howItWorks") },
    { href: "/become-a-helper", label: t("nav.becomeHelper") },
    { href: "/family", label: t("nav.family") },
    { href: "/about", label: t("nav.about") },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-2 text-sm font-medium text-ink/80 hover:bg-trust-50 hover:text-trust">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          {user ? (
            <ButtonLink href="/home" size="sm">
              {t("nav.home")}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                {t("nav.login")}
              </ButtonLink>
              <ButtonLink href="/signup" size="sm">
                {t("nav.getStarted")}
              </ButtonLink>
            </>
          )}
          <MobileMenu links={[...links, ...(user ? [] : [{ href: "/login", label: t("nav.login") }])]} />
        </div>
      </div>
    </header>
  );
}

export async function PublicFooter() {
  const { t } = await getT();
  const cols = [
    { title: t("footer.about"), links: [["/about", t("footer.about")], ["/careers", t("footer.careers")], ["/contact", t("footer.contact")]] },
    { title: t("footer.services"), links: [["/explore", t("nav.findServices")], ["/become-a-helper", t("nav.becomeHelper")], ["/family", t("nav.family")]] },
    { title: t("footer.help"), links: [["/help", t("footer.help")], ["/safety", t("footer.safety")], ["/legal/community-guidelines", t("footer.guidelines")]] },
    { title: "Legal", links: [["/legal/privacy", t("footer.privacy")], ["/legal/terms", t("footer.terms")], ["/legal/provider-agreement", t("footer.providerAgreement")]] },
  ];
  return (
    <footer className="mt-24 bg-trust text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="space-y-4">
          <Logo light />
          <p className="max-w-xs text-sm text-white/70">{t("brand.secondary")}</p>
          <p className="text-sm font-semibold text-smart">{t("brand.corporate")}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="mb-3 text-sm font-semibold">{c.title}</p>
            <ul className="space-y-2 text-sm text-white/70">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-white/60 sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} {t("footer.rights")}</p>
          <p aria-label="Social media">Facebook · Telegram · LinkedIn · Instagram</p>
        </div>
      </div>
    </footer>
  );
}
