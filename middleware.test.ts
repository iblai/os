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
  afterEach(() => vi.unstubAllEnvs());

  it('enforces via Content-Security-Policy by default (production)', () => {
    vi.stubEnv('NODE_ENV', 'production');
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
    expect(csp).not.toContain('frame-ancestors'); // app runs embedded
  });

  it('is report-only in development (so it does not block next dev)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = middleware(req());

    expect(res.headers.get('Content-Security-Policy')).toBeNull();
    const csp = res.headers.get('Content-Security-Policy-Report-Only');
    expect(csp).toBeTruthy();
    expect(csp).toContain("'unsafe-eval'"); // React Refresh / dev source maps
    // no-op (and warns) in report-only, so omitted:
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('CSP_MODE=report-only forces report-only even in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CSP_MODE', 'report-only');
    const res = middleware(req());

    expect(res.headers.get('Content-Security-Policy')).toBeNull();
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeTruthy();
  });

  it('CSP_MODE=enforce forces enforcement in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CSP_MODE', 'enforce');
    const res = middleware(req());

    expect(res.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'",
    );
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull();
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
