import { QuestionEndPayload } from "@shared/types";

interface Props {
  data: QuestionEndPayload;
  isHost: boolean;
  onNext: () => void;
  questionNumber: number;
}

export default function QuestionEndOverlay({ data, isHost, onNext, questionNumber }: Props) {
  const { fullText, answerSanitized, answerRaw } = data;

  // Highlight power mark position in full text
  const renderFullText = () => {
    if (!fullText) return <em style={{ color: "var(--text-muted)" }}>Question complete</em>;
    const parts = fullText.split("(*)");
    if (parts.length === 1) return <>{fullText}</>;
    return (
      <>
        {parts[0]}
        <span style={{ color: "var(--power)", fontWeight: 700 }}> ★ </span>
        {parts.slice(1).join("(*)")}
      </>
    );
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, zIndex: 50,
    }}>
      <div className="card" style={{ maxWidth: 640, width: "100%", padding: 32 }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Question {questionNumber} — End
        </p>

        <div style={{
          fontSize: "0.95rem", lineHeight: 1.7, color: "var(--text-dim)",
          marginBottom: 20, maxHeight: 200, overflowY: "auto",
          borderLeft: "3px solid var(--border)", paddingLeft: 14,
        }}>
          {renderFullText()}
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Answer
          </p>
          <p style={{ fontSize: "1.4rem", color: "var(--accent)", fontWeight: 700 }}>
            {answerSanitized}
          </p>
          {answerRaw !== answerSanitized && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}
               dangerouslySetInnerHTML={{ __html: answerRaw }} />
          )}
        </div>

        {isHost ? (
          <button className="btn-primary" onClick={onNext} style={{ width: "100%" }}>
            Next Question →
          </button>
        ) : (
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Waiting for host to start next question…
          </p>
        )}
      </div>
    </div>
  );
}
