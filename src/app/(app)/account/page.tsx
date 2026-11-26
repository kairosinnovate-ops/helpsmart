import Link from "next/link";
import { ShieldCheck, Phone } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { listAddresses } from "@/server/services/accounts";
import { getSettings } from "@/server/services/reference";
import { regionOptions } from "@/server/view-helpers";
import { maskPhone } from "@/domain/phone";
import { ButtonLink, Card, PageHeader, SectionHeading } from "@/components/ui";
import { IdentityPill } from "@/components/trust";
import { AddressManager, BecomeProvider, DeleteAccount, LogoutButton, ProfileForm, SupportForm } from "./account-client";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const u = await pageUser("/account");
  const { t, locale } = await getT();
  const [addresses, regions, settings] = await Promise.all([listAddresses(u.uid), regionOptions(locale), getSettings()]);
  const isProvider = u.doc.roles.includes("provider");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("account.title")} subtitle={u.email ?? undefined} actions={<LogoutButton />} />
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-trust text-smart"><ShieldCheck className="size-5" /></span>
          <div>
            <p className="font-semibold text-ink">{t("account.identity")}</p>
            <div className="mt-1"><IdentityPill status={u.doc.identityStatus} t={t} /></div>
          </div>
        </div>
        {u.doc.identityStatus !== "fayda_verified" && <ButtonLink href="/account/verify" size="sm">{t("verify.verifyNow")}</ButtonLink>}
      </Card>
      <Card className="p-6" id="location">
        <SectionHeading title={t("account.personal")} subtitle={u.doc.phoneE164 ? maskPhone(u.doc.phoneE164) : undefined} />
        <ProfileForm initial={{ displayName: u.doc.displayName, locale: u.doc.locale, subCityId: u.doc.onboarding?.subCityId ?? "", neighborhoodId: u.doc.onboarding?.neighborhoodId ?? null }} regions={regions} />
      </Card>
      <Card className="p-6">
        <SectionHeading title={t("account.addresses")} />
        <AddressManager addresses={addresses.map((a) => ({ id: a.id, label: a.label, subCityId: a.subCityId, landmark: a.landmark }))} regions={regions} />
      </Card>
      {isProvider ? (
        <Card className="flex items-center justify-between p-6"><p className="font-semibold text-ink">{t("brand.pro")}</p><ButtonLink href="/pro" variant="accent" size="sm">{t("nav.switchToPro")}</ButtonLink></Card>
      ) : (
        <Card className="p-6"><SectionHeading title={t("account.becomeProvider")} /><BecomeProvider /></Card>
      )}
      <Card className="p-6"><SectionHeading title={t("account.support")} /><SupportForm /></Card>
      <Card className="p-6">
        <SectionHeading title={t("account.safetyTitle")} subtitle={t("account.safetyBody")} />
        <ul className="grid gap-2 sm:grid-cols-3">
          {settings.safetyResources.map((r) => (
            <li key={r.value}><a href={`tel:${r.value}`} className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm"><Phone className="size-4 text-trust" /> <span><span className="block font-semibold">{r.value}</span><span className="text-muted">{r.label}</span></span></a></li>
          ))}
        </ul>
        <Link href="/safety" className="mt-3 inline-block text-sm font-semibold text-trust">{t("footer.safety")}</Link>
      </Card>
      <Card className="p-6"><SectionHeading title={t("account.privacy")} /><DeleteAccount pending={u.doc.accountStatus === "deletion_requested"} /></Card>
    </div>
  );
}
