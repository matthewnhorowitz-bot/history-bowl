import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { Player, RoomMode, Team, DifficultyFilter, AiLevel, PlayerJoinedPayload, PlayerLeftPayload, GameStartedPayload, HostChangedPayload, ModeChangedPayload, DifficultyChangedPayload, CategoryChoicesPayload, TeamsUpdatedPayload, QuarterStartedPayload } from "@shared/types";
import * as E from "@shared/events";

export default function LobbyPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { state } = useLocation() as { state: { myId: string; isHost: boolean; players: Player[]; mode?: RoomMode; teams?: Team[]; difficulty?: DifficultyFilter; aiLevel?: AiLevel | null } };
  const socket = useSocket();
  const navigate = useNavigate();

  const [players, setPlayers] = useState<Player[]>(state?.players ?? []);
  const [isHost, setIsHost] = useState(state?.isHost ?? false);
  const [mode, setMode] = useState<RoomMode>(state?.mode ?? "TOSSUP");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>(state?.difficulty ?? null);
  const [aiLevel, setAiLevel] = useState<AiLevel | null>(state?.aiLevel ?? null);
  const [teams, setTeams] = useState<Team[]>(state?.teams ?? []);
  const [newTeamName, setNewTeamName] = useState("");
  const myId = state?.myId ?? socket.id;
  const myTeamId = teams.find((t) => t.memberIds.includes(myId))?.id ?? null;
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "…";

  useEffect(() => {
    if (!roomCode || !state) {
      navigate("/");
      return;
    }

    function onPlayerJoined({ players: p }: PlayerJoinedPayload) { setPlayers(p); }
    function onPlayerLeft({ players: p }: PlayerLeftPayload) { setPlayers(p); }
    function onHostChanged({ newHostId }: HostChangedPayload) {
      if (newHostId === myId) setIsHost(true);
    }
    function onGameStarted({ questionNumber }: GameStartedPayload) {
      // Pass an initial READING snapshot: the GamePage mounts after this event
      // fires, so it would otherwise miss game-started and never leave LOBBY.
      navigate(`/game/${roomCode}`, {
        state: {
          myId, isHost, players,
          snapshot: { gameState: "READING", questionNumber, revealedWords: [], isPastPowerMark: false },
        },
      });
    }

    function onModeChanged({ mode: m }: ModeChangedPayload) { setMode(m); }
    function onDifficultyChanged({ difficulty: d }: DifficultyChangedPayload) { setDifficulty(d); }
    function onAiChanged({ aiLevel: a }: { aiLevel: AiLevel | null }) { setAiLevel(a); }
    function onTeamsUpdated({ teams: t }: TeamsUpdatedPayload) { setTeams(t); }

    function onCategoryChoices(_: CategoryChoicesPayload) {
      // Category round started — drop into the game (sync-on-mount hydrates it).
      navigate(`/game/${roomCode}`, {
        state: {
          myId, isHost, players,
          snapshot: { gameState: "CATEGORY_SELECT", questionNumber: 0, revealedWords: [], isPastPowerMark: false },
        },
      });
    }

    function onQuarterStarted(_: QuarterStartedPayload) {
      // Actual Game started (First Quarter) — drop into the game page in GAME mode.
      navigate(`/game/${roomCode}`, {
        state: {
          myId, isHost, players, mode: "GAME" as RoomMode,
          snapshot: { gameState: "READING", questionNumber: 0, revealedWords: [], isPastPowerMark: false },
        },
      });
    }

    socket.on(E.S_PLAYER_JOINED, onPlayerJoined);
    socket.on(E.S_PLAYER_LEFT, onPlayerLeft);
    socket.on(E.S_HOST_CHANGED, onHostChanged);
    socket.on(E.S_GAME_STARTED, onGameStarted);
    socket.on(E.S_MODE_CHANGED, onModeChanged);
    socket.on(E.S_DIFFICULTY_CHANGED, onDifficultyChanged);
    socket.on(E.S_AI_CHANGED, onAiChanged);
    socket.on(E.S_CATEGORY_CHOICES, onCategoryChoices);
    socket.on(E.S_QUARTER_STARTED, onQuarterStarted);
    socket.on(E.S_TEAMS_UPDATED, onTeamsUpdated);

    return () => {
      socket.off(E.S_PLAYER_JOINED, onPlayerJoined);
      socket.off(E.S_PLAYER_LEFT, onPlayerLeft);
      socket.off(E.S_HOST_CHANGED, onHostChanged);
      socket.off(E.S_GAME_STARTED, onGameStarted);
      socket.off(E.S_MODE_CHANGED, onModeChanged);
      socket.off(E.S_DIFFICULTY_CHANGED, onDifficultyChanged);
      socket.off(E.S_AI_CHANGED, onAiChanged);
      socket.off(E.S_CATEGORY_CHOICES, onCategoryChoices);
      socket.off(E.S_QUARTER_STARTED, onQuarterStarted);
      socket.off(E.S_TEAMS_UPDATED, onTeamsUpdated);
    };
  }, [socket, roomCode, myId, isHost, navigate, state, players]);

  function startGame() {
    socket.emit(E.C_START_GAME, { roomCode });
  }

  function changeMode(m: RoomMode) {
    socket.emit(E.C_SET_MODE, { roomCode, mode: m });
  }

  function changeDifficulty(d: DifficultyFilter) {
    socket.emit(E.C_SET_DIFFICULTY, { roomCode, difficulty: d });
  }

  function changeAi(level: AiLevel | null) {
    socket.emit(E.C_SET_AI, { roomCode, aiLevel: level });
  }

  function createTeam() {
    const name = newTeamName.trim();
    socket.emit(E.C_CREATE_TEAM, { roomCode, name });
    setNewTeamName("");
  }
  function joinTeam(teamId: string) {
    socket.emit(E.C_JOIN_TEAM, { roomCode, teamId });
  }
  function leaveTeam() {
    socket.emit(E.C_LEAVE_TEAM, { roomCode });
  }

  function leaveRoom() {
    socket.emit(E.C_LEAVE_ROOM, { roomCode });
    navigate("/");
  }

  if (!state) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: 8 }}>Room Code</p>
          <h1 style={{ fontSize: "3rem", fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.3em" }}>
            {roomCode}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 8 }}>Share this code with other players</p>
        </div>

        {/* Game mode */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Game Mode
          </h2>
          <div style={{ display: "flex", gap: 10 }}>
            {(["TOSSUP", "CATEGORY", "GAME"] as RoomMode[]).map((m) => {
              const active = mode === m;
              const label = m === "TOSSUP" ? "Tossup Round" : m === "CATEGORY" ? "Category Round" : "Actual Game";
              return (
                <button
                  key={m}
                  disabled={!isHost}
                  onClick={() => changeMode(m)}
                  style={{
                    flex: 1, padding: "10px 8px", fontSize: "0.82rem", fontWeight: 600,
                    borderRadius: "var(--radius)", cursor: isHost ? "pointer" : "default",
                    border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    background: active ? "var(--accent-dim)" : "var(--bg-card)",
                    color: active ? "var(--accent)" : "var(--text-dim)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: 10 }}>
            {mode === "TOSSUP"
              ? "Buzz in as each question is read."
              : mode === "CATEGORY"
              ? "Host picks 2 of 3 categories; answer 16 questions (10s, +10 each). Make teams below to play as teams."
              : "Full four-quarter match. Play solo, or form up to two teams below, then start."}
            {!isHost && " Only the host can change the mode."}
          </p>
        </div>

        {/* Difficulty — chooses which packets questions are pulled from */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Difficulty
          </h2>
          <div style={{ display: "flex", gap: 10 }}>
            {([
              [null, "Any"],
              ["EASY", "Easy"],
              ["MEDIUM", "Medium"],
              ["HARD", "Hard"],
            ] as [DifficultyFilter, string][]).map(([value, label]) => {
              const active = difficulty === value;
              return (
                <button
                  key={label}
                  disabled={!isHost}
                  onClick={() => changeDifficulty(value)}
                  style={{
                    flex: 1, padding: "10px 8px", fontSize: "0.82rem", fontWeight: 600,
                    borderRadius: "var(--radius)", cursor: isHost ? "pointer" : "default",
                    border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    background: active ? "var(--accent-dim)" : "var(--bg-card)",
                    color: active ? "var(--accent)" : "var(--text-dim)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: 10 }}>
            Sets which packets questions come from: Easy = regional rounds, Medium = Nationals rounds 1–5, Hard = Nationals round 6+ and playoffs. Any mixes them all.
            {!isHost && " Only the host can change the difficulty."}
          </p>
        </div>

        {/* AI opponent — solo play vs. a server-controlled bot (GAME mode only) */}
        {mode === "GAME" && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              AI Opponent
            </h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {([
                [null, "None"],
                ["easy", "Rookie Bot"],
                ["medium", "Junior Bot"],
                ["hard", "Varsity Bot"],
                ["robbie", "Robbie from Livingston"],
              ] as [AiLevel | null, string][]).map(([value, label]) => {
                const active = aiLevel === value;
                return (
                  <button
                    key={label}
                    disabled={!isHost}
                    onClick={() => changeAi(value)}
                    style={{
                      flex: "1 1 120px", padding: "10px 8px", fontSize: "0.82rem", fontWeight: 600,
                      borderRadius: "var(--radius)", cursor: isHost ? "pointer" : "default",
                      border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      background: active ? "var(--accent-dim)" : "var(--bg-card)",
                      color: active ? "var(--accent)" : "var(--text-dim)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: 10 }}>
              Play solo against a computer opponent that buzzes and answers on its own. Higher tiers buzz earlier and miss less — Robbie from Livingston is the toughest. This is separate from the packet difficulty above.
              {!isHost && " Only the host can change the AI opponent."}
            </p>
          </div>
        )}

        {/* Teams (category round & actual game) */}
        {(mode === "CATEGORY" || mode === "GAME") && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Teams
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginBottom: 14 }}>
              {mode === "GAME"
                ? "Optional — play solo, or form up to two teams. With no teams, everyone plays together as one team."
                : "Optional — make or join a team to play as a team (first teammate to answer locks it in). No teams = everyone plays solo."}
            </p>

            {teams.length > 0 && (
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                {teams.map((t) => {
                  const mine = t.id === myTeamId;
                  return (
                    <li key={t.id} style={{
                      border: `1px solid ${mine ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: "var(--radius)", padding: "10px 12px",
                      background: mine ? "var(--accent-dim)" : "var(--bg)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, color: mine ? "var(--accent)" : "var(--text)" }}>{t.name}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>({t.memberIds.length})</span>
                        {mine ? (
                          <button className="btn-secondary" onClick={leaveTeam} style={{ marginLeft: "auto", padding: "4px 12px", fontSize: "0.8rem" }}>
                            Leave
                          </button>
                        ) : (
                          <button className="btn-secondary" onClick={() => joinTeam(t.id)} style={{ marginLeft: "auto", padding: "4px 12px", fontSize: "0.8rem" }}>
                            Join
                          </button>
                        )}
                      </div>
                      <div style={{ color: "var(--text-dim)", fontSize: "0.78rem", marginTop: 4 }}>
                        {t.memberIds.map(nameOf).join(", ")}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTeam()}
                placeholder="New team name"
                maxLength={24}
                style={{ flex: "1 1 140px", minWidth: 0 }}
              />
              <button className="btn-primary" onClick={createTeam} style={{ padding: "10px 18px", whiteSpace: "nowrap" }}>
                Create Team
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Players ({players.length})
          </h2>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {players.map((p) => (
              <li key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--power)", flexShrink: 0 }} />
                <span style={{ fontWeight: p.id === myId ? 700 : 400 }}>
                  {p.name}
                  {p.id === myId && <span style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginLeft: 8 }}>(you)</span>}
                </span>
                {p.isHost && (
                  <span style={{ marginLeft: "auto", fontSize: "0.7rem", background: "var(--accent-dim)", color: "var(--accent)", padding: "2px 8px", borderRadius: 4 }}>
                    HOST
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-secondary" onClick={leaveRoom} style={{ flex: "0 0 auto" }}>
            Leave
          </button>
          {isHost && (
            <button
              className="btn-primary"
              onClick={startGame}
              disabled={mode === "GAME" ? (players.length < 1 || teams.length > 2) : players.length < 1}
              style={{ flex: 1 }}
            >
              {mode === "GAME" && teams.length > 2 ? "Too many teams (max 2)" : "Start Game"}
            </button>
          )}
          {!isHost && (
            <p style={{ flex: 1, textAlign: "center", color: "var(--text-dim)", fontSize: "0.9rem", alignSelf: "center" }}>
              Waiting for host to start…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
