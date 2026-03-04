# Contributing to mentorAI

Thank you for your interest in contributing to mentorAI! This guide will help you get set up and understand our development workflow.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Git Workflow](#git-workflow)
- [Testing](#testing)
- [Accessibility](#accessibility)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

---

## Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 25.3.0+ | [nvm](https://github.com/nvm-sh/nvm) recommended |
| pnpm | 10+ | `npm install -g pnpm` |
| Git | 2.30+ | [git-scm.com](https://git-scm.com) |

### Fork & Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/mentor-ai.git
   cd mentor-ai
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/iblai/mentor-ai.git
   ```

---

## Development Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with valid IBL.ai platform URLs. See the [README](README.md#configuration) for all available variables.

### 3. Start the dev server

```bash
pnpm dev
```

The app starts at [http://localhost:3000](http://localhost:3000).

### 4. Run tests

```bash
pnpm test           # Single run
pnpm test:watch     # Watch mode
pnpm test:coverage  # With coverage report
```

---

## Project Structure

```
├── app/            # Next.js App Router — pages and API routes
├── components/     # React components
│   ├── ui/         # Base UI primitives (shadcn/ui)
│   └── ...         # Feature components
├── features/       # Feature modules (state + business logic)
├── hooks/          # Custom React hooks
├── lib/            # Utility functions, config, types
├── providers/      # React context providers
├── store/          # Redux store configuration
├── styles/         # Global CSS
├── public/         # Static assets
└── docs/           # Internal documentation
```

### Key conventions

- **Pages** go in `app/` following Next.js App Router conventions
- **Components** are colocated with their feature or placed in `components/`
- **Business logic** lives in `features/` with Redux slices and related hooks
- **Reusable hooks** go in `hooks/`
- **UI primitives** (buttons, dialogs, inputs) go in `components/ui/`
- **Tests** are colocated next to the code they test in `__tests__/` directories

---

## Coding Standards

### TypeScript

- All code is written in TypeScript with strict mode enabled
- Use explicit types for function parameters and return values at module boundaries
- Prefer `interface` for object shapes and `type` for unions/intersections
- Avoid `any` — use `unknown` and narrow the type when the shape is uncertain

### React

- Use functional components with hooks
- Prefer named exports over default exports
- Keep components focused on a single responsibility
- Extract complex logic into custom hooks
- Use `'use client'` directive only when the component genuinely needs client-side APIs

### Styling

- Use **Tailwind CSS** utility classes for styling
- Use the `cn()` utility (from `lib/utils`) to merge class names conditionally
- Follow the existing shadcn/ui patterns for new UI primitives
- Keep responsive design in mind — the app supports mobile, tablet, and desktop

### State Management

- **Redux Toolkit** with RTK Query for server state
- Use RTK Query hooks (`useGetXQuery`, `useXMutation`) for API calls
- Local UI state stays in React state (`useState`, `useReducer`)
- Shared UI state goes through Redux slices in `features/`

### File Naming

- Components: `PascalCase.tsx` (e.g., `ChatMessage.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-voice-chat.ts`)
- Utilities: `kebab-case.ts` (e.g., `event-bus.ts`)
- Tests: `*.test.ts` or `*.test.tsx` in a `__tests__/` directory
- Constants: `kebab-case.ts` (e.g., `constants.ts`)

### Imports

- Use the `@/` path alias for absolute imports from the project root
- Group imports: external packages first, then internal modules, then relative imports
- Use the `@iblai/iblai-js` SDK for all data layer, auth, and shared component imports:
  ```typescript
  import { mentorReducer, mentorMiddleware } from '@iblai/iblai-js/data-layer';
  import { AuthProvider, useChatV2 } from '@iblai/iblai-js/web-utils';
  import { Loader, TenantSwitch } from '@iblai/iblai-js/web-containers';
  ```

---

## Git Workflow

### Branch Naming

Use the pattern: `<type>/<scope>/<description>`

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `chore` — maintenance, dependencies, config
- `docs` — documentation changes
- `refactor` — code restructuring without behavior change
- `test` — adding or updating tests

**Scope** (optional but encouraged):
- `chat`, `analytics`, `explore`, `auth`, `projects`, `ui`, `voice`, `billing`, etc.

**Examples:**
```
feat/chat/add-message-reactions
fix/voice/handle-mic-permission-denial
chore/deps/upgrade-next-to-15.4
refactor/analytics/extract-chart-hooks
```

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]
```

**Examples:**
```
feat(chat): add message pinning support
fix(analytics): correct date range filter on topics page
chore(deps): upgrade @iblai/iblai-js to 1.0.9
docs: update deployment guide for Docker
refactor(hooks): extract voice chat logic into dedicated hook
test(projects): add unit tests for create project modal
```

**Rules:**
- Use imperative mood: "add feature" not "added feature"
- Keep the first line under 72 characters
- Reference issue numbers in the body when applicable: `Closes #123`

---

## Testing

### Unit Tests

We use **Vitest** with **Testing Library** for unit and component tests.

```bash
pnpm test              # Run all tests once
pnpm test:watch        # Watch mode (re-runs on file changes)
pnpm test:coverage     # Generate coverage report
pnpm test -- path/to/file.test.ts  # Run a single test file
```

### Writing Tests

- Place tests in a `__tests__/` directory next to the source file
- Name test files `<source-file>.test.ts` or `<source-file>.test.tsx`
- Test behavior, not implementation details
- Use `@testing-library/react` for component tests — query by role, label, or text, not by CSS class or test ID
- Mock external dependencies (API calls, hooks) at the module level

**Example:**

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ChatMessage } from '../chat-message';

describe('ChatMessage', () => {
  it('renders the message content', () => {
    render(<ChatMessage content="Hello world" role="assistant" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('calls onRate when thumbs up is clicked', async () => {
    const onRate = vi.fn();
    render(<ChatMessage content="Test" role="assistant" onRate={onRate} />);

    await userEvent.click(screen.getByRole('button', { name: /thumbs up/i }));
    expect(onRate).toHaveBeenCalledWith('positive');
  });
});
```

### E2E Tests

End-to-end tests use **Playwright**. See the `docs/` directory for E2E test setup instructions.

---

## Accessibility

mentorAI targets **WCAG 2.1 AA** compliance. All contributions should meet these standards:

### Requirements

- All interactive elements must be keyboard-accessible
- Use semantic HTML elements (`button`, `nav`, `main`, `section`, etc.)
- Provide `aria-label` or `aria-labelledby` for elements without visible text labels
- Ensure color contrast ratios meet AA standards (4.5:1 for normal text, 3:1 for large text)
- Support screen readers — test with VoiceOver (macOS) or NVDA (Windows)
- Use Radix UI primitives for complex widgets (dialogs, dropdowns, tabs) — they handle ARIA automatically
- Never use `outline: none` without providing an alternative focus indicator

### Testing Accessibility

```bash
# Run accessibility checks with vitest-axe
pnpm test -- --grep "a11y"
```

---

## Pull Request Process

### Before Submitting

1. **Sync with upstream:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run the full check suite:**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

3. **Verify your changes work end-to-end** — start the dev server and manually test the affected feature

### Submitting a PR

1. Push your branch to your fork
2. Open a pull request against `main` on the upstream repository
3. Fill in the PR template:
   - **Summary** — what does this PR do and why?
   - **Test plan** — how did you verify the changes?
   - **Screenshots** — include before/after screenshots for UI changes

### Review Criteria

PRs will be reviewed for:

- **Correctness** — does it work as described?
- **Code quality** — does it follow our coding standards?
- **Tests** — are new features and bug fixes covered by tests?
- **Accessibility** — does it meet WCAG 2.1 AA requirements?
- **Performance** — does it introduce unnecessary re-renders, large bundles, or slow queries?
- **Security** — are there any injection vectors, exposed secrets, or insecure patterns?

### After Review

- Address review feedback with new commits (don't force-push during review)
- Once approved, a maintainer will merge your PR
- Your contribution will be included in the next release

---

## Reporting Issues

### Bug Reports

When filing a bug report, include:

1. **Description** — what happened vs. what you expected
2. **Steps to reproduce** — minimal steps to trigger the issue
3. **Environment** — browser, OS, Node.js version
4. **Screenshots or logs** — console errors, network failures, visual glitches

### Feature Requests

We welcome feature ideas! When proposing a feature:

1. **Describe the problem** — what user need does this address?
2. **Propose a solution** — how should it work from the user's perspective?
3. **Consider alternatives** — are there existing workarounds?

---

## Code of Conduct

We are committed to providing a welcoming and inclusive experience for everyone. Please be respectful, constructive, and collaborative in all interactions.

---

## Questions?

If you have questions about contributing, open a [Discussion](https://github.com/iblai/mentor-ai/discussions) or reach out to the maintainers.

Thank you for helping make mentorAI better!
