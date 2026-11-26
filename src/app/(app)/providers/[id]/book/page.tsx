import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { getPublicProfile } from "@/server/services/providers";
import { getSettings, listCategories } from "@/server/services/reference";
import { listAddresses } from "@/server/services/accounts";
import { regionOptions } from "@/server/view-helpers";
import { Card, PageHeader } from "@/components/ui";
import { VerifyRequired } from "@/components/verify-required";
import { BookingForm } from "./booking-form";

export const metadata = { title: "Book a professional" };

export default async function BookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ quote?: string }> }) {
  const { id } = await params;
  const { quote } = await searchParams;
  const u = await pageUser(`/providers/${id}/book`);
  const p = await getPublicProfile(id);
  if (!p || p.id === u.uid) notFound();
  const { t, locale } = await getT();
  if (!u.verified) return <div className="mx-auto max-w-2xl"><PageHeader title={t("booking.newTitle", { name: p.displayName })} /><VerifyRequired t={t} next={`/providers/${id}/book`} /></div>;
  const [cats, settings, addresses, regions] = await Promise.all([listCategories(), getSettings(), listAddresses(u.uid), regionOptions(locale)]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("booking.newTitle", { name: p.businessName || p.displayName })} subtitle={p.title} />
      <Card className="p-6 sm:p-8">
        <BookingForm
          provider={{ id: p.id, pricing: p.pricing, availableNow: p.availableNow, acceptsRecurring: p.acceptsRecurring }}
          categories={cats.filter((c) => p.categoryIds.includes(c.id)).map((c) => ({ id: c.id, name: c.names[locale] ?? c.names.en }))}
          fees={{ commissionRate: settings.commissionRate, customerServiceFeeRate: settings.customerServiceFeeRate, customerServiceFeeMinMinor: settings.customerServiceFeeMinMinor }}
          addresses={addresses.map((a) => ({ id: a.id, label: a.label, subCityId: a.subCityId, neighborhoodId: a.neighborhoodId ?? null, landmark: a.landmark, directions: a.directions }))}
          regions={regions}
          defaultArea={{ subCityId: u.doc.onboarding?.subCityId ?? "", neighborhoodId: u.doc.onboarding?.neighborhoodId ?? null }}
          wantQuote={quote === "1"}
        />
      </Card>
    </div>
  );
}
