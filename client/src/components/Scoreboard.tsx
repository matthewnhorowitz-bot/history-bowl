import { Player } from "@shared/types";

interface Props {
  players: Player[];
  myId: string;
  lastDelta?: { playerId: string; delta: number } | null;
}

export default function Scoreboard({ players, myId, lastDelta }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <h3 style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        Scoreboard
      </h3>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((p, i) => {
          const showDelta = lastDelta?.playerId === p.id;
          const delta = lastDelta?.delta ?? 0;
          return (
            <li key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", minWidth: 18 }}>{i + 1}.</span>
              <span style={{ flex: 1, fontWeight: p.id === myId ? 700 : 400, color: p.id === myId ? "var(--text)" : "var(--text-dim)" }}>
                {p.name} {p.id === myId && <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>(you)</span>}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: "0.95rem" }}>
                {p.score}
              </span>
              {showDelta && (
                <span style={{
                  fontSize: "0.75rem", fontWeight: 700,
                  color: delta > 0 ? "var(--power)" : "var(--danger)",
                  minWidth: 32, textAlign: "right",
                }}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
