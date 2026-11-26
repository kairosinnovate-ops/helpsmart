"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { RegionPicker, type RegionOption } from "@/components/forms/region-picker";
import { Alert, Button, ButtonLink } from "@/components/ui";

export function OnboardingForm({ regions, categories, initial }: { regions: RegionOption[]; categories: { id: string; name: string }[]; initial: { subCityId: string; neighborhoodId: string | null } }) {
  const { t } = useT();
  const router = useRouter();
  const [area, setArea] = useState(initial);
  const [picked, setPicked] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const { run, busy, error } = useAction();

  if (done) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold text-ink">{t("onboarding.done")}</h2>
        <p className="mt-1 text-muted">{t("onboarding.doneBody")}</p>
        <ButtonLink href="/home" className="mt-6">{t("nav.explore")}</ButtonLink>
      </div>
    );
  }
  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run("/api/v1/account", { subCityId: area.subCityId, neighborhoodId: area.neighborhoodId, preferredCategoryIds: picked }, { method: "PATCH", refresh: false });
        if (r) {
          setDone(true);
          router.refresh();
        }
      }}
    >
      <RegionPicker regions={regions} subCityId={area.subCityId} neighborhoodId={area.neighborhoodId} onChange={setArea} />
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-ink">{t("onboarding.interests")}</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))} className={clsx("rounded-full border px-4 py-2 text-sm font-medium", on ? "border-trust bg-trust text-white" : "border-line bg-white text-ink hover:border-trust/40")}>
                {c.name}
              </button>
            );
          })}
        </div>
      </fieldset>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!area.subCityId}>{t("onboarding.finish")}</Button>
    </form>
  );
}
