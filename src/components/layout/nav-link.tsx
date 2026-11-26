"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function NavLink({ href, children, variant, icon, exact }: { href: string; children: React.ReactNode; variant: "top" | "bottom" | "side"; icon?: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  if (variant === "bottom") {
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-trust" : "text-muted")}>
        <span className={clsx("grid h-7 w-12 place-items-center rounded-full", active && "bg-smart/60")}>{icon}</span>
        {children}
      </Link>
    );
  }
  if (variant === "side") {
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium", active ? "bg-trust text-white" : "text-ink/80 hover:bg-trust-50")}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={clsx("rounded-full px-3 py-2 text-sm font-medium", active ? "bg-trust-50 text-trust" : "text-ink/75 hover:text-trust")}>
      {children}
    </Link>
  );
}
