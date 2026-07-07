import { redirectToAuthSpa, redirectToAuthSpaJoinTenant } from '@/lib/utils';

// Mirrors the original `AuthPopover.handleLogin`: send a not-logged-in
// (anonymous) user to the auth SPA when they trigger a gated action.
export function redirectToLogin(tenantKey: string | undefined) {
  if (!tenantKey) {
    redirectToAuthSpa('/', tenantKey, undefined, true, true);
    return;
  }
  redirectToAuthSpaJoinTenant(tenantKey, undefined, true);
}
