'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { useTranslations } from 'next-intl';

import { Spinner } from '@/components/spinner';
import { hideInitialLoader } from '@/lib/initial-loader';

export default function OneDrivePage() {
  const t = useTranslations('uploadsPage');

  useEffect(() => {
    hideInitialLoader();
  }, []);

  return (
    <>
      <Script src="https://js.live.net/v7.2/OneDrive.js" />
      <div
        role="status"
        aria-label={t('loading')}
        className="flex h-dvh w-screen items-center justify-center"
      >
        <Spinner className="h-14 w-14" />
      </div>
    </>
  );
}
