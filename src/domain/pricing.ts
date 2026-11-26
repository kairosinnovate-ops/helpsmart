/**
 * Marketplace money math. All values are integer minor units (santim). 1 ETB = 100 santim.
 * Gross marketplace value (GMV) is what the customer pays for the service itself.
 * HelpSmart revenue is only commission + customer service fee — never the GMV.
 */

export interface FeeSettings {
  /** e.g. 0.12 for 12% provider commission (illustrative development default). */
  commissionRate: number;
  /** e.g. 0.0 — optional customer-side service fee, disclosed before confirmation. */
  customerServiceFeeRate: number;
  /** Flat minimum customer service fee in santim (0 = none). */
  customerServiceFeeMinMinor: number;
}

export const DEFAULT_FEE_SETTINGS: FeeSettings = {
  commissionRate: 0.12,
  customerServiceFeeRate: 0,
  customerServiceFeeMinMinor: 0,
};

export interface PriceBreakdown {
  serviceAmountMinor: number;
  customerServiceFeeMinor: number;
  discountMinor: number;
  customerTotalMinor: number;
  commissionMinor: number;
  providerNetMinor: number;
  platformRevenueMinor: number;
  commissionRate: number;
}

function assertRate(rate: number, name: string) {
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.5) {
    throw new Error(`${name} must be between 0 and 0.5`);
  }
}

export function calculateBreakdown(
  serviceAmountMinor: number,
  settings: FeeSettings,
  discountMinor = 0,
): PriceBreakdown {
  if (!Number.isInteger(serviceAmountMinor) || serviceAmountMinor < 0) {
    throw new Error("serviceAmountMinor must be a non-negative integer");
  }
  if (!Number.isInteger(discountMinor) || discountMinor < 0) {
    throw new Error("discountMinor must be a non-negative integer");
  }
  assertRate(settings.commissionRate, "commissionRate");
  assertRate(settings.customerServiceFeeRate, "customerServiceFeeRate");

  const commissionMinor = Math.round(serviceAmountMinor * settings.commissionRate);
  let feeMinor = Math.round(serviceAmountMinor * settings.customerServiceFeeRate);
  if (serviceAmountMinor > 0 && feeMinor < settings.customerServiceFeeMinMinor) {
    feeMinor = settings.customerServiceFeeMinMinor;
  }
  // Discounts are funded by the platform and come off the customer total, not provider earnings.
  const appliedDiscount = Math.min(discountMinor, serviceAmountMinor + feeMinor);
  const customerTotalMinor = serviceAmountMinor + feeMinor - appliedDiscount;
  const providerNetMinor = serviceAmountMinor - commissionMinor;
  const platformRevenueMinor = commissionMinor + feeMinor - appliedDiscount;

  return {
    serviceAmountMinor,
    customerServiceFeeMinor: feeMinor,
    discountMinor: appliedDiscount,
    customerTotalMinor,
    commissionMinor,
    providerNetMinor,
    platformRevenueMinor,
    commissionRate: settings.commissionRate,
  };
}

/** Estimate a service amount from a provider rate and a quantity (hours or days). */
export function estimateAmount(rateMinor: number, quantity: number): number {
  if (!Number.isInteger(rateMinor) || rateMinor < 0) throw new Error("rateMinor must be a non-negative integer");
  if (!(quantity > 0) || quantity > 1000) throw new Error("quantity out of range");
  return Math.round(rateMinor * quantity);
}

export function birrToMinor(birr: number): number {
  return Math.round(birr * 100);
}

export function formatEtb(minor: number, locale = "en"): string {
  const value = minor / 100;
  const tag = locale === "am" ? "am-ET" : "en-ET";
  try {
    return new Intl.NumberFormat(tag, {
      style: "currency",
      currency: "ETB",
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `ETB ${value.toFixed(2)}`;
  }
}
