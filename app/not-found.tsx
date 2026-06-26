'use client';

import { useTranslations } from 'next-intl';

import { config } from '@/lib/config';
import { ErrorPage } from '@iblai/iblai-js/web-containers/next';

export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <ErrorPage
      errorCode="404"
      customTitle={t('pageNotFound')}
      customDescription={t('pageDoesNotExist')}
      supportEmail={config.supportEmail()}
    />
  );
}
