/**
 * Turn a raw surname into invitation closing form:
 * "Саша" → "Sashovlar oilasi" / "Сашовлар оиласи" / "Семья Сашовых"
 * "Tohirov" → "Tohirovlar oilasi"
 */

const CYR_RE = /[А-Яа-яЁёЎўҚқҒғҲҳ]/;
const LATN_DIGRAPHS: [string, string][] = [
  ["shch", "щ"],
  ["yo", "ё"],
  ["yu", "ю"],
  ["ya", "я"],
  ["ye", "е"],
  ["ch", "ч"],
  ["sh", "ш"],
  ["ts", "ц"],
  ["o'", "ў"],
  ["o‘", "ў"],
  ["g'", "ғ"],
  ["g‘", "ғ"],
];
const LATN_LETTERS: Record<string, string> = {
  a: "а",
  b: "б",
  d: "д",
  e: "е",
  f: "ф",
  g: "г",
  h: "ҳ",
  i: "и",
  j: "ж",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  q: "қ",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  v: "в",
  w: "в",
  x: "х",
  y: "й",
  z: "з",
};
const CYRL_TO_LATN: [string, string][] = [
  ["щ", "shch"],
  ["ё", "yo"],
  ["ю", "yu"],
  ["я", "ya"],
  ["ч", "ch"],
  ["ш", "sh"],
  ["ц", "ts"],
  ["ў", "o‘"],
  ["ғ", "g‘"],
  ["қ", "q"],
  ["ҳ", "h"],
  ["й", "y"],
  ["ж", "j"],
  ["х", "x"],
  ["а", "a"],
  ["б", "b"],
  ["д", "d"],
  ["е", "e"],
  ["ф", "f"],
  ["г", "g"],
  ["и", "i"],
  ["к", "k"],
  ["л", "l"],
  ["м", "m"],
  ["н", "n"],
  ["о", "o"],
  ["п", "p"],
  ["р", "r"],
  ["с", "s"],
  ["т", "t"],
  ["у", "u"],
  ["в", "v"],
  ["з", "z"],
  ["ы", "y"],
  ["э", "e"],
  ["ъ", ""],
  ["ь", ""],
];

function isCyrillic(text: string): boolean {
  return CYR_RE.test(text || "");
}

function preserveCase(src: string, dest: string): string {
  if (!dest) return dest;
  if (src === src.toUpperCase() && src !== src.toLowerCase()) {
    return dest.toUpperCase();
  }
  if (src.slice(0, 1) === src.slice(0, 1).toUpperCase()) {
    return dest.slice(0, 1).toUpperCase() + dest.slice(1);
  }
  return dest;
}

function latnToCyrl(text: string): string {
  const raw = text || "";
  const lower = raw.toLowerCase();
  let out = "";
  let i = 0;
  while (i < lower.length) {
    const digraph = LATN_DIGRAPHS.find(([src]) => lower.startsWith(src, i));
    if (digraph) {
      out += digraph[1];
      i += digraph[0].length;
      continue;
    }
    out += LATN_LETTERS[lower[i]] || lower[i];
    i += 1;
  }
  return preserveCase(raw, out);
}

function cyrlToLatn(text: string): string {
  const raw = text || "";
  const lower = raw.toLowerCase();
  let out = "";
  let i = 0;
  while (i < lower.length) {
    const pair = CYRL_TO_LATN.find(([src]) => lower.startsWith(src, i));
    if (pair) {
      out += pair[1];
      i += pair[0].length;
      continue;
    }
    out += lower[i];
    i += 1;
  }
  return preserveCase(raw, out);
}

function scriptForLang(name: string, lang: string, cyrillic: boolean): string {
  if (lang.startsWith("ru") || lang === "uz-cyrl" || (!lang && cyrillic)) {
    return isCyrillic(name) ? name : latnToCyrl(name);
  }
  return isCyrillic(name) ? cyrlToLatn(name) : name;
}

function bareFamilyStem(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\s+oilasi\.?$/i, "")
    .replace(/\s+оиласи\.?$/i, "")
    .replace(/^семья\s+/i, "")
    .replace(/\s+семьи\.?$/i, "")
    .replace(/(лар|лер|lar|ler)$/i, "")
    .replace(/(ов|ев|ёв)ых$/i, "$1")
    .replace(/(ин|ын)ых$/i, "$1")
    .replace(/ских$/i, "ский")
    .replace(/цких$/i, "цкий")
    .trim();
}

function ensureOvSurname(stem: string): string {
  if (!stem) return "";
  if (isCyrillic(stem)) {
    if (/(ов|ев|ёв|ин|ын|ский|цкий)$/i.test(stem)) return stem;
    if (/(ова|ева|ёва)$/i.test(stem)) return stem.slice(0, -1);
    if (/[аяе]$/i.test(stem)) stem = stem.slice(0, -1);
    return `${stem}ов`;
  }
  if (/(ov|ev|yev|in|yn|skiy|sky)$/i.test(stem)) return stem;
  if (/(ova|eva|yeva)$/i.test(stem)) return stem.slice(0, -1);
  if (/[ae]$/i.test(stem)) stem = stem.slice(0, -1);
  const suffix = stem === stem.toUpperCase() ? "OV" : "ov";
  return `${stem}${suffix}`;
}

function russianFamilyGenitive(surname: string): string {
  if (/ский$/i.test(surname)) return `${surname.slice(0, -2)}ких`;
  if (/цкий$/i.test(surname)) return `${surname.slice(0, -2)}ких`;
  if (/(ов|ев|ёв)$/i.test(surname)) return `${surname}ых`;
  if (/(ин|ын)$/i.test(surname)) return `${surname}ых`;
  return surname;
}

export function formatFamilySignature(
  raw: string | null | undefined,
  language?: string,
): string {
  let stem = bareFamilyStem(String(raw || ""));
  if (!stem) return "";

  const lang = (language || "").toLowerCase();
  const cyrHint = lang === "uz-cyrl" || lang.startsWith("ru") || isCyrillic(stem);
  stem = scriptForLang(stem, lang, cyrHint);
  let surname = ensureOvSurname(stem);
  if (!surname) return "";

  if (lang.startsWith("ru")) {
    return `Семья ${russianFamilyGenitive(surname)}`;
  }

  const cyr = lang === "uz-cyrl" || isCyrillic(surname);
  const plural = cyr ? "лар" : "lar";
  const family = cyr ? "оиласи" : "oilasi";
  if (!new RegExp(`${plural}$`, "i").test(surname)) {
    surname = `${surname}${plural}`;
  }
  return `${surname} ${family}`;
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
