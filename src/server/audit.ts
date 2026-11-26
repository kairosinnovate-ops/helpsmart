import "server-only";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "./firebase/admin";
import { C } from "./collections";

export interface AuditEntry {
  actorId: string | null;
  actorRole: string; // "customer" | "provider" | admin role | "system"
  action: string; // e.g. "provider.approve", "identity.verified", "settings.update"
  targetType: string;
  targetId: string;
  /** Never put national ID numbers, tokens, OTPs or free-text personal data here. */
  metadata?: Record<string, string | number | boolean | null>;
}

export async function audit(entry: AuditEntry, tx?: Transaction) {
  const ref = adminDb().collection(C.auditLogs).doc();
  const doc = { ...entry, metadata: entry.metadata ?? {}, at: FieldValue.serverTimestamp() };
  if (tx) tx.set(ref, doc);
  else await ref.set(doc);
}
