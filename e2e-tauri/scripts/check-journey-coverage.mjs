#!/usr/bin/env node

/**
 * Tauri Desktop E2E Journey Coverage Checker
 *
 * The desktop counterpart to e2e/scripts/check-journey-coverage.mjs. The web
 * checker maps changed app routes/components to journeys; the desktop surface has
 * no routes, so this one validates the ledger's internal consistency instead:
 *
 *   1. Every spec file listed in coverage.json exists in e2e-tauri/journeys/
 *   2. The `summary` counts (journeys, checkpoints per status, percent) match the
 *      journeys/checkpoints actually in coverage.json
 *   3. Checkpoint & journey counts have not regressed vs the base branch (--no-regress)
 *   4. Listed sourceFiles exist on disk (typo guard; --strict-sources to fail)
 *
 * Exit codes: 0 ok · 1 coverage gaps · 2 script error
 *
 * Usage:
 *   node e2e-tauri/scripts/check-journey-coverage.mjs
 *   node e2e-tauri/scripts/check-journey-coverage.mjs --no-regress [--base origin/main]
 *   node e2e-tauri/scripts/check-journey-coverage.mjs --strict-sources
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = execSync('git rev-parse --show-toplevel', {
  encoding: 'utf8',
}).trim();
const E2E_DIR = join(REPO_ROOT, 'e2e-tauri');
const COVERAGE_JSON = join(E2E_DIR, 'coverage.json');
const JOURNEYS_DIR = join(E2E_DIR, 'journeys');

const R = '\x1b[31m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const B = '\x1b[34m';
const NC = '\x1b[0m';
const err = (m) => console.error(`${R}  ${m}${NC}`);
const ok = (m) => console.log(`${G}  ${m}${NC}`);
const warn = (m) => console.log(`${Y}  ${m}${NC}`);
const info = (m) => console.log(`${B}  ${m}${NC}`);

function loadCoverage() {
  if (!existsSync(COVERAGE_JSON)) {
    err(`coverage.json not found at ${COVERAGE_JSON}`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(COVERAGE_JSON, 'utf8'));
}

function loadBaseCoverage(baseBranch) {
  try {
    return JSON.parse(
      execSync(`git show ${baseBranch}:e2e-tauri/coverage.json 2>/dev/null`, {
        encoding: 'utf8',
      }),
    );
  } catch {
    return null;
  }
}

/** Recompute the summary from the journeys/checkpoints. */
function tally(coverage) {
  const t = {
    totalCheckpoints: 0,
    coveredCheckpoints: 0,
    pendingCheckpoints: 0,
    deprecatedCheckpoints: 0,
    notReproducibleCheckpoints: 0,
    totalJourneys: coverage.journeys.length,
    activeJourneys: coverage.journeys.filter((j) => j.status !== 'deprecated')
      .length,
  };
  const bucket = {
    covered: 'coveredCheckpoints',
    pending: 'pendingCheckpoints',
    deprecated: 'deprecatedCheckpoints',
    'not-reproducible': 'notReproducibleCheckpoints',
  };
  for (const j of coverage.journeys) {
    for (const cp of j.checkpoints ?? []) {
      t.totalCheckpoints++;
      const key = bucket[cp.status];
      if (!key) throw new Error(`unknown checkpoint status "${cp.status}"`);
      t[key]++;
    }
  }
  const denom =
    t.totalCheckpoints -
    t.pendingCheckpoints -
    t.deprecatedCheckpoints -
    t.notReproducibleCheckpoints;
  t.percent = denom > 0 ? Math.round((t.coveredCheckpoints / denom) * 100) : 100;
  return t;
}

function main() {
  const args = process.argv.slice(2);
  const noRegress = args.includes('--no-regress');
  const strictSources = args.includes('--strict-sources');
  const baseIdx = args.indexOf('--base');
  const baseBranch = baseIdx !== -1 ? args[baseIdx + 1] : 'origin/main';

  info('Tauri E2E Journey Coverage Check');
  console.log('');

  const coverage = loadCoverage();
  let exitCode = 0;

  // 1. Spec files exist
  info('Validating spec files exist…');
  const missing = coverage.journeys.filter(
    (j) => !existsSync(join(JOURNEYS_DIR, j.spec)),
  );
  if (missing.length) {
    for (const j of missing)
      err(`Journey "${j.name}" references spec "${j.spec}" not found in journeys/`);
    process.exit(1);
  }
  ok(`All ${coverage.journeys.length} spec files exist in journeys/`);

  // 2. Summary matches the ledger
  info('Validating summary counts…');
  const computed = tally(coverage);
  for (const [k, v] of Object.entries(computed)) {
    if (coverage.summary[k] !== v) {
      err(`summary.${k} = ${coverage.summary[k]} but computed ${v}`);
      exitCode = 1;
    }
  }
  if (exitCode === 0)
    ok(
      `Summary OK: ${computed.coveredCheckpoints}/${computed.totalCheckpoints} covered, ` +
        `${computed.pendingCheckpoints} pending (${computed.percent}% of reproducible)`,
    );

  // 3. sourceFiles exist on disk (typo guard)
  const badSources = [];
  for (const j of coverage.journeys)
    for (const src of j.sourceFiles ?? [])
      if (!existsSync(join(REPO_ROOT, src))) badSources.push({ j: j.name, src });
  if (badSources.length) {
    for (const { j, src } of badSources)
      warn(`Journey "${j}" lists missing sourceFile: ${src}`);
    if (strictSources) exitCode = 1;
  }

  // 4. Regression vs base
  if (noRegress) {
    info(`Checking regression vs ${baseBranch}…`);
    const base = loadBaseCoverage(baseBranch);
    if (!base) {
      warn(`No base coverage at ${baseBranch} — skipping regression check`);
    } else {
      const b = tally(base);
      if (computed.totalCheckpoints < b.totalCheckpoints) {
        err(
          `REGRESSION: checkpoints ${b.totalCheckpoints} → ${computed.totalCheckpoints}`,
        );
        exitCode = 1;
      }
      if (computed.coveredCheckpoints < b.coveredCheckpoints) {
        err(
          `REGRESSION: covered checkpoints ${b.coveredCheckpoints} → ${computed.coveredCheckpoints}`,
        );
        exitCode = 1;
      }
      if (computed.totalJourneys < b.totalJourneys) {
        err(`REGRESSION: journeys ${b.totalJourneys} → ${computed.totalJourneys}`);
        exitCode = 1;
      }
      if (exitCode === 0) ok('No coverage regression');
    }
  }

  console.log('');
  if (exitCode === 0) ok('Tauri journey coverage OK');
  else err('Tauri journey coverage check failed');
  process.exit(exitCode);
}

main();
