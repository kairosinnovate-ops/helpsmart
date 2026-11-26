import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "../firebase/admin";
import { C } from "../collections";
import { audit } from "../audit";
import { DEFAULT_PLATFORM_SETTINGS } from "@/data/reference";
import { badRequest, notFound } from "../errors";

export interface Category {
  id: string;
  group: string;
  names: Record<string, string>;
  description: string;
  icon: string;
  active: boolean;
  requiresSafeguarding: boolean;
  regulated: boolean;
  sortOrder: number;
}

export interface Region {
  id: string;
  type: "city" | "sub_city" | "neighborhood";
  parentId: string | null;
  cityId: string;
  names: Record<string, string>;
  centroid: { lat: number; lng: number };
  active: boolean;
}

export type PlatformSettings = typeof DEFAULT_PLATFORM_SETTINGS;

const toCategory = (id: string, d: FirebaseFirestore.DocumentData): Category => ({
  id,
  group: d.group,
  names: d.names ?? {},
  description: d.description ?? "",
  icon: d.icon ?? "Circle",
  active: !!d.active,
  requiresSafeguarding: !!d.requiresSafeguarding,
  regulated: !!d.regulated,
  sortOrder: d.sortOrder ?? 0,
});

export async function listCategories(opts: { includeInactive?: boolean } = {}): Promise<Category[]> {
  const snap = await adminDb().collection(C.serviceCategories).get();
  const settings = await getSettings();
  return snap.docs
    .map((d) => toCategory(d.id, d.data()))
    .map((c) => ({
      ...c,
      // Safety-gated and regulated categories stay inactive until the platform flag is on.
      active:
        c.active &&
        (!c.requiresSafeguarding || settings.careServicesEnabled) &&
        (!c.regulated || settings.jobsModuleEnabled),
    }))
    .filter((c) => opts.includeInactive || c.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCategory(id: string): Promise<Category | null> {
  const all = await listCategories({ includeInactive: true });
  return all.find((c) => c.id === id) ?? null;
}

export const CategoryInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  group: z.enum(["home", "care", "pro", "automotive", "education", "business", "jobs", "family"]),
  names: z.object({ en: z.string().min(2).max(60) }).catchall(z.string().max(60)),
  description: z.string().max(240).default(""),
  icon: z.string().max(40).default("Circle"),
  active: z.boolean(),
  requiresSafeguarding: z.boolean().default(false),
  regulated: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(100),
});

export async function upsertCategory(admin: { uid: string; role: string }, input: z.infer<typeof CategoryInput>) {
  const data = CategoryInput.parse(input);
  await adminDb()
    .collection(C.serviceCategories)
    .doc(data.id)
    .set({ ...data, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.uid }, { merge: true });
  await audit({
    actorId: admin.uid,
    actorRole: admin.role,
    action: "category.upsert",
    targetType: "serviceCategory",
    targetId: data.id,
    metadata: { active: data.active },
  });
}

export async function listRegions(): Promise<Region[]> {
  const snap = await adminDb().collection(C.geographicRegions).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Region, "id">) }));
}

export async function getRegion(id: string): Promise<Region | null> {
  const s = await adminDb().collection(C.geographicRegions).doc(id).get();
  return s.exists ? ({ id: s.id, ...(s.data() as Omit<Region, "id">) } as Region) : null;
}

export async function resolveArea(subCityId: string, neighborhoodId?: string | null) {
  const sub = await getRegion(subCityId);
  if (!sub || sub.type !== "sub_city" || !sub.active) throw badRequest("Unknown sub-city", "invalid_region");
  let nbh: Region | null = null;
  if (neighborhoodId) {
    nbh = await getRegion(neighborhoodId);
    if (!nbh || nbh.parentId !== sub.id) throw badRequest("Neighbourhood does not belong to sub-city", "invalid_region");
  }
  return { cityId: sub.cityId, subCity: sub, neighborhood: nbh, center: (nbh ?? sub).centroid };
}

export async function getSettings(): Promise<PlatformSettings> {
  const s = await adminDb().collection(C.platformSettings).doc("marketplace").get();
  return { ...DEFAULT_PLATFORM_SETTINGS, ...(s.exists ? s.data() : {}) } as PlatformSettings;
}

export const SettingsInput = z.object({
  commissionRate: z.number().min(0).max(0.5),
  customerServiceFeeRate: z.number().min(0).max(0.5),
  customerServiceFeeMinMinor: z.number().int().min(0).max(1_000_000),
  careServicesEnabled: z.boolean(),
  jobsModuleEnabled: z.boolean(),
  familyModuleEnabled: z.boolean(),
});

export async function updateSettings(admin: { uid: string; role: string }, input: unknown) {
  const data = SettingsInput.partial().parse(input);
  const ref = adminDb().collection(C.platformSettings).doc("marketplace");
  const before = await getSettings();
  await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.uid }, { merge: true });
  const meta: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(data)) {
    meta[`${k}.from`] = (before as Record<string, unknown>)[k] as number | boolean;
    meta[`${k}.to`] = v as number | boolean;
  }
  await audit({ actorId: admin.uid, actorRole: admin.role, action: "settings.update", targetType: "platformSettings", targetId: "marketplace", metadata: meta });
}

export async function requireCategory(id: string) {
  const c = await getCategory(id);
  if (!c) throw notFound("Unknown service category");
  if (!c.active) throw badRequest("This service is not available yet", "category_inactive");
  return c;
}
