"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { calculateBreakdown, estimateAmount, formatEtb, type FeeSettings } from "@/domain/pricing";
import type { PriceModel } from "@/domain/types";
import { RegionPicker, type RegionOption } from "@/components/forms/region-picker";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";

interface Props {
  provider: { id: string; pricing: { model: PriceModel; rateMinor: number | null; callOutFeeMinor: number }; availableNow: boolean; acceptsRecurring: boolean };
  categories: { id: string; name: string }[];
  fees: FeeSettings;
  addresses: { id: string; label: string; subCityId: string; neighborhoodId: string | null; landmark: string; directions: string }[];
  regions: RegionOption[];
  defaultArea: { subCityId: string; neighborhoodId: string | null };
  wantQuote: boolean;
}

export function BookingForm({ provider, categories, fees, addresses, regions, defaultArea, wantQuote }: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const { run, busy, error, fieldErrors } = useAction();
  const fixedRate = ["hourly", "daily", "fixed"].includes(provider.pricing.model) && provider.pricing.rateMinor != null;
  const [f, setF] = useState({
    categoryId: categories[0]?.id ?? "",
    description: "",
    urgency: provider.availableNow ? "now" : "scheduled",
    scheduledFor: "",
    repeat: "once",
    occurrences: 4,
    quantity: provider.pricing.model === "daily" ? 1 : 2,
    requestQuote: wantQuote || !fixedRate,
    paymentMethod: "cash",
    addressId: addresses[0]?.id ?? "",
    area: defaultArea,
    landmark: "",
    directions: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const saved = addresses.find((a) => a.id === f.addressId);

  const breakdown = useMemo(() => {
    if (f.requestQuote || !fixedRate) return null;
    try {
      const qty = provider.pricing.model === "fixed" ? 1 : Number(f.quantity) || 1;
      return calculateBreakdown(estimateAmount(provider.pricing.rateMinor!, qty) + (provider.pricing.callOutFeeMinor ?? 0), fees);
    } catch {
      return null;
    }
  }, [f.requestQuote, f.quantity, fixedRate, provider.pricing, fees]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = saved
      ? { addressId: saved.id, subCityId: saved.subCityId, neighborhoodId: saved.neighborhoodId, landmark: saved.landmark, directions: saved.directions }
      : { subCityId: f.area.subCityId, neighborhoodId: f.area.neighborhoodId, landmark: f.landmark, directions: f.directions };
    const id = await run<{ id: string }>(
      "/api/v1/bookings",
      {
        providerId: provider.id,
        categoryId: f.categoryId,
        description: f.description,
        urgency: f.urgency,
        scheduledFor: f.urgency === "scheduled" && f.scheduledFor ? new Date(f.scheduledFor).toISOString() : null,
        recurrence: f.repeat !== "once" ? { frequency: f.repeat, interval: 1, occurrences: Number(f.occurrences) } : null,
        quantity: Number(f.quantity) || 1,
        requestQuote: f.requestQuote,
        paymentMethod: f.paymentMethod,
        address,
      },
      { refresh: false },
    );
    if (id) router.push(`/bookings/${id.id}?created=1`);
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t("booking.service")} htmlFor="b-cat" required>
        <Select id="b-cat" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label={t("booking.describe")} htmlFor="b-desc" hint={t("booking.describeHint")} error={fieldErrors.description} required>
        <Textarea id="b-desc" value={f.description} onChange={(e) => set("description", e.target.value)} minLength={10} maxLength={2000} required />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink">{t("booking.when")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["now", "scheduled"] as const).map((u) => (
            <label key={u} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${f.urgency === u ? "border-trust bg-trust-50" : "border-line"} ${u === "now" && !provider.availableNow ? "opacity-50" : ""}`}>
              <input type="radio" name="urgency" value={u} checked={f.urgency === u} disabled={u === "now" && !provider.availableNow} onChange={() => set("urgency", u)} className="accent-trust" />
              {t(`booking.${u}`)}
            </label>
          ))}
        </div>
        {f.urgency === "scheduled" && (
          <Field label={t("booking.dateTime")} htmlFor="b-when" error={fieldErrors.scheduledFor} required>
            <Input id="b-when" type="datetime-local" value={f.scheduledFor} onChange={(e) => set("scheduledFor", e.target.value)} required />
          </Field>
        )}
        {f.urgency === "scheduled" && provider.acceptsRecurring && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("booking.repeat")} htmlFor="b-rep">
              <Select id="b-rep" value={f.repeat} onChange={(e) => set("repeat", e.target.value)}>
                {["once", "daily", "weekly", "monthly"].map((r) => <option key={r} value={r}>{t(`booking.${r}`)}</option>)}
              </Select>
            </Field>
            {f.repeat !== "once" && (
              <Field label={t("booking.occurrences")} htmlFor="b-occ">
                <Input id="b-occ" type="number" min={2} max={52} value={f.occurrences} onChange={(e) => set("occurrences", Number(e.target.value))} />
              </Field>
            )}
          </div>
        )}
      </fieldset>

      {fixedRate && (
        <Checkbox id="b-quote" checked={f.requestQuote} onChange={(e) => set("requestQuote", e.target.checked)} label={t("booking.wantQuote")} />
      )}
      {fixedRate && !f.requestQuote && provider.pricing.model !== "fixed" && (
        <Field label={provider.pricing.model === "daily" ? t("booking.days") : t("booking.hours")} htmlFor="b-qty">
          <Input id="b-qty" type="number" min={0.5} max={200} step={0.5} value={f.quantity} onChange={(e) => set("quantity", Number(e.target.value))} />
        </Field>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-ink">{t("booking.address")}</legend>
        {addresses.length > 0 && (
          <Select aria-label={t("booking.savedAddress")} value={f.addressId} onChange={(e) => set("addressId", e.target.value)}>
            {addresses.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            <option value="">{t("booking.newAddress")}</option>
          </Select>
        )}
        {!saved && (
          <>
            <RegionPicker regions={regions} subCityId={f.area.subCityId} neighborhoodId={f.area.neighborhoodId} onChange={(v) => set("area", v)} idPrefix="b" />
            <Field label={t("booking.landmark")} htmlFor="b-lm" hint={t("booking.landmarkHint")}>
              <Input id="b-lm" value={f.landmark} onChange={(e) => set("landmark", e.target.value)} maxLength={120} />
            </Field>
            <Field label={t("booking.directions")} htmlFor="b-dir" hint={t("booking.directionsHint")}>
              <Textarea id="b-dir" value={f.directions} onChange={(e) => set("directions", e.target.value)} maxLength={400} className="min-h-20" />
            </Field>
          </>
        )}
      </fieldset>

      <Field label={t("booking.payment")} htmlFor="b-pay" hint={t("booking.paymentNote")}>
        <Select id="b-pay" value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
          <option value="cash">{t("booking.cash")}</option>
          <option value="bank_transfer">{t("booking.bankTransfer")}</option>
        </Select>
      </Field>

      <div className="rounded-2xl bg-canvas p-4">
        <p className="mb-2 text-sm font-semibold text-ink">{t("booking.summary")}</p>
        {breakdown ? (
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted">{t("booking.serviceAmount")}</dt><dd>{formatEtb(breakdown.serviceAmountMinor, locale)}</dd></div>
            {breakdown.customerServiceFeeMinor > 0 && <div className="flex justify-between"><dt className="text-muted">{t("booking.serviceFee")}</dt><dd>{formatEtb(breakdown.customerServiceFeeMinor, locale)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>{t("booking.total")}</dt><dd>{formatEtb(breakdown.customerTotalMinor, locale)}</dd></div>
          </dl>
        ) : (
          <p className="text-sm text-muted">{t("booking.quotePending")}</p>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!f.description || (!saved && !f.area.subCityId)}>{t("booking.submit")}</Button>
    </form>
  );
}
