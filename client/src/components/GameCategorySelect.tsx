import { useState } from "react";

interface Props {
  titles: string[];
  firstPickerName: string;
  isHost: boolean;
  onChoose: (indices: number[]) => void;
}

// Ordered pick: the first selected category belongs to the losing team
// (firstPicker), the second to the other team.
export default function GameCategorySelect({ titles, firstPickerName, isHost, onChoose }: Props) {
  const [picked, setPicked] = useState<number[]>([]);

  function toggle(i: number) {
    setPicked((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= 2) return prev;
      return [...prev, i];
    });
  }

  const ordinal = (i: number) => (picked[0] === i ? `1st · ${firstPickerName}` : picked[1] === i ? "2nd · other team" : "");

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 16 }}>
      <h2 style={{ color: "var(--accent)", marginBottom: 8 }}>Third Quarter — Categories</h2>
      <p style={{ color: "var(--text-dim)", marginBottom: 6, fontSize: "0.9rem" }}>
        The losing team (<strong style={{ color: "var(--text)" }}>{firstPickerName}</strong>) picks first.
      </p>
      <p style={{ color: "var(--text-muted)", marginBottom: 22, fontSize: "0.82rem" }}>
        {isHost ? "Pick the losing team's category first, then the other team's." : "The host is choosing the two categories…"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
        {titles.map((t, i) => {
          const sel = picked.includes(i);
          return (
            <button
              key={i}
              disabled={!isHost}
              onClick={() => toggle(i)}
              className="card"
              style={{
                textAlign: "left", padding: "16px 20px", fontSize: "1.05rem", fontWeight: 600,
                cursor: isHost ? "pointer" : "default",
                border: `2px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                background: sel ? "var(--accent-dim)" : "var(--bg-card)",
                color: sel ? "var(--accent)" : "var(--text)",
              }}
            >
              <span style={{ opacity: 0.6, marginRight: 10 }}>{i + 1}.</span>{t}
              {sel && <span style={{ float: "right", color: "var(--accent)", fontSize: "0.8rem" }}>{ordinal(i)} ✓</span>}
            </button>
          );
        })}
      </div>

      {isHost && (
        <button
          className="btn-primary"
          disabled={picked.length !== 2}
          onClick={() => onChoose(picked)}
          style={{ width: "100%", padding: 16 }}
        >
          {picked.length === 2 ? "Start Categories →" : `Select ${2 - picked.length} more`}
        </button>
      )}
    </div>
  );
}
