import Link from "next/link";
import clsx from "clsx";

/** HelpSmart mark: a rounded home outline with a verification check, in Trust Green + Smart Green. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="12" fill="#103D35" />
      <path d="M10 19.5 20 11l10 8.5V29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2v-9.5Z" fill="none" stroke="#F7F8F4" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="m15.5 22.5 3.2 3.2 6-6.4" fill="none" stroke="#AEEA80" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/", suffix, light }: { href?: string; suffix?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label={`HelpSmart${suffix ? ` ${suffix}` : ""} home`}>
      <LogoMark />
      <span className={clsx("text-lg font-semibold tracking-tight", light ? "text-white" : "text-trust")}>
        HelpSmart
        {suffix && <span className={clsx("ml-1.5 rounded-md px-1.5 py-0.5 text-xs font-bold", light ? "bg-smart text-trust" : "bg-smart text-trust")}>{suffix}</span>}
      </span>
    </Link>
  );
}
