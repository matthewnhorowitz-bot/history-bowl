import { CategoryTrio, DifficultyFilter } from "../../../shared/types";
import { filterByDifficulty } from "../../../shared/difficulty";
import { isReadable } from "./dataQuality";
import trios from "./iacCategories.json";

// Skip any trio containing text that lost its spaces during parsing (none today,
// but this guards against future/edge malformed data — see dataQuality.ts).
const ALL: CategoryTrio[] = (trios as CategoryTrio[]).filter((t) =>
  t.categories.every((c) => isReadable(c.intro, ...c.questions.flatMap((q) => [q.clue, q.answer])))
);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A shuffled "deck" per (channel, difficulty) so every trio is served once before
// any repeats — instead of picking with replacement, which let the same set recur
// immediately. Separate channels keep the standalone Category Round and the
// Actual-Game Third Quarter from consuming each other's sequence.
interface Deck { cards: CategoryTrio[]; recent: CategoryTrio[]; }
const decks = new Map<string, Deck>();

// How many recently-served trios to keep away from the top of a fresh shuffle, so
// a set can't reappear right across the reshuffle seam. Capped below pool size.
const RECENT_WINDOW = 20;

export function getRandomTrio(difficulty: DifficultyFilter = null, channel = "default"): CategoryTrio {
  const key = `${channel}|${difficulty ?? "ANY"}`;
  let deck = decks.get(key);
  if (!deck) { deck = { cards: [], recent: [] }; decks.set(key, deck); }

  if (deck.cards.length === 0) {
    const pool = filterByDifficulty(ALL, difficulty);
    deck.cards = shuffle(pool);
    // Seam guard: push any recently-served trios toward the front of the deck
    // (served last, since we pop() from the end) so they aren't served again until
    // the rest of the window has cycled through. The stable sort preserves the
    // shuffled order within each group.
    const window = Math.min(deck.recent.length, Math.max(0, pool.length - 1));
    if (window > 0) {
      const avoid = new Set(deck.recent.slice(-window));
      deck.cards.sort((a, b) => Number(avoid.has(b)) - Number(avoid.has(a)));
    }
  }
  const trio = deck.cards.pop()!;
  deck.recent.push(trio);
  if (deck.recent.length > RECENT_WINDOW) deck.recent.shift();
  return trio;
}

export function totalTrios(): number {
  return ALL.length;
}
