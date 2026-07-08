import { Server, Socket } from "socket.io";
import { rooms, getPlayers, getTeams, generateTeamId } from "../rooms";
import { startNextQuestion } from "../game/GameController";
import {
  startCategoryRound, chooseCategories, submitCategoryAnswer, currentCategoryQuestion,
} from "../game/CategoryController";
import {
  startActualGame, advanceGame, chooseGameCategories, submitGameCatAnswer, syncActualGame,
} from "../game/ActualGameController";
import { getInitialPool } from "../questions/questionCache";
import { RoomMode, DifficultyFilter } from "../../../shared/types";
import * as E from "../../../shared/events";

export function registerGameHandlers(io: Server, socket: Socket): void {
  // Host toggles Tossup / Category / Actual Game in the lobby.
  socket.on(E.C_SET_MODE, ({ roomCode, mode }: { roomCode: string; mode: RoomMode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id || room.state !== "LOBBY") return;
    if (mode !== "TOSSUP" && mode !== "CATEGORY" && mode !== "GAME") return;
    room.mode = mode;
    io.to(room.code).emit(E.S_MODE_CHANGED, { mode });
  });

  // Host picks the packet difficulty in the lobby (null = any).
  socket.on(E.C_SET_DIFFICULTY, ({ roomCode, difficulty }: { roomCode: string; difficulty: DifficultyFilter }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id || room.state !== "LOBBY") return;
    if (difficulty !== null && difficulty !== "EASY" && difficulty !== "MEDIUM" && difficulty !== "HARD") return;
    room.difficulty = difficulty;
    io.to(room.code).emit(E.S_DIFFICULTY_CHANGED, { difficulty });
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

    if (room.mode === "GAME") {
      // Solo/single-team play is allowed. With no teams, auto-create one from
      // every player so a lone host can start with zero setup.
      if (room.teams.size === 0) {
        const id = generateTeamId();
        const memberIds = new Set(room.players.keys());
        room.teams.set(id, { id, name: "Team 1", score: 0, memberIds });
        for (const p of room.players.values()) p.teamId = id;
        io.to(room.code).emit(E.S_TEAMS_UPDATED, { teams: getTeams(room) });
      }
      const teams = Array.from(room.teams.values());
      if (teams.length > 2) {
        socket.emit(E.S_ERROR, { message: "An Actual Game supports at most two teams", code: "TOO_MANY_TEAMS" });
        return;
      }
      if (teams.some((t) => t.memberIds.size === 0)) {
        socket.emit(E.S_ERROR, { message: "Every team must have at least one player", code: "EMPTY_TEAM" });
        return;
      }
      await startActualGame(io, room);
      return;
    }

    try {
      room.questionPool = await getInitialPool(room.difficulty);
    } catch {
      socket.emit(E.S_ERROR, { message: "Failed to load questions", code: "QUESTION_LOAD_FAIL" });
      return;
    }

    startNextQuestion(io, room);
  });

  socket.on(E.C_CHOOSE_CATEGORIES, ({ roomCode, indices }: { roomCode: string; indices: number[] }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.mode === "GAME") chooseGameCategories(io, room, indices);
    else chooseCategories(io, room, indices);
  });

  socket.on(E.C_SUBMIT_CATEGORY_ANSWER, ({ roomCode, answer }: { roomCode: string; answer: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.mode === "GAME") submitGameCatAnswer(io, room, socket.id, answer ?? "");
    else submitCategoryAnswer(io, room, socket.id, answer ?? "");
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
      teams: getTeams(room),
      teamPlay: room.teamPlay,
      myTeamId: room.players.get(socket.id)?.teamId ?? null,
      difficulty: room.difficulty,
      ...syncActualGame(room),
    });
  });

  socket.on(E.C_NEXT_QUESTION, ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;
    if (room.state !== "BETWEEN") return;

    if (room.mode === "GAME") {
      advanceGame(io, room);
      return;
    }
    if (room.mode === "CATEGORY") {
      startCategoryRound(io, room); // new trio of categories
      return;
    }
    startNextQuestion(io, room);
  });
}
