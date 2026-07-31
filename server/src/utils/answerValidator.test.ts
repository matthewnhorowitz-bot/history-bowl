// Answer-judging tests. Run with:  npx tsx server/src/utils/answerValidator.test.ts
//
// Every answer line below is copied verbatim from the bundled IAC packets, so
// these are the shapes the judge actually meets in a game.
import { judgeAnswer, isAcceptable, type Verdict } from "./answerValidator";

type Case = [answerLine: string, input: string, expected: Verdict, note?: string];

// ---------------------------------------------------------------------------
// 1. Plain right and wrong answers
// ---------------------------------------------------------------------------
const basics: Case[] = [
  ["Nero [or Nero Claudius Caesar Augustus Germanicus]", "Nero", "correct"],
  ["Nero [or Nero Claudius Caesar Augustus Germanicus]", "Nero Claudius Caesar", "correct"],
  ["Nero [or Nero Claudius Caesar Augustus Germanicus]", "Caligula", "incorrect"],
  ["Mitt Romney", "Mitt Romney", "correct"],
  ["Mitt Romney", "Romney", "correct", "surname alone is enough"],
  ["Mitt Romney", "Barack Obama", "incorrect"],
  ["Valley Forge", "Valley Forge", "correct"],
  ["Valley Forge", "", "incorrect", "empty buzz"],
  ["Valley Forge", "   ", "incorrect"],
  // Typos should still score.
  ["Mitt Romney", "Romney", "correct", "transposition"],
  ["Valley Forge", "Vally Forge", "correct"],
  ["Constantinople", "Constantinopel", "correct"],
  ["Mesopotamia", "Mesapotamia", "correct"],
  // ...but a different answer that happens to be spelled similarly must not.
  ["Qing [cheeng] dynasty (accept Manchus before read; do not accept Qin [cheen])", "Qing", "correct"],
  ["Qing [cheeng] dynasty (accept Manchus before read; do not accept Qin [cheen])", "Qin", "incorrect"],
  ["Austria", "Australia", "incorrect", "one letter apart, different country"],
  ["Iraq", "Iran", "incorrect"],
];

// ---------------------------------------------------------------------------
// 2. Accents and punctuation
// ---------------------------------------------------------------------------
const orthography: Case[] = [
  ["Napoléon Bonaparte", "Napoleon Bonaparte", "correct"],
  ["Napoléon Bonaparte", "napoleon bonaparte", "correct"],
  ["Wade-Davis Bill of 1864 (do not accept mentions of an Act or Law, because it didn't pass)", "Wade-Davis Bill", "correct"],
  ["Wade-Davis Bill of 1864 (do not accept mentions of an Act or Law, because it didn't pass)", "wade davis bill", "correct", "hyphen typed as space"],
  ["Wade-Davis Bill of 1864 (do not accept mentions of an Act or Law, because it didn't pass)", "WadeDavis", "correct"],
  ["Plessy v. Ferguson (accept either or both underlined portions)", "Plessy v Ferguson", "correct"],
  ["Plessy v. Ferguson (accept either or both underlined portions)", "plessy vs ferguson", "correct"],
  ["The Coca-Cola Company (prompt on \"Coke\")", "Coca-Cola", "correct"],
  ["The Coca-Cola Company (prompt on \"Coke\")", "coca cola", "correct"],
];

// ---------------------------------------------------------------------------
// 3. "do not accept" — the writer's explicit negative must be honoured.
//    These are the cases the old judge got backwards.
// ---------------------------------------------------------------------------
const negatives: Case[] = [
  ["Nation of Islam (accept NOI, do not accept or prompt on just \"Islam\")", "Islam", "incorrect"],
  ["Nation of Islam (accept NOI, do not accept or prompt on just \"Islam\")", "Nation of Islam", "correct"],
  ["Nation of Islam (accept NOI, do not accept or prompt on just \"Islam\")", "NOI", "correct"],
  ["Napoléon III (or Louis-Napoléon Bonaparte, do not accept or prompt on Napoléon)", "Napoleon", "incorrect"],
  ["Napoléon III (or Louis-Napoléon Bonaparte, do not accept or prompt on Napoléon)", "Napoleon III", "correct"],
  ["Napoléon III (or Louis-Napoléon Bonaparte, do not accept or prompt on Napoléon)", "Louis-Napoleon Bonaparte", "correct"],
  ["Zeus (do not accept or prompt on \"Jupiter\")", "Jupiter", "incorrect"],
  ["Poseidon (do not accept or prompt on \"Neptune\")", "Neptune", "incorrect"],
  ["Republic of Turkey (do not accept or prompt on the Ottoman Empire)", "Ottoman Empire", "incorrect"],
  ["Republic of Turkey (do not accept or prompt on the Ottoman Empire)", "Turkey", "correct"],
  ["Anabaptism (accept Anabaptists, do not accept or prompt on Baptists or similar answers) Page 1", "Baptists", "incorrect"],
  ["Anabaptism (accept Anabaptists, do not accept or prompt on Baptists or similar answers) Page 1", "Anabaptists", "correct"],
  ["Leningrad (prompt on St. Petersburg before mentioned; do not accept or prompt Petrograd)", "Petrograd", "incorrect"],
  ["Leningrad (prompt on St. Petersburg before mentioned; do not accept or prompt Petrograd)", "Leningrad", "correct"],
  ["Cuban cigars (prompt on tobacco; do not accept cigarettes)", "cigarettes", "incorrect"],
  ["ammonia (accept NH before mentioned; do not accept ammonium) 3", "ammonium", "incorrect"],
  ["ammonia (accept NH before mentioned; do not accept ammonium) 3", "ammonia", "correct"],
  ["1793 yellow fever epidemic in Philadelphia (accept equivalents to \"epidemic\", do not accept \"pandemic\")", "yellow fever pandemic", "incorrect"],
  ["indentured servants [prompt on servants; do not accept \"slaves\"] <JB>", "slaves", "incorrect"],
  ["indentured servants [prompt on servants; do not accept \"slaves\"] <JB>", "indentured servants", "correct"],
  // A negative must not veto the real answer that contains it.
  ["George Herbert Walker Bush (accept Bush the Elder or Bush the 41st; prompt on (George) Bush; do not accept \"George Walker Bush\" or George W. Bush)", "George Herbert Walker Bush", "correct"],
  ["George Herbert Walker Bush (accept Bush the Elder or Bush the 41st; prompt on (George) Bush; do not accept \"George Walker Bush\" or George W. Bush)", "George Walker Bush", "incorrect"],
];

// ---------------------------------------------------------------------------
// 4. "prompt on X" — a second chance, never an outright score.
// ---------------------------------------------------------------------------
const prompts: Case[] = [
  ["Samuel Adams (prompt on \"Adams\")", "Adams", "prompt"],
  ["Samuel Adams (prompt on \"Adams\")", "Samuel Adams", "correct"],
  ["The Coca-Cola Company (prompt on \"Coke\")", "Coke", "prompt"],
  ["Mughal Empire (or Mughals; prompt on \"India\" before mentioned)", "India", "prompt"],
  ["Mughal Empire (or Mughals; prompt on \"India\" before mentioned)", "Mughals", "correct"],
  ["Babylonia or Babylonian empire (prompt on Mesopotamia before mentioned)", "Mesopotamia", "prompt"],
  ["Babylonia or Babylonian empire (prompt on Mesopotamia before mentioned)", "Babylonia", "correct"],
  ["Cuban cigars (prompt on tobacco; do not accept cigarettes)", "tobacco", "prompt"],
  ["Ethiopian Jews (accept Beta Israel; accept Falash Mura or Falashas before \"Falash\"; prompt on \"Jews\")", "Jews", "prompt"],
  ["Ethiopian Jews (accept Beta Israel; accept Falash Mura or Falashas before \"Falash\"; prompt on \"Jews\")", "Beta Israel", "correct"],
  ["Chinese-Americans (prompt on \"Asian\" or \"Asian-American\" before mentioned)", "Asian-American", "prompt"],
];

// ---------------------------------------------------------------------------
// 5. Meta-instructions ("accept either underlined portion") are directions to a
//    human moderator, not literal answers. They must never be matchable text.
// ---------------------------------------------------------------------------
const metaClauses: Case[] = [
  ["Mustafa Kemal Ataturk (accept either or both underlined names) Page 1", "portion", "incorrect"],
  ["Mustafa Kemal Ataturk (accept either or both underlined names) Page 1", "underlined names", "incorrect"],
  ["Mustafa Kemal Ataturk (accept either or both underlined names) Page 1", "Ataturk", "correct"],
  ["Plessy v. Ferguson (accept either or both underlined portions)", "either", "incorrect"],
  ["Plessy v. Ferguson (accept either or both underlined portions)", "Plessy", "correct"],
  ["political cartoons (prompt on partial answers)", "answers", "incorrect"],
  ["political cartoons (prompt on partial answers)", "political cartoons", "correct"],
  ["Darkest Hour (do not accept additional information)", "Darkest Hour", "correct"],
  ["The Rumble in the Jungle (accept descriptive answers of Muhammad Ali's victory over George Foreman in the Republic of Zaire)", "descriptive answers", "incorrect"],
  ["golfing (accept anything related to golf, including more specific responses, like swinging a golf club, teeing off, etc.) Page 2", "anything", "incorrect"],
  ["golfing (accept anything related to golf, including more specific responses, like swinging a golf club, teeing off, etc.) Page 2", "golfing", "correct"],
  ["Elvis Presley (or Elvis Aaron Presley; accept either underline portion)", "Presley", "correct"],
  // "Page N" is a PDF footer that leaked into the answer text; never matchable.
  ["Mustafa Kemal Ataturk (accept either or both underlined names) Page 1", "Page 1", "incorrect"],
  ["Anabaptism (accept Anabaptists, do not accept or prompt on Baptists or similar answers) Page 1", "page", "incorrect"],
];

// ---------------------------------------------------------------------------
// 6. Regnal / ordinal numbers — the name alone must not score.
// ---------------------------------------------------------------------------
const numbers: Case[] = [
  ["Elizabeth I", "Elizabeth", "prompt"],
  ["Elizabeth I", "Elizabeth I", "correct"],
  ["Elizabeth I", "Elizabeth the First", "correct"],
  ["Elizabeth I", "Elizabeth II", "prompt", "wrong number, right name"],
  ["Henry VIII", "Henry", "prompt"],
  ["Henry VIII", "Henry VIII", "correct"],
  ["Henry VIII", "Henry 8", "correct"],
  ["Henry VIII", "Henry the Eighth", "correct"],
  ["Louis XIV", "Louis XIV", "correct"],
  ["Louis XIV", "Louis 14th", "correct"],
  ["World War II", "World War II", "correct"],
  ["World War II", "World War I", "prompt"],
  ["World War II", "the Second World War", "correct"],
  // Acronyms must not be read as Roman numerals.
  ["CIA", "CIA", "correct"],
  ["NATO", "NATO", "correct"],
  ["Washington, D.C.", "Washington DC", "correct"],
];

// ---------------------------------------------------------------------------
// 7. Partial answers. A surname identifies a person; a lone generic noun does
//    not identify anything, and should buy another try rather than points.
// ---------------------------------------------------------------------------
const partials: Case[] = [
  ["George Washington", "Washington", "correct", "surname"],
  ["George Washington", "George", "prompt", "given name alone"],
  ["John Quincy Adams", "Quincy Adams", "correct"],
  ["John Quincy Adams", "John", "prompt"],
  ["Martin Luther King, Jr.", "King", "correct"],
  ["Franklin Delano Roosevelt", "Roosevelt", "correct"],
  ["Franklin Delano Roosevelt", "Franklin", "prompt"],
  ["September 11th attacks (or 9/11)", "attacks", "prompt", "generic noun alone"],
  ["September 11th attacks (or 9/11)", "September 11", "correct"],
  ["September 11th attacks (or 9/11)", "9/11", "correct"],
  ["Mason-Dixon line", "Mason-Dixon", "correct"],
  ["Mason-Dixon line", "line", "incorrect"],
  ["Battle of Gettysburg", "Gettysburg", "correct"],
  ["Battle of Gettysburg", "battle", "incorrect"],
  ["Ming dynasty", "Ming", "correct"],
  ["Ming dynasty", "dynasty", "incorrect"],
  ["Treaty of Versailles", "Versailles", "correct"],
  ["Roman Republic", "Republic", "incorrect"],
  ["Boston Massacre", "Boston", "prompt", "place alone, ambiguous"],
  ["Boston Massacre", "Boston Massacre", "correct"],
  // Court cases: either party names the case.
  ["Gideon v. Wainwright", "Wainwright", "correct"],
  ["Gideon v. Wainwright", "Gideon", "correct"],
  ["Gideon v. Wainwright", "Marbury", "incorrect"],
  ["Brown v. Board of Education", "Brown", "correct"],
  // Titles of works are identified by the name, not the form.
  ["The Tragedy of Macbeth", "Macbeth", "correct"],
  ["I Have a Dream speech", "I Have a Dream", "correct"],
  // Classifier nouns still identify nothing on their own.
  ["Southern Baptist Convention", "Convention", "incorrect"],
  ["Panama Canal", "Canal", "incorrect"],
  ["Warren Commission", "Commission", "incorrect"],
  ["Exxon Mobil Corporation", "Corporation", "incorrect"],
  // An epithet is not the person.
  ["Suleyman the Magnificent", "Magnificent", "prompt"],
  ["Suleyman the Magnificent", "Suleyman", "correct"],
  // The answer is the event, not its subject.
  ["assassination of Adolf Hitler", "Hitler", "prompt"],
  ["cantons of Switzerland", "Switzerland", "prompt"],
];

const suites: Array<[string, Case[]]> = [
  ["basics", basics],
  ["orthography", orthography],
  ["do not accept", negatives],
  ["prompt", prompts],
  ["meta-instructions", metaClauses],
  ["regnal numbers", numbers],
  ["partial answers", partials],
];

let pass = 0;
const failures: string[] = [];

// Bonuses and Q3 categories score on one submission with no chance to answer a
// prompt, so a promptable answer counts there — but a rejected one never does.
const oneShot: Array<[string, string, boolean]> = [
  ["George Washington", "George", true],
  ["Elizabeth I", "Elizabeth", true],
  ["Samuel Adams (prompt on \"Adams\")", "Adams", true],
  ["Boston Massacre", "Boston", true],
  ["Zeus (do not accept or prompt on \"Jupiter\")", "Jupiter", false],
  ["Nation of Islam (accept NOI, do not accept or prompt on just \"Islam\")", "Islam", false],
  ["Mitt Romney", "Barack Obama", false],
  ["Battle of Gettysburg", "battle", false],
];
for (const [line, input, expected] of oneShot) {
  const actual = isAcceptable(input, line);
  if (actual === expected) pass++;
  else failures.push(`[one-shot rounds] "${input}" vs ${JSON.stringify(line.slice(0, 60))}\n      expected ${expected}, got ${actual}`);
}

for (const [suiteName, cases] of suites) {
  for (const [line, input, expected, note] of cases) {
    let actual: Verdict | string;
    try {
      actual = judgeAnswer(input, line);
    } catch (err) {
      actual = `threw ${(err as Error).message}`;
    }
    if (actual === expected) {
      pass++;
    } else {
      failures.push(
        `[${suiteName}] "${input}" vs ${JSON.stringify(line.slice(0, 72))}\n` +
          `      expected ${expected}, got ${actual}${note ? `   (${note})` : ""}`
      );
    }
  }
}

const total = pass + failures.length;
for (const f of failures) console.log("FAIL  " + f);
console.log(`\n${pass}/${total} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
