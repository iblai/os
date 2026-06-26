'use client';

import { useTranslations } from 'next-intl';

export function FlowTab() {
  const t = useTranslations('flowTab');
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center text-sm text-gray-500">{t('comingSoon')}</div>
    </div>
  );
}
