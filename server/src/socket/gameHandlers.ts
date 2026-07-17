import { Server, Socket } from "socket.io";
import { rooms, getPlayers, getTeams, generateTeamId } from "../rooms";
import { startNextQuestion } from "../game/GameController";
import {
  startCategoryRound, chooseCategories, submitCategoryAnswer, currentCategoryQuestion,
} from "../game/CategoryController";
import {
  startActualGame, advanceGame, chooseGameCategories, submitGameCatAnswer, syncActualGame, clearGameTimers,
  aiIdFor, aiTeamName,
} from "../game/ActualGameController";
import { getInitialPool } from "../questions/questionCache";
import { RoomMode, DifficultyFilter, AiLevel } from "../../../shared/types";
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

  // Host picks the solo AI opponent tier in the lobby (null = no AI).
  socket.on(E.C_SET_AI, ({ roomCode, aiLevel }: { roomCode: string; aiLevel: AiLevel | null }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id || room.state !== "LOBBY") return;
    if (aiLevel !== null && aiLevel !== "easy" && aiLevel !== "medium" && aiLevel !== "hard" && aiLevel !== "robbie") return;
    room.aiLevel = aiLevel;
    io.to(room.code).emit(E.S_AI_CHANGED, { aiLevel });
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
      const wantAi = room.aiLevel !== null;

      // Solo/single-team play is allowed. With no teams, auto-create one from
      // every player so a lone host can start with zero setup.
      if (room.teams.size === 0) {
        const id = generateTeamId();
        const memberIds = new Set(room.players.keys());
        room.teams.set(id, { id, name: wantAi ? "You" : "Team 1", score: 0, memberIds });
        for (const p of room.players.values()) p.teamId = id;
        io.to(room.code).emit(E.S_TEAMS_UPDATED, { teams: getTeams(room) });
      }

      // Add the solo AI opponent as the second team (server-controlled).
      room.aiTeamId = null;
      if (wantAi) {
        if (room.teams.size > 1) {
          socket.emit(E.S_ERROR, { message: "The AI opponent is for solo play — remove extra teams first", code: "AI_NEEDS_SOLO" });
          return;
        }
        const teamId = generateTeamId();
        const aiSocketId = aiIdFor(teamId);
        const name = aiTeamName(room.aiLevel!);
        room.teams.set(teamId, { id: teamId, name, score: 0, memberIds: new Set([aiSocketId]) });
        room.players.set(aiSocketId, { id: aiSocketId, name, score: 0, isHost: false, teamId, isAi: true });
        room.aiTeamId = teamId;
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

  // Host starts a new game from the ending screen → reset and return to lobby.
  socket.on(E.C_NEW_GAME, ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.state !== "GAME_END") return;

    clearGameTimers(room);
    room.state = "LOBBY";
    room.quarter = 0;
    room.quarterIndex = 0;
    room.winnerTeamId = null;
    room.teamPlay = false;
    room.lockedOutTeams = new Set();
    room.bonusTeamId = null;
    room.bonusQuestion = null;
    room.bonusAnswered = false;
    room.bonusReadingDone = false;
    room.currentBonus = null;
    room.trio = null;
    room.catQuestions = [];
    room.catOpen = false;
    room.catOwnerTeamId = null;
    room.catBounce = false;
    room.catSweepAlive = false;
    room.firstPickerTeamId = null;

    // Tear down the AI opponent (team + synthetic player); a rematch rebuilds it
    // from room.aiLevel, which we keep so the selection survives the return to lobby.
    if (room.aiTeamId) {
      room.players.delete(aiIdFor(room.aiTeamId));
      room.teams.delete(room.aiTeamId);
      room.aiTeamId = null;
    }
    for (const p of room.players.values()) p.score = 0;
    for (const t of room.teams.values()) t.score = 0;

    io.to(room.code).emit(E.S_RETURN_TO_LOBBY, {
      players: getPlayers(room),
      teams: getTeams(room),
      mode: room.mode,
      difficulty: room.difficulty,
      aiLevel: room.aiLevel,
    });
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
