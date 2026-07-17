// Client → Server
export const C_CREATE_ROOM = "create-room";
export const C_JOIN_ROOM = "join-room";
export const C_START_GAME = "start-game";
export const C_BUZZ = "buzz";
export const C_SUBMIT_ANSWER = "submit-answer";
export const C_NEXT_QUESTION = "next-question";
export const C_LEAVE_ROOM = "leave-room";
export const C_SYNC = "sync";
export const C_SET_MODE = "set-mode";
export const C_CHOOSE_CATEGORIES = "choose-categories";
export const C_SUBMIT_CATEGORY_ANSWER = "submit-category-answer";
export const C_CREATE_TEAM = "create-team";
export const C_JOIN_TEAM = "join-team";
export const C_LEAVE_TEAM = "leave-team";
export const C_SET_DIFFICULTY = "set-difficulty";
export const C_SET_AI = "set-ai"; // host picks the solo AI opponent tier (null = none)
export const C_NEW_GAME = "new-game"; // host restarts from the ending screen → back to lobby

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
export const S_MODE_CHANGED = "mode-changed";
export const S_DIFFICULTY_CHANGED = "difficulty-changed";
export const S_AI_CHANGED = "ai-changed";
export const S_CATEGORY_CHOICES = "category-choices";
export const S_CATEGORY_QUESTION = "category-question";
export const S_CATEGORY_REVEAL = "category-reveal";
export const S_CATEGORY_END = "category-end";
export const S_TEAMS_UPDATED = "teams-updated";

// Server → Client — "Actual Game" (four-quarter) mode
export const S_QUARTER_STARTED = "quarter-started";
export const S_GAME_QUESTION_START = "game-question-start"; // new buzz question within a quarter
export const S_GAME_BUZZ = "game-buzz";               // buzz accepted (team-aware)
export const S_GAME_ANSWER_RESULT = "game-answer-result";
export const S_BONUS_QUESTION = "bonus-question";     // Q2 bonus offered to the winning team
export const S_BONUS_WORD = "bonus-word";             // Q2 bonus being read out, one word at a time
export const S_BONUS_READY = "bonus-ready";           // Q2 bonus finished reading — answer window opens
export const S_GAME_QUESTION_END = "game-question-end";
export const S_GAME_CAT_CHOICES = "game-cat-choices"; // Q3 category selection (losing team picks first)
export const S_GAME_CAT_QUESTION = "game-cat-question";
export const S_GAME_CAT_REVEAL = "game-cat-reveal";
export const S_GAME_END = "game-end";
export const S_RETURN_TO_LOBBY = "return-to-lobby"; // sends everyone back to the lobby for a new game
