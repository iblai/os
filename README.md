<p align="center">
  <img src="public/iblai-logo.png" alt="mentorAI" width="80" />
</p>

<h1 align="center">mentorAI</h1>

<p align="center">
  <strong>Open-source AI agent platform — build, deploy, and manage intelligent conversational agents in minutes.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#deployment">Deployment</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#contributing">Contributing</a> &bull;
  <a href="#license">License</a>
</p>

---

## What is mentorAI?

mentorAI is a production-ready AI chatbot platform that lets you create, customize, and deploy AI agents for education, customer support, enterprise knowledge management, and more. It ships as a modern web application with optional desktop and mobile builds, backed by a powerful multi-tenant API.

Whether you're a university deploying course assistants, a company building internal knowledge bots, or a developer creating the next AI-powered product — mentorAI gives you the complete stack out of the box.

---

## Features

### Chat & Conversation

- **Real-time streaming** — token-by-token message streaming with stop/regenerate controls
- **Voice calls** — built-in WebRTC voice chat powered by LiveKit
- **Screen sharing** — share your screen directly inside a chat session
- **Deep research mode** — extended reasoning for complex, multi-step queries
- **Web search** — ground responses with live web results
- **File attachments** — drag-and-drop files, images, and documents into chat
- **Canvas / Artifacts** — generate, edit, and version rich documents alongside chat
- **Shared chats** — create public shareable links to any conversation
- **Pinned messages** — pin important messages for quick reference
- **Chat history** — full session history with search, export (PDF/CSV), and pagination
- **Message rating** — thumbs up/down feedback on AI responses

### Agent Management

- **Create & customize agents** — name, avatar, system prompt, LLM provider, tools, safety filters
- **Explore page** — discover public, featured, starred, and custom agents
- **Agent categories** — organize agents by subject and type
- **Dataset training** — upload documents, connect Google Drive, OneDrive, Dropbox, or crawl websites to train agents
- **Prompt library** — save and share reusable prompt templates
- **Guided prompts** — pre-configured conversation starters for end users
- **Retrain schedules** — automated periodic retraining of agent knowledge bases
- **MCP server connections** — extend agent capabilities with Model Context Protocol tool servers

### Analytics

- **Overview dashboard** — usage stats, session counts, and average ratings
- **User analytics** — per-user activity, engagement heatmaps, and cohort trends
- **Topic analysis** — most discussed topics and keyword breakdowns
- **Transcript viewer** — searchable conversation transcripts with message-level detail
- **Financial reporting** — revenue tracking and billing analytics
- **Custom reports** — generate and download data reports

### Enterprise & Platform

- **Multi-tenancy** — full tenant isolation with per-org configuration, branding, and user management
- **Role-based access control (RBAC)** — granular permissions with roles, policies, and group-based access
- **SSO authentication** — Single Sign-On with configurable identity providers
- **Stripe billing** — subscription management, free trials, and usage-based pricing
- **Notifications** — in-app notification system with alert templates
- **Custom domains** — host agents on your own domain
- **Embed mode** — embed agents in any website via iframe
- **API keys** — create and manage API keys for programmatic access
- **User disclaimers** — configurable terms of service and advisory notices
- **Memory system** — per-learner and conversation-level memory for personalized experiences

### Projects

- **Collaborative workspaces** — group agents into project-based collections
- **Project instructions** — set project-wide context and goals
- **Agent assignment** — add/remove agents from projects dynamically

### Cross-Platform

- **Web** — responsive SPA that works on desktop and mobile browsers
- **Desktop** — native desktop app via Tauri (macOS, Windows, Linux)
- **Electron** — alternative desktop build with Electron
- **Mobile** — dedicated mobile routes with touch-optimized UI
- **Docker** — production-ready multi-stage Dockerfile

---

## Tech Stack

| Layer       | Technology                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Framework   | Next.js 15, React 19, TypeScript                                                                                 |
| Styling     | Tailwind CSS 4, Radix UI, shadcn/ui                                                                              |
| State       | Redux Toolkit, React-Redux                                                                                       |
| Forms       | React Hook Form, Zod                                                                                             |
| Editor      | Tiptap (rich text), Markdown (react-markdown, remark, rehype)                                                    |
| Voice/Video | LiveKit (WebRTC)                                                                                                 |
| Charts      | Recharts                                                                                                         |
| Desktop     | Tauri, Electron                                                                                                  |
| Testing     | Vitest, Testing Library, Playwright                                                                              |
| Monitoring  | Sentry                                                                                                           |
| SDK         | [@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) — unified data layer, components, and utilities |

---

## Quick Start

### Prerequisites

- **Node.js 25.3.0+** (we recommend using [nvm](https://github.com/nvm-sh/nvm))
- **pnpm 10+** — `npm install -g pnpm`

### 1. Clone the repository

```bash
git clone https://github.com/iblai/mentor-ai.git
cd mentor-ai
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your IBL.ai platform credentials:

```env
# Required — your IBL.ai platform URLs
NEXT_PUBLIC_AUTH_URL=https://auth.your-domain.com
NEXT_PUBLIC_LMS_URL=https://learn.your-domain.com
NEXT_PUBLIC_DM_URL=https://base.manager.your-domain.com
NEXT_PUBLIC_AXD_URL=https://base.manager.your-domain.com

# Required — your tenant key
NEXT_PUBLIC_MAIN_TENANT_KEY=main

# Required — WebSocket and voice servers
NEXT_PUBLIC_BASE_WS_URL=wss://asgi.data.your-domain.com
NEXT_PUBLIC_IBL_LIVE_KIT_SERVER_URL=wss://livekit.call.your-domain.com

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

### 4. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Node.js 25+ note:** The `dev` script already includes `--no-experimental-webstorage` to prevent conflicts with the SDK's browser storage guards. If you customize your scripts, make sure to include `NODE_OPTIONS='--no-experimental-webstorage'`.

---

## Deployment

### Docker

Build and run with Docker:

```bash
docker build -t mentor-ai .
docker run -p 5000:5000 --env-file .env.local mentor-ai
```

The Dockerfile uses a multi-stage build that produces a minimal standalone image (~67% smaller than a full Node.js image).

#### Build Arguments

| Argument                | Description                                  |
| ----------------------- | -------------------------------------------- |
| `NEXT_IMAGE_PATTERNS`   | Comma-separated allowed image hostnames      |
| `NEXT_PUBLIC_BASE_PATH` | URL base path (for subdirectory deployments) |
| `SENTRY_AUTH_TOKEN`     | Sentry auth token for source map uploads     |

### Standalone (No Docker)

```bash
pnpm build
PORT=3000 node server-wrapper.js
```

The build generates a self-contained `.next/standalone` directory with all dependencies bundled. Copy it to any server with Node.js 25+ installed.

### Desktop (Tauri)

```bash
# Development
pnpm tauri:dev

# Production build (macOS, Windows, Linux)
pnpm tauri:build
```

### Desktop (Electron)

```bash
# Development
pnpm desktop:dev

# Production build
pnpm desktop:build
```

---

## Architecture

```
mentor-ai/
├── app/                        # Next.js App Router
│   ├── platform/               # Main authenticated routes
│   │   └── [tenantKey]/        # Multi-tenant routing
│   │       └── [mentorId]/     # Per-mentor pages
│   │           ├── page.tsx    # Chat interface
│   │           ├── analytics/  # Analytics dashboard (5 sub-pages)
│   │           ├── explore/    # Mentor discovery
│   │           └── notifications/
│   ├── share/                  # Public shared chats
│   ├── sso-login/              # SSO authentication
│   ├── create-mentor/          # Mentor creation wizard
│   └── api/                    # API routes (health, monitoring)
│
├── components/                 # React components
│   ├── ui/                     # 56 shadcn/ui primitives
│   ├── chat/                   # Chat message rendering
│   ├── advanced-chat/          # Advanced chat builder + tabs
│   ├── chat-input-form/        # Input controls (voice, search, upload)
│   ├── canvas/                 # Document canvas
│   ├── modals/                 # All modal dialogs
│   │   └── edit-mentor-modal/  # Mentor settings (LLM, datasets, access, etc.)
│   ├── projects/               # Project management
│   └── welcome-chat/           # Landing/welcome screen
│
├── features/                   # Feature modules (state + logic)
│   ├── chat/                   # Chat state machine
│   ├── subscription/           # Billing & subscription
│   ├── rbac/                   # Role-based access control
│   ├── analytics/              # Analytics logic
│   └── ...                     # 17 feature modules total
│
├── hooks/                      # 66 custom React hooks
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
├── public/                     # Static assets
├── src-tauri/                  # Tauri desktop app (Rust)
└── docs/                       # Internal documentation
```

### Data Flow

```
User → React Components → Custom Hooks → Redux (RTK Query) → IBL.ai API
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

| Variable                                  | Required | Description                                |
| ----------------------------------------- | -------- | ------------------------------------------ |
| `NEXT_PUBLIC_AUTH_URL`                    | Yes      | Authentication service URL                 |
| `NEXT_PUBLIC_LMS_URL`                     | Yes      | LMS platform URL                           |
| `NEXT_PUBLIC_DM_URL`                      | Yes      | Platform manager URL                       |
| `NEXT_PUBLIC_AXD_URL`                     | Yes      | API data service URL                       |
| `NEXT_PUBLIC_MAIN_TENANT_KEY`             | Yes      | Primary tenant identifier                  |
| `NEXT_PUBLIC_BASE_WS_URL`                 | Yes      | WebSocket server URL                       |
| `NEXT_PUBLIC_IBL_LIVE_KIT_SERVER_URL`     | Yes      | LiveKit voice server URL                   |
| `NEXT_PUBLIC_MENTOR_URL`                  | Yes      | This app's public URL                      |
| `NEXT_PUBLIC_IBL_PLATFORM`                | Yes      | Platform type (`mentor`)                   |
| `NEXT_PUBLIC_IBL_TEMPLATE_MENTOR`         | Yes      | Default mentor template slug               |
| `NEXT_PUBLIC_STRIPE_ENABLED`              | No       | Enable Stripe billing (`true`/`false`)     |
| `NEXT_PUBLIC_IBL_ALLOW_FREE_TRIAL_BANNER` | No       | Show free trial banner                     |
| `NEXT_PUBLIC_ENABLE_ADVERTISING`          | No       | Enable advertising features                |
| `NEXT_PUBLIC_EXTERNAL_PRICING_PAGE_URL`   | No       | External pricing page URL                  |
| `NEXT_PUBLIC_BASE_PATH`                   | No       | URL base path for subdirectory deployments |
| `NEXT_IMAGE_PATTERNS`                     | No       | Comma-separated allowed image hosts        |
| `SENTRY_AUTH_TOKEN`                       | No       | Sentry auth token (build-time only)        |

### Feature Flags

Feature flags are set via environment variables prefixed with `NEXT_PUBLIC_`. They control which features are visible and active in the application:

- **Stripe billing** — `NEXT_PUBLIC_STRIPE_ENABLED=true`
- **Free trial banner** — `NEXT_PUBLIC_IBL_ALLOW_FREE_TRIAL_BANNER=true`
- **Advertising** — `NEXT_PUBLIC_ENABLE_ADVERTISING=true`
- **Iframe logo** — `NEXT_PUBLIC_IBL_ENABLE_SPECIAL_LOGO_WHEN_IFRAMED=true`

---

## Scripts

| Script               | Description                          |
| -------------------- | ------------------------------------ |
| `pnpm dev`           | Start development server (port 3000) |
| `pnpm build`         | Production build (standalone output) |
| `pnpm start`         | Start production server              |
| `pnpm lint`          | Run ESLint with auto-fix             |
| `pnpm typecheck`     | TypeScript type checking             |
| `pnpm format`        | Format code with Prettier            |
| `pnpm test`          | Run unit tests (Vitest)              |
| `pnpm test:watch`    | Run tests in watch mode              |
| `pnpm test:coverage` | Generate test coverage report        |
| `pnpm tauri:dev`     | Start Tauri desktop dev mode         |
| `pnpm tauri:build`   | Build Tauri desktop app              |
| `pnpm desktop:dev`   | Start Electron desktop dev mode      |
| `pnpm desktop:build` | Build Electron desktop app           |

---

## IBL.ai Platform

mentorAI is built on the [IBL.ai](https://ibl.ai) platform. To use this app, you need access to an IBL.ai backend instance which provides:

- **AI Mentor API** — LLM orchestration, RAG pipeline, tool use, and chat management
- **Authentication** — SSO, OAuth, JWT-based auth with multi-tenant support
- **Data Platform** — Analytics, billing, user management, and notification services
- **LiveKit** — Voice and video call infrastructure

Visit [ibl.ai](https://ibl.ai) to set up your backend or request a hosted instance.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

---

## License

ISC License. See [LICENSE](LICENSE) for details.
