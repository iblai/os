#!/usr/bin/env node
// Sync the macOS/Tauri app version to the release version.
//
// Invoked by release-it's `after:bump` hook:
//   node scripts/sync-tauri-version.mjs ${version}
// so that src-tauri/tauri.conf.json (the source of the bundle version that
// becomes the DMG / About-box version) tracks the version release-it bumped
// package.json to, and lands in the same `chore(release):` commit + tag.
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`sync-tauri-version: invalid version "${version ?? ''}"`);
  process.exit(1);
}

const configPath = new URL('../src-tauri/tauri.conf.json', import.meta.url);
const src = readFileSync(configPath, 'utf8');

// Replace only the first top-level `"version": "..."` entry, preserving the
// file's existing formatting (a JSON.parse/stringify round-trip would reflow it
// and fight the committed style).
const next = src.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
if (next === src) {
  console.error(
    'sync-tauri-version: no "version" field found in tauri.conf.json',
  );
  process.exit(1);
}

writeFileSync(configPath, next);
console.log(`sync-tauri-version: src-tauri/tauri.conf.json -> ${version}`);
