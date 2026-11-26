import Link from "next/link";
import { ShieldCheck, Star, BadgeCheck, Receipt, MessageSquareLock, LifeBuoy, ArrowRight, Check, Search } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { listCategories } from "@/server/services/reference";
import { ButtonLink, Card, Pill } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";
import { TiletBand } from "@/components/tilet";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const { t, list, locale } = await getT();
  const categories = await listCategories().catch(() => []);
  const trust = [
    { icon: ShieldCheck, title: t("landing.trust.identity"), body: t("landing.trust.identityBody") },
    { icon: Star, title: t("landing.trust.reviews"), body: t("landing.trust.reviewsBody") },
    { icon: BadgeCheck, title: t("landing.trust.qualified"), body: t("landing.trust.qualifiedBody") },
    { icon: Receipt, title: t("landing.trust.pricing"), body: t("landing.trust.pricingBody") },
    { icon: MessageSquareLock, title: t("landing.trust.secure"), body: t("landing.trust.secureBody") },
    { icon: LifeBuoy, title: t("landing.trust.support"), body: t("landing.trust.supportBody") },
  ];
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-20">
          <div>
            <Pill tone="brand" className="mb-5">{t("landing.launchCity")}</Pill>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-trust sm:text-5xl lg:text-6xl">{t("landing.heroTitle")}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/75">{t("landing.heroBody")}</p>
            <form action="/explore" className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-line bg-white p-1.5 shadow-[var(--shadow-card)]" role="search">
              <Search className="ml-3 size-5 shrink-0 text-muted" aria-hidden />
              <label htmlFor="hero-q" className="sr-only">{t("common.search")}</label>
              <input id="hero-q" name="q" placeholder={t("home.search")} className="h-11 min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none" />
              <button className="h-11 shrink-0 rounded-full bg-trust px-5 text-sm font-semibold text-white hover:bg-trust-700">{t("landing.findService")}</button>
            </form>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/explore" size="lg">{t("landing.findService")}</ButtonLink>
              <ButtonLink href="/become-a-helper" variant="secondary" size="lg">{t("landing.becomeHelper")}</ButtonLink>
            </div>
            <p className="mt-6 text-sm text-muted">{t("brand.secondary")}</p>
          </div>
          <HeroVisual t={t} />
        </div>
        <TiletBand />
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="services-h">
        <div className="mb-8 flex items-end justify-between">
          <h2 id="services-h" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("landing.servicesTitle")}</h2>
          <Link href="/explore" className="hidden items-center gap-1 text-sm font-semibold text-trust sm:flex">{t("home.seeAll")} <ArrowRight className="size-4" /></Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/explore?category=${c.id}`} className="flex h-full flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-trust/30 hover:shadow-[var(--shadow-card)]">
                <span className="grid size-12 place-items-center rounded-2xl bg-smart/50 text-trust"><CategoryIcon name={c.icon} /></span>
                <span>
                  <span className="block font-semibold text-ink">{c.names[locale] ?? c.names.en}</span>
                  <span className="mt-1 block text-sm leading-snug text-muted">{c.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Trust */}
      <section className="bg-white py-16" aria-labelledby="trust-h">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="trust-h" className="max-w-2xl text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("landing.trustTitle")}</h2>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {trust.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-trust text-smart"><Icon className="size-5" aria-hidden /></span>
                <div>
                  <h3 className="font-semibold text-ink">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-3xl rounded-2xl bg-canvas p-4 text-sm text-muted">{t("landing.trustNote")}</p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="how-h">
        <h2 id="how-h" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("landing.howTitle")}</h2>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {[
            { title: t("landing.forCustomers"), steps: [t("landing.c1"), t("landing.c2"), t("landing.c3")], cta: <ButtonLink href="/signup?type=customer">{t("landing.findService")}</ButtonLink> },
            { title: t("landing.forProviders"), steps: [t("landing.p1"), t("landing.p2"), t("landing.p3")], cta: <ButtonLink href="/signup?type=provider" variant="accent">{t("landing.becomeHelper")}</ButtonLink> },
          ].map((col, i) => (
            <Card key={col.title} className={i === 1 ? "bg-trust p-8 text-white" : "p-8"}>
              <h3 className={i === 1 ? "text-lg font-semibold text-smart" : "text-lg font-semibold text-trust"}>{col.title}</h3>
              <ol className="mt-6 space-y-5">
                {col.steps.map((s, n) => (
                  <li key={s} className="flex items-center gap-4">
                    <span className={i === 1 ? "grid size-9 shrink-0 place-items-center rounded-full bg-smart font-semibold text-trust" : "grid size-9 shrink-0 place-items-center rounded-full bg-trust font-semibold text-white"}>{n + 1}</span>
                    <span className="font-medium">{s}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-8">{col.cta}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
        {[
          { title: t("landing.benefitsCustomerTitle"), items: list("landing.benefitsCustomer") },
          { title: t("landing.benefitsProviderTitle"), items: list("landing.benefitsProvider") },
        ].map((b) => (
          <Card key={b.title} className="p-8">
            <h3 className="text-lg font-semibold text-ink">{b.title}</h3>
            <ul className="mt-5 space-y-3">
              {b.items.map((x) => (
                <li key={x} className="flex items-start gap-3 text-ink/80">
                  <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> {x}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>

      {/* Family */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-start gap-6 rounded-[2rem] bg-smart/40 p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Pill tone="brand">{t("landing.comingSoon")}</Pill>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-trust sm:text-3xl">{t("landing.familyTitle")}</h2>
            <p className="mt-2 text-ink/75">{t("landing.familyBody")}</p>
          </div>
          <ButtonLink href="/family">{t("nav.family")}</ButtonLink>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6" aria-labelledby="faq-h">
        <h2 id="faq-h" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("landing.faqTitle")}</h2>
        <div className="mt-6 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {[1, 2, 3, 4].map((n) => (
            <details key={n} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-ink">
                {t(`landing.faq.q${n}`)}
                <span className="text-trust transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{t(`landing.faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="rounded-[2rem] bg-trust px-8 py-12 text-center text-white sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("landing.ctaTitle")}</h2>
          <p className="mt-2 text-white/70">{t("landing.ctaBody")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/signup?type=customer" variant="accent" size="lg">{t("landing.findService")}</ButtonLink>
            <ButtonLink href="/signup?type=provider" variant="secondary" size="lg">{t("landing.becomeHelper")}</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Illustrative product preview — clearly labelled and not a real profile.
 * Replace with licensed photography of Ethiopian professionals (see public/images/README.md).
 */
function HeroVisual({ t }: { t: (k: string) => string }) {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -right-10 -top-10 size-72 rounded-full bg-smart/40 blur-3xl" aria-hidden />
      <div className="relative rounded-[2rem] bg-trust p-6 shadow-[var(--shadow-pop)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-smart/80">Illustrative preview</p>
        <div className="mt-4 space-y-3">
          {[
            { k: "house-cleaning", icon: "Sparkles", label: "House cleaning", meta: "Bole · Available today" },
            { k: "plumbing", icon: "Wrench", label: "Plumbing", meta: "Kirkos · Quotes in ETB" },
            { k: "electrical", icon: "Zap", label: "Electrical", meta: "Yeka · Scheduled visits" },
          ].map((r) => (
            <div key={r.k} className="flex items-center gap-4 rounded-2xl bg-white/95 p-4">
              <span className="grid size-11 place-items-center rounded-xl bg-smart/60 text-trust"><CategoryIcon name={r.icon} className="size-5" /></span>
              <div className="flex-1">
                <p className="font-semibold text-ink">{r.label}</p>
                <p className="text-xs text-muted">{r.meta}</p>
              </div>
              <ArrowRight className="size-4 text-trust" aria-hidden />
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-white"><ShieldCheck className="size-3.5 text-smart" /> {t("badges.fayda_verified")}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-white"><BadgeCheck className="size-3.5 text-smart" /> {t("badges.helpsmart_approved")}</span>
        </div>
      </div>
    </div>
  );
}
