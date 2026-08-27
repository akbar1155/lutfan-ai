/** Detect unfinished placeholder junk like "aaaa" or "a, a". */
export function isJunkFieldValue(value: string | null | undefined): boolean {
  const text = (value || "").trim();
  if (!text) return true;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(text)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  if (text.length === 1) return true;
  if (/^(test|asdf|qwerty|xxx+|n\/?a|null|undefined|placeholder|lorem|ipsum)$/i.test(text)) {
    return true;
  }
  if (/^[aа]\s*,\s*[aа]$/i.test(text)) return true;
  // Real invitation sentences — never treat as placeholder junk
  const words = text.split(/\s+/).filter(Boolean);
  if (text.length >= 36 && words.length >= 5) return false;
  const compact = text.replace(/[\s.,\-_/·•]+/g, "");
  if (compact.length >= 2 && /^(.)\1+$/i.test(compact)) return true;
  const letters = text.match(/[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]/g) || [];
  if (
    letters.length >= 2 &&
    new Set(letters.map((c) => c.toLowerCase())).size === 1
  ) {
    return true;
  }
  // Keyboard smash e.g. "ewd, ewewfwf" / "dresw"
  if (letters.length >= 5) {
    const vowels = (text.match(/[aeiouаеёиоуыэюяўʻ‘']/gi) || []).length;
    if (vowels / letters.length < 0.22) return true;
    const unique = new Set(letters.map((c) => c.toLowerCase())).size;
    // Keyboard smash is short with few distinct letters.
    // Real invitation copy has ~15–25 unique letters over 60+ chars.
    if (letters.length < 32 && unique <= 3) return true;
  }
  const parts = text.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
  // "ewd, xxx" style smash — not short real words like boy / Ali
  if (
    parts.length >= 2 &&
    parts.some(
      (p) => p.length < 4 && /^[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]+$/.test(p),
    )
  ) {
    return true;
  }
  // "saom, dresw" — short lowercase blobs, not "Palace, Toshkent"
  if (
    parts.length >= 2 &&
    parts.every((p) => !p.includes(" ")) &&
    parts.every((p) => {
      const lettersOnly = p.replace(/[^A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]/g, "");
      return lettersOnly.length >= 3 && lettersOnly.length <= 12;
    }) &&
    parts.every((p) => p === p.toLowerCase() || p === p.toUpperCase())
  ) {
    return true;
  }
  return false;
}

export function cleanFieldValue(value: string | null | undefined): string {
  const text = (value || "").trim();
  return isJunkFieldValue(text) ? "" : text;
}
