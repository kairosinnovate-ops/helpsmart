import { getT } from "@/lib/i18n/server";
import { pageProvider } from "@/server/page-guards";
import { getProviderWorkspace } from "@/server/services/providers";
import { listCategories } from "@/server/services/reference";
import { regionOptions } from "@/server/view-helpers";
import { PageHeader } from "@/components/ui";
import { ApprovalPill } from "@/components/trust";
import { Wizard } from "./wizard";

export const metadata = { title: "Set up HelpSmart Pro" };

export default async function ProOnboarding({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { step } = await searchParams;
  const u = await pageProvider("/pro/onboarding");
  const { t, locale } = await getT();
  const [ws, cats, allCats, regions] = await Promise.all([getProviderWorkspace(u.uid, u.verified), listCategories(), listCategories({ includeInactive: true }), regionOptions(locale)]);
  return (
    <div>
      <PageHeader title={t("pro.continueSetup")} subtitle={t("pro.completion", { percent: ws.completion.percent })} actions={<ApprovalPill status={ws.application.status} t={t} />} />
      <Wizard
        uid={u.uid}
        initialStep={step}
        verified={u.verified}
        identityStatus={u.doc.identityStatus}
        workspace={JSON.parse(JSON.stringify({ ...ws, profile: ws.profile ? { ...ws.profile, createdAt: null, updatedAt: null } : null }))}
        categories={cats.map((c) => ({ id: c.id, name: c.names[locale] ?? c.names.en }))}
        gatedCategories={allCats.filter((c) => !c.active && c.requiresSafeguarding).map((c) => c.names[locale] ?? c.names.en)}
        regions={regions}
      />
    </div>
  );
}
