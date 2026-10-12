// The rows of .github/workflows/macos-e2e-tauri.yml: one fresh macOS VM each,
// put into one Ollama setup by <scenario>.sh. Prints the gate job's outputs —
// the selected rows and the arches to build for.
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
  // Artifact and report dir: `@` is awkward in S3 keys and URLs.
  slug: `${scenario}--${runner}`,
});

const ROWS = [
  row('fresh', ARM, OLLAMA),
  row('fresh', 'macos-15', OLLAMA),
  // No x86_64 bottle for the ollama formula: the app's brew route builds from source.
  row('fresh-intel', INTEL, OLLAMA, 120),
  row('fresh-no-brew', ARM, OLLAMA),
  row('app-running', ARM, OLLAMA),
  row('app-running', INTEL, OLLAMA),
  row('app-stopped', ARM, OLLAMA),
  row('brew-service', ARM, OLLAMA),
  row('brew-cli', ARM, OLLAMA),
  row('cli-usr-local', ARM, OLLAMA),
  row('code-fresh', ARM, CODE),
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
console.log(`matrix=${JSON.stringify(rows)}`);
console.log(`archs=${JSON.stringify([...new Set(rows.map((r) => r.arch))])}`);
