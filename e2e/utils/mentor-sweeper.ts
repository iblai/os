/**
 * Stale test-mentor sweeper — runs as Playwright `globalTeardown`.
 *
 * After every full test run this sweeper lists all mentors owned by the admin
 * user and deletes any that:
 *   1. Have a name matching the E2E test-created pattern (starts with "E2E "
 *      and ends with a 13-digit Unix-millisecond timestamp), AND
 *   2. Were created more than STALE_AFTER_MS ago (2 hours).
 *
 * The age gate guarantees that a concurrent/just-started run's mentors are
 * never reaped — a freshly created mentor is at most a few seconds old, far
 * below the 2-hour floor.
 *
 * SAFETY guarantees (mirrors lti-residue.ts):
 *   • Only names matching E2E_MENTOR_RE are considered. Any seed mentor or
 *     manually created mentor never matches.
 *   • Only stale (> 2h) matches are deleted. A parallel run's live mentors
 *     are never touched.
 *   • The tenant always keeps ≥1 mentor: the default/seed mentor doesn't
 *     match the regex, so it is never a candidate.
 *   • Everything is best-effort: a failed delete is logged and skipped.
 *     A sweep failure NEVER causes the Playwright process to exit non-zero.
 *
 * Auth: reads dm_token, username (user_nicename), and tenantKey (key) directly
 * from the saved storageState JSON (`playwright/.auth/user-chrome.json`) so no
 * live browser context is needed and globalTeardown stays fast.
 *
 * API used:
 *   GET  {API_BASE}/dm/api/ai-mentor/orgs/{org}/users/{username}/?page=N
 *   DELETE {API_BASE}/dm/api/ai-mentor/orgs/{org}/users/{username}/{mentorUniqueId}/
 *   Authorization: Token {dm_token}
 *
 * Name pattern produced by `generateMentorName()` in test-data.ts:
 *   "E2E Mentor 1720000000000"
 * Name pattern used by journey 52 (after this fix):
 *   "E2E Tool Call Test Mentor 1720000000000"
 * Both match: /^E2E .+\b(\d{13})\b/
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// ── Configuration ─────────────────────────────────────────────────────────────

const STALE_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_PAGES = 50; // cap page-walk to avoid runaway loops

/**
 * Matches test-created mentor names that embed a 13-digit timestamp.
 * Examples:
 *   "E2E Mentor 1720000000000"
 *   "E2E Tool Call Test Mentor 1720000000000"
 *   "E2E No-Tools Mentor 1720000000000"
 * The captured group 1 is the timestamp string.
 */
export const E2E_MENTOR_RE = /^E2E .+\b(\d{13})\b/;

// ── Auth extraction ───────────────────────────────────────────────────────────

interface StorageEntry {
  name: string;
  value: string;
}

interface AuthContext {
  dmToken: string;
  username: string;
  tenantKey: string;
}

function readAuthFromStorageState(
  storageStatePath: string,
): AuthContext | null {
  try {
    const raw = fs.readFileSync(storageStatePath, 'utf8');
    const state: { origins?: Array<{ localStorage?: StorageEntry[] }> } =
      JSON.parse(raw);
    const allEntries: StorageEntry[] = (state.origins ?? []).flatMap(
      (o) => o.localStorage ?? [],
    );

    const get = (key: string) =>
      allEntries.find((e) => e.name === key)?.value ?? '';

    const dmToken = get('dm_token');
    if (!dmToken) return null;

    let username = '';
    try {
      const ud = JSON.parse(get('userData'));
      username = ud?.user_nicename ?? '';
    } catch {
      /* ignore */
    }
    if (!username) return null;

    let tenantKey = '';
    try {
      const ct = JSON.parse(get('current_tenant'));
      tenantKey = typeof ct === 'string' ? ct : (ct?.key ?? '');
    } catch {
      /* ignore */
    }
    if (!tenantKey) return null;

    return { dmToken, username, tenantKey };
  } catch {
    return null;
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    req.setTimeout(20_000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.end();
  });
}

// ── Mentor list type ──────────────────────────────────────────────────────────

interface MentorListItem {
  unique_id?: string;
  name?: string;
}

interface MentorListResponse {
  results?: MentorListItem[];
  num_pages?: number;
}

// ── Sweeper logic ─────────────────────────────────────────────────────────────

function isStale(name: string | undefined): boolean {
  if (!name) return false;
  const m = name.match(E2E_MENTOR_RE);
  if (!m) return false;
  return Date.now() - Number(m[1]) > STALE_AFTER_MS;
}

async function sweepStaleMentors(
  apiBase: string,
  auth: AuthContext,
): Promise<void> {
  const { dmToken, username, tenantKey } = auth;
  const headers = {
    Authorization: `Token ${dmToken}`,
    Accept: 'application/json',
  };

  // DM API lives under the `/dm` path on the API base (see config.dmUrl()).
  const baseListUrl = `${apiBase}/dm/api/ai-mentor/orgs/${encodeURIComponent(tenantKey)}/users/${encodeURIComponent(username)}/`;

  let reaped = 0;
  let skipped = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const listUrl = `${baseListUrl}?page=${page}&page_size=100`;
    let res: { status: number; body: string };
    try {
      res = await httpRequest(listUrl, 'GET', headers);
    } catch (err) {
      console.warn(`[mentor-sweeper] GET page ${page} failed: ${err}`);
      break;
    }

    if (res.status !== 200) {
      if (res.status !== 404)
        console.warn(
          `[mentor-sweeper] GET page ${page} → ${res.status} — stopping`,
        );
      break;
    }

    let data: MentorListResponse | MentorListItem[];
    try {
      data = JSON.parse(res.body) as MentorListResponse | MentorListItem[];
    } catch {
      console.warn(`[mentor-sweeper] Failed to parse page ${page} response`);
      break;
    }

    const items: MentorListItem[] = Array.isArray(data)
      ? data
      : (data.results ?? []);
    const numPages: number = Array.isArray(data) ? 1 : (data.num_pages ?? 1);

    for (const item of items) {
      const name = item.name;
      const uniqueId = item.unique_id;
      if (!uniqueId) continue;

      if (!isStale(name)) {
        skipped++;
        continue;
      }

      const deleteUrl = `${baseListUrl}${encodeURIComponent(uniqueId)}/`;
      try {
        const delRes = await httpRequest(deleteUrl, 'DELETE', headers);
        if (
          delRes.status === 204 ||
          delRes.status === 200 ||
          delRes.status === 404
        ) {
          console.log(
            `[mentor-sweeper] Reaped mentor "${name}" (${uniqueId}) → ${delRes.status}`,
          );
          reaped++;
        } else {
          console.warn(
            `[mentor-sweeper] DELETE ${uniqueId} → ${delRes.status} — skipping`,
          );
          skipped++;
        }
      } catch (err) {
        console.warn(
          `[mentor-sweeper] DELETE ${uniqueId} failed: ${err} — skipping`,
        );
        skipped++;
      }
    }

    if (page >= numPages || items.length === 0) break;
  }

  console.log(
    `[mentor-sweeper] Done — reaped ${reaped}, skipped/failed ${skipped}`,
  );
}

// ── Playwright globalTeardown entry point ─────────────────────────────────────

export default async function globalTeardown(): Promise<void> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) {
      console.log(
        '[mentor-sweeper] NEXT_PUBLIC_API_BASE_URL not set — skipping sweep',
      );
      return;
    }

    // Use the chrome admin storageState — always available after the admin
    // setup project runs. Fall back to any available browser's auth file.
    const authDir = path.join(__dirname, '../../playwright/.auth');
    const candidates = [
      'user-chrome.json',
      'user-firefox.json',
      'user-edge.json',
      'user-safari.json',
    ];
    let auth: AuthContext | null = null;
    for (const candidate of candidates) {
      const filePath = path.join(authDir, candidate);
      if (fs.existsSync(filePath)) {
        auth = readAuthFromStorageState(filePath);
        if (auth) {
          console.log(
            `[mentor-sweeper] Using auth from ${candidate} (user: ${auth.username}, tenant: ${auth.tenantKey})`,
          );
          break;
        }
      }
    }

    if (!auth) {
      console.log(
        '[mentor-sweeper] No valid admin auth found in storageState files — skipping sweep',
      );
      return;
    }

    await sweepStaleMentors(apiBase, auth);
  } catch (err) {
    // Best-effort — never let teardown failure affect the exit code.
    console.warn(`[mentor-sweeper] Unexpected error: ${err}`);
  }
}
