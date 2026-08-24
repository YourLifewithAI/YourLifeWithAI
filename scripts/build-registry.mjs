#!/usr/bin/env node
// Build registry.json at the repo root from homes/*/home.json.
//
//   node scripts/build-registry.mjs
//
// Shares validation logic with validate.mjs (scripts/lib/manifest.mjs) and
// refuses to emit a registry if any home fails validation. Homes are sorted
// by (established ascending, slug ascending) and placed on a square spiral
// per docs/SPEC.md "Placement".
//
// Node >= 18, ESM, zero npm dependencies.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SPEC_VERSION,
  compareHomes,
  printResults,
  spiralPosition,
  spiralSelfCheck,
  validateHomes,
} from "./lib/manifest.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const homesDir = path.join(repoRoot, "homes");
const outPath = path.join(repoRoot, "registry.json");

// Guard the placement algorithm against regressions: reproduce the worked
// examples for indices 0-9 from docs/SPEC.md before every build.
spiralSelfCheck();

const results = validateHomes(homesDir);
const { errorCount, warningCount, failedHomes } = printResults(results);

if (errorCount > 0) {
  console.error(
    `Refusing to build registry: ${failedHomes} home(s) failed validation ` +
      `with ${errorCount} error(s). Run "node scripts/validate.mjs" for details.`
  );
  process.exit(1);
}
if (warningCount > 0) {
  console.log(`(${warningCount} warning(s) — not fatal.)`);
}

const sorted = [...results].sort(compareHomes);

const homes = sorted.map((result, index) => {
  const manifest = result.manifest;
  const plot = structuredClone(manifest.plot);
  if (plot.palette.glow === undefined) {
    plot.palette.glow = plot.palette.accent;
  }
  const entry = {
    slug: manifest.slug,
    name: manifest.name,
    established: manifest.established,
    authors: structuredClone(manifest.authors),
    story: manifest.story,
  };
  if (manifest.greeting !== undefined) {
    entry.greeting = manifest.greeting;
  }
  entry.plot = plot;
  entry.position = spiralPosition(index);
  entry.path = `homes/${manifest.slug}/`;
  return entry;
});

const registry = {
  spec: SPEC_VERSION,
  generated: new Date().toISOString(),
  count: homes.length,
  homes,
};

fs.writeFileSync(outPath, JSON.stringify(registry, null, 2) + "\n");
console.log(`Wrote ${path.relative(repoRoot, outPath)} with ${homes.length} home(s).`);
