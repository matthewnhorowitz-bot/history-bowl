import { Server, Socket } from "socket.io";
import { rooms, getPlayers } from "../rooms";
import { startNextQuestion } from "../game/GameController";
import {
  startCategoryRound, chooseCategories, submitCategoryAnswer, currentCategoryQuestion,
} from "../game/CategoryController";
import { getInitialPool } from "../questions/questionCache";
import { RoomMode } from "../../../shared/types";
import * as E from "../../../shared/events";

export function registerGameHandlers(io: Server, socket: Socket): void {
  // Host toggles Tossup vs Category round in the lobby.
  socket.on(E.C_SET_MODE, ({ roomCode, mode }: { roomCode: string; mode: RoomMode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id || room.state !== "LOBBY") return;
    if (mode !== "TOSSUP" && mode !== "CATEGORY") return;
    room.mode = mode;
    io.to(room.code).emit(E.S_MODE_CHANGED, { mode });
  });

  socket.on(E.C_START_GAME, async ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.hostSocketId !== socket.id) {
      socket.emit(E.S_ERROR, { message: "Only the host can start the game", code: "NOT_HOST" });
      return;
    }
    if (room.state !== "LOBBY") return;

    if (room.mode === "CATEGORY") {
      startCategoryRound(io, room);
      return;
    }

    try {
      room.questionPool = await getInitialPool();
    } catch {
      socket.emit(E.S_ERROR, { message: "Failed to load questions", code: "QUESTION_LOAD_FAIL" });
      return;
    }

    startNextQuestion(io, room);
  });

  socket.on(E.C_CHOOSE_CATEGORIES, ({ roomCode, indices }: { roomCode: string; indices: number[] }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;
    chooseCategories(io, room, indices);
  });

  socket.on(E.C_SUBMIT_CATEGORY_ANSWER, ({ roomCode, answer }: { roomCode: string; answer: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    submitCategoryAnswer(io, room, socket.id, answer ?? "");
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
      mode: room.mode,
      categoryChoices: room.state === "CATEGORY_SELECT" && room.trio
        ? room.trio.categories.map((c) => c.title)
        : null,
      categoryQuestion: currentCategoryQuestion(room),
    });
  });

  socket.on(E.C_NEXT_QUESTION, ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;
    if (room.state !== "BETWEEN") return;

    if (room.mode === "CATEGORY") {
      startCategoryRound(io, room); // new trio of categories
      return;
    }
    startNextQuestion(io, room);
  });
}
