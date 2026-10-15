import type { APIRequestContext } from '@playwright/test';

/**
 * Client-side helper for the embed harness's `/real-snippet` store (see
 * `embed-harness-server.mjs`'s doc comment): POSTs `snippet` — the literal
 * output of the OS's `getEmbedCode()` — and returns the full GET url for the
 * fake "customer page" that serves it back with the snippet injected
 * verbatim into its body.
 *
 * Kept in a separate `.ts` module rather than on the server file itself:
 * `embed-harness-server.mjs` is unambiguously ESM (its extension forces
 * that) and is only ever run directly by Node as the Playwright `webServer`
 * process. `.spec.ts` files compile to CommonJS, and `require()`-ing an
 * `.mjs` module throws ("exports is not defined in ES module scope") — this
 * plain `.ts` helper avoids that mismatch while still talking to the same
 * running server. Shared by journeys 13 and 82 so both exercise the exact
 * same wire protocol instead of re-implementing the POST/GET dance twice.
 */
export async function postRealSnippetUrl(
  request: APIRequestContext,
  baseUrl: string,
  snippet: string,
): Promise<string> {
  const response = await request.post(`${baseUrl}/real-snippet`, {
    data: { snippet },
  });
  const { id } = (await response.json()) as { id: string };
  return `${baseUrl}/real-snippet?id=${id}`;
}

/**
 * Rewrites the app origin baked into a generated embed snippet
 * (`getEmbedCode()`'s `iframe.src = '<origin>/platform/...'` line) to
 * `targetOrigin`.
 *
 * `getEmbedCode()` builds that URL from `config.mentorIframeUrl()`
 * (`components/modals/edit-mentor-modal/utils.ts`'s `getUrl`), a value
 * resolved at BUILD time, not from the request the Edit Agent dialog is
 * currently served from. In this environment that bakes in
 * `http://localhost:3000` — an unrelated app on this machine — while the
 * build actually under test is served at `MENTOR_NEXTJS_HOST`
 * (`http://localhost:3005`). A real customer deploy doesn't hit this
 * (its build's baked origin IS its real app origin), so this is a
 * test-environment-only rewrite, never an app fix: without it, every
 * real-snippet test's iframe 404s/connection-refuses against the wrong
 * port. Confirmed via a one-off debug run: `page.on('requestfailed')`
 * reported `http://localhost:3000/platform/...` `net::ERR_CONNECTION_REFUSED`.
 *
 * Only the snippet's own baked origin is replaced — not a blind
 * `localhost:3000` string replace — so this keeps working if the baked
 * port/host ever changes.
 */
export function rewriteSnippetOrigin(
  snippet: string,
  targetOrigin: string,
): { rewritten: string; originalOrigin: string | null } {
  const match = snippet.match(/iframe\.src\s*=\s*'(https?:\/\/[^/']+)/);
  const originalOrigin = match?.[1] ?? null;
  if (!originalOrigin) {
    return { rewritten: snippet, originalOrigin: null };
  }
  return {
    rewritten: snippet.split(originalOrigin).join(targetOrigin),
    originalOrigin,
  };
}
