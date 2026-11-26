"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

export function QuoteForm({ requestId }: { requestId: string }) {
  const { t } = useT();
  const { run, busy, error } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ amount: "", note: "", estimatedDuration: "", availableFrom: "" });
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}>{t("requests.sendQuote")}</Button>;
  return (
    <form className="space-y-3 rounded-xl bg-canvas p-4" onSubmit={(e) => { e.preventDefault(); void run(`/api/v1/requests/${requestId}/quotes`, { amountMinor: Math.round(Number(f.amount) * 100), note: f.note, estimatedDuration: f.estimatedDuration, availableFrom: f.availableFrom || null }); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("booking.quoteAmount")} htmlFor={`qa-${requestId}`} required><Input id={`qa-${requestId}`} type="number" min={1} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
        <Field label={t("booking.estimatedDuration")} htmlFor={`qd-${requestId}`}><Input id={`qd-${requestId}`} value={f.estimatedDuration} onChange={(e) => setF({ ...f, estimatedDuration: e.target.value })} /></Field>
        <Field label={t("requests.availableFrom")} htmlFor={`qf-${requestId}`}><Input id={`qf-${requestId}`} type="date" value={f.availableFrom} onChange={(e) => setF({ ...f, availableFrom: e.target.value })} /></Field>
      </div>
      <Field label={t("booking.quoteNote")} htmlFor={`qn-${requestId}`} required><Textarea id={`qn-${requestId}`} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} minLength={5} required className="min-h-20" /></Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2"><Button type="submit" size="sm" loading={busy}>{t("requests.sendQuote")}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button></div>
    </form>
  );
}
