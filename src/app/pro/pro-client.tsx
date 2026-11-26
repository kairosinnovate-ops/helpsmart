"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";

export function AvailabilityToggle({ initial }: { initial: boolean }) {
  const { t } = useT();
  const [on, setOn] = useState(initial);
  const { run, busy, error } = useAction();
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-3 rounded-full border border-line bg-white px-4 py-2">
        <span className="text-sm font-medium">{t("pro.availableToggle")}</span>
        <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={async () => { const r = await run("/api/v1/pro/availability", { availableNow: !on }); if (r) setOn(!on); }} className={`relative h-6 w-11 rounded-full transition ${on ? "bg-success" : "bg-line"}`}>
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </label>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
