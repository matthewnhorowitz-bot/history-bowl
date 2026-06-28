import { CategoryQuestionPayload, CategoryRevealPayload } from "@shared/types";
import { CATEGORY_TIMER_S } from "@shared/constants";
import AnswerInput from "./AnswerInput";

interface Props {
  q: CategoryQuestionPayload;
  reveal: CategoryRevealPayload | null;
  timerRemaining: number;
  answered: boolean;
  myId: string;
  teamPlay: boolean;
  myTeamId: string | null;
  onSubmit: (answer: string) => void;
}

export default function CategoryQuestion({ q, reveal, timerRemaining, answered, myId, teamPlay, myTeamId, onSubmit }: Props) {
  const showingReveal = reveal !== null && reveal.questionIndex === q.questionIndex;
  const myWinId = teamPlay ? myTeamId : myId;
  const iGotIt = showingReveal && myWinId !== null && reveal!.correctIds.includes(myWinId);
  const spectator = teamPlay && !myTeamId;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <h2 style={{ color: "var(--accent)", fontSize: "1.2rem" }}>{q.categoryTitle}</h2>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
          Category {q.catNumber}/2 · Question {q.indexInCat}/8 · ({q.questionIndex + 1}/{q.total})
        </span>
      </div>
      {q.intro && <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: 16, fontStyle: "italic" }}>{q.intro}</p>}

      <div className="card" style={{ padding: 24, marginBottom: 16, fontSize: "1.15rem", lineHeight: 1.6, minHeight: 90 }}>
        {q.clue}
      </div>

      {showingReveal ? (
        <div style={{
          padding: "14px 18px", borderRadius: "var(--radius)",
          background: iGotIt ? "rgba(76,175,125,0.15)" : "rgba(224,85,85,0.12)",
          border: `1px solid ${iGotIt ? "var(--power)" : "var(--danger)"}`,
        }}>
          <span style={{ fontWeight: 700, color: iGotIt ? "var(--power)" : "var(--danger)" }}>
            {iGotIt ? "✓ Correct (+10)" : "Answer"}
          </span>
          {" — "}
          <span style={{ color: "var(--text)" }}>{reveal!.answer}</span>
        </div>
      ) : spectator ? (
        <p style={{ textAlign: "center", color: "var(--text-dim)", padding: 14 }}>
          You're spectating — join a team in the lobby to play next round.
        </p>
      ) : answered ? (
        <p style={{ textAlign: "center", color: "var(--text-dim)", padding: 14 }}>
          {teamPlay ? "Your team's answer is locked in — waiting for the timer…" : "Answer locked in — waiting for the timer…"}
        </p>
      ) : (
        <AnswerInput key={q.questionIndex} onSubmit={onSubmit} timerRemaining={timerRemaining} maxSeconds={CATEGORY_TIMER_S} />
      )}
    </div>
  );
}
