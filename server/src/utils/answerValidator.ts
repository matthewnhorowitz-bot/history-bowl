import { distance } from "fastest-levenshtein";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function threshold(len: number): number {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  if (len <= 12) return 2;
  return 3;
}

function fuzzyMatch(input: string, target: string): boolean {
  const normInput = normalize(input);
  const normTarget = normalize(target);
  if (normInput === normTarget) return true;
  const d = distance(normInput, normTarget);
  return d <= threshold(normTarget.length);
}

// IAC answer lines look like:
//   Samuel Adams (prompt on "Adams")
//   Principality of Monaco (or Múnegu; or Principauté de Monaco)
//   Buffalo Bill (or William Frederick Cody; accept Buffalo Bill's Wild West)
//   Hephaestus (or Hephaistos; do not accept or prompt on "Vulcan")
function extractAlternates(answerLine: string): string[] {
  const alts: string[] = [];

  // Primary answer: everything before the first ( or [
  const mainMatch = answerLine.match(/^([^(\[<]+)/);
  if (mainMatch) alts.push(mainMatch[1].trim());

  // Pull the contents of every ( ... ) and [ ... ] group
  const groups = [
    ...answerLine.matchAll(/\(([^)]*)\)/g),
    ...answerLine.matchAll(/\[([^\]]*)\]/g),
  ].map((m) => m[1]);

  for (const group of groups) {
    // Each group may hold several "; "-separated clauses
    for (const clause of group.split(/;/)) {
      const c = clause.trim();
      // Skip non-acceptable clauses
      if (/^(do not accept|do not|prompt|Editor)/i.test(c)) continue;
      // "or X" / "accept X" → take X
      const m = c.match(/^(?:or|accept)\s+(.+)$/i);
      if (m) {
        // Strip surrounding quotes if present
        alts.push(m[1].replace(/^["']|["']$/g, "").trim());
      }
    }
  }

  return alts.filter(Boolean);
}

export function validateAnswer(input: string, answerLine: string): boolean {
  const alts = extractAlternates(answerLine);
  if (alts.length === 0) alts.push(answerLine);
  return alts.some((alt) => fuzzyMatch(input, alt));
}
