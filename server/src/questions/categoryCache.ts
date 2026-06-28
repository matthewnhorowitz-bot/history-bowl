import { CategoryTrio } from "../../../shared/types";
import trios from "./iacCategories.json";

const ALL: CategoryTrio[] = trios as CategoryTrio[];

export function getRandomTrio(): CategoryTrio {
  return ALL[Math.floor(Math.random() * ALL.length)];
}

export function totalTrios(): number {
  return ALL.length;
}
