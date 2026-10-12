// Runs one architecture's rows one after another on the same VM: reset the machine,
// put it into the row's setup, run the row's journeys into the row's own logs dir.
// Never fails the job — the summary job reads the results.
//
//   MATRIX=<rows json> ARCH=<arch> [GREP=<mocha grep>] node run-rows.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const { MATRIX = '[]', ARCH = '', GREP = '' } = process.env;
const rows = JSON.parse(MATRIX).filter((r) => r.arch === ARCH);
if (!rows.length) {
  console.error(`no rows for arch "${ARCH}"`);
  process.exit(1);
}
const scripts = resolve('e2e-tauri/ci/macos');
const port = process.env.TAURI_WEBDRIVER_PORT ?? 4445;

/** Run a command to completion; a row's timeout ends it. `capture` returns its output. */
function run(cmd, args, env, timeoutMs, capture) {
  const r = spawnSync(cmd, args, {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: timeoutMs,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = capture ? `${r.stdout ?? ''}${r.stderr ?? ''}` : '';
  if (capture) process.stdout.write(output);
  if (r.error?.code === 'ETIMEDOUT') {
    console.log(
      `::warning::${cmd} ${args[0] ?? ''} hit its limit (${Math.round(timeoutMs / 60_000)} min)`,
    );
  }
  return { ok: r.status === 0 && !r.error, output };
}

/** Kill the app the row left and wait for its WebDriver port to close (wdio refuses a busy port). */
async function killApp() {
  spawnSync('pkill', ['-x', 'ibl-ai-os']);
  for (let i = 0; i < 20; i += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/status`, {
        signal: AbortSignal.timeout(500),
      });
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

const results = [];
for (const row of rows) {
  const logs = join('e2e-tauri/logs', row.slug);
  mkdirSync(logs, { recursive: true });
  console.log(`::group::${row.name}`);
  await killApp();
  const setupLog = [];
  let setupOk = true;
  for (const script of ['reset.sh', `${row.scenario}.sh`]) {
    const r = run('bash', [join(scripts, script)], {}, 15 * 60_000, true);
    setupLog.push(`$ bash ${script}\n${r.output}`);
    if (!r.ok) {
      setupOk = false;
      break;
    }
  }
  let status;
  if (!setupOk) {
    // The report shows the row as a setup failure with this log.
    writeFileSync(join(logs, 'setup.log'), setupLog.join('\n'));
    status = 'setup failed';
  } else {
    const args = ['test:tauri', ...row.specs.split(' ')];
    if (GREP) args.push('--mochaOpts.grep', GREP);
    const r = run(
      'pnpm',
      args,
      { TAURI_E2E_SCENARIO: row.scenario, TAURI_E2E_LOGS: logs },
      row.timeout * 60_000,
      false,
    );
    status = r.ok ? 'passed' : 'failed';
  }
  await killApp();
  console.log('::endgroup::');
  console.log(`${row.name}: ${status}`);
  results.push(`${row.name}: ${status}`);
}
console.log(`\n--- ${ARCH} rows ---\n${results.join('\n')}`);
