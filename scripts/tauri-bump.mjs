#!/usr/bin/env node
// Bump the independent macOS/Tauri app version and record the download.
//
// Usage: node scripts/tauri-bump.mjs [patch|minor|major]   (default: patch)
//
// The Tauri app version lives in src-tauri/tauri.conf.json and is versioned
// separately from the web app (package.json). CI (tauri-autoversion.yml) runs
// this on every src-tauri change merged to main, then commits + tags app-v<X>.
//
// This script only edits files (bump + docs + README); the workflow does the
// git commit/tag/push. It:
//   1. bumps tauri.conf.json's version (regex, preserving the file's style),
//   2. prepends a row to docs/DOWNLOADS.md (deterministic app-v<X> download
//      links: macOS DMG + Windows x64/arm64 NSIS installers),
//   3. updates the "Latest macOS build" / "Latest Windows build" lines in
//      README.md.
// It prints the new version to stdout so the workflow can tag app-v<version>.
import { readFileSync, writeFileSync } from 'node:fs';

const level = process.argv[2] ?? 'patch';
if (!['patch', 'minor', 'major'].includes(level)) {
  console.error(`tauri-bump: invalid level "${level}" (patch|minor|major)`);
  process.exit(1);
}

// Canonical GitHub repo that hosts the Releases (the repo moved to iblai/os).
const RELEASES_BASE = 'https://github.com/iblai/os/releases/download';
const README_LATEST_RE = /^\*\*Latest macOS build:\*\*.*$/m;
const README_WINDOWS_LATEST_RE = /^\*\*Latest Windows build:\*\*.*$/m;

const confUrl = new URL('../src-tauri/tauri.conf.json', import.meta.url);
const conf = readFileSync(confUrl, 'utf8');

const cur = conf.match(/"version":\s*"(\d+)\.(\d+)\.(\d+)"/);
if (!cur) {
  console.error('tauri-bump: no semver "version" in tauri.conf.json');
  process.exit(1);
}
let [major, minor, patch] = [Number(cur[1]), Number(cur[2]), Number(cur[3])];
if (level === 'major') [major, minor, patch] = [major + 1, 0, 0];
else if (level === 'minor') [minor, patch] = [minor + 1, 0];
else patch += 1;
const version = `${major}.${minor}.${patch}`;

// 1) tauri.conf.json — replace only the first top-level version, preserve style.
writeFileSync(
  confUrl,
  conf.replace(/("version":\s*")\d+\.\d+\.\d+(")/, `$1${version}$2`),
);

const productName = JSON.parse(conf).productName;
const tag = `app-v${version}`;
const dmg = `${productName}_${version}_universal.dmg`;
const url = `${RELEASES_BASE}/${tag}/${encodeURIComponent(dmg)}`;
// Windows NSIS installers, one per architecture. Tauri names them
// `<productName>_<version>_<arch>-setup.exe` (arch = x64 | arm64).
const winX64 = `${productName}_${version}_x64-setup.exe`;
const winArm64 = `${productName}_${version}_arm64-setup.exe`;
const winX64Url = `${RELEASES_BASE}/${tag}/${encodeURIComponent(winX64)}`;
const winArm64Url = `${RELEASES_BASE}/${tag}/${encodeURIComponent(winArm64)}`;
const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

// 2) docs/DOWNLOADS.md — prepend a row under the table header (newest first).
const downloadsUrl = new URL('../docs/DOWNLOADS.md', import.meta.url);
const lines = readFileSync(downloadsUrl, 'utf8').split('\n');
const headerIdx = lines.findIndex(
  (l) =>
    /^\s*\|/.test(l) &&
    /Version/.test(l) &&
    /Date/.test(l) &&
    /Download/.test(l),
);
const sepIdx = headerIdx + 1;
if (headerIdx < 0 || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[sepIdx] ?? '')) {
  console.error('tauri-bump: Downloads table not found in docs/DOWNLOADS.md');
  process.exit(1);
}
lines.splice(
  sepIdx + 1,
  0,
  `| ${tag} | ${date} | [macOS (Universal)](${url}) · [Windows x64](${winX64Url}) · [Windows arm64](${winArm64Url}) |`,
);
writeFileSync(downloadsUrl, lines.join('\n'));

// 3) README.md — update the single "Latest macOS build" line.
const readmeUrl = new URL('../README.md', import.meta.url);
const readme = readFileSync(readmeUrl, 'utf8');
const latest = `**Latest macOS build:** [ibl.ai ${tag} (Universal .dmg)](${url}) · [all versions](docs/DOWNLOADS.md)`;
const latestWindows = `**Latest Windows build:** [ibl.ai ${tag} (x64 .exe)](${winX64Url}) · [ARM64 .exe](${winArm64Url}) · [all versions](docs/DOWNLOADS.md)`;
if (!README_LATEST_RE.test(readme)) {
  console.error('tauri-bump: "Latest macOS build" line not found in README.md');
  process.exit(1);
}
if (!README_WINDOWS_LATEST_RE.test(readme)) {
  console.error(
    'tauri-bump: "Latest Windows build" line not found in README.md',
  );
  process.exit(1);
}
writeFileSync(
  readmeUrl,
  readme
    .replace(README_LATEST_RE, latest)
    .replace(README_WINDOWS_LATEST_RE, latestWindows),
);

console.log(version);
