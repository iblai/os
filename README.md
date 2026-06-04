<div align="center">

<a href="https://ibl.ai"><img src="https://ibl.ai/images/iblai-logo.png" alt="ibl.ai" width="300"></a>

# OS

**The open-source AI agent platform.**

Build, deploy, and manage intelligent conversational agents — from prototype to production — in minutes.

[![Website](https://img.shields.io/badge/Website-ibl.ai-blue)](https://ibl.ai)
[![Docs](https://img.shields.io/badge/Docs-docs.ibl.ai-green)](https://docs.ibl.ai)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow)](LICENSE)
[![Desktop & Mobile](https://img.shields.io/badge/Desktop_%26_Mobile-supported-blue)](https://github.com/iblai/vibe/blob/main/skills/iblai-ops-build/SKILL.md)

[Features](#features) · [Quick Start](#quick-start) · [Deployment](#deployment) · [Enterprise](#enterprise) · [Contributing](#contributing)

</div>

---

## Features

- **AI Agents** — Create custom agents with configurable LLMs, system prompts, tools, and safety filters
- **RAG Training** — Upload documents, connect Google Drive, OneDrive, Dropbox, or crawl websites to ground agents in your data
- **Voice Calls** — Real-time WebRTC voice chat powered by LiveKit
- **Deep Research** — Extended multi-step reasoning for complex queries
- **Canvas / Artifacts** — Generate, edit, and version rich documents alongside chat
- **Screen Sharing** — Share your screen directly inside a chat session
- **Web Search** — Ground responses with live web results
- **MCP Servers** — Extend agent capabilities with Model Context Protocol tool servers
- **Analytics** — Usage dashboards, topic analysis, transcript viewer, and financial reporting
- **Projects** — Collaborative workspaces to group agents with shared context and goals
- **Cross-Platform** — Ships as web, desktop (macOS, Windows, Linux), and mobile (iOS, Android) via Tauri 2

---

## Available On

<div align="center">

| Platform    | Status                                                                     |
| ----------- | -------------------------------------------------------------------------- |
| **Web**     | Production at [os.ibl.ai](https://os.ibl.ai) — works on any modern browser |
| **macOS**   | Native desktop app via Tauri 2 — lightweight, fast, system-integrated      |
| **iOS**     | Native mobile app — available on iPhone and iPad                           |
| **Android** | Native mobile app — available on phones and tablets                        |
| **Windows** | Native desktop app via Tauri 2                                             |
| **Linux**   | Native desktop app via Tauri 2                                             |

</div>

One codebase, six platforms. OS runs natively everywhere your users are — no Electron bloat, no compromises. The desktop and mobile apps are built with [Tauri 2](https://tauri.app), delivering near-native performance with a fraction of the resource footprint.

---

## Quick Start

```bash
git clone https://github.com/iblai/os.git
cd os
pnpm install
cp .env.example .env.local   # configure your ibl.ai credentials
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). See the full [Development Guide](docs/development.md) for environment variables, scripts, and architecture details.

---

## Deployment

### Docker

```bash
docker build -t os .
docker run -p 5000:5000 --env-file .env.local os
```

### Standalone

```bash
pnpm build
PORT=3000 node server-wrapper.js
```

### Desktop & Mobile

```bash
pnpm tauri:build                              # macOS, Windows, Linux
cargo tauri ios build --export-method app-store-connect   # iOS
cargo tauri android build                     # Android
```

Full deployment docs: [Docker & Standalone](docs/standalone-deployment.md) · [Tauri iOS](docs/tauri-ios-setup.md)

---

## Enterprise

- **Multi-tenancy** — Full tenant isolation with per-org configuration, branding, and user management
- **SSO** — Single Sign-On with configurable identity providers (OAuth, OIDC, SAML)
- **RBAC** — Granular role-based access control with policies and group-based permissions
- **Stripe Billing** — Subscription management, free trials, and usage-based pricing
- **Embed Mode** — Embed agents in any website via iframe with custom styling
- **Custom Domains** — Host agents on your own domain
- **API Keys** — Programmatic access for integrations and automation
- **Whitelabeling** — Custom branding, logos, and disclaimers

---

## ibl.ai Platform

OS is the open-source frontend for the [ibl.ai](https://ibl.ai) platform, which provides the backend infrastructure:

- **AI Mentor API** — LLM orchestration, RAG pipeline, tool use, and chat management
- **Authentication** — SSO, OAuth, JWT-based auth with multi-tenant support
- **Data Platform** — Analytics, billing, user management, and notification services
- **LiveKit** — Voice and video call infrastructure

Visit [ibl.ai](https://ibl.ai) to set up your backend or request a hosted instance.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. If you'll be working with AI-assisted tooling, read [AGENTS.md](AGENTS.md) first — it documents the formatting, lint, and push protocol rules that the husky hooks enforce.

---

## Resources

- [Documentation](https://docs.ibl.ai)
- [Development Guide](docs/development.md) — setup, scripts, architecture, configuration
- [iblai-app-cli](https://github.com/iblai/iblai-app-cli) — CLI for scaffolding ibl.ai apps
- [@iblai/mcp](https://www.npmjs.com/package/@iblai/mcp) — MCP server for AI-assisted development
- [Vibe](https://github.com/iblai/vibe) — developer toolkit for building with ibl.ai
- [Vibe Starter](https://github.com/iblai/vibe-starter) — pre-wired Next.js + ibl.ai SSO template

---

## License

ISC License. See [LICENSE](LICENSE) for details.
