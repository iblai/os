import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import type { RemotePattern } from 'next/dist/shared/lib/image-config';

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
const assetPrefix = basePath ? `${basePath}/` : '';

const nextConfig: NextConfig = {
  output: 'standalone', // <- this generates .next/standalone
  basePath,
  assetPrefix,
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
  productionBrowserSourceMaps: true,
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
  widenClientFileUpload: true,
hideSourceMaps: false,
  disableLogger: true,
  automaticVercelMonitors: false,
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
