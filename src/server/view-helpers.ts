import "server-only";
import { listRegions } from "./services/reference";
import type { RegionOption } from "@/components/forms/region-picker";

export async function regionOptions(locale: string): Promise<RegionOption[]> {
  const rs = await listRegions().catch(() => []);
  return rs
    .filter((r) => r.active && r.cityId === "addis-ababa")
    .map((r) => ({ id: r.id, type: r.type, parentId: r.parentId, name: r.names[locale] ?? r.names.en }));
}
