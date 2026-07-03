import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Player, GameSnapshot, RoomMode } from "@shared/types";
import ClassicGamePage from "./ClassicGamePage";
import ActualGamePage from "./ActualGamePage";

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { state } = useLocation() as { state: { myId: string; isHost: boolean; players: Player[]; snapshot?: GameSnapshot; mode?: RoomMode } };
  const navigate = useNavigate();

  useEffect(() => {
    if (!state || !roomCode) navigate("/");
  }, [state, roomCode, navigate]);

  if (!state) return null;

  const props = {
    roomCode: roomCode ?? "",
    myId: state.myId ?? "",
    isHost: state.isHost ?? false,
    players: state.players ?? [],
    snapshot: state.snapshot,
  };

  return state.mode === "GAME" ? <ActualGamePage {...props} /> : <ClassicGamePage {...props} />;
}
