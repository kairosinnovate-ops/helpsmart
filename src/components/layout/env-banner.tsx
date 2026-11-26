import { getT } from "@/lib/i18n/server";

/** Makes non-production environments impossible to mistake for the real service. */
export async function EnvBanner() {
  const env = process.env.APP_ENV ?? "development";
  if (env === "production") return null;
  const { t } = await getT();
  return (
    <div className="bg-warning-50 px-4 py-1.5 text-center text-xs font-semibold text-warning" role="note">
      {env === "staging" ? t("common.stagingEnvironment") : `${t("common.devEnvironment")} · ${process.env.IDENTITY_MODE === "dev_fixture" ? "Identity: dev fixtures" : "Identity: Fayda not configured"}`}
    </div>
  );
}
