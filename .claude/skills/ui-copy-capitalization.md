---
description: Capitalization rules for user-facing English strings (messages/en.json and any hard-coded UI text). Invoke whenever adding or editing a page title, heading, button, tab, filter, menu item, or other UI label.
---

# UI Copy Capitalization Skill

English UI labels use **Title Case**; running text uses **sentence case**. Mixing the two on one screen ("All Agents" next to "My agents", "Create Agent" next to "See more") reads as a bug.

## Title Case — short labels a user scans or clicks

- Page titles and `<h1>`–`<h3>` section headings: `Explore Agents`, `My Agents`, `All Agents`, `Favorites`
- Buttons and links that act as buttons: `Create Agent`, `See More`, `Clear All`, `Load More`
- Tabs, filter and dropdown triggers, menu items, options: `LLM Provider`, `Created By`, `My Organization`
- Dialog / modal / card titles: `Create Custom Agent`

Rules:

- Capitalize every word except articles, short conjunctions and short prepositions (`a`, `an`, `the`, `and`, `or`, `but`, `for`, `of`, `to`, `in`, `on`, `at`, `by`, `with`) — those stay lowercase unless they are the first or last word: `Terms of Service`, `Sign In with Google`, `What's New`.
- Keep acronyms and brand names as written: `LLM Provider`, `AI Policy`, `ibl.ai`, `OpenAI`.
- ICU placeholders keep their own casing; capitalize the words around them: `{category} Agents`, `{provider} Agents`.

## Sentence case — anything read as a sentence

- Descriptions and subtitles: `Discover and create agents that combine subject expertise, resources, and skills`
- Placeholders and helper text: `Search agents`
- Toasts, errors, empty states, confirmations, tooltips: `No favorites yet`, `Try a different search term or clear your filters.`
- Loading text: `Loading more`

## aria-label

An `aria-label` that names a visible label repeats that label's casing exactly (`listAriaLabel` for the `My Agents` list is `My Agents`). One that describes an action or state in words of its own is sentence case: `Load more of my agents`, `Clear search`.

## Scope

- Applies to `messages/en.json` and any English text hard-coded in components.
- **Do not** apply English Title Case to `es.json`, `fr.json` or `zh.json`: Spanish and French use sentence case for headings and buttons (`Explorar agentes`, `Voir plus`), and Chinese has no case. Leave those translations alone when fixing English casing.
- When a key is shared by several components (e.g. `seeMore` appears in every explore section), change every copy in the namespace group together so the screen stays consistent.

## When changing an existing string

Casing changes break exact-match assertions. Before finishing:

```bash
grep -rnE "Old text" --include='*.ts' --include='*.tsx' --include='*.json' --include='*.md' \
  app components hooks lib e2e messages --exclude-dir=node_modules
```

- Unit tests: update `getByText('…')`, `toHaveTextContent('…')` and `{ name: '…' }` strings to the new casing; `/…/i` regexes need no change.
- E2E: page objects should match labels with case-insensitive regexes (`getByRole('button', { name: /see more/i })`) so a casing change never breaks a journey. Fix any exact-string locator you find.
- Update quoted UI text in `e2e/COVERAGE.md` and `e2e/coverage.json` descriptions.
- Run the touched components' vitest suites.
