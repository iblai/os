import type { Page } from '@playwright/test';

const DM_URL = process.env.DM_URL || '';

/**
 * Read the tenant's current metadata from the DM API.
 * Uses the dm_token already present in localStorage (set during auth setup).
 */
export async function getTenantMetadata(
  page: Page,
  tenantKey: string,
): Promise<Record<string, unknown>> {
  const dmUrl = DM_URL;
  if (!dmUrl) {
    throw new Error(
      'DM_URL env var is not set — cannot call tenant metadata API',
    );
  }

  const result = await page.evaluate(
    async ({ dmUrl, tenantKey }) => {
      const token = localStorage.getItem('dm_token');
      if (!token) throw new Error('dm_token not found in localStorage');
      const url = `${dmUrl}/dm/api/core/orgs/${tenantKey}/metadata/`;
      const res = await fetch(url, {
        headers: { Authorization: `Token ${token}` },
      });
      if (!res.ok) {
        throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
      }
      return res.json() as Promise<{ metadata: Record<string, unknown> }>;
    },
    { dmUrl, tenantKey },
  );

  return (result as { metadata: Record<string, unknown> }).metadata ?? {};
}

/**
 * Patch a single key on the tenant metadata via the DM API.
 * Merges the key into the existing metadata object (server-side merge semantics:
 * PATCH with {"metadata": {...existing, key: value}} replaces the metadata field).
 * Uses the dm_token already present in localStorage.
 */
export async function setTenantMetadataFlag(
  page: Page,
  tenantKey: string,
  flag: string,
  value: unknown,
): Promise<void> {
  const dmUrl = DM_URL;
  if (!dmUrl) {
    throw new Error(
      'DM_URL env var is not set — cannot call tenant metadata API',
    );
  }

  await page.evaluate(
    async ({ dmUrl, tenantKey, flag, value }) => {
      const token = localStorage.getItem('dm_token');
      if (!token) throw new Error('dm_token not found in localStorage');

      const baseUrl = `${dmUrl}/dm/api/core/orgs/${tenantKey}/metadata/`;

      // First read existing metadata so we can merge cleanly.
      const getRes = await fetch(baseUrl, {
        headers: { Authorization: `Token ${token}` },
      });
      if (!getRes.ok) {
        throw new Error(
          `GET ${baseUrl} → ${getRes.status} ${getRes.statusText}`,
        );
      }
      const existing =
        ((await getRes.json()) as { metadata?: Record<string, unknown> })
          .metadata ?? {};

      const updated = { ...existing, [flag]: value };

      const patchRes = await fetch(baseUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata: updated }),
      });
      if (!patchRes.ok) {
        throw new Error(
          `PATCH ${baseUrl} → ${patchRes.status} ${patchRes.statusText}`,
        );
      }
    },
    { dmUrl, tenantKey, flag, value },
  );
}
