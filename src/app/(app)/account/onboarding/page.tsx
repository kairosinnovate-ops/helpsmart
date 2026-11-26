import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { regionOptions } from "@/server/view-helpers";
import { listCategories } from "@/server/services/reference";
import { Card, PageHeader } from "@/components/ui";
import { OnboardingForm } from "./onboarding-form";

export default async function Onboarding() {
  const u = await pageUser("/account/onboarding");
  const { t, locale } = await getT();
  const [regions, cats] = await Promise.all([regionOptions(locale), listCategories()]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("onboarding.title")} subtitle={t("onboarding.subtitle")} />
      <Card className="p-6 sm:p-8">
        <OnboardingForm
          regions={regions}
          categories={cats.map((c) => ({ id: c.id, name: c.names[locale] ?? c.names.en }))}
          initial={{ subCityId: u.doc.onboarding?.subCityId ?? "", neighborhoodId: u.doc.onboarding?.neighborhoodId ?? null }}
        />
      </Card>
    </div>
  );
}
