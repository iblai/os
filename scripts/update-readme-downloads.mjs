#!/usr/bin/env node
// Prepend a macOS download row to the README Downloads table.
//
// Invoked by release-it's `after:bump` hook:
//   node scripts/update-readme-downloads.mjs ${version}
// so the row lands in the same `chore(release):` commit release-it pushes to
// main. (main is protected, so the release CI can't push the README itself —
// but the release commit already goes through the release author.)
//
// The DMG the CI workflow attaches to the v<version> Release is named
// deterministically by Tauri as `<productName>_<version>_universal.dmg`, so we
// can link it here before the build finishes; the link goes live once the DMG
// uploads to that Release.
//
// The row is inserted directly under the Downloads table header (identified by
// its "Version | Date | Download" columns) rather than at an HTML-comment
// marker, so Prettier — which inserts a blank line before HTML comments and
// would split the table — keeps the rows contiguous with the header.
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`update-readme-downloads: invalid version "${version ?? ''}"`);
  process.exit(1);
}

// Canonical GitHub repo that hosts the Releases (the repo moved to iblai/os).
const RELEASES_BASE = 'https://github.com/iblai/os/releases/download';

const confUrl = new URL('../src-tauri/tauri.conf.json', import.meta.url);
const productName = JSON.parse(readFileSync(confUrl, 'utf8')).productName;
if (!productName) {
  console.error('update-readme-downloads: no productName in tauri.conf.json');
  process.exit(1);
}

const tag = `v${version}`;
const dmg = `${productName}_${version}_universal.dmg`;
const url = `${RELEASES_BASE}/${tag}/${encodeURIComponent(dmg)}`;
const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
const row = `| ${tag} | ${date} | [macOS (Universal)](${url}) |`;

const readmeUrl = new URL('../README.md', import.meta.url);
const lines = readFileSync(readmeUrl, 'utf8').split('\n');

// Idempotent: don't add a second row for the same version (e.g. a re-run).
// Tolerant of Prettier's column padding (| v1.2.3  | ... |).
const tagCell = new RegExp(`\\|\\s*${tag.replace(/\./g, '\\.')}\\s*\\|`);
if (lines.some((l) => tagCell.test(l))) {
  console.log(`update-readme-downloads: README already has a row for ${tag}`);
  process.exit(0);
}

// Find the Downloads table header, then its separator row (| --- | --- | --- |).
const headerIdx = lines.findIndex(
  (l) =>
    /^\s*\|/.test(l) &&
    /Version/.test(l) &&
    /Date/.test(l) &&
    /Download/.test(l),
);
const sepIdx = headerIdx + 1;
if (headerIdx < 0 || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[sepIdx] ?? '')) {
  console.error(
    'update-readme-downloads: Downloads table (| Version | Date | Download |) not found in README.md',
  );
  process.exit(1);
}

// Newest on top: insert immediately below the separator row. Prettier re-aligns
// the column widths on commit.
lines.splice(sepIdx + 1, 0, row);
writeFileSync(readmeUrl, lines.join('\n'));
console.log(`update-readme-downloads: added ${tag} -> ${dmg}`);
