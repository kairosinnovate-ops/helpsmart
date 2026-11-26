import Link from "next/link";
import { Search, ArrowRight, LayoutGrid, CalendarCheck, FilePlus2 } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { listCategories, resolveArea } from "@/server/services/reference";
import { listSavedProviders, searchProviders, type PublicProfile } from "@/server/services/providers";
import { listBookings } from "@/server/services/bookings";
import { ACTIVE_BOOKING_STATUSES } from "@/domain/booking";
import { formatDate } from "@/lib/i18n/core";
import { ButtonLink, Card, EmptyState, SectionHeading } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";
import { ProviderCard } from "@/components/provider-card";
import { BookingPill } from "@/components/trust";
import { VerifyRequired } from "@/components/verify-required";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const u = await pageUser("/home");
  const { t, locale } = await getT();
  const origin = u.doc.onboarding?.subCityId
    ? (await resolveArea(u.doc.onboarding.subCityId, u.doc.onboarding.neighborhoodId ?? null).catch(() => null))?.center ?? null
    : null;
  const [cats, nearby, top, today, upcoming, saved] = await Promise.all([
    listCategories(),
    searchProviders({ origin, sort: origin ? "nearest" : "recommended", pageSize: 6 }),
    searchProviders({ origin, sort: "rating", minRating: 4, pageSize: 3 }),
    searchProviders({ origin, availableNow: true, pageSize: 3 }),
    listBookings(u.uid, "customer", { statuses: ACTIVE_BOOKING_STATUSES, limit: 5 }),
    listSavedProviders(u.uid),
  ]);
  const homeCats = cats.slice(0, 7);
  const grid = (items: (PublicProfile & { distanceKm?: number | null })[]) => (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <li key={p.id}><ProviderCard p={p} t={t} locale={locale} distanceKm={p.distanceKm} /></li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm font-medium text-muted">{t("home.greeting", { name: u.doc.displayName.split(" ")[0] })}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-trust sm:text-3xl">{t("home.title")}</h1>
        <p className="mt-1 text-muted">{t("home.body")}</p>
        <form action="/explore" role="search" className="mt-5 flex items-center gap-2 rounded-full border border-line bg-white p-1.5 shadow-[var(--shadow-card)]">
          <Search className="ml-3 size-5 shrink-0 text-muted" aria-hidden />
          <label htmlFor="q" className="sr-only">{t("common.search")}</label>
          <input id="q" name="q" list="cat-suggest" placeholder={t("home.search")} className="h-11 min-w-0 flex-1 bg-transparent focus:outline-none" />
          <datalist id="cat-suggest">{cats.map((c) => <option key={c.id} value={c.names[locale] ?? c.names.en} />)}</datalist>
          <button className="h-11 shrink-0 rounded-full bg-trust px-5 text-sm font-semibold text-white">{t("common.search")}</button>
        </form>
      </section>

      {!u.verified && <VerifyRequired t={t} next="/home" />}

      <section aria-labelledby="cats">
        <h2 id="cats" className="sr-only">{t("home.categories")}</h2>
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {homeCats.map((c) => (
            <li key={c.id}>
              <Link href={`/explore?category=${c.id}`} className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center hover:bg-white">
                <span className="grid size-14 place-items-center rounded-2xl bg-white text-trust shadow-[var(--shadow-card)]"><CategoryIcon name={c.icon} /></span>
                <span className="text-xs font-medium leading-tight text-ink">{c.names[locale] ?? c.names.en}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/explore" className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center hover:bg-white">
              <span className="grid size-14 place-items-center rounded-2xl bg-trust text-smart"><LayoutGrid className="size-6" aria-hidden /></span>
              <span className="text-xs font-medium leading-tight text-ink">{t("home.allServices")}</span>
            </Link>
          </li>
        </ul>
      </section>

      <section>
        <SectionHeading title={t("home.upcoming")} action={<Link href="/bookings" className="text-sm font-semibold text-trust">{t("home.seeAll")}</Link>} />
        {upcoming.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="size-6" />} title={t("home.noUpcoming")} body={t("home.noUpcomingBody")} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((b) => (
              <li key={b.id}>
                <Link href={`/bookings/${b.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 hover:border-trust/30">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{b.providerName}</p>
                    <p className="text-sm text-muted">{b.scheduledFor ? formatDate(b.scheduledFor, locale) : t("booking.now")} · {b.reference}</p>
                  </div>
                  <BookingPill status={b.status} t={t} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeading title={t("home.nearby")} action={<Link href="/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-trust">{t("home.seeAll")} <ArrowRight className="size-4" /></Link>} />
        {nearby.results.length ? grid(nearby.results) : <EmptyState title={t("home.noProviders")} body={t("home.noProvidersBody")} action={<ButtonLink href="/requests/new" variant="secondary">{t("nav.postRequest")}</ButtonLink>} />}
      </section>

      {today.results.length > 0 && (
        <section><SectionHeading title={t("home.availableToday")} />{grid(today.results)}</section>
      )}
      {top.results.length > 0 && (
        <section><SectionHeading title={t("home.topRated")} />{grid(top.results)}</section>
      )}
      {saved.length > 0 && (
        <section><SectionHeading title={t("home.saved")} />{grid(saved)}</section>
      )}

      <Card className="flex flex-col items-start gap-4 bg-trust p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FilePlus2 className="mt-1 size-6 text-smart" aria-hidden />
          <div>
            <p className="font-semibold">{t("home.postRequestTitle")}</p>
            <p className="text-sm text-white/75">{t("home.postRequestBody")}</p>
          </div>
        </div>
        <ButtonLink href="/requests/new" variant="accent">{t("nav.postRequest")}</ButtonLink>
      </Card>
    </div>
  );
}
