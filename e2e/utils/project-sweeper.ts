/**
 * Stale test-project sweeper — runs as Playwright `globalTeardown`.
 *
 * Mirrors `mentor-sweeper.ts`'s design exactly: after every full test run this
 * sweeper lists all projects owned by the admin user and deletes any that:
 *   1. Have a name matching the E2E test-created pattern (starts with "E2E
 *      Project " and contains a 13-digit Unix-millisecond timestamp), AND
 *   2. Were created more than STALE_AFTER_MS ago (30 minutes).
 *
 * The age gate guarantees that a concurrent/just-started run's projects are
 * never reaped — a freshly created project is at most a few seconds old, far
 * below the 30-minute floor.
 *
 * This is the safety-net counterpart to the `testProject` fixture's per-test
 * API delete (see `utils/project-cleanup.ts`): the fixture is the first line
 * of defense (deletes its own project in teardown, even on failure), this
 * sweeper catches orphans left behind by crashed workers, forced-killed CI
 * jobs, or a renamed project whose captured id lookup failed (see the
 * `deleteProjectByName` fallback note in project-cleanup.ts).
 *
 * SAFETY guarantees (mirrors mentor-sweeper.ts):
 *   • Only names matching E2E_PROJECT_RE are considered. Any real user
 *     project never matches (it does not start with "E2E Project " followed
 *     by a bare 13-digit timestamp).
 *   • Only stale (> 30 min) matches are deleted. A parallel run's live projects
 *     are never touched.
 *   • A failed delete, an unresolvable DM base, or missing auth goes through
 *     `failLoudly` (resource-tracker.ts): it throws — failing the run — when
 *     CI or DM_URL is set, and is a `console.error` line otherwise.
 *
 * Auth: reads axd_token, username (user_nicename), and tenantKey (key)
 * directly from the saved storageState JSON (`playwright/.auth/user-chrome.json`)
 * so no live browser context is needed and globalTeardown stays fast.
 *
 * DIVERGENCE FROM mentor-sweeper.ts (noted rather than silently papered over):
 *   • Auth token: projects read `axd_token` from localStorage, not
 *     `dm_token` — see the explanation in project-cleanup.ts (the AXD
 *     service's auth branch is used even though the URL resolves to the same
 *     `/dm` base as mentors).
 *   • Pagination: the mentor list endpoint uses page-number pagination
 *     (`page`/`num_pages`). The projects list endpoint
 *     (`aiMentorOrgsUsersProjectsList` in the API SDK) uses DRF
 *     limit/offset pagination instead, returning `{ count, next, previous,
 *     results }` — so this sweeper walks pages via `limit`/`offset` and stops
 *     when `next` is null, rather than comparing against `num_pages`.
 *   • Identifier field: projects are deleted by their numeric `id`, not a
 *     string `unique_id` slug.
 *
 * API used:
 *   GET  {dmBase}/api/ai-mentor/orgs/{org}/users/{username}/projects/?limit=N&offset=M
 *   DELETE {dmBase}/api/ai-mentor/orgs/{org}/users/{username}/projects/{id}/
 *   Authorization: Token {axd_token}
 *
 * Name pattern produced by `generateProjectName()` in test-data.ts:
 *   "E2E Project 1720000000000-ab12c"
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

import { dmBaseFromEnv } from './dm-api';
import { anySnapshotDmBase, failLoudly } from './resource-tracker';

// ── Configuration ─────────────────────────────────────────────────────────────

const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes
const PAGE_SIZE = 100;
const MAX_PAGES = 50; // cap page-walk to avoid runaway loops

/**
 * Matches test-created project names that embed a 13-digit timestamp.
 * Example: "E2E Project 1720000000000-ab12c"
 * The captured group 1 is the timestamp string.
 */
export const E2E_PROJECT_RE = /^E2E Project .*\b(\d{13})\b/;

// ── Auth extraction ───────────────────────────────────────────────────────────

interface StorageEntry {
  name: string;
  value: string;
}

interface AuthContext {
  axdToken: string;
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

    const axdToken = get('axd_token');
    if (!axdToken) return null;

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

    return { axdToken, username, tenantKey };
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

// ── Project list type ─────────────────────────────────────────────────────────

interface ProjectListItem {
  id?: number | string;
  name?: string;
}

interface ProjectListResponse {
  results?: ProjectListItem[];
  next?: string | null;
}

// ── Sweeper logic ─────────────────────────────────────────────────────────────

function isStale(name: string | undefined): boolean {
  if (!name) return false;
  const m = name.match(E2E_PROJECT_RE);
  if (!m) return false;
  return Date.now() - Number(m[1]) > STALE_AFTER_MS;
}

async function sweepStaleProjects(
  dmBase: string,
  auth: AuthContext,
): Promise<void> {
  const { axdToken, username, tenantKey } = auth;
  const headers = {
    Authorization: `Token ${axdToken}`,
    Accept: 'application/json',
  };

  // The AXD/projects endpoint lives under the `/dm` path on the API base, same
  // as mentors — see the note in project-cleanup.ts on why the AXD service
  // resolves to config.dmUrl() rather than config.axdUrl().
  const baseListUrl = `${dmBase}/api/ai-mentor/orgs/${encodeURIComponent(tenantKey)}/users/${encodeURIComponent(username)}/projects/`;

  let reaped = 0;
  let skipped = 0;
  let failed = 0;
  let offset = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const listUrl = `${baseListUrl}?limit=${PAGE_SIZE}&offset=${offset}`;
    let res: { status: number; body: string };
    try {
      res = await httpRequest(listUrl, 'GET', headers);
    } catch (err) {
      console.warn(`[project-sweeper] GET page ${page} failed: ${err}`);
      break;
    }

    if (res.status !== 200) {
      if (res.status !== 404)
        console.warn(
          `[project-sweeper] GET page ${page} → ${res.status} — stopping`,
        );
      break;
    }

    let data: ProjectListResponse | ProjectListItem[];
    try {
      data = JSON.parse(res.body) as ProjectListResponse | ProjectListItem[];
    } catch {
      console.warn(`[project-sweeper] Failed to parse page ${page} response`);
      break;
    }

    const items: ProjectListItem[] = Array.isArray(data)
      ? data
      : (data.results ?? []);
    const next: string | null | undefined = Array.isArray(data)
      ? null
      : data.next;

    for (const item of items) {
      const name = item.name;
      const id = item.id;
      if (id === undefined || id === null) continue;

      if (!isStale(name)) {
        skipped++;
        continue;
      }

      const deleteUrl = `${baseListUrl}${encodeURIComponent(String(id))}/`;
      try {
        const delRes = await httpRequest(deleteUrl, 'DELETE', headers);
        if (
          delRes.status === 204 ||
          delRes.status === 200 ||
          delRes.status === 404
        ) {
          console.log(
            `[project-sweeper] Reaped project "${name}" (${id}) → ${delRes.status}`,
          );
          reaped++;
        } else {
          console.warn(
            `[project-sweeper] DELETE ${id} → ${delRes.status} — skipping`,
          );
          failed++;
        }
      } catch (err) {
        console.warn(
          `[project-sweeper] DELETE ${id} failed: ${err} — skipping`,
        );
        failed++;
      }
    }

    if (!next || items.length === 0) break;
    offset += PAGE_SIZE;
  }

  console.log(
    `[project-sweeper] Done — reaped ${reaped}, skipped ${skipped}, failed ${failed}`,
  );
  if (failed > 0)
    failLoudly(`project-sweeper could not delete ${failed} stale project(s)`);
}

// ── Playwright globalTeardown entry point ─────────────────────────────────────

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_SKIP_SWEEP === '1') {
    console.log('[project-sweeper] E2E_SKIP_SWEEP=1 — sweep skipped');
    return;
  }
  try {
    const dmBase = dmBaseFromEnv() || anySnapshotDmBase();
    if (!dmBase) {
      failLoudly(
        'project-sweeper: cannot resolve the DM API base (set DM_URL) — sweep skipped',
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
            `[project-sweeper] Using auth from ${candidate} (user: ${auth.username}, tenant: ${auth.tenantKey})`,
          );
          break;
        }
      }
    }

    if (!auth) {
      failLoudly(
        'project-sweeper: no valid admin auth in playwright/.auth — sweep skipped',
      );
      return;
    }

    await sweepStaleProjects(dmBase, auth);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('[e2e-residue]'))
      throw err;
    failLoudly(`project-sweeper: unexpected error: ${err}`);
  }
}
