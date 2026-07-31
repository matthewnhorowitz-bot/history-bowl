import { distance } from "fastest-levenshtein";

export type Verdict = "correct" | "prompt" | "incorrect";

// IAC answer lines are written for a human moderator, e.g.
//   Samuel Adams (prompt on "Adams")
//   Nation of Islam (accept NOI, do not accept or prompt on just "Islam")
//   Qing [cheeng] dynasty (accept Manchus before read; do not accept Qin [cheen])
// so judging has two halves: read the writer's instructions out of the line,
// then decide how much of the answer a player has to say. When a call is
// genuinely uncertain we return "prompt" — the player gets another try rather
// than points they may not have earned or a loss they don't deserve.

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

// Grammatical glue: never part of what identifies an answer.
const FUNCTION_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "by",
  "from", "with", "as", "that", "this", "his", "her", "its", "their",
]);

// Nouns that classify an answer rather than identify it. "Battle of Gettysburg"
// is identified by *Gettysburg*, "Ming dynasty" by *Ming* — so these are dropped
// when they lead an "X of Y" phrase or trail the answer. A player who says only
// the classifier ("battle", "dynasty") has said nothing.
const HEAD_NOUNS = new Set([
  "battle", "war", "treaty", "siege", "raid", "expedition", "campaign", "crusade",
  "empire", "kingdom", "republic", "dynasty", "sultanate", "caliphate", "emirate",
  "duchy", "principality", "confederacy", "confederation", "federation", "union",
  "state", "city", "province", "region", "territory", "county", "dominion",
  "river", "lake", "sea", "ocean", "island", "mountain", "mount", "gulf", "bay",
  "act", "bill", "law", "code", "doctrine", "plan", "program", "project",
  "amendment", "resolution", "decree", "edict", "proclamation",
  "party", "council", "congress", "parliament", "assembly", "convention",
  "conference", "commission", "committee", "court", "order", "society",
  "association", "league", "alliance", "organization", "agency", "bureau",
  "department", "ministry", "company", "corporation", "university", "college",
  "school", "church", "temple", "cathedral", "palace", "castle", "fort",
  "fortress", "bridge", "canal", "railroad", "railway", "road", "trail",
  "line", "era", "period", "age", "house", "family", "system", "mission",
  "operation", "army", "navy", "tribe", "people",
  "festival", "trial", "prize", "award", "medal", "memorial", "monument",
  "museum", "tower", "station", "hall", "square", "park", "street", "avenue",
  "tragedy", "comedy", "gospel", "book", "speech", "address",
]);

// "Gideon v. Wainwright" — naming either party identifies the case.
const COURT_CASE_RE = /\S\s+v(?:s?\.|s\b|\.)\s+\S/i;

// "Suleyman the Magnificent", "Alfred the Great" — the name alone is the
// person; the epithet is not. Both words must be capitalised, so ordinary
// phrases like "Battle of the Bulge" don't qualify.
const EPITHET_RE = /^([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*)?)\s+the\s+[A-Z][\w'’-]*$/;

// Lowercase particles that can sit inside a personal name.
const NAME_PARTICLES = new Set([
  "de", "del", "della", "der", "den", "des", "di", "da", "du", "van", "von",
  "la", "le", "el", "al", "bin", "ibn", "y", "ter",
]);

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

// Honorifics a player may add or leave off freely.
const TITLES = new Set([
  "president", "king", "queen", "emperor", "empress", "tsar", "czar", "sultan",
  "pope", "prince", "princess", "duke", "duchess", "lord", "sir", "saint",
  "general", "captain", "colonel", "admiral", "chancellor", "senator",
  "governor", "doctor", "professor", "mister", "mrs", "miss",
]);

// Ordinary English words that also read as valid Roman numerals. Without this
// "civil" would parse as 143 and "mix" as 1009. A lone "i" is left off the list
// on purpose — it is the regnal number in "Elizabeth I".
const ROMAN_LOOKALIKES = new Set([
  "mix", "mild", "mill", "mid", "did", "dim", "dill", "lid", "lil", "mimi",
  "civic", "civil", "id", "li", "dic", "vim", "mic",
]);

// Text that instructs the moderator instead of naming an answer. These clauses
// describe a judgement call we can't make ("accept equivalents", "prompt on
// partial answers"), so they must never become matchable answer text.
const META_RE =
  /\b(either|both|underlin|partial|descriptive|description|descriptions|equivalent|equivalents|word ?forms?|similar|other terms|anything|additional information|obvious|specific|responses|etc\.?|answers that|reasonable|any answer)\b/i;

// "accept either underlined portion" tells us the answer has two independently
// acceptable halves — the underlining itself is lost in the PDF text, but the
// permission it grants is not.
const EITHER_PART_RE = /\b(?:either|both)\b[^.;]*\b(?:underlin\w*|names?|portions?|parts?)\b/i;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

// Drop accents, including the ones the PDFs detach from their letter: 87 answer
// lines read "Ren´e Descartes" or "Napol´eon III", and treating that mark as a
// separator would split the name into "Ren" and "e".
function stripAccents(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[´`ˆ˜¨ˇ˚¸]/g, "");
}

// Lowercase, de-accent, and reduce punctuation. Separators become spaces so
// "Wade-Davis" and "Wade Davis" agree; apostrophes and periods vanish so
// "D.C." and "DC", "O'Brien" and "OBrien" agree. Ordinal suffixes are dropped
// so "11th" matches "11" and "Louis 14th" matches "Louis XIV".
function normalize(s: string): string {
  return stripAccents(s || "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:the|a|an)\s+/, "");
}

function tokensOf(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(" ") : [];
}

function squish(s: string): string {
  return normalize(s).replace(/ /g, "");
}

// ---------------------------------------------------------------------------
// Roman numerals and regnal numbers
// ---------------------------------------------------------------------------

const CANONICAL_ROMAN = /^m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;

function romanToArabic(s: string): number | null {
  if (!s || !CANONICAL_ROMAN.test(s)) return null;
  const map: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  const t = s.toLowerCase();
  let total = 0;
  let prev = 0;
  for (let k = t.length - 1; k >= 0; k--) {
    const val = map[t[k]];
    if (val < prev) total -= val;
    else {
      total += val;
      prev = val;
    }
  }
  return total > 0 ? total : null;
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
  fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19, twentieth: 20,
};

// The number an answer is distinguished by: "Louis XIV" -> 14, "World War II"
// -> 2. Requires a capitalised word followed by an UPPERCASE numeral, so "CIA"
// and "Washington, D.C." are not misread as regnal numbers.
// Regnal and war numerals are small; anything larger is an abbreviation being
// misread ("Washington, D.C." is not Washington 500).
const MAX_REGNAL = 30;

function requiredNumber(phrase: string): number | null {
  const clean = stripAccents(phrase);
  for (const m of clean.matchAll(/\b[A-Za-z]+\s+([IVXLCDM]{1,6})\b(?!\.)/g)) {
    const v = romanToArabic(m[1]);
    if (v && v <= MAX_REGNAL) return v;
  }
  // An ordinal that opens a name distinguishes it too: the First Sino-Japanese
  // War is not the Second. Requires the next word to be capitalised so ordinary
  // prose ("the first ten amendments") doesn't count.
  const o = clean.match(/\b(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)\s+[A-Z]/);
  if (o) return ORDINAL_WORDS[o[1].toLowerCase()];

  const d = clean.match(/\b[A-Za-z]{3,}\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/);
  return d ? parseInt(d[1], 10) : null;
}

// Every number the player said, in any notation.
function numbersIn(input: string): Set<number> {
  const set = new Set<number>();
  const norm = normalize(input);
  for (const m of norm.matchAll(/\b(\d{1,3})\b/g)) set.add(parseInt(m[1], 10));
  for (const tok of norm.split(" ")) {
    if (ROMAN_LOOKALIKES.has(tok)) continue;
    const v = romanToArabic(tok);
    if (v) set.add(v);
  }
  for (const [w, n] of Object.entries(ORDINAL_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(norm)) set.add(n);
  }
  return set;
}

// An UPPERCASE Roman numeral in the original text — a regnal number, not a word.
function isRegnalToken(raw: string): boolean {
  return /^[IVXLCDM]{1,6}$/.test(raw) && romanToArabic(raw) !== null;
}

// ---------------------------------------------------------------------------
// Fuzzy comparison
// ---------------------------------------------------------------------------

// How many typos to forgive in a string of a given length.
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

// Deliberately tight: "Iran" must not be close enough to "Iraq" to earn a
// second look, so a near miss has to be both short in absolute edits and small
// relative to the answer's length.
function isClose(a: string, b: string): boolean {
  if (!a || !b) return false;
  const d = distance(a, b);
  return d <= threshold(b.length) + 1 && d / b.length < 0.25;
}

// ---------------------------------------------------------------------------
// Parsing the answer line
// ---------------------------------------------------------------------------

type Parsed = {
  accept: string[];
  prompt: string[];
  reject: string[];
  eitherPart: boolean;
};

// A parenthetical is part of the answer, not an instruction, when it is a word
// or two with no directive in it: "Scopes (Monkey) Trial", "Nobel (Memorial)
// Prize". Both readings are then acceptable. Square brackets are excluded —
// the packets use those for pronunciation guides.
function isOptionalAside(text: string): boolean {
  if (/\b(?:accept|prompt|do not|read|mention|before|after|either|equivalent)\b/i.test(text)) {
    return false;
  }
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 3;
}

// Strip the wreckage the PDFs leave in an answer line: "<JB>" writer initials,
// "{I}" difficulty tags, a trailing "Page 2" footer, and the packet running
// head that sometimes runs on past the answer ("... 2015 National History Bowl
// High School Championships Round 1").
function stripArtefacts(line: string): string {
  return (line || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s*Page\s+\d+\s*$/i, "")
    .replace(/\s*\b\d{4}\b[^\]).]*?History\s+(?:Bowl|Bee)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Split a line into the answer itself and its bracketed annotations, tracking
// nesting so "prompt on (George) Bush" survives intact. Returns the answer both
// without its asides ("Scopes Trial") and with them ("Scopes Monkey Trial").
function splitAnnotations(line: string): { head: string; headInlined: string; groups: string[] } {
  const cleaned = stripArtefacts(line);

  const groups: string[] = [];
  let head = "";
  let headInlined = "";
  let tail = "";
  let cur = "";
  let depth = 0;
  let seenGroup = false;
  let square = false;

  for (const ch of cleaned) {
    if (ch === "(" || ch === "[") {
      if (depth === 0) square = ch === "[";
      else cur += " ";
      depth++;
    } else if ((ch === ")" || ch === "]") && depth > 0) {
      depth--;
      if (depth === 0) {
        groups.push(cur);
        if (!square && isOptionalAside(cur)) headInlined += cur;
        cur = "";
        seenGroup = true;
        tail = "";
      } else cur += " ";
    } else if (depth > 0) {
      cur += ch;
    } else {
      head += ch;
      headInlined += ch;
      tail += ch;
    }
  }
  if (depth > 0 && cur.trim()) groups.push(cur);

  // Text after the last annotation is an artefact if it is only digits — the
  // stray subscript in "ammonia (accept NH before mentioned) 3".
  if (seenGroup && tail.trim() && /^[\s\d]+$/.test(tail)) {
    head = head.slice(0, head.length - tail.length);
    headInlined = headInlined.slice(0, headInlined.length - tail.length);
  }
  return { head: head.trim(), headInlined: headInlined.trim(), groups };
}

// The answer itself needs only tidying. Quotes are left alone here: they mark a
// nickname ("James \"Jimmy\" Stewart"), not an instruction.
function cleanHead(t: string): string {
  return t.replace(/^\s*(?:the word\s+)/i, "").replace(/[,;:.\s]+$/, "").trim();
}

// "prompt on Adams before mentioned" -> "Adams"; a quoted token wins outright.
function cleanClause(t: string): string {
  const q = t.match(/["“]([^"”]+)["”]/);
  if (q) return q[1].trim();
  return t
    .replace(/\s*\b(?:before|after|until|unless|if|when|because|since|but)\b.*$/i, "")
    .replace(/^\s*(?:just|only|any|all|the word|a mention of|mentions? of)\s+/i, "")
    .replace(/[,;:.]+\s*$/, "")
    .trim();
}

// One clause can name several alternatives: `"Asian" or "Asian-American"`.
function alternatives(payload: string): string[] {
  return payload
    .split(/,?\s+or\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

// A prompt clause may point at a description rather than a name ("prompt on
// descriptions of the Soviet army"). Keep what it points at — over-generous
// prompting costs nothing, it only buys the player another try.
function unwrapDescription(s: string): string {
  const m = s.match(
    /^(?:descriptions?|descriptive answers?|equivalents?|any equivalents?|answers?)\s+(?:of|to|for|mentioning)\s+(.+)$/i
  );
  return m ? m[1] : s;
}

function parseAnswerLine(line: string): Parsed {
  const { head, headInlined, groups } = splitAnnotations(line);
  const accept: string[] = [];
  const prompt: string[] = [];
  const reject: string[] = [];
  let eitherPart = false;

  // The head is the answer, but may carry a trailing directive of its own when
  // the packet omitted the brackets ("... , or AIM; do not accept").
  const headParts = head.split(/;/);
  for (const alt of alternatives(headParts[0])) {
    const c = cleanHead(alt);
    if (c) accept.push(c);
  }
  for (const a of [...accept]) {
    const ep = a.match(EPITHET_RE);
    if (ep && !accept.includes(ep[1])) accept.push(ep[1]);
  }
  if (headInlined && headInlined !== head) {
    for (const alt of alternatives(headInlined.split(/;/)[0])) {
      const c = cleanHead(alt);
      if (c && !accept.includes(c)) accept.push(c);
    }
  }

  const clauses: string[] = [...headParts.slice(1)];
  for (const group of groups) {
    if (EITHER_PART_RE.test(group)) eitherPart = true;
    // Split on semicolons, and on commas that introduce a new directive.
    for (const piece of group.split(/;/)) {
      clauses.push(...piece.split(/,\s*(?=(?:do\s*not|accept|prompt|anti-prompt|also)\b)/i));
    }
  }

  for (const raw of clauses) {
    const c = raw.trim();
    if (!c) continue;

    let m: RegExpMatchArray | null;
    if ((m = c.match(/^do\s*not\s+(?:accept|prompt)\s*(?:or\s+prompt)?\s*(?:on|with)?\s*(.*)$/i))) {
      // A negative we can't enumerate ("do not accept other terms") is dropped.
      for (const alt of alternatives(m[1])) {
        if (META_RE.test(alt)) continue;
        const t = cleanClause(alt);
        if (t) reject.push(t);
      }
    } else if ((m = c.match(/^(?:anti-)?prompt\s*(?:on|with)?\s+(.+)$/i))) {
      for (const alt of alternatives(m[1])) {
        const t = cleanClause(unwrapDescription(alt.trim()));
        if (t && !META_RE.test(t)) prompt.push(t);
      }
    } else if ((m = c.match(/^(?:or|accept|also\s+accept)\s+(.+)$/i))) {
      for (const alt of alternatives(m[1])) {
        if (META_RE.test(alt)) continue;
        const t = cleanClause(alt);
        if (t) accept.push(t);
      }
    }
    // Anything else (pronunciation guides, prose asides) is not answer text.
  }

  return {
    accept: accept.filter(Boolean),
    prompt: prompt.filter(Boolean),
    reject: reject.filter(Boolean),
    eitherPart,
  };
}

// ---------------------------------------------------------------------------
// How much of an answer counts
// ---------------------------------------------------------------------------

// Every word of a phrase that carries meaning. Used for the writer's explicit
// lists, where the literal wording is the point: "do not accept Mississippi
// State" must not veto "University of Mississippi", so "State" is kept.
function contentTokens(phrase: string): string[] {
  return tokensOf(phrase).filter((t) => t.length >= 2 && !FUNCTION_WORDS.has(t));
}

// The words a player actually has to say. Drops glue words, the regnal numeral
// (handled separately), a leading classifier in "Battle of X", and a trailing
// classifier in "Ming dynasty".
function coreTokens(phrase: string): string[] {
  const raw = stripAccents(phrase).split(/[\s,]+/).filter(Boolean);
  let toks = raw
    .filter((r) => !isRegnalToken(r))
    .flatMap((r) => tokensOf(r))
    .filter((t) => t.length >= 2 && !FUNCTION_WORDS.has(t));

  // "Battle of Gettysburg" is identified by Gettysburg, "Nobel Prize in
  // Economics" by Nobel and Economics. The classifier is never what a player
  // has to produce — but if that's all there is, keep it.
  const named = toks.filter((t) => !HEAD_NOUNS.has(t));
  if (named.length > 0) toks = named;

  // A year dates the answer rather than naming it — nobody has to say "of 1864".
  const dated = toks.filter((t) => !/^(1[0-9]|20)\d{2}$/.test(t));
  if (dated.length > 0) toks = dated;

  if (toks.length === 0) toks = tokensOf(phrase).filter((t) => t.length >= 2);
  return toks;
}

// Does a phrase read as a person's name? Two to five capitalised words, no
// classifier nouns — so "Mustafa Kemal Ataturk" qualifies but "Boston Massacre"
// and "Wade-Davis Bill of 1864" do not.
function personNameParts(phrase: string): string[] | null {
  const words = stripAccents(phrase.trim()).split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return null;

  const parts: string[] = [];
  for (let i = 0; i < words.length; i++) {
    // A quoted nickname is still part of the name: James "Jimmy" Stewart.
    const bare = words[i].replace(/[.,"“”']/g, "");
    if (!bare) continue;
    const lower = bare.toLowerCase();
    if (i === words.length - 1 && NAME_SUFFIXES.has(lower) && parts.length >= 2) continue;
    if (NAME_PARTICLES.has(lower)) continue;
    if (HEAD_NOUNS.has(lower)) return null;
    if (!/^[A-Z][A-Za-z'’-]*$/.test(bare)) return null;
    parts.push(lower);
  }
  return parts.length >= 2 ? parts : null;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

type Said = { norm: string; tokens: string[]; squished: string };

function saidBy(input: string): Said {
  return { norm: normalize(input), tokens: tokensOf(input), squished: squish(input) };
}

// Did the player say this word? Allows typos, and allows it to be run together
// with its neighbours ("WadeDavis" contains "wade" and "davis").
function saidWord(said: Said, word: string): boolean {
  if (said.tokens.some((t) => fuzzyEqual(t, word))) return true;
  return word.length >= 4 && said.squished.includes(word);
}

function matchedCount(said: Said, core: string[]): number {
  return core.filter((w) => saidWord(said, w)).length;
}

// A long descriptive answer doesn't need to be recited word for word.
function requiredMatches(n: number): number {
  return n <= 2 ? n : Math.ceil(n * 0.6);
}

// Words the player added that aren't in the answer at all. Saying "Republic of
// Malta" when the answer is "The Republic" is not a wordier way of being right,
// it is a different answer — but titles, classifiers and numbers are free.
function extraWords(said: Said, phrase: string): string[] {
  const known = contentTokens(phrase);
  return said.tokens.filter(
    (t) =>
      t.length >= 3 &&
      !/^\d+$/.test(t) &&
      !FUNCTION_WORDS.has(t) &&
      !HEAD_NOUNS.has(t) &&
      !TITLES.has(t) &&
      !(t in ORDINAL_WORDS) &&
      // Run-together typing counts as known either way round: "WadeDavis"
      // covers "wade", and "Coca" is covered by "cocacola".
      !known.some(
        (w) =>
          fuzzyEqual(t, w) ||
          (t.length >= 4 && w.includes(t)) ||
          (w.length >= 4 && t.includes(w))
      )
  );
}

export function judgeAnswer(input: string, answerLine: string): Verdict {
  const said = saidBy(input);
  if (!said.norm) return "incorrect";

  const parsed = parseAnswerLine(answerLine);
  const accept = parsed.accept.length ? parsed.accept : [answerLine];
  const saidNumbers = numbersIn(input);

  // 1. Said the whole answer. A numbered answer needs its number too, so a bare
  //    "Elizabeth" can't ride fuzzy distance into "Elizabeth I".
  for (const a of accept) {
    if (fuzzyEqual(said.norm, normalize(a))) {
      const num = requiredNumber(a);
      if (num === null || saidNumbers.has(num)) return "correct";
    }
  }

  // 2. The writer said not to take this. Checked after the exact match above so
  //    "do not accept George Walker Bush" can't veto "George Herbert Walker Bush".
  for (const r of parsed.reject) {
    const rTokens = contentTokens(r);
    if (fuzzyEqual(said.norm, normalize(r))) return "incorrect";
    if (rTokens.length > 0 && rTokens.every((w) => saidWord(said, w))) return "incorrect";
  }

  // 3. An explicit "prompt on X" outranks any partial-credit rule below — that
  //    flag is exactly how writers mark the answers that are too ambiguous.
  for (const p of parsed.prompt) {
    if (fuzzyEqual(said.norm, normalize(p))) return "prompt";
    const pTokens = contentTokens(p);
    if (pTokens.length > 0 && pTokens.every((w) => saidWord(said, w))) return "prompt";
  }

  // 4. Said enough of the answer.
  let partial = false;
  for (const a of accept) {
    const num = requiredNumber(a);
    const numberOk = num === null || saidNumbers.has(num);
    const core = coreTokens(a);
    if (core.length === 0) continue;

    const hits = matchedCount(said, core);
    if (hits === 0) continue;

    const nameParts = personNameParts(a);
    // A surname identifies a person; a given name alone does not.
    const surnameOnly = nameParts !== null && saidWord(said, nameParts[nameParts.length - 1]);
    const enough =
      hits >= requiredMatches(core.length) ||
      surnameOnly ||
      ((parsed.eitherPart || COURT_CASE_RE.test(a)) && hits >= 1);

    if (enough && numberOk && extraWords(said, a).length === 0) return "correct";
    partial = true; // right idea, but not enough of it — or missing the number
  }
  if (partial) return "prompt";

  // 5. A near miss on spelling gets one more try, nothing more.
  for (const a of accept) {
    if (isClose(said.norm, normalize(a))) return "prompt";
  }

  return "incorrect";
}

// Back-compat: a strict boolean check (used where a yes/no is all that's needed).
export function validateAnswer(input: string, answerLine: string): boolean {
  return judgeAnswer(input, answerLine) === "correct";
}

// For rounds that score on a single submission — Second Quarter bonuses and
// Third Quarter categories — where the player gets no chance to answer a
// prompt. A moderator would ask them to be more specific; since we can't, the
// benefit of the doubt goes to the player rather than silently marking a
// promptable answer wrong.
export function isAcceptable(input: string, answerLine: string): boolean {
  return judgeAnswer(input, answerLine) !== "incorrect";
}
