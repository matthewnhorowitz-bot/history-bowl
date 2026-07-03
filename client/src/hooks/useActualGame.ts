import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../context/SocketContext";
import {
  Player, GameState, GameSnapshot, SyncPayload, Team,
  WordRevealedPayload, PlayerJoinedPayload, PlayerLeftPayload, HostChangedPayload,
  BuzzWindowPayload, ErrorPayload, TeamsUpdatedPayload,
  QuarterStartedPayload, GameQuestionStartPayload, GameBuzzPayload, GameAnswerResultPayload,
  BonusQuestionPayload, GameQuestionEndPayload, GameCatChoicesPayload, GameCatQuestionPayload,
  GameCatRevealPayload, GameEndPayload,
} from "@shared/types";
import * as E from "@shared/events";

export interface ActualGameHook {
  gameState: GameState;
  players: Player[];
  teams: Team[];
  myId: string;
  myTeamId: string | null;
  isHost: boolean;
  roomCode: string;
  error: string | null;
  // quarter
  quarter: number;
  quarterName: string;
  questionIndex: number;
  questionCount: number;
  // buzz quarters (Q1/Q2/Q4)
  revealedWords: string[];
  isPastPowerMark: boolean;
  buzzStatus: GameBuzzPayload | null;
  answerTimerRemaining: number;
  buzzWindowRemaining: number;
  lockedOut: boolean;
  lastResult: GameAnswerResultPayload | null;
  questionEnd: GameQuestionEndPayload | null;
  // Q2 bonus
  bonus: BonusQuestionPayload | null;
  bonusAnswered: boolean;
  // Q3 categories
  catChoices: GameCatChoicesPayload | null;
  catQuestion: GameCatQuestionPayload | null;
  catReveal: GameCatRevealPayload | null;
  catTimerRemaining: number;
  catAnswered: boolean;
  // end
  gameOver: boolean;
  winnerTeamId: string | null;
  // actions
  buzz: () => void;
  submitAnswer: (answer: string) => void;
  nextQuestion: () => void;
  chooseCategories: (indices: number[]) => void;
  submitCategoryAnswer: (answer: string) => void;
  clearError: () => void;
}

export function useActualGame(roomCode: string, myId: string, isHostInit: boolean, initialPlayers: Player[], initialSnapshot?: GameSnapshot): ActualGameHook {
  const socket = useSocket();

  const [gameState, setGameState] = useState<GameState>(initialSnapshot?.gameState ?? "LOBBY");
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(isHostInit);
  const [error, setError] = useState<string | null>(null);

  const [quarter, setQuarter] = useState(0);
  const [quarterName, setQuarterName] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);

  const [revealedWords, setRevealedWords] = useState<string[]>([]);
  const [isPastPowerMark, setIsPastPowerMark] = useState(false);
  const [buzzStatus, setBuzzStatus] = useState<GameBuzzPayload | null>(null);
  const [answerTimerRemaining, setAnswerTimerRemaining] = useState(0);
  const [buzzWindowRemaining, setBuzzWindowRemaining] = useState(0);
  const [lockedTeamIds, setLockedTeamIds] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<GameAnswerResultPayload | null>(null);
  const [questionEnd, setQuestionEnd] = useState<GameQuestionEndPayload | null>(null);

  const [bonus, setBonus] = useState<BonusQuestionPayload | null>(null);
  const [bonusAnswered, setBonusAnswered] = useState(false);

  const [catChoices, setCatChoices] = useState<GameCatChoicesPayload | null>(null);
  const [catQuestion, setCatQuestion] = useState<GameCatQuestionPayload | null>(null);
  const [catReveal, setCatReveal] = useState<GameCatRevealPayload | null>(null);
  const [catTimerRemaining, setCatTimerRemaining] = useState(0);
  const [catAnswered, setCatAnswered] = useState(false);

  const [winnerTeamId, setWinnerTeamId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const windowRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const catTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    function clearAnswerTimer() { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }
    function clearWindow() { if (windowRef.current) { clearInterval(windowRef.current); windowRef.current = null; } setBuzzWindowRemaining(0); }
    function clearCatTimer() { if (catTimerRef.current) { clearInterval(catTimerRef.current); catTimerRef.current = null; } }

    function startAnswerCountdown(seconds: number) {
      clearAnswerTimer();
      setAnswerTimerRemaining(seconds);
      timerRef.current = setInterval(() => {
        setAnswerTimerRemaining((t) => { if (t <= 1) { clearAnswerTimer(); return 0; } return t - 1; });
      }, 1000);
    }
    function startCatCountdown(seconds: number) {
      clearCatTimer();
      setCatTimerRemaining(seconds);
      catTimerRef.current = setInterval(() => {
        setCatTimerRemaining((t) => { if (t <= 1) { clearCatTimer(); return 0; } return t - 1; });
      }, 1000);
    }

    function applyTeams(t: Team[]) {
      setTeams(t);
      const mine = t.find((tm) => tm.memberIds.includes(myId));
      if (mine) setMyTeamId(mine.id);
    }

    function onPlayerJoined({ players: p }: PlayerJoinedPayload) { setPlayers(p); }
    function onPlayerLeft({ players: p }: PlayerLeftPayload) { setPlayers(p); }
    function onHostChanged({ newHostId }: HostChangedPayload) { if (newHostId === myId) setIsHost(true); }
    function onTeamsUpdated({ teams: t }: TeamsUpdatedPayload) { applyTeams(t); }

    function onQuarterStarted(p: QuarterStartedPayload) {
      setQuarter(p.quarter);
      setQuarterName(p.name);
      setQuestionCount(p.questionCount);
      setQuestionIndex(0);
      applyTeams(p.teams);
      // Reset per-question UI; the follow-up event sets the concrete state.
      setRevealedWords([]); setIsPastPowerMark(false); setBuzzStatus(null);
      setLastResult(null); setQuestionEnd(null); setLockedTeamIds([]);
      setBonus(null); setBonusAnswered(false);
      setCatQuestion(null); setCatReveal(null);
      clearAnswerTimer(); clearWindow(); clearCatTimer();
    }

    function onGameQuestionStart(p: GameQuestionStartPayload) {
      setQuarter(p.quarter);
      setQuestionIndex(p.questionIndex);
      setQuestionCount(p.count);
      setRevealedWords([]); setIsPastPowerMark(false); setBuzzStatus(null);
      setLastResult(null); setQuestionEnd(null); setLockedTeamIds([]);
      setBonus(null); setBonusAnswered(false);
      clearAnswerTimer(); clearWindow();
      setGameState("READING");
    }

    function onWordRevealed({ word, isPowerMark }: WordRevealedPayload) {
      const display = word === "(*)" ? null : word.replace("(*)", "");
      if (display !== null) setRevealedWords((prev) => [...prev, display]);
      if (isPowerMark) setIsPastPowerMark(true);
    }

    function onBuzzWindow({ seconds }: BuzzWindowPayload) {
      if (windowRef.current) clearInterval(windowRef.current);
      setBuzzWindowRemaining(seconds);
      windowRef.current = setInterval(() => {
        setBuzzWindowRemaining((t) => { if (t <= 1) { clearInterval(windowRef.current!); windowRef.current = null; return 0; } return t - 1; });
      }, 1000);
    }

    function onGameBuzz(p: GameBuzzPayload) {
      clearWindow();
      setBuzzStatus(p);
      setGameState("ANSWER_PHASE");
      startAnswerCountdown(p.timerSeconds);
    }

    function onGameAnswerResult(p: GameAnswerResultPayload) {
      clearAnswerTimer();
      setLastResult(p);
      applyTeams(p.teams);
      if (p.lockedTeamId) setLockedTeamIds((prev) => (prev.includes(p.lockedTeamId!) ? prev : [...prev, p.lockedTeamId!]));
      if (p.resume) { setBuzzStatus(null); setGameState("READING"); }
      else { setBuzzStatus(null); }
    }

    function onBonusQuestion(p: BonusQuestionPayload) {
      setBonus(p);
      setBonusAnswered(false);
      setBuzzStatus(null);
      setGameState("GAME_BONUS");
      startAnswerCountdown(p.timerSeconds);
    }

    function onGameQuestionEnd(p: GameQuestionEndPayload) {
      clearAnswerTimer(); clearWindow();
      setBuzzStatus(null);
      setBonus(null);
      applyTeams(p.teams);
      setQuestionEnd(p);
      setGameState("BETWEEN");
    }

    function onGameCatChoices(p: GameCatChoicesPayload) {
      setCatChoices(p);
      setCatQuestion(null);
      setCatReveal(null);
      setGameState("GAME_CAT_SELECT");
    }

    function onGameCatQuestion(p: GameCatQuestionPayload) {
      setCatQuestion(p);
      setCatReveal(null);
      setCatAnswered(false);
      setGameState("GAME_CAT_PLAYING");
      startCatCountdown(p.timerSeconds);
    }

    function onGameCatReveal(p: GameCatRevealPayload) {
      clearCatTimer();
      setCatTimerRemaining(0);
      setCatReveal(p);
      applyTeams(p.teams);
    }

    function onGameEnd(p: GameEndPayload) {
      clearAnswerTimer(); clearWindow(); clearCatTimer();
      applyTeams(p.teams);
      setWinnerTeamId(p.winnerTeamId);
      setGameState("GAME_END");
    }

    function onSync(s: SyncPayload) {
      setPlayers(s.players);
      setTeams(s.teams);
      setMyTeamId(s.myTeamId);
      setRevealedWords((prev) => (s.revealedWords.length >= prev.length ? s.revealedWords : prev));
      setIsPastPowerMark(s.isPastPowerMark);
      setGameState((prev) => (prev === "ANSWER_PHASE" || prev === "BUZZED" ? prev : s.gameState));
      if (s.quarter != null) setQuarter(s.quarter);
      if (s.quarterName != null) setQuarterName(s.quarterName);
      setLockedTeamIds(s.lockedTeamIds ?? []);
      setBonus(s.bonus ?? null);
      setCatChoices(s.gameCatChoices ?? null);
      if (s.gameCatQuestion) setCatQuestion(s.gameCatQuestion);
      setWinnerTeamId(s.winnerTeamId ?? null);
    }

    function onError({ message }: ErrorPayload) {
      setError(message);
      setTimeout(() => setError(null), 3500);
    }

    socket.on(E.S_PLAYER_JOINED, onPlayerJoined);
    socket.on(E.S_PLAYER_LEFT, onPlayerLeft);
    socket.on(E.S_HOST_CHANGED, onHostChanged);
    socket.on(E.S_TEAMS_UPDATED, onTeamsUpdated);
    socket.on(E.S_WORD_REVEALED, onWordRevealed);
    socket.on(E.S_BUZZ_WINDOW, onBuzzWindow);
    socket.on(E.S_QUARTER_STARTED, onQuarterStarted);
    socket.on(E.S_GAME_QUESTION_START, onGameQuestionStart);
    socket.on(E.S_GAME_BUZZ, onGameBuzz);
    socket.on(E.S_GAME_ANSWER_RESULT, onGameAnswerResult);
    socket.on(E.S_BONUS_QUESTION, onBonusQuestion);
    socket.on(E.S_GAME_QUESTION_END, onGameQuestionEnd);
    socket.on(E.S_GAME_CAT_CHOICES, onGameCatChoices);
    socket.on(E.S_GAME_CAT_QUESTION, onGameCatQuestion);
    socket.on(E.S_GAME_CAT_REVEAL, onGameCatReveal);
    socket.on(E.S_GAME_END, onGameEnd);
    socket.on(E.S_SYNC, onSync);
    socket.on(E.S_ERROR, onError);

    if (roomCode) socket.emit(E.C_SYNC, { roomCode });

    return () => {
      socket.off(E.S_PLAYER_JOINED, onPlayerJoined);
      socket.off(E.S_PLAYER_LEFT, onPlayerLeft);
      socket.off(E.S_HOST_CHANGED, onHostChanged);
      socket.off(E.S_TEAMS_UPDATED, onTeamsUpdated);
      socket.off(E.S_WORD_REVEALED, onWordRevealed);
      socket.off(E.S_BUZZ_WINDOW, onBuzzWindow);
      socket.off(E.S_QUARTER_STARTED, onQuarterStarted);
      socket.off(E.S_GAME_QUESTION_START, onGameQuestionStart);
      socket.off(E.S_GAME_BUZZ, onGameBuzz);
      socket.off(E.S_GAME_ANSWER_RESULT, onGameAnswerResult);
      socket.off(E.S_BONUS_QUESTION, onBonusQuestion);
      socket.off(E.S_GAME_QUESTION_END, onGameQuestionEnd);
      socket.off(E.S_GAME_CAT_CHOICES, onGameCatChoices);
      socket.off(E.S_GAME_CAT_QUESTION, onGameCatQuestion);
      socket.off(E.S_GAME_CAT_REVEAL, onGameCatReveal);
      socket.off(E.S_GAME_END, onGameEnd);
      socket.off(E.S_SYNC, onSync);
      socket.off(E.S_ERROR, onError);
      if (timerRef.current) clearInterval(timerRef.current);
      if (windowRef.current) clearInterval(windowRef.current);
      if (catTimerRef.current) clearInterval(catTimerRef.current);
    };
  }, [socket, myId, roomCode]);

  const buzz = useCallback(() => {
    socket.emit(E.C_BUZZ, { roomCode, wordIndex: revealedWords.length, timestamp: Date.now() });
  }, [socket, roomCode, revealedWords.length]);

  const submitAnswer = useCallback((answer: string) => {
    socket.emit(E.C_SUBMIT_ANSWER, { roomCode, answer });
    if (gameState === "GAME_BONUS") {
      setBonusAnswered(true); // keep the bonus panel showing "locked in"
    } else {
      setBuzzStatus(null);
      setGameState("BETWEEN"); // hide the buzz panel until the result arrives
    }
  }, [socket, roomCode, gameState]);

  const nextQuestion = useCallback(() => {
    socket.emit(E.C_NEXT_QUESTION, { roomCode });
  }, [socket, roomCode]);

  const chooseCategories = useCallback((indices: number[]) => {
    socket.emit(E.C_CHOOSE_CATEGORIES, { roomCode, indices });
  }, [socket, roomCode]);

  const submitCategoryAnswer = useCallback((answer: string) => {
    socket.emit(E.C_SUBMIT_CATEGORY_ANSWER, { roomCode, answer });
    setCatAnswered(true);
  }, [socket, roomCode]);

  const lockedOut = myTeamId != null && lockedTeamIds.includes(myTeamId);

  return {
    gameState, players, teams, myId, myTeamId, isHost, roomCode, error,
    quarter, quarterName, questionIndex, questionCount,
    revealedWords, isPastPowerMark, buzzStatus, answerTimerRemaining, buzzWindowRemaining, lockedOut, lastResult, questionEnd,
    bonus, bonusAnswered,
    catChoices, catQuestion, catReveal, catTimerRemaining, catAnswered,
    gameOver: gameState === "GAME_END", winnerTeamId,
    buzz, submitAnswer, nextQuestion, chooseCategories, submitCategoryAnswer, clearError,
  };
}
