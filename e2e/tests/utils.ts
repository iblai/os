type authFlow = 'username_password' | 'magic_link' | 'sso' | 'direct_sso';

export const SKILL_HOST = process.env.SKILLS_HOST || '';
export const AUTH_HOST = process.env.AUTH_HOST || '';
export const MENTOR_HOST = process.env.MENTOR_HOST || '';
export const MENTOR_NEXTJS_TECH_HOST =
  process.env.MENTOR_NEXTJS_STRIPE_HOST || '';
export const MENTOR_NEXTJS_HOST = process.env.MENTOR_NEXTJS_HOST || '';
export const ECOMMERCE_CREDIT_CLEANUP_TOKEN =
  process.env.ECOMMERCE_CREDIT_CLEANUP_TOKEN || '';
export const DM_URL = process.env.DM_URL || '';
export const FORDHAM_HOST = process.env.FORDHAM_HOST || '';
export const EXTERNAL_STRIPE_PRICING_URL =
  process.env.EXTERNAL_STRIPE_PRICING_URL || '';
export const IBL_MENTOR_DISABLED_TABS =
  process.env.IBL_MENTOR_DISABLED_TABS || '';
export const AUTH_FLOW: authFlow =
  (process.env.AUTH_FLOW as authFlow) || 'username_password';
export const AUTH_IDP = process.env.AUTH_IDP || '';
export const AUTH_NEXTJS_HOST = process.env.AUTH_NEXTJS_HOST || '';
export const NEW_MENTOR_NAME = process.env.NEW_MENTOR_NAME || '';
export const NEW_MENTOR_DESCRIPTION = process.env.NEW_MENTOR_DESCRIPTION || '';
export const CANVAS_EMAIL = process.env.CANVAS_EMAIL || '';
export const CANVAS_PASSWORD = process.env.CANVAS_PASSWORD || '';
export const CANVAS_URL = process.env.CANVAS_URL || '';
export const EMBED_URL =
  process.env.EMBED_URL ||
  'https://conradmugabe.vercel.app/' ||
  'https://en.wikipedia.org/wiki/Main_Page';
export const WCAG_RANGE = process.env.WCAG_RANGE || '';
export const ENABLE_STRIPE_TEST = process.env.ENABLE_STRIPE_TEST || 'false';
export const INVITE_USERNAME = process.env.INVITE_USERNAME || '';
export const INVITE_USER_PASSWORD = process.env.INVITE_USER_PASSWORD || '';

export const mentorUrlsToTest = ['/'];

export const authUrlsToTest = ['/'];

export const fordhamUrlsToTest = ['/'];
