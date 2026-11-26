"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function AcceptQuote({ quoteId }: { quoteId: string }) {
  const { t } = useT();
  const router = useRouter();
  const { run, busy, error } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ landmark: "", directions: "", scheduledFor: "", paymentMethod: "cash" });
  if (!open) return <Button onClick={() => setOpen(true)}>{t("requests.accept")}</Button>;
  return (
    <form className="space-y-3 rounded-xl bg-canvas p-4" onSubmit={async (e) => {
      e.preventDefault();
      const r = await run<{ bookingId: string }>(`/api/v1/quotes/${quoteId}/accept`, { ...f, scheduledFor: f.scheduledFor ? new Date(f.scheduledFor).toISOString() : null }, { refresh: false });
      if (r) router.push(`/bookings/${r.bookingId}?created=1`);
    }}>
      <Field label={t("booking.landmark")} htmlFor={`l-${quoteId}`} hint={t("booking.landmarkHint")}><Input id={`l-${quoteId}`} value={f.landmark} onChange={(e) => setF({ ...f, landmark: e.target.value })} /></Field>
      <Field label={t("booking.directions")} htmlFor={`d-${quoteId}`}><Input id={`d-${quoteId}`} value={f.directions} onChange={(e) => setF({ ...f, directions: e.target.value })} /></Field>
      <Field label={t("booking.dateTime")} htmlFor={`s-${quoteId}`}><Input id={`s-${quoteId}`} type="datetime-local" value={f.scheduledFor} onChange={(e) => setF({ ...f, scheduledFor: e.target.value })} /></Field>
      <Field label={t("booking.payment")} htmlFor={`p-${quoteId}`}><Select id={`p-${quoteId}`} value={f.paymentMethod} onChange={(e) => setF({ ...f, paymentMethod: e.target.value })}><option value="cash">{t("booking.cash")}</option><option value="bank_transfer">{t("booking.bankTransfer")}</option></Select></Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2"><Button type="submit" loading={busy}>{t("requests.accept")}</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button></div>
    </form>
  );
}

export function CloseRequest({ id }: { id: string }) {
  const { t } = useT();
  const { run, busy } = useAction();
  return <Button variant="ghost" size="sm" loading={busy} onClick={() => run(`/api/v1/requests/${id}/close`)}>{t("requests.close")}</Button>;
}
