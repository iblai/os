import { test as setup, createAuthSetup } from '@iblai/iblai-js/playwright';

const MENTOR_NEXTJS_HOST = process.env.MENTOR_NEXTJS_HOST || '';
const AUTH_HOST = process.env.AUTH_HOST || '';

setup(
  'authenticate',
  createAuthSetup({
    hostUrl: MENTOR_NEXTJS_HOST,
    authHost: AUTH_HOST,
    appName: 'mentor',
    postLoginUrlMatcher: (url) =>
      url.href.startsWith(MENTOR_NEXTJS_HOST + '/platform'),
    authFlow:
      (process.env.AUTH_FLOW as
        | 'username_password'
        | 'magic_link'
        | 'sso'
        | 'direct_sso') || 'username_password',
    authIdp: process.env.AUTH_IDP,
  })
);
