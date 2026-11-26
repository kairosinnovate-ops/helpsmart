"use client";
import { useState } from "react";
import { useAction } from "@/lib/use-action";
import { Alert, Button, Checkbox, Field, Input } from "@/components/ui";

type S = { commissionRate: number; customerServiceFeeRate: number; customerServiceFeeMinMinor: number; careServicesEnabled: boolean; jobsModuleEnabled: boolean; familyModuleEnabled: boolean };

export function SettingsForm({ initial }: { initial: S }) {
  const [s, setS] = useState({ ...initial, commissionPct: String(initial.commissionRate * 100), feePct: String(initial.customerServiceFeeRate * 100), feeMin: String(initial.customerServiceFeeMinMinor / 100) });
  const { run, busy, error } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault();
      setSaved(false);
      const r = await run("/api/admin/settings", { commissionRate: Number(s.commissionPct) / 100, customerServiceFeeRate: Number(s.feePct) / 100, customerServiceFeeMinMinor: Math.round(Number(s.feeMin) * 100), careServicesEnabled: s.careServicesEnabled, jobsModuleEnabled: s.jobsModuleEnabled, familyModuleEnabled: s.familyModuleEnabled }, { method: "PATCH" });
      if (r) setSaved(true);
    }}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Provider commission (%)" htmlFor="s-comm"><Input id="s-comm" type="number" min={0} max={50} step={0.5} value={s.commissionPct} onChange={(e) => setS({ ...s, commissionPct: e.target.value })} /></Field>
        <Field label="Customer service fee (%)" htmlFor="s-fee"><Input id="s-fee" type="number" min={0} max={50} step={0.5} value={s.feePct} onChange={(e) => setS({ ...s, feePct: e.target.value })} /></Field>
        <Field label="Minimum customer fee (ETB)" htmlFor="s-min"><Input id="s-min" type="number" min={0} value={s.feeMin} onChange={(e) => setS({ ...s, feeMin: e.target.value })} /></Field>
      </div>
      <Checkbox id="s-care" checked={s.careServicesEnabled} onChange={(e) => setS({ ...s, careServicesEnabled: e.target.checked })} label="Care services enabled (only after safeguarding procedures are approved)" />
      <Checkbox id="s-jobs" checked={s.jobsModuleEnabled} onChange={(e) => setS({ ...s, jobsModuleEnabled: e.target.checked })} label="HelpSmart Jobs enabled (only after employment-agency licensing review)" />
      <Checkbox id="s-family" checked={s.familyModuleEnabled} onChange={(e) => setS({ ...s, familyModuleEnabled: e.target.checked })} label="HelpSmart Family enabled (Phase Two)" />
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Saved</Alert>}
      <Button type="submit" loading={busy}>Save settings</Button>
    </form>
  );
}
