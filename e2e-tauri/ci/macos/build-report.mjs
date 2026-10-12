// Turns the macOS matrix's row artifacts (e2e-tauri/logs per row: wdio JSON
// results + failure screenshots) into the run's report: <dir>/summary.json,
// <dir>/index.html, and the PR comment's rows fragment on stdout.
//
//   MATRIX=<rows json> [GREP RUN_URL REPORT_URL PR SHA] \
//     node build-report.mjs <dir> [known-failures.json]
//
// <dir> holds one macos-e2e-<slug>/ per downloaded artifact. A row with no
// results counts as failed: the setup script, the app, or the row timed out.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';

const [dir, knownFile = new URL('./known-failures.json', import.meta.url)] =
  process.argv.slice(2);
if (!dir) {
  console.error(
    'usage: MATRIX=<rows json> node build-report.mjs <dir> [known-failures.json]',
  );
  process.exit(2);
}
const {
  MATRIX = '[]',
  GREP = '',
  RUN_URL = '',
  REPORT_URL = '',
  PR = '',
  SHA = '',
} = process.env;
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const known = read(knownFile);
const { version } = read(
  new URL('../../../src-tauri/tauri.conf.json', import.meta.url),
);
const stripAnsi = (s) => String(s ?? '').replace(/\x1b\[[\d;]*m/g, '');
const idOf = (title) => title.match(/^[a-z]+-\d+/)?.[0] ?? title;

const rows = JSON.parse(MATRIX).map((row) => {
  const rdir = join(dir, `macos-e2e-${row.slug}`);
  const files = existsSync(rdir) ? readdirSync(rdir).sort() : [];
  const runs = files
    .filter((f) => f.endsWith('-json-reporter.json'))
    .map((f) => read(join(rdir, f)));
  const suites = runs.flatMap((r) => r.suites ?? []);
  const tests = suites.flatMap((s) => s.tests ?? []);
  const specs = row.specs
    .split(' ')
    .filter((a) => a.endsWith('.ts'))
    .map((a) => basename(a));
  const hasResults = (spec) =>
    runs.some(
      (r) =>
        (r.suites?.length || GREP) &&
        (r.specs ?? []).some((p) => p.endsWith(`/${spec}`)),
    );
  const failures = [
    ...tests
      .filter((t) => !['passed', 'skipped', 'pending'].includes(t.state))
      .map((t) => ({
        id: idOf(t.name),
        title: t.name,
        error: t.error?.message,
      })),
    // A failed before/after hook fails no test: its suite's tests just never run.
    ...suites
      .flatMap((s) => s.hooks ?? [])
      .filter((h) => h.state === 'failed')
      .map((h) => ({
        id: h.title,
        title: `${h.associatedSuite ?? ''} ${h.title}`.trim(),
        error: h.error?.message,
      })),
    // No JSON, or `suites: []` (what WDIO also writes when the session never started) = never ran.
    // ponytail: a grep matching nothing writes the same JSON, so grep runs cannot see a dead session.
    ...specs
      .filter((spec) => !hasResults(spec))
      .map((spec) => ({
        id: spec,
        title: `${spec}: no results (setup failed, the app never started, or the row timed out)`,
      })),
  ].map((f) => {
    const k = known[row.scenario]?.[f.id] ?? known['*']?.[f.id];
    return {
      ...f,
      error: stripAnsi(f.error),
      known: Boolean(k),
      reason: k?.reason ?? '',
    };
  });
  const count = (...states) =>
    tests.filter((t) => states.includes(t.state)).length;
  return {
    name: row.name,
    slug: row.slug,
    scenario: row.scenario,
    runner: row.runner,
    passed: count('passed'),
    failed: failures.length,
    skipped: count('skipped', 'pending'),
    failures,
    screenshots: files
      .filter((f) => f.endsWith('.png'))
      .map((f) => `macos-e2e-${row.slug}/${f}`),
  };
});

const all = rows.flatMap((r) => r.failures.map((f) => ({ ...f, row: r.name })));
const fresh = all.filter((f) => !f.known);
const total = (k) => rows.reduce((n, r) => n + r[k], 0);
const summary = {
  verdict: all.length ? 'FAIL' : 'PASS',
  gate: fresh.length ? 'FAIL' : 'PASS',
  report_url: REPORT_URL,
  run_url: RUN_URL,
  pr: PR,
  sha: SHA,
  app_version: version,
  app_url: process.env.TAURI_APP_URL || 'https://os.ibl.ai',
  passed: total('passed'),
  failed: all.length,
  skipped: total('skipped'),
  new_failures: fresh.length,
  rows,
};

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
const cell = (s) =>
  String(s ?? '').replace(/[|<>]/g, (c) => `&#${c.charCodeAt(0)};`);

function markdown(s, failures) {
  const lines = ['| row | ✓ | ✖ | skipped | new |', '|---|---|---|---|---|'];
  for (const r of s.rows) {
    lines.push(
      `| \`${r.name}\` | ${r.passed} | ${r.failed} | ${r.skipped} | ${r.failures.filter((f) => !f.known).length} |`,
    );
  }
  const shown = failures.slice(0, 30);
  if (shown.length) lines.push('');
  for (const f of shown) {
    lines.push(
      `- ${f.known ? 'known' : '**new**'} \`${f.row}\` ${cell(f.title)}${f.reason ? ` — ${cell(f.reason)}` : ''}`,
    );
  }
  if (failures.length > shown.length)
    lines.push(`- … ${failures.length - shown.length} more in the report`);
  return lines.join('\n');
}

function html(s) {
  const row = (r) =>
    `<tr><td><a href="#${esc(r.slug)}">${esc(r.name)}</a></td><td>${esc(r.runner)}</td><td>${r.passed}</td><td>${r.failed}</td><td>${r.skipped}</td><td>${r.failures.filter((f) => !f.known).length}</td></tr>`;
  const section = (r) =>
    !r.failures.length && !r.screenshots.length
      ? ''
      : `<section id="${esc(r.slug)}"><h2>${esc(r.name)}</h2>` +
        r.failures
          .map(
            (f) =>
              `<h3>${f.known ? 'known' : 'NEW'}: ${esc(f.title)}</h3>${f.reason ? `<p>${esc(f.reason)}</p>` : ''}${
                f.error ? `<pre>${esc(f.error.slice(0, 4000))}</pre>` : ''
              }`,
          )
          .join('') +
        r.screenshots
          .map(
            (p) =>
              `<p><a href="${esc(p)}"><img loading="lazy" src="${esc(p)}" alt="${esc(basename(p))}"></a></p>`,
          )
          .join('') +
        '</section>';
  return `<!doctype html><meta charset="utf-8"><title>macOS E2E — ${esc(s.gate)}</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:2rem;max-width:72rem}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.3rem .6rem;text-align:left}pre{background:#f6f6f6;padding:.6rem;overflow:auto}img{max-width:100%;border:1px solid #ccc}h3{margin-bottom:.2rem}</style>
<h1>macOS E2E — ${esc(s.gate)} <small>(verdict ${esc(s.verdict)})</small></h1>
<p>${s.pr ? `PR #${esc(s.pr)} · ` : ''}commit <code>${esc(String(s.sha).slice(0, 8))}</code> · app ${esc(s.app_version)} (debug) · ${esc(s.app_url)} · ${
    s.run_url ? `<a href="${esc(s.run_url)}">GitHub run</a>` : ''
  }</p>
<p>${s.passed} passed · ${s.failed} failed (${s.new_failures} new) · ${s.skipped} skipped</p>
<table><tr><th>row</th><th>runner</th><th>✓</th><th>✖</th><th>skipped</th><th>new</th></tr>${s.rows.map(row).join('')}</table>
${s.rows.map(section).join('')}
`;
}

mkdirSync(dir, { recursive: true }); // no artifacts at all when the debug build failed
writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(dir, 'index.html'), html(summary));
console.log(markdown(summary, [...fresh, ...all.filter((f) => f.known)]));
