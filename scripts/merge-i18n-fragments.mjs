#!/usr/bin/env node
/**
 * Merge per-file translation fragments (messages/.fragments/<ns>.json) into the
 * locale catalogs messages/{en,fr,es,zh}.json under each fragment's namespace.
 *
 * Validates that every locale in a fragment has an identical key set, and that
 * namespaces don't collide with existing catalog entries. Removes the fragments
 * directory on success. Pass --keep to retain fragments, --dry to preview.
 */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const messagesDir = join(root, 'messages');
const fragDir = join(messagesDir, '.fragments');
const LOCALES = ['en', 'fr', 'es', 'zh'];
const keep = process.argv.includes('--keep');
const dry = process.argv.includes('--dry');

if (!existsSync(fragDir)) {
  console.error(`No fragments directory at ${fragDir}`);
  process.exit(1);
}

const catalogs = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    JSON.parse(readFileSync(join(messagesDir, `${l}.json`), 'utf8')),
  ]),
);

const fragments = readdirSync(fragDir).filter((f) => f.endsWith('.json'));
let nsCount = 0;
let keyCount = 0;
const warnings = [];

for (const file of fragments) {
  const frag = JSON.parse(readFileSync(join(fragDir, file), 'utf8'));
  const ns = frag.namespace;
  if (!ns) {
    warnings.push(`${file}: missing namespace, skipped`);
    continue;
  }
  const enKeys = Object.keys(frag.en || {}).sort();
  for (const l of LOCALES) {
    const lk = Object.keys(frag[l] || {}).sort();
    if (lk.join('|') !== enKeys.join('|')) {
      warnings.push(
        `${file}: locale '${l}' key set differs from 'en' (${lk.length} vs ${enKeys.length})`,
      );
    }
  }
  if (!enKeys.length) {
    warnings.push(`${file}: no keys (empty fragment)`);
    continue;
  }
  for (const l of LOCALES) {
    if (
      catalogs[l][ns] &&
      JSON.stringify(catalogs[l][ns]) !== JSON.stringify(frag[l] || {})
    ) {
      warnings.push(
        `${file}: namespace '${ns}' already exists in ${l}.json and differs — overwriting`,
      );
    }
    catalogs[l][ns] = frag[l] || {};
  }
  nsCount++;
  keyCount += enKeys.length;
}

if (warnings.length) {
  console.log('Warnings:');
  warnings.forEach((w) => console.log('  - ' + w));
}

if (dry) {
  console.log(
    `[dry] would merge ${nsCount} namespaces / ${keyCount} keys into ${LOCALES.length} catalogs`,
  );
  process.exit(0);
}

for (const l of LOCALES) {
  // Sort top-level namespaces alphabetically for stable diffs.
  const sorted = Object.fromEntries(
    Object.keys(catalogs[l])
      .sort()
      .map((k) => [k, catalogs[l][k]]),
  );
  writeFileSync(
    join(messagesDir, `${l}.json`),
    JSON.stringify(sorted, null, 2) + '\n',
  );
}

if (!keep) rmSync(fragDir, { recursive: true, force: true });

console.log(
  `Merged ${nsCount} namespaces / ${keyCount} keys into ${LOCALES.join(', ')} catalogs.`,
);
