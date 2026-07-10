'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isTenantSwitchInProgress } from '@iblai/iblai-js/web-utils';

import { getLockedTenant } from '@/lib/locked-tenant';
import { useUsername, useCurrentTenant } from '@/hooks/use-user';
import { handleTenantSwitch } from '@/lib/utils';

/**
 * Tenant lock (Tauri builds only).
 *
 * A Tauri build can be pinned to a single tenant via the `IBL_TENANT` build-time
 * env, surfaced to the web app through the `get_locked_tenant` command. This
 * lets two builds target different tenants while sharing one application URL
 * (e.g. os.ibl.ai). On web (no Tauri) there is no lock. The lock is applied in
 * two places: `redirectToAuthSpa` sends anonymous users straight into the
 * locked tenant, and `useTenantLock` (below) re-homes an already-signed-in user
 * who is on a different tenant.
 */

/** The tenant this build is locked to, or '' when unlocked. */
export function useLockedTenant(): string {
  const [lockedTenant, setLockedTenant] = useState('');

  useEffect(() => {
    let active = true;
    getLockedTenant().then((tenant) => {
      if (active) setLockedTenant(tenant);
    });
    return () => {
      active = false;
    };
  }, []);

  return lockedTenant;
}

/**
 * Enforce the build's tenant lock: when a locked tenant is configured and the
 * signed-in user is on a different tenant, log them out and re-authenticate into
 * the locked tenant (handleTenantSwitch clears storage + redirects through
 * `/login/complete?tenant=<locked>`). No-op on web builds and for anonymous
 * users. Renders nothing; call it once, high in the tree.
 */
export function useTenantLock(): void {
  const lockedTenant = useLockedTenant();
  const username = useUsername();
  const { currentTenant } = useCurrentTenant();
  const pathname = usePathname();

  useEffect(() => {
    if (!lockedTenant) return; // web build / unset → no lock
    if (!username) return; // only signed-in users are forced

    // Never interrupt the auth / SSO handshake or an in-flight switch, or we'd
    // loop while the switch to the locked tenant is completing.
    if (
      /^\/(sso-login|mobile-sso-login|mobile\/sso-login)/.test(pathname ?? '')
    ) {
      return;
    }
    if (isTenantSwitchInProgress()) return;

    const current = currentTenant?.key;
    if (current && current !== lockedTenant) {
      console.log('[tenant-lock] Forcing signed-in tenant to locked build', {
        current,
        lockedTenant,
      });
      // Clears storage (logout) and re-logs into the locked tenant.
      handleTenantSwitch(lockedTenant);
    }
  }, [lockedTenant, username, currentTenant?.key, pathname]);
}
