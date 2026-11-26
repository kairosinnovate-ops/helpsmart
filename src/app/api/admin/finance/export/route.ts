import { query } from "@/server/http";
import { requireAdmin } from "@/server/auth/guards";
import { adminDb } from "@/server/firebase/admin";
import { C } from "@/server/collections";
import { audit } from "@/server/audit";

/** CSV export of ledger transactions. Contains IDs and amounts only — no personal data. */
export const GET = query(async () => {
  const a = await requireAdmin("finance.export");
  const s = await adminDb().collection(C.transactions).orderBy("at", "desc").limit(5000).get();
  const rows = [["id", "type", "bookingId", "providerId", "method", "amountETB", "settlement", "at"]];
  for (const d of s.docs) {
    rows.push([d.id, d.get("type"), d.get("bookingId"), d.get("providerId"), d.get("method"), ((d.get("amountMinor") as number) / 100).toFixed(2), d.get("settlement") ?? "", d.get("at")?.toDate?.().toISOString() ?? ""]);
  }
  await audit({ actorId: a.uid, actorRole: a.adminRole!, action: "finance.export", targetType: "transactions", targetId: "all", metadata: { rows: rows.length - 1 } });
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=helpsmart-transactions.csv", "cache-control": "no-store" } });
});
