import { GameCatQuestionPayload, GameCatRevealPayload, Team } from "@shared/types";
import { GAME_CAT_TIMER_S } from "@shared/constants";
import AnswerInput from "./AnswerInput";

interface Props {
  q: GameCatQuestionPayload;
  reveal: GameCatRevealPayload | null;
  timerRemaining: number;
  answered: boolean;
  myTeamId: string | null;
  teams: Team[];
  onSubmit: (answer: string) => void;
}

export default function GameCategory({ q, reveal, timerRemaining, answered, myTeamId, teams, onSubmit }: Props) {
  const showingReveal = reveal !== null && reveal.questionIndex === q.questionIndex;
  const canAnswer = !showingReveal && !answered && myTeamId === q.ownerTeamId;
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "—";
  const iGotIt = showingReveal && reveal!.correctTeamId != null && reveal!.correctTeamId === myTeamId;

  return (
    <div style={{ maxWidth: 660, margin: "0 auto", paddingTop: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <h2 style={{ color: "var(--accent)", fontSize: "1.2rem", minWidth: 0, overflowWrap: "break-word" }}>{q.categoryTitle}</h2>
        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
          Category {q.catNumber}/2 · Question {q.indexInCat}/8 · ({q.questionIndex + 1}/{q.total})
        </span>
      </div>

      {/* Whose question / bounceback indicator */}
      <div style={{
        display: "inline-block", marginBottom: 12, padding: "3px 10px", borderRadius: 999,
        fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.03em",
        background: q.bounce ? "rgba(224,133,85,0.15)" : "var(--accent-dim)",
        color: q.bounce ? "#e08555" : "var(--accent)",
        border: `1px solid ${q.bounce ? "#e08555" : "var(--accent)"}`,
      }}>
        {q.bounce ? `↩ BOUNCEBACK → ${q.ownerName}` : `${q.ownerName}'s question`}
      </div>

      {q.intro && <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: 14, fontStyle: "italic" }}>{q.intro}</p>}

      <div className="card" style={{ padding: 24, marginBottom: 16, fontSize: "1.15rem", lineHeight: 1.6, minHeight: 90 }}>
        {q.clue}
      </div>

      {showingReveal ? (
        <div style={{
          padding: "14px 18px", borderRadius: "var(--radius)",
          background: reveal!.correctTeamId ? "rgba(76,175,125,0.15)" : "rgba(224,85,85,0.12)",
          border: `1px solid ${reveal!.correctTeamId ? "var(--power)" : "var(--danger)"}`,
        }}>
          <span style={{ fontWeight: 700, color: reveal!.correctTeamId ? "var(--power)" : "var(--danger)" }}>
            {reveal!.correctTeamId ? `${iGotIt ? "✓ Your team" : teamName(reveal!.correctTeamId)} got it (+10)` : "No one got it"}
          </span>
          {" — "}
          <span style={{ color: "var(--text)" }}>{reveal!.answer}</span>
          {reveal!.sweepTeamId && (
            <div style={{ marginTop: 10, fontWeight: 700, color: "var(--power)" }}>
              🏆 {reveal!.sweepTeamId === myTeamId ? "Your team" : teamName(reveal!.sweepTeamId)} swept the category! +{reveal!.sweepBonus ?? 20}
            </div>
          )}
        </div>
      ) : canAnswer ? (
        <div className="card" style={{ borderColor: q.bounce ? "#e08555" : "var(--accent)" }}>
          <p style={{ color: q.bounce ? "#e08555" : "var(--accent)", fontWeight: 700, marginBottom: 12, fontSize: "0.9rem" }}>
            {q.bounce ? "Bounceback — your team's chance!" : "Your team's question — answer!"}
          </p>
          <AnswerInput key={`${q.questionIndex}-${q.bounce}`} onSubmit={onSubmit} timerRemaining={timerRemaining} maxSeconds={GAME_CAT_TIMER_S} />
        </div>
      ) : answered ? (
        <p style={{ textAlign: "center", color: "var(--text-dim)", padding: 12 }}>
          Answer locked in — waiting for the result…
        </p>
      ) : (
        <p style={{ textAlign: "center", color: "var(--text-dim)", padding: 12 }}>
          <strong style={{ color: "var(--text)" }}>{q.ownerName}</strong> is answering…
        </p>
      )}
    </div>
  );
}
