// The organizations a person can switch the panel to, read straight from DM.
//
// The panel used to send them to the auth app's `/me` chooser in a browser tab
// for this. That tab could not see the panel's session — side panels are
// storage-partitioned, so `/me` had nothing to read on its own origin and only
// worked because the app forwarded an edX JWT in the URL. The list is DM's and
// the panel already holds a DM token, so it can ask directly and no credential
// goes near a tab's address bar.

import { credentials } from './auth';
import type { Credentials } from './agent';
import { t } from './i18n';
import { apiBases } from './settings';

export interface Organization {
  key: string;
  name: string;
  /** Marked in the list, and the one the person opens in. */
  isDefault: boolean;
}

/** Thrown when the panel has no usable session, so the caller can say so. */
export class NoSessionError extends Error {
  constructor() {
    super('no session');
    this.name = 'NoSessionError';
  }
}

/** A DM row. Every field is optional here: this is wire data, not our shape. */
interface PlatformRow {
  platform_key?: unknown;
  key?: unknown;
  org?: unknown;
  name?: unknown;
  platform_name?: unknown;
  is_default?: unknown;
  active?: unknown;
  user_active?: unknown;
  expired_on?: unknown;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** `is_default`, `public` and friends come back as strings, not booleans. */
const flag = (value: unknown): boolean =>
  value === true ||
  (typeof value === 'string' && value.toLowerCase() === 'true');

/** A personal platform's key is a 32-character hex-ish blob, not a name. */
const PERSONAL_KEY = /^[a-zA-Z0-9]{32}$/;

/**
 * Links the person cannot actually use. Picking one would start an auth
 * round-trip that cannot land, so they are left out rather than offered and
 * then failing.
 *
 * `active`/`user_active` are absent on some rows, so only an explicit `false`
 * disqualifies — a missing field is not a dead link.
 */
function usable(row: PlatformRow, now: number): boolean {
  if (row.active === false || row.user_active === false) return false;
  const expiry = text(row.expired_on);
  if (expiry) {
    const at = Date.parse(expiry);
    if (!Number.isNaN(at) && at <= now) return false;
  }
  return true;
}

/**
 * DM has spelled the key three ways across these endpoints. Read all of them
 * rather than letting a renamed field empty the list.
 */
function toOrganization(row: PlatformRow): Organization | null {
  const key = text(row.platform_key) ?? text(row.key) ?? text(row.org);
  if (!key) return null;
  const given = text(row.name) ?? text(row.platform_name);
  return {
    key,
    // The app shows a personal platform as "Account"; its key is a 32-character
    // blob that means nothing to the person reading the list.
    name: given ?? (PERSONAL_KEY.test(key) ? t('orgsAccount') : key),
    isDefault: flag(row.is_default),
  };
}

function rowsOf(body: unknown): PlatformRow[] {
  if (Array.isArray(body)) return body as PlatformRow[];
  const results = (body as { results?: unknown } | null)?.results;
  return Array.isArray(results) ? (results as PlatformRow[]) : [];
}

const nextOf = (body: unknown): string | null =>
  text((body as { next?: unknown } | null)?.next);

async function getJson(
  url: string,
  creds: Credentials,
): Promise<{ body: unknown; base: string } | { error: string }> {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Token ${creds.dmToken}` },
    });
    if (!response.ok) return { error: `${url} → HTTP ${response.status}` };
    return { body: await response.json(), base: url };
  } catch (err) {
    return {
      error: `${url} → ${err instanceof Error ? err.message : 'failed'}`,
    };
  }
}

/** Follow `next` so a paginated account does not lose everything after page 1. */
const PAGE_LIMIT = 20;

/**
 * Every organization this person can switch to, by name.
 *
 * Sorted by name so the list does not reorder between openings — DM returns
 * them in whatever order the rows come back in.
 */
export async function listOrganizations(
  creds = credentials(),
  bases = apiBases(),
): Promise<Organization[]> {
  if (!creds) throw new NoSessionError();
  const path = `/api/core/users/platforms/?username=${encodeURIComponent(creds.username)}`;
  const failures: string[] = [];
  const now = Date.now();

  for (const base of bases) {
    const rows: PlatformRow[] = [];
    let url: string | null = `${base}${path}`;
    let failed: string | null = null;

    for (let page = 0; url && page < PAGE_LIMIT; page += 1) {
      const answer = await getJson(url, creds);
      if ('error' in answer) {
        failed = answer.error;
        break;
      }
      rows.push(...rowsOf(answer.body));
      url = nextOf(answer.body);
    }
    if (failed) {
      failures.push(failed);
      continue;
    }

    const organizations = rows
      .filter((row) => usable(row, now))
      .map(toOrganization)
      .filter((org): org is Organization => org !== null);
    // A duplicate key would make two rows that switch to the same place.
    const seen = new Set<string>();
    return organizations
      .filter((org) => !seen.has(org.key) && seen.add(org.key))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  throw new Error(failures.join('; ') || 'no API base answered');
}

/** Remember this organization as the one to open in. */
export async function setDefaultOrganization(
  key: string,
  creds = credentials(),
  bases = apiBases(),
): Promise<void> {
  if (!creds) throw new NoSessionError();
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
