#!/usr/bin/env node
/**
 * Validate that every locale catalog (messages/{en,fr,es,zh}.json) exists and
 * contains an identical set of keys. Reports missing/extra keys per locale and
 * flags entries that are byte-identical to English (possible untranslated text),
 * excluding an allowlist of terms that legitimately stay the same.
 *
 * Exits non-zero if any locale file is missing or any key is missing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const messagesDir = join(root, 'messages');
const LOCALES = ['en', 'fr', 'es', 'zh'];

// Terms that are intentionally identical across languages.
const SAME_OK = new Set([
  'LLM',
  'MCP',
  'API',
  'IBL',
  'URL',
  'ID',
  'AI',
  'SSO',
  'PDF',
  'CSS',
  'HTML',
]);

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

let failed = false;

// 1. All locale files exist.
for (const l of LOCALES) {
  if (!existsSync(join(messagesDir, `${l}.json`))) {
    console.error(`MISSING locale file: messages/${l}.json`);
    failed = true;
  }
}
if (failed) process.exit(1);

const flat = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    flatten(JSON.parse(readFileSync(join(messagesDir, `${l}.json`), 'utf8'))),
  ]),
);

// 2. Key parity against the union of all keys.
const allKeys = new Set();
for (const l of LOCALES) Object.keys(flat[l]).forEach((k) => allKeys.add(k));

console.log(`Total unique keys: ${allKeys.size}`);
for (const l of LOCALES) {
  const missing = [...allKeys].filter((k) => !(k in flat[l]));
  const empty = Object.entries(flat[l])
    .filter(([, v]) => v === '' || v == null)
    .map(([k]) => k);
  console.log(
    `\n[${l}] keys=${Object.keys(flat[l]).length} missing=${missing.length} empty=${empty.length}`,
  );
  if (missing.length) {
    failed = true;
    console.log(
      '  MISSING:',
      missing.slice(0, 40).join(', ') +
        (missing.length > 40 ? ` …(+${missing.length - 40})` : ''),
    );
  }
  if (empty.length) {
    failed = true;
    console.log('  EMPTY:', empty.slice(0, 40).join(', '));
  }
}

// 3. Soft check: non-English entries identical to English (possible untranslated).
for (const l of LOCALES.filter((l) => l !== 'en')) {
  const suspicious = [];
  for (const [k, v] of Object.entries(flat[l])) {
    const en = flat.en[k];
    if (en && v === en && typeof v === 'string') {
      const words = v.replace(/\{[^}]*\}/g, '').trim();
      if (
        words &&
        !SAME_OK.has(words) &&
        /[a-zA-Z]/.test(words) &&
        words.length > 2
      ) {
        suspicious.push(`${k}="${v}"`);
      }
    }
  }
  if (suspicious.length) {
    console.log(
      `\n[${l}] ${suspicious.length} entries identical to English (review):`,
    );
    suspicious.slice(0, 30).forEach((s) => console.log('  ~ ' + s));
    if (suspicious.length > 30)
      console.log(`  …(+${suspicious.length - 30} more)`);
  }
}

console.log(
  failed
    ? '\nVALIDATION FAILED'
    : '\nVALIDATION PASSED — all locales complete and in sync.',
);
process.exit(failed ? 1 : 0);
