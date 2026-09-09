/** Uzbekistan phone mask: +998 (__) ___-__-__ → +998XXXXXXXXX */

export function digitsOnly(value: string): string {
  return String(value || "").replace(/\D+/g, "");
}

/** Local 9 digits after country code (901234567). */
export function uzLocalDigits(raw: string): string {
  let d = digitsOnly(raw);
  if (d.startsWith("998")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 9);
}

/** Progressive display: +998 (90) 123-45-67 */
export function formatUzPhoneMask(local9: string): string {
  const d = uzLocalDigits(local9);
  if (!d) return "";

  let out = "+998 (";
  out += d.slice(0, Math.min(2, d.length));
  if (d.length < 2) return out;

  out += ")";
  if (d.length === 2) return out;

  out += ` ${d.slice(2, Math.min(5, d.length))}`;
  if (d.length <= 5) return out;

  out += `-${d.slice(5, Math.min(7, d.length))}`;
  if (d.length <= 7) return out;

  out += `-${d.slice(7, 9)}`;
  return out;
}

export const UZ_PHONE_PLACEHOLDER = "+998 (__) ___-__-__";

export function toE164Uz(raw: string): string {
  const local = uzLocalDigits(raw);
  return `+998${local}`;
}
