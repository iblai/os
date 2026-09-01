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
//   3. repoints the macOS + Windows download links/badges in README.md to the
//      new version.
// Steps 2 and 3 are best-effort — they never fail the run, so the version bump
// (and the app-v<X> tag that triggers the release pipelines) always happens.
// It prints the new version to stdout so the workflow can tag app-v<version>.
import { readFileSync, writeFileSync } from 'node:fs';

const level = process.argv[2] ?? 'patch';
if (!['patch', 'minor', 'major'].includes(level)) {
  console.error(`tauri-bump: invalid level "${level}" (patch|minor|major)`);
  process.exit(1);
}

// Canonical GitHub repo that hosts the Releases (the repo moved to iblai/os).
const RELEASES_BASE = 'https://github.com/iblai/os/releases/download';

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

// The doc updates below are BEST-EFFORT: they must never fail the version bump.
// If they did, a README/DOWNLOADS redesign (as happened when the landing README
// was rebuilt with download-button badges) would break autoversion, the
// app-v<X> tag would never be pushed, and the release pipelines (macOS DMG +
// Windows) would never run. On any mismatch we warn and carry on, so the tag is
// always produced and the version is always printed.

// 2) docs/DOWNLOADS.md — prepend a row under the table header (newest first).
try {
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
    console.warn(
      'tauri-bump: Downloads table not found in docs/DOWNLOADS.md — skipping',
    );
  } else {
    lines.splice(
      sepIdx + 1,
      0,
      `| ${tag} | ${date} | [macOS (Universal)](${url}) · [Windows x64](${winX64Url}) · [Windows arm64](${winArm64Url}) |`,
    );
    writeFileSync(downloadsUrl, lines.join('\n'));
  }
} catch (err) {
  console.warn(`tauri-bump: DOWNLOADS.md update skipped (${err.message})`);
}

// 3) README.md — repoint the macOS + Windows(x64) download links at the new
// version. The links are matched by SHAPE — `…/app-v<X>/<anything>_<X>_universal.dmg`
// and `…_x64-setup.exe` — NOT by the current productName. This is deliberate:
// a productName rename (ibl.ai → iblai) changes what the *new* link is called,
// but the README still holds the *old* name; a name-anchored regex would fail
// to match and silently skip (which is exactly what left the README stale at
// app-v0.95.8). Matching any product segment repoints whatever is there today
// to the new `url`/`winX64Url` (which already carry the new productName). Works
// for the download-button badges AND inline links, and survives renames.
try {
  const readmeUrl = new URL('../README.md', import.meta.url);
  const readme = readFileSync(readmeUrl, 'utf8');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const base = esc(RELEASES_BASE);
  // Any product-name segment: stop at a path/quote/paren/space boundary so the
  // match doesn't run past the filename into the surrounding markup.
  const product = `[^/"'\\s)]+`;
  const macRe = new RegExp(
    `${base}/app-v\\d+\\.\\d+\\.\\d+/${product}_\\d+\\.\\d+\\.\\d+_universal\\.dmg`,
    'g',
  );
  const winRe = new RegExp(
    `${base}/app-v\\d+\\.\\d+\\.\\d+/${product}_\\d+\\.\\d+\\.\\d+_x64-setup\\.exe`,
    'g',
  );
  let out = readme.replace(macRe, url);
  if (out === readme) {
    // `::warning::` surfaces this as a GitHub Actions annotation (not just a
    // buried log line) so a silent skip like the app-v0.95.8 one gets noticed.
    console.warn(
      '::warning::tauri-bump: macOS download link not found in README.md — README left stale',
    );
  }
  const afterWin = out.replace(winRe, winX64Url);
  if (afterWin === out) {
    console.warn(
      '::warning::tauri-bump: Windows download link not found in README.md — README left stale',
    );
  }
  out = afterWin;
  if (out !== readme) writeFileSync(readmeUrl, out);
} catch (err) {
  console.warn(`::warning::tauri-bump: README update skipped (${err.message})`);
}

console.log(version);
