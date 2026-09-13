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
      // Session Replay records DOM mutations via rrweb. In a streaming-chat app
      // every token mutates the DOM, so recording every text node and all media
      // unthrottled floods the rrweb buffer: a production performance trace of a
      // long session showed ~145s of main-thread time in the replay event
      // buffer (addEvent → buffer.push) plus ~169s of GC from the allocation
      // churn — by far the largest single cost in the app.
      //
      // - maskAllText: replace text content with a constant placeholder. Cuts
      //   per-mutation serialization cost, and — since replays otherwise capture
      //   users' conversation content verbatim — is the right privacy default.
      // - blockAllMedia: don't record images/video/canvas (large, rarely needed
      //   to reproduce a bug).
      // - mutationLimit / mutationBreadcrumbLimit: stop a replay (and leave a
      //   breadcrumb) if a single mutation batch is pathologically large, so a
      //   runaway render can't lock up the user's tab.
      maskAllText: true,
      blockAllMedia: true,
      mutationLimit: 1500,
      mutationBreadcrumbLimit: 500,
    }),
  ],
  // Sample 10% of transactions (was 1.0). Full performance tracing on every
  // session is unnecessary overhead in production; 10% keeps a representative
  // sample. Raise per-route with tracesSampler if a surface needs more.
  tracesSampleRate: 0.1,
  normalizeDepth: 3,
  environment: process.env.NODE_ENV,

  // Session Replay sampling (unchanged): 10% of all sessions, 100% of sessions
  // that hit an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
