import { useTranslations } from 'next-intl';

import { Spinner } from '@/components/spinner';

export default function Loading() {
  const t = useTranslations('notificationsLoading');
  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="flex h-dvh w-screen items-center justify-center"
    >
      <Spinner className="h-14 w-14" />
    </div>
  );
}
