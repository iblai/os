/**
 * Supported UI locales for the mentor app.
 * - `en` English
 * - `fr` French
 * - `es` Spanish
 * - `zh` Chinese (Simplified)
 */
export const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'zh'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie used to persist the user's selected language (no URL routing). */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Shared Open edX language-preference cookie. Set on the registrable parent
 * domain (e.g. `.iblai.app`) so the selected language is synced across all
 * subdomain apps (auth, learn, mentor, …).
 */
export const OPENEDX_LOCALE_COOKIE = 'openedx-language-preference';

/** Human-readable labels for the language selector. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  zh: '中文',
};

/**
 * Narrow an arbitrary string to a supported locale, falling back to default.
 * Normalizes region/script subtags so Open edX codes resolve too, e.g.
 * `zh-cn`/`zh-hans` → `zh`, `fr-FR` → `fr`, `en-US` → `en`.
 */
export function resolveLocale(value: string | undefined | null): Locale {
  if (!value) return DEFAULT_LOCALE;
  const v = value.toLowerCase().trim();
  const supported = SUPPORTED_LOCALES as readonly string[];
  if (supported.includes(v)) return v as Locale;
  const base = v.split(/[-_]/)[0];
  if (supported.includes(base)) return base as Locale;
  return DEFAULT_LOCALE;
}
