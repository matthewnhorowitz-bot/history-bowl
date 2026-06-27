import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import * as E from "@shared/events";
import { RoomJoinedPayload, ErrorPayload } from "@shared/types";

export default function HomePage() {
  const socket = useSocket();
  const navigate = useNavigate();

  const [hostName, setHostName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(""), 3500);
    setLoading(false);
  }

  function createRoom() {
    if (!hostName.trim()) return showError("Enter your name");
    setLoading(true);

    socket.once(E.S_ROOM_JOINED, (data: RoomJoinedPayload) => {
      navigate(`/lobby/${data.roomCode}`, { state: { myId: data.playerId, isHost: true, players: data.players } });
    });
    socket.once(E.S_ERROR, ({ message }: ErrorPayload) => showError(message));

    socket.emit(E.C_CREATE_ROOM, { hostName: hostName.trim() });
  }

  function joinRoom() {
    if (!playerName.trim()) return showError("Enter your name");
    if (!roomCode.trim()) return showError("Enter a room code");
    setLoading(true);

    socket.once(E.S_ROOM_JOINED, (data: RoomJoinedPayload) => {
      navigate(`/lobby/${data.roomCode}`, { state: { myId: data.playerId, isHost: false, players: data.players } });
    });
    socket.once(E.S_ERROR, ({ message }: ErrorPayload) => showError(message));

    socket.emit(E.C_JOIN_ROOM, { roomCode: roomCode.toUpperCase().trim(), playerName: playerName.trim() });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {error && <div className="error-toast">{error}</div>}

      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontSize: "2.8rem", color: "var(--accent)", letterSpacing: "0.04em", marginBottom: 8 }}>
          History Bowl
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: "1.05rem" }}>
          IAC National History Bowl — real-time multiplayer
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, width: "100%", maxWidth: 680 }}>
        {/* Create Room */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: "1.1rem", color: "var(--accent)", marginBottom: 4 }}>Create Room</h2>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: 6 }}>Your Name</label>
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createRoom()}
              placeholder="e.g. Alex"
              maxLength={24}
            />
          </div>
          <button className="btn-primary" onClick={createRoom} disabled={loading} style={{ width: "100%" }}>
            Create
          </button>
        </div>

        {/* Join Room */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: "1.1rem", color: "var(--accent)", marginBottom: 4 }}>Join Room</h2>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: 6 }}>Your Name</label>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Jordan"
              maxLength={24}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: 6 }}>Room Code</label>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              placeholder="e.g. AB3K"
              maxLength={4}
              style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.2em", textTransform: "uppercase" }}
            />
          </div>
          <button className="btn-primary" onClick={joinRoom} disabled={loading} style={{ width: "100%" }}>
            Join
          </button>
        </div>
      </div>

      <p style={{ marginTop: 40, color: "var(--text-muted)", fontSize: "0.8rem" }}>
        Press <kbd style={{ background: "var(--bg-card)", border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 4 }}>Space</kbd> to buzz in during a question
      </p>
    </div>
  );
}
