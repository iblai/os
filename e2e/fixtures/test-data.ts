/**
 * Test data: environment variable readers, URL constants, and data generators.
 * All URLs are configured via environment variables.
 */

// ── URLs ─────────────────────────────────────────────────────────────────────

export const MENTOR_NEXTJS_HOST = process.env.MENTOR_NEXTJS_HOST || '';
export const AUTH_HOST = process.env.AUTH_HOST || '';
export const MENTOR_NEXTJS_STRIPE_HOST =
  process.env.MENTOR_NEXTJS_STRIPE_HOST || '';
export const DM_URL = process.env.DM_URL || '';
export const FORDHAM_HOST = process.env.FORDHAM_HOST || '';
export const AUTH_NEXTJS_HOST = process.env.AUTH_NEXTJS_HOST || '';

// ── Credentials ──────────────────────────────────────────────────────────────

export const PLAYWRIGHT_USERNAME = process.env.PLAYWRIGHT_USERNAME || '';
export const PLAYWRIGHT_PASSWORD = process.env.PLAYWRIGHT_PASSWORD || '';

// Non-admin user credentials
export const PLAYWRIGHT_NONADMIN_USERNAME =
  process.env.PLAYWRIGHT_NONADMIN_USERNAME || '';
export const PLAYWRIGHT_NONADMIN_PASSWORD =
  process.env.PLAYWRIGHT_NONADMIN_PASSWORD || '';

/** Per-browser credential overrides (fall back to defaults above) */
export function getBrowserCredentials(browserName: string): {
  email: string;
  password: string;
} {
  const upper = browserName.toUpperCase();
  return {
    email: process.env[`PLAYWRIGHT_USERNAME_${upper}`] || PLAYWRIGHT_USERNAME,
    password:
      process.env[`PLAYWRIGHT_PASSWORD_${upper}`] || PLAYWRIGHT_PASSWORD,
  };
}

// ── Invite credentials ───────────────────────────────────────────────────────

export const INVITE_USERNAME = process.env.INVITE_USERNAME || '';
export const INVITE_USER_PASSWORD = process.env.INVITE_USER_PASSWORD || '';

// ── Feature flags ────────────────────────────────────────────────────────────

export type AuthFlow =
  | 'username_password'
  | 'magic_link'
  | 'sso'
  | 'direct_sso';
export const AUTH_FLOW: AuthFlow =
  (process.env.AUTH_FLOW as AuthFlow) || 'username_password';
export const AUTH_IDP = process.env.AUTH_IDP || '';
export const ENABLE_STRIPE_TEST = process.env.ENABLE_STRIPE_TEST === 'true';
export const ENABLE_ADVERTISING_LOGIN_TEST =
  !!process.env.ENABLE_ADVERTISING_LOGIN_TEST;

// ── Mentor config ────────────────────────────────────────────────────────────

export const NEW_MENTOR_NAME = process.env.NEW_MENTOR_NAME || '';
export const NEW_MENTOR_DESCRIPTION = process.env.NEW_MENTOR_DESCRIPTION || '';
export const IBL_MENTOR_DISABLED_TABS =
  process.env.IBL_MENTOR_DISABLED_TABS || '';

// ── External service URLs ────────────────────────────────────────────────────

export const EMBED_URL =
  process.env.EMBED_URL || 'https://conradmugabe.vercel.app/';
export const EXTERNAL_STRIPE_PRICING_URL =
  process.env.EXTERNAL_STRIPE_PRICING_URL || '';
export const ECOMMERCE_CREDIT_CLEANUP_TOKEN =
  process.env.ECOMMERCE_CREDIT_CLEANUP_TOKEN || '';

// ── Canvas LMS (Journey 11) ──────────────────────────────────────────────────

export const CANVAS_URL = process.env.CANVAS_URL || '';
export const CANVAS_EMAIL = process.env.CANVAS_EMAIL || '';
export const CANVAS_PASSWORD = process.env.CANVAS_PASSWORD || '';
export const CANVAS_PATH_WITH_LTI_MENTOR =
  CANVAS_URL + process.env.CANVAS_PATH_WITH_LTI_MENTOR || '';
/** True only if all three Canvas env vars are set */
export const hasCanvasEnv = !!(
  CANVAS_URL &&
  CANVAS_EMAIL &&
  CANVAS_PASSWORD &&
  CANVAS_PATH_WITH_LTI_MENTOR
);
// ── Data Reports (Journey 19) ────────────────────────────────────────────────

/** Tenant key for the /reports/ page. Auto-derived at runtime if empty. */
export const PLAYWRIGHT_TENANT_KEY = process.env.PLAYWRIGHT_TENANT_KEY || '';

// ── Accessibility ────────────────────────────────────────────────────────────

export const WCAG_RANGE = process.env.WCAG_RANGE || '';

// ── Data generators ──────────────────────────────────────────────────────────

/** Generates a unique mentor name for isolation between test runs */
export function generateMentorName(): string {
  return `E2E Mentor ${Date.now()}`;
}

/** Generates a unique project name for isolation between test runs */
export function generateProjectName(): string {
  return `E2E Project ${Date.now()}`;
}

/** Generates a unique MCP connector name */
export function generateConnectorName(): string {
  return `Test Connector ${Date.now()}`;
}

/** Generates a unique email address using mailsac for signup tests */
export function generateTestEmail(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `e2e_test_${ts}_${rand}@mailsac.com`;
}

/** Generates a unique username */
export function generateUsername(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 6);
  return `e2e_${ts}_${rand}`;
}
