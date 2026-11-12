#!/usr/bin/env node
/**
 * Minimal static server for the second-origin embed test harness.
 *
 * Serves exactly one static HTML page on `127.0.0.1:4599` — a different
 * origin from the mentor app (`MENTOR_NEXTJS_HOST`, typically
 * `localhost:3005`) — that iframes a URL passed via `?src=<url>`. This lets
 * embed specs exercise a REAL cross-origin iframe embed (the shape a
 * customer's website actually presents) instead of only same-origin
 * `?embed=true` navigation.
 *
 * Built for issue #2586 (SDK Chat migration, Stage 1 Tier 1) to un-skip the
 * EMBED_URL-gated tests in journey 13 when no external EMBED_URL is
 * configured. Kept deliberately generic (arbitrary `?src=`, no app-specific
 * assumptions) so issue #2590's origin-allowlist security work can reuse it
 * unchanged — e.g. to assert behavior when the EMBEDDING origin is NOT on an
 * allowlist, by pointing `?src=` at the same mentor app from a still
 * different disallowed origin.
 *
 * Usage: registered as a Playwright `webServer` entry in
 * `e2e/playwright.config.ts` (`node e2e/utils/embed-harness-server.mjs`).
 * Not gated on `MENTOR_NEXTJS_HOST` — it always starts, independent of
 * whether the app itself is dev-served or already running.
 *
 * `/real-snippet` (issue #2586, journey 82): a SECOND, generic page shape —
 * a fake "customer page" that has the REAL generated embed snippet (the
 * literal `<script>` block `getEmbedCode()` produces, injecting its own
 * floating-bubble launcher + iframe) dropped verbatim into its body, instead
 * of a synthetic `<iframe src>`. This is the actual shape a customer site
 * presents (self-injecting widget script, not a bare iframe), so it is kept
 * as a parallel, opt-in code path rather than folded into the `?src=`
 * handler above — `?src=` behaviour is untouched. The snippet text itself
 * can be large and contain characters unsafe for a query string, so it is
 * POSTed once and served back by an id rather than passed inline:
 *   1. `POST /real-snippet` with JSON `{ snippet: string }` -> `{ id }`
 *   2. `GET /real-snippet?id=<id>` -> a full HTML host page with that
 *      snippet injected into the body, alongside a decoy page composer
 *      (`#customer-page-composer`) so specs can assert the launcher never
 *      overlaps real page content.
 * Generic by design (arbitrary snippet text, no mentor-app assumptions) so
 * issue #2590's origin-allowlist work can reuse it unchanged.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.EMBED_HARNESS_PORT) || 4599;
const HOST = '127.0.0.1';

const HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>E2E Embed Harness</title>
  </head>
  <body style="margin:0">
    <script>
      var params = new URLSearchParams(window.location.search);
      var src = params.get('src');
      if (src) {
        var iframe = document.createElement('iframe');
        iframe.id = 'embed-harness-iframe';
        iframe.src = src;
        iframe.style.cssText = 'width:100vw;height:100vh;border:0;display:block';
        iframe.setAttribute('allow', 'clipboard-write; microphone; camera');
        document.body.appendChild(iframe);
      } else {
        document.body.textContent = 'embed harness: pass ?src=<url> to iframe a page';
      }
    </script>
  </body>
</html>`;

/**
 * `/agent-ai` (issue #2680): a customer page that loads the VENDORED
 * `<agent-ai>` web component bundle (`@iblai/agent-ai`, shipped inside the
 * Chrome extension) and renders its launcher against the app under test.
 * Query params become the element's attributes: `mentorurl`, `tenant`,
 * `mentor`; `authrelyonhost=1` makes the element take its session from the
 * host page's localStorage instead of redirecting to the login page. The bundle is served from `/vendor/agent-ai.umd.js`, read
 * from `e2e/fixtures/agent-ai.umd.js` (a byte-identical copy of the extension's
 * vendored file, pinned by `scripts/agent-ai-vendor-copy.test.ts`), because the
 * CI e2e image carries no `extensions/` folder.
 */
export const AGENT_AI_BUNDLE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/agent-ai.umd.js',
);

function agentAiPageHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Customer Page (agent-ai launcher)</title>
  </head>
  <body style="margin:0;font-family:sans-serif">
    <main style="padding:24px"><h1>Acme Customer Site</h1></main>
    <script src="/vendor/agent-ai.umd.js"></script>
    <script>
      var params = new URLSearchParams(window.location.search);
      var el = document.createElement('agent-ai');
      el.style.cssText = 'display:block;width:100vw;height:80vh';
      ['mentorurl', 'tenant', 'mentor'].forEach(function (k) {
        if (params.get(k)) el.setAttribute(k, params.get(k));
      });
      if (params.get('authrelyonhost')) el.setAttribute('authrelyonhost', '');
      if (params.get('enablecowork')) el.setAttribute('enablecowork', '');
      document.body.appendChild(el);
    </script>
  </body>
</html>`;
}

/** In-memory store for POSTed real-snippet payloads. Never persisted. */
const snippetStore = new Map();

function realSnippetPageHtml(snippet) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Customer Page (real embed snippet)</title>
  </head>
  <body style="margin:0;font-family:sans-serif">
    <main style="padding:24px;max-width:760px">
      <h1>Acme Customer Site</h1>
      <p>This page simulates a real customer website that pasted the ibl.ai
      embed snippet into its own HTML. The snippet below injects its own
      floating launcher bubble and (on first click) its chat iframe.</p>
      <!-- A decoy composer, like a real page's own content, to prove the
           launcher bubble never overlaps genuine page UI. -->
      <textarea
        id="customer-page-composer"
        placeholder="This textarea belongs to the HOST page, not the chat"
        style="position:fixed;left:16px;bottom:16px;width:260px;height:60px"
      ></textarea>
    </main>
    ${snippet ?? ''}
  </body>
</html>`;
}

export function startEmbedHarnessServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    if (url.pathname === '/real-snippet' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        let snippet = '';
        try {
          snippet = JSON.parse(body)?.snippet ?? '';
        } catch {
          // Malformed body — fall through with an empty snippet; the GET
          // side will render the "missing snippet" placeholder.
        }
        const id = `s${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
        snippetStore.set(id, snippet);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id }));
      });
      return;
    }

    if (url.pathname === '/real-snippet' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      const snippet = id ? snippetStore.get(id) : undefined;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        realSnippetPageHtml(
          snippet ??
            '<p data-testid="real-snippet-missing">No snippet registered for this id.</p>',
        ),
      );
      return;
    }

    if (url.pathname === '/vendor/agent-ai.umd.js') {
      if (!fs.existsSync(AGENT_AI_BUNDLE)) {
        res.writeHead(404);
        res.end('agent-ai bundle not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      res.end(fs.readFileSync(AGENT_AI_BUNDLE));
      return;
    }

    if (url.pathname === '/agent-ai') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(agentAiPageHtml());
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  });
  return new Promise((resolve) => {
    server.listen(PORT, HOST, () => resolve(server));
  });
}

// The `postRealSnippetUrl` client helper used to live here, but this file is
// unambiguously ESM (the `.mjs` extension) and is only ever meant to be run
// directly by Node as the Playwright `webServer` process — `.spec.ts` files
// compile to CommonJS, and `require()`-ing an `.mjs` module throws
// ("exports is not defined in ES module scope"). The helper now lives in
// `embed-harness-client.ts` instead; import it from there.

// Allow running directly (`node embed-harness-server.mjs`), which is how
// Playwright's `webServer.command` invokes it.
if (import.meta.url === `file://${process.argv[1]}`) {
  startEmbedHarnessServer().then(() => {
    // eslint-disable-next-line no-console
    console.log(`[embed-harness] listening on http://${HOST}:${PORT}`);
  });
}
