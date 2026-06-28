import { useState } from "react";

interface Props {
  titles: string[];
  isHost: boolean;
  onChoose: (indices: number[]) => void;
}

export default function CategorySelect({ titles, isHost, onChoose }: Props) {
  const [picked, setPicked] = useState<number[]>([]);

  function toggle(i: number) {
    setPicked((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, i];
    });
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 24 }}>
      <h2 style={{ color: "var(--accent)", marginBottom: 8 }}>Third Quarter — Categories</h2>
      <p style={{ color: "var(--text-dim)", marginBottom: 24, fontSize: "0.9rem" }}>
        {isHost ? "Pick 2 of these 3 categories (8 questions each)." : "The host is choosing 2 categories…"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
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
              {sel && <span style={{ float: "right", color: "var(--accent)" }}>✓</span>}
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
