"use client";
import { useState } from "react";
import { useAction } from "@/lib/use-action";
import { Button, Input } from "@/components/ui";

/** Generic admin action button. Optional note input for audit context. Server enforces permissions. */
export function AdminAction({ path, body, label, variant = "secondary", withNote, confirmText }: { path: string; body: Record<string, unknown>; label: string; variant?: "primary" | "secondary" | "danger" | "accent" | "ghost"; withNote?: boolean; confirmText?: string }) {
  const { run, busy, error } = useAction();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (withNote && open) {
    return (
      <form className="flex flex-wrap items-center gap-2" onSubmit={async (e) => { e.preventDefault(); const r = await run(path, { ...body, note, notes: note, reason: note }); if (r) setOpen(false); }}>
        <Input aria-label="Note" placeholder="Note (kept in audit log)" value={note} onChange={(e) => setNote(e.target.value)} className="h-9 w-56 text-sm" />
        <Button type="submit" size="sm" variant={variant} loading={busy}>{confirmText ?? label}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </form>
    );
  }
  return (
    <span className="inline-flex flex-col">
      <Button size="sm" variant={variant} loading={busy} onClick={() => (withNote ? setOpen(true) : run(path, body))}>{label}</Button>
      {error && <span className="mt-1 text-xs text-danger">{error}</span>}
    </span>
  );
}
