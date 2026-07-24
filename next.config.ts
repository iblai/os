import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import type { RemotePattern } from 'next/dist/shared/lib/image-config';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Sourcemap generation is heavy (multi-GB) and only pays off if the maps are
// actually uploaded to Sentry — which requires SENTRY_AUTH_TOKEN at build time.
// With no token they were generated and thrown away, OOM-ing the 7GB CI runners
// (the "stuck PR builds"). Gate the Sentry sourcemap pipeline on the token.
const uploadSourcemaps = !!process.env.SENTRY_AUTH_TOKEN;

const envPatterns = process.env.NEXT_IMAGE_PATTERNS?.trim();
const rawPatterns = envPatterns
  ? envPatterns.split(',')
  : [
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com',
      'https://s3.*.amazonaws.com',
      'https://base.manager.iblai.tech',
      'https://base.manager.iblai.org',
      'https://base.manager.iblai.app',
      'https://base.manager.dev2.iblai.org',
      'https://base.manager.ai.syr.edu',
      'https://api.iblai.org',
      'https://api.iblai.app',
    ];

const remotePatterns = rawPatterns
  .map((url: string) => {
    try {
      const u = new URL(url);
      return {
        protocol: u.protocol.replace(':', ''),
        hostname: u.hostname,
      };
    } catch {
      console.warn(`⚠️ Invalid URL in NEXT_IMAGE_PATTERNS: ${url}`);
      return null;
    }
  })
  .filter(Boolean) as RemotePattern[];

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// ---------------------------------------------------------------------------
// Immutable, deployment-ID-namespaced static hosting.
//
// deploymentId = the release version (matches how images are tagged), so a
// build's assets live at a stable, human-meaningful path and rollback is just
// re-deploying the previous image tag against its retained assets.
//
// When NEXT_PUBLIC_ASSET_CDN is set (web/server build only — Tauri & offline
// exports leave it UNSET so their assets stay self-contained relative paths),
// every /_next/* asset URL is prefixed with the CDN host under
//   apps/<app>/<version>/
// so all builds' immutable assets coexist in one shared store and node build
// skew can no longer cause ChunkLoadError. Unset → existing basePath behavior,
// i.e. this change is a no-op until the CDN env is provided.
// ---------------------------------------------------------------------------
const appName = process.env.NEXT_PUBLIC_APP_NAME || 'os';
const deploymentId =
  process.env.DEPLOYMENT_ID ||
  process.env.APP_VERSION ||
  process.env.npm_package_version ||
  'dev';
const assetCdnBase = process.env.NEXT_PUBLIC_ASSET_CDN?.replace(/\/+$/, '');
const cdnAssetPrefix = assetCdnBase
  ? `${assetCdnBase}/apps/${appName}/${deploymentId}`
  : '';

const assetPrefix = cdnAssetPrefix || (basePath ? `${basePath}/` : '');

const nextConfig: NextConfig = {
  output: 'standalone', // <- this generates .next/standalone
  // Pin the file-tracing root to this project so the standalone output lands at
  // .next/standalone/server.js. Without this, a stray lockfile in a parent dir
  // (e.g. ~/package-lock.json) makes Next infer a higher workspace root and nest
  // the output under .next/standalone/<path>/, which breaks server-wrapper.js and
  // static asset serving.
  outputFileTracingRoot: process.cwd(),
  basePath,
  assetPrefix,
  // Deterministic build ID = release version. Keeps the buildId stable across
  // rebuilds of a release and lets RSC/Server-Action version checks line up
  // across a rolling fleet. (The versioned assetPrefix already isolates each
  // deployment's assets; this is belt-and-suspenders.)
  generateBuildId: async () => deploymentId,
  // Assets are cross-origin once served from the CDN — emit crossorigin on the
  // injected <script>/<link> tags so error reporting + integrity work.
  crossOrigin: 'anonymous',
  trailingSlash: !!basePath,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns,
  },
  // Prevent CDN/browser from serving stale HTML that references old chunk hashes.
  // Static assets under /_next/static/ already get immutable caching from Next.js.
  async headers() {
    return [
      {
        // HTML pages — always revalidate so chunk references are fresh
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
  serverExternalPackages: [
    'import-in-the-middle',
    'require-in-the-middle',
    '@opentelemetry/instrumentation',
    '@sentry/node',
    '@sentry/node-core',
  ],
  productionBrowserSourceMaps: false,
  turbopack: {
    rules: {
      '*.svg': ['@svgr/webpack'],
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Only use polling in Docker/container environments where file watching doesn't work
      // On macOS/local development, the default file watcher is more reliable
      const usePolling = process.env.USE_POLLING === 'true';
      if (usePolling) {
        config.watchOptions = {
          poll: 1000,
          aggregateTimeout: 300,
        };
      }
    }
    return config;
  },
  transpilePackages: [
    '@tauri-apps/api',
    '@iblai/iblai-js',
    '@iblai/web-utils',
    '@iblai/data-layer',
    '@iblai/web-containers',
  ],
};
const sentryWebpackPluginOptions = {
  silent: false,
  org: 'ibl-ai',
  project: 'mentorai-iblai-app',
  widenClientFileUpload: uploadSourcemaps,
  // Upload source maps to Sentry (requires SENTRY_AUTH_TOKEN at build time),
  // then delete the emitted .map files so they are never served publicly.
  // When there's no token, disable the whole pipeline so `next build` doesn't
  // generate multi-GB maps only to discard them (the OOM/hang root cause).
  sourcemaps: {
    disable: !uploadSourcemaps,
    deleteSourcemapsAfterUpload: true,
  },
  // Sentry SDK v10 moved these under `webpack`:
  // - `disableLogger` -> `webpack.treeshake.removeDebugLogging`
  // - `automaticVercelMonitors` -> `webpack.automaticVercelMonitors`
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: false,
  },
};

export default withSentryConfig(
  withNextIntl(nextConfig),
  sentryWebpackPluginOptions,
);
