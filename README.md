# History Bowl

A Protobowl-style real-time multiplayer quiz app for **IAC National History Bowl** questions.
Players join a room, a tossup is read word-by-word, and the first to buzz in (Space) and type
the right answer scores. Built with React + Vite (client) and Node.js + Express + Socket.io (server).

## Questions

The app ships with **8,465 real tossups** parsed from every IAC National History Bowl packet
published on the [IAC resources page](https://www.iacompetitions.com/resources-national-history-bowl/)
(regional A/B/C sets and national championships, 2014–2015 through 2024), bundled in
`server/src/questions/iacQuestions.json`. Each game serves a freshly shuffled pool, and the
power-mark threshold (+15 vs +10) uses the real `(+)`/`(*)` mark from each packet when present.

## Scoring

- Correct, early buzz (first half of the question): **+15** (power)
- Correct, later buzz: **+10**
- Wrong answer: **0** (no penalty) — you're locked out of that question only

## Prerequisites

You need **Node.js 18+** installed (it is not currently on this machine).
Install it from <https://nodejs.org> or via Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node
```

## Run it

```bash
cd history-bowl
npm install          # installs client + server workspaces
npm run dev          # starts server (:3001) and client (:5173) together
```

Then open <http://localhost:5173> in two browser tabs:
1. Tab 1: enter a name → **Create** → note the 4-letter room code.
2. Tab 2: enter a name + the room code → **Join**.
3. Host clicks **Start Game**. Press **Space** to buzz, type your answer, hit Enter.

## Project layout

- `shared/` — types, socket event names, constants shared by client and server
- `server/src/game/GameController.ts` — game state machine + word-reveal loop + scoring
- `server/src/utils/answerValidator.ts` — fuzzy answer matching (handles IAC `(or …)` answer lines)
- `server/src/questions/` — bundled IAC questions + shuffler
- `client/src/hooks/useGame.ts` — all client game state, driven by socket events
- `client/src/pages/` — Home, Lobby, Game
