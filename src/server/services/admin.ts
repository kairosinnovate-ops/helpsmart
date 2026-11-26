import "server-only";
import { AggregateField } from "firebase-admin/firestore";
import { adminDb } from "../firebase/admin";
import { C } from "../collections";
import { env } from "../env";
import { identityProvider } from "../identity/providers";

/**
 * Executive metrics computed from live database records with aggregation queries.
 * Nothing here is estimated or seeded. Demo records (isDemo) are excluded outside development.
 */
export async function executiveMetrics() {
  const db = adminDb();
  const users = db.collection(C.users);
  const bookings = db.collection(C.bookings);
  const count = async (q: FirebaseFirestore.Query) => (await q.count().get()).data().count;

  const [
    customers,
    providers,
    verifiedCustomers,
    verifiedProviders,
    approvedProviders,
    pendingApplications,
    activeProfessionals,
    totalBookings,
    completedBookings,
    cancelledBookings,
    openDisputes,
  ] = await Promise.all([
    count(users.where("primaryRole", "==", "customer")),
    count(users.where("roles", "array-contains", "provider")),
    count(users.where("primaryRole", "==", "customer").where("identityStatus", "==", "fayda_verified")),
    count(users.where("roles", "array-contains", "provider").where("identityStatus", "==", "fayda_verified")),
    count(db.collection(C.providerApplications).where("status", "==", "approved")),
    count(db.collection(C.providerApplications).where("status", "in", ["submitted", "under_review"])),
    count(db.collection(C.publicProfiles).where("availableNow", "==", true)),
    count(bookings),
    count(bookings.where("status", "==", "completed")),
    count(bookings.where("status", "==", "cancelled")),
    count(db.collection(C.disputes).where("status", "==", "open")),
  ]);

  const tx = db.collection(C.transactions);
  const sum = async (type: string) => {
    const r = await tx.where("type", "==", type).aggregate({ total: AggregateField.sum("amountMinor") }).get();
    return r.data().total ?? 0;
  };
  const [gmv, commission, fees] = await Promise.all([sum("service_value"), sum("commission"), sum("customer_fee")]);

  const reviewsAgg = await db
    .collection(C.reviews)
    .where("status", "==", "published")
    .aggregate({ n: AggregateField.count(), avg: AggregateField.average("ratings.overall") })
    .get();

  return {
    customers,
    providers,
    verifiedCustomers,
    verifiedProviders,
    approvedProviders,
    pendingApplications,
    activeProfessionals,
    totalBookings,
    completedBookings,
    cancellationRate: totalBookings ? cancelledBookings / totalBookings : 0,
    averageRating: reviewsAgg.data().avg ?? null,
    reviewCount: reviewsAgg.data().n,
    gmvMinor: gmv,
    platformRevenueMinor: commission + fees,
    providerEarningsMinor: gmv - commission,
    openDisputes,
    environment: env().APP_ENV,
  };
}

export async function categoryPerformance() {
  const db = adminDb();
  const cats = await db.collection(C.serviceCategories).get();
  return Promise.all(
    cats.docs.map(async (c) => ({
      id: c.id,
      name: (c.get("names")?.en as string) ?? c.id,
      bookings: (await db.collection(C.bookings).where("categoryId", "==", c.id).count().get()).data().count,
      providers: (await db.collection(C.publicProfiles).where("categoryIds", "array-contains", c.id).count().get()).data().count,
    })),
  );
}

export async function geographicPerformance() {
  const db = adminDb();
  const subs = await db.collection(C.geographicRegions).where("type", "==", "sub_city").get();
  return Promise.all(
    subs.docs.map(async (s) => ({
      id: s.id,
      name: s.get("names")?.en as string,
      bookings: (await db.collection(C.bookings).where("area.subCityId", "==", s.id).count().get()).data().count,
    })),
  );
}

export async function verificationOverview() {
  const db = adminDb();
  const statuses = ["unverified", "in_progress", "fayda_verified", "failed", "additional_review", "expired_revoked", "suspended"];
  const counts = await Promise.all(
    statuses.map(async (s) => [s, (await db.collection(C.users).where("identityStatus", "==", s).count().get()).data().count] as const),
  );
  const recent = await db.collection(C.identityVerificationRecords).orderBy("at", "desc").limit(50).get();
  const avail = identityProvider();
  let reachable: boolean | null = null;
  if (avail.ok && avail.provider.source === "fayda_oidc" && env().FAYDA_ISSUER) {
    try {
      const r = await fetch(`${env().FAYDA_ISSUER!.replace(/\/$/, "")}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5000) });
      reachable = r.ok;
    } catch {
      reachable = false;
    }
  }
  return {
    counts: Object.fromEntries(counts),
    integration: {
      mode: env().IDENTITY_MODE,
      configured: avail.ok,
      missing: avail.ok ? [] : (avail.missing ?? []),
      reason: avail.ok ? null : avail.reason,
      reachable,
      environment: env().APP_ENV,
    },
    // Only status metadata — no claims, no subject identifiers.
    recent: recent.docs.map((d) => ({
      id: d.id,
      uid: d.get("uid") as string,
      provider: d.get("provider") as string,
      outcome: d.get("outcome") as string,
      reason: (d.get("reason") as string) ?? null,
      at: d.get("at")?.toMillis?.() ?? 0,
    })),
  };
}

export async function listApplications(status?: string) {
  let q: FirebaseFirestore.Query = adminDb().collection(C.providerApplications);
  if (status) q = q.where("status", "==", status);
  const s = await q.orderBy("updatedAt", "desc").limit(100).get();
  const users = await Promise.all(s.docs.map((d) => adminDb().collection(C.users).doc(d.id).get()));
  return s.docs.map((d, i) => ({
    uid: d.id,
    status: d.get("status") as string,
    submittedAt: d.get("submittedAt")?.toMillis?.() ?? null,
    displayName: users[i].get("displayName") as string,
    identityStatus: users[i].get("identityStatus") as string,
    identitySource: (users[i].get("identitySource") as string) ?? null,
  }));
}

export async function getApplicationDetail(uid: string) {
  const db = adminDb();
  const [u, p, a, creds, refs] = await Promise.all([
    db.collection(C.users).doc(uid).get(),
    db.collection(C.providerProfiles).doc(uid).get(),
    db.collection(C.providerApplications).doc(uid).get(),
    db.collection(C.professionalCredentials).where("providerId", "==", uid).get(),
    db.collection(C.providerReferences).where("providerId", "==", uid).get(),
  ]);
  return {
    user: { uid, displayName: u.get("displayName"), email: u.get("email"), identityStatus: u.get("identityStatus"), identitySource: u.get("identitySource") ?? null, accountStatus: u.get("accountStatus") },
    profile: p.data() ?? null,
    application: { status: a.get("status"), history: a.get("history") ?? [], reviewNotes: a.get("reviewNotes") ?? null },
    credentials: creds.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: undefined })),
    references: refs.docs.map((d) => ({ id: d.id, name: d.get("name"), relationship: d.get("relationship"), phoneE164: d.get("phoneE164"), status: d.get("status") })),
  };
}

export async function searchUsers(q: string) {
  const db = adminDb();
  const trimmed = q.trim();
  let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  if (trimmed.includes("@")) docs = (await db.collection(C.users).where("email", "==", trimmed.toLowerCase()).limit(20).get()).docs;
  else if (trimmed.startsWith("+251")) docs = (await db.collection(C.users).where("phoneE164", "==", trimmed).limit(20).get()).docs;
  else if (trimmed) {
    const byId = await db.collection(C.users).doc(trimmed).get();
    docs = byId.exists ? [byId as FirebaseFirestore.QueryDocumentSnapshot] : [];
  } else docs = (await db.collection(C.users).orderBy("createdAt", "desc").limit(50).get()).docs;
  return docs.map((d) => ({
    uid: d.id,
    displayName: d.get("displayName") as string,
    email: d.get("email") as string | null,
    roles: (d.get("roles") as string[]) ?? [],
    accountStatus: d.get("accountStatus") as string,
    identityStatus: d.get("identityStatus") as string,
    createdAt: d.get("createdAt")?.toMillis?.() ?? 0,
  }));
}

export async function listCollection(name: "supportTickets" | "incidentReports" | "reviewReports" | "disputes" | "auditLogs", limit = 100) {
  const order = name === "auditLogs" ? "at" : "createdAt";
  const s = await adminDb().collection(C[name]).orderBy(order, "desc").limit(limit).get();
  return s.docs.map((d) => {
    const data = d.data();
    const out: Record<string, unknown> = { id: d.id };
    for (const [k, v] of Object.entries(data)) out[k] = v && typeof v === "object" && "toMillis" in v ? (v as { toMillis(): number }).toMillis() : v;
    return out;
  });
}

export async function listAllBookings(limit = 100) {
  const s = await adminDb().collection(C.bookings).orderBy("createdAt", "desc").limit(limit).get();
  return s.docs.map((d) => ({
    id: d.id,
    reference: d.get("reference") as string,
    status: d.get("status") as string,
    paymentStatus: d.get("paymentStatus") as string,
    categoryId: d.get("categoryId") as string,
    customerName: d.get("customerName") as string,
    providerName: d.get("providerName") as string,
    totalMinor: (d.get("breakdown")?.customerTotalMinor as number) ?? null,
    createdAt: d.get("createdAt")?.toMillis?.() ?? 0,
  }));
}

export async function listPayments(limit = 100) {
  const s = await adminDb().collection(C.payments).orderBy("createdAt", "desc").limit(limit).get();
  return s.docs.map((d) => ({
    id: d.id,
    method: d.get("method") as string,
    status: d.get("status") as string,
    amountMinor: d.get("amountMinor") as number,
    commissionMinor: (d.get("breakdown")?.commissionMinor as number) ?? 0,
    createdAt: d.get("createdAt")?.toMillis?.() ?? 0,
  }));
}
