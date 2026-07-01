import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, OPENEDX_LOCALE_COOKIE, resolveLocale } from './config';

/**
 * next-intl request config (no i18n routing). The active locale is resolved
 * from cookies, preferring the shared cross-subdomain Open edX preference
 * (`openedx-language-preference`) so a language chosen in any IBL app applies
 * here too, then falling back to this app's own `NEXT_LOCALE` cookie, then the
 * default locale. Messages are loaded from `messages/<locale>.json`.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(
    cookieStore.get(OPENEDX_LOCALE_COOKIE)?.value ??
      cookieStore.get(LOCALE_COOKIE)?.value,
  );

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
