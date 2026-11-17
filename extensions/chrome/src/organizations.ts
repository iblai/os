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
import { apiBases } from './settings';

export interface Organization {
  key: string;
  /** `platform_name || name || org || key`, as the auth app's chooser labels it. */
  name: string;
  /** Marked in the list, and the one the person opens in. */
  isDefault: boolean;
  /** Badged, as in the auth app's chooser. */
  isAdmin: boolean;
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
  is_admin?: unknown;
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

/**
 * The same reading, but able to answer "the row did not say" — these fields are
 * absent on some rows, and a missing field is not a dead link.
 */
const says = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const word = value.trim().toLowerCase();
  if (word === 'true') return true;
  if (word === 'false') return false;
  return null;
};

/**
 * Links the person cannot actually use. Picking one would start an auth
 * round-trip that cannot land, so they are left out rather than offered and
 * then failing.
 *
 * `active`/`user_active` are absent on some rows, so only an explicit `false`
 * disqualifies — a missing field is not a dead link.
 */
function usable(row: PlatformRow, now: number): boolean {
  // Read through `says()`, not `flag()`: DM sends these as strings as often as
  // booleans, so `active: "false"` would sail through a `=== false` check —
  // and `flag()` cannot tell "the row said false" from "the row said nothing".
  if (says(row.active) === false || says(row.user_active) === false) {
    return false;
  }
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
  return {
    key,
    // The auth app's chooser order: platform_name, then name, then org, then
    // the key. The key is shown on its own line regardless, so an unnamed
    // platform is not left looking blank.
    name: text(row.platform_name) ?? text(row.name) ?? text(row.org) ?? key,
    isDefault: flag(row.is_default),
    isAdmin: flag(row.is_admin),
  };
}

function rowsOf(body: unknown): PlatformRow[] {
  if (Array.isArray(body)) return body as PlatformRow[];
  const results = (body as { results?: unknown } | null)?.results;
  return Array.isArray(results) ? (results as PlatformRow[]) : [];
}

const nextOf = (body: unknown): string | null =>
  text((body as { next?: unknown } | null)?.next);

/**
 * Whether the body is a shape we know how to read at all. A 200 carrying
 * something unrecognisable is not an answer that this person has no
 * organizations — it is a base that cannot be understood, and another base may
 * still have the list.
 */
const readable = (body: unknown): boolean =>
  Array.isArray(body) ||
  Array.isArray((body as { results?: unknown } | null)?.results);

async function getJson(
  url: string,
  creds: Credentials,
): Promise<{ body: unknown } | { error: string; unauthorized?: boolean }> {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Token ${creds.dmToken}` },
    });
    if (!response.ok) {
      return {
        error: `${url} → HTTP ${response.status}`,
        // The token is there but the server will not take it. Presence is not
        // validity, and "check your connection" would be the wrong advice.
        unauthorized: response.status === 401,
      };
    }
    return { body: await response.json() };
  } catch (err) {
    return {
      error: `${url} → ${err instanceof Error ? err.message : 'failed'}`,
    };
  }
}

/**
 * `next` comes from the server, and we send a bearer token with it. Anything
 * off the base's own origin is dropped rather than followed, so a mangled or
 * hostile value cannot walk the DM token to another host.
 */
function samePlace(next: string, base: string): string | null {
  try {
    return new URL(next).origin === new URL(base).origin ? next : null;
  } catch {
    return null;
  }
}

/** Follow `next` so a paginated account does not lose everything after page 1. */
const PAGE_LIMIT = 20;

/**
 * Every organization this person can switch to, by name.
 *
 * Default first, then the order the source gave us — the auth app's chooser
 * ordering, so the two lists read the same.
 */
export async function listOrganizations(
  creds = credentials(),
  bases = apiBases(),
): Promise<Organization[]> {
  if (!creds) throw new NoSessionError();
  const path = `/api/core/users/platforms/?username=${encodeURIComponent(creds.username)}`;
  const failures: string[] = [];
  const now = Date.now();
  let unauthorized = false;
  // A base can answer 200 with nothing we recognise. That is not an answer to
  // stop on — another base may hold the real list — but if every base says the
  // same, an empty list is the truth. Same shape as `listModels`.
  let answeredEmpty = false;

  for (const base of bases) {
    const rows: PlatformRow[] = [];
    let url: string | null = `${base}${path}`;
    let failed: string | null = null;
    let understood = false;
    let truncated = false;

    for (let page = 0; url && page < PAGE_LIMIT; page += 1) {
      const answer = await getJson(url, creds);
      if ('error' in answer) {
        if (answer.unauthorized) unauthorized = true;
        // Only a first-page failure means this base has nothing for us. A later
        // page failing (a `next` the gateway cannot serve, say) leaves the rows
        // already collected perfectly usable — but the list is short of what
        // the server has, so say so rather than passing it off as complete.
        if (page === 0) {
          failed = answer.error;
        } else {
          truncated = rows.length > 0;
          failures.push(`${answer.error} (list truncated after page ${page})`);
          console.warn(
            `[ibl.ai panel] organization list truncated: ${answer.error}`,
          );
        }
        break;
      }
      if (!readable(answer.body)) {
        // Same reasoning as the error branch above: only a first page we cannot
        // read means this base has nothing for us. Later on, the rows already
        // collected stand, and the list is reported short rather than dropped.
        if (page === 0) {
          failed = `${url} → unreadable body`;
        } else {
          truncated = rows.length > 0;
          failures.push(`${url} → unreadable body (list truncated)`);
          console.warn(
            `[ibl.ai panel] organization list truncated: ${url} → unreadable body`,
          );
        }
        break;
      }
      understood = true;
      rows.push(...rowsOf(answer.body));
      const next = nextOf(answer.body);
      if (!next) {
        url = null;
        break;
      }
      const following = samePlace(next, base);
      if (!following) {
        // Relative, unreadable, or pointing somewhere else: not followed, and
        // not silently passed off as the end of the list either — unless there
        // was nothing to lose, in which case this base simply answered empty.
        truncated = rows.length > 0;
        failures.push(`${base} → next not followed: ${next}`);
        console.warn(
          `[ibl.ai panel] organization list truncated: next not followed (${next})`,
        );
        break;
      }
      url = following;
      if (page + 1 >= PAGE_LIMIT) {
        truncated = true;
        failures.push(`${base} → more than ${PAGE_LIMIT} pages`);
        console.warn(
          `[ibl.ai panel] organization list truncated: more than ${PAGE_LIMIT} pages`,
        );
      }
    }
    if (failed || !understood) {
      if (failed) failures.push(failed);
      continue;
    }

    const organizations = rows
      .filter((row) => usable(row, now))
      .map(toOrganization)
      .filter((org): org is Organization => org !== null);
    // A duplicate key would make two rows that switch to the same place.
    if (!organizations.length) {
      // Only a complete answer of "none" is an answer. A list cut short by a
      // failed page could be hiding every row this person has.
      if (!truncated) answeredEmpty = true;
      continue;
    }
    const seen = new Set<string>();
    const unique = organizations.filter(
      (org) => !seen.has(org.key) && seen.add(org.key),
    );
    // Default first, everything else in the order the source gave us — the
    // auth app's chooser ordering, so the two lists read the same.
    return [
      ...unique.filter((org) => org.isDefault),
      ...unique.filter((org) => !org.isDefault),
    ];
  }
  // Order matters: a base that answered properly with nothing outranks another
  // base's 401, or an account genuinely in one organization reads as signed out.
  if (answeredEmpty) return [];
  if (unauthorized) throw new NoSessionError();
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
      if (response.status === 401) throw new NoSessionError();
      failures.push(`${base} → HTTP ${response.status}`);
    } catch (err) {
      // A refused token is refused everywhere; trying the next base would just
      // repeat it, and the message the person needs is a different one.
      if (err instanceof NoSessionError) throw err;
      failures.push(
        `${base} → ${err instanceof Error ? err.message : 'failed'}`,
      );
    }
  }
  throw new Error(failures.join('; ') || 'no API base answered');
}
