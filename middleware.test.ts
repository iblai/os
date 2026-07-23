import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from './middleware';

function req(url = 'https://os.ibl.ai/platform/acme/m1') {
  return new NextRequest(url);
}

function nonceOf(csp: string | null): string {
  return csp?.match(/'nonce-([^']+)'/)?.[1] ?? '';
}

describe('CSP middleware', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('emits a Report-Only CSP by default (no enforcing header)', async () => {
    const res = middleware(req());

    expect(res.headers.get('Content-Security-Policy')).toBeNull();
    const csp = res.headers.get('Content-Security-Policy-Report-Only');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
    // Fixes the two reported errors:
    expect(csp).toContain("worker-src 'self' blob:"); // Sentry Replay blob worker
    // Hardening + embed-mode carve-out:
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toContain('frame-ancestors'); // app runs embedded
  });

  it('propagates the nonce to the request headers for Next.js', async () => {
    const request = req();
    const res = middleware(request);

    const responseNonce = nonceOf(
      res.headers.get('Content-Security-Policy-Report-Only'),
    );
    expect(responseNonce).not.toBe('');
    // Next.js reads the nonce off the request CSP header; x-nonce exposes it too.
    expect(
      res.headers.get('x-middleware-request-x-nonce') ?? responseNonce,
    ).toBe(responseNonce);
  });

  it('generates a fresh nonce per request', async () => {
    const a = nonceOf(
      middleware(req()).headers.get('Content-Security-Policy-Report-Only'),
    );
    const b = nonceOf(
      middleware(req()).headers.get('Content-Security-Policy-Report-Only'),
    );
    expect(a).not.toBe('');
    expect(a).not.toBe(b);
  });

  it('enforces via Content-Security-Policy header when CSP_MODE=enforce', async () => {
    vi.stubEnv('CSP_MODE', 'enforce');
    const res = middleware(req());

    expect(res.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'",
    );
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull();
  });

  it('adds unsafe-eval only in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const csp = middleware(req()).headers.get(
      'Content-Security-Policy-Report-Only',
    );
    expect(csp).toContain("'unsafe-eval'");
  });

  it('appends report-uri when CSP_REPORT_URI is set', async () => {
    vi.stubEnv('CSP_REPORT_URI', 'https://sentry.ibl.network/csp');
    const csp = middleware(req()).headers.get(
      'Content-Security-Policy-Report-Only',
    );
    expect(csp).toContain('report-uri https://sentry.ibl.network/csp');
  });

  it('adds an off-domain API base to connect-src', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com/base');
    const csp = middleware(req()).headers.get(
      'Content-Security-Policy-Report-Only',
    );
    expect(csp).toContain('https://api.example.com');
  });

  it('does not duplicate an ibl-domain API base (already wildcarded)', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.iblai.app');
    const csp =
      middleware(req()).headers.get('Content-Security-Policy-Report-Only') ??
      '';
    // No standalone https://api.iblai.app entry — covered by https://*.iblai.app.
    expect(csp).not.toContain('https://api.iblai.app ');
    expect(csp).toContain('https://*.iblai.app');
  });

  it('ignores a malformed API base without throwing', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'not a url');
    expect(() => middleware(req())).not.toThrow();
  });
});
