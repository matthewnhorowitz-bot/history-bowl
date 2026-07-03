import { Q2Pair } from "../../../shared/types";
import bonuses from "./iacBonuses.json";

const ALL: Q2Pair[] = bonuses as Q2Pair[];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A fresh shuffled batch of real Second Quarter tossup+bonus pairs.
export function getQ2Pool(n: number): Q2Pair[] {
  return shuffle(ALL).slice(0, n);
}

export function totalBonuses(): number {
  return ALL.length;
}
