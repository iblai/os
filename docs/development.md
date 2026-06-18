# Development Guide

## Prerequisites

- **Node.js 25.3.0+** (we recommend using [nvm](https://github.com/nvm-sh/nvm))
- **pnpm 10+** — `npm install -g pnpm`

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/iblai/os.git
cd os
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your ibl.ai platform credentials:

```env
# Required — your ibl.ai platform URLs
NEXT_PUBLIC_AUTH_URL=https://login.iblai.app
NEXT_PUBLIC_API_BASE_URL=https://api.iblai.app
NEXT_PUBLIC_LEGACY_LMS_URL=https://learn.iblai.app

# Required — your tenant key
NEXT_PUBLIC_MAIN_TENANT_KEY=main

# Required — WebSocket and voice servers
NEXT_PUBLIC_BASE_WS_URL=wss://asgi.data.iblai.app
NEXT_PUBLIC_IBL_LIVE_KIT_SERVER_URL=wss://livekit.call.iblai.app

# App URLs
NEXT_PUBLIC_MENTOR_URL=http://localhost:3000
NEXT_PUBLIC_MENTOR_IFRAME_URL=http://localhost:3000

# Feature flags
NEXT_PUBLIC_IBL_PLATFORM=mentor
NEXT_PUBLIC_IBL_TEMPLATE_MENTOR=ai-mentor
NEXT_PUBLIC_IBL_ALLOW_FREE_TRIAL_BANNER=true
NEXT_PUBLIC_STRIPE_ENABLED=false
NEXT_PUBLIC_ENABLE_ADVERTISING=false
```

> `NEXT_PUBLIC_API_BASE_URL` points at the consolidated ibl.ai API gateway —
> the SDK derives `/lms`, `/dm`, and `/axd` path prefixes from it, so you
> don't need to set `NEXT_PUBLIC_LMS_URL`, `NEXT_PUBLIC_DM_URL`, or
> `NEXT_PUBLIC_AXD_URL` separately unless you're targeting a self-hosted
> stack with distinct subdomains.

### 4. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Node.js 25+ note:** The `dev` script already includes `--no-experimental-webstorage` to prevent conflicts with the SDK's browser storage guards. If you customize your scripts, make sure to include `NODE_OPTIONS='--no-experimental-webstorage'`.

---

## Scripts

| Script                   | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `pnpm dev`               | Start development server (port 3000)                 |
| `pnpm build`             | Production build (standalone output)                 |
| `pnpm start`             | Start production server via `server-wrapper.js`      |
| `pnpm lint`              | Run ESLint with `--fix`, then `typecheck`            |
| `pnpm lint:check`        | Lint without auto-fix (CI mode)                      |
| `pnpm typecheck`         | TypeScript type checking (`tsc --noEmit`)            |
| `pnpm format`            | Format code with Prettier                            |
| `pnpm format:check`      | Prettier check without writing (CI mode)             |
| `pnpm format-lint`       | Run `format` then `lint`                             |
| `pnpm test`              | Run unit tests (Vitest)                              |
| `pnpm test:watch`        | Run tests in watch mode                              |
| `pnpm test:coverage`     | Generate test coverage report                        |
| `pnpm test:ui`           | Vitest UI runner                                     |
| `pnpm test:e2e`          | Playwright end-to-end (seeds empty `.auth` fixtures) |
| `pnpm test:e2e:ui`       | Playwright UI runner                                 |
| `pnpm test:e2e:headed`   | Playwright in a visible browser                      |
| `pnpm tauri:dev`         | Start Tauri desktop dev mode                         |
| `pnpm tauri:build`       | Build Tauri desktop app                              |
| `pnpm tauri:build:debug` | Tauri debug build (sourcemaps, faster)               |
| `pnpm release`           | Cut a release via release-it                         |
| `pnpm prepare`           | Install husky hooks (runs on `pnpm install`)         |

---

## Testing

```bash
pnpm test              # unit tests (Vitest)
pnpm test:watch        # watch mode
pnpm test:coverage     # coverage report
pnpm test:e2e          # Playwright end-to-end
pnpm test:e2e:ui       # Playwright UI runner
pnpm test:e2e:headed   # run in a visible browser
```

> `pnpm test:e2e` auto-seeds empty Playwright auth fixtures under `playwright/.auth/` before running — no manual setup needed.

---

## Architecture

```
os/
├── app/                        # Next.js App Router
│   ├── platform/               # Main authenticated routes
│   │   └── [tenantKey]/        # Multi-tenant routing (mentor pages nest below)
│   ├── create-mentor/          # Mentor creation wizard
│   ├── share/                  # Public shared chats
│   ├── reports/                # Analytics report export
│   ├── provider-association/   # Stripe / OAuth provider linking
│   ├── google-oauth-callback/  # Google OAuth return
│   ├── sso-login/              # SSO entry
│   ├── sso-login-complete/     # SSO callback
│   ├── mobile-sso-login/       # Mobile-specific SSO entry
│   ├── mobile/                 # Touch-optimized mobile routes
│   ├── uploads/                # File upload preview
│   ├── error/                  # Branded error pages (404, 500, …)
│   ├── version/                # Build info endpoint
│   └── api/                    # API routes (auth-redirect, health)
│
├── components/                 # React components
│   ├── ui/                     # 54 shadcn/ui primitives
│   ├── chat/                   # Chat message rendering
│   ├── advanced-chat/          # Advanced chat builder + tabs
│   ├── chat-input-form/        # Input controls (voice, search, upload)
│   ├── canvas/                 # Document canvas (artifacts)
│   ├── header/                 # Top app bar
│   ├── sidebar/                # Nav + project switcher
│   ├── mentors/                # Mentor cards, lists, picker
│   ├── modals/                 # All modal dialogs
│   │   └── edit-mentor-modal/  # Mentor settings (LLM, datasets, access, …)
│   ├── projects/               # Project management
│   ├── welcome-chat/           # Landing / welcome screen
│   ├── workflows/              # Workflow builder UI
│   ├── markdown/               # Markdown + code renderers
│   ├── model-download/         # Local LLM download UI (Tauri)
│   ├── top-trial-banner/       # Free-trial / billing banners
│   ├── icons/                  # Custom icons
│   └── accessibility/          # A11y helpers
│
├── features/                   # Feature modules (state + logic) — 13 modules
│   ├── analytics/              # Analytics logic
│   ├── auth/                   # Auth slice
│   ├── chat/                   # Chat state machine
│   ├── chat-input/             # Input model
│   ├── mentors/                # Mentor CRUD
│   ├── messages/               # Message normalization
│   ├── navigation/             # Sidebar + route state
│   ├── provider-association/   # Stripe / OAuth flow
│   ├── rbac/                   # Role-based access control
│   ├── subscription/           # Billing & subscription
│   ├── tenants/                # Multi-tenant routing helpers
│   ├── top-banner/             # Banner copy + visibility rules
│   └── users/                  # User CRUD + invites
│
├── hooks/                      # 151 custom React hooks
│   ├── use-voice-chat.ts       # LiveKit voice integration
│   ├── use-mentors.ts          # Mentor CRUD operations
│   ├── use-history.ts          # Chat history management
│   ├── use-datasets.ts         # Training data management
│   ├── subscription/           # Subscription hooks
│   └── ...
│
├── lib/                        # Utilities and configuration
├── providers/                  # React context providers
├── store/                      # Redux store setup
├── styles/                     # Global CSS
├── public/                     # Static assets (LLM provider logos, fonts, env.js)
├── src-tauri/                  # Tauri desktop app (Rust)
├── url-routes/                 # Centralized route constants used by app + tauri shell
├── scripts/                    # Build / release helpers (post-build, etc.)
└── docs/                       # Internal documentation
```

### Data Flow

```
User → React Components → Custom Hooks → Redux (RTK Query) → ibl.ai API
                                              ↓
                                        @iblai/iblai-js SDK
                                        ├── /data-layer  (API slices, reducers)
                                        ├── /web-utils   (auth, providers, chat hooks)
                                        └── /web-containers (shared UI components)
```

The app uses **[@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js)** as its unified SDK, which bundles the data layer, authentication utilities, and shared components under a single package.

---

## Configuration

### Environment Variables

| Variable                                           | Required | Description                                                                                          |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_AUTH_URL`                             | Yes      | Authentication service URL (e.g. `https://login.iblai.app`)                                          |
| `NEXT_PUBLIC_API_BASE_URL`                         | Yes      | Consolidated API gateway base (e.g. `https://api.iblai.app`) — the SDK appends `/lms`, `/dm`, `/axd` |
| `NEXT_PUBLIC_LEGACY_LMS_URL`                       | No       | Direct LMS host for asset URLs that can't be proxied (e.g. `https://learn.iblai.app`)                |
| `NEXT_PUBLIC_LMS_URL`                              | No       | Override LMS path; defaults to `${API_BASE}/lms`                                                     |
| `NEXT_PUBLIC_DM_URL`                               | No       | Override DM path; defaults to `${API_BASE}/dm`                                                       |
| `NEXT_PUBLIC_AXD_URL`                              | No       | Override AXD path; defaults to `${API_BASE}/axd`                                                     |
| `NEXT_PUBLIC_MAIN_TENANT_KEY`                      | Yes      | Primary tenant identifier                                                                            |
| `NEXT_PUBLIC_BASE_WS_URL`                          | Yes      | WebSocket server URL                                                                                 |
| `NEXT_PUBLIC_IBL_LIVE_KIT_SERVER_URL`              | Yes      | LiveKit voice server URL                                                                             |
| `NEXT_PUBLIC_MENTOR_URL`                           | Yes      | This app's public URL                                                                                |
| `NEXT_PUBLIC_IBL_PLATFORM`                         | Yes      | Platform type (`mentor`)                                                                             |
| `NEXT_PUBLIC_IBL_TEMPLATE_MENTOR`                  | Yes      | Default mentor template slug                                                                         |
| `NEXT_PUBLIC_STRIPE_ENABLED`                       | No       | Enable Stripe billing (`true`/`false`)                                                               |
| `NEXT_PUBLIC_IBL_ALLOW_FREE_TRIAL_BANNER`          | No       | Show free trial banner                                                                               |
| `NEXT_PUBLIC_ENABLE_ADVERTISING`                   | No       | Enable advertising features                                                                          |
| `NEXT_PUBLIC_ENABLE_RBAC`                          | No       | Enable RBAC permission checks                                                                        |
| `NEXT_PUBLIC_EXTERNAL_PRICING_PAGE_URL`            | No       | External pricing page URL                                                                            |
| `NEXT_PUBLIC_HIDE_ANALYTICS`                       | No       | Hide the analytics surface entirely                                                                  |
| `NEXT_PUBLIC_DISABLED_DATASETS`                    | No       | Pipe-separated dataset types to hide (e.g. `zip\|courses`)                                           |
| `NEXT_PUBLIC_DISABLED_ANALYTICS_REPORTS`           | No       | Pipe-separated analytics reports to hide                                                             |
| `NEXT_PUBLIC_MENTOR_TRAINING_MAXIMUM_FILE_SIZE`    | No       | Max dataset upload size in MB                                                                        |
| `NEXT_PUBLIC_SHOW_BASE_MENTOR`                     | No       | Show the base/template mentor in the picker                                                          |
| `NEXT_PUBLIC_MENTOR_SETTINGS_DISCLAIMER`           | No       | Disclaimer line shown under mentor settings                                                          |
| `NEXT_PUBLIC_ENABLE_GRAVATAR_ON_PROFILE_PIC`       | No       | Fall back to Gravatar when no profile pic                                                            |
| `NEXT_PUBLIC_DEFAULT_EMBED_CSS_URL`                | No       | CSS injected into iframe embeds                                                                      |
| `NEXT_PUBLIC_IBL_ENABLE_SPECIAL_LOGO_WHEN_IFRAMED` | No       | Swap the logo when running inside an iframe                                                          |
| `NEXT_PUBLIC_IFRAME_FROM_OLD_MENTOR`               | No       | Legacy mentor URL allowed to iframe this app                                                         |
| `NEXT_PUBLIC_HELP_CENTER_URL`                      | No       | Help center link in the UI                                                                           |
| `NEXT_PUBLIC_SUPPORT_EMAIL`                        | No       | Support email shown in dialogs                                                                       |
| `NEXT_PUBLIC_APP_BANNER_TEXT`                      | No       | Top app banner copy                                                                                  |
| `NEXT_PUBLIC_APP_BANNER_LINK`                      | No       | Banner click-through URL                                                                             |
| `NEXT_PUBLIC_APP_BANNER_LINK_TEXT`                 | No       | Banner CTA text                                                                                      |
| `NEXT_PUBLIC_APP_BANNER_BADGE`                     | No       | Small badge label next to the banner                                                                 |
| `NEXT_PUBLIC_SHOW_APP_BANNER`                      | No       | Toggle the top banner                                                                                |
| `NEXT_PUBLIC_PLATFORM_BASE_DOMAIN`                 | No       | Brand domain (defaults to `iblai.app`)                                                               |
| `NEXT_PUBLIC_BASE_PATH`                            | No       | URL base path for subdirectory deployments                                                           |
| `NEXT_IMAGE_PATTERNS`                              | No       | Comma-separated allowed image hosts                                                                  |
| `NEXT_PUBLIC_IBL_SENTRY_DSN`                       | No       | Sentry DSN for client-side error reporting                                                           |
| `SENTRY_AUTH_TOKEN`                                | No       | Sentry auth token (build-time only)                                                                  |

### Feature Flags

Feature flags are set via environment variables prefixed with `NEXT_PUBLIC_`. They control which features are visible and active in the application:

- **Stripe billing** — `NEXT_PUBLIC_STRIPE_ENABLED=true`
- **Free trial banner** — `NEXT_PUBLIC_IBL_ALLOW_FREE_TRIAL_BANNER=true`
- **Advertising** — `NEXT_PUBLIC_ENABLE_ADVERTISING=true`
- **RBAC** — `NEXT_PUBLIC_ENABLE_RBAC=true`
- **Iframe logo** — `NEXT_PUBLIC_IBL_ENABLE_SPECIAL_LOGO_WHEN_IFRAMED=true`

### Sentry

OS wires Sentry via `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts` at the repo root. Two env vars control it:

- `NEXT_PUBLIC_IBL_SENTRY_DSN` — runtime DSN for client/server error reporting. Leave empty to disable.
- `SENTRY_AUTH_TOKEN` — **build-time only**; lets `next build` upload source maps so stack traces stay readable in production. Without it the build still succeeds, just with minified frames in Sentry.

### SDK version pin

The exact `@iblai/iblai-js` version this app is tested against lives in [`.iblai-js-version`](../.iblai-js-version). The pre-push hook checks `package.json` against it; bump both when you intentionally move SDK versions, otherwise leave it alone.

---

## Tech Stack

| Layer       | Technology                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Framework   | Next.js 15, React 19, TypeScript                                                                                                 |
| Styling     | Tailwind CSS 4, Radix UI, shadcn/ui                                                                                              |
| State       | Redux Toolkit, React-Redux                                                                                                       |
| Forms       | React Hook Form, Zod                                                                                                             |
| Editor      | Tiptap (rich text), Markdown (react-markdown, remark, rehype)                                                                    |
| Voice/Video | LiveKit (WebRTC)                                                                                                                 |
| Charts      | Recharts                                                                                                                         |
| Desktop     | Tauri 2 (Rust + WebView)                                                                                                         |
| Testing     | Vitest, Testing Library, Playwright                                                                                              |
| Monitoring  | Sentry                                                                                                                           |
| SDK         | [@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) (version pinned in [`.iblai-js-version`](../.iblai-js-version)) |

---

## AGENTS.md

[`AGENTS.md`](../AGENTS.md) at the repo root documents the formatting, lint, and push-protocol rules that automated agents (Claude Code, OpenCode, etc.) follow when editing this codebase. Read it before you start contributing — it's also what the husky hooks enforce. `CLAUDE.md` is a symlink to it for tools that still look for that filename.

The skills it references live under `.claude/skills/`:

- [`.claude/skills/prettier-format.md`](../.claude/skills/prettier-format.md) — formatter rules and the pre-commit hook
- [`.claude/skills/safe-push.md`](../.claude/skills/safe-push.md) — push protocol; never bypass the pre-push hook
- [`.claude/skills/e2e-coverage.md`](../.claude/skills/e2e-coverage.md) — when `e2e/coverage.json` needs an update

---

## Built With

- [Next.js](https://nextjs.org) — App Router
- [@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) — SDK for auth, UI components, and data
- [@iblai/data-layer](https://www.npmjs.com/package/@iblai/data-layer) — RTK Query data layer
- [@iblai/web-containers](https://www.npmjs.com/package/@iblai/web-containers) — framework-agnostic SDK components
- [LiveKit](https://livekit.io) — WebRTC transport for real-time voice and video sessions
- [Tailwind CSS](https://tailwindcss.com) — utility-first styling with ibl.ai design tokens
- [shadcn/ui](https://ui.shadcn.com) — accessible UI primitives
- [Tauri 2](https://tauri.app) — desktop and mobile shell (Rust + WebView)
- [Sentry](https://sentry.io) — error monitoring and source maps
- [iblai.app](https://iblai.app) — production backend for auth, AI agents, billing, and analytics
