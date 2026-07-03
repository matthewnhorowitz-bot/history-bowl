export const WORD_INTERVAL_MS = 213;
export const ANSWER_TIMER_S = 5;
export const END_BUZZ_WINDOW_S = 7; // grace period to buzz after the question finishes reading
export const POWER_SCORE = 15;
export const CORRECT_SCORE = 10;
export const NEG_SCORE = 0; // no penalty for a wrong answer
export const QUESTION_POOL_SIZE = 20;
export const REFETCH_THRESHOLD = 5;

// Third Quarter "category round" mode
export const CATEGORY_TIMER_S = 10; // seconds to answer each category question
export const CATEGORY_SCORE = 10;  // points per correct category answer
export const CATEGORY_REVEAL_MS = 2500; // pause showing the answer between questions

// "Actual Game" mode — full four-quarter two-team match
export const GAME_ANSWER_TIMER_S = 7;  // seconds to answer after buzzing (Q1/Q2/Q4)
export const GAME_TOSSUP_SCORE = 10;   // points for a correct tossup (Q1/Q2)
export const GAME_BONUS_SCORE = 10;    // points for a correct Q2 bonus
export const GAME_BONUS_TIMER_S = 7;   // seconds for the winning team to answer the bonus
export const Q1_COUNT = 10;            // First Quarter tossups
export const Q2_COUNT = 10;            // Second Quarter tossups (each with a bonus)
export const Q4_COUNT = 10;            // Fourth Quarter graduated tossups
export const GAME_CAT_TIMER_S = 10;        // Third Quarter: owner team's answer window
export const GAME_BOUNCEBACK_TIMER_S = 10; // Third Quarter: bounceback window for the other team
export const GAME_CAT_REVEAL_MS = 2500;    // pause showing the answer between Q3 questions

// Fourth Quarter graduated scoring (approximated from a tossup's word positions):
// bold+underline zone → 30, bold zone → 20, normal text → 10.
export const Q4_SCORE_HIGH = 30;
export const Q4_SCORE_MID = 20;
export const Q4_SCORE_LOW = 10;
export const Q4_HIGH_FRACTION = 0.33; // buzz within the first third of the words → 30
