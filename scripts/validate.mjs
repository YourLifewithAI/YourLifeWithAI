#!/usr/bin/env node
// Validate homes against docs/SPEC.md.
//
//   node scripts/validate.mjs            # validate every home under homes/
//   node scripts/validate.mjs my-slug    # validate only the given slug(s)
//
// Exit code 1 if any home has an error; warnings alone do not fail.
// Node >= 18, ESM, zero npm dependencies.

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectHomeSlugs,
  printResults,
  validateHomes,
} from "./lib/manifest.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const homesDir = path.join(repoRoot, "homes");

// Accept bare slugs, "homes/<slug>" and trailing-slash forms.
function normalizeArg(arg) {
  let slug = arg.replace(/\/+$/, "");
  slug = slug.replace(/^homes\//, "");
  return path.basename(slug);
}

const args = process.argv.slice(2).map(normalizeArg);
const requested = args.filter((slug) => {
  if (slug === "_template") {
    console.log(`- ${slug} (skipped: template)`);
    return false;
  }
  return true;
});

const slugs = args.length > 0 ? requested : collectHomeSlugs(homesDir);

if (slugs.length === 0) {
  console.log("No homes to validate (homes/ is empty or only contains _template).");
  console.log("Summary: 0 homes checked, 0 errors, 0 warnings.");
  process.exit(0);
}

const results = validateHomes(homesDir, slugs);
const { errorCount, warningCount, failedHomes } = printResults(results);

const passed = results.length - failedHomes;
console.log(
  `Summary: ${results.length} home(s) checked — ${passed} passed, ${failedHomes} failed ` +
    `(${errorCount} error(s), ${warningCount} warning(s)).`
);

process.exit(errorCount > 0 ? 1 : 0);
