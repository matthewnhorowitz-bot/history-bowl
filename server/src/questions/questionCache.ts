import { Question, DifficultyFilter } from "../../../shared/types";
import { QUESTION_POOL_SIZE } from "../../../shared/constants";
import { filterByDifficulty } from "../../../shared/difficulty";
import { isReadable } from "./dataQuality";
import iacQuestions from "./iacQuestions.json";

// Skip any tossup whose text lost its spaces during parsing (none today, but
// this guards against future/edge malformed data — see dataQuality.ts).
const ALL: Question[] = (iacQuestions as Question[])
  .filter((q) => isReadable(q.questionText))
  .map((q) => ({
    ...q,
    words: q.questionText.split(" ").filter(Boolean),
  }));

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Serve a fresh shuffled pool of real IAC tossups for each game, restricted to
// packets matching the chosen difficulty (null = any).
export async function getInitialPool(difficulty: DifficultyFilter = null): Promise<Question[]> {
  return shuffle(filterByDifficulty(ALL, difficulty)).slice(0, QUESTION_POOL_SIZE);
}

// When a room's pool runs low, top it up with more shuffled questions of the same
// difficulty, excluding ones already queued.
export async function maybeRefetch(pool: Question[], difficulty: DifficultyFilter = null): Promise<Question[]> {
  if (pool.length >= 5) return pool;
  const have = new Set(pool.map((q) => q.id));
  const more = shuffle(filterByDifficulty(ALL, difficulty).filter((q) => !have.has(q.id))).slice(0, QUESTION_POOL_SIZE);
  return [...pool, ...more];
}

export function totalQuestions(): number {
  return ALL.length;
}
