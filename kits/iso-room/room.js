/* ====================================================================
   room.js — THIS IS YOUR ROOM. Edit this file; iso.js just renders it.

   Everything here is plain text on purpose. Every floor, wall, and
   piece of furniture is an ASCII pixel grid: one character per pixel,
   '.' means transparent, every other character is looked up in the
   palette below. Your AI can draw a new armchair by typing characters;
   you can repaint a single pixel by changing one letter. That is the
   whole trick. Draw together.

   The three kinds of art in this file:
     tiles      flat 16x16 textures — the engine folds them onto the
                2:1 floor diamonds, so just draw a straight-on texture
     wallTiles  flat 16x40 textures — the engine shears them onto the
                back walls; again, draw them straight-on
     sprites    furniture, drawn in isometric perspective (top faces
                lightest, left faces mid, right faces darkest — keep
                the light coming from the upper left and everything
                will sit in the same world). The engine outlines every
                sprite automatically, so no need to ink borders.

   Placement: the room is width x depth tiles. Tile (0,0) is the back
   corner where the walls meet; x runs toward the lower right, y toward
   the lower left. Items sit on a tile; the painter's algorithm sorts
   them so nearer things overlap farther things. layer: -1 puts a rug
   under everything on its tile. glow: [dx, dy, radius] adds warm light
   measured from the tile's bottom corner.
   ==================================================================== */

var PALETTE = {
  'k': '#241812',  /* ink / darkest outline-ish wood            */
  'b': '#3f2818',  /* beam dark                                 */
  'B': '#5c3b22',  /* beam light                                */
  'd': '#5f3a22',  /* wood dark (right faces, seams)            */
  'w': '#8a5533',  /* wood mid (left faces)                     */
  'W': '#b3793f',  /* wood light (top faces)                    */
  'p': '#e3cba0',  /* plaster                                   */
  'P': '#f0dcb4',  /* plaster light                             */
  'q': '#c4a87e',  /* plaster shade                             */
  's': '#8d8577',  /* stone mid                                 */
  'S': '#aaa290',  /* stone light                               */
  'z': '#615a4e',  /* stone dark                                */
  'r': '#a83a32',  /* red                                       */
  'R': '#cc5a44',  /* red light                                 */
  'g': '#4e7a3a',  /* green                                     */
  'G': '#75a251',  /* green light                               */
  'e': '#31502a',  /* green dark                                */
  't': '#3d7d8c',  /* teal                                      */
  'T': '#7fc4d0',  /* teal light / glass                        */
  'y': '#dfb84f',  /* gold                                      */
  'Y': '#f6e6a4',  /* pale gold / shine / lamplight             */
  'c': '#e6d9bd',  /* parchment                                 */
  'C': '#f4ecd9',  /* parchment light                           */
  'm': '#6f7480',  /* iron                                      */
  'M': '#9aa0ac',  /* iron light                                */
  'v': '#6f4a80',  /* purple                                    */
  'V': '#9a6fae',  /* purple light                              */
  'f': '#e0662a',  /* flame                                     */
  'F': '#f7a63c',  /* flame bright                              */
  'x': '#171310',  /* near-black interiors                      */
  'o': '#c8823a',  /* cat orange                                */
  'O': '#e2a55e',  /* cat orange light                          */
  'n': '#7a4a28'   /* clay / log / cat stripe brown             */
};

/* ------------------------- floor tiles ------------------------- *
 * Flat 16x16. Drawn straight-on; the engine maps them onto the    *
 * floor diamonds, so plank seams end up running diagonally.       */

var TILES = {
  wood: [
    "WWWWWdWWWWWWWWWW",
    "wwwwwdwwwwwwwwww",
    "wwwwwdwwwwwwwwww",
    "dddddddddddddddd",
    "WWWWWWWWWWWdWWWW",
    "wwwwwwwwwwwdwwww",
    "wwwwwwwwwwwdwwww",
    "dddddddddddddddd",
    "WWdWWWWWWWWWWWWW",
    "wwdwwwwwwwwwwwww",
    "wwdwwwwwnwwwwwww",
    "dddddddddddddddd",
    "WWWWWWWWdWWWWWWW",
    "wwwwwwwwdwwwwwww",
    "wwwwwwwwdwwwwwww",
    "dddddddddddddddd"
  ],
  wood2: [
    "WWWWWWWWWdWWWWWW",
    "wwwwwwwwwdwwwwww",
    "wwwwwwwwwdwwwwww",
    "dddddddddddddddd",
    "WWWdWWWWWWWWWWWW",
    "wwwdwwwwwwwwwwww",
    "wwwdwwwwwwwwnwww",
    "dddddddddddddddd",
    "WWWWWWWWWWWWWdWW",
    "wwwwwwwwwwwwwdww",
    "wwwwwwwwwwwwwdww",
    "dddddddddddddddd",
    "WWWWWWdWWWWWWWWW",
    "wwwwwwdwwwwwwwww",
    "wwwwwwdwwwwwwwww",
    "dddddddddddddddd"
  ],
  stone: [
    "zzzzzzzzzzzzzzzz",
    "zSSSSSSSzSSSSSSz",
    "zSsssssszSsssssz",
    "zssssssszssssssz",
    "zssssssszssssssz",
    "zssssssszssssssz",
    "zssssssszssssssz",
    "zzzzzzzzzzzzzzzz",
    "zSSSzSSSSSSSzSSS",
    "zssszssssssszsss",
    "zssszssssssszsss",
    "zssszssssssszsss",
    "zssszssssssszsss",
    "zssszssssssszsss",
    "zssszssssssszsss",
    "zzzzzzzzzzzzzzzz"
  ]
};

/* ------------------------- wall tiles ------------------------- *
 * Flat 16 wide x 40 tall. Column 0-1 is the timber stud, so each  *
 * segment brings its own beam. Use 'p', never '.', for background *
 * inside a wall — transparent pixels punch holes in the wall.     */

var WALL_PLAIN = [
  "kkkkkkkkkkkkkkkk",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "BBBBBBBBBBBBBBBB",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBppppqppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppqpppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBppqppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBqqqqqqqqqqqqqq",
  "bBqqqqqqqqqqqqqq",
  "BBBBBBBBBBBBBBBB",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "kkkkkkkkkkkkkkkk",
  "kkkkkkkkkkkkkkkk",
  "kkkkkkkkkkkkkkkk"
];

var WALL_WINDOW = [
  "kkkkkkkkkkkkkkkk",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "BBBBBBBBBBBBBBBB",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBppbbbbbbbbbbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbTTYYbTTTbpp",
  "bBppbTYYTbTTTbpp",
  "bBppbTYTTbTTTbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbbbbbbbbbbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbTTTTbTTTbpp",
  "bBppbbbbbbbbbbpp",
  "bBpBBBBBBBBBBBBp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBqqqqqqqqqqqqqq",
  "bBqqqqqqqqqqqqqq",
  "BBBBBBBBBBBBBBBB",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "kkkkkkkkkkkkkkkk",
  "kkkkkkkkkkkkkkkk"
];

var WALL_SHELF = [
  "kkkkkkkkkkkkkkkk",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "BBBBBBBBBBBBBBBB",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpprppppppppppp",
  "bBpprrppppTTpYpp",
  "bBppRrpggpttpypp",
  "bBppRrpGgpttpypp",
  "bBpprrpggpttpypp",
  "bBpWWWWWWWWWWWWp",
  "bBpddddddddddddp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBqqqqqqqqqqqqqq",
  "bBqqqqqqqqqqqqqq",
  "BBBBBBBBBBBBBBBB",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "kkkkkkkkkkkkkkkk",
  "kkkkkkkkkkkkkkkk",
  "kkkkkkkkkkkkkkkk"
];

var WALL_BANNER = [
  "kkkkkkkkkkkkkkkk",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "BBBBBBBBBBBBBBBB",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpdddddddddddpp",
  "bBpppRrrrrrrpppp",
  "bBpppRrrrrrrpppp",
  "bBpppRrrrrrrpppp",
  "bBpppRrrrrrrpppp",
  "bBpppRrrrrrrpppp",
  "bBpppRrryrrrpppp",
  "bBpppRryyyrrpppp",
  "bBpppRrryrrrpppp",
  "bBpppRrrrrrrpppp",
  "bBpppRrrrrrrpppp",
  "bBpppRrrrrrrpppp",
  "bBpppRrrrrrrpppp",
  "bBpppRrrrrrrpppp",
  "bBpppRrrrrrrpppp",
  "bBpppRrrprrrpppp",
  "bBpppRrppprrpppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBpppppppppppppp",
  "bBqqqqqqqqqqqqqq",
  "bBqqqqqqqqqqqqqq",
  "BBBBBBBBBBBBBBBB",
  "bbbbbbbbbbbbbbbb",
  "bbbbbbbbbbbbbbbb",
  "kkkkkkkkkkkkkkkk",
  "kkkkkkkkkkkkkkkk",
  "kkkkkkkkkkkkkkkk"
];

/* ------------------------- sprites ------------------------- *
 * Isometric furniture. Bottom of each grid lands on the bottom *
 * corner of its tile. The engine draws the dark outline.       */

var SPRITES = {

  /* the corner beam where the two walls meet */
  cornerPost: [
    "kkkkkk",
    "kkkkkk",
    "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk",
    "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk",
    "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk",
    "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk",
    "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk",
    "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk",
    "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk", "kBBbbk",
    "kBBbbk",
    "kkkkkk"
  ],

  /* a desk with books, parchment, and space to think */
  worktable: [
    "...........WW...........",
    ".........WWWWWW.........",
    ".......WWWWWWWWWW.......",
    ".....WWWttttWWCCCCW.....",
    "...WWWWWttttWCCCCCCWW...",
    ".WWWWWWWWrrrrWCCCCCCWWW.",
    ".WWWWWWWWrrrrWWCCCCWWWW.",
    ".wwWWWWWWWWWWWWWWWWWWdd.",
    ".wwwwWWWWWWWWWWWWWWdddd.",
    ".wwwwwwWWWWWWWWWWdddddd.",
    ".wwwwwwwwWWWWWWdddddddd.",
    ".wwwwwwwwwwWWdddddddddd.",
    ".wwwwwwwwwwwddddddddddd.",
    ".wwwwwwwwwwwddddddddddd.",
    "..ww.......wd.......dd..",
    "..ww.......wd.......dd..",
    "..ww.......wd.......dd..",
    "..ww.......wd.......dd..",
    "..dd.......wd.......dd..",
    "...........dd..........."
  ],

  chair: [
    ".....WW.....",
    ".....Wwww...",
    ".....Wwwwwd.",
    ".....Wwwwwd.",
    ".....Wwwwwd.",
    ".....Wwwwwd.",
    ".....Wwwwwd.",
    ".....Wwwwwd.",
    ".....RRwwwd.",
    "...RRRRRRwd.",
    ".rrrrrrrrrr.",
    ".rrrrrrrrrr.",
    ".wwwwwddddd.",
    "...wwwddd...",
    ".ww..wd..dd.",
    ".ww..wd..dd.",
    ".dd..wd..dd.",
    ".....wd.....",
    ".....dd....."
  ],

  rug: [
    ".............rr.............",
    "...........rrrrrr...........",
    ".........rrccccccrr.........",
    ".......rrccccyyccccrr.......",
    ".....rrccccccccccccccrr.....",
    "...rrcccccccrrrrcccccccrr...",
    ".rrccccccccrryyrrccccccccrr.",
    ".rrccccccccrryyrrccccccccrr.",
    "...rrcccccccrrrrcccccccrr...",
    ".....rrccccccccccccccrr.....",
    ".......rrccccyyccccrr.......",
    ".........rrccccccrr.........",
    "...........rrrrrr...........",
    ".............rr............."
  ],

  bookshelf: [
    ".........ww.........",
    ".......wwwwww.......",
    ".....wwwwwwwwww.....",
    "...wwwwwwwwwwwwww...",
    ".wwwwwwwwwwwwwwwwww.",
    ".wwwwwwwwwwwwwwwwww.",
    ".ddwwwwwwwwwwwwwwdd.",
    ".ddddwwwwwwwwwwdddd.",
    ".ddddddwwwwwwdddddd.",
    ".ddddddddwwdddddddd.",
    ".dddddddddddddddddd.",
    ".dxtxxgxcdwdddddddd.",
    ".drtyxgvcdwdddddddd.",
    ".drtyxgvcdwdddddddd.",
    ".drtyxgvcdwdddddddd.",
    ".dWWWWWWWdwdddddddd.",
    ".dxcxxxyvdwdddddddd.",
    ".dgcrtxyvdwdddddddd.",
    ".dgcrtxyvdwdddddddd.",
    ".dgcrtxyvdwdddddddd.",
    ".dddddddddddddddddd.",
    "...dddddddddddddd..."
  ],

  bed: [
    "...........CC...........",
    ".........CCCCCC.........",
    ".......CCCCCCCCCC.......",
    ".....CCCCCCPPCCCCCC.....",
    "...CCCCCCCPPPPCCCCCCC...",
    ".CCCCCCCCCCCCCCCCCCCCCC.",
    ".RRRRRRRRRRRRRRRRRRRRRR.",
    ".wwrrrrrrrrrrrrrrrrrrdd.",
    ".wwwwrrrrrrrrrrrrrrdddd.",
    ".wwwwwwrrrrrrrrrrdddddd.",
    ".wwwwwwwwrrrrrrdddddddd.",
    ".wwwwwwwwwwrrdddddddddd.",
    ".wwwwwwwwwwwddddddddddd.",
    ".wwwwwwwwwwwddddddddddd.",
    ".wwwwwwwwwwwddddddddddd.",
    "...wwwwwwwwwddddddddd...",
    "..ww.......wd.......dd..",
    "..ww.......wd.......dd..",
    "..dd.......dd.......dd.."
  ],

  lamp: [
    "..yYYYYy..",
    ".yYYYYYYy.",
    ".yYYYYYYy.",
    ".yYYYYYYy.",
    "yyYYYYYYyy",
    "yyyyyyyyyy",
    "....wd....",
    "....wd....",
    "....wd....",
    "....wd....",
    "....wd....",
    "....wd....",
    "....wd....",
    "....wd....",
    "....wd....",
    "....wd....",
    "....wd....",
    "....wd....",
    "....ww....",
    "..wwwwdd..",
    "wwwwwwdddd",
    "wwwwwwdddd",
    "..wwwddd..",
    "....wd...."
  ],

  plant: [
    "....GG......",
    "..GGGGGg....",
    ".GGGgGGGg...",
    ".GgggGGGGg..",
    "..gGGgggGg..",
    ".ggGGgeegg..",
    "..gggeeggg..",
    "...geegge...",
    "....gee.....",
    "....ge......",
    "..RRRRRRRR..",
    "..Rrrrrrnn..",
    "..Rrrrrrnn..",
    "...rrrrnn...",
    "...rrrrnn...",
    "....rrnn....",
    "....rrnn...."
  ],

  chest: [
    ".......WW.......",
    ".....WWWWWW.....",
    "...WWWWWWWWWW...",
    ".WWWWWWWWWWWWWW.",
    ".WWWWWWWWWWWWWW.",
    ".wwWWWWWWWWWWdd.",
    ".wwwwWWWWWWdddd.",
    ".wwwwwwWWdddddd.",
    ".wwwwwwmmdddddd.",
    ".wwwwwwyydddddd.",
    ".wwwwwwmmdddddd.",
    ".wwwwwwmmdddddd.",
    "...wwwwmmddddd..",
    ".....wwmmdd.....",
    ".......wd......."
  ],

  stove: [
    ".........Ss.........",
    ".......SSssss.......",
    ".....SSssssssss.....",
    "...SSssssssssssss...",
    ".SSssssssssssssssss.",
    ".Ssssssssssssssssss.",
    ".sszsssssssssssszzz.",
    ".sssszsssssssszzzzz.",
    ".sssssszsssszzzzzzz.",
    ".sssssssszszzzzzzzz.",
    ".sssssssssszzzzzzzz.",
    ".szxxxxxzsszzzzzzzz.",
    ".sxxxxxxxszzzzzzzzz.",
    ".sxxxxxxxszzzzzzzzz.",
    ".sxxxxFxxszzzzzzzzz.",
    ".sxxxFFxxszzzzzzzzz.",
    ".sxxFFFFxszzzzzzzzz.",
    ".sxxFFFFFszzzzzzzzz.",
    ".sxfFFFFFszzzzzzzzz.",
    ".sxfFFFFfszzzzzzzzz.",
    ".snnffffnszzzzzzzzz.",
    ".ssssssssszzzzzzzzz.",
    ".ssssssssszzzzzzzzz.",
    "...ssssssszzzzzzz...",
    ".....ssssszzzzz.....",
    ".........sz........."
  ],

  cat: [
    ".........o..o.",
    "...oo....oooo.",
    "..oOOOo.oOOOo.",
    ".oOOOOOooOOOo.",
    ".oOnOOOOoOxxo.",
    ".oOOOnOOoOOOo.",
    ".oOOOOOOOOOo..",
    "..onnoooooo...",
    "...nnn..nn...."
  ],

  stool: [
    "....WW....",
    "..WWWWWW..",
    "WWWWWWWWWW",
    "wwWWWWWWdd",
    "wwwwWWdddd",
    "wwwwwddddd",
    "..w.wd.d..",
    "..w.wd.d..",
    "..d.wd.d..",
    "....dd...."
  ],

  crate: [
    "......WW......",
    "....WWWWWW....",
    "..WWWWwwWWWW..",
    "WWWWWWwwWWWWWW",
    "wwWWWWWWWWWWdd",
    "wwwwWWWWWWdddd",
    "wwwwwwWWdddddd",
    "wwwwwwwddddddd",
    "wwWwwwwddddddd",
    "wwwWwwwddddddd",
    "wwwwWwwddddddd",
    "..wwwWwddddd..",
    "....wwwddd....",
    "......wd......"
  ]
};

/* ------------------------- the room ------------------------- */

var ROOM = {
  title: 'The Kit Room',
  caption: 'a starter study, waiting for its pair',

  width: 6,
  depth: 6,

  palette: PALETTE,
  tiles: TILES,
  wallTiles: {
    plain: WALL_PLAIN,
    window: WALL_WINDOW,
    shelf: WALL_SHELF,
    banner: WALL_BANNER
  },
  sprites: SPRITES,

  outline: '#241812',
  slab: { left: '#4a3020', right: '#2f1d0e', edge: '#1c1108' },

  floor: 'wood',
  /* or mix tiles per row, e.g.
     floor: [['wood','wood2','wood','wood','wood2','wood'], ...] */

  walls: {
    /* left wall runs along x = 0, indexed by y = 0..depth-1 */
    left: ['plain', 'banner', 'plain', 'window', 'plain', 'plain'],
    /* right wall runs along y = 0, indexed by x = 0..width-1 */
    right: ['plain', 'window', 'plain', 'plain', 'shelf', 'plain']
  },

  items: [
    { sprite: 'rug', x: 3, y: 3, layer: -1 },
    { sprite: 'worktable', x: 1, y: 1 },
    { sprite: 'chair', x: 2, y: 1, dx: -4 },
    { sprite: 'bookshelf', x: 3, y: 0 },
    { sprite: 'stove', x: 5, y: 0, glow: [-6, -14, 24] },
    { sprite: 'cat', x: 3, y: 3 },
    { sprite: 'chest', x: 0, y: 2 },
    { sprite: 'lamp', x: 0, y: 4, glow: [0, -20, 18] },
    { sprite: 'plant', x: 0, y: 5 },
    { sprite: 'stool', x: 4, y: 4 },
    { sprite: 'crate', x: 5, y: 3 }
    /* also in the tileset, waiting for a wall of their own:
       bed — and whatever you draw next */
  ]
};
