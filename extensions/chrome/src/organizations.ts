// The organizations a person can switch the panel to, read straight from DM.
//
// The panel used to send them to the auth app's `/me` chooser in a browser tab
// for this. That tab could not see the panel's session — side panels are
// storage-partitioned, so `/me` had nothing to read on its own origin and only
// worked because the app forwarded an edX JWT in the URL. Both endpoints below
// are DM's, and the panel already holds a DM token, so it can ask directly and
// no credential goes near a tab's address bar.

import { credentials } from './auth';
import type { Credentials } from './agent';
import { apiBases } from './settings';

export interface Organization {
  key: string;
  name: string;
}

/** A DM row; `name` is absent often enough that the key has to stand in. */
interface PlatformRow {
  platform_key?: unknown;
  key?: unknown;
  org?: unknown;
  name?: unknown;
  platform_name?: unknown;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * DM has spelled the key three ways across these endpoints. Read all of them
 * rather than letting a renamed field empty the list.
 */
function toOrganization(row: PlatformRow): Organization | null {
  const key = text(row.platform_key) ?? text(row.key) ?? text(row.org);
  if (!key) return null;
  return { key, name: text(row.name) ?? text(row.platform_name) ?? key };
}

function rowsOf(body: unknown): PlatformRow[] {
  if (Array.isArray(body)) return body as PlatformRow[];
  const results = (body as { results?: unknown } | null)?.results;
  return Array.isArray(results) ? (results as PlatformRow[]) : [];
}

async function getJson(
  path: string,
  creds: Credentials,
  bases: string[],
): Promise<unknown> {
  const failures: string[] = [];
  for (const base of bases) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { Authorization: `Token ${creds.dmToken}` },
      });
      if (!response.ok) {
        failures.push(`${base} → HTTP ${response.status}`);
        continue;
      }
      return await response.json();
    } catch (err) {
      failures.push(
        `${base} → ${err instanceof Error ? err.message : 'failed'}`,
      );
    }
  }
  throw new Error(failures.join('; ') || 'no API base answered');
}

/**
 * Every organization this person belongs to, by name.
 *
 * Sorted by name so the list does not reorder between openings — DM returns
 * them in whatever order the rows come back in.
 */
export async function listOrganizations(
  creds = credentials(),
  bases = apiBases(),
): Promise<Organization[]> {
  if (!creds) throw new Error('no session');
  const body = await getJson(
    `/api/core/users/platforms/?username=${encodeURIComponent(creds.username)}`,
    creds,
    bases,
  );
  const organizations = rowsOf(body)
    .map(toOrganization)
    .filter((org): org is Organization => org !== null);
  // A duplicate key would make two rows that switch to the same place.
  const seen = new Set<string>();
  return organizations
    .filter((org) => !seen.has(org.key) && seen.add(org.key))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The organization the person opens in by default, or null when they have not
 * chosen one. A 503 means the backing table is not migrated in this
 * environment, which is not worth failing the list over — hence null, not a
 * throw, for anything unreadable.
 */
export async function defaultOrganization(
  creds = credentials(),
  bases = apiBases(),
): Promise<string | null> {
  if (!creds) return null;
  try {
    const body = await getJson(
      '/api/core/users/platforms/default/',
      creds,
      bases,
    );
    const row = (body ?? {}) as PlatformRow & { platform?: PlatformRow };
    return (
      text(row.platform_key) ??
      text(row.key) ??
      text(row.org) ??
      text(row.platform?.platform_key) ??
      text(row.platform?.key) ??
      null
    );
  } catch {
    return null;
  }
}

/** Remember this organization as the one to open in. */
export async function setDefaultOrganization(
  key: string,
  creds = credentials(),
  bases = apiBases(),
): Promise<void> {
  if (!creds) throw new Error('no session');
  const failures: string[] = [];
  for (const base of bases) {
    try {
      const response = await fetch(
        `${base}/api/core/users/platforms/default/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${creds.dmToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ platform_key: key }),
        },
      );
      if (response.ok) return;
      failures.push(`${base} → HTTP ${response.status}`);
    } catch (err) {
      failures.push(
        `${base} → ${err instanceof Error ? err.message : 'failed'}`,
      );
    }
  }
  throw new Error(failures.join('; ') || 'no API base answered');
}
