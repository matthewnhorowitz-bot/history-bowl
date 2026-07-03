interface Props {
  quarter: number;
  name: string;
}

const HINTS: Record<number, string> = {
  1: "First to buzz scores +10. A wrong answer locks out your whole team for the question.",
  2: "Buzz for +10, then the team that got it right gets a bonus question (+10).",
  3: "Category round — 10s per question. Miss it and it bounces to the other team.",
  4: "Graduated scoring: buzz early for 30, in the middle for 20, late for 10.",
};

export default function QuarterBanner({ quarter, name }: Props) {
  if (!quarter) return null;
  return (
    <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent)", background: "var(--accent-dim)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ color: "var(--accent)", fontWeight: 800, fontSize: "1.05rem" }}>{name}</span>
        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Quarter {quarter} of 4</span>
      </div>
      <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: 4 }}>{HINTS[quarter]}</p>
    </div>
  );
}
