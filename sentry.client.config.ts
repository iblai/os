import * as Sentry from '@sentry/nextjs';
import { getEnv } from './lib/config';

Sentry.init({
  dsn: getEnv(
    'NEXT_PUBLIC_IBL_SENTRY_DSN',
    'https://f953ef66c4e0d5bda480069132dc9aee@sentry.ibl.network/33',
  ),
  integrations: [
    Sentry.captureConsoleIntegration({ levels: ['error'] }),
    Sentry.replayIntegration({
      // Mask all text and block all media by default for privacy
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 1.0,
  normalizeDepth: 3,
  environment: process.env.NODE_ENV,

  // Session Replay configuration
  // Capture 10% of all sessions for general replay
  replaysSessionSampleRate: 0.1,
  // Capture 100% of sessions with errors for debugging
  replaysOnErrorSampleRate: 1.0,
});
