import { Server } from "socket.io";
import { Room, TeamState, getTeams } from "../rooms";
import { judgeAnswer } from "../utils/answerValidator";
import { getInitialPool, maybeRefetch } from "../questions/questionCache";
import { getRandomTrio } from "../questions/categoryCache";
import {
  WORD_INTERVAL_MS,
  END_BUZZ_WINDOW_S,
  GAME_ANSWER_TIMER_S,
  GAME_TOSSUP_SCORE,
  GAME_BONUS_SCORE,
  GAME_BONUS_TIMER_S,
  CATEGORY_SCORE,
  Q1_COUNT,
  Q2_COUNT,
  Q4_COUNT,
  GAME_CAT_TIMER_S,
  GAME_BOUNCEBACK_TIMER_S,
  GAME_CAT_REVEAL_MS,
  Q4_SCORE_HIGH,
  Q4_SCORE_MID,
  Q4_SCORE_LOW,
  Q4_HIGH_FRACTION,
} from "../../../shared/constants";
import * as E from "../../../shared/events";

const QUARTER_NAMES = ["", "First Quarter", "Second Quarter", "Third Quarter", "Fourth Quarter"];
const Q3_TOTAL = 16; // 2 categories × 8

// ---------- small helpers ----------

function quarterName(q: number): string {
  return QUARTER_NAMES[q] ?? "";
}

// The number of buzz questions in the given (buzz) quarter.
function buzzQuarterCount(q: number): number {
  if (q === 1) return Q1_COUNT;
  if (q === 2) return Q2_COUNT;
  if (q === 4) return Q4_COUNT;
  return 0;
}

function teamList(room: Room): TeamState[] {
  return Array.from(room.teams.values());
}

function teamOf(room: Room, socketId: string): string | null {
  return room.players.get(socketId)?.teamId ?? null;
}

function teamName(room: Room, teamId: string | null): string {
  return (teamId && room.teams.get(teamId)?.name) || "";
}

function otherTeamId(room: Room, teamId: string | null): string | null {
  for (const t of room.teams.values()) if (t.id !== teamId) return t.id;
  return null;
}

function award(room: Room, teamId: string | null, points: number): void {
  if (!teamId) return;
  const t = room.teams.get(teamId);
  if (t) t.score += points;
}

function clearGameTimers(room: Room): void {
  if (room.readingTimer) { clearInterval(room.readingTimer); room.readingTimer = null; }
  if (room.answerTimer) { clearTimeout(room.answerTimer); room.answerTimer = null; }
  if (room.endWindowTimer) { clearTimeout(room.endWindowTimer); room.endWindowTimer = null; }
  if (room.catTimer) { clearTimeout(room.catTimer); room.catTimer = null; }
}

// Q4 approximation: award 30/20/10 by how early the team buzzed.
function scoreForTier(buzzedAtWord: number, wordCount: number, powerMarkIndex: number): number {
  const highThreshold = Math.max(1, Math.floor(wordCount * Q4_HIGH_FRACTION));
  let midThreshold = powerMarkIndex;
  if (midThreshold <= highThreshold) midThreshold = Math.floor(wordCount * 0.66);
  if (buzzedAtWord < highThreshold) return Q4_SCORE_HIGH;
  if (buzzedAtWord < midThreshold) return Q4_SCORE_MID;
  return Q4_SCORE_LOW;
}

// ---------- match start ----------

export async function startActualGame(io: Server, room: Room): Promise<void> {
  clearGameTimers(room);
  room.teamPlay = true;
  room.winnerTeamId = null;
  for (const p of room.players.values()) p.score = 0;
  for (const t of room.teams.values()) t.score = 0;

  try {
    room.questionPool = await getInitialPool();
  } catch {
    io.to(room.code).emit(E.S_ERROR, { message: "Failed to load questions", code: "QUESTION_LOAD_FAIL" });
    return;
  }

  room.quarter = 1;
  room.quarterIndex = 0;
  io.to(room.code).emit(E.S_QUARTER_STARTED, {
    quarter: 1, name: quarterName(1), questionCount: Q1_COUNT, teams: getTeams(room),
  });
  startBuzzQuestion(io, room);
}

// ---------- buzz quarters (Q1 / Q2 / Q4) ----------

function takeQuestion(room: Room) {
  const q = room.questionPool.shift();
  maybeRefetch(room.questionPool).then((updated) => { room.questionPool = updated; });
  return q ?? null;
}

function startBuzzQuestion(io: Server, room: Room): void {
  const question = takeQuestion(room);
  if (!question) { endGame(io, room); return; }

  room.currentQuestion = question;
  room.wordsRevealed = 0;
  room.powerMarkIndex = question.powerMarkIndex;
  room.buzzedBy = null;
  room.buzzedAtWord = 0;
  room.prompted = false;
  room.lockedOutTeams = new Set();
  room.bonusTeamId = null;
  room.bonusQuestion = null;
  room.bonusAnswered = false;
  room.state = "READING";

  io.to(room.code).emit(E.S_GAME_QUESTION_START, {
    quarter: room.quarter,
    questionIndex: room.quarterIndex,
    count: buzzQuarterCount(room.quarter),
  });

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
    io.to(room.code).emit(E.S_WORD_REVEALED, { word, wordIndex: room.wordsRevealed, isPowerMark });
    room.wordsRevealed++;

    if (room.wordsRevealed >= words.length) {
      clearInterval(room.readingTimer!);
      room.readingTimer = null;
      startEndWindow(io, room);
    }
  }, WORD_INTERVAL_MS);
}

function startEndWindow(io: Server, room: Room): void {
  if (room.endWindowTimer) clearTimeout(room.endWindowTimer);
  io.to(room.code).emit(E.S_BUZZ_WINDOW, { seconds: END_BUZZ_WINDOW_S });
  room.endWindowTimer = setTimeout(() => {
    room.endWindowTimer = null;
    endBuzzQuestion(io, room);
  }, END_BUZZ_WINDOW_S * 1000);
}

export function handleGameBuzz(io: Server, room: Room, socketId: string): void {
  if (room.state !== "READING") return;
  const teamId = teamOf(room, socketId);
  if (!teamId) return;                       // spectators can't buzz
  if (room.lockedOutTeams.has(teamId)) return;
  if (!room.players.has(socketId)) return;

  if (room.readingTimer) { clearInterval(room.readingTimer); room.readingTimer = null; }
  if (room.endWindowTimer) { clearTimeout(room.endWindowTimer); room.endWindowTimer = null; }

  room.state = "ANSWER_PHASE";
  room.buzzedBy = socketId;
  room.buzzedAtWord = Math.max(0, room.wordsRevealed - 1);
  room.prompted = false;

  const player = room.players.get(socketId)!;
  io.to(room.code).emit(E.S_GAME_BUZZ, {
    buzzedBy: { id: socketId, name: player.name },
    teamId, teamName: teamName(room, teamId),
    wordIndex: room.buzzedAtWord, timerSeconds: GAME_ANSWER_TIMER_S, prompt: false,
  });

  room.answerTimer = setTimeout(() => resolveBuzz(io, room, socketId, "", false), GAME_ANSWER_TIMER_S * 1000);
}

export function handleGameSubmitAnswer(io: Server, room: Room, socketId: string, answer: string): void {
  if (room.state === "GAME_BONUS") { handleBonusAnswer(io, room, socketId, answer); return; }
  if (room.state !== "ANSWER_PHASE") return;
  if (room.buzzedBy !== socketId) return;

  if (room.answerTimer) { clearTimeout(room.answerTimer); room.answerTimer = null; }

  const verdict = judgeAnswer(answer, room.currentQuestion!.answer);
  if (verdict === "prompt" && !room.prompted) {
    room.prompted = true;
    const player = room.players.get(socketId);
    const teamId = teamOf(room, socketId);
    io.to(room.code).emit(E.S_GAME_BUZZ, {
      buzzedBy: { id: socketId, name: player?.name ?? "" },
      teamId: teamId ?? "", teamName: teamName(room, teamId),
      wordIndex: room.buzzedAtWord, timerSeconds: GAME_ANSWER_TIMER_S, prompt: true,
    });
    room.answerTimer = setTimeout(() => resolveBuzz(io, room, socketId, "", false), GAME_ANSWER_TIMER_S * 1000);
    return;
  }

  resolveBuzz(io, room, socketId, answer, verdict === "correct");
}

function resolveBuzz(io: Server, room: Room, socketId: string, answer: string, correct: boolean): void {
  if (room.answerTimer) { clearTimeout(room.answerTimer); room.answerTimer = null; }
  const teamId = teamOf(room, socketId);
  const player = room.players.get(socketId);

  let delta = 0;
  let tier: number | null = null;
  if (correct) {
    if (room.quarter === 4) {
      tier = scoreForTier(room.buzzedAtWord, room.currentQuestion!.words.length, room.powerMarkIndex);
      delta = tier;
    } else {
      delta = GAME_TOSSUP_SCORE;
    }
    award(room, teamId, delta);
  } else if (teamId) {
    room.lockedOutTeams.add(teamId);
  }

  // The other team may still buzz if it isn't locked out.
  const someTeamActive = teamList(room).some((t) => !room.lockedOutTeams.has(t.id));
  const wordsLeft = room.wordsRevealed < room.currentQuestion!.words.length;
  const resume = !correct && someTeamActive;

  io.to(room.code).emit(E.S_GAME_ANSWER_RESULT, {
    correct, delta, tier,
    buzzedBy: { id: socketId, name: player?.name ?? "" },
    teamId: teamId ?? "",
    answer,
    lockedTeamId: correct ? null : teamId,
    resume,
    teams: getTeams(room),
  });

  if (correct) {
    if (room.quarter === 2) { startBonus(io, room, teamId!); return; }
    endBuzzQuestion(io, room);
    return;
  }

  if (resume) {
    room.buzzedBy = null;
    room.state = "READING";
    if (wordsLeft) startReadingLoop(io, room);
    else startEndWindow(io, room);
  } else {
    endBuzzQuestion(io, room);
  }
}

function endBuzzQuestion(io: Server, room: Room): void {
  clearGameTimers(room);
  room.state = "BETWEEN";
  const isLast = room.quarterIndex + 1 >= buzzQuarterCount(room.quarter);
  io.to(room.code).emit(E.S_GAME_QUESTION_END, {
    quarter: room.quarter,
    fullText: room.currentQuestion!.questionText,
    answer: room.currentQuestion!.answerRaw || room.currentQuestion!.answer,
    teams: getTeams(room),
    isLast,
  });
}

// ---------- Q2 bonus ----------

function startBonus(io: Server, room: Room, teamId: string): void {
  clearGameTimers(room);
  const q = takeQuestion(room);
  if (!q) { endBuzzQuestion(io, room); return; }

  room.bonusTeamId = teamId;
  room.bonusQuestion = q;
  room.bonusAnswered = false;
  room.state = "GAME_BONUS";

  io.to(room.code).emit(E.S_BONUS_QUESTION, {
    text: q.questionText,
    answerVisible: false,
    timerSeconds: GAME_BONUS_TIMER_S,
    teamId, teamName: teamName(room, teamId),
  });

  room.answerTimer = setTimeout(() => finishBonus(io, room, false, ""), GAME_BONUS_TIMER_S * 1000);
}

function handleBonusAnswer(io: Server, room: Room, socketId: string, answer: string): void {
  if (room.state !== "GAME_BONUS" || room.bonusAnswered) return;
  if (teamOf(room, socketId) !== room.bonusTeamId) return; // only the winning team
  room.bonusAnswered = true;
  const correct = judgeAnswer(answer, room.bonusQuestion!.answer) === "correct";
  finishBonus(io, room, correct, answer);
}

function finishBonus(io: Server, room: Room, correct: boolean, answer: string): void {
  if (room.answerTimer) { clearTimeout(room.answerTimer); room.answerTimer = null; }
  if (correct) award(room, room.bonusTeamId, GAME_BONUS_SCORE);

  io.to(room.code).emit(E.S_GAME_ANSWER_RESULT, {
    correct, delta: correct ? GAME_BONUS_SCORE : 0, tier: null,
    buzzedBy: { id: "", name: teamName(room, room.bonusTeamId) },
    teamId: room.bonusTeamId ?? "",
    answer: answer || room.bonusQuestion!.answerRaw || room.bonusQuestion!.answer,
    lockedTeamId: null,
    resume: false,
    teams: getTeams(room),
  });

  endBuzzQuestion(io, room);
}

// ---------- advancing between questions / quarters (host "Next") ----------

export function advanceGame(io: Server, room: Room): void {
  if (room.state !== "BETWEEN") return;

  // Buzz quarters advance one question at a time, then transition.
  if (room.quarter === 1 || room.quarter === 2 || room.quarter === 4) {
    room.quarterIndex += 1;
    if (room.quarterIndex < buzzQuarterCount(room.quarter)) {
      startBuzzQuestion(io, room);
      return;
    }
    if (room.quarter === 1) { startBuzzQuarter(io, room, 2); return; }
    if (room.quarter === 2) { startQ3(io, room); return; }
    endGame(io, room); // Q4 finished
    return;
  }

  // Q3 uses host "Next" only for the final transition into Q4.
  if (room.quarter === 3) { startBuzzQuarter(io, room, 4); return; }
}

function startBuzzQuarter(io: Server, room: Room, quarter: number): void {
  room.quarter = quarter;
  room.quarterIndex = 0;
  io.to(room.code).emit(E.S_QUARTER_STARTED, {
    quarter, name: quarterName(quarter), questionCount: buzzQuarterCount(quarter), teams: getTeams(room),
  });
  startBuzzQuestion(io, room);
}

// ---------- Q3: directed category round with bounceback ----------

function startQ3(io: Server, room: Room): void {
  clearGameTimers(room);
  room.quarter = 3;
  room.quarterIndex = 0;
  room.trio = getRandomTrio();
  room.catQuestions = [];
  room.catIndex = 0;
  room.catOpen = false;

  // The losing team (lower cumulative score) picks first; tie → first-created team.
  const teams = teamList(room);
  const sorted = [...teams].sort((a, b) => a.score - b.score);
  room.firstPickerTeamId = sorted[0]?.id ?? null;
  room.state = "GAME_CAT_SELECT";

  io.to(room.code).emit(E.S_QUARTER_STARTED, {
    quarter: 3, name: quarterName(3), questionCount: Q3_TOTAL, teams: getTeams(room),
  });
  io.to(room.code).emit(E.S_GAME_CAT_CHOICES, {
    titles: room.trio.categories.map((c) => c.title),
    firstPickerTeamId: room.firstPickerTeamId ?? "",
    firstPickerName: teamName(room, room.firstPickerTeamId),
  });
}

// Host picks the two categories, in order: [firstPicker's category, other's category].
export function chooseGameCategories(io: Server, room: Room, indices: number[]): void {
  if (room.state !== "GAME_CAT_SELECT" || !room.trio) return;
  const picked = indices.filter((i) => i >= 0 && i < room.trio!.categories.length);
  const unique = [...new Set(picked)].slice(0, 2);
  if (unique.length !== 2) return;

  const firstPicker = room.firstPickerTeamId;
  const secondPicker = otherTeamId(room, firstPicker);
  const owners = [firstPicker, secondPicker];

  room.catQuestions = [];
  unique.forEach((catIdx, n) => {
    const cat = room.trio!.categories[catIdx];
    cat.questions.forEach((qa, k) => {
      room.catQuestions.push({
        categoryTitle: cat.title,
        intro: cat.intro,
        catNumber: n + 1,
        indexInCat: k + 1,
        qa,
        ownerTeamId: owners[n] ?? undefined,
      });
    });
  });

  room.catIndex = 0;
  room.state = "GAME_CAT_PLAYING";
  askGameCatQuestion(io, room);
}

function askGameCatQuestion(io: Server, room: Room): void {
  if (room.catTimer) { clearTimeout(room.catTimer); room.catTimer = null; }

  if (room.catIndex >= room.catQuestions.length) {
    // Q3 complete — wait for the host to advance into Q4.
    room.state = "BETWEEN";
    io.to(room.code).emit(E.S_GAME_QUESTION_END, {
      quarter: 3, fullText: "", answer: "", teams: getTeams(room), isLast: true,
    });
    return;
  }

  const cur = room.catQuestions[room.catIndex];
  room.catOwnerTeamId = cur.ownerTeamId ?? null;
  room.catBounce = false;
  room.catAnswered = new Set();
  room.catCorrect = new Set();
  room.catOpen = true;

  emitCatQuestion(io, room, cur.ownerTeamId ?? null, false, GAME_CAT_TIMER_S);
  room.catTimer = setTimeout(() => failCurrentCat(io, room), GAME_CAT_TIMER_S * 1000);
}

function emitCatQuestion(io: Server, room: Room, activeTeamId: string | null, bounce: boolean, seconds: number): void {
  const cur = room.catQuestions[room.catIndex];
  io.to(room.code).emit(E.S_GAME_CAT_QUESTION, {
    categoryTitle: cur.categoryTitle,
    intro: cur.intro,
    clue: cur.qa.clue,
    catNumber: cur.catNumber,
    indexInCat: cur.indexInCat,
    questionIndex: room.catIndex,
    total: room.catQuestions.length,
    ownerTeamId: activeTeamId ?? "",
    ownerName: teamName(room, activeTeamId),
    bounce,
    timerSeconds: seconds,
  });
}

export function submitGameCatAnswer(io: Server, room: Room, socketId: string, answer: string): void {
  if (room.state !== "GAME_CAT_PLAYING" || !room.catOpen) return;
  const teamId = teamOf(room, socketId);
  if (!teamId) return;

  const allowedTeam = room.catBounce ? otherTeamId(room, room.catOwnerTeamId) : room.catOwnerTeamId;
  if (teamId !== allowedTeam) return;
  if (room.catAnswered.has(teamId)) return;
  room.catAnswered.add(teamId);

  const cur = room.catQuestions[room.catIndex];
  const correct = judgeAnswer(answer, cur.qa.answer) === "correct";
  if (correct) {
    award(room, teamId, CATEGORY_SCORE);
    room.catCorrect.add(teamId);
    revealGameCat(io, room, teamId);
  } else {
    failCurrentCat(io, room);
  }
}

// The team currently on the clock failed (wrong answer or timeout).
function failCurrentCat(io: Server, room: Room): void {
  if (!room.catOpen) return; // already resolved/revealed
  if (!room.catBounce) {
    // Bounce to the other team.
    room.catBounce = true;
    if (room.catTimer) { clearTimeout(room.catTimer); room.catTimer = null; }
    const other = otherTeamId(room, room.catOwnerTeamId);
    emitCatQuestion(io, room, other, true, GAME_BOUNCEBACK_TIMER_S);
    room.catTimer = setTimeout(() => failCurrentCat(io, room), GAME_BOUNCEBACK_TIMER_S * 1000);
  } else {
    revealGameCat(io, room, null);
  }
}

function revealGameCat(io: Server, room: Room, correctTeamId: string | null): void {
  if (!room.catOpen) return;
  room.catOpen = false;
  if (room.catTimer) { clearTimeout(room.catTimer); room.catTimer = null; }

  const cur = room.catQuestions[room.catIndex];
  io.to(room.code).emit(E.S_GAME_CAT_REVEAL, {
    questionIndex: room.catIndex,
    answer: cur.qa.answer,
    correctTeamId,
    teams: getTeams(room),
  });

  room.catTimer = setTimeout(() => {
    room.catIndex += 1;
    askGameCatQuestion(io, room);
  }, GAME_CAT_REVEAL_MS);
}

// ---------- end of match ----------

function endGame(io: Server, room: Room): void {
  clearGameTimers(room);
  room.state = "GAME_END";
  const sorted = [...teamList(room)].sort((a, b) => b.score - a.score);
  const winner = sorted.length >= 2 && sorted[0].score === sorted[1].score ? null : (sorted[0]?.id ?? null);
  room.winnerTeamId = winner;
  io.to(room.code).emit(E.S_GAME_END, { teams: getTeams(room), winnerTeamId: winner });
}

// ---------- sync (late join / reload) ----------

export function syncActualGame(room: Room) {
  const inGame = room.mode === "GAME" && room.quarter > 0;
  return {
    quarter: inGame ? room.quarter : null,
    quarterName: inGame ? quarterName(room.quarter) : null,
    lockedTeamIds: Array.from(room.lockedOutTeams),
    bonus: room.state === "GAME_BONUS" && room.bonusQuestion
      ? {
          text: room.bonusQuestion.questionText,
          answerVisible: false,
          timerSeconds: GAME_BONUS_TIMER_S,
          teamId: room.bonusTeamId ?? "",
          teamName: teamName(room, room.bonusTeamId),
        }
      : null,
    gameCatChoices: room.state === "GAME_CAT_SELECT" && room.trio
      ? {
          titles: room.trio.categories.map((c) => c.title),
          firstPickerTeamId: room.firstPickerTeamId ?? "",
          firstPickerName: teamName(room, room.firstPickerTeamId),
        }
      : null,
    gameCatQuestion: room.state === "GAME_CAT_PLAYING" && room.catIndex < room.catQuestions.length
      ? (() => {
          const cur = room.catQuestions[room.catIndex];
          const activeTeamId = room.catBounce ? otherTeamId(room, room.catOwnerTeamId) : room.catOwnerTeamId;
          return {
            categoryTitle: cur.categoryTitle,
            intro: cur.intro,
            clue: cur.qa.clue,
            catNumber: cur.catNumber,
            indexInCat: cur.indexInCat,
            questionIndex: room.catIndex,
            total: room.catQuestions.length,
            ownerTeamId: activeTeamId ?? "",
            ownerName: teamName(room, activeTeamId),
            bounce: room.catBounce,
            timerSeconds: room.catBounce ? GAME_BOUNCEBACK_TIMER_S : GAME_CAT_TIMER_S,
          };
        })()
      : null,
    winnerTeamId: room.winnerTeamId,
  };
}
