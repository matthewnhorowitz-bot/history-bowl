import { GameState, Player, Question, RoomMode, CategoryTrio, CategoryQA, Team, Q2Pair, DifficultyFilter } from "../../shared/types";

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
  difficulty: DifficultyFilter; // packet difficulty filter chosen in the lobby (null = any)
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
  catQuestions: { categoryTitle: string; intro: string; catNumber: number; indexInCat: number; qa: CategoryQA; ownerTeamId?: string }[];
  catIndex: number;
  catAnswered: Set<string>;
  catCorrect: Set<string>;
  catOpen: boolean; // accepting answers for the current category question
  catTimer: ReturnType<typeof setTimeout> | null;
  // Teams (category round only)
  teams: Map<string, TeamState>;
  teamPlay: boolean; // true when the current category round is team-based
  // "Actual Game" (four-quarter) mode
  quarter: number;              // 0 when not in a game, else 1..4
  quarterIndex: number;         // question # within the current quarter (0-based)
  lockedOutTeams: Set<string>;  // teams locked out of the current buzz question
  bonusTeamId: string | null;   // Q2 bonus is offered only to this team
  bonusQuestion: Question | null;
  bonusAnswered: boolean;
  bonusReadIndex: number;       // Q2 bonus: how many words have been read out so far
  bonusReadingDone: boolean;    // Q2 bonus: true once fully read and the answer window is open
  q2Pool: Q2Pair[];             // Second Quarter tossup+bonus pairs for this game
  currentBonus: { question: string; answer: string } | null; // real bonus for the current Q2 question
  catOwnerTeamId: string | null; // Q3: team the current question is directed at
  catBounce: boolean;            // Q3: true once the question has bounced to the other team
  firstPickerTeamId: string | null; // Q3: losing team, which picks the first category
  winnerTeamId: string | null;   // set when the game ends
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
    difficulty: null,
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
    quarter: 0,
    quarterIndex: 0,
    lockedOutTeams: new Set(),
    bonusTeamId: null,
    bonusQuestion: null,
    bonusAnswered: false,
    bonusReadIndex: 0,
    bonusReadingDone: false,
    q2Pool: [],
    currentBonus: null,
    catOwnerTeamId: null,
    catBounce: false,
    firstPickerTeamId: null,
    winnerTeamId: null,
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
