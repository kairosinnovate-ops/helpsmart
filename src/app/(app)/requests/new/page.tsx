import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { listCategories } from "@/server/services/reference";
import { regionOptions } from "@/server/view-helpers";
import { Card, PageHeader } from "@/components/ui";
import { VerifyRequired } from "@/components/verify-required";
import { RequestForm } from "./request-form";

export const metadata = { title: "Post a request" };

export default async function NewRequest({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const u = await pageUser("/requests/new");
  const { t, locale } = await getT();
  const [cats, regions] = await Promise.all([listCategories(), regionOptions(locale)]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("requests.newTitle")} subtitle={t("requests.newBody")} />
      {!u.verified ? (
        <VerifyRequired t={t} next="/requests/new" />
      ) : (
        <Card className="p-6 sm:p-8">
          <RequestForm categories={cats.map((c) => ({ id: c.id, name: c.names[locale] ?? c.names.en }))} regions={regions} initialCategory={category ?? cats[0]?.id ?? ""} defaultArea={{ subCityId: u.doc.onboarding?.subCityId ?? "", neighborhoodId: u.doc.onboarding?.neighborhoodId ?? null }} />
        </Card>
      )}
    </div>
  );
}
