import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Player, GameSnapshot } from "@shared/types";
import { useGame } from "../hooks/useGame";
import { useKeyboard } from "../hooks/useKeyboard";
import QuestionDisplay from "../components/QuestionDisplay";
import BuzzPanel from "../components/BuzzPanel";
import Scoreboard from "../components/Scoreboard";
import QuestionEndOverlay from "../components/QuestionEndOverlay";

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

  return (
    <div style={{ minHeight: "100vh", display: "flex", gap: 24, padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      {/* Main column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
      <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
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
