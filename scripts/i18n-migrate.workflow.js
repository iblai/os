export const meta = {
  name: 'mentorai-i18n-migrate',
  description:
    'Migrate hardcoded UI strings to next-intl keys + en/fr/es/zh translations',
  phases: [{ title: 'Discover' }, { title: 'Migrate' }],
};

// args = array of repo-relative file paths, OR a string path to a newline-delimited
// list file (read via a discovery agent since the script has no fs access).
log(`args typeof=${typeof args}; isArray=${Array.isArray(args)}`);
let files = args;
if (typeof files === 'string' && /\.(txt|json)$/.test(files.trim())) {
  const listPath = files.trim();
  phase('Discover');
  const listed = await agent(
    `Read the file ${listPath} and return its contents as a JSON array of non-empty, trimmed lines (each line is a repo-relative file path). Return ONLY the array via the schema.`,
    {
      label: 'discover:list',
      phase: 'Discover',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { files: { type: 'array', items: { type: 'string' } } },
        required: ['files'],
      },
      model: 'sonnet',
    },
  );
  files = listed?.files ?? [];
} else if (typeof files === 'string') {
  try {
    files = JSON.parse(files);
  } catch {
    files = files.split(/[\n,]+/).map((s) => s.trim());
  }
}
if (
  files &&
  !Array.isArray(files) &&
  typeof files === 'object' &&
  Array.isArray(files.files)
) {
  files = files.files;
}
files = Array.isArray(files) ? files.filter(Boolean) : [];
if (!files.length) {
  log('No files provided in args; nothing to do.');
  return { migrated: [], failed: [] };
}
log(`Received ${files.length} files to migrate`);

// Compute a unique, readable namespace per file from its path.
const toCamel = (s) =>
  s
    .replace(/\.[jt]sx?$/, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('');

const seen = new Map();
const targets = files.map((file) => {
  // Use last two meaningful path segments for readability, drop dynamic [..] dirs.
  const parts = file
    .split('/')
    .filter((p) => p && !p.startsWith('[') && p !== '_components');
  const base = parts.slice(-2).join('-');
  let ns = toCamel(base);
  const n = (seen.get(ns) || 0) + 1;
  seen.set(ns, n);
  if (n > 1) ns = `${ns}${n}`;
  return { file, ns };
});

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    file: { type: 'string' },
    namespace: { type: 'string' },
    keyCount: { type: 'number' },
    fragmentPath: { type: 'string' },
    skipped: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['file', 'namespace', 'keyCount', 'fragmentPath'],
};

const prompt = (
  file,
  ns,
) => `You are migrating ONE file in the mentorai Next.js app (App Router, next-intl already configured) from hardcoded UI strings to next-intl translation keys, and producing en/fr/es/zh translations.

TARGET FILE (repo-relative): ${file}
NAMESPACE (use EXACTLY this): ${ns}

STEPS:
1. Read /Users/user/dev/IBL/web/mentorai/${file}.
2. Identify ONLY user-facing display strings: JSX text nodes, button/menu labels, placeholders, aria-label, title attributes, tooltip text, toast/alert/dialog messages, validation/empty-state text.
   DO NOT touch: className/style, React keys, ids, URLs/hrefs, import paths, console.* logs, data-* attributes, enum/constant values used as logic, API field names, query params, regex, test ids, or aria role values like "status"/"dialog".
3. Determine component type:
   - If the file has 'use client' at the top OR uses React hooks (useState/useEffect/etc.), it is a CLIENT component: add \`import { useTranslations } from 'next-intl';\` and inside the component add \`const t = useTranslations('${ns}');\` (place after the first line of the component body). Use \`t('key')\`.
   - If it is an async SERVER component (async function, no 'use client'): add \`import { getTranslations } from 'next-intl/server';\` and \`const t = await getTranslations('${ns}');\`.
   - If user-facing strings live in a module-scope array/const (not inside the component), and you cannot safely convert them with a hook, prefer adding a labelKey to each entry and translating at render with t(); if that is not feasible, SKIP that string and record it in "skipped".
4. Replace each identified string with \`t('camelCaseKey')\`. Use short, descriptive camelCase keys. For strings with dynamic values, use ICU params: \`t('key', { name })\` and store \`"Hello {name}"\`.
5. Keep English text EXACTLY as the original (trim surrounding whitespace only).
6. Produce accurate, natural translations for French (fr), Spanish (es), and Chinese Simplified (zh). Keep product nouns/acronyms (LLM, MCP, API, IBL) as-is where conventional.
7. Write a fragment file to /Users/user/dev/IBL/web/mentorai/messages/.fragments/${ns}.json with EXACTLY this shape (the four locale maps must have identical key sets):
{
  "namespace": "${ns}",
  "en": { "key": "English" },
  "fr": { "key": "French" },
  "es": { "key": "Spanish" },
  "zh": { "key": "Chinese" }
}
8. Save the edited component file. Make sure it still compiles (balanced JSX, imports correct, no leftover unused imports you removed).

Return JSON: { file, namespace, keyCount, fragmentPath, skipped, notes }. keyCount = number of keys created. fragmentPath = the absolute fragment path. skipped = strings you intentionally left. If the file actually had NO user-facing strings, write a fragment with empty maps and set keyCount 0.`;

phase('Migrate');
const results = await parallel(
  targets.map(
    ({ file, ns }) =>
      () =>
        agent(prompt(file, ns), {
          label: `i18n:${ns}`,
          phase: 'Migrate',
          schema: SCHEMA,
          model: 'sonnet',
        }),
  ),
);

const ok = results.filter(Boolean);
const failed = targets.filter((_, i) => !results[i]).map((t) => t.file);
const totalKeys = ok.reduce((n, r) => n + (r.keyCount || 0), 0);
log(
  `Migrated ${ok.length}/${targets.length} files, ${totalKeys} keys, ${failed.length} failed`,
);

return { migrated: ok, failed, totalKeys };
