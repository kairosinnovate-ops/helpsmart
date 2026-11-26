"use client";
import { useT } from "@/lib/i18n/client";
import { Field, Select } from "@/components/ui";

export interface RegionOption {
  id: string;
  type: "city" | "sub_city" | "neighborhood";
  parentId: string | null;
  name: string;
}

export function RegionPicker({
  regions,
  subCityId,
  neighborhoodId,
  onChange,
  idPrefix = "rp",
  allowAny = false,
  required = true,
}: {
  regions: RegionOption[];
  subCityId: string;
  neighborhoodId: string | null;
  onChange: (v: { subCityId: string; neighborhoodId: string | null }) => void;
  idPrefix?: string;
  allowAny?: boolean;
  required?: boolean;
}) {
  const { t } = useT();
  const subs = regions.filter((r) => r.type === "sub_city").sort((a, b) => a.name.localeCompare(b.name));
  const nbs = regions.filter((r) => r.type === "neighborhood" && r.parentId === subCityId).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label={t("onboarding.city")} htmlFor={`${idPrefix}-city`}>
        <Select id={`${idPrefix}-city`} value="addis-ababa" disabled>
          <option value="addis-ababa">Addis Ababa</option>
        </Select>
      </Field>
      <Field label={t("onboarding.subCity")} htmlFor={`${idPrefix}-sub`} required={required}>
        <Select id={`${idPrefix}-sub`} value={subCityId} onChange={(e) => onChange({ subCityId: e.target.value, neighborhoodId: null })} required={required}>
          <option value="">{allowAny ? t("explore.anywhere") : "—"}</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </Field>
      <Field label={t("onboarding.neighborhood")} htmlFor={`${idPrefix}-nb`}>
        <Select id={`${idPrefix}-nb`} value={neighborhoodId ?? ""} onChange={(e) => onChange({ subCityId, neighborhoodId: e.target.value || null })} disabled={!subCityId}>
          <option value="">{t("onboarding.any")}</option>
          {nbs.map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
