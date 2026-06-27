import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { Player, PlayerJoinedPayload, PlayerLeftPayload, GameStartedPayload, HostChangedPayload } from "@shared/types";
import * as E from "@shared/events";

export default function LobbyPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { state } = useLocation() as { state: { myId: string; isHost: boolean; players: Player[] } };
  const socket = useSocket();
  const navigate = useNavigate();

  const [players, setPlayers] = useState<Player[]>(state?.players ?? []);
  const [isHost, setIsHost] = useState(state?.isHost ?? false);
  const myId = state?.myId ?? socket.id;

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
    function onGameStarted(_: GameStartedPayload) {
      navigate(`/game/${roomCode}`, { state: { myId, isHost, players } });
    }

    socket.on(E.S_PLAYER_JOINED, onPlayerJoined);
    socket.on(E.S_PLAYER_LEFT, onPlayerLeft);
    socket.on(E.S_HOST_CHANGED, onHostChanged);
    socket.on(E.S_GAME_STARTED, onGameStarted);

    return () => {
      socket.off(E.S_PLAYER_JOINED, onPlayerJoined);
      socket.off(E.S_PLAYER_LEFT, onPlayerLeft);
      socket.off(E.S_HOST_CHANGED, onHostChanged);
      socket.off(E.S_GAME_STARTED, onGameStarted);
    };
  }, [socket, roomCode, myId, isHost, navigate, state, players]);

  function startGame() {
    socket.emit(E.C_START_GAME, { roomCode });
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
              disabled={players.length < 1}
              style={{ flex: 1 }}
            >
              Start Game
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
