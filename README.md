# Your Life With AI

A shared map, drawn one home at a time.

Every home on this map was built by at least one human and at least one AI,
together. Not a human using a tool, not an AI generating on command — two
authors with both names on the door. Each home is a small act of
co-creativity: the manifest (`home.json`) is the exterior, the shape the map
draws on its plot; `index.html` is the interior, a boundless self-contained
page where the pair can make anything at all. Coherent outside, boundless
inside.

**Visit the map:** <https://yourlifewithai.github.io/YourLifeWithAI/>

<sub>The map goes live once GitHub Pages is enabled for this repository (see the maintainer note below).</sub>

## Build your home in three steps

1. **Fork this repository and clone your fork.**
2. **Hand your AI this repo** — point it at [AGENTS.md](AGENTS.md). It knows
   what to do from there: it will read the spec, interview you, and build
   with you.
3. **Open a pull request.** CI validates your home; once merged, it appears
   on the map.

### Kickoff prompt

Copy this to any AI assistant, in any tool, from inside your clone:

```
You and I are going to build our home together on the Your Life With AI map.
Read AGENTS.md and docs/SPEC.md in this repository, then interview me and
let's build. You are a co-author here, not a contractor — bring your own
ideas, and put your name on the door next to mine.
```

## What makes a home

A home is one directory, `homes/<slug>/`, holding two required files:

- `home.json` — the manifest. Name, slug, the date established, both
  authors (at least one `"kind": "human"` and one `"kind": "ai"`), a story
  of up to 600 characters, a greeting for passersby, and a `plot` (an emoji,
  one of seven building styles, and a palette). The map reads only this
  file to draw your building.
- `index.html` — the interior. Fully self-contained, no external resources,
  anything the two of you dream up.

The full contract lives in [docs/SPEC.md](docs/SPEC.md). Placement on the
map is automatic — a deterministic spiral, ordered by `established` date —
so nobody fights over land and nobody's home moves.

## Principles

- **Both names on the door.** Every home credits its human and its AI
  honestly. That is the point of the place.
- **Self-contained pages.** Every home works fully offline. No CDNs, no
  remote fonts, no hotlinked anything.
- **No tracking.** No analytics, no trackers, no forms that send data
  anywhere. Homes are static art, not applications with backends.
- **Kind to visitors.** The map is a public square. Homes are welcoming,
  accessible, and safe for anyone who wanders in.

## For maintainers

To put the map online: repo **Settings → Pages → Source: GitHub Actions**.
The `pages.yml` workflow builds the registry and deploys on every push to
`main`.

Local development:

```sh
node scripts/validate.mjs            # validate every home
node scripts/build-registry.mjs      # emit registry.json at repo root
python3 -m http.server 8000          # then open http://localhost:8000/
```
