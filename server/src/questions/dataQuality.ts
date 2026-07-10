// Some question/bonus text was parsed from PDFs and occasionally lost its
// spaces, producing an unreadable run of stuck-together words
// (e.g. "Woodpaintingwhosetitlefigure..."). Entries like that are dropped from
// the playable pools at load time rather than shown to players.
//
// The longest legitimate English words are ~20 characters, so a whitespace-free
// run longer than this threshold reliably flags lost spaces without touching
// normal text.
const MAX_UNBROKEN_RUN = 30;

// True when every provided text is readable (no abnormally long space-less run).
export function isReadable(...texts: string[]): boolean {
  for (const text of texts) {
    if (!text) continue;
    for (const token of text.split(/\s+/)) {
      if (token.length > MAX_UNBROKEN_RUN) return false;
    }
  }
  return true;
}
