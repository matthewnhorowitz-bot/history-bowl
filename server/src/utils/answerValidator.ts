import { distance } from "fastest-levenshtein";

export type Verdict = "correct" | "prompt" | "incorrect";

// Words that are never enough on their own to identify an answer.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "at", "by",
  "de", "von", "van", "la", "le", "el", "du", "di", "da",
  "saint", "st", "war", "battle", "empire", "dynasty", "river", "lake",
  "mount", "mountain", "city", "sea", "king", "queen", "emperor", "president",
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

  // 1) Full match against any acceptable answer → correct.
  for (const a of accept) {
    if (fuzzyEqual(ni, normalize(a))) return "correct";
  }

  // 2) A writer's explicit "prompt on X" wins over partial-name leniency
  //    (that's exactly why ambiguous surnames like "Adams" are flagged).
  for (const p of prompt) {
    const forms = [normalize(p), ...significantWords(p)];
    if (inputForms.some((i) => forms.some((f) => fuzzyEqual(i, f)))) return "prompt";
  }

  // 3) Just one part of the name is enough → correct.
  for (const a of accept) {
    const forms = significantWords(a);
    if (inputForms.some((i) => forms.some((f) => fuzzyEqual(i, f)))) return "correct";
  }

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
