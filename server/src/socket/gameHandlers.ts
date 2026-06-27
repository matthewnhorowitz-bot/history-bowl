import { Server, Socket } from "socket.io";
import { rooms, getPlayers } from "../rooms";
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

  // A client (e.g. one that just navigated into the game) asks for the
  // authoritative current state so it doesn't depend on having caught events.
  socket.on(E.C_SYNC, ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const buzzer = room.buzzedBy ? room.players.get(room.buzzedBy) : null;
    socket.emit(E.S_SYNC, {
      gameState: room.state,
      questionNumber: room.questionNumber,
      revealedWords: room.currentQuestion
        ? room.currentQuestion.words.slice(0, room.wordsRevealed)
        : [],
      isPastPowerMark: room.wordsRevealed > room.powerMarkIndex,
      players: getPlayers(room),
      buzzedBy: buzzer ? { id: buzzer.id, name: buzzer.name } : null,
    });
  });

  socket.on(E.C_NEXT_QUESTION, ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;
    if (room.state !== "BETWEEN") return;

    startNextQuestion(io, room);
  });
}
