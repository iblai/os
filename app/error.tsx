'use client';

import { useEffect } from 'react';

import { config } from '@/lib/config';
import { ErrorPage } from '@iblai/iblai-js/web-containers/next';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Root page error:', error);
  }, [error]);

  return (
    <ErrorPage
      errorCode="500"
      customTitle="Something went wrong!"
      customDescription="An unexpected error occurred"
      supportEmail={config.supportEmail()}
      showReset={true}
      reset={reset}
    />
  );
}
