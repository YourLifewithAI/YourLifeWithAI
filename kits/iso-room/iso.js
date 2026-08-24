/* ====================================================================
   iso.js — the tiny isometric pixel engine of the iso-room kit.

   You normally never edit this file. The whole room — palette, sprites,
   walls, furniture, layout — lives in room.js, which is the file you
   and your AI co-edit. This engine just turns that plain text into a
   crisp pixel diorama.

   How it draws, back to front:
     1. the two back walls (flat textures sheared onto the iso planes)
     2. the corner post where they meet
     3. the floor (flat textures mapped onto 2:1 diamonds)
     4. the ground slab under the front edges (the "floating island" cut)
     5. every item, painter-sorted by (layer, x + y), each with an
        automatic 1px outline so sprites pop like classic pixel art
     6. soft warm glows for anything that declares one

   Zero dependencies, zero network requests, deterministic output.
   ==================================================================== */
(function () {
  'use strict';

  var TILE_W = 32, TILE_H = 16, HW = TILE_W / 2, HH = TILE_H / 2;

  /* ---------------- sprite text -> pixel grid ---------------- */

  function parse(grid, pal) {
    var h = grid.length, w = 0, x, y;
    for (y = 0; y < h; y++) { if (grid[y].length > w) { w = grid[y].length; } }
    var px = [];
    for (y = 0; y < h; y++) {
      var row = [];
      for (x = 0; x < w; x++) {
        var ch = grid[y].charAt(x);
        row.push(ch && ch !== '.' && ch !== ' ' ? (pal[ch] || '#ff00ff') : null);
      }
      px.push(row);
    }
    return { w: w, h: h, px: px };
  }

  function parseAll(defs, pal) {
    var out = {}, k;
    for (k in defs) {
      if (Object.prototype.hasOwnProperty.call(defs, k)) {
        out[k] = parse(defs[k], pal);
      }
    }
    return out;
  }

  /* ---------------- low-level blitters ---------------- */

  function blit(ctx, s, dx, dy) {
    for (var y = 0; y < s.h; y++) {
      for (var x = 0; x < s.w; x++) {
        var c = s.px[y][x];
        if (c) { ctx.fillStyle = c; ctx.fillRect(dx + x, dy + y, 1, 1); }
      }
    }
  }

  /* 1px silhouette outline drawn around a sprite before the sprite
     itself — every empty 4-neighbour of a filled pixel gets inked */
  function outline(ctx, s, dx, dy, color) {
    ctx.fillStyle = color;
    for (var y = -1; y <= s.h; y++) {
      for (var x = -1; x <= s.w; x++) {
        var filled = y >= 0 && y < s.h && x >= 0 && x < s.w && s.px[y][x];
        if (filled) { continue; }
        var n =
          (y > 0 && y <= s.h - 1 && x >= 0 && x < s.w && s.px[y - 1][x]) ||
          (y >= -1 && y < s.h - 1 && x >= 0 && x < s.w && s.px[y + 1][x]) ||
          (x > 0 && x <= s.w - 1 && y >= 0 && y < s.h && s.px[y][x - 1]) ||
          (x >= -1 && x < s.w - 1 && y >= 0 && y < s.h && s.px[y][x + 1]);
        if (n) { ctx.fillRect(dx + x, dy + y, 1, 1); }
      }
    }
  }

  /* flat wall texture sheared onto an iso wall plane.
     dir +1: right wall — base steps DOWN as columns go right.
     dir -1: left wall  — base steps DOWN as columns go left.
     (baseX, baseY) is the wall base at the TOP corner end of the edge. */
  function blitWall(ctx, s, baseX, baseY, dir) {
    for (var x = 0; x < s.w; x++) {
      var yoff = dir > 0 ? ((x + 1) >> 1) : ((s.w - x) >> 1);
      for (var y = 0; y < s.h; y++) {
        var c = s.px[y][x];
        if (c) { ctx.fillStyle = c; ctx.fillRect(baseX + x, baseY + yoff - s.h + y, 1, 1); }
      }
    }
  }

  /* flat texture mapped onto the 2:1 floor diamond whose top corner
     sits at (tx, ty) — nearest-neighbour, so pixels stay pixels */
  function blitFloor(ctx, s, tx, ty) {
    for (var y = 0; y < TILE_H; y++) {
      for (var x = -HW; x < HW; x++) {
        var lx = x + 0.5, ly = y - HH + 0.5;
        if (Math.abs(lx) / HW + Math.abs(ly) / HH > 1) { continue; }
        var u = Math.floor((lx / TILE_W + ly / TILE_H + 0.5) * s.w);
        var v = Math.floor((ly / TILE_H - lx / TILE_W + 0.5) * s.h);
        if (u < 0) { u = 0; } if (u >= s.w) { u = s.w - 1; }
        if (v < 0) { v = 0; } if (v >= s.h) { v = s.h - 1; }
        var c = s.px[v][u];
        if (c) { ctx.fillStyle = c; ctx.fillRect(tx + x, ty + y, 1, 1); }
      }
    }
  }

  function drawGlow(ctx, gx, gy, r, rgb) {
    var grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    grad.addColorStop(0, 'rgba(' + rgb + ',0.5)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
    ctx.restore();
  }

  /* ---------------- the render ---------------- */

  function render() {
    var R = window.ROOM;
    if (!R) { return; }
    var pal = R.palette || {};
    var sprites = parseAll(R.sprites || {}, pal);
    var tiles = parseAll(R.tiles || {}, pal);
    var wallTex = parseAll(R.wallTiles || {}, pal);
    var W = R.width || 6, D = R.depth || 6;

    var wallH = 0, k;
    for (k in wallTex) {
      if (wallTex[k].h > wallH) { wallH = wallTex[k].h; }
    }

    var PAD = 18;
    var nw = (W + D) * HW + PAD * 2;
    var ox = PAD + D * HW;            /* top corner of tile (0,0) */
    var oy = PAD + wallH;
    var nh = oy + (W + D) * HH + 6 + PAD;

    var native = document.createElement('canvas');
    native.width = nw; native.height = nh;
    var ctx = native.getContext('2d');

    function P(x, y) { return { x: ox + (x - y) * HW, y: oy + (x + y) * HH }; }

    function wallAt(list, i) {
      if (!list || !list.length) { return null; }
      return wallTex[list[i % list.length]] || null;
    }

    var i, p, tex;

    /* 1. walls — floor is drawn after, covering the base seam */
    var wl = R.walls && R.walls.left, wr = R.walls && R.walls.right;
    for (i = 0; i < D; i++) {
      tex = wallAt(wl, i);
      if (tex) { p = P(0, i); blitWall(ctx, tex, p.x - HW, p.y, -1); }
    }
    for (i = 0; i < W; i++) {
      tex = wallAt(wr, i);
      if (tex) { p = P(i, 0); blitWall(ctx, tex, p.x, p.y, 1); }
    }

    /* 2. corner post */
    if (sprites.cornerPost && (wl || wr)) {
      var post = sprites.cornerPost;
      p = P(0, 0);
      blit(ctx, post, p.x - (post.w >> 1), p.y - post.h + 3);
    }

    /* 3. floor */
    var fx, fy, name;
    for (fy = 0; fy < D; fy++) {
      for (fx = 0; fx < W; fx++) {
        name = typeof R.floor === 'string'
          ? R.floor
          : (R.floor[fy % R.floor.length] || [])[fx % R.floor[fy % R.floor.length].length];
        tex = tiles[name];
        if (tex) { p = P(fx, fy); blitFloor(ctx, tex, p.x, p.y); }
      }
    }

    /* 4. ground slab under the two front edges */
    var slab = R.slab || {};
    var slabL = slab.left || '#4a3020';
    var slabR = slab.right || '#33200f';
    var slabE = slab.edge || '#241812';
    var c, top;
    for (i = 0; i < D; i++) {                    /* right-front edge, x = W-1 */
      p = P(W - 1, i);
      for (c = 0; c < HW; c++) {
        top = p.y + TILE_H - ((c + 1) >> 1);
        ctx.fillStyle = slabR;
        ctx.fillRect(p.x + c, top, 1, 5);
        ctx.fillStyle = slabE;
        ctx.fillRect(p.x + c, top + 5, 1, 1);
      }
    }
    for (i = 0; i < W; i++) {                    /* left-front edge, y = D-1 */
      p = P(i, D - 1);
      for (c = 0; c < HW; c++) {
        top = p.y + HH + ((c + 1) >> 1);
        ctx.fillStyle = slabL;
        ctx.fillRect(p.x - HW + c, top, 1, 5);
        ctx.fillStyle = slabE;
        ctx.fillRect(p.x - HW + c, top + 5, 1, 1);
      }
    }

    /* 5. items, painter-sorted */
    var items = (R.items || []).slice().sort(function (a, b) {
      return (a.layer || 0) - (b.layer || 0) ||
        (a.x + a.y) - (b.x + b.y) ||
        a.y - b.y;
    });
    var glows = [];
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      var s = sprites[it.sprite];
      if (!s) { continue; }
      p = P(it.x, it.y);
      var dx = p.x - (s.w >> 1) + (it.dx || 0);
      var dy = p.y + TILE_H - s.h + (it.dy || 0);
      if (R.outline && it.outline !== false) { outline(ctx, s, dx, dy, R.outline); }
      blit(ctx, s, dx, dy);
      if (it.glow) {
        glows.push({
          x: p.x + it.glow[0], y: p.y + TILE_H + it.glow[1],
          r: it.glow[2] || 16, rgb: it.glow[3] || '255,207,122'
        });
      }
    }

    /* 6. glows on top of everything */
    for (i = 0; i < glows.length; i++) {
      drawGlow(ctx, glows[i].x, glows[i].y, glows[i].r, glows[i].rgb);
    }

    present(native, nw, nh);

    var t = document.getElementById('roomTitle');
    if (t && R.title) { t.textContent = R.title; }
    var cap = document.getElementById('roomCaption');
    if (cap && R.caption) { cap.textContent = R.caption; }
    document.title = R.title || document.title;
  }

  /* scale the native canvas up by the largest integer that fits */
  function present(native, nw, nh) {
    var screen = document.getElementById('room');
    if (!screen) { return; }
    var holder = screen.parentNode;
    holder.style.aspectRatio = nw + ' / ' + nh;

    function fit() {
      var rect = holder.getBoundingClientRect();
      if (rect.width < 2) { return; }
      var dpr = window.devicePixelRatio || 1;
      var cw = Math.round(rect.width * dpr), ch = Math.round(rect.height * dpr);
      screen.width = cw; screen.height = ch;
      var scale = Math.max(1, Math.floor(Math.min(cw / nw, ch / nh)));
      var sctx = screen.getContext('2d');
      sctx.imageSmoothingEnabled = false;
      sctx.clearRect(0, 0, cw, ch);
      sctx.drawImage(native, 0, 0, nw, nh,
        Math.floor((cw - nw * scale) / 2), Math.floor((ch - nh * scale) / 2),
        nw * scale, nh * scale);
    }
    fit();
    window.addEventListener('resize', fit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
