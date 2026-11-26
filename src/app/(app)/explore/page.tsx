import Link from "next/link";
import { SlidersHorizontal, MapPinned, List } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { listCategories } from "@/server/services/reference";
import { searchFromQuery } from "@/server/services/providers";
import { regionOptions } from "@/server/view-helpers";
import { LOCALE_NAMES } from "@/lib/i18n/core";
import { Alert, Button, ButtonLink, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { ProviderCard } from "@/components/provider-card";
import { ZodError } from "zod";

export const metadata = { title: "Explore professionals" };

type SP = Record<string, string | undefined>;

export default async function Explore({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { t, locale } = await getT();
  const [cats, regions] = await Promise.all([listCategories(), regionOptions(locale)]);
  // Free-text that matches a category name selects that category.
  const q = sp.q?.trim();
  const matchCat = q ? cats.find((c) => Object.values(c.names).some((n) => n.toLowerCase() === q.toLowerCase())) : undefined;
  const params: SP = { ...sp, category: sp.category || matchCat?.id, q: matchCat ? undefined : q || undefined };
  let result: Awaited<ReturnType<typeof searchFromQuery>> | null = null;
  let invalid = false;
  try {
    result = await searchFromQuery(Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as SP);
  } catch (e) {
    if (e instanceof ZodError) invalid = true;
    else throw e;
  }
  const view = sp.view === "map" ? "map" : "list";
  const mapConfigured = !!process.env.NEXT_PUBLIC_MAP_PROVIDER;
  const subs = regions.filter((r) => r.type === "sub_city").sort((a, b) => a.name.localeCompare(b.name));
  const qs = (patch: SP) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/explore?${u.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title={t("explore.title")}
        subtitle={result ? t("explore.results", { count: result.total }) : undefined}
        actions={
          <div className="inline-flex rounded-full border border-line bg-white p-1" role="group" aria-label="View">
            <Link href={qs({ view: undefined })} aria-current={view === "list" ? "true" : undefined} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium ${view === "list" ? "bg-trust text-white" : "text-ink"}`}><List className="size-4" /> {t("explore.list")}</Link>
            <Link href={qs({ view: "map" })} aria-current={view === "map" ? "true" : undefined} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium ${view === "map" ? "bg-trust text-white" : "text-ink"}`}><MapPinned className="size-4" /> {t("explore.map")}</Link>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <details className="group lg:block" open>
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 font-semibold text-ink lg:hidden"><SlidersHorizontal className="size-4" /> {t("explore.filters")}</summary>
          <Card className="p-5">
            <form action="/explore" className="space-y-4">
              {q && !matchCat && <input type="hidden" name="q" value={q} />}
              <Field label={t("explore.category")} htmlFor="f-cat">
                <Select id="f-cat" name="category" defaultValue={params.category ?? ""}>
                  <option value="">{t("explore.allCategories")}</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.names[locale] ?? c.names.en}</option>)}
                </Select>
              </Field>
              <Field label={t("explore.subCity")} htmlFor="f-sub">
                <Select id="f-sub" name="subCity" defaultValue={sp.subCity ?? ""}>
                  <option value="">{t("explore.anywhere")}</option>
                  {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label={t("explore.distance")} htmlFor="f-km">
                <Select id="f-km" name="maxKm" defaultValue={sp.maxKm ?? ""}>
                  <option value="">—</option>
                  {[2, 5, 10, 20].map((k) => <option key={k} value={k}>{`≤ ${k} km`}</option>)}
                </Select>
              </Field>
              <Field label={t("explore.minRating")} htmlFor="f-rating">
                <Select id="f-rating" name="minRating" defaultValue={sp.minRating ?? ""}>
                  <option value="">—</option>
                  {[3, 4, 4.5].map((r) => <option key={r} value={r}>{`${r}+`}</option>)}
                </Select>
              </Field>
              <Field label={t("explore.price")} htmlFor="f-price">
                <Input id="f-price" name="maxPrice" type="number" min={0} inputMode="numeric" defaultValue={sp.maxPrice ?? ""} />
              </Field>
              <Field label={t("explore.experience")} htmlFor="f-years">
                <Input id="f-years" name="minYears" type="number" min={0} max={60} inputMode="numeric" defaultValue={sp.minYears ?? ""} />
              </Field>
              <Field label={t("explore.languageSpoken")} htmlFor="f-lang">
                <Select id="f-lang" name="language" defaultValue={sp.language ?? ""}>
                  <option value="">—</option>
                  {Object.entries(LOCALE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label={t("explore.providerType")} htmlFor="f-type">
                <Select id="f-type" name="type" defaultValue={sp.type ?? ""}>
                  <option value="">{t("explore.anyType")}</option>
                  <option value="individual">{t("auth.individual")}</option>
                  <option value="business">{t("auth.business")}</option>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="availableNow" value="true" defaultChecked={sp.availableNow === "true"} className="size-5 accent-trust" /> {t("explore.availableNow")}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="certified" value="true" defaultChecked={sp.certified === "true"} className="size-5 accent-trust" /> {t("explore.certified")}</label>
              <Field label={t("explore.sort")} htmlFor="f-sort">
                <Select id="f-sort" name="sort" defaultValue={sp.sort ?? "recommended"}>
                  {["recommended", "nearest", "rating", "price_asc", "price_desc", "experience", "jobs"].map((s) => <option key={s} value={s}>{t(`explore.sorts.${s}`)}</option>)}
                </Select>
              </Field>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">{t("explore.apply")}</Button>
                <ButtonLink href="/explore" variant="ghost">{t("explore.reset")}</ButtonLink>
              </div>
            </form>
          </Card>
        </details>
        <section aria-live="polite">
          {invalid && <Alert tone="warning" className="mb-4">{t("common.error")}</Alert>}
          {view === "map" && !mapConfigured && <Alert tone="info" className="mb-4">{t("explore.mapUnavailable")}</Alert>}
          {result && result.results.length === 0 ? (
            <EmptyState title={t("explore.noResults")} body={t("explore.noResultsBody")} action={<ButtonLink href="/requests/new" variant="secondary">{t("nav.postRequest")}</ButtonLink>} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result?.results.map((p) => <li key={p.id}><ProviderCard p={p} t={t} locale={locale} distanceKm={p.distanceKm} /></li>)}
            </ul>
          )}
          {result && result.total > result.page * result.pageSize && (
            <div className="mt-6 text-center"><ButtonLink href={qs({ page: String(result.page + 1) })} variant="secondary">{t("home.seeAll")}</ButtonLink></div>
          )}
        </section>
      </div>
    </div>
  );
}
