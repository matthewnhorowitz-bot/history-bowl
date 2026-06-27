import { Server } from "socket.io";
import { Room } from "../rooms";
import { validateAnswer } from "../utils/answerValidator";
import { maybeRefetch } from "../questions/questionCache";
import {
  WORD_INTERVAL_MS,
  ANSWER_TIMER_S,
  POWER_SCORE,
  CORRECT_SCORE,
  NEG_SCORE,
} from "../../../shared/constants";
import * as E from "../../../shared/events";

export function startNextQuestion(io: Server, room: Room): void {
  if (room.questionPool.length === 0) {
    // No more questions — end the game
    io.to(room.code).emit(E.S_QUESTION_END, {
      fullText: "",
      answerSanitized: "",
      answerRaw: "",
      scores: getScores(room),
      questionNumber: room.questionNumber,
    });
    room.state = "BETWEEN";
    return;
  }

  const question = room.questionPool.shift()!;
  room.currentQuestion = question;
  room.questionNumber += 1;
  room.wordsRevealed = 0;
  room.powerMarkIndex = question.powerMarkIndex;
  room.buzzedBy = null;
  room.buzzedAtWord = 0;
  room.lockedOut = new Set();
  room.state = "READING";

  // Trigger background refetch if pool is running low
  maybeRefetch(room.questionPool).then((updated) => {
    room.questionPool = updated;
  });

  io.to(room.code).emit(E.S_GAME_STARTED, { questionNumber: room.questionNumber });

  startReadingLoop(io, room);
}

function startReadingLoop(io: Server, room: Room): void {
  if (room.readingTimer) clearInterval(room.readingTimer);

  const words = room.currentQuestion!.words;

  room.readingTimer = setInterval(() => {
    if (room.state !== "READING") {
      clearInterval(room.readingTimer!);
      room.readingTimer = null;
      return;
    }

    const word = words[room.wordsRevealed];
    const isPowerMark = word.includes("(*)") || room.wordsRevealed === room.powerMarkIndex;

    io.to(room.code).emit(E.S_WORD_REVEALED, {
      word,
      wordIndex: room.wordsRevealed,
      isPowerMark,
    });

    room.wordsRevealed++;

    if (room.wordsRevealed >= words.length) {
      clearInterval(room.readingTimer!);
      room.readingTimer = null;
      endQuestion(io, room);
    }
  }, WORD_INTERVAL_MS);
}

export function handleBuzz(io: Server, room: Room, socketId: string): boolean {
  if (room.state !== "READING") return false;
  if (room.lockedOut.has(socketId)) return false;
  if (!room.players.has(socketId)) return false;

  clearInterval(room.readingTimer!);
  room.readingTimer = null;

  room.state = "BUZZED";
  room.buzzedBy = socketId;
  room.buzzedAtWord = room.wordsRevealed - 1; // last word that was revealed

  const player = room.players.get(socketId)!;
  room.state = "ANSWER_PHASE";

  io.to(room.code).emit(E.S_BUZZ_ACCEPTED, {
    buzzedBy: { id: socketId, name: player.name },
    wordIndex: room.buzzedAtWord,
    timerSeconds: ANSWER_TIMER_S,
  });

  room.answerTimer = setTimeout(() => {
    // Timer expired — treat as wrong
    handleAnswerResult(io, room, socketId, "", false);
  }, ANSWER_TIMER_S * 1000);

  return true;
}

export function handleSubmitAnswer(io: Server, room: Room, socketId: string, answer: string): void {
  if (room.state !== "ANSWER_PHASE") return;
  if (room.buzzedBy !== socketId) return;

  clearTimeout(room.answerTimer!);
  room.answerTimer = null;

  const correct = validateAnswer(answer, room.currentQuestion!.answer);
  handleAnswerResult(io, room, socketId, answer, correct);
}

function handleAnswerResult(io: Server, room: Room, socketId: string, answer: string, correct: boolean): void {
  const buzzedAtWord = room.buzzedAtWord;
  const powerMarkIndex = room.powerMarkIndex;

  let delta: number;
  if (correct) {
    delta = buzzedAtWord < powerMarkIndex ? POWER_SCORE : CORRECT_SCORE;
  } else {
    delta = NEG_SCORE;
  }

  const player = room.players.get(socketId);
  if (player) player.score += delta;

  if (!correct) room.lockedOut.add(socketId);

  // Can any non-locked-out player still buzz?
  const activePlayers = Array.from(room.players.values()).filter(
    (p) => !room.lockedOut.has(p.id)
  );

  const resumeReading = !correct && activePlayers.length > 0 && room.wordsRevealed < room.currentQuestion!.words.length;

  io.to(room.code).emit(E.S_ANSWER_RESULT, {
    correct,
    delta,
    scores: getScores(room),
    resumeReading,
    buzzedBy: { id: socketId, name: player?.name ?? "" },
    answer,
  });

  if (resumeReading) {
    room.buzzedBy = null;
    room.state = "READING";
    io.to(room.code).emit(E.S_READING_RESUMED, { fromWordIndex: room.wordsRevealed });
    startReadingLoop(io, room);
  } else {
    endQuestion(io, room);
  }
}

function endQuestion(io: Server, room: Room): void {
  if (room.readingTimer) {
    clearInterval(room.readingTimer);
    room.readingTimer = null;
  }
  if (room.answerTimer) {
    clearTimeout(room.answerTimer);
    room.answerTimer = null;
  }

  room.state = "BETWEEN";

  io.to(room.code).emit(E.S_QUESTION_END, {
    fullText: room.currentQuestion!.questionText,
    answerSanitized: room.currentQuestion!.answer,
    answerRaw: room.currentQuestion!.answerRaw,
    scores: getScores(room),
    questionNumber: room.questionNumber,
  });
}

function getScores(room: Room): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [id, player] of room.players) {
    scores[id] = player.score;
  }
  return scores;
}
