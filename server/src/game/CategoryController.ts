import { Server } from "socket.io";
import { Room, getTeams } from "../rooms";
import { judgeAnswer } from "../utils/answerValidator";
import { getRandomTrio } from "../questions/categoryCache";
import { CATEGORY_TIMER_S, CATEGORY_SCORE, CATEGORY_REVEAL_MS } from "../../../shared/constants";
import * as E from "../../../shared/events";

function getScores(room: Room): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [id, p] of room.players) scores[id] = p.score;
  return scores;
}

// Host started a Category Round → pick a trio and let the host choose 2 of 3.
export function startCategoryRound(io: Server, room: Room): void {
  clearCategoryTimers(room);
  // Team play if any teams were formed in the lobby; otherwise individual.
  room.teamPlay = room.teams.size > 0;
  for (const p of room.players.values()) p.score = 0;
  for (const t of room.teams.values()) t.score = 0;

  room.trio = getRandomTrio();
  room.catQuestions = [];
  room.catIndex = 0;
  room.catOpen = false;
  room.state = "CATEGORY_SELECT";

  io.to(room.code).emit(E.S_CATEGORY_CHOICES, {
    titles: room.trio.categories.map((c) => c.title),
  });
}

// Host picked 2 of the 3 categories (indices into the trio).
export function chooseCategories(io: Server, room: Room, indices: number[]): void {
  if (room.state !== "CATEGORY_SELECT" || !room.trio) return;
  const picked = indices.filter((i) => i >= 0 && i < room.trio!.categories.length).slice(0, 2);
  if (picked.length !== 2) return;

  room.catQuestions = [];
  picked.forEach((catIdx, n) => {
    const cat = room.trio!.categories[catIdx];
    cat.questions.forEach((qa, k) => {
      room.catQuestions.push({
        categoryTitle: cat.title,
        intro: cat.intro,
        catNumber: n + 1,
        indexInCat: k + 1,
        qa,
      });
    });
  });

  room.catIndex = 0;
  room.state = "CATEGORY_PLAYING";
  askCategoryQuestion(io, room);
}

function askCategoryQuestion(io: Server, room: Room): void {
  clearCategoryTimers(room);
  if (room.catIndex >= room.catQuestions.length) {
    endCategoryRound(io, room);
    return;
  }

  const cur = room.catQuestions[room.catIndex];
  room.catAnswered = new Set();
  room.catCorrect = new Set();
  room.catOpen = true;

  io.to(room.code).emit(E.S_CATEGORY_QUESTION, {
    categoryTitle: cur.categoryTitle,
    intro: cur.intro,
    clue: cur.qa.clue,
    catNumber: cur.catNumber,
    indexInCat: cur.indexInCat,
    questionIndex: room.catIndex,
    total: room.catQuestions.length,
    timerSeconds: CATEGORY_TIMER_S,
    teamPlay: room.teamPlay,
  });

  room.catTimer = setTimeout(() => endCategoryQuestion(io, room), CATEGORY_TIMER_S * 1000);
}

export function submitCategoryAnswer(io: Server, room: Room, socketId: string, answer: string): void {
  if (room.state !== "CATEGORY_PLAYING" || !room.catOpen) return;
  const player = room.players.get(socketId);
  if (!player) return;
  const cur = room.catQuestions[room.catIndex];
  const correct = judgeAnswer(answer, cur.qa.answer) === "correct";

  if (room.teamPlay) {
    // One answer per team: the first teammate to submit locks it in.
    const teamId = player.teamId;
    if (!teamId) return; // spectator (not on a team)
    if (room.catAnswered.has(teamId)) return; // team already answered
    room.catAnswered.add(teamId);
    if (correct) {
      const team = room.teams.get(teamId);
      if (team) team.score += CATEGORY_SCORE;
      room.catCorrect.add(teamId);
    }
    // Every team has answered — reveal immediately.
    if (room.catAnswered.size >= room.teams.size) endCategoryQuestion(io, room);
    return;
  }

  // Individual play.
  if (room.catAnswered.has(socketId)) return;
  room.catAnswered.add(socketId);
  if (correct) {
    player.score += CATEGORY_SCORE;
    room.catCorrect.add(socketId);
  }
  if (room.catAnswered.size >= room.players.size) endCategoryQuestion(io, room);
}

function endCategoryQuestion(io: Server, room: Room): void {
  if (!room.catOpen) return; // already revealed
  room.catOpen = false;
  if (room.catTimer) {
    clearTimeout(room.catTimer);
    room.catTimer = null;
  }

  const cur = room.catQuestions[room.catIndex];
  io.to(room.code).emit(E.S_CATEGORY_REVEAL, {
    questionIndex: room.catIndex,
    answer: cur.qa.answer,
    correctIds: Array.from(room.catCorrect), // team ids when teamPlay, else player ids
    scores: getScores(room),
    teams: room.teamPlay ? getTeams(room) : null,
  });

  room.catTimer = setTimeout(() => {
    room.catIndex += 1;
    askCategoryQuestion(io, room);
  }, CATEGORY_REVEAL_MS);
}

function endCategoryRound(io: Server, room: Room): void {
  clearCategoryTimers(room);
  room.state = "BETWEEN";
  io.to(room.code).emit(E.S_CATEGORY_END, {
    scores: getScores(room),
    teams: room.teamPlay ? getTeams(room) : null,
  });
}

export function clearCategoryTimers(room: Room): void {
  if (room.catTimer) {
    clearTimeout(room.catTimer);
    room.catTimer = null;
  }
}

// Build the sync payload's category question (for late join / reload).
export function currentCategoryQuestion(room: Room) {
  if (room.state !== "CATEGORY_PLAYING" || room.catIndex >= room.catQuestions.length) return null;
  const cur = room.catQuestions[room.catIndex];
  return {
    categoryTitle: cur.categoryTitle,
    intro: cur.intro,
    clue: cur.qa.clue,
    catNumber: cur.catNumber,
    indexInCat: cur.indexInCat,
    questionIndex: room.catIndex,
    total: room.catQuestions.length,
    timerSeconds: CATEGORY_TIMER_S,
    teamPlay: room.teamPlay,
  };
}
