/**
 * Reference data (not user data): service categories and the Addis Ababa geography.
 * Loaded into Firestore by `npm run seed`. After seeding, administrators manage categories
 * and regions from the admin dashboard — the app reads them from Firestore, not from this file.
 *
 * Centroids are APPROXIMATE (≈1 km) and exist only for "about X km away" estimates.
 * Verify names and boundaries against official Addis Ababa City Administration data before launch.
 * Amharic names are drafts and need native-speaker review.
 */

export interface CategorySeed {
  id: string;
  group: "home" | "care" | "pro" | "automotive" | "education" | "business" | "jobs" | "family";
  names: Record<string, string>;
  description: string;
  icon: string; // lucide icon name
  active: boolean;
  requiresSafeguarding?: boolean;
  regulated?: boolean;
  sortOrder: number;
}

export const CATEGORY_SEED: CategorySeed[] = [
  { id: "house-cleaning", group: "home", names: { en: "House cleaning", am: "የቤት ጽዳት" }, description: "Regular and one-off cleaning for homes and apartments.", icon: "Sparkles", active: true, sortOrder: 10 },
  { id: "domestic-help", group: "home", names: { en: "Domestic help", am: "የቤት ሰራተኛ" }, description: "Day help for cooking, laundry, ironing and household tasks.", icon: "Home", active: true, sortOrder: 20 },
  { id: "plumbing", group: "pro", names: { en: "Plumbing", am: "የቧንቧ ስራ" }, description: "Leaks, blocked drains, water tanks, taps and installations.", icon: "Wrench", active: true, sortOrder: 30 },
  { id: "electrical", group: "pro", names: { en: "Electrical", am: "የኤሌክትሪክ ስራ" }, description: "Wiring, sockets, lighting, breakers and fault finding.", icon: "Zap", active: true, sortOrder: 40 },
  { id: "handyman", group: "pro", names: { en: "Handyman", am: "ጠቅላላ ጥገና" }, description: "Small repairs, mounting, furniture assembly and odd jobs.", icon: "Hammer", active: true, sortOrder: 50 },
  { id: "elderly-assistance", group: "care", names: { en: "Elderly assistance", am: "የአረጋውያን እንክብካቤ" }, description: "Non-medical companionship and daily living support.", icon: "HeartHandshake", active: false, requiresSafeguarding: true, sortOrder: 60 },
  { id: "childcare", group: "care", names: { en: "Childcare", am: "የህጻናት እንክብካቤ" }, description: "Babysitting and nannies.", icon: "Baby", active: false, requiresSafeguarding: true, sortOrder: 70 },
  { id: "painting", group: "pro", names: { en: "Painting", am: "የቀለም ቅብ" }, description: "Interior and exterior painting.", icon: "PaintRoller", active: false, sortOrder: 80 },
  { id: "carpentry", group: "pro", names: { en: "Carpentry", am: "የአናጢነት ስራ" }, description: "Doors, cabinets, furniture repair.", icon: "Ruler", active: false, sortOrder: 90 },
  { id: "appliance-repair", group: "pro", names: { en: "Appliance repair", am: "የቤት መሳሪያዎች ጥገና" }, description: "Fridges, washing machines, stoves.", icon: "Refrigerator", active: false, sortOrder: 100 },
  { id: "tutoring", group: "education", names: { en: "Private tutoring", am: "የግል አስጠኚ" }, description: "Academic support and exam preparation.", icon: "GraduationCap", active: false, sortOrder: 110 },
  { id: "office-cleaning", group: "business", names: { en: "Office cleaning", am: "የቢሮ ጽዳት" }, description: "Commercial cleaning for offices.", icon: "Building2", active: false, sortOrder: 120 },
  { id: "full-time-domestic", group: "jobs", names: { en: "Full-time domestic worker", am: "ቋሚ የቤት ሰራተኛ" }, description: "Long-term employment placement. Requires employment-agency review before activation.", icon: "BriefcaseBusiness", active: false, regulated: true, sortOrder: 130 },
];

export interface RegionSeed {
  id: string;
  type: "city" | "sub_city" | "neighborhood";
  parentId: string | null;
  cityId: string;
  names: Record<string, string>;
  centroid: { lat: number; lng: number };
  active: boolean;
}

const city = "addis-ababa";
const sc = (id: string, en: string, am: string, lat: number, lng: number): RegionSeed => ({
  id, type: "sub_city", parentId: city, cityId: city, names: { en, am }, centroid: { lat, lng }, active: true,
});
const nb = (id: string, parent: string, en: string, lat: number, lng: number): RegionSeed => ({
  id, type: "neighborhood", parentId: parent, cityId: city, names: { en }, centroid: { lat, lng }, active: true,
});

export const REGION_SEED: RegionSeed[] = [
  { id: city, type: "city", parentId: null, cityId: city, names: { en: "Addis Ababa", am: "አዲስ አበባ" }, centroid: { lat: 9.01, lng: 38.76 }, active: true },
  // Future cities — present but inactive until operations launch there.
  ...([
    ["adama", "Adama", "አዳማ", 8.54, 39.27],
    ["hawassa", "Hawassa", "ሀዋሳ", 7.06, 38.48],
    ["bahir-dar", "Bahir Dar", "ባሕር ዳር", 11.59, 37.39],
    ["dire-dawa", "Dire Dawa", "ድሬ ዳዋ", 9.6, 41.85],
    ["jimma", "Jimma", "ጅማ", 7.67, 36.83],
    ["mekelle", "Mekelle", "መቀሌ", 13.5, 39.47],
  ] as const).map(([id, en, am, lat, lng]) => ({
    id, type: "city" as const, parentId: null, cityId: id, names: { en, am }, centroid: { lat, lng }, active: false,
  })),
  sc("arada", "Arada", "አራዳ", 9.035, 38.752),
  sc("addis-ketema", "Addis Ketema", "አዲስ ከተማ", 9.033, 38.731),
  sc("lideta", "Lideta", "ልደታ", 9.012, 38.737),
  sc("kirkos", "Kirkos", "ቂርቆስ", 9.005, 38.765),
  sc("bole", "Bole", "ቦሌ", 8.995, 38.8),
  sc("yeka", "Yeka", "የካ", 9.04, 38.81),
  sc("gullele", "Gullele", "ጉለሌ", 9.065, 38.735),
  sc("kolfe-keranio", "Kolfe Keranio", "ኮልፌ ቀራንዮ", 9.015, 38.695),
  sc("nifas-silk-lafto", "Nifas Silk-Lafto", "ንፋስ ስልክ ላፍቶ", 8.96, 38.745),
  sc("akaky-kaliti", "Akaky Kaliti", "አቃቂ ቃሊቲ", 8.89, 38.78),
  sc("lemi-kura", "Lemi Kura", "ለሚ ኩራ", 9.02, 38.88),
  nb("piassa", "arada", "Piassa", 9.035, 38.75),
  nb("arat-kilo", "arada", "Arat Kilo", 9.035, 38.762),
  nb("merkato", "addis-ketema", "Merkato", 9.035, 38.738),
  nb("mexico", "lideta", "Mexico", 9.01, 38.745),
  nb("kazanchis", "kirkos", "Kazanchis", 9.018, 38.768),
  nb("meskel-square", "kirkos", "Meskel Square area", 9.01, 38.762),
  nb("bole-medhanealem", "bole", "Bole Medhane Alem", 8.996, 38.787),
  nb("gerji", "bole", "Gerji", 9.003, 38.82),
  nb("bole-bulbula", "bole", "Bole Bulbula", 8.95, 38.8),
  nb("megenagna", "yeka", "Megenagna", 9.02, 38.8),
  nb("cmc", "yeka", "CMC", 9.02, 38.85),
  nb("shiro-meda", "gullele", "Shiro Meda", 9.065, 38.765),
  nb("ayer-tena", "kolfe-keranio", "Ayer Tena", 8.99, 38.695),
  nb("old-airport", "nifas-silk-lafto", "Old Airport", 8.985, 38.74),
  nb("lafto", "nifas-silk-lafto", "Lafto", 8.955, 38.745),
  nb("kality", "akaky-kaliti", "Kality", 8.9, 38.775),
  nb("ayat", "lemi-kura", "Ayat", 9.025, 38.88),
];

export const DEFAULT_PLATFORM_SETTINGS = {
  commissionRate: 0.12, // illustrative development default (spec §23)
  customerServiceFeeRate: 0,
  customerServiceFeeMinMinor: 0,
  /** Mandatory verification for restricted actions — subject to regulatory authorisation. */
  requireIdentityForRestrictedActions: true,
  careServicesEnabled: false,
  jobsModuleEnabled: false,
  familyModuleEnabled: false,
  supportedPaymentMethods: ["cash", "bank_transfer"],
  safetyResources: [
    { label: "Ethiopian Federal Police (emergency)", value: "991" },
    { label: "Ambulance", value: "907" },
    { label: "Fire and emergency", value: "939" },
  ],
};
