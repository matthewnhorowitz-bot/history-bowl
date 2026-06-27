import { Question } from "../../../shared/types";
import { QUESTION_POOL_SIZE } from "../../../shared/constants";
import iacQuestions from "./iacQuestions.json";

const ALL: Question[] = (iacQuestions as Question[]).map((q) => ({
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

// Serve a fresh shuffled pool of real IAC tossups for each game.
export async function getInitialPool(): Promise<Question[]> {
  return shuffle(ALL).slice(0, QUESTION_POOL_SIZE);
}

// When a room's pool runs low, top it up with more shuffled questions,
// excluding ones already queued.
export async function maybeRefetch(pool: Question[]): Promise<Question[]> {
  if (pool.length >= 5) return pool;
  const have = new Set(pool.map((q) => q.id));
  const more = shuffle(ALL.filter((q) => !have.has(q.id))).slice(0, QUESTION_POOL_SIZE);
  return [...pool, ...more];
}

export function totalQuestions(): number {
  return ALL.length;
}
