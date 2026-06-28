import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Player, GameSnapshot } from "@shared/types";
import { useGame } from "../hooks/useGame";
import { useKeyboard } from "../hooks/useKeyboard";
import QuestionDisplay from "../components/QuestionDisplay";
import BuzzPanel from "../components/BuzzPanel";
import Scoreboard from "../components/Scoreboard";
import TeamScoreboard from "../components/TeamScoreboard";
import QuestionEndOverlay from "../components/QuestionEndOverlay";
import CategorySelect from "../components/CategorySelect";
import CategoryQuestion from "../components/CategoryQuestion";

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { state } = useLocation() as { state: { myId: string; isHost: boolean; players: Player[]; snapshot?: GameSnapshot } };
  const navigate = useNavigate();

  useEffect(() => {
    if (!state || !roomCode) navigate("/");
  }, [state, roomCode, navigate]);

  const game = useGame(
    roomCode ?? "",
    state?.myId ?? "",
    state?.isHost ?? false,
    state?.players ?? [],
    state?.snapshot
  );

  useKeyboard(game.buzz, game.gameState === "READING" && !game.lockedOut);

  if (!state) return null;

  const lastDelta = game.lastResult
    ? { playerId: game.lastResult.buzzedBy.id, delta: game.lastResult.delta }
    : null;

  // ---- Category (Third Quarter) mode ----
  const isCategory =
    game.mode === "CATEGORY" ||
    game.gameState === "CATEGORY_SELECT" ||
    game.gameState === "CATEGORY_PLAYING";

  if (isCategory) {
    return (
      <div className="game-layout" style={{ minHeight: "100vh", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h1 style={{ fontSize: "1.1rem", color: "var(--accent)", fontWeight: 700 }}>History Bowl · Third Quarter</h1>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Room: <strong style={{ color: "var(--text)", letterSpacing: "0.15em" }}>{roomCode}</strong>
            </span>
          </div>

          {game.gameState === "CATEGORY_SELECT" && game.categoryChoices && (
            <CategorySelect titles={game.categoryChoices} isHost={game.isHost} onChoose={game.chooseCategories} />
          )}

          {game.gameState === "CATEGORY_PLAYING" && game.categoryQuestion && (
            <CategoryQuestion
              q={game.categoryQuestion}
              reveal={game.categoryReveal}
              timerRemaining={game.categoryTimerRemaining}
              answered={game.categoryAnswered}
              myId={game.myId}
              teamPlay={game.teamPlay}
              myTeamId={game.myTeamId}
              onSubmit={game.submitCategoryAnswer}
            />
          )}

          {game.categoryDone && (
            <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 32 }}>
              <h2 style={{ color: "var(--accent)", marginBottom: 12 }}>Round complete!</h2>
              <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>Final scores are on the right.</p>
              {game.isHost && (
                <button className="btn-primary" onClick={game.nextQuestion} style={{ padding: "12px 24px" }}>
                  New Categories →
                </button>
              )}
            </div>
          )}

          {game.error && <div className="error-toast">{game.error}</div>}
        </div>

        <div className="game-sidebar">
          {game.teamPlay
            ? <TeamScoreboard teams={game.teams} myTeamId={game.myTeamId} />
            : <Scoreboard players={game.players} myId={game.myId} lastDelta={null} />}
        </div>
      </div>
    );
  }

  return (
    <div className="game-layout" style={{ minHeight: "100vh", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: "1.1rem", color: "var(--accent)", fontWeight: 700 }}>History Bowl</h1>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Room: <strong style={{ color: "var(--text)", letterSpacing: "0.15em" }}>{roomCode}</strong>
            </span>
          </div>
        </div>

        {/* Answer result banner */}
        {game.lastResult && (
          <div style={{
            padding: "10px 16px",
            borderRadius: "var(--radius)",
            marginBottom: 12,
            background: game.lastResult.correct ? "rgba(76,175,125,0.12)" : "rgba(224,85,85,0.12)",
            border: `1px solid ${game.lastResult.correct ? "var(--power)" : "var(--danger)"}`,
            fontSize: "0.9rem",
          }}>
            <strong style={{ color: game.lastResult.correct ? "var(--power)" : "var(--danger)" }}>
              {game.lastResult.correct ? "Correct!" : "Incorrect"}
            </strong>
            {" — "}
            <span style={{ color: "var(--text-dim)" }}>
              {game.lastResult.buzzedBy.name}
              {game.lastResult.answer && ` answered "${game.lastResult.answer}"`}
              {game.lastResult.delta > 0 ? ` +${game.lastResult.delta}` : ` ${game.lastResult.delta}`}
            </span>
          </div>
        )}

        {/* Question area */}
        <div className="card" style={{ flex: 1 }}>
          {game.gameState === "LOBBY" && (
            <p style={{ color: "var(--text-muted)", textAlign: "center", paddingTop: 40 }}>Loading questions…</p>
          )}
          {game.revealedWords.length > 0 && (
            <QuestionDisplay words={game.revealedWords} isPastPowerMark={game.isPastPowerMark} />
          )}
          {game.revealedWords.length === 0 && game.gameState === "READING" && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Reading question…</p>
          )}
        </div>

        {/* Buzz / answer panel */}
        <BuzzPanel
          gameState={game.gameState}
          buzzStatus={game.buzzStatus}
          myId={game.myId}
          lockedOut={game.lockedOut}
          answerTimerRemaining={game.answerTimerRemaining}
          buzzWindowRemaining={game.buzzWindowRemaining}
          promptName={game.promptName}
          promptCount={game.promptCount}
          onBuzz={game.buzz}
          onSubmitAnswer={game.submitAnswer}
        />

        {game.error && <div className="error-toast">{game.error}</div>}
      </div>

      {/* Sidebar */}
      <div className="game-sidebar" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Scoreboard players={game.players} myId={game.myId} lastDelta={lastDelta} />
      </div>

      {/* End-of-question overlay */}
      {game.questionEnd && (
        <QuestionEndOverlay
          data={game.questionEnd}
          isHost={game.isHost}
          onNext={game.nextQuestion}
          questionNumber={game.questionNumber}
          lastResult={game.lastResult}
        />
      )}
    </div>
  );
}
