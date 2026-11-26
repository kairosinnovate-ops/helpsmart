import { describe, expect, it } from "vitest";
import { maskPhone, normalizeEthiopianPhone } from "@/domain/phone";
import { approximate, geohash, haversineKm } from "@/domain/geo";
import { hasPermission, ROLE_PERMISSIONS } from "@/domain/permissions";
import { ADMIN_ROLES } from "@/domain/types";

describe("Ethiopian phone numbers", () => {
  it.each([
    ["0911234567", "+251911234567"],
    ["911234567", "+251911234567"],
    ["+251 911 234 567", "+251911234567"],
    ["251711234567", "+251711234567"],
    ["0711-234-567", "+251711234567"],
  ])("normalises %s", (input, out) => expect(normalizeEthiopianPhone(input)).toBe(out));

  it.each(["0111234567", "+25191123456", "+1 202 555 0100", "abc", ""])("rejects %s", (input) => expect(normalizeEthiopianPhone(input)).toBeNull());

  it("masks", () => expect(maskPhone("+251911234567")).toBe("+2519 ••• 567"));
});

describe("geo", () => {
  it("measures distances across Addis Ababa", () => {
    const bole = { lat: 8.995, lng: 38.79 };
    const piassa = { lat: 9.035, lng: 38.75 };
    const d = haversineKm(bole, piassa);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(7);
  });

  it("geohashes and approximates", () => {
    expect(geohash({ lat: 9.01, lng: 38.76 }, 5)).toHaveLength(5);
    const a = approximate({ lat: 9.012345, lng: 38.765432 });
    expect(Math.abs(a.lat - 9.012345)).toBeLessThan(0.01);
  });
});

describe("admin permissions", () => {
  it("defines every role", () => {
    for (const r of ADMIN_ROLES) expect(ROLE_PERMISSIONS[r]).toBeDefined();
  });

  it("separates duties", () => {
    expect(hasPermission("read_only_analyst", "users.manage" as never)).toBe(false);
    expect(hasPermission("support_agent", "finance.refund")).toBe(false);
    expect(hasPermission("finance_admin", "finance.refund")).toBe(true);
    expect(hasPermission("verification_officer", "credentials.verify")).toBe(true);
    expect(hasPermission(null, "metrics.read")).toBe(false);
  });

  it("has no permission that grants identity verification", () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms.some((p) => /identity\.grant|badge\.grant/.test(p))).toBe(false);
    }
  });
});
