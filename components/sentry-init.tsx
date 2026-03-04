'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { getEnv } from '@/lib/config';

export function SentryInit() {
  useEffect(() => {
    const currentClient = Sentry.getClient();
    let dsn: string | undefined;
    if (currentClient) {
      const options = currentClient.getOptions();
      dsn = options.dsn;
    }
    const runtimeDsn = getEnv(
      'NEXT_PUBLIC_IBL_SENTRY_DSN',
      'https://f953ef66c4e0d5bda480069132dc9aee@sentry.ibl.network/33',
    );
    if (!Sentry.getClient() || (dsn && dsn !== runtimeDsn)) {
      Sentry.close();
      Sentry.init({
        dsn: runtimeDsn,
        integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
        tracesSampleRate: 1.0,
        normalizeDepth: 3,
        environment: getEnv('NODE_ENV'),
      });
    }
  }, []);

  return null;
}
