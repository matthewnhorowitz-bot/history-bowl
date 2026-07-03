import { Player, GameSnapshot } from "@shared/types";
import { useActualGame } from "../hooks/useActualGame";
import { useKeyboard } from "../hooks/useKeyboard";
import QuestionDisplay from "../components/QuestionDisplay";
import BuzzPanel from "../components/BuzzPanel";
import TeamScoreboard from "../components/TeamScoreboard";
import QuarterBanner from "../components/QuarterBanner";
import BonusPanel from "../components/BonusPanel";
import GameCategorySelect from "../components/GameCategorySelect";
import GameCategory from "../components/GameCategory";

interface Props {
  roomCode: string;
  myId: string;
  isHost: boolean;
  players: Player[];
  snapshot?: GameSnapshot;
}

export default function ActualGamePage({ roomCode, myId, isHost, players, snapshot }: Props) {
  const game = useActualGame(roomCode, myId, isHost, players, snapshot);

  const isBuzzQuarter = game.quarter === 1 || game.quarter === 2 || game.quarter === 4;
  const buzzing = isBuzzQuarter && (game.gameState === "READING" || game.gameState === "ANSWER_PHASE");

  useKeyboard(game.buzz, game.gameState === "READING" && isBuzzQuarter && !game.lockedOut);

  const teamName = (id: string | null) => game.teams.find((t) => t.id === id)?.name ?? "—";

  // Header progress text.
  const progress = isBuzzQuarter && game.questionCount
    ? `Q ${Math.min(game.questionIndex + 1, game.questionCount)}/${game.questionCount}`
    : "";

  return (
    <div className="game-layout" style={{ minHeight: "100vh", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: "1.1rem", color: "var(--accent)", fontWeight: 700 }}>
            History Bowl{game.quarterName ? ` · ${game.quarterName}` : ""}
          </h1>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {progress && <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{progress}</span>}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Room: <strong style={{ color: "var(--text)", letterSpacing: "0.15em" }}>{roomCode}</strong>
            </span>
          </div>
        </div>

        {!game.gameOver && game.quarter > 0 && game.gameState !== "GAME_END" && (
          <QuarterBanner quarter={game.quarter} name={game.quarterName} />
        )}

        {/* Answer result banner (buzz quarters + bonus; Q3 shows its own reveal) */}
        {game.lastResult && game.gameState !== "GAME_CAT_PLAYING" && game.gameState !== "GAME_CAT_SELECT" && (
          <ResultBanner
            correct={game.lastResult.correct}
            teamName={teamName(game.lastResult.teamId)}
            name={game.lastResult.buzzedBy.name}
            answer={game.lastResult.answer}
            delta={game.lastResult.delta}
            tier={game.lastResult.tier}
          />
        )}

        {/* GAME OVER */}
        {game.gameOver && (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <h2 style={{ color: "var(--accent)", marginBottom: 12, fontSize: "1.6rem" }}>Final Whistle!</h2>
            <p style={{ fontSize: "1.15rem", marginBottom: 8 }}>
              {game.winnerTeamId
                ? <>Winner: <strong style={{ color: "var(--power)" }}>{teamName(game.winnerTeamId)}</strong></>
                : "It's a tie!"}
            </p>
            <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>Final standings are on the right.</p>
          </div>
        )}

        {/* BUZZ QUARTERS (Q1/Q2/Q4) */}
        {buzzing && (
          <>
            <div className="card" style={{ flex: 1 }}>
              {game.revealedWords.length > 0
                ? <QuestionDisplay words={game.revealedWords} isPastPowerMark={game.isPastPowerMark} />
                : <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Reading question…</p>}
            </div>
            <BuzzPanel
              gameState={game.gameState}
              buzzStatus={game.buzzStatus}
              myId={game.myId}
              lockedOut={game.lockedOut}
              answerTimerRemaining={game.answerTimerRemaining}
              buzzWindowRemaining={game.buzzWindowRemaining}
              promptName={game.buzzStatus?.prompt ? game.buzzStatus.buzzedBy.name : null}
              promptCount={game.buzzStatus?.prompt ? 1 : 0}
              onBuzz={game.buzz}
              onSubmitAnswer={game.submitAnswer}
            />
          </>
        )}

        {/* Q2 BONUS */}
        {game.gameState === "GAME_BONUS" && game.bonus && (
          <BonusPanel
            bonus={game.bonus}
            myTeamId={game.myTeamId}
            answered={game.bonusAnswered}
            timerRemaining={game.answerTimerRemaining}
            onSubmit={game.submitAnswer}
          />
        )}

        {/* Q3 CATEGORY SELECT */}
        {game.gameState === "GAME_CAT_SELECT" && game.catChoices && (
          <GameCategorySelect
            titles={game.catChoices.titles}
            firstPickerName={game.catChoices.firstPickerName}
            isHost={game.isHost}
            onChoose={game.chooseCategories}
          />
        )}

        {/* Q3 CATEGORY PLAYING */}
        {game.gameState === "GAME_CAT_PLAYING" && game.catQuestion && (
          <GameCategory
            q={game.catQuestion}
            reveal={game.catReveal}
            timerRemaining={game.catTimerRemaining}
            answered={game.catAnswered}
            myTeamId={game.myTeamId}
            teams={game.teams}
            onSubmit={game.submitCategoryAnswer}
          />
        )}

        {/* BETWEEN — reveal + host advance */}
        {game.gameState === "BETWEEN" && game.questionEnd && (
          <div className="card" style={{ marginTop: 8, padding: 24 }}>
            {game.questionEnd.answer && (
              <p style={{ marginBottom: 8 }}>
                <span style={{ color: "var(--text-dim)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Answer</span><br />
                <strong style={{ color: "var(--power)", fontSize: "1.1rem" }}>{game.questionEnd.answer}</strong>
              </p>
            )}
            {game.questionEnd.fullText && (
              <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 16 }}>{game.questionEnd.fullText}</p>
            )}
            {game.isHost ? (
              <button className="btn-primary" onClick={game.nextQuestion} style={{ padding: "12px 24px" }}>
                {nextLabel(game.quarter, game.questionEnd.isLast)}
              </button>
            ) : (
              <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>Waiting for the host to continue…</p>
            )}
          </div>
        )}

        {game.error && <div className="error-toast">{game.error}</div>}
      </div>

      {/* Sidebar */}
      <div className="game-sidebar">
        <TeamScoreboard teams={game.teams} myTeamId={game.myTeamId} />
      </div>
    </div>
  );
}

function nextLabel(quarter: number, isLast: boolean): string {
  if (!isLast) return "Next Question →";
  if (quarter === 1) return "Start Second Quarter →";
  if (quarter === 2) return "Start Third Quarter →";
  if (quarter === 3) return "Start Fourth Quarter →";
  return "See Final Result →";
}

function ResultBanner({ correct, teamName, name, answer, delta, tier }: {
  correct: boolean; teamName: string; name: string; answer: string; delta: number; tier: number | null;
}) {
  return (
    <div style={{
      padding: "10px 16px", borderRadius: "var(--radius)", marginBottom: 12,
      background: correct ? "rgba(76,175,125,0.12)" : "rgba(224,85,85,0.12)",
      border: `1px solid ${correct ? "var(--power)" : "var(--danger)"}`,
      fontSize: "0.9rem",
    }}>
      <strong style={{ color: correct ? "var(--power)" : "var(--danger)" }}>
        {correct ? "Correct!" : "Incorrect"}
      </strong>
      {" — "}
      <span style={{ color: "var(--text-dim)" }}>
        {teamName}{name ? ` (${name})` : ""}
        {answer && ` answered "${answer}"`}
        {correct && tier != null && ` · ${tier}-point tier`}
        {delta > 0 ? ` +${delta}` : correct ? "" : " +0"}
      </span>
    </div>
  );
}
