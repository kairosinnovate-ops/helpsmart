import { Logo } from "./brand";
import { NavLink } from "./nav-link";
import { LanguageSwitcher } from "./language-switcher";
import Link from "next/link";

/** Shared sidebar shell for HelpSmart Pro and HelpSmart Admin. */
export function SideShell({
  suffix,
  homeHref,
  items,
  footer,
  children,
}: {
  suffix: string;
  homeHref: string;
  items: { href: string; label: string; icon: React.ReactNode; exact?: boolean }[];
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-line bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center px-5">
          <Logo href={homeHref} suffix={suffix} />
        </div>
        <nav aria-label={suffix} className="flex-1 space-y-1 px-3 py-4">
          {items.map((i) => (
            <NavLink key={i.href} href={i.href} variant="side" icon={i.icon} exact={i.exact}>
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t border-line p-4 text-sm">
          <LanguageSwitcher />
          {footer}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur md:hidden">
          <Logo href={homeHref} suffix={suffix} />
          <Link href="/home" className="text-sm font-medium text-trust">
            Exit
          </Link>
        </header>
        <nav aria-label={`${suffix} mobile`} className="flex gap-2 overflow-x-auto border-b border-line bg-white px-4 py-2 md:hidden">
          {items.map((i) => (
            <NavLink key={i.href} href={i.href} variant="top" exact={i.exact}>
              {i.label}
            </NavLink>
          ))}
        </nav>
        <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
