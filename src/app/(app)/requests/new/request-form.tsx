"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { RegionPicker, type RegionOption } from "@/components/forms/region-picker";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function RequestForm({ categories, regions, initialCategory, defaultArea }: { categories: { id: string; name: string }[]; regions: RegionOption[]; initialCategory: string; defaultArea: { subCityId: string; neighborhoodId: string | null } }) {
  const { t } = useT();
  const router = useRouter();
  const { run, busy, error, fieldErrors } = useAction();
  const [f, setF] = useState({ categoryId: initialCategory, title: "", description: "", area: defaultArea, preferredDate: "", budget: "" });
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run<{ id: string }>("/api/v1/requests", {
          categoryId: f.categoryId,
          title: f.title,
          description: f.description,
          subCityId: f.area.subCityId,
          neighborhoodId: f.area.neighborhoodId,
          preferredDate: f.preferredDate || null,
          budgetMinor: f.budget ? Math.round(Number(f.budget) * 100) : null,
        }, { refresh: false });
        if (r) router.push(`/requests/${r.id}`);
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t("booking.service")} htmlFor="r-cat" required>
        <Select id="r-cat" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      </Field>
      <Field label={t("requests.title")} htmlFor="r-title" hint={t("requests.titleHint")} error={fieldErrors.title} required>
        <Input id="r-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} minLength={5} maxLength={100} required />
      </Field>
      <Field label={t("booking.describe")} htmlFor="r-desc" hint={t("booking.describeHint")} error={fieldErrors.description} required>
        <Textarea id="r-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} minLength={20} maxLength={2000} required />
      </Field>
      <RegionPicker regions={regions} subCityId={f.area.subCityId} neighborhoodId={f.area.neighborhoodId} onChange={(v) => setF({ ...f, area: v })} idPrefix="r" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("requests.preferredDate")} htmlFor="r-date"><Input id="r-date" type="date" value={f.preferredDate} onChange={(e) => setF({ ...f, preferredDate: e.target.value })} /></Field>
        <Field label={t("requests.budget")} htmlFor="r-budget"><Input id="r-budget" type="number" min={0} inputMode="numeric" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Field>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!f.area.subCityId}>{t("requests.post")}</Button>
    </form>
  );
}
