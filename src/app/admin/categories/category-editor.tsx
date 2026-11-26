"use client";
import { useState } from "react";
import { useAction } from "@/lib/use-action";
import { Alert, Button, Card, Checkbox, Field, Input, Pill, Select } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";
import type { Category } from "@/server/services/reference";

const GROUPS = ["home", "care", "pro", "automotive", "education", "business", "jobs", "family"];
const blank: Category = { id: "", group: "home", names: { en: "" }, description: "", icon: "Circle", active: false, requiresSafeguarding: false, regulated: false, sortOrder: 200 };

export function CategoryEditor({ categories, icons }: { categories: Category[]; icons: string[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const { run, busy, error } = useAction();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => setEditing({ ...c })} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left hover:border-trust/30">
              <span className="grid size-10 place-items-center rounded-xl bg-trust-50 text-trust"><CategoryIcon name={c.icon} className="size-5" /></span>
              <span className="flex-1"><span className="block font-semibold">{c.names.en}</span><span className="text-xs text-muted">{c.id} · {c.group} · order {c.sortOrder}</span></span>
              {c.requiresSafeguarding && <Pill tone="amber">Safeguarding</Pill>}
              {c.regulated && <Pill tone="amber">Regulated</Pill>}
              <Pill tone={c.active ? "green" : "neutral"}>{c.active ? "Active" : "Inactive"}</Pill>
            </button>
          </li>
        ))}
        <li><Button variant="secondary" onClick={() => setEditing({ ...blank })}>Add category</Button></li>
      </ul>
      {editing && (
        <Card className="h-fit p-5">
          <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const r = await run("/api/admin/categories", editing, { method: "PUT" }); if (r) setEditing(null); }}>
            <Field label="ID (slug)" htmlFor="c-id"><Input id="c-id" value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} pattern="[a-z0-9-]{2,40}" required /></Field>
            <Field label="Group" htmlFor="c-group"><Select id="c-group" value={editing.group} onChange={(e) => setEditing({ ...editing, group: e.target.value })}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
            {["en", "am", "om", "ti", "so"].map((l) => (
              <Field key={l} label={`Name (${l})`} htmlFor={`c-n-${l}`}><Input id={`c-n-${l}`} value={editing.names[l] ?? ""} onChange={(e) => setEditing({ ...editing, names: { ...editing.names, [l]: e.target.value } })} required={l === "en"} /></Field>
            ))}
            <Field label="Description" htmlFor="c-desc"><Input id="c-desc" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Icon" htmlFor="c-icon"><Select id="c-icon" value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })}>{icons.map((i) => <option key={i}>{i}</option>)}</Select></Field>
            <Field label="Sort order" htmlFor="c-sort"><Input id="c-sort" type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} /></Field>
            <Checkbox id="c-active" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} label="Active" />
            <Checkbox id="c-safe" checked={editing.requiresSafeguarding} onChange={(e) => setEditing({ ...editing, requiresSafeguarding: e.target.checked })} label="Requires safeguarding (care)" />
            <Checkbox id="c-reg" checked={editing.regulated} onChange={(e) => setEditing({ ...editing, regulated: e.target.checked })} label="Regulated (employment placement / licensing)" />
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex gap-2"><Button type="submit" loading={busy}>Save</Button><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </form>
        </Card>
      )}
    </div>
  );
}
