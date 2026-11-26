import { getT } from "@/lib/i18n/server";

/** Makes non-production environments impossible to mistake for the real service, and says how identity works there. */
export async function EnvBanner() {
  const env = process.env.APP_ENV ?? "development";
  if (env === "production") return null;
  const { t } = await getT();
  const label = env === "staging" ? t("common.stagingEnvironment") : t("common.devEnvironment");
  const fixture = (env === "development" || env === "test") && process.env.IDENTITY_MODE === "dev_fixture";
  const identity = fixture
    ? t("common.identityDevFixture")
    : process.env.IDENTITY_MODE === "fayda_oidc"
      ? t("common.identityFaydaSandbox")
      : t("common.identityNotConfigured");
  return (
    <div className="bg-warning-50 px-4 py-1.5 text-center text-xs font-semibold text-warning" role="note">
      {label} · {identity}
    </div>
  );
}
