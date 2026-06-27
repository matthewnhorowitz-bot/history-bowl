interface Props {
  words: string[];
  isPastPowerMark: boolean;
}

export default function QuestionDisplay({ words, isPastPowerMark }: Props) {
  if (words.length === 0) return null;

  return (
    <div style={{
      fontSize: "1.15rem",
      lineHeight: 1.75,
      color: "var(--text)",
      padding: "24px 0",
      minHeight: 120,
    }}>
      {isPastPowerMark && (
        <span style={{
          display: "inline-block",
          fontSize: "0.65rem",
          background: "var(--power)",
          color: "#0f1117",
          fontWeight: 700,
          padding: "2px 7px",
          borderRadius: 4,
          marginRight: 8,
          verticalAlign: "middle",
          letterSpacing: "0.06em",
        }}>
          POWER MARK PASSED
        </span>
      )}
      {words.join(" ")}
      <span style={{ display: "inline-block", width: 2, height: "1em", background: "var(--accent)", marginLeft: 4, verticalAlign: "middle", animation: "blink 1s step-end infinite" }} />
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
