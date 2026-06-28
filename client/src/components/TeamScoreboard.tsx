import { Team } from "@shared/types";

interface Props {
  teams: Team[];
  myTeamId: string | null;
}

export default function TeamScoreboard({ teams, myTeamId }: Props) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <h3 style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        Team Standings
      </h3>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((t, i) => {
          const mine = t.id === myTeamId;
          return (
            <li key={t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", minWidth: 18 }}>{i + 1}.</span>
              <span style={{ flex: 1, fontWeight: mine ? 700 : 400, color: mine ? "var(--text)" : "var(--text-dim)" }}>
                {t.name} {mine && <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>(you)</span>}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: "0.95rem" }}>
                {t.score}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
