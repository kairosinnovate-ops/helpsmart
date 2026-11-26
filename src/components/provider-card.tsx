import Link from "next/link";
import { MapPin, Briefcase } from "lucide-react";
import type { PublicProfile } from "@/server/services/providers";
import type { TFunction } from "@/lib/i18n/core";
import { formatDistance } from "@/domain/geo";
import { formatEtb } from "@/domain/pricing";
import { Avatar, Card, Pill, Stars } from "@/components/ui";
import { BadgeRow } from "./trust";

export function priceLabel(p: Pick<PublicProfile, "pricing">, t: TFunction, locale: string) {
  const { model, rateMinor } = p.pricing;
  if (model === "negotiable") return t("provider.negotiable");
  if (model === "quote" || rateMinor == null) return t("provider.quote");
  const suffix = model === "hourly" ? ` ${t("provider.perHour")}` : model === "daily" ? ` ${t("provider.perDay")}` : ` ${t("provider.fixed")}`;
  return `${t("provider.from", { price: formatEtb(rateMinor, locale) })}${suffix}`;
}

export function ProviderCard({ p, t, locale, distanceKm }: { p: PublicProfile; t: TFunction; locale: string; distanceKm?: number | null }) {
  return (
    <Card as="article" className="group relative flex h-full flex-col p-5 transition-shadow hover:shadow-[var(--shadow-pop)]">
      <div className="flex items-start gap-4">
        <Avatar name={p.displayName} size={56} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-ink">
            <Link href={`/providers/${p.id}`} className="after:absolute after:inset-0 focus:outline-none">
              {p.businessName || p.displayName}
            </Link>
          </h3>
          <p className="truncate text-sm text-muted">{p.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Stars value={p.ratingAverage} count={p.ratingCount} />
            {p.completedJobs > 0 && (
              <span className="inline-flex items-center gap-1 text-muted">
                <Briefcase className="size-3.5" aria-hidden /> {t("provider.jobs", { n: p.completedJobs })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <BadgeRow ids={p.badges} t={t} />
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 pt-4 text-sm">
        <span className="inline-flex items-center gap-1 text-muted">
          <MapPin className="size-4" aria-hidden />
          {p.neighborhoodName ?? p.subCityName}
          {distanceKm != null && ` · ${formatDistance(distanceKm)}`}
        </span>
        <span className="font-semibold text-trust">{priceLabel(p, t, locale)}</span>
      </div>
      <div className="mt-3 flex gap-2">
        {p.availableNow && <Pill tone="green">{t("provider.availableNow")}</Pill>}
        {p.isDemo && <Pill tone="amber">{t("provider.demo")}</Pill>}
      </div>
    </Card>
  );
}
