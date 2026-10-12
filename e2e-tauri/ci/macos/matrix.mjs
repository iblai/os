// The rows of .github/workflows/macos-e2e-tauri.yml: one Ollama setup each, put in
// place by <scenario>.sh. One job per architecture runs its rows one after another
// on the same VM (run-rows.mjs). Prints the gate job's outputs — the selected rows
// and the jobs that run them.
const ARM = process.env.RUNNER || 'macos-latest';
const INTEL = 'macos-15-intel';
const specs = (...files) =>
  files.map((f) => `--spec e2e-tauri/journeys/${f}`).join(' ');
const OLLAMA = specs(
  '04-ollama-setups.spec.ts',
  '02-on-device-model-management.spec.ts',
);
const CODE = specs('01-app-launch-and-shell.spec.ts', '03-code-mode.spec.ts');
const row = (scenario, runner, run, timeout = 60) => ({
  scenario,
  runner,
  arch: runner === INTEL ? 'x64' : 'arm64',
  specs: run,
  timeout,
  name: `${scenario}@${runner}`,
  // Report dir inside the job's artifact: `@` is awkward in S3 keys and URLs.
  slug: `${scenario}--${runner}`,
});

// In run order: the cheap smoke first, the setup that hides Homebrew last.
const ROWS = [
  row('code-fresh', ARM, CODE),
  row('fresh', ARM, OLLAMA),
  row('app-running', ARM, OLLAMA),
  row('app-stopped', ARM, OLLAMA),
  row('brew-service', ARM, OLLAMA),
  row('brew-cli', ARM, OLLAMA),
  row('cli-usr-local', ARM, OLLAMA),
  row('fresh-no-brew', ARM, OLLAMA),
  // No x86_64 bottle for the ollama formula: the app's brew route builds from source.
  row('fresh-intel', INTEL, OLLAMA, 120),
  row('app-running', INTEL, OLLAMA),
];

const wanted = (process.env.SCENARIOS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const unknown = wanted.filter((w) => !ROWS.some((r) => r.scenario === w));
if (unknown.length) {
  console.error(`unknown scenario(s): ${unknown.join(', ')}`);
  process.exit(1);
}
const selected = wanted.length
  ? ROWS.filter((r) => wanted.includes(r.scenario))
  : ROWS;
const rows = [...new Map(selected.map((r) => [r.name, r])).values()];
// One job per architecture: the build plus its rows, within GitHub's six hours.
const jobs = [...new Set(rows.map((r) => r.arch))].map((arch) => {
  const mine = rows.filter((r) => r.arch === arch);
  return {
    arch,
    runner: mine[0].runner,
    timeout: Math.min(360, 30 + mine.reduce((n, r) => n + r.timeout, 0)),
  };
});
console.log(`matrix=${JSON.stringify(rows)}`);
console.log(`jobs=${JSON.stringify(jobs)}`);
