import { describe, expect, it } from "vitest";
import { calculateBreakdown, DEFAULT_FEE_SETTINGS, estimateAmount, formatEtb } from "@/domain/pricing";

describe("pricing", () => {
  it("computes commission and provider net in integer santim", () => {
    const b = calculateBreakdown(1000_00, DEFAULT_FEE_SETTINGS);
    expect(b.commissionMinor).toBe(120_00);
    expect(b.providerNetMinor).toBe(880_00);
    expect(b.customerTotalMinor).toBe(1000_00);
    expect(b.platformRevenueMinor).toBe(120_00);
  });

  it("never counts GMV as platform revenue", () => {
    const b = calculateBreakdown(5000_00, { commissionRate: 0.1, customerServiceFeeRate: 0.02, customerServiceFeeMinMinor: 0 });
    expect(b.platformRevenueMinor).toBe(500_00 + 100_00);
    expect(b.customerTotalMinor).toBe(5100_00);
  });

  it("applies the minimum service fee and caps discounts", () => {
    const b = calculateBreakdown(100_00, { commissionRate: 0.12, customerServiceFeeRate: 0.01, customerServiceFeeMinMinor: 10_00 }, 1_000_000);
    expect(b.customerServiceFeeMinor).toBe(10_00);
    expect(b.discountMinor).toBe(110_00);
    expect(b.customerTotalMinor).toBe(0);
    expect(b.providerNetMinor).toBe(88_00); // provider earnings are not reduced by platform discounts
  });

  it("rejects fractional or negative amounts and absurd rates", () => {
    expect(() => calculateBreakdown(10.5, DEFAULT_FEE_SETTINGS)).toThrow();
    expect(() => calculateBreakdown(-1, DEFAULT_FEE_SETTINGS)).toThrow();
    expect(() => calculateBreakdown(100, { ...DEFAULT_FEE_SETTINGS, commissionRate: 0.9 })).toThrow();
  });

  it("estimates and formats", () => {
    expect(estimateAmount(350_00, 2.5)).toBe(875_00);
    expect(() => estimateAmount(100, 0)).toThrow();
    expect(formatEtb(875_00)).toMatch(/875/);
  });
});
