/** Uzbekistan phone input helpers: display +998 XX XXX XX XX, value +998XXXXXXXXX. */

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

export function formatUzLocalPhone(local9: string): string {
  const d = uzLocalDigits(local9);
  const parts: string[] = [];
  if (d.length > 0) parts.push(d.slice(0, 2));
  if (d.length > 2) parts.push(d.slice(2, 5));
  if (d.length > 5) parts.push(d.slice(5, 7));
  if (d.length > 7) parts.push(d.slice(7, 9));
  return parts.join(" ");
}

export function toE164Uz(raw: string): string {
  const local = uzLocalDigits(raw);
  return local.length === 9 ? `+998${local}` : `+998${local}`;
}
