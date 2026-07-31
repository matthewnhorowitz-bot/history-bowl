"""Rebuild the bundled question banks from the IAC History Bowl packet PDFs.

Downloads every packet linked on the IAC resources page (cached under
tools/cache/), parses each one, and writes the three JSON banks the server
loads:

  server/src/questions/iacQuestions.json   tossups (Q1 + Q2 + Q4)
  server/src/questions/iacBonuses.json     Q2 tossup+bonus pairs
  server/src/questions/iacCategories.json  Q3 category trios

Existing entries are never lost: when a re-parse yields fewer tossups for a
packet than the bank already has, the bank's version of that packet is kept.

    pip install pdfplumber requests
    python tools/build_questions.py            # incremental, uses the cache
    python tools/build_questions.py --refresh  # re-download every PDF
"""

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber
import requests

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / "cache"
OUT = ROOT / "server" / "src" / "questions"
RESOURCES_URL = "https://www.iacompetitions.com/resources-national-history-bowl/"
UA = {"User-Agent": "Mozilla/5.0 (history-bowl packet builder)"}

# Watermark glyphs ("DRAFT" stamped across some Nationals packets) are rendered
# at ~300pt behind the text and land mid-word in the extracted reading order.
# Body text is ~11pt and headings ~25pt, so anything larger is decoration.
MAX_BODY_FONT_SIZE = 40

# Matches the server's own readability guard (see questions/dataQuality.ts).
MAX_UNBROKEN_RUN = 35

# A running head appears on this many pages or more; anything that repeats that
# often and is short is page furniture ("NHBB Nationals Bowl 2019-2020 Bowl
# Round 1", "2015 NHB Set A"), not question text.
HEADER_MIN_PAGES = 3
HEADER_MAX_LEN = 70

# A quarter marker is usually a line of its own, but some sets fold it into the
# running head ("NHBB C 2014-2015 - Bowl Round 2 - Second Quarter"), so match
# anywhere within a short line. Sets from 2020-21 on write "Quarter 1" instead.
QUARTER_RE = re.compile(r"\b(?:(First|Second|Third|Fourth)\s+Quarter|Quarter\s+([1-4]))\b",
                        re.IGNORECASE)
QUARTER_NAMES = ["First", "Second", "Third", "Fourth"]
STOP_RE = re.compile(r"\b(Tiebreak\w*|Tie\s*Break\w*|Extra\s+Questions?)\b", re.IGNORECASE)
MARKER_MAX_LEN = 80
# Packets number their questions "(1)" (2016 onwards) or "1." (earlier sets).
NUM_RE = re.compile(r"^\(?(\d{1,2})[).]\s+")
ANSWER_RE = re.compile(r"^ANSWER[:.]?\s*", re.IGNORECASE)
BONUS_RE = re.compile(r"^BONUS[:.]?\s*", re.IGNORECASE)
# Writer credit dropped in after a question, e.g. "[Zihan Zheng]".
CREDIT_RE = re.compile(r"^\[[A-Z][A-Za-z.'\- ]{2,40}\]$")
# A category's lead-in always trails off into its clues: "Which New Deal program…"
INTRO_RE = re.compile(r"(…|\.\.\.)\s*$")


# --------------------------------------------------------------------------
# fetching


def packet_urls():
    html = requests.get(RESOURCES_URL, headers=UA, timeout=60).text
    urls = re.findall(r'href="(https?://[^"]+?\.pdf)"', html, re.IGNORECASE)
    return sorted(set(urls))


def download(url, refresh=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / url.rsplit("/", 1)[-1]
    if path.exists() and path.stat().st_size > 1000 and not refresh:
        return path
    resp = requests.get(url, headers=UA, timeout=120)
    resp.raise_for_status()
    if not resp.content.startswith(b"%PDF"):
        return None
    path.write_bytes(resp.content)
    return path


# --------------------------------------------------------------------------
# text extraction


def long_runs(text):
    """Count space-less runs too long to be a real word — a page whose spaces
    were lost in extraction, which the server would drop as unreadable."""
    return sum(1 for token in text.split() if len(token) > MAX_UNBROKEN_RUN)


def extract_pages(path):
    """Per-page text with the oversized watermark glyphs filtered out.

    Some sets (the 2021-22 C sets especially) set their text so tightly that the
    default word-spacing tolerance runs whole sentences together, so retry those
    pages with a narrower tolerance and keep whichever reads better.
    """
    pages = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            body = page.filter(lambda obj: obj.get("size", 0) <= MAX_BODY_FONT_SIZE
                               if obj["object_type"] == "char" else True)
            text = body.extract_text() or ""
            if long_runs(text):
                retry = body.extract_text(x_tolerance=1.5) or ""
                if long_runs(retry) < long_runs(text):
                    text = retry
            pages.append(text)
    return pages


def running_heads(pages):
    """Short lines that recur across pages — headers, footers, set titles."""
    seen = {}
    for page in pages:
        for line in {ln.strip() for ln in page.splitlines()}:
            if line and len(line) <= HEADER_MAX_LEN:
                seen[line] = seen.get(line, 0) + 1
    return {line for line, n in seen.items() if n >= HEADER_MIN_PAGES}


def clean_lines(pages):
    """Drop running heads, writer credits, and stray watermark debris."""
    heads = running_heads(pages)
    out = []
    for page in pages:
        for line in page.splitlines():
            line = line.strip()
            if not line or line in heads or CREDIT_RE.match(line):
                continue
            # A lone letter or two on its own line is watermark/scoresheet debris.
            if len(line) <= 2 and not line[0].isdigit():
                continue
            out.append(line)
    return out


def join_block(lines):
    """Join wrapped lines into one paragraph, repairing hyphenated breaks."""
    text = ""
    for line in lines:
        if not text:
            text = line
        elif text.endswith("-") and not text.endswith("--"):
            text += line  # "Brest-" + "Litovsk"
        else:
            text += " " + line
    return text


SMART = {
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"',
    "–": "-", "—": "-", "−": "-",
    " ": " ", "ﬁ": "fi", "ﬂ": "fl", "…": "...",
}


def normalize_text(text):
    text = unicodedata.normalize("NFC", text)
    for bad, good in SMART.items():
        text = text.replace(bad, good)
    text = re.sub(r"\[\[[^\]]*\]\]", "", text)      # [[pronunciation guides]]
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def strip_guides(text):
    """Remove bracketed pronunciation guides — "Fortas [FORR-tuss]" — which
    belong to the reader, not the player. Only safe on question-side text:
    answer lines use brackets for their accept/prompt alternates."""
    text = re.sub(r"\[[^\[\]]*\]", "", text)
    return re.sub(r"\s+([,.;:?!])", r"\1", re.sub(r"\s+", " ", text)).strip()


# --------------------------------------------------------------------------
# packet parsing


def split_quarters(lines):
    """Map quarter name -> list of lines, stopping at tiebreakers."""
    sections, current = {}, None
    for line in lines:
        marker = len(line) <= MARKER_MAX_LEN and not NUM_RE.match(line)
        q = QUARTER_RE.search(line) if marker else None
        if q:
            current = q.group(1).capitalize() if q.group(1) else QUARTER_NAMES[int(q.group(2)) - 1]
            sections.setdefault(current, [])
            continue
        if marker and STOP_RE.search(line):
            current = None
            continue
        if current:
            sections[current].append(line)
    return sections


def split_numbered(lines):
    """Split a quarter's lines into (number, [lines]) blocks on '(n)' markers."""
    blocks, current, num = [], None, None
    for line in lines:
        m = NUM_RE.match(line)
        if m and (num is None or int(m.group(1)) == num + 1 or int(m.group(1)) == 1):
            if current:
                blocks.append((num, current))
            num = int(m.group(1))
            current = [NUM_RE.sub("", line)]
        elif current is not None:
            current.append(line)
    if current:
        blocks.append((num, current))
    return blocks


def split_on_labels(block_lines):
    """Break a block into ('question'|'answer'|'bonus', text) parts in order."""
    parts, kind, buf = [], "question", []
    for line in block_lines:
        if ANSWER_RE.match(line):
            parts.append((kind, join_block(buf)))
            kind, buf = "answer", [ANSWER_RE.sub("", line)]
        elif BONUS_RE.match(line):
            parts.append((kind, join_block(buf)))
            kind, buf = "bonus", [BONUS_RE.sub("", line)]
        else:
            buf.append(line)
    parts.append((kind, join_block(buf)))
    out = []
    for k, v in parts:
        v = normalize_text(v)
        if k != "answer":
            v = strip_guides(v)
        if v:
            out.append((k, v))
    return out


def power_mark(words):
    """Word index of the packet's own (+) / (*) mark, else the halfway point."""
    for mark in ("(+)", "(*)"):
        if mark in words:
            return words.index(mark)
    return round(len(words) / 2)


def make_tossup(text, answer, set_name, year, index):
    words = text.split()
    idx = power_mark(words)
    words = [w for w in words if w not in ("(+)", "(*)")]
    idx = min(idx, len(words))
    clean = " ".join(words)
    return {
        "id": f"{slug(set_name)}-{index}",
        "questionText": clean,
        "words": words,
        "powerMarkIndex": idx,
        "answer": answer,
        "answerRaw": answer,
        "category": "History",
        "subcategory": "",
        "difficulty": 3,
        "setName": set_name,
        "year": year,
    }


def is_shouted(line):
    """True for an all-caps heading like "EUROPEAN CITIES IN THE 1940's"."""
    letters = [c for c in line if c.isalpha()]
    return bool(letters) and sum(c.isupper() for c in letters) / len(letters) > 0.8


def category_spans(lines):
    """Locate the three categories as (title, intro_index_or_None, start, end).

    Later packets print a menu ("The categories are: 1. Robber Barons …") whose
    entries reappear as the heading of each body — the most reliable anchor.
    Earlier packets print no menu, so fall back to the lead-in line, the one
    that trails off into an ellipsis ("Which New Deal program…") directly under
    its title.
    """
    titles, menu_end = [], 0
    for i, line in enumerate(lines):
        m = re.match(r"^([1-3])[.)]\s+(.{2,60})$", line)
        if m and int(m.group(1)) == len(titles) + 1:
            titles.append(m.group(2).strip())
            menu_end = i + 1
        elif titles:
            break

    if len(titles) == 3:
        heads = []
        for t in titles:
            found = next((i for i, line in enumerate(lines[menu_end:], menu_end)
                          if line.strip().lower() == t.lower() and i not in heads), None)
            if found is None:
                break
            heads.append(found)
        if len(heads) == 3 and heads == sorted(heads):
            bounds = heads[1:] + [len(lines)]
            return [(titles[n], heads[n] + 1, bounds[n]) for n in range(3)]

    # No menu: each category restarts the clue numbering, so anchor on the "1."
    # lines and read the heading back off the lines directly above.
    firsts = [i for i, line in enumerate(lines)
              if (m := NUM_RE.match(line)) and m.group(1) == "1"]
    if len(firsts) < 3:
        return None
    firsts = firsts[:3]

    # The heading is one line, or two when the category prints a lead-in
    # ("EUROPEAN CITIES IN THE 1940's" then "Which European city..."). The
    # lead-in either trails off into an ellipsis or sits under a shouted title.
    titles_at = []
    for start in firsts:
        head = start - 1
        if head < 0:
            return None
        two_line = head > 0 and (INTRO_RE.search(lines[head]) or is_shouted(lines[head - 1]))
        titles_at.append(head - 1 if two_line else head)

    ends = titles_at[1:] + [len(lines)]
    return [(lines[titles_at[n]], titles_at[n] + 1, ends[n]) for n in range(3)]


def parse_categories(lines, set_name, year):
    """Third Quarter: three titled categories of eight clue/answer pairs."""
    spans = category_spans(lines)
    if not spans:
        return None

    cats = []
    for title, body_start, end in spans:
        # Anything above the first numbered clue is the category's lead-in.
        intro_lines = []
        first = body_start
        while first < end and not NUM_RE.match(lines[first]):
            intro_lines.append(lines[first])
            first += 1
        questions = []
        for _, block in split_numbered(lines[first:end]):
            parts = split_on_labels(block)
            clue = next((v for k, v in parts if k == "question"), "")
            ans = next((v for k, v in parts if k == "answer"), "")
            if clue and ans:
                questions.append({"clue": clue, "answer": ans})
        title = strip_guides(normalize_text(title))
        if len(questions) < 8 or not title:
            return None
        cats.append({
            "title": title,
            "intro": strip_guides(normalize_text(join_block(intro_lines))),
            "questions": questions[:8],
        })

    return {
        "id": f"{slug(set_name)}-q3-0",
        "setName": set_name,
        "year": year,
        "categories": cats,
    }


def parse_packet(path, set_name, year):
    lines = clean_lines(extract_pages(path))
    quarters = split_quarters(lines)
    tossups, bonuses = [], []

    # "Extras", "Opening Buzz" and tiebreaker packets are loose spare questions
    # with no quarter structure — read the whole packet as one run of tossups.
    sections = quarters or {"First": lines}

    for qname in ("First", "Second", "Fourth"):
        for _, block in split_numbered(sections.get(qname, [])):
            parts = split_on_labels(block)
            text = next((v for k, v in parts if k == "question"), "")
            answers = [v for k, v in parts if k == "answer"]
            if not text or not answers or len(text.split()) < 15:
                continue
            tossups.append((text, answers[0]))
            # A tossup carrying a bonus is a Second Quarter pair — a few sets
            # never print the "Second Quarter" heading, so go by the bonus.
            bonus = next((v for k, v in parts if k == "bonus"), "")
            if bonus and len(answers) > 1:
                bonuses.append({
                    "tossup": text,
                    "tossupAnswer": answers[0],
                    "bonus": bonus,
                    "bonusAnswer": answers[1],
                    "setName": set_name,
                })

    trio = parse_categories(sections.get("Third", []), set_name, year)
    numbered = [make_tossup(t, a, set_name, year, i) for i, (t, a) in enumerate(tossups)]
    return numbered, bonuses, trio


# --------------------------------------------------------------------------
# naming


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def set_name_from(filename):
    return re.sub(r"\s+", " ", filename.replace(".pdf", "").replace("-", " ")).strip()


def year_from(set_name):
    years = re.findall(r"(?:19|20)\d\d", set_name)
    return int(years[-1]) if years else 0


# --------------------------------------------------------------------------


def load(name):
    path = OUT / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def by_set(items):
    grouped = {}
    for it in items:
        grouped.setdefault(it["setName"], []).append(it)
    return grouped


# The three banks were originally built by separate passes that named the same
# packet differently ("2015 2016 Round 1 A Set" vs "2015 2016 HS History Bowl
# Round 1 A Set"). Merging on the raw name would file those as two packets and
# serve every question in them twice, so match on the identifying parts only.
FILLER_RE = re.compile(r"\b(hs|high|school|history|bowl|the|and|championships?|set)\b", re.IGNORECASE)


def canonical_key(name):
    key = FILLER_RE.sub(" ", name)
    return re.sub(r"[^a-z0-9]+", " ", key.lower()).strip()


def by_packet(items):
    grouped = {}
    for it in items:
        grouped.setdefault(canonical_key(it["setName"]), []).append(it)
    return grouped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download every PDF")
    ap.add_argument("--limit", type=int, default=0, help="only process N packets")
    args = ap.parse_args()

    urls = packet_urls()
    if args.limit:
        urls = urls[: args.limit]
    print(f"{len(urls)} packet PDFs listed", flush=True)

    old_q, old_b, old_c = load("iacQuestions.json"), load("iacBonuses.json"), load("iacCategories.json")
    old_qs, old_bs, old_cs = by_packet(old_q), by_packet(old_b), by_packet(old_c)

    new_q, new_b, new_c = {}, {}, {}
    for i, url in enumerate(urls, 1):
        name = set_name_from(url.rsplit("/", 1)[-1])
        try:
            path = download(url, args.refresh)
            if path is None:
                print(f"  [{i}/{len(urls)}] {name}: not a PDF, skipped")
                continue
            tossups, bonuses, trio = parse_packet(path, name, year_from(name))
        except Exception as exc:  # a malformed packet must not sink the run
            print(f"  [{i}/{len(urls)}] {name}: FAILED ({exc})")
            continue
        key = canonical_key(name)
        if tossups:
            new_q[key] = tossups
        if bonuses:
            new_b[key] = bonuses
        if trio:
            new_c[key] = [trio]
        print(f"  [{i}/{len(urls)}] {name}: {len(tossups)} tossups, "
              f"{len(bonuses)} bonuses, {'1' if trio else '0'} trio", flush=True)

    # Merge per packet, never regressing one the bank already covers better.
    def merge(old_map, new_map):
        out = dict(old_map)
        for key, items in new_map.items():
            if len(items) >= len(old_map.get(key, [])):
                out[key] = items
        return [it for key in sorted(out) for it in out[key]]

    questions, bonuses, cats = merge(old_qs, new_q), merge(old_bs, new_b), merge(old_cs, new_c)
    (OUT / "iacQuestions.json").write_text(json.dumps(questions, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "iacBonuses.json").write_text(json.dumps(bonuses, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "iacCategories.json").write_text(json.dumps(cats, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"\ntossups    {len(old_q)} -> {len(questions)}  ({len(old_qs)} -> {len(by_packet(questions))} packets)")
    print(f"bonuses    {len(old_b)} -> {len(bonuses)}  ({len(old_bs)} -> {len(by_packet(bonuses))} packets)")
    print(f"categories {len(old_c)} -> {len(cats)}  ({len(old_cs)} -> {len(by_packet(cats))} packets)")


if __name__ == "__main__":
    sys.exit(main())
