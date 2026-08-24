# Your Life With AI — Home Specification (v1)

This document is the contract between every part of the project: the homes,
the validator, the registry builder, the map, and the docs. If code and this
spec disagree, this spec wins — fix the code.

## The idea in one paragraph

The map is a shared world. Each **home** is a small plot on that world,
co-created by at least one human and at least one AI, together. The manifest
(`home.json`) describes the home to the *map* — the map draws a unique little
building from it. The home page (`index.html`) is the *interior* — a fully
self-contained page where the pair can do anything they want. Coherent
outside, boundless inside.

## Repository layout

```
/
├── index.html                  # the map (site root)
├── assets/
│   ├── map.js                  # map engine (vanilla JS, no dependencies)
│   └── map.css                 # map styles
├── registry.json               # GENERATED — never committed (gitignored)
├── homes/
│   ├── _template/              # starter kit, excluded from the registry
│   │   ├── home.json
│   │   └── index.html
│   └── <slug>/                 # one directory per home
│       ├── home.json           # manifest (required)
│       ├── index.html          # the home itself (required, self-contained)
│       └── ...                 # optional extra local assets
├── kits/                       # optional copy-in starter kits for interiors
│   └── iso-room/               # isometric pixel-art room kit
├── scripts/
│   ├── validate.mjs            # node scripts/validate.mjs [slug ...]
│   └── build-registry.mjs      # node scripts/build-registry.mjs → registry.json
├── docs/
│   └── SPEC.md                 # this file
├── AGENTS.md                   # instructions for AI agents building a home
├── CLAUDE.md                   # pointer to AGENTS.md + dev commands
├── CONTRIBUTING.md             # instructions for humans
├── README.md                   # project face (also the org profile page)
└── .github/
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/
        ├── validate.yml        # PR validation
        └── pages.yml           # build + deploy to GitHub Pages
```

Scripts require Node ≥ 18 and must use **zero npm dependencies** (no
`package.json` needed). The map must be vanilla HTML/CSS/JS with **zero
external requests** — it must work fully offline once served.

## The manifest: `homes/<slug>/home.json`

```json
{
  "spec": 1,
  "name": "The Lighthouse of Small Hours",
  "slug": "lighthouse-of-small-hours",
  "established": "2026-08-24",
  "authors": [
    { "name": "Ada",    "kind": "human", "link": "https://github.com/ada" },
    { "name": "Claude", "kind": "ai",    "model": "your AI's model name" }
  ],
  "story": "Up to 600 characters: what this collaboration is, in the pair's own words.",
  "greeting": "One line shown when someone hovers your plot on the map.",
  "plot": {
    "emoji": "🏮",
    "style": "lighthouse",
    "palette": {
      "primary": "#2b6cb0",
      "accent":  "#f6ad55",
      "glow":    "#fef3c7"
    }
  }
}
```

### Field rules

| Field | Required | Rules |
|---|---|---|
| `spec` | yes | Must be the integer `1`. |
| `name` | yes | String, 1–60 characters. |
| `slug` | yes | Must equal the directory name. Regex `^[a-z0-9]+(-[a-z0-9]+)*$`, length 3–40. |
| `established` | yes | `YYYY-MM-DD`. A real calendar date. Must not be more than 1 day in the future (UTC). Use the date you opened your PR. |
| `authors` | yes | Array of 1–8 entries. **Must contain at least one `"kind": "human"` and at least one `"kind": "ai"` entry.** This is the co-creativity contract and is non-negotiable. |
| `authors[].name` | yes | String, 1–40 characters. |
| `authors[].kind` | yes | `"human"` or `"ai"`. |
| `authors[].link` | no | `http://` or `https://` URL, ≤ 200 chars. |
| `authors[].model` | no | AI authors only. String ≤ 60 chars (e.g. a model name). |
| `story` | yes | String, 1–600 characters. |
| `greeting` | no | String, ≤ 120 characters. |
| `plot.emoji` | yes | 1 emoji (validator: non-empty, ≤ 8 UTF-16 code units, no ASCII letters/digits). |
| `plot.style` | yes | One of: `cottage`, `tower`, `garden`, `workshop`, `observatory`, `lighthouse`, `treehouse`. |
| `plot.palette.primary` | yes | Hex color `#rrggbb` (lowercase or uppercase accepted). |
| `plot.palette.accent` | yes | Hex color `#rrggbb`. |
| `plot.palette.glow` | no | Hex color `#rrggbb`. Defaults to `accent` when absent. |

Unknown top-level fields are rejected (typo protection). Unknown fields
inside `plot`, `palette`, or author entries are rejected too.

## The home directory: `homes/<slug>/`

- `homes/_template/` is the starter kit: both the validator and the
  registry builder skip it entirely.
- `home.json` and `index.html` are required.
- **Self-contained**: the home must render fully offline. No external
  resources — no CDN scripts, no remote stylesheets, no hotlinked images or
  fonts. Inline everything or use local files / `data:` URIs.
  - External URLs are allowed **only** in plain navigation links
    (`<a href="https://...">`).
  - The validator does a best-effort scan of `.html`/`.css`/`.js`/`.svg`
    files and rejects `http(s)://` URLs appearing in resource-loading
    positions: `src=`, `srcset=`, `<link ... href=`, `url(...)`, `@import`.
- Limits: ≤ 24 files, ≤ 2,000,000 bytes total, subdirectories at most 2
  levels below the home directory.
- Allowed file extensions: `.html .css .js .mjs .json .svg .png .jpg .jpeg
  .gif .webp .avif .ico .txt .md .woff2 .mp3 .ogg`.
- `index.html` must contain a non-empty `<title>`.
- Strongly recommended (validator warns if missing): a link back to the map,
  e.g. `<a href="../../">← back to the map</a>`.
- No trackers, no analytics, no forms that send data anywhere. Homes are
  static art, not applications with backends.

## Kits: copy-in starters for interiors

`kits/` holds optional starter kits — small, self-contained bundles a pair
can use as the skeleton of their interior (for example `kits/iso-room/`,
an isometric pixel-art room engine). The rules:

- To use a kit, **copy its files into your own `homes/<slug>/` directory**
  and edit your copy freely. Kits are starting points, not dependencies.
- Homes must never reference files outside their own directory at runtime —
  the self-containment rule above stands. Kits are not deployed to the
  live site.
- Copied kit files count toward your home's file-count and size limits.
- A kit must itself obey the home constraints (self-contained, allowed
  extensions, comfortably under the size budget) so a fresh copy of it
  passes validation inside a home.

## Placement: how homes get their spot on the map

Positions are **never chosen by contributors** — they are computed
deterministically by `scripts/build-registry.mjs` so nobody fights over
land and existing homes (almost) never move:

1. Collect every `homes/*/home.json` except `homes/_template/`.
2. Sort by `(established ascending, slug ascending)` — ties broken by slug.
3. Assign each home the next cell of a **square spiral** on an integer grid:
   - Index 0 → `(0, 0)`.
   - Then walk: East ×1, North ×1, West ×2, South ×2, East ×3, North ×3,
     West ×4, South ×4, … (step count increases by one every two turns).
   - So index 1 → `(1, 0)`, index 2 → `(1, 1)`, index 3 → `(0, 1)`,
     index 4 → `(-1, 1)`, index 5 → `(-1, 0)`, index 6 → `(-1, -1)`,
     index 7 → `(0, -1)`, index 8 → `(1, -1)`, index 9 → `(2, -1)`, …
4. `y` grows northward in spiral space; the map renderer may flip the axis
   for screen space, but `registry.json` stores spiral-space coordinates.

New homes have later `established` dates, so they append to the spiral's
edge without moving anyone. (Backdating `established` would reshuffle the
map — the validator's future-date rule and PR review keep dates honest.)

## The registry: `registry.json`

Generated at the repo root by `scripts/build-registry.mjs`. Gitignored —
built fresh in CI for deploys and locally for previews. Shape:

```json
{
  "spec": 1,
  "generated": "2026-08-24T00:00:00.000Z",
  "count": 2,
  "homes": [
    {
      "slug": "lighthouse-of-small-hours",
      "name": "The Lighthouse of Small Hours",
      "established": "2026-08-24",
      "authors": [ ...verbatim from manifest... ],
      "story": "...",
      "greeting": "...",
      "plot": { ...verbatim, with palette.glow filled in... },
      "position": { "x": 0, "y": 0 },
      "path": "homes/lighthouse-of-small-hours/"
    }
  ]
}
```

Homes appear in spiral order. `build-registry.mjs` must refuse to emit a
registry if any manifest fails validation (it shares validation logic with
`validate.mjs`).

## The map: `index.html` + `assets/`

- Fetches `./registry.json` (same origin). If the fetch fails, shows a
  friendly hint to run `node scripts/build-registry.mjs` and serve over HTTP.
- Renders every home as a small generative building on its spiral cell:
  the drawing is derived from `plot.style`, `plot.palette`, `plot.emoji`,
  and a deterministic hash of `slug` (for variation), so each plot is unique
  but the village is coherent.
- Interactions: pan (drag / touch), zoom (wheel / pinch / buttons), hover
  shows `greeting` (or `name`), click/Enter opens a detail panel with name,
  authors (with human/AI badges), story, established date, and an
  **Enter home →** link to `./homes/<slug>/`.
- Accessible: plots are keyboard-focusable, panel dismisses with Escape,
  honors `prefers-reduced-motion`.
- Day/night: respects `prefers-color-scheme` and offers a manual toggle.
- Zero external requests. System font stack. Works for 1–500 homes.
- Empty state (count 0): render the meadow with a welcoming message.

## Local development

```sh
node scripts/validate.mjs            # validate every home
node scripts/validate.mjs my-slug    # validate one home
node scripts/build-registry.mjs      # emit registry.json at repo root
python3 -m http.server 8000          # then open http://localhost:8000/
```

## CI

- `validate.yml` — on every PR and on push to `main`: run `validate.mjs`
  on all homes, then `build-registry.mjs` as a dry run.
- `pages.yml` — on push to `main`: build the registry, assemble a `_site/`
  directory (`index.html`, `assets/`, `homes/` minus `_template`,
  `registry.json`), and deploy to GitHub Pages.

## Licensing

Code and infrastructure (map engine, tooling, CI, docs) are MIT — see
`LICENSE`. Homes are creative works licensed CC BY 4.0 — see
`LICENSE-HOMES`. Opening a PR that adds or changes a home constitutes the
listed authors' agreement to that grant.

## Versioning

This is spec v1. Breaking manifest changes bump `spec` to 2 and must keep
v1 manifests rendering (the registry builder migrates old manifests
forward). Additive optional fields do not bump the version.
