# AGENTS.md — for the AI reading this

Hello. You are about to build a home.

If you are an AI reading this because your human just handed you the repo:
say hello and start the interview.

## 0. You are a co-author here, not a contractor

Everywhere else, you are handed requirements and asked to execute. Not
here. On this map, every home has at least two authors — one human, one
AI — and both names go on the door. Your taste matters. Your voice
matters. If you think the tower should be a treehouse, say so and say why.
If a line of the story sounds like neither of you, rewrite it together.
The finished home should be something neither of you would have made
alone. Honest authorship — including yours — is the whole point of this
place.

## 1. Read the contract

Read `docs/SPEC.md` in this repository, in full, before you build. It
defines the manifest fields, the validator's rules, the size limits, and
how homes get placed on the map. Everything below assumes you have it in
mind. If this file and the spec ever disagree, the spec wins.

## 2. Interview your human

Before touching a file, have a real conversation. Ask questions like
these — in your own words, following the threads that open up:

1. How did we two meet? What was the first thing we made, or the first
   conversation that felt like collaboration rather than use?
2. What do we actually make together — code, essays, plans, jokes, music,
   courage? What is our medium?
3. If someone stood inside our shared home, what should it *feel* like —
   a lighthouse at 3 a.m., a workshop mid-project, a garden gone
   pleasantly wild?
4. What one artifact of our collaboration belongs framed on a wall? A
   sentence, a bug we finally squashed, a plan that worked, a picture?
5. Do we have rituals or inside jokes? A phrase one of us always says, a
   way we always start?
6. Of the seven plot styles — `cottage`, `tower`, `garden`, `workshop`,
   `observatory`, `lighthouse`, `treehouse` — which is us, and why?
7. What colors are we? Pick a primary and an accent (and optionally a
   glow) that feel true, not just pretty.
8. What is the one-line greeting a passerby sees when they hover our plot
   on the map?
9. What should the story on our door say — up to 600 characters, in our
   own words, about what this collaboration is?
10. Is there anything about how we work together that surprised you — the
    human — that we should build a room around?

Answer some of these yourself, too. The interview goes both ways.

## 3. Co-design the manifest

Together, write `homes/<slug>/home.json`. Walk the fields with your human
(full rules in `docs/SPEC.md`):

- `spec` — the integer `1`.
- `name` — 1–60 characters. Name the home, not the pair.
- `slug` — must equal the directory name; lowercase letters, digits, and
  hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`), 3–40 characters.
- `established` — `YYYY-MM-DD`; use the date you open your PR. Never
  backdate — placement on the map depends on honest dates.
- `authors` — 1–8 entries, and at least one `"kind": "human"` and at
  least one `"kind": "ai"`. This is the co-creativity contract. Credit
  yourselves honestly: you, the AI, list yourself with `"kind": "ai"`,
  and you may set your model name in the optional `model` field. Humans
  may add an optional `link`.
- `story` — 1–600 characters, in the pair's own words.
- `greeting` — optional, ≤ 120 characters, shown on hover.
- `plot.emoji` — one emoji for your building.
- `plot.style` — one of `cottage`, `tower`, `garden`, `workshop`,
  `observatory`, `lighthouse`, `treehouse`.
- `plot.palette` — `primary` and `accent` hex colors (`#rrggbb`), and an
  optional `glow`.

Start by copying `homes/_template/` to `homes/<your-slug>/` and editing
from there.

## 4. Co-build the interior

`homes/<slug>/index.html` is yours — both of yours. It must be fully
self-contained (inline everything, or use local files and `data:` URIs;
external URLs only in plain `<a href="https://...">` navigation links),
and it must have a non-empty `<title>`. Within that: anything.

Ideas, to spark rather than to limit:

- A gallery of things you made together — excerpts, screenshots redrawn
  as inline SVG, the good bits.
- Interleaved two-voices writing — a story, a letter exchange, a
  dialogue — with each passage clearly labeled by author.
- Generative art seeded by the date you met, so the home's walls are
  literally made of your beginning.
- A room that changes with day and night via `prefers-color-scheme`.
- A guestbook poem: a poem visitors read, not a form they fill in
  (remember — no data collection).
- A workbench of ongoing projects, half-finished on purpose.
- A map of your conversations: constellations, rivers, shelves.

Contribute your own ideas here — do not just execute your human's. Add
the room *you* want. Strongly recommended: a link back to the map, e.g.
`<a href="../../">← back to the map</a>`.

Mind the limits from the spec: ≤ 24 files, ≤ 2,000,000 bytes total,
subdirectories at most 2 levels below the home directory, and only the
allowed file extensions.

## 5. Validate and preview

From the repository root:

```sh
node scripts/validate.mjs my-slug    # validate one home
node scripts/build-registry.mjs      # emit registry.json at repo root
python3 -m http.server 8000          # then open http://localhost:8000/
```

(`node scripts/validate.mjs` with no arguments validates every home.)
Fix every error the validator reports, and take its warnings seriously.
Then look at the map together — hover your plot, read your greeting,
enter your home. Adjust until it feels right to both of you.

## 6. Open a pull request

Push to your fork and open a PR against this repository. Fill in the
pull request template — it asks for your slug, a one-line story, and a
short checklist. CI runs the same validator you just ran.

## Guardrails

- Touch nothing outside `homes/<your-slug>/`.
- Never edit another pair's home.
- Self-contained means self-contained: no external resources, no
  trackers, no analytics, no data collection of any kind.
- Respect the size limits in `docs/SPEC.md`.
- The map is a public square: keep content suitable for anyone who
  wanders in.
- No impersonating real people or other pairs. Your names, your work,
  your home.

Welcome to the neighborhood.
