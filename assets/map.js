/* Your Life With AI — map engine.
   Vanilla JS, zero dependencies, zero external requests.
   Builds the whole world SVG once, then pans/zooms purely via viewBox math,
   so it stays smooth from 1 to 500 homes. */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var CELL = 120;              // world units per spiral cell
  var STYLE_NAMES = ['cottage', 'tower', 'garden', 'workshop',
    'observatory', 'lighthouse', 'treehouse'];

  var root = document.documentElement;
  var svg = document.getElementById('world');
  var mapWrap = document.getElementById('mapWrap');
  var tooltip = document.getElementById('tooltip');
  var notice = document.getElementById('notice');
  var homeCount = document.getElementById('homeCount');
  var panel = document.getElementById('panel');
  var panelClose = document.getElementById('panelClose');
  var panelEmoji = document.getElementById('panelEmoji');
  var panelName = document.getElementById('panelName');
  var panelEst = document.getElementById('panelEst');
  var panelAuthors = document.getElementById('panelAuthors');
  var panelStory = document.getElementById('panelStory');
  var panelEnter = document.getElementById('panelEnter');
  var themeToggle = document.getElementById('themeToggle');

  var reducedMotion = false;
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* no matchMedia — assume motion is fine */ }

  /* ---------------------------------------------------------------- *
   * Deterministic PRNG: string hash (xmur3-style) + mulberry32.      *
   * Same slug in, same little building out — on every machine.       *
   * ---------------------------------------------------------------- */

  function hashString(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function prng(str) { return mulberry32(hashString(str)); }

  /* ------------------------- color helpers ------------------------- */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) { return { r: 128, g: 128, b: 128 }; }
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) |
      (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255))
      .toString(16).slice(1);
  }

  /* amt in -100..100: negative mixes toward black, positive toward white */
  function shade(hex, amt) {
    var c = hexToRgb(hex);
    var t = clamp(amt, -100, 100) / 100;
    var target = t < 0 ? 0 : 255;
    var f = Math.abs(t);
    return rgbToHex(
      c.r + (target - c.r) * f,
      c.g + (target - c.g) * f,
      c.b + (target - c.b) * f
    );
  }

  /* ------------------------- SVG helpers --------------------------- */

  function el(name, attrs, parent) {
    var node = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (parent) { parent.appendChild(node); }
    return node;
  }

  function num(v) { return Math.round(v * 100) / 100; }

  /* ---------------------------------------------------------------- *
   * Day / night. Follows prefers-color-scheme until the sun/moon     *
   * button sets an override, persisted in localStorage.              *
   * ---------------------------------------------------------------- */

  var THEME_KEY = 'ylwai-theme';
  var themeOverride = null;
  try { themeOverride = window.localStorage.getItem(THEME_KEY); } catch (e) { }
  if (themeOverride !== 'day' && themeOverride !== 'night') { themeOverride = null; }

  var darkQuery = null;
  try { darkQuery = window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) { }

  function isNight() {
    if (themeOverride) { return themeOverride === 'night'; }
    return !!(darkQuery && darkQuery.matches);
  }

  function applyTheme() {
    var night = isNight();
    root.classList.toggle('theme-night', night);
    root.classList.toggle('theme-day', !night);
    themeToggle.setAttribute('aria-label',
      night ? 'Switch to day' : 'Switch to night');
    themeToggle.setAttribute('title', night ? 'Switch to day' : 'Switch to night');
  }

  themeToggle.addEventListener('click', function () {
    themeOverride = isNight() ? 'day' : 'night';
    try { window.localStorage.setItem(THEME_KEY, themeOverride); } catch (e) { }
    applyTheme();
  });

  if (darkQuery) {
    var onScheme = function () { if (!themeOverride) { applyTheme(); } };
    if (typeof darkQuery.addEventListener === 'function') {
      darkQuery.addEventListener('change', onScheme);
    } else if (typeof darkQuery.addListener === 'function') {
      darkQuery.addListener(onScheme);
    }
  }

  applyTheme();

  /* ---------------------------------------------------------------- *
   * Viewport: one viewBox, mutated on pan/zoom, applied on rAF.      *
   * ---------------------------------------------------------------- */

  var vb = { x: -420, y: -320, w: 840, h: 640 };
  var minW = 170;
  var maxW = 4200;
  var vbPending = false;

  function applyVB() {
    svg.setAttribute('viewBox',
      num(vb.x) + ' ' + num(vb.y) + ' ' + num(vb.w) + ' ' + num(vb.h));
  }

  function scheduleVB() {
    if (vbPending) { return; }
    vbPending = true;
    window.requestAnimationFrame(function () {
      vbPending = false;
      applyVB();
    });
  }

  function stageRect() { return svg.getBoundingClientRect(); }

  function clientToWorld(cx, cy) {
    var r = stageRect();
    return {
      x: vb.x + ((cx - r.left) / Math.max(1, r.width)) * vb.w,
      y: vb.y + ((cy - r.top) / Math.max(1, r.height)) * vb.h
    };
  }

  function worldToClient(wx, wy) {
    var r = stageRect();
    return {
      x: r.left + ((wx - vb.x) / vb.w) * r.width,
      y: r.top + ((wy - vb.y) / vb.h) * r.height
    };
  }

  function panByClient(dxPx, dyPx) {
    var r = stageRect();
    vb.x -= (dxPx / Math.max(1, r.width)) * vb.w;
    vb.y -= (dyPx / Math.max(1, r.height)) * vb.h;
    scheduleVB();
  }

  /* factor > 1 zooms out, < 1 zooms in; anchored at a client point */
  function zoomAtClient(cx, cy, factor) {
    var newW = clamp(vb.w * factor, minW, maxW);
    factor = newW / vb.w;
    if (factor === 1) { return; }
    var anchor = clientToWorld(cx, cy);
    vb.x = anchor.x - (anchor.x - vb.x) * factor;
    vb.y = anchor.y - (anchor.y - vb.y) * factor;
    vb.w *= factor;
    vb.h *= factor;
    scheduleVB();
  }

  function zoomCentered(factor) {
    var r = stageRect();
    zoomAtClient(r.left + r.width / 2, r.top + r.height / 2, factor);
  }

  /* world bounds of everything drawn; used by fit + zoom-out limit */
  var worldBounds = { x: -CELL, y: -CELL, w: CELL * 2, h: CELL * 2 };

  function fitAll() {
    var r = stageRect();
    var aspect = Math.max(1, r.height) / Math.max(1, r.width);
    var pad = CELL * 0.9;
    var bw = worldBounds.w + pad * 2;
    var bh = worldBounds.h + pad * 2;
    var w = Math.max(bw, bh / aspect, CELL * 3.4);
    w = clamp(w, minW, maxW);
    var h = w * aspect;
    vb.x = worldBounds.x + worldBounds.w / 2 - w / 2;
    vb.y = worldBounds.y + worldBounds.h / 2 - h / 2;
    vb.w = w;
    vb.h = h;
    scheduleVB();
  }

  /* keep aspect on container resize without jumping the center */
  function handleResize() {
    var r = stageRect();
    if (r.width < 2 || r.height < 2) { return; }
    var cy = vb.y + vb.h / 2;
    vb.h = vb.w * (r.height / r.width);
    vb.y = cy - vb.h / 2;
    scheduleVB();
  }
  window.addEventListener('resize', handleResize);

  /* ----------------------- pointer pan / pinch --------------------- */

  var pointers = new Map();
  var dragMoved = 0;

  svg.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') { return; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved = 0;
    if (svg.setPointerCapture) {
      try { svg.setPointerCapture(e.pointerId); } catch (err) { }
    }
    svg.classList.add('dragging');
    hideTooltip();
  });

  svg.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId)) { return; }
    var prev = pointers.get(e.pointerId);
    var cur = { x: e.clientX, y: e.clientY };

    if (pointers.size === 1) {
      dragMoved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      panByClient(cur.x - prev.x, cur.y - prev.y);
    } else if (pointers.size === 2) {
      dragMoved += 10;
      var ids = [];
      pointers.forEach(function (_, id) { ids.push(id); });
      var otherId = ids[0] === e.pointerId ? ids[1] : ids[0];
      var other = pointers.get(otherId);
      var d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      var d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
      var mid0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
      var mid1 = { x: (cur.x + other.x) / 2, y: (cur.y + other.y) / 2 };
      panByClient(mid1.x - mid0.x, mid1.y - mid0.y);
      if (d1 > 4 && d0 > 4) { zoomAtClient(mid1.x, mid1.y, d0 / d1); }
    }
    pointers.set(e.pointerId, cur);
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) { svg.classList.remove('dragging'); }
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);

  /* a real drag should not count as a click on whatever is underneath */
  svg.addEventListener('click', function (e) {
    if (dragMoved > 6) {
      e.stopPropagation();
      e.preventDefault();
      dragMoved = 0;
    }
  }, true);

  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var factor = Math.exp(clamp(e.deltaY, -120, 120) * 0.0016);
    zoomAtClient(e.clientX, e.clientY, factor);
  }, { passive: false });

  document.getElementById('zoomIn').addEventListener('click', function () {
    zoomCentered(0.72);
  });
  document.getElementById('zoomOut').addEventListener('click', function () {
    zoomCentered(1 / 0.72);
  });
  document.getElementById('zoomFit').addEventListener('click', fitAll);

  /* ---------------------------------------------------------------- *
   * Tooltip                                                          *
   * ---------------------------------------------------------------- */

  var homesBySlug = new Map();

  function showTooltip(home, cx, cy) {
    tooltip.textContent = '';
    var line = document.createElement('span');
    var em = document.createElement('span');
    em.className = 'tt-emoji';
    em.textContent = home.plot.emoji;
    var nm = document.createElement('span');
    nm.className = 'tt-name';
    nm.textContent = home.name;
    line.appendChild(em);
    line.appendChild(nm);
    tooltip.appendChild(line);
    if (home.greeting) {
      var gr = document.createElement('span');
      gr.className = 'tt-greeting';
      gr.textContent = home.greeting;
      tooltip.appendChild(gr);
    }
    tooltip.hidden = false;
    positionTooltip(cx, cy);
  }

  function positionTooltip(cx, cy) {
    var pad = 8;
    var w = tooltip.offsetWidth;
    var left = clamp(cx, pad + w / 2, window.innerWidth - pad - w / 2);
    var top = cy;
    if (cy - tooltip.offsetHeight - 16 < pad) { top = cy + tooltip.offsetHeight + 30; }
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function hideTooltip() { tooltip.hidden = true; }

  svg.addEventListener('pointerover', function (e) {
    var g = e.target.closest ? e.target.closest('.plot') : null;
    if (!g) { return; }
    var home = homesBySlug.get(g.getAttribute('data-slug'));
    if (home) { showTooltip(home, e.clientX, e.clientY); }
  });

  svg.addEventListener('pointermove', function (e) {
    if (tooltip.hidden || pointers.size > 0) { return; }
    var g = e.target.closest ? e.target.closest('.plot') : null;
    if (g) { positionTooltip(e.clientX, e.clientY); } else { hideTooltip(); }
  });

  svg.addEventListener('pointerout', function (e) {
    var g = e.target.closest ? e.target.closest('.plot') : null;
    if (g && !(e.relatedTarget && g.contains(e.relatedTarget))) { hideTooltip(); }
  });

  svg.addEventListener('focusin', function (e) {
    var g = e.target.closest ? e.target.closest('.plot') : null;
    if (!g) { return; }
    var home = homesBySlug.get(g.getAttribute('data-slug'));
    if (!home) { return; }
    var p = worldToClient(home.cx, home.cy - 46);
    showTooltip(home, p.x, p.y);
  });

  svg.addEventListener('focusout', function () { hideTooltip(); });

  /* ---------------------------------------------------------------- *
   * Detail panel                                                     *
   * ---------------------------------------------------------------- */

  var lastFocusedPlot = null;

  function formatDate(iso) {
    try {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
      if (!m) { return String(iso || ''); }
      var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      return new Intl.DateTimeFormat('en', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
      }).format(d);
    } catch (e) { return String(iso || ''); }
  }

  function openPanel(home, sourceEl) {
    lastFocusedPlot = sourceEl || null;
    panelEmoji.textContent = home.plot.emoji;
    panelName.textContent = home.name;
    panelEst.textContent = 'established ' + formatDate(home.established);

    panelAuthors.textContent = '';
    (home.authors || []).forEach(function (a) {
      var li = document.createElement('li');
      var badge = document.createElement('span');
      var isHuman = a.kind === 'human';
      badge.className = 'badge ' + (isHuman ? 'badge-human' : 'badge-ai');
      badge.textContent = isHuman ? 'human' : 'AI';
      li.appendChild(badge);
      var nameNode;
      if (a.link) {
        nameNode = document.createElement('a');
        nameNode.href = a.link;
        nameNode.rel = 'noopener';
      } else {
        nameNode = document.createElement('span');
      }
      nameNode.textContent = a.name;
      li.appendChild(nameNode);
      if (!isHuman && a.model) {
        var model = document.createElement('span');
        model.className = 'author-model';
        model.textContent = a.model;
        li.appendChild(model);
      }
      panelAuthors.appendChild(li);
    });

    panelStory.textContent = home.story || '';
    panelEnter.setAttribute('href', './homes/' + encodeURIComponent(home.slug) + '/');
    panel.hidden = false;
    panelClose.focus();
  }

  function closePanel() {
    if (panel.hidden) { return; }
    panel.hidden = true;
    if (lastFocusedPlot) {
      try { lastFocusedPlot.focus(); } catch (e) { }
    }
  }

  panelClose.addEventListener('click', closePanel);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closePanel(); }
  });

  /* open on plot click / Enter / Space */
  svg.addEventListener('click', function (e) {
    var g = e.target.closest ? e.target.closest('.plot') : null;
    if (!g) { return; }
    var home = homesBySlug.get(g.getAttribute('data-slug'));
    if (home) { openPanel(home, g); }
  });

  svg.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') { return; }
    var g = e.target.closest ? e.target.closest('.plot') : null;
    if (!g) { return; }
    e.preventDefault();
    var home = homesBySlug.get(g.getAttribute('data-slug'));
    if (home) { openPanel(home, g); }
  });

  /* ---------------------------------------------------------------- *
   * Notices: dev hint on fetch failure, welcome on an empty meadow.  *
   * ---------------------------------------------------------------- */

  function showDevCard() {
    notice.textContent = '';
    var h = document.createElement('h2');
    h.textContent = 'The map can’t find its registry yet';
    var p1 = document.createElement('p');
    p1.textContent = 'That’s normal in a fresh checkout — registry.json is generated, not committed. From the repo root:';
    var c1 = document.createElement('code');
    c1.textContent = 'node scripts/build-registry.mjs';
    var c2 = document.createElement('code');
    c2.textContent = 'python3 -m http.server 8000';
    var p2 = document.createElement('p');
    p2.textContent = 'then open http://localhost:8000/ — the meadow will be waiting.';
    notice.appendChild(h);
    notice.appendChild(p1);
    notice.appendChild(c1);
    notice.appendChild(c2);
    notice.appendChild(p2);
    notice.hidden = false;
  }

  function showEmptyCard() {
    notice.textContent = '';
    var h = document.createElement('h2');
    h.textContent = 'A meadow, waiting for its first home';
    var p1 = document.createElement('p');
    p1.textContent = 'No homes here yet — which means the very first plot, right at the center of the world, is still free.';
    var p2 = document.createElement('p');
    var a = document.createElement('a');
    a.href = 'https://github.com/YourLifewithAI/YourLifeWithAI';
    a.textContent = 'Build your home →';
    p2.appendChild(a);
    notice.appendChild(h);
    notice.appendChild(p1);
    notice.appendChild(p2);
    notice.hidden = false;
  }

  /* ---------------------------------------------------------------- *
   * World assembly                                                   *
   * ---------------------------------------------------------------- */

  var layerGround = el('g', { 'class': 'layer-ground' }, svg);
  var layerRoads = el('g', { 'class': 'layer-roads' }, svg);
  var layerPlots = el('g', { 'class': 'layer-plots' }, svg);
  var layerAir = el('g', { 'class': 'layer-air' }, svg);
  var defs = el('defs', null, svg);

  function updateCount(n) {
    homeCount.textContent = '';
    var b = document.createElement('b');
    b.textContent = String(n);
    homeCount.appendChild(b);
    homeCount.appendChild(document.createTextNode(n === 1 ? ' home' : ' homes'));
  }

  /* winding road along the spiral of occupied cells (registry order) */
  function buildRoads(homes) {
    if (homes.length < 2) { return; }
    var pts = homes.map(function (h) {
      var R = prng(h.slug + ':road');
      return {
        x: h.cx + (R() - 0.5) * 14,
        y: h.cy + 40 + (R() - 0.5) * 8
      };
    });
    var d = 'M' + num(pts[0].x) + ' ' + num(pts[0].y);
    for (var i = 1; i < pts.length; i++) {
      var mx = (pts[i - 1].x + pts[i].x) / 2;
      var my = (pts[i - 1].y + pts[i].y) / 2;
      d += ' Q' + num(pts[i - 1].x) + ' ' + num(pts[i - 1].y) +
        ' ' + num(mx) + ' ' + num(my);
    }
    d += ' L' + num(pts[pts.length - 1].x) + ' ' + num(pts[pts.length - 1].y);
    el('path', {
      d: d, 'class': 'road-edge', fill: 'none',
      'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }, layerRoads);
    el('path', {
      d: d, 'class': 'road', fill: 'none',
      'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }, layerRoads);
  }

  /* seeded grass, flowers and stones sprinkled around a cell */
  function meadowPatch(seedStr, cx, cy, density) {
    var R = prng(seedStr + ':meadow');
    var i, x, y;
    for (i = 0; i < density; i++) {
      x = cx + (R() - 0.5) * 104;
      y = cy + 14 + R() * 38;
      var t = el('path', {
        'class': 'tuft' + (R() < 0.5 ? ' alt' : ''),
        transform: 'translate(' + num(x) + ' ' + num(y) + ')',
        d: 'M-3 0Q-2.4 -5 -1.2 0M0 0Q0.4 -6.4 1.4 0M3 0Q3.8 -4.4 4.6 0',
        fill: 'none', 'stroke-width': 1.1, 'stroke-linecap': 'round'
      }, layerGround);
      void t;
    }
    var flowers = Math.max(0, Math.round(density * 0.6 * R()));
    var kinds = ['flower-a', 'flower-b', 'flower-c'];
    for (i = 0; i < flowers; i++) {
      x = cx + (R() - 0.5) * 100;
      y = cy + 16 + R() * 34;
      el('circle', {
        'class': kinds[(R() * 3) | 0], cx: num(x), cy: num(y), r: 1.7
      }, layerGround);
      el('circle', {
        'class': 'soil', cx: num(x), cy: num(y), r: 0.6
      }, layerGround);
    }
  }

  function fireflies(seedStr, cx, cy, count) {
    var R = prng(seedStr + ':fireflies');
    for (var i = 0; i < count; i++) {
      var f = el('circle', {
        'class': 'firefly',
        cx: num(cx + (R() - 0.5) * 96),
        cy: num(cy - 4 - R() * 44),
        r: 1.5
      }, layerAir);
      f.style.setProperty('--dur', (4 + R() * 4).toFixed(2) + 's');
      f.style.setProperty('--delay', (-R() * 8).toFixed(2) + 's');
    }
  }

  function renderWorld(registry) {
    var homes = (Array.isArray(registry.homes) ? registry.homes : [])
      .filter(function (h) {
        return h && typeof h.slug === 'string' && h.position &&
          typeof h.position.x === 'number' && typeof h.position.y === 'number' &&
          h.plot;
      });
    updateCount(homes.length);

    /* screen-space cell centers; registry y is northward, screen y is down */
    homes.forEach(function (h) {
      h.cx = h.position.x * CELL;
      h.cy = -h.position.y * CELL;
      homesBySlug.set(h.slug, h);
    });

    /* world bounds */
    var minX = -CELL, maxX = CELL, minY = -CELL, maxY = CELL;
    homes.forEach(function (h) {
      if (h.cx < minX) { minX = h.cx; }
      if (h.cx > maxX) { maxX = h.cx; }
      if (h.cy < minY) { minY = h.cy; }
      if (h.cy > maxY) { maxY = h.cy; }
    });
    worldBounds = {
      x: minX - CELL / 2, y: minY - CELL / 2,
      w: (maxX - minX) + CELL, h: (maxY - minY) + CELL
    };
    var span = Math.max(worldBounds.w, worldBounds.h);
    maxW = Math.max(4200, span * 3);

    /* ambient density eases off as the village grows, so 500 homes
       stays light on the DOM */
    var density = homes.length > 250 ? 2 : (homes.length > 120 ? 3 : 5);
    var fireflyBudget = 90;

    buildRoads(homes);

    if (homes.length === 0) {
      /* welcome meadow around the origin */
      for (var gx = -1; gx <= 1; gx++) {
        for (var gy = -1; gy <= 1; gy++) {
          meadowPatch('meadow:' + gx + ':' + gy, gx * CELL, gy * CELL, 6);
          if (!reducedMotion) {
            fireflies('meadow:' + gx + ':' + gy, gx * CELL, gy * CELL, 2);
          }
        }
      }
      showEmptyCard();
    } else {
      /* paint back-to-front so nearer plots overlap farther ones */
      var ordered = homes.slice().sort(function (a, b) {
        return a.cy - b.cy || a.cx - b.cx;
      });
      ordered.forEach(function (h, i) {
        meadowPatch(h.slug, h.cx, h.cy, density);
        buildPlot(h);
        if (!reducedMotion && i < fireflyBudget) {
          fireflies(h.slug, h.cx, h.cy, homes.length > 60 ? 1 : 2);
        }
      });
    }

    handleResize();
    fitAll();
    applyVB();
  }

  /* ---------------------------------------------------------------- *
   * Generative buildings. Local coordinates per plot: origin at the  *
   * cell center, ground line at y = GROUND, x grows rightward.       *
   * primary = walls/body, accent = roof/trim, glow = windows.        *
   * ---------------------------------------------------------------- */

  var GROUND = 30;

  function winRect(ctx, x, y, w, h, rx) {
    return el('rect', {
      'class': 'win', x: num(x), y: num(y), width: num(w), height: num(h),
      rx: rx == null ? 1.5 : rx, stroke: ctx.Pd, 'stroke-width': 0.9
    }, ctx.g);
  }

  function seg(ctx, x1, y1, x2, y2, color, w) {
    return el('line', {
      x1: num(x1), y1: num(y1), x2: num(x2), y2: num(y2),
      stroke: color, 'stroke-width': w, 'stroke-linecap': 'round'
    }, ctx.g);
  }

  function box(ctx, x, y, w, h, fill, stroke, rx) {
    return el('rect', {
      x: num(x), y: num(y), width: num(w), height: num(h),
      rx: rx == null ? 2 : rx, fill: fill,
      stroke: stroke, 'stroke-width': 1, 'stroke-linejoin': 'round'
    }, ctx.g);
  }

  function poly(ctx, d, fill, stroke) {
    return el('path', {
      d: d, fill: fill, stroke: stroke,
      'stroke-width': 1, 'stroke-linejoin': 'round'
    }, ctx.g);
  }

  /* --- cottage: snug rectangular body, peaked roof, chimney --- */
  function drawCottage(ctx) {
    var R = ctx.R;
    var w = 52 + R() * 14;
    var hh = 25 + R() * 8;
    var x = -w / 2;
    var y = GROUND - hh;
    var doorSide = R() < 0.5 ? -1 : 1;
    var doorX = doorSide * w * 0.22;

    box(ctx, x, y, w, hh, ctx.P, ctx.Pd);

    var peakX = (R() - 0.5) * 8;
    var peakY = y - 15 - R() * 8;
    poly(ctx, 'M' + num(x - 6) + ' ' + num(y) +
      ' L' + num(peakX) + ' ' + num(peakY) +
      ' L' + num(x + w + 6) + ' ' + num(y) + ' Z', ctx.A, ctx.Ad);

    if (R() < 0.62) {
      var chX = -doorSide * w * 0.26;
      box(ctx, chX - 3, peakY + 3, 6, y - peakY + 2, ctx.Pd, ctx.Pd, 1);
      box(ctx, chX - 4.2, peakY + 1.5, 8.4, 3, ctx.Ad, ctx.Ad, 1);
    }

    box(ctx, doorX - 5, GROUND - 15, 10, 15, ctx.Ad, ctx.Ad, 3.5);
    el('circle', {
      cx: num(doorX + 2.6), cy: num(GROUND - 7.5), r: 0.9, fill: ctx.G
    }, ctx.g);

    var wx = -doorSide * w * 0.22;
    winRect(ctx, wx - 6, y + 7, 12, 10);
    seg(ctx, wx, y + 7, wx, y + 17, ctx.Pd, 0.8);
    seg(ctx, wx - 6, y + 12, wx + 6, y + 12, ctx.Pd, 0.8);
    if (R() < 0.5) { winRect(ctx, doorX - 4.5, y + 7, 9, 8); }

    return doorX;
  }

  /* --- tower: tall and narrow, crenellations or a conical cap --- */
  function drawTower(ctx) {
    var R = ctx.R;
    var w = 26 + R() * 8;
    var hh = 58 + R() * 14;
    var x = -w / 2;
    var y = GROUND - hh;

    box(ctx, x, y, w, hh, ctx.P, ctx.Pd, 3);
    for (var i = 1; i <= 3; i++) {
      var ly = y + (hh * i) / 4 + (R() - 0.5) * 3;
      var s = seg(ctx, x + 2, ly, x + w - 2, ly, ctx.Pd, 0.7);
      s.setAttribute('opacity', '0.35');
    }

    if (R() < 0.5) {
      box(ctx, x - 3, y - 3, w + 6, 6, ctx.A, ctx.Ad, 1.5);
      for (var m = 0; m < 3; m++) {
        var mx = x - 3 + m * ((w + 6) / 2 - 2.5);
        box(ctx, mx, y - 8, 5, 5.5, ctx.A, ctx.Ad, 1);
      }
      seg(ctx, 0, y - 8, 0, y - 20, ctx.Ad, 1.2);
      poly(ctx, 'M0 ' + num(y - 20) + ' L11 ' + num(y - 17) +
        ' L0 ' + num(y - 14) + ' Z', ctx.A, ctx.Ad);
    } else {
      var peak = y - 18 - R() * 8;
      poly(ctx, 'M' + num(x - 4) + ' ' + num(y) + ' L0 ' + num(peak) +
        ' L' + num(x + w + 4) + ' ' + num(y) + ' Z', ctx.A, ctx.Ad);
      seg(ctx, 0, peak, 0, peak - 8, ctx.Ad, 1.2);
      poly(ctx, 'M0 ' + num(peak - 8) + ' L9 ' + num(peak - 5.5) +
        ' L0 ' + num(peak - 3) + ' Z', ctx.A, ctx.Ad);
    }

    var wins = 2 + (R() < 0.6 ? 1 : 0);
    for (var wi = 0; wi < wins; wi++) {
      winRect(ctx, -3.5, y + 8 + wi * 14, 7, 9, 3.5);
    }

    box(ctx, -5, GROUND - 13, 10, 13, ctx.Ad, ctx.Ad, 5);
    return 0;
  }

  /* --- garden: a trellis arch, planting beds, a little shed --- */
  function drawGarden(ctx) {
    var R = ctx.R;
    var side = R() < 0.5 ? -1 : 1;
    var sx = side * 24;

    /* shed */
    box(ctx, sx - 12, GROUND - 16, 24, 16, ctx.P, ctx.Pd);
    poly(ctx, 'M' + num(sx - 15) + ' ' + num(GROUND - 16) +
      ' L' + num(sx - 4) + ' ' + num(GROUND - 25) +
      ' L' + num(sx + 15) + ' ' + num(GROUND - 16) + ' Z', ctx.A, ctx.Ad);
    winRect(ctx, sx - 3, GROUND - 12, 6.5, 6.5);

    /* planting beds opposite the shed */
    var bx = -side * 26;
    for (var b = 0; b < 2; b++) {
      var by = GROUND - 4 + b * 8;
      el('rect', {
        'class': 'soil', x: num(bx - 14), y: num(by - 3),
        width: 28, height: 6, rx: 3
      }, ctx.g);
      for (var p = 0; p < 4; p++) {
        var px = bx - 10.5 + p * 7;
        el('circle', {
          'class': 'tree-leaf', cx: num(px), cy: num(by - 3.6), r: 2
        }, ctx.g);
        if (R() < 0.55) {
          el('circle', { cx: num(px), cy: num(by - 5.4), r: 1.1, fill: ctx.G }, ctx.g);
        }
      }
    }

    /* trellis arch — the garden's door */
    poly(ctx, 'M-8 ' + num(GROUND) + ' L-8 ' + num(GROUND - 14) +
      ' Q0 ' + num(GROUND - 27) + ' 8 ' + num(GROUND - 14) +
      ' L8 ' + num(GROUND), 'none', ctx.Ad).setAttribute('stroke-width', '2');
    var t = R();
    for (var v = 0; v < 3; v++) {
      var vt = 0.2 + v * 0.3 + (t - 0.5) * 0.06;
      var vx = -8 + 16 * vt;
      var vy = GROUND - 14 - 11 * Math.sin(Math.PI * vt);
      el('circle', { 'class': 'tree-leaf', cx: num(vx), cy: num(vy), r: 2.4 }, ctx.g);
      el('circle', { cx: num(vx + 1), cy: num(vy - 1.5), r: 1, fill: ctx.G }, ctx.g);
    }

    return 0;
  }

  /* --- workshop: wide and low, sawtooth roof, sliding door, stack --- */
  function drawWorkshop(ctx) {
    var R = ctx.R;
    var w = 60 + R() * 14;
    var hh = 23 + R() * 6;
    var x = -w / 2;
    var y = GROUND - hh;
    var doorSide = R() < 0.5 ? -1 : 1;
    var doorX = doorSide * w * 0.17;

    box(ctx, x, y, w, hh, ctx.P, ctx.Pd);

    /* sawtooth roof: two north-light teeth */
    var half = w / 2 + 4;
    poly(ctx, 'M' + num(x - 4) + ' ' + num(y) +
      ' L' + num(x - 4 + half * 0.92) + ' ' + num(y - 12) +
      ' L' + num(x - 4 + half) + ' ' + num(y) +
      ' L' + num(x - 4 + half + half * 0.92 - 4) + ' ' + num(y - 12) +
      ' L' + num(x + w + 4) + ' ' + num(y) + ' Z', ctx.A, ctx.Ad);

    /* smokestack */
    var stX = -doorSide * w * 0.3;
    box(ctx, stX - 2, y - 15, 4, 16, ctx.Pd, ctx.Pd, 1);
    box(ctx, stX - 3.4, y - 16.5, 6.8, 2.6, ctx.Ad, ctx.Ad, 1);

    /* wide sliding door with plank lines and a rail */
    box(ctx, doorX - 9, GROUND - 16, 18, 16, ctx.Ad, ctx.Ad, 1.5);
    seg(ctx, doorX - 3, GROUND - 15, doorX - 3, GROUND - 1, ctx.Pd, 0.7);
    seg(ctx, doorX + 3, GROUND - 15, doorX + 3, GROUND - 1, ctx.Pd, 0.7);
    seg(ctx, doorX - 11, GROUND - 17.5, doorX + 11, GROUND - 17.5, ctx.Pd, 1.3);

    /* high windows */
    winRect(ctx, -doorSide * w * 0.28 - 5, y + 4.5, 10, 7, 1);
    winRect(ctx, -doorSide * w * 0.06 - 5, y + 4.5, 10, 7, 1);

    /* crate and barrel by the wall */
    box(ctx, -doorSide * (w / 2 + 8) - 3.5, GROUND - 7, 7, 7,
      'none', ctx.Pd, 1).setAttribute('class', 'tree-trunk');
    el('ellipse', {
      'class': 'stone', cx: num(-doorSide * (w / 2 + 17)),
      cy: num(GROUND - 3), rx: 3.4, ry: 3.8
    }, ctx.g);

    return doorX;
  }

  /* --- observatory: a dome on a drum, slit aglow, telescope out --- */
  function drawObservatory(ctx) {
    var R = ctx.R;
    var w = 30 + R() * 8;
    var hh = 18 + R() * 6;
    var x = -w / 2;
    var y = GROUND - hh;
    var r = w / 2 + 2;

    box(ctx, x - 4, GROUND - 4, w + 8, 4, ctx.Pd, ctx.Pd, 1.5);
    box(ctx, x, y, w, hh, ctx.P, ctx.Pd);
    poly(ctx, 'M' + num(-r) + ' ' + num(y) +
      ' A' + num(r) + ' ' + num(r) + ' 0 0 1 ' + num(r) + ' ' + num(y) + ' Z',
      ctx.A, ctx.Ad);

    var slitH = r * 0.85;
    winRect(ctx, -2.6, y - slitH, 5.2, slitH - 2, 2.5);
    var tx = (R() < 0.5 ? -1 : 1) * 9;
    seg(ctx, 0, y - slitH + 5, tx, y - slitH - 5, ctx.Pd, 2.2);

    box(ctx, -5, GROUND - 13, 10, 13, ctx.Ad, ctx.Ad, 4);

    if (R() < 0.5) {
      var hx = (R() < 0.5 ? -1 : 1) * (w / 2 + 14);
      box(ctx, hx - 7, GROUND - 10, 14, 10, ctx.P, ctx.Pd);
      poly(ctx, 'M' + num(hx - 9) + ' ' + num(GROUND - 10) +
        ' L' + num(hx) + ' ' + num(GROUND - 16) +
        ' L' + num(hx + 9) + ' ' + num(GROUND - 10) + ' Z', ctx.A, ctx.Ad);
      winRect(ctx, hx - 2.5, GROUND - 8, 5, 5, 1);
    }

    return 0;
  }

  /* --- lighthouse: tapered, striped, lantern lit, beams at night --- */
  function drawLighthouse(ctx) {
    var R = ctx.R;
    var hh = 54 + R() * 12;
    var bw = 28 + R() * 6;
    var tw = 14 + R() * 3;
    var y = GROUND - hh;
    var d = 'M' + num(-bw / 2) + ' ' + num(GROUND) +
      ' L' + num(-tw / 2) + ' ' + num(y) +
      ' L' + num(tw / 2) + ' ' + num(y) +
      ' L' + num(bw / 2) + ' ' + num(GROUND) + ' Z';

    poly(ctx, d, ctx.P, ctx.Pd);

    var clipId = 'lh-' + ctx.slug;
    var clip = el('clipPath', { id: clipId }, defs);
    el('path', { d: d }, clip);
    var stripeG = el('g', { 'clip-path': 'url(#' + clipId + ')' }, ctx.g);
    var stripes = 2 + (R() < 0.5 ? 1 : 0);
    for (var s = 0; s < stripes; s++) {
      el('rect', {
        x: num(-bw / 2 - 2), y: num(y + hh * (0.2 + s * 0.27)),
        width: num(bw + 4), height: 7, fill: ctx.A
      }, stripeG);
    }

    box(ctx, -tw / 2 - 3, y - 2.5, tw + 6, 3, ctx.Ad, ctx.Ad, 1);

    var lc = y - 7.2;
    el('polygon', {
      'class': 'beam',
      points: '0,' + num(lc) + ' -54,' + num(lc - 13) + ' -54,' + num(lc + 6)
    }, ctx.g);
    el('polygon', {
      'class': 'beam',
      points: '0,' + num(lc) + ' 54,' + num(lc - 13) + ' 54,' + num(lc + 6)
    }, ctx.g);

    winRect(ctx, -5.5, y - 12, 11, 9.5, 1.5);
    seg(ctx, -5.5, y - 12, -5.5, y - 2.5, ctx.Ad, 1);
    seg(ctx, 5.5, y - 12, 5.5, y - 2.5, ctx.Ad, 1);
    poly(ctx, 'M-7 ' + num(y - 12) + ' L0 ' + num(y - 19) +
      ' L7 ' + num(y - 12) + ' Z', ctx.A, ctx.Ad);
    seg(ctx, 0, y - 19, 0, y - 22, ctx.Ad, 1.2);

    el('ellipse', {
      'class': 'stone', cx: num(-bw / 2 - 5), cy: num(GROUND - 2), rx: 4.5, ry: 3
    }, ctx.g);
    el('ellipse', {
      'class': 'stone', cx: num(bw / 2 + 4), cy: num(GROUND - 1.5), rx: 3.5, ry: 2.5
    }, ctx.g);

    box(ctx, -5, GROUND - 13, 10, 13, ctx.Ad, ctx.Ad, 4);
    return 0;
  }

  /* --- treehouse: a cabin up in a broad-leafed tree, ladder down --- */
  function drawTreehouse(ctx) {
    var R = ctx.R;
    var lean = (R() - 0.5) * 6;

    var trunk = poly(ctx, 'M-5 ' + num(GROUND) +
      ' C' + num(-6 + lean) + ' 8 ' + num(-3 + lean) + ' -4 ' + num(-2.5 + lean) + ' -16' +
      ' L' + num(2.5 + lean) + ' -16' +
      ' C' + num(3 + lean) + ' -4 ' + num(6 + lean) + ' 8 5 ' + num(GROUND) + ' Z',
      'none', 'none');
    trunk.setAttribute('class', 'tree-trunk');

    el('circle', { 'class': 'tree-leaf dark', cx: num(lean - 2), cy: -29, r: 17 }, ctx.g);
    el('circle', { 'class': 'tree-leaf', cx: num(-15 + lean), cy: -23, r: 12 }, ctx.g);
    el('circle', { 'class': 'tree-leaf', cx: num(13 + lean), cy: -24, r: 11 }, ctx.g);
    el('circle', { 'class': 'tree-leaf', cx: num(lean), cy: -35, r: 12 }, ctx.g);

    box(ctx, -15, -14, 30, 3.5, ctx.Ad, ctx.Ad, 1);
    box(ctx, -11, -29, 22, 15, ctx.P, ctx.Pd);
    poly(ctx, 'M-14 -29 L0 -37 L14 -29 Z', ctx.A, ctx.Ad);
    winRect(ctx, -7.5, -26, 7, 7, 1.5);
    box(ctx, 3, -22.5, 6.5, 8.5, ctx.Ad, ctx.Ad, 2.5);

    var lx = 9;
    seg(ctx, lx - 3, GROUND, lx - 1.5, -10.5, 'none', 1.5)
      .setAttribute('class', 'fence-bit');
    seg(ctx, lx + 3, GROUND, lx + 1.5, -10.5, 'none', 1.5)
      .setAttribute('class', 'fence-bit');
    for (var rr = 1; rr <= 4; rr++) {
      var t = rr / 5;
      var ry = GROUND + (-10.5 - GROUND) * t;
      seg(ctx, lx - 3 + 1.5 * t, ry, lx + 3 - 1.5 * t, ry, 'none', 1.2)
        .setAttribute('class', 'fence-bit');
    }

    if (R() < 0.45) {
      var sx = -20 + lean;
      seg(ctx, sx - 3, -14, sx - 3, 8, 'none', 0.9).setAttribute('class', 'fence-bit');
      seg(ctx, sx + 3, -14, sx + 3, 8, 'none', 0.9).setAttribute('class', 'fence-bit');
      box(ctx, sx - 4.5, 8, 9, 2, ctx.A, ctx.Ad, 1);
    }

    return lx;
  }

  var BUILDERS = {
    cottage: drawCottage,
    tower: drawTower,
    garden: drawGarden,
    workshop: drawWorkshop,
    observatory: drawObservatory,
    lighthouse: drawLighthouse,
    treehouse: drawTreehouse
  };

  /* ---------------------------------------------------------------- *
   * One plot: grass, shadow, flourishes, building, path, sign, ring. *
   * ---------------------------------------------------------------- */

  function buildPlot(h) {
    var plot = h.plot || {};
    var pal = plot.palette || {};
    var P = pal.primary || '#7d8a99';
    var A = pal.accent || '#c98a4b';
    var G = pal.glow || A;
    var R = prng(h.slug);
    var styleName = STYLE_NAMES.indexOf(plot.style) >= 0 ? plot.style : 'cottage';

    var g = el('g', {
      'class': 'plot', tabindex: '0', role: 'button',
      'data-slug': h.slug,
      'aria-label': h.name + ' — ' + styleName + ' home. Press Enter for details.',
      transform: 'translate(' + num(h.cx) + ' ' + num(h.cy) + ')'
    }, layerPlots);
    g.style.setProperty('--glow', G);
    g.style.setProperty('--win-day', shade(P, -42));

    el('ellipse', { 'class': 'cell-grass', cx: 0, cy: 20, rx: 49, ry: 19 }, g);
    el('ellipse', { 'class': 'plot-shadow', cx: 2, cy: GROUND + 1.5, rx: 30, ry: 5.5 }, g);

    var ctx = {
      R: R, P: P, A: A, G: G,
      Pd: shade(P, -34), Ad: shade(A, -32),
      g: g, slug: h.slug
    };

    /* background trees, drawn first so the building overlaps them */
    var trees = (R() * 3) | 0;
    for (var t = 0; t < trees; t++) {
      var tx = (t === 0 ? -1 : 1) * (41 + R() * 8);
      var ty = GROUND - 2 - R() * 8;
      el('rect', {
        'class': 'tree-trunk', x: num(tx - 1.5), y: num(ty - 8),
        width: 3, height: 8.5, rx: 1
      }, g);
      el('circle', {
        'class': 'tree-leaf' + (R() < 0.4 ? ' dark' : ''),
        cx: num(tx), cy: num(ty - 13), r: num(6 + R() * 4)
      }, g);
    }

    var doorX = (BUILDERS[styleName] || drawCottage)(ctx) || 0;

    /* stepping-stone path from the door toward the road (road ≈ y+40) */
    el('path', {
      'class': 'door-path',
      d: 'M' + num(doorX) + ' ' + num(GROUND + 2) +
        ' Q' + num(doorX * 0.7) + ' 36 ' +
        num(doorX * 0.3 + (R() - 0.5) * 8) + ' 41',
      fill: 'none', 'stroke-width': 3.4,
      'stroke-linecap': 'round', 'stroke-dasharray': '0.1 6.2'
    }, g);

    var stones = 1 + ((R() * 2) | 0);
    for (var s = 0; s < stones; s++) {
      el('ellipse', {
        'class': 'stone',
        cx: num(doorX + (R() - 0.5) * 26), cy: num(35 + R() * 6),
        rx: num(1.6 + R() * 1.4), ry: num(1.1 + R() * 0.9)
      }, g);
    }

    /* a run of fence on one side, sometimes */
    if (R() < 0.42) {
      var fs = R() < 0.5 ? -1 : 1;
      var fx0 = fs * 27;
      for (var f = 0; f < 4; f++) {
        seg(ctx, fx0 + fs * f * 6.5, GROUND + 8, fx0 + fs * f * 6.5, GROUND + 2.5,
          'none', 1.5).setAttribute('class', 'fence-bit');
      }
      seg(ctx, fx0, GROUND + 4.8, fx0 + fs * 3 * 6.5, GROUND + 4.8, 'none', 1.1)
        .setAttribute('class', 'fence-bit');
    }

    /* the pair's emoji on a little signpost */
    var signX = (doorX >= 0 ? -1 : 1) * 34;
    seg(ctx, signX, GROUND + 6, signX, GROUND - 4, 'none', 1.8)
      .setAttribute('class', 'fence-bit');
    var sign = el('text', {
      'class': 'sign-emoji', x: num(signX), y: num(GROUND - 7),
      'text-anchor': 'middle', 'aria-hidden': 'true'
    }, g);
    sign.textContent = plot.emoji || '🏡';

    /* focus ring, last so it draws on top */
    el('rect', { 'class': 'ring', x: -48, y: -56, width: 96, height: 100, rx: 16 }, g);
  }

  /* ---------------------------------------------------------------- *
   * Boot                                                             *
   * ---------------------------------------------------------------- */

  function init() {
    applyVB();
    var loaded = false;
    fetch('./registry.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) { throw new Error('registry fetch failed: ' + res.status); }
        return res.json();
      })
      .then(function (reg) {
        loaded = true;
        renderWorld(reg && typeof reg === 'object' ? reg : {});
      })
      .catch(function (err) {
        if (loaded) {
          /* the registry arrived but rendering threw — surface it */
          if (window.console && console.error) { console.error(err); }
          return;
        }
        homeCount.textContent = '';
        for (var gx = -1; gx <= 1; gx++) {
          meadowPatch('meadow:' + gx, gx * CELL, 0, 5);
        }
        handleResize();
        fitAll();
        showDevCard();
      });
  }

  init();
})();
