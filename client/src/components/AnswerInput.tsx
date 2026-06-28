import { useEffect, useRef, useState } from "react";

interface Props {
  onSubmit: (answer: string) => void;
  timerRemaining: number;
  maxSeconds?: number;
}

export default function AnswerInput({ onSubmit, timerRemaining, maxSeconds = 5 }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit() {
    onSubmit(value.trim());
  }

  const pct = Math.max(0, Math.min(1, timerRemaining / maxSeconds));
  const barColor = timerRemaining <= 1 ? "var(--danger)" : timerRemaining <= 2 ? "#e09a30" : "var(--power)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Timer bar */}
      <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct * 100}%`,
          background: barColor,
          transition: "width 0.9s linear, background 0.3s",
        }} />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontVariantNumeric: "tabular-nums", color: barColor, fontWeight: 700, minWidth: 18, fontSize: "0.95rem" }}>
          {timerRemaining}
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder="Type your answer…"
          style={{ flex: 1 }}
        />
        <button className="btn-primary" onClick={handleSubmit} style={{ whiteSpace: "nowrap", padding: "10px 18px" }}>
          Submit
        </button>
      </div>
    </div>
  );
}
