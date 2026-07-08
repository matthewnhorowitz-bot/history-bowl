// Packet-derived difficulty. A question/bonus/category's difficulty is decided
// by the packet (set) it was pulled from:
//   • Regional (non-Nationals) packets            → EASY
//   • Nationals preliminary rounds 1–5            → MEDIUM
//   • Nationals rounds 6+, playoffs, finals, etc. → HARD
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

// A difficulty selection made in the lobby. `null` means "any" (no filtering).
export type DifficultyFilter = Difficulty | null;

export function packetDifficulty(setName: string): Difficulty {
  const s = (setName || "").toLowerCase();
  if (!s.includes("national")) return "EASY";
  // Nationals: a plain numbered preliminary round 1–5 is Medium. Everything else
  // at Nationals — rounds 6+, playoffs, finals, semis, tiebreakers — is Hard.
  const m = s.match(/round\s+(\d+)/);
  if (m && !s.includes("playoff") && Number(m[1]) <= 5) return "MEDIUM";
  return "HARD";
}

export function matchesDifficulty(setName: string, filter: DifficultyFilter): boolean {
  return filter === null || packetDifficulty(setName) === filter;
}

// Filter a list of set-bearing items by the chosen difficulty. Falls back to the
// full list when the filter would leave nothing playable, so a game can always
// start even for a thinly-populated tier.
export function filterByDifficulty<T extends { setName: string }>(items: T[], filter: DifficultyFilter): T[] {
  if (filter === null) return items;
  const kept = items.filter((it) => packetDifficulty(it.setName) === filter);
  return kept.length > 0 ? kept : items;
}
