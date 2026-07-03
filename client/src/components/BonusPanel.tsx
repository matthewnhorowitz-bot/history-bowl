import { BonusQuestionPayload } from "@shared/types";
import { GAME_BONUS_TIMER_S } from "@shared/constants";
import AnswerInput from "./AnswerInput";

interface Props {
  bonus: BonusQuestionPayload;
  myTeamId: string | null;
  answered: boolean;
  timerRemaining: number;
  onSubmit: (answer: string) => void;
}

export default function BonusPanel({ bonus, myTeamId, answered, timerRemaining, onSubmit }: Props) {
  const mine = myTeamId === bonus.teamId;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ color: "var(--accent)", fontSize: "1.1rem" }}>Bonus Question (+10)</h2>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
          for <strong style={{ color: "var(--text)" }}>{bonus.teamName}</strong>
        </span>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16, fontSize: "1.1rem", lineHeight: 1.6 }}>
        {bonus.text}
      </div>

      {mine ? (
        answered ? (
          <p style={{ textAlign: "center", color: "var(--text-dim)", padding: 12 }}>
            Answer locked in — waiting for the result…
          </p>
        ) : (
          <div className="card" style={{ borderColor: "var(--accent)" }}>
            <p style={{ color: "var(--accent)", fontWeight: 700, marginBottom: 12, fontSize: "0.9rem" }}>
              Your team's bonus — type an answer!
            </p>
            <AnswerInput onSubmit={onSubmit} timerRemaining={timerRemaining} maxSeconds={GAME_BONUS_TIMER_S} />
          </div>
        )
      ) : (
        <p style={{ textAlign: "center", color: "var(--text-dim)", padding: 12 }}>
          <strong style={{ color: "var(--text)" }}>{bonus.teamName}</strong> is answering the bonus…
        </p>
      )}
    </div>
  );
}
