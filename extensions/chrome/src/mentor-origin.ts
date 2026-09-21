/**
 * Where the mentor URL comes from, and the hole it fills in the manifest.
 *
 * Build-time only — no `chrome.*` and no `import.meta.env`, so `vite.config.ts`
 * can import it under plain Node. (A config that reached into `settings.ts`
 * would throw: `import.meta.env` does not exist there.)
 *
 * The panel frames the mentor app, so the app's origin has to be in the
 * manifest's `frame-src`/`child-src` — but `public/manifest.json` is copied
 * into the build verbatim and cannot read `.env.local`. So the manifest keeps a
 * placeholder and the build fills it with whatever `VITE_MENTOR_URL` resolved
 * to, which is the only way a configured host is framed instead of blocked.
 */

/** The official app, and what a build with no `.env.local` points at. */
export const DEFAULT_MENTOR_URL = 'https://os.ibl.ai';

/**
 * The hole in `public/manifest.json`'s CSP. Deliberately shaped like the
 * manifest's own `__MSG_appName__` i18n holes; Chrome only substitutes
 * `__MSG_*__`, so this one is left for us to fill.
 */
export const MENTOR_ORIGIN_PLACEHOLDER = '__MENTOR_ORIGIN__';

/**
 * Fill every placeholder in `csp` with the ORIGIN of `mentorUrl` — a path or a
 * trailing slash is not a valid CSP source expression, so the URL is reduced
 * rather than pasted in.
 *
 * Throws on a URL that cannot be parsed, which fails the build: a malformed
 * `VITE_MENTOR_URL` would otherwise reach the panel as an iframe src nobody
 * can load.
 */
export function cspWithMentorOrigin(csp: string, mentorUrl: string): string {
  const { origin } = new URL(mentorUrl);
  return csp.split(MENTOR_ORIGIN_PLACEHOLDER).join(origin);
}
