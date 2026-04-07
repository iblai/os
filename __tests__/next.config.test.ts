import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  withSentryConfig: vi.fn((config) => config),
}));

describe('next.config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('should export standalone output configuration', async () => {
    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.output).toBe('standalone');
  });

  it('should use default basePath when NEXT_PUBLIC_BASE_PATH is not set', async () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;

    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.basePath).toBe('');
  });

  it('should use custom basePath when NEXT_PUBLIC_BASE_PATH is set', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/custom-path';

    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.basePath).toBe('/custom-path');
  });

  it('should set assetPrefix based on basePath', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/custom-path';

    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.assetPrefix).toBe('/custom-path/');
  });

  it('should set trailingSlash to true when basePath is set', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/custom-path';

    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.trailingSlash).toBe(true);
  });

  it('should set trailingSlash to false when basePath is empty', async () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;

    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.trailingSlash).toBe(false);
  });

  it('should ignore TypeScript errors in build', async () => {
    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.typescript?.ignoreBuildErrors).toBe(true);
  });

  it('should ignore ESLint errors during builds', async () => {
    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.eslint?.ignoreDuringBuilds).toBe(true);
  });

  it('should configure serverExternalPackages', async () => {
    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.serverExternalPackages).toContain('@sentry/node');
    expect(config.serverExternalPackages).toContain(
      '@opentelemetry/instrumentation',
    );
  });

  it('should enable production browser source maps', async () => {
    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.productionBrowserSourceMaps).toBe(true);
  });

  it('should transpile required packages', async () => {
    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.transpilePackages).toContain('@iblai/web-utils');
    expect(config.transpilePackages).toContain('@iblai/data-layer');
    expect(config.transpilePackages).toContain('@iblai/web-containers');
  });

  it('should parse NEXT_IMAGE_PATTERNS environment variable', async () => {
    process.env.NEXT_IMAGE_PATTERNS =
      'https://example.com,https://test.amazonaws.com,invalid-url';

    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.images?.remotePatterns).toBeDefined();
    expect(config.images?.remotePatterns?.length).toBeGreaterThan(0);

    // Should warn about invalid URL
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid URL in NEXT_IMAGE_PATTERNS'),
    );

    consoleWarnSpy.mockRestore();
  });

  it('should use default image patterns when NEXT_IMAGE_PATTERNS is not set', async () => {
    delete process.env.NEXT_IMAGE_PATTERNS;

    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.images?.remotePatterns).toBeDefined();
    expect(config.images?.remotePatterns?.length).toBeGreaterThan(0);

    // Check for default patterns
    const hasDefaultPattern = config.images?.remotePatterns?.some(
      (pattern) =>
        pattern.hostname === 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
    );
    expect(hasDefaultPattern).toBe(true);
  });

  it('should configure webpack with polling when USE_POLLING is true', async () => {
    process.env.USE_POLLING = 'true';

    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.webpack).toBeDefined();

    if (config.webpack) {
      const webpackConfig = { watchOptions: {} };
      const result = config.webpack(webpackConfig, { dev: true } as any);

      expect(result.watchOptions).toEqual({
        poll: 1000,
        aggregateTimeout: 300,
      });
    }
  });

  it('should not configure polling when USE_POLLING is false', async () => {
    process.env.USE_POLLING = 'false';

    vi.resetModules();
    const config = (await import('../next.config')).default;

    if (config.webpack) {
      const webpackConfig = { watchOptions: {} };
      const result = config.webpack(webpackConfig, { dev: true } as any);

      expect(result.watchOptions).not.toEqual({
        poll: 1000,
        aggregateTimeout: 300,
      });
    }
  });

  it('should not configure polling in production', async () => {
    process.env.USE_POLLING = 'true';

    vi.resetModules();
    const config = (await import('../next.config')).default;

    if (config.webpack) {
      const webpackConfig = { watchOptions: {} };
      const result = config.webpack(webpackConfig, { dev: false } as any);

      // Should not set polling in production
      expect(result).toBe(webpackConfig);
    }
  });

  it('should return cache-control headers for HTML pages', async () => {
    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.headers).toBeDefined();
    const headers = await config.headers!();
    expect(headers).toEqual([
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ]);
  });

  it('should configure turbopack rules', async () => {
    vi.resetModules();
    const config = (await import('../next.config')).default;

    expect(config.turbopack?.rules).toBeDefined();
    expect(config.turbopack?.rules?.['*.svg']).toEqual(['@svgr/webpack']);
  });

  it('should parse URL patterns correctly', async () => {
    process.env.NEXT_IMAGE_PATTERNS =
      'https://example.com:8080/path,https://test.amazonaws.com';

    vi.resetModules();
    const config = (await import('../next.config')).default;

    const patterns = config.images?.remotePatterns;
    expect(patterns).toBeDefined();

    // Check that protocol is parsed correctly (without colon)
    const examplePattern = patterns?.find((p) => p.hostname === 'example.com');
    expect(examplePattern?.protocol).toBe('https');

    const testPattern = patterns?.find(
      (p) => p.hostname === 'test.amazonaws.com',
    );
    expect(testPattern?.protocol).toBe('https');
  });

  it('should filter out null patterns from invalid URLs', async () => {
    process.env.NEXT_IMAGE_PATTERNS =
      'https://valid.com,not-a-url,https://also-valid.com';

    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    vi.resetModules();
    const config = (await import('../next.config')).default;

    const patterns = config.images?.remotePatterns || [];

    // Should only have valid patterns
    const hasValid1 = patterns.some((p) => p.hostname === 'valid.com');
    const hasValid2 = patterns.some((p) => p.hostname === 'also-valid.com');
    const hasInvalid = patterns.some((p) => p.hostname === 'not-a-url');

    expect(hasValid1).toBe(true);
    expect(hasValid2).toBe(true);
    expect(hasInvalid).toBe(false);

    consoleWarnSpy.mockRestore();
  });
});
