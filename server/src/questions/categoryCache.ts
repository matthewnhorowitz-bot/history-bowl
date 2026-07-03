import { CategoryTrio } from "../../../shared/types";
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

// A shuffled "deck" so every trio is served once before any repeats, instead of
// picking uniformly with replacement (which let the same set recur immediately).
let deck: CategoryTrio[] = [];
let lastServed: CategoryTrio | null = null;

export function getRandomTrio(): CategoryTrio {
  if (deck.length === 0) {
    deck = shuffle(ALL);
    // Seam guard: don't repeat the trio we just served across the reshuffle.
    if (deck.length > 1 && deck[deck.length - 1] === lastServed) {
      [deck[deck.length - 1], deck[0]] = [deck[0], deck[deck.length - 1]];
    }
  }
  const trio = deck.pop()!;
  lastServed = trio;
  return trio;
}

export function totalTrios(): number {
  return ALL.length;
}
