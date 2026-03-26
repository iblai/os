#!/usr/bin/env node

/**
 * MentorAI E2E Journey Coverage Checker
 *
 * Validates that:
 *   1. Every spec file listed in coverage.json exists in e2e/journeys/
 *   2. New app routes (page.tsx) are mapped to at least one journey in coverage.json
 *   3. Changed source files are traced back to a journey
 *
 * Exit codes:
 *   0 — all good
 *   1 — coverage gaps detected
 *   2 — script error
 *
 * Usage:
 *   node e2e/scripts/check-journey-coverage.mjs           # diff vs origin/main
 *   node e2e/scripts/check-journey-coverage.mjs --all     # validate all routes (CI mode)
 *   node e2e/scripts/check-journey-coverage.mjs --base HEAD~1
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────

const REPO_ROOT   = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const MENTORAI_DIR = resolve(REPO_ROOT, 'mentorai');
const APP_DIR      = join(MENTORAI_DIR, 'app');
const COVERAGE_JSON = join(MENTORAI_DIR, 'e2e', 'coverage.json');
const JOURNEYS_DIR  = join(MENTORAI_DIR, 'e2e', 'journeys');

/** Files intentionally excluded from E2E coverage requirements. */
const EXCLUDED_PATTERNS = [
  /\/layout\.tsx$/,
  /\/loading\.tsx$/,
  /\/not-found\.tsx$/,
  /\/global-error\.tsx$/,
  /\/api\//,
  /\/version\/page\.tsx$/,
  /\/components\//,
  /\/contexts\//,
  /\/lib\//,
  /\/actions\//,
  /\/features\//,
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /\.d\.ts$/,
  /\/e2e\//,
  /\/hooks\//,
  /\/store\//,
  /\/providers\//,
  /\/types\//,
  /\/constants\//,
];

// ─── Colors ──────────────────────────────────────────────────────────────────

const R  = '\x1b[31m';
const G  = '\x1b[32m';
const Y  = '\x1b[33m';
const B  = '\x1b[34m';
const NC = '\x1b[0m';

const err  = (m) => console.error(`${R}  ${m}${NC}`);
const ok   = (m) => console.log(`${G}  ${m}${NC}`);
const warn = (m) => console.log(`${Y}  ${m}${NC}`);
const info = (m) => console.log(`${B}  ${m}${NC}`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadCoverage() {
  if (!existsSync(COVERAGE_JSON)) {
    err(`coverage.json not found at ${COVERAGE_JSON}`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(COVERAGE_JSON, 'utf8'));
}

function buildSourceMap(coverage) {
  const map = new Map();
  for (const journey of coverage.journeys) {
    for (const src of (journey.sourceFiles ?? [])) {
      if (!map.has(src)) map.set(src, []);
      map.get(src).push({ id: journey.id, name: journey.name, spec: journey.spec });
    }
  }
  return map;
}

function validateSpecFiles(coverage) {
  const missing = [];
  for (const j of coverage.journeys) {
    const specPath = join(JOURNEYS_DIR, j.spec);
    if (!existsSync(specPath)) {
      missing.push({ journey: j.name, spec: j.spec });
    }
  }
  return missing;
}

function getChangedFiles(baseBranch) {
  try {
    const diff = execSync(
      `git diff --name-only ${baseBranch}...HEAD -- mentorai/app/ mentorai/components/`,
      { encoding: 'utf8' },
    ).trim();
    return diff ? diff.split('\n') : [];
  } catch {
    try {
      const diff = execSync(
        `git diff --name-only HEAD~1 -- mentorai/app/ mentorai/components/`,
        { encoding: 'utf8' },
      ).trim();
      return diff ? diff.split('\n') : [];
    } catch {
      return [];
    }
  }
}

function getAllAppPages() {
  try {
    const result = execSync(
      `find ${APP_DIR} -name "page.tsx" -type f`,
      { encoding: 'utf8' },
    ).trim();
    return result ? result.split('\n').map((f) => relative(MENTORAI_DIR, f)) : [];
  } catch {
    return [];
  }
}

function isExcluded(file) {
  return EXCLUDED_PATTERNS.some((p) => p.test(file));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args       = process.argv.slice(2);
  const checkAll   = args.includes('--all');
  const baseIdx    = args.indexOf('--base');
  const baseBranch = baseIdx !== -1 ? args[baseIdx + 1] : 'origin/main';

  info('MentorAI E2E Journey Coverage Check');
  console.log('');

  const coverage  = loadCoverage();
  const sourceMap = buildSourceMap(coverage);

  // 1. Validate spec files exist
  info('Validating spec files exist…');
  const missingSpecs = validateSpecFiles(coverage);
  if (missingSpecs.length > 0) {
    for (const { journey, spec } of missingSpecs) {
      err(`Journey "${journey}" references spec "${spec}" which does not exist in e2e/journeys/`);
    }
    process.exit(1);
  }
  ok(`All ${coverage.journeys.length} spec files exist in e2e/journeys/`);
  console.log('');

  // 2. Determine which files to check
  let filesToCheck;
  if (checkAll) {
    info('Checking ALL app pages (--all mode)…');
    filesToCheck = getAllAppPages();
  } else {
    info(`Detecting changed files against ${baseBranch}…`);
    const changed = getChangedFiles(baseBranch);
    if (changed.length === 0) {
      ok('No mentorai app/component changes detected. Nothing to check.');
      process.exit(0);
    }
    filesToCheck = changed
      .filter((f) => f.startsWith('mentorai/'))
      .map((f) => f.replace(/^mentorai\//, ''));
    console.log(`  Changed files: ${filesToCheck.length}`);
  }

  // 3. Filter to user-facing files needing coverage
  const relevant = filesToCheck.filter((f) => {
    const isPage      = /\/page\.tsx$/.test(f);
    const isComponent = /^components\//.test(f);
    return (isPage || isComponent) && !isExcluded(f);
  });

  if (relevant.length === 0) {
    ok('No user-facing files changed. Nothing to check.');
    process.exit(0);
  }

  console.log('');
  info('Checking E2E journey coverage for:');
  for (const f of relevant) console.log(`    ${f}`);
  console.log('');

  // 4. Check each file against the source map
  const covered   = [];
  const uncovered = [];
  const newRoutes = [];

  for (const file of relevant) {
    const journeys = sourceMap.get(file);
    if (journeys?.length) {
      covered.push({ file, journeys });
    } else {
      uncovered.push(file);
      if (/\/page\.tsx$/.test(file)) newRoutes.push(file);
    }
  }

  // 5. Report
  if (covered.length > 0) {
    info('Covered files:');
    for (const { file, journeys } of covered) {
      const names = journeys.map((j) => `${j.name} (${j.spec})`).join(', ');
      ok(`${file}  →  ${names}`);
    }
    console.log('');
  }

  let exitCode = 0;

  if (uncovered.length > 0) {
    warn('Files NOT mapped to any E2E journey:');
    for (const f of uncovered) warn(`  ${f}`);
    console.log('');
  }

  if (newRoutes.length > 0) {
    err('NEW ROUTES without E2E journey coverage:');
    for (const r of newRoutes) err(`  ${r}`);
    console.log('');
    err('Action required:');
    err('  1. Add the route to a journey in e2e/coverage.json (sourceFiles array)');
    err('  2. Add test(s) for it in the relevant e2e/journeys/NN-*.spec.ts file');
    err('  3. Add a checkpoint entry in e2e/COVERAGE.md');
    err('');
    err('If intentionally excluded, add a pattern to EXCLUDED_PATTERNS in this script.');
    exitCode = 1;
  }

  // 6. Summary
  console.log('');
  const total       = relevant.length;
  const coveredCount = covered.length;
  const pct         = total > 0 ? Math.round((coveredCount / total) * 100) : 100;

  if (exitCode === 0) {
    ok(`Journey coverage: ${coveredCount}/${total} files mapped (${pct}%)`);
    ok('All user-facing changes have E2E journey coverage!');
  } else {
    err(`Journey coverage: ${coveredCount}/${total} files mapped (${pct}%)`);
    err('Coverage check failed: new routes need E2E journey coverage.');
  }

  process.exit(exitCode);
}

main();
