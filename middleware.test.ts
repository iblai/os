import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from './middleware';

function req(url = 'https://os.ibl.ai/platform/acme/m1') {
  return new NextRequest(url);
}

function nonceOf(csp: string | null): string {
  return csp?.match(/'nonce-([^']+)'/)?.[1] ?? '';
}

// Whichever CSP header is active for the current mode.
function cspOf(res: { headers: Headers }): string | null {
  return (
    res.headers.get('Content-Security-Policy') ??
    res.headers.get('Content-Security-Policy-Report-Only')
  );
}

describe('CSP middleware', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('enforces via Content-Security-Policy by default', () => {
    const res = middleware(req());

    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull();
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
    // Fixes the two originally-reported errors:
    expect(csp).toContain("worker-src 'self' blob:"); // Sentry Replay blob worker
    // Hardening + embed-mode carve-out:
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain('upgrade-insecure-requests'); // meaningful when enforcing
    expect(csp).not.toContain("'unsafe-eval'"); // never allowed when enforcing
    expect(csp).not.toContain('frame-ancestors'); // app runs embedded
  });

  it('allows the asset CDN origin in style/font/connect when NEXT_PUBLIC_ASSET_CDN is set', () => {
    // Static served cross-origin from the CDN (assets.ibl.ai). Accepts a bare
    // host — assetCdnOrigin() normalizes it to https:// like next.config.ts.
    vi.stubEnv('NEXT_PUBLIC_ASSET_CDN', 'assets.ibl.ai');
    const csp = cspOf(middleware(req()))!;
    // The gap https:/strict-dynamic don't cover: cross-origin CSS + fonts.
    expect(csp).toMatch(/style-src [^;]*https:\/\/assets\.ibl\.ai/);
    expect(csp).toMatch(/font-src [^;]*https:\/\/assets\.ibl\.ai/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/assets\.ibl\.ai/);
  });

  it('accepts a full URL for NEXT_PUBLIC_ASSET_CDN, not just a bare host', () => {
    vi.stubEnv('NEXT_PUBLIC_ASSET_CDN', 'https://cdn.example.com/base');
    const csp = cspOf(middleware(req())) ?? '';
    expect(csp).toMatch(/font-src [^;]*https:\/\/cdn\.example\.com/);
  });

  it('CSP_PARTNER_HOSTS REPLACES the default partner hosts', () => {
    vi.stubEnv('CSP_PARTNER_HOSTS', 'https://lms.example.edu');
    const csp = cspOf(middleware(req())) ?? '';
    expect(csp).toMatch(/connect-src [^;]*https:\/\/lms\.example\.edu/);
    // Each https:// partner also gets its wss:// twin for ASGI.
    expect(csp).toMatch(/connect-src [^;]*wss:\/\/lms\.example\.edu/);
    // Overriding drops the Syracuse default rather than appending to it.
    expect(csp).not.toContain('syr.edu');
  });

  it('ignores a malformed asset CDN without throwing', () => {
    vi.stubEnv('NEXT_PUBLIC_ASSET_CDN', 'not a cdn');
    expect(() => middleware(req())).not.toThrow();
    expect(cspOf(middleware(req()))).not.toContain('not a cdn');
  });

  it('omits the asset CDN origin from CSP when NEXT_PUBLIC_ASSET_CDN is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_ASSET_CDN', '');
    expect(cspOf(middleware(req()))).not.toContain('assets.ibl.ai');
  });

  it('does NOT key off NODE_ENV (a dev-built image still enforces)', () => {
    // Regression guard: Next inlines NODE_ENV into middleware at build time, so
    // an image built with NODE_ENV=development must not silently report-only.
    vi.stubEnv('NODE_ENV', 'development');
    const res = middleware(req());

    expect(res.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'",
    );
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull();
  });

  it('CSP_MODE=report-only downgrades to report-only (with unsafe-eval, no upgrade)', () => {
    vi.stubEnv('CSP_MODE', 'report-only');
    const res = middleware(req());

    expect(res.headers.get('Content-Security-Policy')).toBeNull();
    const csp = res.headers.get('Content-Security-Policy-Report-Only');
    expect(csp).toBeTruthy();
    expect(csp).toContain("'unsafe-eval'"); // allowed for `next dev` React Refresh
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('CSP_MODE=enforce enforces explicitly', () => {
    vi.stubEnv('CSP_MODE', 'enforce');
    const res = middleware(req());

    expect(res.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'",
    );
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull();
  });

  it('fails safe to report-only when CSP_MODE is set but unrecognized', () => {
    vi.stubEnv('CSP_MODE', 'enforced'); // typo — must not surprise-enforce
    const res = middleware(req());

    expect(res.headers.get('Content-Security-Policy')).toBeNull();
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeTruthy();
  });

  it('propagates the nonce to the request headers for Next.js', () => {
    const request = req();
    const res = middleware(request);

    const responseNonce = nonceOf(cspOf(res));
    expect(responseNonce).not.toBe('');
    // Next.js reads the nonce off the request CSP header; x-nonce exposes it too.
    expect(
      res.headers.get('x-middleware-request-x-nonce') ?? responseNonce,
    ).toBe(responseNonce);
  });

  it('generates a fresh nonce per request', () => {
    const a = nonceOf(cspOf(middleware(req())));
    const b = nonceOf(cspOf(middleware(req())));
    expect(a).not.toBe('');
    expect(a).not.toBe(b);
  });

  it('appends report-uri when CSP_REPORT_URI is set', () => {
    vi.stubEnv('CSP_REPORT_URI', 'https://sentry.ibl.network/csp');
    expect(cspOf(middleware(req()))).toContain(
      'report-uri https://sentry.ibl.network/csp',
    );
  });

  it('adds an off-domain API base to connect-src', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com/base');
    expect(cspOf(middleware(req()))).toContain('https://api.example.com');
  });

  it('allows S3 presigned media hosts in connect-src (chat file uploads)', () => {
    const csp = cspOf(middleware(req())) ?? '';
    const connectSrc = csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('connect-src '));
    // <bucket>.s3.amazonaws.com must match the wildcard so uploads/downloads
    // to iblai-app-dm-media etc. are not blocked.
    expect(connectSrc).toContain('https://*.s3.amazonaws.com');
  });

  // Without these the on-device TTS weights are blocked and the voice fails
  // with nothing in the UI to explain it.
  it('allows the Kokoro weight host and its redirect CDN in connect-src', () => {
    const csp = cspOf(middleware(req())) ?? '';
    const connectSrc = csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('connect-src '));

    expect(connectSrc).toContain('https://huggingface.co');
    // huggingface.co 302s the weight file to a regional CDN, and connect-src
    // is re-checked on the redirect target.
    expect(connectSrc).toContain('https://*.hf.co');
    expect(connectSrc).toContain('https://*.huggingface.co');
  });

  it('follows a self-hosted weight host instead of Hugging Face', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST',
      'https://weights.acme.dev/models/',
    );
    // The NEXT_PUBLIC_* registry in lib/config is captured at module
    // evaluation, and middleware runs where there is no `window.__ENV__` to
    // override it -- so the build-time value only lands on a fresh import.
    vi.resetModules();
    const { middleware: fresh } = await import('./middleware');
    const csp = cspOf(fresh(req())) ?? '';

    expect(csp).toContain('https://weights.acme.dev');
    // The HF redirect CDNs are only relevant to Hugging Face, so they go away.
    expect(csp).not.toContain('hf.co');
  });

  it('allows the GitHub REST API in connect-src (dataset branch lookup)', () => {
    const csp = cspOf(middleware(req())) ?? '';
    const directive = (name: string) =>
      csp
        .split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith(`${name} `));
    // The datasets tab reads /repos/:owner/:repo/branches from the browser.
    expect(directive('connect-src')).toContain('https://api.github.com');
    // connect-src only — the API is never framed nor loaded as a script.
    expect(directive('frame-src')).not.toContain('https://api.github.com');
  });

  it('allows blob: in frame-src (binary-artifact PDF preview iframe)', () => {
    const csp = cspOf(middleware(req())) ?? '';
    const frameSrc = csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('frame-src '));
    // The binary canvas renders PDFs via <iframe src="blob:...">; without
    // blob: here the enforced CSP blocks the viewer ("This content is
    // blocked") even though exporting the same blob works.
    expect(frameSrc).toContain('blob:');
  });

  it('does not duplicate an ibl-domain API base (already wildcarded)', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.iblai.app');
    const csp = cspOf(middleware(req())) ?? '';
    // No standalone https://api.iblai.app entry — covered by https://*.iblai.app.
    expect(csp).not.toContain('https://api.iblai.app ');
    expect(csp).toContain('https://*.iblai.app');
  });

  it('ignores a malformed API base without throwing', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'not a url');
    expect(() => middleware(req())).not.toThrow();
  });
});
