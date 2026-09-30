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
 */
import http from 'node:http';

const PORT = 4599;
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

export function startEmbedHarnessServer() {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  });
  return new Promise((resolve) => {
    server.listen(PORT, HOST, () => resolve(server));
  });
}

// Allow running directly (`node embed-harness-server.mjs`), which is how
// Playwright's `webServer.command` invokes it.
if (import.meta.url === `file://${process.argv[1]}`) {
  startEmbedHarnessServer().then(() => {
    // eslint-disable-next-line no-console
    console.log(`[embed-harness] listening on http://${HOST}:${PORT}`);
  });
}
