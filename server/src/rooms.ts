import { GameState, Player, Question } from "../../shared/types";

export interface Room {
  code: string;
  hostSocketId: string;
  players: Map<string, Player>;
  state: GameState;
  currentQuestion: Question | null;
  wordsRevealed: number;
  powerMarkIndex: number;
  buzzedBy: string | null;
  buzzedAtWord: number;
  lockedOut: Set<string>;
  readingTimer: ReturnType<typeof setInterval> | null;
  answerTimer: ReturnType<typeof setTimeout> | null;
  endWindowTimer: ReturnType<typeof setTimeout> | null;
  questionPool: Question[];
  questionNumber: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

export const rooms = new Map<string, Room>();

export function createRoom(code: string, hostSocketId: string, hostName: string): Room {
  const host: Player = {
    id: hostSocketId,
    name: hostName,
    score: 0,
    isHost: true,
  };
  const room: Room = {
    code,
    hostSocketId,
    players: new Map([[hostSocketId, host]]),
    state: "LOBBY",
    currentQuestion: null,
    wordsRevealed: 0,
    powerMarkIndex: 0,
    buzzedBy: null,
    buzzedAtWord: 0,
    lockedOut: new Set(),
    readingTimer: null,
    answerTimer: null,
    endWindowTimer: null,
    questionPool: [],
    questionNumber: 0,
    cleanupTimer: null,
  };
  rooms.set(code, room);
  return room;
}

export function getPlayers(room: Room): Player[] {
  return Array.from(room.players.values());
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}
