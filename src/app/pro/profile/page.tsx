import { getT } from "@/lib/i18n/server";
import { pageProvider } from "@/server/page-guards";
import { getPublicProfile } from "@/server/services/providers";
import { listProviderReviews } from "@/server/services/reviews";
import { formatDate } from "@/lib/i18n/core";
import { Alert, ButtonLink, Card, EmptyState, PageHeader, SectionHeading, Stars } from "@/components/ui";
import { BadgeRow } from "@/components/trust";
import { RespondForm } from "./respond-form";

export const metadata = { title: "My profile" };

export default async function ProProfile() {
  const u = await pageProvider("/pro/profile");
  const { t, locale } = await getT();
  const [pub, reviews] = await Promise.all([getPublicProfile(u.uid), listProviderReviews(u.uid, 50)]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.profile")} actions={<><ButtonLink href="/pro/onboarding" variant="secondary" size="sm">{t("common.edit")}</ButtonLink>{pub && <ButtonLink href={`/providers/${u.uid}`} size="sm">{t("common.view")}</ButtonLink>}</>} />
      {!pub ? <Alert tone="info">{t("pro.notDiscoverable")}</Alert> : (
        <Card className="p-6"><p className="text-lg font-semibold">{pub.businessName || pub.displayName}</p><p className="text-muted">{pub.title}</p><div className="mt-2"><Stars value={pub.ratingAverage} count={pub.ratingCount} size="md" /></div><div className="mt-3"><BadgeRow ids={pub.badges} t={t} size="md" /></div></Card>
      )}
      <section>
        <SectionHeading title={t("provider.reviews")} />
        {reviews.length === 0 ? <EmptyState title={t("provider.noReviews")} /> : (
          <ul className="space-y-3">{reviews.map((r) => (
            <li key={r.id}><Card className="p-5"><div className="flex justify-between"><p className="font-semibold">{r.customerName}</p><p className="text-xs text-muted">{formatDate(r.createdAt, locale, { dateStyle: "medium" })}</p></div><Stars value={r.ratings.overall} />{r.comment && <p className="mt-2 text-sm text-ink/80">{r.comment}</p>}{r.providerResponse ? <p className="mt-3 rounded-xl bg-canvas p-3 text-sm">{r.providerResponse}</p> : <RespondForm reviewId={r.id} />}</Card></li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
