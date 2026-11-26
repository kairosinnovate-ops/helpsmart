"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Alert, Button, Textarea } from "@/components/ui";

export function RespondForm({ reviewId }: { reviewId: string }) {
  const { t } = useT();
  const { run, busy, error } = useAction();
  const [text, setText] = useState("");
  return (
    <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void run(`/api/v1/reviews/${reviewId}/respond`, { text }); }}>
      <label htmlFor={`resp-${reviewId}`} className="sr-only">{t("review.respond")}</label>
      <Textarea id={`resp-${reviewId}`} value={text} onChange={(e) => setText(e.target.value)} className="min-h-16" maxLength={800} />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" size="sm" variant="secondary" loading={busy} disabled={text.trim().length < 2}>{t("review.respond")}</Button>
    </form>
  );
}
