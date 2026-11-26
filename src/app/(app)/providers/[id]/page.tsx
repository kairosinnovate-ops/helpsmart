import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Briefcase, Languages, Clock, CalendarDays, ShieldAlert } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/server/auth/session";
import { isIdentityVerified } from "@/server/auth/guards";
import { getPublicProfile, isSaved } from "@/server/services/providers";
import { listProviderReviews } from "@/server/services/reviews";
import { listCategories } from "@/server/services/reference";
import { LOCALE_NAMES, formatDate, makeList } from "@/lib/i18n/core";
import { Avatar, Card, Pill, SectionHeading, Stars } from "@/components/ui";
import { BadgeRow } from "@/components/trust";
import { priceLabel } from "@/components/provider-card";
import { VerifyRequired } from "@/components/verify-required";
import { ProviderActions } from "./provider-actions";
import { RATING_DIMENSIONS } from "@/domain/reviews";
import type { Locale } from "@/domain/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getPublicProfile((await params).id);
  return { title: p ? `${p.businessName || p.displayName} — ${p.title}` : "Professional" };
}

export default async function ProviderProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPublicProfile(id);
  if (!p) notFound();
  const { t, locale } = await getT();
  const days = makeList(locale)("common.days");
  const user = await getSessionUser();
  const verified = user ? isIdentityVerified(user) : false;
  const [reviews, cats, saved] = await Promise.all([listProviderReviews(id), listCategories(), user ? isSaved(user.uid, id) : Promise.resolve(false)]);
  const catNames = p.categoryIds.map((c) => cats.find((x) => x.id === c)).filter(Boolean).map((c) => c!.names[locale] ?? c!.names.en);
  const isSelf = user?.uid === id;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Avatar name={p.displayName} size={88} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{p.businessName || p.displayName}</h1>
              <p className="mt-0.5 text-muted">{p.title}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <Stars value={p.ratingAverage} count={p.ratingCount} size="md" />
                <span className="inline-flex items-center gap-1 text-muted"><Briefcase className="size-4" /> {t("provider.jobs", { n: p.completedJobs })}</span>
                <span className="inline-flex items-center gap-1 text-muted"><MapPin className="size-4" /> {t("provider.serves", { area: p.neighborhoodName ?? p.subCityName })} {t("provider.within", { km: p.serviceRadiusKm })}</span>
              </div>
              <div className="mt-4"><BadgeRow ids={p.badges} t={t} size="md" /></div>
              <div className="mt-3 flex gap-2">
                <Pill tone={p.availableNow ? "green" : "neutral"}>{p.availableNow ? t("provider.availableNow") : t("provider.notAvailableNow")}</Pill>
                {p.isDemo && <Pill tone="amber">{t("provider.demo")}</Pill>}
              </div>
            </div>
          </div>
          <p className="mt-6 text-xs text-muted">{t("provider.identityNote")}</p>
        </Card>

        <Card className="p-6 sm:p-8">
          <SectionHeading title={t("provider.about")} />
          <p className="whitespace-pre-line leading-relaxed text-ink/80">{p.bio}</p>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <div><dt className="text-sm text-muted">{t("provider.services")}</dt><dd className="mt-1 flex flex-wrap gap-1.5">{catNames.map((n) => <Pill key={n} tone="brand">{n}</Pill>)}</dd></div>
            <div><dt className="flex items-center gap-1 text-sm text-muted"><Languages className="size-4" /> {t("provider.languages")}</dt><dd className="mt-1 font-medium">{p.languages.map((l) => LOCALE_NAMES[l as Locale] ?? l).join(", ")}</dd></div>
            <div><dt className="flex items-center gap-1 text-sm text-muted"><CalendarDays className="size-4" /> {t("provider.availability")}</dt><dd className="mt-1 font-medium">{p.workingDays.map((d) => days[d]).join(", ") || "—"} · {p.hours.start}–{p.hours.end}</dd></div>
            <div><dt className="flex items-center gap-1 text-sm text-muted"><Clock className="size-4" /> {t("provider.years", { n: p.yearsExperience })}</dt><dd className="mt-1 font-medium">{p.providerType === "business" ? t("auth.business") : t("auth.individual")}</dd></div>
          </dl>
        </Card>

        <Card className="p-6 sm:p-8" id="reviews">
          <SectionHeading title={t("provider.reviews")} subtitle={p.ratingCount ? `${p.ratingAverage.toFixed(1)} / 5 · ${p.ratingCount}` : undefined} />
          {reviews.length === 0 ? (
            <p className="text-sm text-muted">{t("provider.noReviews")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {reviews.map((r) => (
                <li key={r.id} className="py-5 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{r.customerName}</p>
                    <p className="text-xs text-muted">{formatDate(r.createdAt, locale, { dateStyle: "medium" })}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2"><Stars value={r.ratings.overall} /><Pill tone="green">{t("provider.verifiedBooking")}</Pill></div>
                  <p className="mt-1 text-xs text-muted">{RATING_DIMENSIONS.filter((d) => d !== "overall").map((d) => `${t(`review.${d}`)} ${r.ratings[d]}`).join(" · ")}</p>
                  {r.comment && <p className="mt-2 text-ink/80">{r.comment}</p>}
                  {r.providerResponse && <div className="mt-3 rounded-xl bg-canvas p-3 text-sm"><p className="font-semibold text-trust">{t("provider.providerResponse")}</p><p className="mt-1 text-ink/80">{r.providerResponse}</p></div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="p-6">
          <p className="text-sm text-muted">{t("provider.pricing")}</p>
          <p className="mt-1 text-2xl font-semibold text-trust">{priceLabel(p, t, locale)}</p>
          {p.pricing.callOutFeeMinor > 0 && <p className="text-sm text-muted">+ call-out fee</p>}
          <p className="mt-4 text-sm text-muted">{t("provider.cancellation")}</p>
          <p className="text-sm text-ink/80">{t(`provider.cancellationPolicies.${p.pricing.cancellationPolicy}`)}</p>
          {!isSelf && (
            <div className="mt-6">
              <ProviderActions providerId={p.id} signedIn={!!user} verified={verified} saved={saved} quoteOnly={p.pricing.model === "quote" || p.pricing.model === "negotiable"} />
            </div>
          )}
        </Card>
        {user && !verified && !isSelf && <VerifyRequired t={t} next={`/providers/${p.id}`} />}
        <p className="flex items-start gap-2 px-2 text-xs text-muted"><ShieldAlert className="size-4 shrink-0" /> {t("messages.safety")}</p>
      </aside>
    </div>
  );
}
