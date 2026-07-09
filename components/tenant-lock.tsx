'use client';

import { useTenantLock } from '@/hooks/use-tenant-lock';

/**
 * Enforces a Tauri build's tenant lock (see useTenantLock). Renders nothing;
 * mount once inside the authenticated provider tree.
 */
export function TenantLock() {
  useTenantLock();
  return null;
}
