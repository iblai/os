import { createListenerMiddleware, isFulfilled } from '@reduxjs/toolkit';

import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { getAuthItem, setAuthItem } from '@/lib/auth-storage';

/**
 * Keep the persisted tenant metadata in sync with an org-settings save.
 *
 * The app reads tenant metadata from the `tenants` list persisted in storage
 * (`useTenantObjectMetadata` joins the active `current_tenant` into it by key)
 * rather than from a per-load GET. But the Advanced org-settings UI saves
 * through the SDK's `updateTenantMetadata` mutation, which PUTs
 * `/api/core/orgs/<org>/metadata/` and invalidates only its own
 * `TenantMetadata` cache tag — NOT the platforms list that feeds `tenants`.
 * So without this, a saved toggle (Accessibility Menu, Chat Area Width, …)
 * reaches the backend but the UI keeps rendering the stale cached value until
 * the next login/platforms refetch.
 *
 * This writes the newly-saved metadata back into both `tenants` (the matching
 * tenant) and `current_tenant`, then fires the same `local-storage` event
 * `useLocalStorage` emits on its own writes so `useUserTenants` /
 * `useCurrentTenant` re-read and the UI updates in place.
 */

type TenantLike = { key?: string; metadata?: Record<string, unknown> };

/** The SDK's `updateTenantMetadata` arg: `[{ org, requestBody: { metadata } }]`. */
export function extractOrgAndMetadata(
  originalArgs: unknown,
): { org: string; metadata: Record<string, unknown> } | null {
  const payload = Array.isArray(originalArgs) ? originalArgs[0] : originalArgs;
  const org = (payload as { org?: unknown } | undefined)?.org;
  const metadata = (
    payload as { requestBody?: { metadata?: unknown } } | undefined
  )?.requestBody?.metadata;
  if (typeof org !== 'string' || !metadata || typeof metadata !== 'object') {
    return null;
  }
  return { org, metadata: metadata as Record<string, unknown> };
}

function readJson(key: string): unknown {
  const raw = getAuthItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeAndNotify(key: string, value: unknown): void {
  setAuthItem(key, JSON.stringify(value));
  // Same event `useLocalStorage` dispatches on write, so the same-document
  // `useUserTenants` / `useCurrentTenant` hooks re-read immediately.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new StorageEvent('local-storage', { key }));
  }
}

/**
 * Overwrite the given tenant's metadata in the persisted `tenants` list and in
 * `current_tenant`. The saved metadata is the COMPLETE new object (the SDK
 * sends the merged result), so it replaces rather than merges.
 */
export function syncTenantMetadataToStorage(
  org: string,
  metadata: Record<string, unknown>,
): void {
  const tenants = readJson(LOCAL_STORAGE_KEYS.USER_TENANTS);
  if (Array.isArray(tenants)) {
    let changed = false;
    const next = tenants.map((tenant: TenantLike) => {
      if (tenant && typeof tenant === 'object' && tenant.key === org) {
        changed = true;
        return { ...tenant, metadata };
      }
      return tenant;
    });
    if (changed) {
      writeAndNotify(LOCAL_STORAGE_KEYS.USER_TENANTS, next);
    }
  }

  const current = readJson(
    LOCAL_STORAGE_KEYS.CURRENT_TENANT,
  ) as TenantLike | null;
  if (current && typeof current === 'object' && current.key === org) {
    writeAndNotify(LOCAL_STORAGE_KEYS.CURRENT_TENANT, { ...current, metadata });
  }
}

export const tenantMetadataStorageSync = createListenerMiddleware();

tenantMetadataStorageSync.startListening({
  predicate: (action) =>
    isFulfilled(action) &&
    (action as { meta?: { arg?: { endpointName?: string } } }).meta?.arg
      ?.endpointName === 'updateTenantMetadata',
  effect: (action) => {
    const originalArgs = (
      action as { meta?: { arg?: { originalArgs?: unknown } } }
    ).meta?.arg?.originalArgs;
    const parsed = extractOrgAndMetadata(originalArgs);
    if (parsed) {
      syncTenantMetadataToStorage(parsed.org, parsed.metadata);
    }
  },
});
