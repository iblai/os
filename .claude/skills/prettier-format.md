---
description: Run prettier on files Claude has edited to match .prettierrc before committing. Invoke after any code change session.
---

# Prettier Format Skill

After making any code edits, run prettier on the changed files to match the project's `.prettierrc` before staging or committing.

## .prettierrc rules (for reference)

- `singleQuote: true`
- `semi: true`
- `tabWidth: 2`
- `trailingComma: "all"`
- `printWidth: 80`
- `arrowParens: "always"`
- `endOfLine: "lf"`
- Plugin: `prettier-plugin-tailwindcss` (sorts Tailwind classes)

## When to apply

Apply this skill automatically after completing any set of file edits, **before** running `git add` or `git commit`.

## Steps

1. Identify which files were modified in this session:

   ```bash
   git diff --name-only
   ```

2. Run prettier on only those files (faster than formatting everything):

   ```bash
   pnpm prettier --write <file1> <file2> ...
   ```

   Or if many files changed:

   ```bash
   pnpm prettier --write .
   ```

3. Check if prettier made any changes:

   ```bash
   git diff --name-only
   ```

4. If prettier changed files, re-read them to update your understanding before continuing.

5. Stage all formatting changes alongside the code changes:
   ```bash
   git add -u
   ```

## Why this matters

The pre-commit hook runs `pnpm prettier --write .` and `git add -u` automatically. If Claude's edits are already formatted correctly, the commit goes through cleanly with no diff noise. If they aren't, the hook rewrites the files and the commit includes both code changes and formatting noise — harder to review.

## Do not skip

Never skip this step for TypeScript, TSX, CSS, or JSON files. Tailwind class ordering is enforced by `prettier-plugin-tailwindcss` — class order changes must be committed alongside the code change.
