import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { listCategories, getSettings } from "@/server/services/reference";
import { Alert, PageHeader } from "@/components/ui";
import { CategoryEditor } from "./category-editor";
import { CATEGORY_ICON_NAMES } from "@/components/category-icon";

export default async function AdminCategories() {
  await pageAdmin("categories.manage");
  const { t } = await getT();
  const [cats, settings] = await Promise.all([listCategories({ includeInactive: true }), getSettings()]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.nav.categories")} subtitle="Add, translate, order, activate or deactivate services without code changes." />
      {!settings.careServicesEnabled && <Alert tone="info">Care categories (requires safeguarding) stay hidden until “Care services enabled” is switched on in Settings.</Alert>}
      <CategoryEditor categories={JSON.parse(JSON.stringify(cats))} icons={CATEGORY_ICON_NAMES} />
    </div>
  );
}
