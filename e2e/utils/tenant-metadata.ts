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
      const url = `${dmUrl}/api/core/orgs/${tenantKey}/metadata/`;
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

      const baseUrl = `${dmUrl}/api/core/orgs/${tenantKey}/metadata/`;

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
        // `JSON.stringify` drops object properties whose value is
        // `undefined`, so passing `value: undefined` does NOT delete `flag`
        // from tenant metadata. The DM API's metadata field is MERGED, not
        // replaced, so any key simply absent from the outgoing body is left
        // untouched server-side — verified empirically: PATCHing a snapshot
        // without a key that was previously set did not remove it on
        // re-fetch. In practice `value: undefined` is a no-op here: whatever
        // this key held before the call still holds it after. There is no
        // way to remove a key via this endpoint. Callers that need a key
        // put back to something BEHAVIORALLY equivalent to "absent" must
        // write an explicit neutral value instead — see
        // `restoreTenantMetadata` / `isMetadataValueEquivalent` below.
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

/**
 * Per-key "equivalent to absent" value to fall back on when a snapshot has
 * no recorded value for that key. There is no way to actually delete a key
 * via the DM metadata endpoint (see the note on `setTenantMetadataFlag`
 * above — PATCH always merges), so restoration can only ever write a value,
 * never remove one. These are the values the APP ITSELF treats the same as
 * "key absent":
 *   - `show_help` is read as `metadata?.show_help !== false`, so `true`
 *     is the exact behavioral equivalent of "absent".
 *   - every other key touched by this journey (`support_url`,
 *     `help_center_url`, `documentation_url`, `support_email`, ...) is a
 *     string consumed via `||` fallback chains, and the SDK's own
 *     Organization tab writes `''` to "clear" a URL field — so `''` is
 *     their behavioral equivalent of "absent".
 */
const NEUTRAL_METADATA_VALUE: Record<string, unknown> = {
  show_help: true,
};

function neutralMetadataValueFor(key: string): unknown {
  return Object.prototype.hasOwnProperty.call(NEUTRAL_METADATA_VALUE, key)
    ? NEUTRAL_METADATA_VALUE[key]
    : '';
}

/**
 * Whether two values for a given metadata key are BEHAVIORALLY equivalent
 * from the app's point of view, even when not strictly `===`. Since the API
 * can never truly delete a key, "was this restored?" checks must compare
 * against what the app treats as absent, not raw key presence/identity —
 * see `neutralMetadataValueFor` above for the per-key equivalence rules.
 */
export function isMetadataValueEquivalent(
  key: string,
  a: unknown,
  b: unknown,
): boolean {
  if (key === 'show_help') {
    const normalize = (v: unknown) => v === false;
    return normalize(a) === normalize(b);
  }
  const normalize = (v: unknown) => (v === undefined || v === null ? '' : v);
  return normalize(a) === normalize(b);
}

/**
 * Restore a specific SET of metadata keys to their pre-suite state. This is
 * the only reliable way to "undo" a mutation against this API: PATCH always
 * MERGES onto whatever is currently stored (see `setTenantMetadataFlag`
 * above), so there is no delete operation to fall back on, and PATCHing an
 * entire old snapshot back would silently leave alone any key a CONCURRENT
 * journey added or changed after the snapshot was taken (harmless) while
 * also stomping any key a concurrent journey legitimately changed in the
 * meantime that happens to also appear in the old snapshot (not harmless) —
 * so this only ever touches the keys the caller names.
 *
 * For each key in `keys`:
 *   - if `snapshot` (as read by `getTenantMetadata`, e.g. in a suite's
 *     `beforeAll`) had an explicit value for it, that value is written back
 *     verbatim;
 *   - otherwise the key is written to its neutral "equivalent of absent"
 *     value — see `neutralMetadataValueFor`.
 *
 * All keys are restored in a single read-merge-PATCH round trip.
 */
export async function restoreTenantMetadata(
  page: Page,
  tenantKey: string,
  keys: readonly string[],
  snapshot: Record<string, unknown>,
): Promise<void> {
  const dmUrl = DM_URL;
  if (!dmUrl) {
    throw new Error(
      'DM_URL env var is not set — cannot call tenant metadata API',
    );
  }

  const patch: Record<string, unknown> = {};
  for (const key of keys) {
    patch[key] = Object.prototype.hasOwnProperty.call(snapshot, key)
      ? snapshot[key]
      : neutralMetadataValueFor(key);
  }

  await page.evaluate(
    async ({ dmUrl, tenantKey, patch }) => {
      const token = localStorage.getItem('dm_token');
      if (!token) throw new Error('dm_token not found in localStorage');

      const baseUrl = `${dmUrl}/api/core/orgs/${tenantKey}/metadata/`;

      // Read-merge-write, same as `setTenantMetadataFlag` — never assume
      // the metadata field is replaced wholesale.
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

      const updated = { ...existing, ...patch };

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
    { dmUrl, tenantKey, patch },
  );
}
