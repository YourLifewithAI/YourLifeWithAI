// Shared validation + placement logic for "Your Life With AI".
// Single source of truth used by scripts/validate.mjs and
// scripts/build-registry.mjs. See docs/SPEC.md — the spec wins.
//
// Node >= 18, ESM, zero npm dependencies.

import fs from "node:fs";
import path from "node:path";

export const SPEC_VERSION = 1;

export const PLOT_STYLES = [
  "cottage",
  "tower",
  "garden",
  "workshop",
  "observatory",
  "lighthouse",
  "treehouse",
];

export const ALLOWED_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".svg",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico",
  ".txt", ".md", ".woff2", ".mp3", ".ogg",
]);

export const MAX_FILES = 24;
export const MAX_TOTAL_BYTES = 2_000_000;
export const MAX_SUBDIR_DEPTH = 2; // levels below the home directory

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ONE_DAY_MS = 86_400_000;

const TOP_LEVEL_FIELDS = new Set([
  "spec", "name", "slug", "established", "authors", "story", "greeting", "plot",
]);
const AUTHOR_FIELDS = new Set(["name", "kind", "link", "model"]);
const PLOT_FIELDS = new Set(["emoji", "style", "palette"]);
const PALETTE_FIELDS = new Set(["primary", "accent", "glow"]);

// File types the external-resource scan looks at (best effort, per SPEC).
const SCANNED_EXTENSIONS = new Set([".html", ".css", ".js", ".svg"]);

// http(s):// URLs in resource-loading positions are rejected; plain
// <a href="https://..."> navigation links are allowed.
const EXTERNAL_RESOURCE_PATTERNS = [
  { re: /\bsrc\s*=\s*["']?\s*https?:\/\//i, what: "src= attribute" },
  { re: /\bsrcset\s*=\s*["']?[^"'>]*https?:\/\//i, what: "srcset= attribute" },
  { re: /<link\b[^>]*\bhref\s*=\s*["']?\s*https?:\/\//i, what: "<link href=> tag" },
  { re: /url\(\s*["']?\s*https?:\/\//i, what: "url(...) reference" },
  { re: /@import\s+(?:url\(\s*)?["']?\s*https?:\/\//i, what: "@import rule" },
];

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

// ---------------------------------------------------------------------------
// Manifest validation (SPEC: "The manifest")
// ---------------------------------------------------------------------------

function checkStringField(errors, label, value, minLen, maxLen) {
  if (typeof value !== "string") {
    errors.push(`${label}: must be a string (got ${describeType(value)})`);
    return false;
  }
  if (value.length < minLen || value.length > maxLen) {
    const range = minLen === 0 ? `at most ${maxLen}` : `${minLen}-${maxLen}`;
    errors.push(`${label}: must be ${range} characters (got ${value.length})`);
    return false;
  }
  return true;
}

function checkEstablished(errors, value) {
  if (typeof value !== "string") {
    errors.push(`established: must be a "YYYY-MM-DD" string (got ${describeType(value)})`);
    return;
  }
  const m = DATE_RE.exec(value);
  if (!m) {
    errors.push(`established: "${value}" is not in YYYY-MM-DD format`);
    return;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const utc = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(utc);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    errors.push(`established: "${value}" is not a real calendar date`);
    return;
  }
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (utc > todayUtc + ONE_DAY_MS) {
    errors.push(`established: "${value}" is more than 1 day in the future (UTC)`);
  }
}

function checkAuthors(errors, authors) {
  if (!Array.isArray(authors)) {
    errors.push(`authors: must be an array (got ${describeType(authors)})`);
    return;
  }
  if (authors.length < 1 || authors.length > 8) {
    errors.push(`authors: must have 1-8 entries (got ${authors.length})`);
  }
  let humans = 0;
  let ais = 0;
  authors.forEach((author, i) => {
    const label = `authors[${i}]`;
    if (!isPlainObject(author)) {
      errors.push(`${label}: must be an object (got ${describeType(author)})`);
      return;
    }
    for (const key of Object.keys(author)) {
      if (!AUTHOR_FIELDS.has(key)) {
        errors.push(`${label}: unknown field "${key}"`);
      }
    }
    if (author.name === undefined) {
      errors.push(`${label}: missing required field "name"`);
    } else {
      checkStringField(errors, `${label}.name`, author.name, 1, 40);
    }
    if (author.kind === undefined) {
      errors.push(`${label}: missing required field "kind"`);
    } else if (author.kind !== "human" && author.kind !== "ai") {
      errors.push(`${label}.kind: must be "human" or "ai" (got ${JSON.stringify(author.kind)})`);
    } else if (author.kind === "human") {
      humans += 1;
    } else {
      ais += 1;
    }
    if (author.link !== undefined) {
      if (typeof author.link !== "string" || author.link.length > 200) {
        errors.push(`${label}.link: must be a string of at most 200 characters`);
      } else if (!/^https?:\/\//.test(author.link)) {
        errors.push(`${label}.link: must be an http:// or https:// URL`);
      } else {
        try {
          new URL(author.link);
        } catch {
          errors.push(`${label}.link: is not a valid URL`);
        }
      }
    }
    if (author.model !== undefined) {
      if (typeof author.model !== "string" || author.model.length > 60) {
        errors.push(`${label}.model: must be a string of at most 60 characters`);
      }
      if (author.kind === "human") {
        errors.push(`${label}.model: only allowed on "ai" authors`);
      }
    }
  });
  if (authors.length >= 1) {
    if (humans < 1) {
      errors.push(`authors: must include at least one "kind": "human" entry`);
    }
    if (ais < 1) {
      errors.push(`authors: must include at least one "kind": "ai" entry`);
    }
  }
}

function checkEmoji(errors, emoji) {
  if (typeof emoji !== "string" || emoji.length === 0) {
    errors.push(`plot.emoji: must be a non-empty string`);
    return;
  }
  if (emoji.length > 8) {
    errors.push(`plot.emoji: must be at most 8 UTF-16 code units (got ${emoji.length})`);
  }
  if (/[A-Za-z0-9]/.test(emoji)) {
    errors.push(`plot.emoji: must not contain ASCII letters or digits`);
  }
}

function checkPalette(errors, palette) {
  if (!isPlainObject(palette)) {
    errors.push(`plot.palette: must be an object (got ${describeType(palette)})`);
    return;
  }
  for (const key of Object.keys(palette)) {
    if (!PALETTE_FIELDS.has(key)) {
      errors.push(`plot.palette: unknown field "${key}"`);
    }
  }
  for (const key of ["primary", "accent"]) {
    if (palette[key] === undefined) {
      errors.push(`plot.palette: missing required field "${key}"`);
    } else if (typeof palette[key] !== "string" || !HEX_COLOR_RE.test(palette[key])) {
      errors.push(`plot.palette.${key}: must be a hex color like "#2b6cb0" (#rrggbb)`);
    }
  }
  if (palette.glow !== undefined) {
    if (typeof palette.glow !== "string" || !HEX_COLOR_RE.test(palette.glow)) {
      errors.push(`plot.palette.glow: must be a hex color like "#fef3c7" (#rrggbb)`);
    }
  }
}

function checkPlot(errors, plot) {
  if (!isPlainObject(plot)) {
    errors.push(`plot: must be an object (got ${describeType(plot)})`);
    return;
  }
  for (const key of Object.keys(plot)) {
    if (!PLOT_FIELDS.has(key)) {
      errors.push(`plot: unknown field "${key}"`);
    }
  }
  if (plot.emoji === undefined) {
    errors.push(`plot: missing required field "emoji"`);
  } else {
    checkEmoji(errors, plot.emoji);
  }
  if (plot.style === undefined) {
    errors.push(`plot: missing required field "style"`);
  } else if (!PLOT_STYLES.includes(plot.style)) {
    errors.push(
      `plot.style: must be one of ${PLOT_STYLES.join(", ")} (got ${JSON.stringify(plot.style)})`
    );
  }
  if (plot.palette === undefined) {
    errors.push(`plot: missing required field "palette"`);
  } else {
    checkPalette(errors, plot.palette);
  }
}

/**
 * Validate a parsed home.json manifest. Pushes error strings into `errors`.
 * `slug` is the home's directory name.
 */
export function validateManifest(errors, manifest, slug) {
  if (!isPlainObject(manifest)) {
    errors.push(`home.json: must be a JSON object (got ${describeType(manifest)})`);
    return;
  }

  for (const key of Object.keys(manifest)) {
    if (!TOP_LEVEL_FIELDS.has(key)) {
      errors.push(`unknown field "${key}"`);
    }
  }

  if (manifest.spec === undefined) {
    errors.push(`missing required field "spec"`);
  } else if (!Number.isInteger(manifest.spec) || manifest.spec !== SPEC_VERSION) {
    errors.push(`spec: must be the integer ${SPEC_VERSION} (got ${JSON.stringify(manifest.spec)})`);
  }

  if (manifest.name === undefined) {
    errors.push(`missing required field "name"`);
  } else {
    checkStringField(errors, "name", manifest.name, 1, 60);
  }

  if (manifest.slug === undefined) {
    errors.push(`missing required field "slug"`);
  } else if (typeof manifest.slug !== "string") {
    errors.push(`slug: must be a string (got ${describeType(manifest.slug)})`);
  } else {
    if (manifest.slug !== slug) {
      errors.push(`slug: "${manifest.slug}" must equal the directory name "${slug}"`);
    }
    if (!SLUG_RE.test(manifest.slug)) {
      errors.push(`slug: "${manifest.slug}" must match ^[a-z0-9]+(-[a-z0-9]+)*$`);
    }
    if (manifest.slug.length < 3 || manifest.slug.length > 40) {
      errors.push(`slug: must be 3-40 characters (got ${manifest.slug.length})`);
    }
  }

  if (manifest.established === undefined) {
    errors.push(`missing required field "established"`);
  } else {
    checkEstablished(errors, manifest.established);
  }

  if (manifest.authors === undefined) {
    errors.push(`missing required field "authors"`);
  } else {
    checkAuthors(errors, manifest.authors);
  }

  if (manifest.story === undefined) {
    errors.push(`missing required field "story"`);
  } else {
    checkStringField(errors, "story", manifest.story, 1, 600);
  }

  if (manifest.greeting !== undefined) {
    checkStringField(errors, "greeting", manifest.greeting, 0, 120);
  }

  if (manifest.plot === undefined) {
    errors.push(`missing required field "plot"`);
  } else {
    checkPlot(errors, manifest.plot);
  }
}

// ---------------------------------------------------------------------------
// Home directory validation (SPEC: "The home directory")
// ---------------------------------------------------------------------------

function walkHomeDir(homeDir, relDir, depth, files, errors) {
  const absDir = path.join(homeDir, relDir);
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (err) {
    errors.push(`cannot read directory "${relDir || "."}": ${err.message}`);
    return;
  }
  for (const entry of entries) {
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (depth + 1 > MAX_SUBDIR_DEPTH) {
        errors.push(
          `subdirectory "${rel}/" is more than ${MAX_SUBDIR_DEPTH} levels below the home directory`
        );
      }
      walkHomeDir(homeDir, rel, depth + 1, files, errors);
    } else if (entry.isFile()) {
      let size = 0;
      try {
        size = fs.statSync(path.join(homeDir, rel)).size;
      } catch (err) {
        errors.push(`cannot stat file "${rel}": ${err.message}`);
      }
      files.push({ rel, size });
    } else {
      errors.push(`"${rel}" is neither a regular file nor a directory (symlinks etc. are not allowed)`);
    }
  }
}

function scanForExternalResources(errors, rel, content) {
  for (const { re, what } of EXTERNAL_RESOURCE_PATTERNS) {
    if (re.test(content)) {
      errors.push(
        `${rel}: external http(s):// resource in a ${what} — homes must be fully self-contained ` +
          `(only plain <a href="..."> navigation links may point off-site)`
      );
    }
  }
}

function validateHomeFiles(homeDir, errors, warnings) {
  const files = [];
  walkHomeDir(homeDir, "", 0, files, errors);

  if (files.length > MAX_FILES) {
    errors.push(`too many files: ${files.length} (limit ${MAX_FILES})`);
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    errors.push(`total size ${totalBytes} bytes exceeds the ${MAX_TOTAL_BYTES}-byte limit`);
  }

  for (const file of files) {
    const ext = path.extname(file.rel).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      errors.push(
        `file "${file.rel}": extension "${ext || "(none)"}" is not allowed ` +
          `(allowed: ${[...ALLOWED_EXTENSIONS].join(" ")})`
      );
    }
  }

  const hasIndex = files.some((f) => f.rel === "index.html");
  if (!hasIndex) {
    errors.push(`missing required file "index.html"`);
  } else {
    let html = "";
    try {
      html = fs.readFileSync(path.join(homeDir, "index.html"), "utf8");
    } catch (err) {
      errors.push(`cannot read index.html: ${err.message}`);
    }
    if (html) {
      const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
      if (!titleMatch || titleMatch[1].trim().length === 0) {
        errors.push(`index.html: must contain a non-empty <title>`);
      }
      const hasBackLink =
        /href\s*=\s*["']\s*(?:\.\.\/\.\.\/?|\/)["'\s]/i.test(html) || html.includes("../../");
      if (!hasBackLink) {
        warnings.push(
          `index.html: no link back to the map found — consider adding <a href="../../">&larr; back to the map</a>`
        );
      }
    }
  }

  // Best-effort external-resource scan.
  for (const file of files) {
    const ext = path.extname(file.rel).toLowerCase();
    if (!SCANNED_EXTENSIONS.has(ext)) continue;
    let content;
    try {
      content = fs.readFileSync(path.join(homeDir, file.rel), "utf8");
    } catch {
      continue; // unreadable files already reported via stat/walk if relevant
    }
    scanForExternalResources(errors, file.rel, content);
  }
}

// ---------------------------------------------------------------------------
// Whole-home validation
// ---------------------------------------------------------------------------

/**
 * Validate one home directory.
 * Returns { slug, errors: string[], warnings: string[], manifest: object|null }.
 */
export function validateHome(homesDir, slug) {
  const errors = [];
  const warnings = [];
  let manifest = null;

  const homeDir = path.join(homesDir, slug);
  let stat = null;
  try {
    stat = fs.statSync(homeDir);
  } catch {
    // fallthrough
  }
  if (!stat || !stat.isDirectory()) {
    errors.push(`homes/${slug}/ does not exist or is not a directory`);
    return { slug, errors, warnings, manifest };
  }

  const manifestPath = path.join(homeDir, "home.json");
  if (!fs.existsSync(manifestPath)) {
    errors.push(`missing required file "home.json"`);
  } else {
    let raw = "";
    try {
      raw = fs.readFileSync(manifestPath, "utf8");
    } catch (err) {
      errors.push(`cannot read home.json: ${err.message}`);
    }
    if (raw) {
      try {
        manifest = JSON.parse(raw);
      } catch (err) {
        errors.push(`home.json: invalid JSON (${err.message})`);
      }
    }
    if (manifest !== null) {
      validateManifest(errors, manifest, slug);
    }
  }

  validateHomeFiles(homeDir, errors, warnings);

  return { slug, errors, warnings, manifest };
}

/**
 * List home slugs (directory names) under homesDir, skipping `_template`
 * and hidden entries. Returns [] when homesDir does not exist yet.
 */
export function collectHomeSlugs(homesDir) {
  let entries;
  try {
    entries = fs.readdirSync(homesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && e.name !== "_template" && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

/**
 * Validate many homes. `slugs` defaults to every home under homesDir.
 */
export function validateHomes(homesDir, slugs = null) {
  const list = slugs ?? collectHomeSlugs(homesDir);
  return list.map((slug) => validateHome(homesDir, slug));
}

// ---------------------------------------------------------------------------
// Placement (SPEC: "Placement")
// ---------------------------------------------------------------------------

/**
 * Square-spiral cell for a 0-based index on an integer grid.
 * Index 0 is (0, 0); then East x1, North x1, West x2, South x2, East x3,
 * North x3, West x4, South x4, ... (`y` grows northward).
 */
export function spiralPosition(index) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`spiralPosition: index must be a non-negative integer (got ${index})`);
  }
  let x = 0;
  let y = 0;
  if (index === 0) return { x, y };
  const directions = [
    [1, 0], // East
    [0, 1], // North
    [-1, 0], // West
    [0, -1], // South
  ];
  let taken = 0;
  for (let leg = 0; ; leg++) {
    const [dx, dy] = directions[leg % 4];
    const legLength = Math.floor(leg / 2) + 1;
    for (let step = 0; step < legLength; step++) {
      x += dx;
      y += dy;
      taken += 1;
      if (taken === index) return { x, y };
    }
  }
}

/**
 * Assert the spiral reproduces the worked examples in docs/SPEC.md
 * (indices 0-9). Throws on any mismatch.
 */
export function spiralSelfCheck() {
  const expected = [
    [0, 0], [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1], [2, -1],
  ];
  expected.forEach(([ex, ey], i) => {
    const { x, y } = spiralPosition(i);
    if (x !== ex || y !== ey) {
      throw new Error(
        `spiral self-check failed at index ${i}: expected (${ex}, ${ey}), got (${x}, ${y})`
      );
    }
  });
}

/**
 * Sort comparator per SPEC: (established ascending, slug ascending).
 * Operates on validation results with parsed manifests.
 */
export function compareHomes(a, b) {
  const ea = a.manifest.established;
  const eb = b.manifest.established;
  if (ea !== eb) return ea < eb ? -1 : 1;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Shared reporting helpers
// ---------------------------------------------------------------------------

/**
 * Print per-home result lines (used by both scripts).
 * Returns { errorCount, warningCount, failedHomes }.
 */
export function printResults(results, log = console.log) {
  let errorCount = 0;
  let warningCount = 0;
  let failedHomes = 0;
  for (const r of results) {
    if (r.errors.length > 0) {
      failedHomes += 1;
      log(`✗ ${r.slug}`);
    } else if (r.warnings.length > 0) {
      log(`⚠ ${r.slug}`);
    } else {
      log(`✓ ${r.slug}`);
    }
    for (const e of r.errors) {
      errorCount += 1;
      log(`  ✗ ${e}`);
    }
    for (const w of r.warnings) {
      warningCount += 1;
      log(`  ⚠ ${w}`);
    }
  }
  return { errorCount, warningCount, failedHomes };
}
