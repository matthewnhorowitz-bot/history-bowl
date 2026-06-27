import { GameState } from "@shared/types";
import AnswerInput from "./AnswerInput";

interface Props {
  gameState: GameState;
  buzzStatus: { buzzedBy: { id: string; name: string }; timerSeconds: number } | null;
  myId: string;
  lockedOut: boolean;
  answerTimerRemaining: number;
  buzzWindowRemaining: number;
  onBuzz: () => void;
  onSubmitAnswer: (answer: string) => void;
}

export default function BuzzPanel({ gameState, buzzStatus, myId, lockedOut, answerTimerRemaining, buzzWindowRemaining, onBuzz, onSubmitAnswer }: Props) {
  const iAmBuzzed = buzzStatus?.buzzedBy.id === myId;

  if (gameState === "BETWEEN" || gameState === "LOBBY") return null;

  if (gameState === "ANSWER_PHASE") {
    if (iAmBuzzed) {
      return (
        <div className="card" style={{ borderColor: "var(--accent)", marginTop: 16 }}>
          <p style={{ color: "var(--accent)", fontWeight: 700, marginBottom: 12, fontSize: "0.9rem" }}>
            Your turn to answer!
          </p>
          <AnswerInput onSubmit={onSubmitAnswer} timerRemaining={answerTimerRemaining} />
        </div>
      );
    }
    return (
      <div className="card" style={{ marginTop: 16, textAlign: "center", color: "var(--text-dim)" }}>
        <span style={{ fontWeight: 600 }}>{buzzStatus?.buzzedBy.name}</span> is answering…
      </div>
    );
  }

  // READING state
  if (lockedOut) {
    return (
      <div style={{
        marginTop: 16, padding: "14px 20px",
        background: "var(--bg-card)", border: "1px solid var(--danger)",
        borderRadius: "var(--radius)", color: "var(--danger)", textAlign: "center", fontSize: "0.9rem",
      }}>
        Locked out this question
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      {buzzWindowRemaining > 0 && (
        <p style={{
          textAlign: "center",
          marginBottom: 8,
          fontSize: "0.85rem",
          fontWeight: 700,
          color: "var(--accent)",
          letterSpacing: "0.03em",
        }}>
          Buzz now! — {buzzWindowRemaining}s left
        </p>
      )}
      <button
        onClick={onBuzz}
        style={{
          width: "100%",
          padding: "18px",
          fontSize: "1.1rem",
          fontWeight: 700,
          background: "var(--accent)",
          color: "#0f1117",
          borderRadius: "var(--radius)",
          letterSpacing: "0.05em",
        }}
      >
        BUZZ IN  <span style={{ fontSize: "0.75rem", fontWeight: 400, opacity: 0.7 }}>or press Space</span>
      </button>
    </div>
  );
}
