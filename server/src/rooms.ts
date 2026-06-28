import { GameState, Player, Question, RoomMode, CategoryTrio, CategoryQA, Team } from "../../shared/types";

export interface TeamState {
  id: string;
  name: string;
  score: number;
  memberIds: Set<string>;
}

export interface Room {
  code: string;
  hostSocketId: string;
  players: Map<string, Player>;
  state: GameState;
  mode: RoomMode;
  currentQuestion: Question | null;
  wordsRevealed: number;
  powerMarkIndex: number;
  buzzedBy: string | null;
  buzzedAtWord: number;
  prompted: boolean;
  lockedOut: Set<string>;
  readingTimer: ReturnType<typeof setInterval> | null;
  answerTimer: ReturnType<typeof setTimeout> | null;
  endWindowTimer: ReturnType<typeof setTimeout> | null;
  questionPool: Question[];
  questionNumber: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  // Category (Third Quarter) mode
  trio: CategoryTrio | null;
  catQuestions: { categoryTitle: string; intro: string; catNumber: number; indexInCat: number; qa: CategoryQA }[];
  catIndex: number;
  catAnswered: Set<string>;
  catCorrect: Set<string>;
  catOpen: boolean; // accepting answers for the current category question
  catTimer: ReturnType<typeof setTimeout> | null;
  // Teams (category round only)
  teams: Map<string, TeamState>;
  teamPlay: boolean; // true when the current category round is team-based
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
    mode: "TOSSUP",
    currentQuestion: null,
    wordsRevealed: 0,
    powerMarkIndex: 0,
    buzzedBy: null,
    buzzedAtWord: 0,
    prompted: false,
    lockedOut: new Set(),
    readingTimer: null,
    answerTimer: null,
    endWindowTimer: null,
    questionPool: [],
    questionNumber: 0,
    cleanupTimer: null,
    trio: null,
    catQuestions: [],
    catIndex: 0,
    catAnswered: new Set(),
    catCorrect: new Set(),
    catOpen: false,
    catTimer: null,
    teams: new Map(),
    teamPlay: false,
  };
  rooms.set(code, room);
  return room;
}

export function getPlayers(room: Room): Player[] {
  return Array.from(room.players.values());
}

export function getTeams(room: Room): Team[] {
  return Array.from(room.teams.values()).map((t) => ({
    id: t.id,
    name: t.name,
    score: t.score,
    memberIds: Array.from(t.memberIds),
  }));
}

// Remove a player from whatever team they're on; delete the team if it empties.
export function removeFromTeam(room: Room, playerId: string): boolean {
  const player = room.players.get(playerId);
  const teamId = player?.teamId;
  if (!teamId) return false;
  const team = room.teams.get(teamId);
  if (team) {
    team.memberIds.delete(playerId);
    if (team.memberIds.size === 0) room.teams.delete(teamId);
  }
  if (player) player.teamId = null;
  return true;
}

let teamCounterSeed = 0;
export function generateTeamId(): string {
  teamCounterSeed += 1;
  return `t${Date.now().toString(36)}${teamCounterSeed.toString(36)}`;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}
