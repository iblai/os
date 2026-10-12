// The one check the report builder's logic needs: node --test e2e-tauri/ci/macos/build-report.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const builder = new URL('./build-report.mjs', import.meta.url);
const SPEC = '--spec e2e-tauri/journeys/04-ollama-setups.spec.ts';
const row = (scenario) => ({
  scenario,
  runner: 'macos-latest',
  arch: 'arm64',
  specs: SPEC,
  name: `${scenario}@macos-latest`,
  slug: `${scenario}--macos-latest`,
});
const result = (tests, hooks = []) =>
  JSON.stringify({
    specs: ['file:///x/e2e-tauri/journeys/04-ollama-setups.spec.ts'],
    suites: [{ name: 'Journey 4', tests, hooks }],
  });
const t = (name, state, message) => ({
  name,
  state,
  ...(message ? { error: { message } } : {}),
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'macos-report-'));
  const write = (slug, body, png, setupLog) => {
    const d = join(dir, 'macos-e2e-arm64', slug);
    mkdirSync(d, { recursive: true });
    if (body) writeFileSync(join(d, 'wdio-0-0-json-reporter.json'), body);
    if (png) writeFileSync(join(d, 'setup-06_x.png'), '');
    if (setupLog) writeFileSync(join(d, 'setup.log'), setupLog);
  };
  write(
    'passing--macos-latest',
    result([t('setup-01: a', 'passed'), t('setup-02: b', 'pending')]),
  );
  write(
    'known--macos-latest',
    result([
      t('setup-01: a', 'passed'),
      t('setup-06: stop', 'failed', '\x1b[31mexpected false\x1b[0m'),
    ]),
    true,
  );
  write(
    'fresh--macos-latest',
    result(
      [t('setup-03: c', 'failed', 'boom')],
      [
        {
          title: '"before all" hook',
          state: 'failed',
          error: { message: 'no app' },
        },
      ],
    ),
  );
  write(
    'dead--macos-latest',
    JSON.stringify({
      specs: ['file:///x/e2e-tauri/journeys/04-ollama-setups.spec.ts'],
      suites: [],
    }),
  );
  write(
    'broken--macos-latest',
    null,
    false,
    '$ bash fresh.sh\nnot fresh: /usr/local/bin/ollama exists',
  );
  // 'missing' has no artifact at all
  const known = join(dir, 'known.json');
  writeFileSync(
    known,
    JSON.stringify({
      known: { 'setup-06': { reason: 'launchd restarts it' } },
      '*': {},
    }),
  );
  return { dir, known };
}

const run = (dir, known, scenarios, env = {}) =>
  execFileSync('node', [builder.pathname, dir, known], {
    env: { ...process.env, ...env, MATRIX: JSON.stringify(scenarios.map(row)) },
    encoding: 'utf8',
  });

test('counts, known flags, hooks, dead and missing rows', () => {
  const { dir, known } = fixture();
  const md = run(dir, known, [
    'passing',
    'known',
    'fresh',
    'dead',
    'broken',
    'missing',
  ]);
  const s = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'));
  assert.equal(s.verdict, 'FAIL');
  assert.equal(s.gate, 'FAIL');
  assert.equal(s.passed, 2);
  assert.equal(s.skipped, 1);
  const byId = Object.fromEntries(
    s.rows.flatMap((r) => r.failures.map((f) => [`${r.scenario}/${f.id}`, f])),
  );
  assert.equal(byId['known/setup-06'].known, true);
  assert.equal(byId['known/setup-06'].error, 'expected false'); // ANSI stripped
  assert.equal(byId['fresh/setup-03'].known, false);
  assert.equal(byId['fresh/"before all" hook'].known, false);
  assert.equal(byId['dead/04-ollama-setups.spec.ts'].known, false);
  assert.equal(byId['missing/04-ollama-setups.spec.ts'].known, false);
  // A failed setup is one failure carrying its log, not a "no results" per spec.
  assert.match(byId['broken/setup'].error, /not fresh/);
  assert.equal(byId['broken/04-ollama-setups.spec.ts'], undefined);
  assert.equal(s.new_failures, 5);
  assert.equal(
    s.rows.find((r) => r.scenario === 'known').screenshots.length,
    1,
  );
  assert.match(md, /\| `known@macos-latest` \| 1 \| 1 \| 0 \| 0 \|/);
  assert.match(md, /\*\*new\*\* `fresh@macos-latest` setup-03: c/);
  assert.match(
    readFileSync(join(dir, 'index.html'), 'utf8'),
    /<h1>macOS E2E — FAIL/,
  );
});

test('only known failures: gate passes, verdict does not', () => {
  const { dir, known } = fixture();
  run(dir, known, ['passing', 'known']);
  const s = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'));
  assert.equal(s.gate, 'PASS');
  assert.equal(s.verdict, 'FAIL');
  assert.equal(s.new_failures, 0);
});

test('a grep run may legitimately have no suites', () => {
  const { dir, known } = fixture();
  run(dir, known, ['dead'], { GREP: 'odm-02' });
  const s = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'));
  assert.equal(s.gate, 'PASS');
});
