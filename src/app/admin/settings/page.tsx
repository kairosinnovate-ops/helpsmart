import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { getSettings } from "@/server/services/reference";
import { Alert, Card, PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export default async function AdminSettings() {
  await pageAdmin("settings.manage");
  const { t } = await getT();
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.nav.settings")} />
      <Alert tone="warning">The 12% commission is an illustrative development default. Changes apply to new bookings only and are recorded in the audit log.</Alert>
      <Card className="p-6"><SettingsForm initial={{ commissionRate: s.commissionRate, customerServiceFeeRate: s.customerServiceFeeRate, customerServiceFeeMinMinor: s.customerServiceFeeMinMinor, careServicesEnabled: s.careServicesEnabled, jobsModuleEnabled: s.jobsModuleEnabled, familyModuleEnabled: s.familyModuleEnabled }} /></Card>
    </div>
  );
}
