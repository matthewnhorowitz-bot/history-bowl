// Client → Server
export const C_CREATE_ROOM = "create-room";
export const C_JOIN_ROOM = "join-room";
export const C_START_GAME = "start-game";
export const C_BUZZ = "buzz";
export const C_SUBMIT_ANSWER = "submit-answer";
export const C_NEXT_QUESTION = "next-question";
export const C_LEAVE_ROOM = "leave-room";
export const C_SYNC = "sync";

// Server → Client
export const S_ROOM_JOINED = "room-joined";
export const S_PLAYER_JOINED = "player-joined";
export const S_PLAYER_LEFT = "player-left";
export const S_GAME_STARTED = "game-started";
export const S_WORD_REVEALED = "word-revealed";
export const S_BUZZ_WINDOW = "buzz-window";
export const S_BUZZ_ACCEPTED = "buzz-accepted";
export const S_PROMPT = "prompt";
export const S_ANSWER_RESULT = "answer-result";
export const S_READING_RESUMED = "reading-resumed";
export const S_QUESTION_END = "question-end";
export const S_ERROR = "error";
export const S_HOST_CHANGED = "host-changed";
export const S_SYNC = "sync-state";
