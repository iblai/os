import * as Sentry from '@sentry/nextjs';
import { getEnv } from './lib/config';

Sentry.init({
  dsn: getEnv(
    'NEXT_PUBLIC_IBL_SENTRY_DSN',
    'https://f953ef66c4e0d5bda480069132dc9aee@sentry.ibl.network/33',
  ),
  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
  tracesSampleRate: 1.0,
  normalizeDepth: 3,
  environment: getEnv('NODE_ENV'),
});
