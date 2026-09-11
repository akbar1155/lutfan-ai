/**
 * Turn a raw surname into invitation closing form:
 * "Tohirov" → "Tohirovlar oilasi"
 * "Tohirovlar" → "Tohirovlar oilasi"
 * "Tohirovlar oilasi" → "Tohirovlar oilasi" (idempotent)
 * "Nosirovlar oilasi" → "Nosirovlar oilasi"
 */
export function formatFamilySignature(
  raw: string | null | undefined,
  language?: string,
): string {
  let name = String(raw || "").trim();
  if (!name) return "";

  const lang = (language || "").toLowerCase();

  // Strip existing family-phrase suffixes so re-formatting is safe.
  name = name
    .replace(/\s+oilasi\.?$/i, "")
    .replace(/\s+оиласи\.?$/i, "")
    .replace(/^семья\s+/i, "")
    .replace(/\s+семьи\.?$/i, "")
    .trim();
  if (!name) return "";

  if (lang.startsWith("ru")) {
    return `семья ${name}`;
  }

  const isCyrl = lang === "uz-cyrl" || /[А-Яа-яЁёЎўҚқҒғҲҳ]/.test(name);
  const hasPlural = isCyrl ? /(лар|лер)$/i.test(name) : /(lar|ler)$/i.test(name);
  if (!hasPlural) {
    name = `${name}${isCyrl ? "лар" : "lar"}`;
  }

  return isCyrl ? `${name} оиласи` : `${name} oilasi`;
}

/** Full card footer: "Yuksak ehtirom ila, Nosirovlar oilasi". */
export function formatFamilyFooter(
  raw: string | null | undefined,
  language?: string,
): string {
  const sig = formatFamilySignature(raw, language);
  if (!sig) return "";
  const lang = (language || "").toLowerCase();
  if (lang.startsWith("ru")) {
    return `С глубоким уважением, ${sig}`;
  }
  const isCyrl = lang === "uz-cyrl" || /[А-Яа-яЁёЎўҚқҒғҲҳ]/.test(sig);
  return isCyrl ? `Юксак эҳтиром ила, ${sig}` : `Yuksak ehtirom ila, ${sig}`;
}
