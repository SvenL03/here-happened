/**
 * Sentence splitting and year parsing. Pure functions, no network.
 * The text we return is the source sentence itself: only whitespace-trimmed,
 * with citation markers like [1] removed. Nothing is rewritten.
 */

const CURRENT_YEAR = new Date().getUTCFullYear();

export interface DatedSentence {
  text: string;
  year: number;
  dateLabel: string;
  /** The year sits inside a noun phrase rather than dating the event: rank lower. */
  weak: boolean;
}

const ANAPHOR = /^(?:All (?:two|three|four|five|six|of them)|These|Those|They|It|Its|This|He|She|His|Her|Their|The latter|The former|Both|Them|Such)\b/;
const TRIVIA =
  /\b(?:team|teams|season|championships?|qualif\w*|playoffs?|varsity|tournament|state meet|semi-?finals?|runners?-up|touchdowns?|head coach|athletic conference|bowl game|all-state|mascot)\b|\bwon (?:the|a|its|their) [^.]{0,40}\b(?:title|cup|trophy|championship)\b/i;

const MONTHS_EN = "January|February|March|April|May|June|July|August|September|October|November|December";
const MONTHS_DE = "Januar|Jänner|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
const MONTHS_FR = "janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre";

const ABBREV = new Set(
  [
    "c", "ca", "st", "mt", "ft", "dr", "mr", "mrs", "ms", "jr", "sr", "no", "nos", "vs", "v", "gen", "col", "capt", "lt",
    "rev", "gov", "sen", "rep", "prof", "approx", "est", "inc", "co", "corp", "ltd", "u.s", "e.g", "i.e", "etc", "al",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sept", "sep", "oct", "nov", "dec", "a.d", "b.c", "fl", "r",
    "bzw", "ggf", "chr", "jh", "jhd", "nr", "vgl", "evtl", "hl", "bzw", "z.b", "u.a", "d.h", "s", "bd", "sog", "gest",
    "geb", "ehem", "ss", "sts", "abt", "bros", "dept", "univ", "urspr", "mgr", "av", "j.-c", "apr", "a.c", "d.c", "sec", "secc", "op", "cf",
  ].map((s) => s.toLowerCase()),
);

export function cleanText(s: string): string {
  return s
    .replace(/\[(?:\d+|[a-z]|citation needed|note \d+|nb \d+)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a paragraph into sentences, keeping abbreviations, initials and German ordinals together. */
export function splitSentences(paragraph: string, lang: string): string[] {
  const p = cleanText(paragraph);
  if (!p) return [];
  if (lang === "ja" || lang === "zh") {
    return p.split(/(?:[。！？])/).map((s) => s.trim()).filter(Boolean).map((s) => s + "。");
  }
  const parts = p.split(/([.!?]["”’)]?)\s+/);
  // parts alternates: text, terminator, text, terminator, ..., text
  const raw: string[] = [];
  for (let i = 0; i < parts.length; i += 2) raw.push(parts[i] + (parts[i + 1] ?? ""));
  const out: string[] = [];
  for (const chunk of raw) {
    if (!out.length) {
      out.push(chunk);
      continue;
    }
    const prev = out[out.length - 1];
    const lastWord = (prev.match(/(\S+)[.!?]["”’)]?$/)?.[1] ?? "").replace(/^[("“]/, "").toLowerCase();
    const startsLower = /^[a-zà-ÿ]/.test(chunk);
    const initial = /(^|\s)[A-Z]$/.test(prev.replace(/[.]["”’)]?$/, "")) && prev.endsWith(".");
    const ordinal = lang !== "en" && /(^|\s)\d{1,2}\.$/.test(prev);
    if (ABBREV.has(lastWord) || startsLower || initial || ordinal) out[out.length - 1] = prev + " " + chunk;
    else out.push(chunk);
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

function romanToInt(r: string): number {
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const cur = v[r[i]] ?? 0;
    const next = v[r[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

function centuryYear(n: number, bc: boolean, part?: string): number {
  let offset = 50;
  const p = (part ?? "").toLowerCase();
  if (/early|anfang|frühen|début/.test(p)) offset = 15;
  if (/late|ende|späten|fin/.test(p)) offset = 85;
  const y = (n - 1) * 100 + offset;
  return bc ? -y : y;
}

interface Hit {
  index: number;
  length: number;
  year: number;
  label: string;
}

type Matcher = (s: string) => Hit[];

function all(re: RegExp, s: string, fn: (m: RegExpExecArray) => { year: number; label?: string } | null): Hit[] {
  const out: Hit[] = [];
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = g.exec(s))) {
    const r = fn(m);
    if (r && Number.isFinite(r.year) && r.year <= CURRENT_YEAR && r.year > -100000)
      out.push({ index: m.index, length: m[0].length, year: r.year, label: (r.label ?? m[0]).trim() });
  }
  return out;
}

const UNIT_AFTER =
  /^\s*(?:m\b|km\b|ft\b|feet|foot|metres|meters|mi\b|miles|acres|hectares|ha\b|people|persons|residents|inhabitants|households|kg\b|tons|tonnes|%|sq\b|square|einwohner|habitants|abitanti|habitantes|inwoners|mieszkańców|invånare|metri|mètres|metros|m²|km²|seats|spectators|students|pupils|employees|soldiers|men\b|troops|copies|units|vehicles|cars|houses|homes|buildings|rooms|beds)/i;

function plainYears(s: string, prefixRe: string): Hit[] {
  const re = new RegExp(`(^|[^\\d,.$€£#/:\\-–])((?:${prefixRe})\\s*)?\\b(1\\d{3}|20[0-2]\\d)\\b(?![,.]?\\d)`, "g");
  const out: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const after = s.slice(m.index + m[0].length);
    if (UNIT_AFTER.test(after)) continue;
    // "1200 Tai Dam were resettled": a count of people, not a year.
    if (/^\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:were|was|are|had|have|lived|died|arrived|settled)\b/.test(after)) continue;
    const year = Number(m[3]);
    if (year > CURRENT_YEAR) continue;
    const start = m.index + m[1].length;
    out.push({ index: start, length: m[0].length - m[1].length, year, label: ((m[2] ?? "") + m[3]).trim() });
  }
  return out;
}

/** "1300 to 1200 BCE", "c. 3000–1500 BCE", "Between 1,000 and 800 BC": the era applies to the whole range. */
function bcRanges(s: string, eraRe: string, circaRe: string): Hit[] {
  const re = new RegExp(
    `(?:^|[^\\d,.])((${circaRe})?(\\d{1,3}(?:,\\d{3})+|\\d{1,6})\\s*(?:–|—|-|to|and|bis|à|et|a|e|y)\\s*(\\d{1,3}(?:,\\d{3})+|\\d{1,6})\\s*(${eraRe}))`,
    "gi",
  );
  const out: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const a = Number(m[3].replace(/,/g, ""));
    if (!a) continue;
    const start = m.index + m[0].length - m[1].length;
    const circa = m[2] ? "c. " : "";
    out.push({ index: start, length: m[1].length, year: -a, label: `${circa}${m[3]}–${m[4]} ${m[5].trim()}` });
  }
  return out;
}

const EN: Matcher = (s) => [
  ...bcRanges(s, "BCE|BC|B\\.C\\.", "c\\.\\s*|ca\\.\\s*|circa\\s+|around\\s+|about\\s+"),
  ...all(new RegExp(`\\b((?:early|mid|late)[- ])?(\\d{1,2})(?:st|nd|rd|th)[- ]century(?:\\s+(BC|BCE|B\\.C\\.|AD|CE))?`, "i"), s, (m) => ({
    year: centuryYear(Number(m[2]), !!m[3] && /B/i.test(m[3]), m[1]),
  })),
  ...all(/(?:^|[^\d,.])((?:c\.\s*|ca\.\s*|circa\s+|around\s+)?(\d{1,3}(?:,\d{3})+|\d{1,6})\s*(BC|BCE|B\.C\.|AD|CE|A\.D\.))(?![A-Za-z])/, s, (m) => {
    const n = Number(m[2].replace(/,/g, ""));
    if (!n) return null;
    return { year: /B/.test(m[3]) ? -n : n, label: m[1] };
  }),
  ...all(/\b(AD|A\.D\.)\s*(\d{1,4})\b/, s, (m) => ({ year: Number(m[2]) })),
  ...all(/\b(?:the\s+)?(1\d|20)(\d)0s\b/, s, (m) => ({ year: Number(m[1] + m[2] + "0"), label: `${m[1]}${m[2]}0s` })),
  ...all(new RegExp(`\\b(\\d{1,2}\\s+)?(${MONTHS_EN})\\s+(\\d{1,2},?\\s+)?(1\\d{3}|20[0-2]\\d)\\b`), s, (m) => ({ year: Number(m[4]) })),
  ...plainYears(s, "c\\.|ca\\.|circa|around"),
];

const DE: Matcher = (s) => [
  ...bcRanges(s, "v\\.\\s*Chr\\.", "um\\s+|ca\\.\\s*|etwa\\s+"),
  ...all(/\b((?:frühen|späten|Anfang des|Ende des|Mitte des)\s+)?(\d{1,2})\.\s*(Jahrhunderts?|Jh\.)(\s*v\.\s*Chr\.)?/, s, (m) => ({
    year: centuryYear(Number(m[2]), !!m[4], m[1]),
  })),
  ...all(/\b(um\s+|ca\.\s*|etwa\s+)?(\d{1,4})\s*(v\.|n\.)\s*Chr\./, s, (m) => ({ year: m[3] === "v." ? -Number(m[2]) : Number(m[2]) })),
  ...all(/\b(1\d|20)(\d)0er(?:\s+Jahren?)?\b/, s, (m) => ({ year: Number(m[1] + m[2] + "0") })),
  ...all(new RegExp(`\\b(\\d{1,2})\\.\\s*(${MONTHS_DE})\\s+(1\\d{3}|20[0-2]\\d)\\b`), s, (m) => ({ year: Number(m[3]) })),
  ...plainYears(s, "um|ca\\.|etwa|seit|ab|im Jahr|im Jahre"),
];

const ROMANCE: Matcher = (s) => [
  ...bcRanges(s, "av\\.\\s*J\\.-C\\.|a\\.\\s*C\\.|a\\.C\\.", "vers\\s+|circa\\s+|c\\.\\s*|ca\\.\\s*"),
  ...all(/\b([IVXL]+)(?:e|ème|er|º|°)?\s+(siècle|secolo|siglo|século)(\s+(?:av\.\s*J\.-C\.|a\.\s*C\.|a\.C\.))?/, s, (m) => ({
    year: centuryYear(romanToInt(m[1]), !!m[3]),
  })),
  ...all(/\b(siècle|secolo|siglo|século)\s+([IVXL]+)(\s+(?:av\.\s*J\.-C\.|a\.\s*C\.|a\.C\.))?/, s, (m) => ({
    year: centuryYear(romanToInt(m[2]), !!m[3]),
  })),
  ...all(/\b(\d{1,4})\s*(av\.\s*J\.-C\.|a\.\s*C\.|a\.C\.)/, s, (m) => ({ year: -Number(m[1]) })),
  ...all(new RegExp(`\\b(\\d{1,2}(?:er)?\\s+)?(${MONTHS_FR})\\s+(1\\d{3}|20[0-2]\\d)\\b`, "i"), s, (m) => ({ year: Number(m[3]) })),
  ...plainYears(s, "vers|en|circa|ca\\.|c\\.|nel|nell'anno|en el año|em"),
];

const CJK: Matcher = (s) => [...all(/(\d{3,4})年/, s, (m) => ({ year: Number(m[1]) }))];

const GENERIC: Matcher = (s) => plainYears(s, "c\\.|ca\\.");

function matcherFor(lang: string): Matcher {
  if (lang === "en") return EN;
  if (lang === "de" || lang === "nl" || lang === "sv" || lang === "da" || lang === "no") return (s) => [...DE(s), ...(lang === "de" ? [] : GENERIC(s))];
  if (lang === "fr" || lang === "it" || lang === "es" || lang === "pt" || lang === "ca" || lang === "ro") return ROMANCE;
  if (lang === "ja" || lang === "zh") return CJK;
  return GENERIC;
}

/** First date mentioned in the sentence (the earliest position wins; at a tie, the longest match). */
export function findDate(sentence: string, lang: string): { year: number; dateLabel: string; weak: boolean } | null {
  const hits = matcherFor(lang)(sentence);
  if (!hits.length) return null;
  // Prefer dates outside parentheses (a reign "(r. 69–79 AD)" or a life span is not the event).
  const depth = (i: number) => {
    let d = 0;
    for (let k = 0; k < i; k++) d += sentence[k] === "(" ? 1 : sentence[k] === ")" ? -1 : 0;
    return d > 0 ? 1 : 0;
  };
  hits.sort((a, b) => depth(a.index) - depth(b.index) || a.index - b.index || b.length - a.length);
  const h = hits[0];
  // Weak: the year only qualifies a noun ("the 1892 presidential election", "1892's"), not the main event.
  const before = sentence.slice(0, h.index);
  const after = sentence.slice(h.index + h.length);
  const weak =
    (lang === "en" && /\bthe\s+$/i.test(before) && /^(?:'s|\s+[a-z])/.test(after) && !/^\s+(?:to|and|until)\b/.test(after)) ||
    /-century$/.test(h.label);
  return { year: h.year, dateLabel: h.label, weak };
}

const STATS =
  /\b(census|population|inhabitants|households|median (?:age|income)|per capita|racial makeup|square miles?|km2|km²|poverty line|population density|Einwohner|Bevölkerung|habitants|abitanti|habitantes|inwoners|mieszkańców|invånare|demograph)/i;

/** Pull dated sentences out of a block of plain text. */
export function datedSentences(text: string, lang: string): DatedSentence[] {
  const out: DatedSentence[] = [];
  for (const para of text.split(/\n+/)) {
    const p = para.trim();
    if (!p || /^=+.*=+$/.test(p)) continue;
    const sents = splitSentences(p, lang);
    for (let i = 0; i < sents.length; i++) {
      const s = sents[i];
      if (s.length > 420) continue;
      if (!/[.!?。"”’)]$/.test(s)) continue;
      if (!/^["“(]?[A-ZÀ-ÖØ-Þ0-9Ѐ-ӿ぀-ヿ一-鿿]/.test(s)) continue;
      if (STATS.test(s)) continue;
      if (/\d\s?%|\bper cent\b|\bpercent\b|^As of\b|\bstudents\b/i.test(s)) continue; // statistics
      const close = s.indexOf(")");
      if (close >= 0 && (s.indexOf("(") < 0 || s.indexOf("(") > close)) continue; // fragment
      if (new RegExp(`^(${MONTHS_EN}|${MONTHS_DE})\\b`).test(s)) continue; // fragment cut after a day number
      if ((s.match(/;/g) ?? []).length >= 3) continue;
      const years = s.match(/\b(1\d{3}|20[0-2]\d)\b/g) ?? [];
      if (years.length >= 4 && s.length < 200) continue; // list-like
      if (/(^|\s)(ISBN|doi:|Retrieved|Archived|pp?\.\s*\d)/.test(s)) continue;
      if (TRIVIA.test(s)) continue;
      const d = findDate(s, lang);
      if (!d) continue;
      let text = s;
      // "All three disappeared in the 17th century." means nothing alone: join the previous sentence (still verbatim, consecutive) or drop.
      if (lang === "en" && ANAPHOR.test(s)) {
        const prev = sents[i - 1];
        if (!prev || prev.length + 1 + s.length > 420) continue;
        text = `${prev} ${s}`;
      }
      if (text.length < 40) continue;
      out.push({ text, year: d.year, dateLabel: d.dateLabel, weak: d.weak });
    }
  }
  return out;
}

/** First sentence of an intro, verbatim (for nearby summaries). */
export function firstSentence(text: string, lang: string): string | undefined {
  const para = text.split(/\n+/).map((s) => s.trim()).find((s) => s.length > 0);
  if (!para) return undefined;
  const s = splitSentences(para, lang)[0];
  if (!s) return undefined;
  return s.length > 400 ? undefined : s;
}

const HISTORY_HEAD =
  /histor|geschicht|histoire|storia|historia|história|geschiedenis|dzieje|история|歴史|历史|沿革|founding|settlement|origins|antiquity|middle ages|etymology|archaeolog|chronolog|ancient|medieval|colonial|war\b|construction|later use|origin|names?$/i;
const SKIP_HEAD =
  /see also|references|external links|notes|further reading|bibliography|sources|gallery|literatur|weblinks|einzelnachweise|anmerkungen|siehe auch|liens externes|références|bibliographie|note|voci correlate|collegamenti esterni|referencias|enlaces externos|demograph|bevölkerung|population|climate|klima|climat|education|bildung|notable people|persönlichkeiten|personnalités|sport|transport|verkehr|economy|wirtschaft|media|government|politik|politics|twin towns|partnerstädte/i;

export interface Section {
  heading: string;
  level: number;
  text: string;
}

/** Split an `explaintext` + `exsectionformat=wiki` extract into sections (lead has heading ""). */
export function splitSections(extract: string): Section[] {
  const out: Section[] = [{ heading: "", level: 1, text: "" }];
  for (const line of extract.split("\n")) {
    const m = line.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (m) out.push({ heading: m[2], level: m[1].length, text: "" });
    else out[out.length - 1].text += line + "\n";
  }
  return out;
}

/**
 * Pick the text worth mining. mode "all": everything except reference/statistics sections (for the spot itself).
 * mode "history": the lead plus History-type sections and their subsections.
 */
export function pickText(extract: string, mode: "all" | "history" | "history-only"): string {
  const secs = splitSections(extract);
  const keep: string[] = [];
  let inHistory = false;
  let historyLevel = 0;
  let skipLevel = 0;
  for (const s of secs) {
    if (s.heading === "") {
      if (mode !== "history-only") keep.push(s.text);
      continue;
    }
    if (skipLevel && s.level > skipLevel) continue;
    skipLevel = 0;
    if (SKIP_HEAD.test(s.heading) && !HISTORY_HEAD.test(s.heading)) {
      skipLevel = s.level;
      if (inHistory && s.level <= historyLevel) inHistory = false;
      continue;
    }
    if (mode === "all") {
      keep.push(s.text);
      continue;
    }
    if (inHistory && s.level > historyLevel) {
      keep.push(s.text);
      continue;
    }
    inHistory = false;
    if (HISTORY_HEAD.test(s.heading)) {
      inHistory = true;
      historyLevel = s.level;
      keep.push(s.text);
    }
  }
  return keep.join("\n");
}
