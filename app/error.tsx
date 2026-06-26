'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { config } from '@/lib/config';
import { ErrorPage } from '@iblai/iblai-js/web-containers/next';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorIndex');

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Root page error:', error);
  }, [error]);

  return (
    <ErrorPage
      errorCode="500"
      customTitle={t('somethingWentWrong')}
      customDescription={t('unexpectedErrorOccurred')}
      supportEmail={config.supportEmail()}
      showReset={true}
      reset={reset}
    />
  );
}
