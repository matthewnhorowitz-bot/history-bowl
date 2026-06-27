export type GameState = "LOBBY" | "READING" | "BUZZED" | "ANSWER_PHASE" | "BETWEEN";

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
export interface RoomJoinedPayload {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  playerId: string;
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

export interface BuzzAcceptedPayload {
  buzzedBy: { id: string; name: string };
  wordIndex: number;
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
