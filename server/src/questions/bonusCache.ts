import { Q2Pair, DifficultyFilter } from "../../../shared/types";
import { filterByDifficulty } from "../../../shared/difficulty";
import { isReadable } from "./dataQuality";
import bonuses from "./iacBonuses.json";

// Drop pairs whose tossup or bonus text lost its spaces during PDF parsing
// (~75 of these) so an unreadable question never reaches a player.
const ALL: Q2Pair[] = (bonuses as Q2Pair[]).filter((p) => isReadable(p.tossup, p.bonus));

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A fresh shuffled batch of real Second Quarter tossup+bonus pairs, restricted to
// packets matching the chosen difficulty (null = any).
export function getQ2Pool(n: number, difficulty: DifficultyFilter = null): Q2Pair[] {
  return shuffle(filterByDifficulty(ALL, difficulty)).slice(0, n);
}

export function totalBonuses(): number {
  return ALL.length;
}
