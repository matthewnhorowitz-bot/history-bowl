import { distance } from "fastest-levenshtein";

export type Verdict = "correct" | "prompt" | "incorrect";

// Words that are never enough on their own to identify an answer.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "at", "by",
  "de", "von", "van", "la", "le", "el", "du", "di", "da",
  "saint", "st", "war", "battle", "empire", "dynasty", "river", "lake",
  "mount", "mountain", "city", "sea", "king", "queen", "emperor", "president",
  // generic nouns that are too common to identify an answer on their own
  "army", "navy", "revolution", "rebellion", "republic", "kingdom",
  "council", "congress", "party", "treaty", "alliance", "league",
  "movement", "uprising", "campaign", "crusade", "expedition",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Significant words of an answer — the "parts of the name" any one of which is
// enough to be correct. Skips short words and generic stopwords.
function significantWords(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

// --- Regnal / ordinal numbers (Henry VIII, Louis XIV, World War II) ---
// Many answers are only distinguished by a number, so the name alone is not
// enough — "Henry" must not score when the answer is "Henry VIII".

function romanToArabic(s: string): number | null {
  const map: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  const t = s.toLowerCase();
  if (!/^[ivxlcdm]+$/.test(t)) return null;
  let total = 0, prev = 0;
  for (let k = t.length - 1; k >= 0; k--) {
    const val = map[t[k]];
    if (val < prev) total -= val;
    else { total += val; prev = val; }
  }
  return total > 0 ? total : null;
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
  fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19, twentieth: 20,
};

// The regnal number an answer requires, e.g. "Louis XIV" -> 14; null if none.
// Requires a capitalized name immediately followed by an UPPERCASE Roman
// numeral ("Henry VIII", "World War II", "Pius X") so plain acronyms like
// "CIA", "NATO", or "Washington, D.C." are not mistaken for regnal numbers.
function requiredNumber(form: string): number | null {
  const m = form.match(/\b[A-Z][a-z]+\s+([IVXLCDM]{1,6})\b/);
  return m ? romanToArabic(m[1]) : null;
}

// Every number present in the player's input (Roman, Arabic, or ordinal word).
function numbersIn(input: string): Set<number> {
  const set = new Set<number>();
  const norm = input.toLowerCase();
  for (const m of norm.matchAll(/\b(\d{1,3})(?:st|nd|rd|th)?\b/g)) set.add(parseInt(m[1], 10));
  for (const m of norm.matchAll(/\b([ivxlcdm]+)\b/g)) {
    const v = romanToArabic(m[1]);
    if (v) set.add(v);
  }
  for (const [w, n] of Object.entries(ORDINAL_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(norm)) set.add(n);
  }
  return set;
}

function isRomanWord(w: string): boolean {
  return /^[ivxlcdm]+$/.test(w) && romanToArabic(w) !== null;
}

function threshold(len: number): number {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  if (len <= 12) return 2;
  return 3;
}

function fuzzyEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return distance(a, b) <= threshold(b.length);
}

// Looser "close enough to be worth a second chance" check → prompt.
function isClose(a: string, b: string): boolean {
  if (!a || !b) return false;
  const d = distance(a, b);
  return d <= Math.max(threshold(b.length) + 2, Math.floor(b.length * 0.34));
}

// "prompt on Adams before mentioned" → "Adams"; prefer a quoted token.
function cleanClause(t: string): string {
  const q = t.match(/"([^"]+)"/);
  if (q) return q[1].trim();
  return t.replace(/\s*\b(before|after|until|unless|if|when)\b.*$/i, "").trim();
}

// IAC answer lines, e.g.:
//   Samuel Adams (prompt on "Adams")
//   Buffalo Bill (or William Frederick Cody; accept Buffalo Bill's Wild West)
//   Platinum (accept Pt before mentioned; prompt on "platino")
function parseAnswerLine(line: string): { accept: string[]; prompt: string[] } {
  const accept: string[] = [];
  const prompt: string[] = [];

  const main = line.match(/^([^(\[<]+)/);
  if (main) accept.push(main[1].trim());

  const groups = [
    ...line.matchAll(/\(([^)]*)\)/g),
    ...line.matchAll(/\[([^\]]*)\]/g),
  ].map((m) => m[1]);

  for (const group of groups) {
    for (const clause of group.split(/;/)) {
      const c = clause.trim();
      if (/^do not/i.test(c)) continue;
      let m: RegExpMatchArray | null;
      if ((m = c.match(/^prompt(?:\s+on)?\s+(.+)$/i))) {
        prompt.push(cleanClause(m[1]));
      } else if ((m = c.match(/^(?:or|accept)\s+(.+)$/i))) {
        accept.push(cleanClause(m[1]));
      }
    }
  }

  return { accept: accept.filter(Boolean), prompt: prompt.filter(Boolean) };
}

export function judgeAnswer(input: string, answerLine: string): Verdict {
  const ni = normalize(input);
  if (!ni) return "incorrect";

  const { accept, prompt } = parseAnswerLine(answerLine);
  if (accept.length === 0) accept.push(answerLine);

  const inputForms = [ni, ...significantWords(input)];
  const inputNumbers = numbersIn(input);

  // 1) Full match against any acceptable answer → correct. For a numbered
  //    answer (Elizabeth I), the input must carry the number too — otherwise
  //    a bare "Elizabeth" is within fuzzy distance and would wrongly pass.
  for (const a of accept) {
    if (fuzzyEqual(ni, normalize(a))) {
      const num = requiredNumber(a);
      if (num === null || inputNumbers.has(num)) return "correct";
    }
  }

  // 2) A writer's explicit "prompt on X" wins over partial-name leniency
  //    (that's exactly why ambiguous surnames like "Adams" are flagged).
  for (const p of prompt) {
    const forms = [normalize(p), ...significantWords(p)];
    if (inputForms.some((i) => forms.some((f) => fuzzyEqual(i, f)))) return "prompt";
  }

  // 3) Just one part of the name is enough → correct. BUT if the answer is
  //    distinguished by a number (Henry VIII, Louis XIV, World War II), the
  //    name alone is not enough — require the number, else prompt for it.
  let nameOnlyNeedsNumber = false;
  for (const a of accept) {
    const num = requiredNumber(a);
    const forms = significantWords(a).filter((w) => !isRomanWord(w));
    const nameMatch = inputForms.some((i) => forms.some((f) => fuzzyEqual(i, f)));
    if (!nameMatch) continue;
    if (num === null) return "correct"; // ordinary partial-name match
    if (inputNumbers.has(num)) return "correct"; // name + correct number
    nameOnlyNeedsNumber = true; // right name, missing/wrong number
  }
  if (nameOnlyNeedsNumber) return "prompt";

  // 4) Close but not quite → give them another chance (prompt).
  for (const a of accept) {
    if (isClose(ni, normalize(a))) return "prompt";
    if (significantWords(a).some((f) => isClose(ni, f))) return "prompt";
  }

  return "incorrect";
}

// Back-compat: a strict boolean check (used where a yes/no is all that's needed).
export function validateAnswer(input: string, answerLine: string): boolean {
  return judgeAnswer(input, answerLine) === "correct";
}
