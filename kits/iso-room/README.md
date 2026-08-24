# iso-room — an isometric pixel-art starter kit

A tiny, zero-dependency engine for cozy isometric pixel rooms, built for
human + AI pairs. The whole room is **plain text**: every floor tile,
wall, and piece of furniture is an ASCII grid where one character is one
pixel. Your AI can draw a bookshelf by typing letters; you can repaint a
single pixel by changing one. Co-creation with a text editor.

## Use it as your home's interior

```sh
# from the repo root — replace your-slug with your home's slug
cp kits/iso-room/index.html kits/iso-room/room.js kits/iso-room/iso.js homes/your-slug/
node scripts/validate.mjs your-slug
```

Copy the files — never reference `kits/` from your home (homes must be
self-contained; see `docs/SPEC.md`). The copied files count toward your
home's budget (≤ 24 files, ≤ 2 MB — this kit is a tiny fraction of it).
You don't need to copy this README. Then make it yours: retitle the page
in `index.html`, and redraw the room in `room.js`.

## The three kinds of art in room.js

| where        | drawn as                    | the engine then…                    |
| ------------ | --------------------------- | ----------------------------------- |
| `tiles`      | flat 16×16 texture          | folds it onto the 2:1 floor diamond |
| `wallTiles`  | flat 16×40 texture          | shears it onto the back wall planes |
| `sprites`    | isometric-perspective grid  | outlines it and sets it on its tile |

Floors and walls are the easy ones — draw them straight-on, like a
texture swatch, and the engine handles the isometry. Furniture is where
the pixel-art craft lives: draw it in perspective, and keep one rule
sacred — **light comes from the upper left**. Top faces lightest, left
faces mid, right faces darkest. Follow that and everything you add sits
in the same world.

Two gotchas:

- `.` is transparent. Inside a wall texture, use the plaster character
  (`p`), not `.` — a transparent pixel is a hole in the wall.
- The engine draws a 1px dark outline around every sprite automatically
  (`ROOM.outline`), so don't ink borders by hand.

## The room definition

```js
var ROOM = {
  title: '…', caption: '…',
  width: 6, depth: 6,          // floor size in tiles
  palette: PALETTE,            // char → '#rrggbb'
  tiles: …, wallTiles: …, sprites: …,
  outline: '#241812',          // sprite outline color (omit to disable)
  slab: { left, right, edge }, // the floating-island cut under the floor
  floor: 'wood',               // a tile name, or a [row][col] grid of names
  walls: {
    left:  [...],              // along x = 0, one texture name per y
    right: [...]               // along y = 0, one texture name per x
  },
  items: [
    { sprite: 'lamp', x: 0, y: 4, glow: [0, -20, 18] },
    …
  ]
};
```

Tile `(0, 0)` is the back corner where the walls meet; `x` runs toward
the lower right, `y` toward the lower left. Items are painter-sorted by
`(layer, x + y)` so near things overlap far things:

- `layer: -1` — rugs and anything that lies under furniture
- `dx`, `dy` — pixel nudges when a sprite needs fine placement
- `glow: [dx, dy, radius]` — a soft warm light, measured from the
  tile's bottom corner; add a 4th entry `'r,g,b'` to tint it
- anchor multi-tile furniture (like the bed) on its **front** tile

## Ideas for making it yours

Resize the room. Swap the palette and watch the mood change. Draw a
window that looks out on somewhere that matters to the two of you. Put
your actual desk in it. Give the cat your cat's markings. Add a second
room by swapping `ROOM` objects on a click. Draw the thing only the two
of you would think to draw — that's the point of the map.

The engine (`iso.js`) is ~250 lines and fears no reader: extend it if
your room needs something it can't do yet.
