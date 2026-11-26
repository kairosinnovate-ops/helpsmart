"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Star } from "lucide-react";
import clsx from "clsx";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import type { BookingAction, BookingActor } from "@/domain/booking";
import { RATING_DIMENSIONS } from "@/domain/reviews";
import { Alert, Button, Card, Checkbox, Field, Input, SectionHeading, Textarea } from "@/components/ui";

const NEEDS_NOTE: BookingAction[] = ["cancel", "dispute", "decline", "reject_quote"];
const DANGER: BookingAction[] = ["cancel", "dispute", "decline", "reject_quote"];

export function BookingActions({ booking }: { booking: { id: string; actions: BookingAction[]; viewerRole: BookingActor } }) {
  const { t } = useT();
  const { run, busy, error } = useAction();
  const [pending, setPending] = useState<BookingAction | null>(null);
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState({ amount: "", note: "", estimatedDuration: "" });
  if (!booking.actions.length) return null;
  const primary = booking.actions.filter((a) => !DANGER.includes(a));
  const secondary = booking.actions.filter((a) => DANGER.includes(a));

  async function act(action: BookingAction) {
    const body: Record<string, unknown> = { action };
    if (note) body.note = note;
    if (action === "submit_quote") body.quote = { amountMinor: Math.round(Number(quote.amount) * 100), note: quote.note, estimatedDuration: quote.estimatedDuration };
    const r = await run(`/api/v1/bookings/${booking.id}/transition`, body);
    if (r) {
      setPending(null);
      setNote("");
    }
  }

  return (
    <Card className="p-6">
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {pending === "submit_quote" ? (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void act("submit_quote"); }}>
          <Field label={t("booking.quoteAmount")} htmlFor="q-amt" required><Input id="q-amt" type="number" min={1} inputMode="decimal" value={quote.amount} onChange={(e) => setQuote({ ...quote, amount: e.target.value })} required /></Field>
          <Field label={t("booking.quoteNote")} htmlFor="q-note"><Textarea id="q-note" value={quote.note} onChange={(e) => setQuote({ ...quote, note: e.target.value })} maxLength={500} className="min-h-20" /></Field>
          <Field label={t("booking.estimatedDuration")} htmlFor="q-dur"><Input id="q-dur" value={quote.estimatedDuration} onChange={(e) => setQuote({ ...quote, estimatedDuration: e.target.value })} maxLength={60} /></Field>
          <div className="flex gap-2"><Button type="submit" loading={busy}>{t("booking.submitQuote")}</Button><Button type="button" variant="ghost" onClick={() => setPending(null)}>{t("common.cancel")}</Button></div>
        </form>
      ) : pending && NEEDS_NOTE.includes(pending) ? (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void act(pending); }}>
          <Field label={t("booking.reason")} htmlFor="t-note"><Textarea id="t-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20" required={pending === "dispute"} /></Field>
          <div className="flex gap-2"><Button type="submit" variant="danger" loading={busy}>{t(`booking.actions.${pending}`)}</Button><Button type="button" variant="ghost" onClick={() => setPending(null)}>{t("common.cancel")}</Button></div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {primary.map((a) => (
            <Button key={a} loading={busy} onClick={() => (a === "submit_quote" ? setPending(a) : act(a))}>{t(`booking.actions.${a}`)}</Button>
          ))}
          {secondary.map((a) => (
            <Button key={a} variant="secondary" onClick={() => setPending(a)}>{t(`booking.actions.${a}`)}</Button>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PaymentPanel({ bookingId, role, alreadyConfirmed }: { bookingId: string; role: "customer" | "provider"; alreadyConfirmed: boolean }) {
  const { t } = useT();
  const { run, busy, error } = useAction();
  if (alreadyConfirmed) return <p className="mt-4 text-sm text-muted">{t("booking.paymentWaiting")}</p>;
  return (
    <div className="mt-4 space-y-2">
      {error && <Alert tone="danger">{error}</Alert>}
      <Button className="w-full" variant="accent" loading={busy} onClick={() => run(`/api/v1/bookings/${bookingId}/payment`)}>
        {role === "customer" ? t("booking.confirmPaidCustomer") : t("booking.confirmPaidProvider")}
      </Button>
    </div>
  );
}

export function OpenConversation({ otherUid, bookingId }: { otherUid: string; bookingId: string }) {
  const { t } = useT();
  const router = useRouter();
  const { run, busy, error } = useAction();
  return (
    <div>
      <Button variant="secondary" className="w-full" loading={busy} onClick={async () => { const r = await run<{ id: string }>("/api/v1/conversations", { otherUid, bookingId }, { refresh: false }); if (r) router.push(`/messages/${r.id}`); }}>
        <MessageCircle className="size-4" /> {t("booking.messageOther")}
      </Button>
      {error && <Alert tone="danger" className="mt-2">{error}</Alert>}
    </div>
  );
}

function StarInput({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <fieldset className="flex items-center justify-between gap-4">
      <legend className="sr-only">{label}</legend>
      <span className="text-sm text-ink" aria-hidden>{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}`} id={`${id}-${n}`} onClick={() => onChange(n)} className="p-0.5">
            <Star className={clsx("size-6", n <= value ? "fill-smart stroke-trust" : "stroke-line")} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const { t } = useT();
  const { run, busy, error } = useAction();
  const [ratings, setRatings] = useState<Record<string, number>>(Object.fromEntries(RATING_DIMENSIONS.map((d) => [d, 0])));
  const [comment, setComment] = useState("");
  const complete = RATING_DIMENSIONS.every((d) => ratings[d] > 0);
  return (
    <Card className="p-6">
      <SectionHeading title={t("review.title")} />
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(`/api/v1/bookings/${bookingId}/review`, { ratings, comment }); }}>
        {RATING_DIMENSIONS.map((d) => (
          <StarInput key={d} id={`r-${d}`} label={t(`review.${d}`)} value={ratings[d]} onChange={(v) => setRatings((r) => ({ ...r, [d]: v }))} />
        ))}
        <Field label={t("review.comment")} htmlFor="r-comment"><Textarea id="r-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" loading={busy} disabled={!complete}>{t("review.submit")}</Button>
      </form>
    </Card>
  );
}

export function FeedbackForm({ bookingId }: { bookingId: string }) {
  const { t } = useT();
  const { run, busy, error } = useAction();
  const [f, setF] = useState({ communication: 0, paymentReliability: 0, environment: 0, safetyConcern: false, comment: "" });
  return (
    <Card className="p-6">
      <SectionHeading title={t("booking.feedback")} subtitle="Visible to HelpSmart staff only." />
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(`/api/v1/bookings/${bookingId}/feedback`, f); }}>
        <StarInput id="f-comm" label={t("review.communication")} value={f.communication} onChange={(v) => setF({ ...f, communication: v })} />
        <StarInput id="f-pay" label="Payment reliability" value={f.paymentReliability} onChange={(v) => setF({ ...f, paymentReliability: v })} />
        <StarInput id="f-env" label="Service environment" value={f.environment} onChange={(v) => setF({ ...f, environment: v })} />
        <Checkbox id="f-safety" checked={f.safetyConcern} onChange={(e) => setF({ ...f, safetyConcern: e.target.checked })} label="I had a safety concern during this job" />
        <Field label={t("review.comment")} htmlFor="f-comment"><Textarea id="f-comment" value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} maxLength={1000} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" variant="secondary" loading={busy} disabled={!f.communication || !f.paymentReliability || !f.environment}>{t("common.submit")}</Button>
      </form>
    </Card>
  );
}
