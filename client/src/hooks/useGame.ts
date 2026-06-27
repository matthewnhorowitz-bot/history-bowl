import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../context/SocketContext";
import {
  Player, GameState, GameSnapshot, SyncPayload,
  WordRevealedPayload, BuzzAcceptedPayload, AnswerResultPayload,
  QuestionEndPayload, PlayerJoinedPayload, PlayerLeftPayload,
  RoomJoinedPayload, GameStartedPayload, HostChangedPayload,
  ReadingResumedPayload, BuzzWindowPayload, PromptPayload, ErrorPayload,
} from "@shared/types";
import * as E from "@shared/events";

export interface GameHook {
  gameState: GameState;
  players: Player[];
  revealedWords: string[];
  isPastPowerMark: boolean;
  buzzStatus: { buzzedBy: { id: string; name: string }; timerSeconds: number } | null;
  answerTimerRemaining: number;
  buzzWindowRemaining: number;
  promptName: string | null;
  promptCount: number;
  lastResult: AnswerResultPayload | null;
  questionEnd: QuestionEndPayload | null;
  isHost: boolean;
  myId: string;
  roomCode: string;
  questionNumber: number;
  lockedOut: boolean;
  error: string | null;
  buzz: () => void;
  submitAnswer: (answer: string) => void;
  startGame: () => void;
  nextQuestion: () => void;
  clearError: () => void;
}

export function useGame(roomCode: string, myId: string, isHostInit: boolean, initialPlayers: Player[], initialSnapshot?: GameSnapshot): GameHook {
  const socket = useSocket();

  const [gameState, setGameState] = useState<GameState>(initialSnapshot?.gameState ?? "LOBBY");
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [revealedWords, setRevealedWords] = useState<string[]>(initialSnapshot?.revealedWords ?? []);
  const [isPastPowerMark, setIsPastPowerMark] = useState(initialSnapshot?.isPastPowerMark ?? false);
  const [buzzStatus, setBuzzStatus] = useState<GameHook["buzzStatus"]>(null);
  const [answerTimerRemaining, setAnswerTimerRemaining] = useState(0);
  const [buzzWindowRemaining, setBuzzWindowRemaining] = useState(0);
  const [promptName, setPromptName] = useState<string | null>(null);
  const [promptCount, setPromptCount] = useState(0);
  const [lastResult, setLastResult] = useState<AnswerResultPayload | null>(null);
  const [questionEnd, setQuestionEnd] = useState<QuestionEndPayload | null>(null);
  const [isHost, setIsHost] = useState(isHostInit);
  const [questionNumber, setQuestionNumber] = useState(initialSnapshot?.questionNumber ?? 0);
  const [lockedOut, setLockedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const windowRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    function onPlayerJoined({ players: p }: PlayerJoinedPayload) { setPlayers(p); }
    function onPlayerLeft({ players: p }: PlayerLeftPayload) { setPlayers(p); }

    function onHostChanged({ newHostId }: HostChangedPayload) {
      if (newHostId === myId) setIsHost(true);
    }

    function clearWindow() {
      if (windowRef.current) { clearInterval(windowRef.current); windowRef.current = null; }
      setBuzzWindowRemaining(0);
    }

    function onGameStarted({ questionNumber: qn }: GameStartedPayload) {
      setQuestionNumber(qn);
      setRevealedWords([]);
      setIsPastPowerMark(false);
      setBuzzStatus(null);
      setLastResult(null);
      setQuestionEnd(null);
      setLockedOut(false);
      clearWindow();
      setPromptName(null);
      setPromptCount(0);
      setGameState("READING");
    }

    function onBuzzWindow({ seconds }: BuzzWindowPayload) {
      if (windowRef.current) clearInterval(windowRef.current);
      setBuzzWindowRemaining(seconds);
      windowRef.current = setInterval(() => {
        setBuzzWindowRemaining((t) => {
          if (t <= 1) { clearInterval(windowRef.current!); windowRef.current = null; return 0; }
          return t - 1;
        });
      }, 1000);
    }

    function onWordRevealed({ word, isPowerMark }: WordRevealedPayload) {
      const display = word === "(*)" ? null : word.replace("(*)", "");
      if (display !== null) {
        setRevealedWords((prev) => [...prev, display!]);
      }
      if (isPowerMark) setIsPastPowerMark(true);
    }

    function startAnswerCountdown(seconds: number) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAnswerTimerRemaining(seconds);
      timerRef.current = setInterval(() => {
        setAnswerTimerRemaining((t) => {
          if (t <= 1) { clearInterval(timerRef.current!); return 0; }
          return t - 1;
        });
      }, 1000);
    }

    function onBuzzAccepted({ buzzedBy, timerSeconds }: BuzzAcceptedPayload) {
      clearWindow();
      setPromptName(null);
      setPromptCount(0);
      setBuzzStatus({ buzzedBy, timerSeconds });
      setGameState("ANSWER_PHASE");
      startAnswerCountdown(timerSeconds);
    }

    // Close answer / "prompt on X" — same player gets another try.
    function onPrompt({ buzzedBy, timerSeconds }: PromptPayload) {
      setPromptName(buzzedBy.name);
      setPromptCount((c) => c + 1);
      setBuzzStatus({ buzzedBy, timerSeconds });
      setGameState("ANSWER_PHASE");
      startAnswerCountdown(timerSeconds);
    }

    function applyScores(scores: Record<string, number>) {
      setPlayers((prev) => prev.map((p) => (p.id in scores ? { ...p, score: scores[p.id] } : p)));
    }

    function onAnswerResult(result: AnswerResultPayload) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setPromptName(null);
      setLastResult(result);
      applyScores(result.scores);
      if (!result.correct && result.buzzedBy.id === myId) setLockedOut(true);
      if (!result.resumeReading) setBuzzStatus(null);
    }

    function onReadingResumed(_: ReadingResumedPayload) {
      clearWindow();
      setPromptName(null);
      setBuzzStatus(null);
      setGameState("READING");
    }

    function onQuestionEnd(payload: QuestionEndPayload) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      clearWindow();
      setPromptName(null);
      setBuzzStatus(null);
      // Keep lastResult so the end-of-question overlay can show right/wrong.
      // It's reset at the start of the next question by onGameStarted.
      applyScores(payload.scores);
      setQuestionEnd(payload);
      setGameState("BETWEEN");
    }

    // Authoritative catch-up from the server when we (re)enter the game.
    function onSync(s: SyncPayload) {
      setPlayers(s.players);
      setQuestionNumber(s.questionNumber);
      setRevealedWords((prev) => (s.revealedWords.length >= prev.length ? s.revealedWords : prev));
      setIsPastPowerMark(s.isPastPowerMark);
      // Adopt the server's authoritative phase on mount, but never yank a player
      // out of actively answering.
      setGameState((prev) => (prev === "ANSWER_PHASE" || prev === "BUZZED" ? prev : s.gameState));
    }

    function onError({ message }: ErrorPayload) {
      setError(message);
      setTimeout(() => setError(null), 3500);
    }

    socket.on(E.S_PLAYER_JOINED, onPlayerJoined);
    socket.on(E.S_PLAYER_LEFT, onPlayerLeft);
    socket.on(E.S_HOST_CHANGED, onHostChanged);
    socket.on(E.S_GAME_STARTED, onGameStarted);
    socket.on(E.S_WORD_REVEALED, onWordRevealed);
    socket.on(E.S_BUZZ_WINDOW, onBuzzWindow);
    socket.on(E.S_BUZZ_ACCEPTED, onBuzzAccepted);
    socket.on(E.S_PROMPT, onPrompt);
    socket.on(E.S_ANSWER_RESULT, onAnswerResult);
    socket.on(E.S_READING_RESUMED, onReadingResumed);
    socket.on(E.S_QUESTION_END, onQuestionEnd);
    socket.on(E.S_SYNC, onSync);
    socket.on(E.S_ERROR, onError);

    // Pull authoritative state immediately on mount (covers the lobby→game
    // navigation race, reloads, and late joins).
    if (roomCode) socket.emit(E.C_SYNC, { roomCode });

    return () => {
      socket.off(E.S_PLAYER_JOINED, onPlayerJoined);
      socket.off(E.S_PLAYER_LEFT, onPlayerLeft);
      socket.off(E.S_HOST_CHANGED, onHostChanged);
      socket.off(E.S_GAME_STARTED, onGameStarted);
      socket.off(E.S_WORD_REVEALED, onWordRevealed);
      socket.off(E.S_BUZZ_WINDOW, onBuzzWindow);
      socket.off(E.S_BUZZ_ACCEPTED, onBuzzAccepted);
      socket.off(E.S_PROMPT, onPrompt);
      socket.off(E.S_ANSWER_RESULT, onAnswerResult);
      socket.off(E.S_READING_RESUMED, onReadingResumed);
      socket.off(E.S_QUESTION_END, onQuestionEnd);
      socket.off(E.S_SYNC, onSync);
      socket.off(E.S_ERROR, onError);
      if (timerRef.current) clearInterval(timerRef.current);
      if (windowRef.current) clearInterval(windowRef.current);
    };
  }, [socket, myId, roomCode]);

  const buzz = useCallback(() => {
    socket.emit(E.C_BUZZ, { roomCode, wordIndex: revealedWords.length, timestamp: Date.now() });
  }, [socket, roomCode, revealedWords.length]);

  const submitAnswer = useCallback((answer: string) => {
    socket.emit(E.C_SUBMIT_ANSWER, { roomCode, answer });
    setBuzzStatus(null);
    setGameState("BETWEEN");
  }, [socket, roomCode]);

  const startGame = useCallback(() => {
    socket.emit(E.C_START_GAME, { roomCode });
  }, [socket, roomCode]);

  const nextQuestion = useCallback(() => {
    socket.emit(E.C_NEXT_QUESTION, { roomCode });
  }, [socket, roomCode]);

  return {
    gameState, players, revealedWords, isPastPowerMark,
    buzzStatus, answerTimerRemaining, buzzWindowRemaining, promptName, promptCount, lastResult, questionEnd,
    isHost, myId, roomCode, questionNumber, lockedOut, error,
    buzz, submitAnswer, startGame, nextQuestion, clearError,
  };
}
