import { Server, Socket } from "socket.io";
import { rooms } from "../rooms";
import { startNextQuestion } from "../game/GameController";
import { getInitialPool } from "../questions/questionCache";
import * as E from "../../../shared/events";

export function registerGameHandlers(io: Server, socket: Socket): void {
  socket.on(E.C_START_GAME, async ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.hostSocketId !== socket.id) {
      socket.emit(E.S_ERROR, { message: "Only the host can start the game", code: "NOT_HOST" });
      return;
    }
    if (room.state !== "LOBBY") return;

    try {
      room.questionPool = await getInitialPool();
    } catch {
      socket.emit(E.S_ERROR, { message: "Failed to load questions", code: "QUESTION_LOAD_FAIL" });
      return;
    }

    startNextQuestion(io, room);
  });

  socket.on(E.C_NEXT_QUESTION, ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;
    if (room.state !== "BETWEEN") return;

    startNextQuestion(io, room);
  });
}
