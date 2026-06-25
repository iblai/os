'use client';

import { useLocale } from 'next-intl';
import { WebContainersI18nProvider } from '@iblai/web-containers/next';

/**
 * Bridges the app's active next-intl locale into the web-containers i18n
 * provider so shared @iblai/web-containers components (UserProfileModal, etc.)
 * render in the selected language.
 */
export function WebContainersLocaleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = useLocale();
  return (
    <WebContainersI18nProvider locale={locale as 'en' | 'fr' | 'es' | 'zh'}>
      {children}
    </WebContainersI18nProvider>
  );
}
