/**
 * Ethiopian phone number handling. Accepts 09XXXXXXXX, 07XXXXXXXX, 9XXXXXXXX, +2519XXXXXXXX, 2519XXXXXXXX.
 * Mobile numbers in Ethiopia start with 9 (Ethio telecom) or 7 (Safaricom Ethiopia) after the country code.
 * Returns E.164 (+251XXXXXXXXX) or null.
 */
export function normalizeEthiopianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  let national: string | null = null;
  if (/^\+251[79]\d{8}$/.test(digits)) national = digits.slice(4);
  else if (/^251[79]\d{8}$/.test(digits)) national = digits.slice(3);
  else if (/^0[79]\d{8}$/.test(digits)) national = digits.slice(1);
  else if (/^[79]\d{8}$/.test(digits)) national = digits;
  return national ? `+251${national}` : null;
}

export function maskPhone(e164: string): string {
  if (e164.length < 8) return "••••";
  return `${e164.slice(0, 5)} ••• ${e164.slice(-3)}`;
}
