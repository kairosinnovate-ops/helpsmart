import { describe, expect, it } from "vitest";
import { rankProviders, type RankableProvider } from "@/domain/ranking";

const center = { lat: 9.0, lng: 38.78 };
const p = (id: string, o: Partial<RankableProvider> = {}): RankableProvider => ({
  id,
  categoryIds: ["plumbing"],
  serviceCenter: center,
  serviceRadiusKm: 10,
  availableNow: false,
  ratingAverage: 0,
  ratingCount: 0,
  completedJobs: 0,
  yearsExperience: 2,
  startingPriceMinor: 300_00,
  identityVerified: true,
  approved: true,
  isBusiness: false,
  languages: ["am"],
  verifiedCredentialCount: 0,
  ...o,
});

describe("ranking", () => {
  it("never returns unapproved or unverified providers", () => {
    const r = rankProviders([p("a"), p("b", { approved: false }), p("c", { identityVerified: false })], {});
    expect(r.map((x) => x.provider.id)).toEqual(["a"]);
  });

  it("filters by service radius and category", () => {
    const far = { lat: 9.2, lng: 38.78 };
    const r = rankProviders([p("near"), p("far", { serviceCenter: far }), p("elec", { categoryIds: ["electrical"] })], { origin: center, categoryId: "plumbing" });
    expect(r.map((x) => x.provider.id)).toEqual(["near"]);
  });

  it("does not let one 5-star review outrank a long strong record", () => {
    const r = rankProviders([p("one", { ratingAverage: 5, ratingCount: 1 }), p("many", { ratingAverage: 4.8, ratingCount: 60, completedJobs: 80 })], { sort: "rating" });
    expect(r[0].provider.id).toBe("many");
  });

  it("is deterministic", () => {
    const list = [p("b"), p("a"), p("c")];
    expect(rankProviders(list, {}).map((x) => x.provider.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by price", () => {
    const r = rankProviders([p("x", { startingPriceMinor: 500_00 }), p("y", { startingPriceMinor: 200_00 }), p("z", { startingPriceMinor: null })], { sort: "price_asc" });
    expect(r.map((x) => x.provider.id)).toEqual(["y", "x", "z"]);
  });
});
