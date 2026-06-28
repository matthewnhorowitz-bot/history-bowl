export type GameState =
  | "LOBBY" | "READING" | "BUZZED" | "ANSWER_PHASE" | "BETWEEN"
  | "CATEGORY_SELECT" | "CATEGORY_PLAYING";

export type RoomMode = "TOSSUP" | "CATEGORY";

// Third Quarter category data (bundled)
export interface CategoryQA {
  clue: string;
  answer: string;
}
export interface CategoryDef {
  title: string;
  intro: string;
  questions: CategoryQA[]; // 8
}
export interface CategoryTrio {
  id: string;
  setName: string;
  year: number;
  categories: CategoryDef[]; // 3
}

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

export interface Question {
  id: string;
  questionText: string;
  words: string[];
  powerMarkIndex: number;
  answer: string;
  answerRaw: string;
  category: string;
  subcategory: string;
  difficulty: number;
  setName: string;
  year: number;
}

// Socket payload types — Client → Server
export interface CreateRoomPayload {
  hostName: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
}

export interface StartGamePayload {
  roomCode: string;
}

export interface BuzzPayload {
  roomCode: string;
  wordIndex: number;
  timestamp: number;
}

export interface SubmitAnswerPayload {
  roomCode: string;
  answer: string;
}

export interface NextQuestionPayload {
  roomCode: string;
}

export interface LeaveRoomPayload {
  roomCode: string;
}

// Socket payload types — Server → Client
// Snapshot of an in-progress game, sent to a player who joins late.
export interface GameSnapshot {
  gameState: GameState;
  questionNumber: number;
  revealedWords: string[];
  isPastPowerMark: boolean;
}

// Full authoritative state, sent in reply to a client's sync request on mount.
export interface SyncPayload {
  gameState: GameState;
  questionNumber: number;
  revealedWords: string[];
  isPastPowerMark: boolean;
  players: Player[];
  buzzedBy: { id: string; name: string } | null;
  mode: RoomMode;
  categoryChoices: string[] | null;          // 3 titles when CATEGORY_SELECT
  categoryQuestion: CategoryQuestionPayload | null; // when CATEGORY_PLAYING
}

// ---- Category (Third Quarter) payloads ----
export interface ModeChangedPayload {
  mode: RoomMode;
}
export interface CategoryChoicesPayload {
  titles: string[]; // the 3 category titles
}
export interface CategoryQuestionPayload {
  categoryTitle: string;
  intro: string;
  clue: string;
  catNumber: number;    // 1 or 2 (which chosen category)
  indexInCat: number;   // 1..8
  questionIndex: number; // 0..15
  total: number;        // 16
  timerSeconds: number;
}
export interface CategoryRevealPayload {
  questionIndex: number;
  answer: string;
  correctIds: string[];
  scores: Record<string, number>;
}
export interface CategoryEndPayload {
  scores: Record<string, number>;
}

export interface RoomJoinedPayload {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  playerId: string;
  inProgress?: boolean;
  snapshot?: GameSnapshot;
  mode?: RoomMode;
}

export interface PlayerJoinedPayload {
  players: Player[];
}

export interface PlayerLeftPayload {
  players: Player[];
}

export interface GameStartedPayload {
  questionNumber: number;
}

export interface WordRevealedPayload {
  word: string;
  wordIndex: number;
  isPowerMark: boolean;
}

export interface BuzzWindowPayload {
  seconds: number;
}

export interface BuzzAcceptedPayload {
  buzzedBy: { id: string; name: string };
  wordIndex: number;
  timerSeconds: number;
}

export interface PromptPayload {
  buzzedBy: { id: string; name: string };
  timerSeconds: number;
}

export interface AnswerResultPayload {
  correct: boolean;
  delta: number;
  scores: Record<string, number>;
  resumeReading: boolean;
  buzzedBy: { id: string; name: string };
  answer: string;
}

export interface ReadingResumedPayload {
  fromWordIndex: number;
}

export interface QuestionEndPayload {
  fullText: string;
  answerSanitized: string;
  answerRaw: string;
  scores: Record<string, number>;
  questionNumber: number;
}

export interface ErrorPayload {
  message: string;
  code: string;
}

export interface HostChangedPayload {
  newHostId: string;
}
