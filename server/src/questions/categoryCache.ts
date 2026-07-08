import { CategoryTrio, DifficultyFilter } from "../../../shared/types";
import { filterByDifficulty } from "../../../shared/difficulty";
import trios from "./iacCategories.json";

const ALL: CategoryTrio[] = trios as CategoryTrio[];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A shuffled "deck" per difficulty so every trio is served once before any repeats
// (instead of picking with replacement, which let the same set recur immediately).
interface Deck { cards: CategoryTrio[]; lastServed: CategoryTrio | null; }
const decks = new Map<string, Deck>();

export function getRandomTrio(difficulty: DifficultyFilter = null): CategoryTrio {
  const key = difficulty ?? "ANY";
  let deck = decks.get(key);
  if (!deck) { deck = { cards: [], lastServed: null }; decks.set(key, deck); }

  if (deck.cards.length === 0) {
    deck.cards = shuffle(filterByDifficulty(ALL, difficulty));
    // Seam guard: don't repeat the trio we just served across the reshuffle.
    if (deck.cards.length > 1 && deck.cards[deck.cards.length - 1] === deck.lastServed) {
      const last = deck.cards.length - 1;
      [deck.cards[last], deck.cards[0]] = [deck.cards[0], deck.cards[last]];
    }
  }
  const trio = deck.cards.pop()!;
  deck.lastServed = trio;
  return trio;
}

export function totalTrios(): number {
  return ALL.length;
}
