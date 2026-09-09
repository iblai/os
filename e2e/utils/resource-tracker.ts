import fs from 'fs';
import path from 'path';
import {
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
  type WorkerInfo,
} from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

import { knownDmBase } from './dm-api';
import { parsePlatformUrl } from './navigation';
import { findProjectIdByName } from './project-cleanup';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrackedBase {
  tenantKey: string;
  name: string;
  username: string;
  project: string;
}
export interface TrackedMentor extends TrackedBase {
  kind: 'mentor';
  mentorId: string;
}
export interface TrackedProject extends TrackedBase {
  kind: 'project';
  projectId: string;
}
export type TrackedResource = TrackedMentor | TrackedProject;

export interface AuthTokens {
  dmToken: string;
  axdToken: string;
}
export interface StorageAuth extends AuthTokens {
  username: string;
  tenantKey: string;
}

export interface Snapshot {
  runId: string;
  runStart: string;
  browser: string;
  dmBase: string;
  username: string;
  tenantKey: string;
  mentors: number | null;
  projects: number | null;
}

// ── Files ─────────────────────────────────────────────────────────────────────

export const RESIDUE_DIR = path.join(__dirname, '../.residue');
export const AUTH_DIR = path.join(__dirname, '../../playwright/.auth');

export function runId(): string {
  return process.env.E2E_RUN_ID || 'local';
}

export function residueFile(): string {
  return path.join(RESIDUE_DIR, `${runId()}.jsonl`);
}

/** `mentor-desktop-chrome`, `snapshot-chrome`, `residue-chrome` → `chrome`. */
export function browserOf(projectName: string): string {
  return projectName.replace(/^(?:mentor-desktop|snapshot|residue|setup)-/, '');
}

export function snapshotFile(browser: string): string {
  return path.join(RESIDUE_DIR, `${runId()}.${browser}.snapshot.json`);
}

export function readSnapshot(browser: string): Snapshot | null {
  try {
    return JSON.parse(fs.readFileSync(snapshotFile(browser), 'utf8'));
  } catch {
    return null;
  }
}

/** DM base recorded by any browser's snapshot in this run — for globalTeardown, which has no page. */
export function anySnapshotDmBase(): string {
  try {
    for (const f of fs.readdirSync(RESIDUE_DIR)) {
      if (!f.startsWith(`${runId()}.`) || !f.endsWith('.snapshot.json'))
        continue;
      const { dmBase } = JSON.parse(
        fs.readFileSync(path.join(RESIDUE_DIR, f), 'utf8'),
      ) as Snapshot;
      if (dmBase) return dmBase;
    }
  } catch {
    /* no residue dir yet */
  }
  return '';
}

export function writeSnapshot(snapshot: Snapshot): void {
  fs.mkdirSync(RESIDUE_DIR, { recursive: true });
  fs.writeFileSync(
    snapshotFile(snapshot.browser),
    JSON.stringify(snapshot, null, 2),
  );
}

function appendResidue(entry: TrackedResource): void {
  fs.mkdirSync(RESIDUE_DIR, { recursive: true });
  fs.appendFileSync(residueFile(), `${JSON.stringify(entry)}\n`);
}

export function readResidue(): TrackedResource[] {
  let raw = '';
  try {
    raw = fs.readFileSync(residueFile(), 'utf8');
  } catch {
    return [];
  }
  const byKey = new Map<string, TrackedResource>();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as TrackedResource;
      byKey.set(resourceKey(entry), entry);
    } catch {
      /* partial line from a crashed worker */
    }
  }
  return [...byKey.values()];
}

// ── Loud rule ─────────────────────────────────────────────────────────────────

export function failLoudly(message: string): void {
  const line = `[e2e-residue] ${message}`;
  if (process.env.CI || process.env.DM_URL) throw new Error(line);
  console.error(line);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

interface StorageEntry {
  name: string;
  value: string;
}

export function readAuthFromStorageState(file: string): StorageAuth | null {
  try {
    const state: { origins?: Array<{ localStorage?: StorageEntry[] }> } =
      JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = (state.origins ?? []).flatMap((o) => o.localStorage ?? []);
    const get = (key: string) =>
      entries.find((e) => e.name === key)?.value ?? '';
    const dmToken = get('dm_token');
    const axdToken = get('axd_token');
    let username = '';
    let tenantKey = '';
    try {
      username = JSON.parse(get('userData'))?.user_nicename ?? '';
    } catch {
      /* ignore */
    }
    try {
      const ct = JSON.parse(get('current_tenant'));
      tenantKey = typeof ct === 'string' ? ct : (ct?.key ?? '');
    } catch {
      /* ignore */
    }
    if (!dmToken || !username) return null;
    return { dmToken, axdToken, username, tenantKey };
  } catch {
    return null;
  }
}

/** Every saved storageState (admin + non-admin, all browsers), keyed by username. */
export function loadAuthDirectory(): Map<string, AuthTokens> {
  const map = new Map<string, AuthTokens>();
  let files: string[] = [];
  try {
    files = fs.readdirSync(AUTH_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return map;
  }
  for (const f of files) {
    const auth = readAuthFromStorageState(path.join(AUTH_DIR, f));
    if (auth && !map.has(auth.username)) map.set(auth.username, auth);
  }
  return map;
}

async function readPageAuth(
  page: Page,
): Promise<AuthTokens & { username: string; tenantKey: string }> {
  return page.evaluate(() => {
    const parse = (key: string) => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? 'null');
      } catch {
        return null;
      }
    };
    const ct = parse('current_tenant');
    return {
      dmToken: localStorage.getItem('dm_token') ?? '',
      axdToken: localStorage.getItem('axd_token') ?? '',
      username: parse('userData')?.user_nicename ?? '',
      tenantKey: typeof ct === 'string' ? ct : (ct?.key ?? ''),
    };
  });
}

// ── DM API ────────────────────────────────────────────────────────────────────

export function resourceKey(r: TrackedResource): string {
  return `${r.kind}:${r.tenantKey}:${r.kind === 'mentor' ? r.mentorId : r.projectId}`;
}

export function describeResource(r: TrackedResource): string {
  const id = r.kind === 'mentor' ? r.mentorId : r.projectId;
  return `${r.kind} ${r.tenantKey}/${id} ("${r.name}")`;
}

function resourceUrl(dmBase: string, r: TrackedResource): string {
  const users = `${dmBase}/api/ai-mentor/orgs/${encodeURIComponent(r.tenantKey)}/users/${encodeURIComponent(r.username)}/`;
  return r.kind === 'mentor'
    ? `${users}${encodeURIComponent(r.mentorId)}/`
    : `${users}projects/${encodeURIComponent(r.projectId)}/`;
}

function authHeader(tokens: AuthTokens, r: TrackedResource): string {
  return `Token ${r.kind === 'mentor' ? tokens.dmToken : tokens.axdToken}`;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function deleteResourceOnce(
  ctx: APIRequestContext,
  dmBase: string,
  tokens: AuthTokens,
  r: TrackedResource,
  timeout: number,
): Promise<{ ok: boolean; retryable: boolean }> {
  try {
    const res = await ctx.delete(resourceUrl(dmBase, r), {
      headers: { Authorization: authHeader(tokens, r) },
      timeout,
    });
    const ok = res.ok() || res.status() === 404;
    const line = `[resource-tracker] DELETE ${describeResource(r)} → ${res.status()}`;
    if (ok) logger.info(line);
    else logger.warn(line);
    return { ok, retryable: !ok && res.status() >= 500 };
  } catch (err) {
    logger.warn(
      `[resource-tracker] DELETE ${describeResource(r)} failed: ${err}`,
    );
    return { ok: false, retryable: true };
  }
}

/** Retries once (longer timeout, short backoff) on a timeout/network error or 5xx. */
export async function deleteResource(
  ctx: APIRequestContext,
  dmBase: string,
  tokens: AuthTokens,
  r: TrackedResource,
): Promise<boolean> {
  const first = await deleteResourceOnce(ctx, dmBase, tokens, r, 20_000);
  if (first.ok || !first.retryable) return first.ok;
  logger.info(`[resource-tracker] Retrying DELETE ${describeResource(r)}`);
  await sleep(2_000);
  const second = await deleteResourceOnce(ctx, dmBase, tokens, r, 45_000);
  return second.ok;
}

export async function isGone(
  ctx: APIRequestContext,
  dmBase: string,
  tokens: AuthTokens,
  r: TrackedResource,
): Promise<boolean> {
  try {
    const res = await ctx.get(resourceUrl(dmBase, r), {
      headers: { Authorization: authHeader(tokens, r) },
      timeout: 20_000,
    });
    return res.status() === 404;
  } catch {
    return false;
  }
}

/** Deletes `items` four at a time; returns the ones that could not be deleted. */
export async function deleteResources(
  dmBase: string,
  tokensFor: (username: string) => AuthTokens | undefined,
  items: TrackedResource[],
): Promise<TrackedResource[]> {
  const failed: TrackedResource[] = [];
  const ctx = await playwrightRequest.newContext();
  try {
    const pending = [...items];
    while (pending.length) {
      const batch = pending.splice(0, 4);
      await Promise.all(
        batch.map(async (r) => {
          const tokens = tokensFor(r.username);
          if (!tokens) {
            logger.warn(
              `[resource-tracker] No auth for user "${r.username}" — cannot delete ${describeResource(r)}`,
            );
            failed.push(r);
            return;
          }
          if (!(await deleteResource(ctx, dmBase, tokens, r))) failed.push(r);
        }),
      );
    }
  } finally {
    await ctx.dispose().catch(() => {});
  }
  return failed;
}

/** GETs `url`, retrying once (longer timeout, short backoff) on a timeout/network error or 5xx. */
async function getWithRetry(
  ctx: APIRequestContext,
  url: string,
  token: string,
) {
  for (const timeout of [30_000, 45_000]) {
    try {
      const res = await ctx.get(url, {
        headers: { Authorization: `Token ${token}` },
        timeout,
      });
      if (res.ok() || res.status() < 500) return res;
      if (timeout === 45_000) return res;
    } catch (err) {
      if (timeout === 45_000) throw err;
    }
    await sleep(2_000);
  }
  throw new Error(`unreachable: GET ${url}`);
}

async function listCount(
  ctx: APIRequestContext,
  firstUrl: string,
  token: string,
  nextUrl: (data: Record<string, unknown>, page: number) => string | null,
): Promise<number> {
  let url: string | null = firstUrl;
  let total = 0;
  for (let page = 1; url && page <= 200; page++) {
    const res = await getWithRetry(ctx, url, token);
    if (!res.ok()) throw new Error(`GET ${url} → ${res.status()}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.count === 'number') return data.count;
    const results = Array.isArray(data) ? data : (data.results as unknown[]);
    total += results?.length ?? 0;
    url = results?.length ? nextUrl(data, page) : null;
  }
  return total;
}

async function listItems(
  ctx: APIRequestContext,
  firstUrl: string,
  token: string,
  nextUrl: (data: Record<string, unknown>, page: number) => string | null,
): Promise<Record<string, unknown>[]> {
  let url: string | null = firstUrl;
  const items: Record<string, unknown>[] = [];
  for (let page = 1; url && page <= 200; page++) {
    const res = await ctx.get(url, {
      headers: { Authorization: `Token ${token}` },
      timeout: 30_000,
    });
    if (!res.ok()) throw new Error(`GET ${url} → ${res.status()}`);
    const data = (await res.json()) as Record<string, unknown>;
    const results = (
      Array.isArray(data) ? data : (data.results as unknown[])
    ) as Record<string, unknown>[];
    items.push(...(results ?? []));
    url = results?.length ? nextUrl(data, page) : null;
  }
  return items;
}

const userBase = (dmBase: string, auth: StorageAuth) =>
  `${dmBase}/api/ai-mentor/orgs/${encodeURIComponent(auth.tenantKey)}/users/${encodeURIComponent(auth.username)}/`;
const mentorsFirst = (users: string) => `${users}?page=1&page_size=100`;
const mentorsNext =
  (users: string) => (data: Record<string, unknown>, page: number) =>
    page < Number(data.num_pages ?? 1)
      ? `${users}?page=${page + 1}&page_size=100`
      : null;
const projectsFirst = (users: string) => `${users}projects/?limit=100&offset=0`;
const projectsNext =
  (users: string) => (data: Record<string, unknown>, page: number) =>
    data.next ? `${users}projects/?limit=100&offset=${page * 100}` : null;

/** Every per-user mentor + project on the tenant (raw DM API items). */
export async function listResources(
  dmBase: string,
  auth: StorageAuth,
): Promise<{
  mentors: Record<string, unknown>[];
  projects: Record<string, unknown>[];
}> {
  const users = userBase(dmBase, auth);
  const ctx = await playwrightRequest.newContext();
  try {
    const mentors = await listItems(
      ctx,
      mentorsFirst(users),
      auth.dmToken,
      mentorsNext(users),
    );
    const projects = await listItems(
      ctx,
      projectsFirst(users),
      auth.axdToken,
      projectsNext(users),
    );
    return { mentors, projects };
  } finally {
    await ctx.dispose().catch(() => {});
  }
}

/** Per-user mentor + project totals on the tenant, as the DM API reports them. */
export async function countResources(
  dmBase: string,
  auth: StorageAuth,
): Promise<{ mentors: number; projects: number }> {
  const users = userBase(dmBase, auth);
  const ctx = await playwrightRequest.newContext();
  try {
    const mentors = await listCount(
      ctx,
      mentorsFirst(users),
      auth.dmToken,
      mentorsNext(users),
    );
    const projects = await listCount(
      ctx,
      projectsFirst(users),
      auth.axdToken,
      projectsNext(users),
    );
    return { mentors, projects };
  } finally {
    await ctx.dispose().catch(() => {});
  }
}

// ── Worker tracker ────────────────────────────────────────────────────────────

class ResourceTracker {
  project = '';
  private storageState = '';
  private readonly items = new Map<string, TrackedResource>();
  private readonly tokens = new Map<string, AuthTokens>();

  configure(workerInfo: WorkerInfo): void {
    this.project = workerInfo.project.name;
    this.storageState = String(workerInfo.project.use.storageState ?? '');
  }

  add(entry: TrackedResource, tokens: AuthTokens): void {
    const key = resourceKey(entry);
    if (this.items.has(key)) return;
    this.items.set(key, entry);
    if (tokens.dmToken) this.tokens.set(entry.username, tokens);
    appendResidue(entry);
    logger.info(`[resource-tracker] Registered ${describeResource(entry)}`);
  }

  /** Drop `mentorId` from this worker's teardown; the run-level teardown still reaps it. */
  releaseMentor(mentorId: string): void {
    for (const [key, r] of this.items) {
      if (r.kind === 'mentor' && r.mentorId === mentorId)
        this.items.delete(key);
    }
  }

  hasMentor(mentorId: string): boolean {
    return [...this.items.values()].some(
      (r) => r.kind === 'mentor' && r.mentorId === mentorId,
    );
  }

  async deleteAll(): Promise<void> {
    const items = [...this.items.values()];
    if (!items.length) return;
    this.items.clear();

    const dmBase =
      knownDmBase() || readSnapshot(browserOf(this.project))?.dmBase || '';
    if (!dmBase) {
      failLoudly(
        `Cannot resolve the DM API base — ${items.length} resource(s) left for the run-level teardown (set DM_URL)`,
      );
      return;
    }
    const fallback = this.storageState
      ? readAuthFromStorageState(this.storageState)
      : null;
    const failed = await deleteResources(
      dmBase,
      (username) =>
        this.tokens.get(username) ??
        (fallback?.username === username ? fallback : undefined),
      items,
    );
    logger.info(
      `[resource-tracker] Worker teardown: deleted ${items.length - failed.length}/${items.length} resource(s)`,
    );
    if (failed.length) {
      failLoudly(
        `Worker teardown could not delete ${failed.length} resource(s): ${failed
          .map(describeResource)
          .join(', ')}`,
      );
    }
  }
}

const tracker = new ResourceTracker();

export function workerTracker(): ResourceTracker {
  return tracker;
}

function currentProject(): string {
  if (tracker.project) return tracker.project;
  try {
    return test.info().project.name;
  } catch {
    return 'unknown';
  }
}

// ── Registration ──────────────────────────────────────────────────────────────

/** Registers the mentor the page is currently on (`/platform/<tenant>/<mentorId>`). */
export async function registerMentor(
  page: Page,
  name = '',
): Promise<TrackedMentor> {
  const { platformKey, mentorId } = parsePlatformUrl(page.url());
  const auth = await readPageAuth(page);
  const entry: TrackedMentor = {
    kind: 'mentor',
    tenantKey: platformKey,
    mentorId,
    name,
    username: auth.username,
    project: currentProject(),
  };
  tracker.add(entry, auth);
  return entry;
}

/** Looks up the freshly created project by name and registers it. */
export async function registerProject(
  page: Page,
  name: string,
): Promise<string | null> {
  const projectId = await findProjectIdByName(page, name);
  if (!projectId) {
    failLoudly(
      `Project "${name}" was created but its id could not be resolved`,
    );
    return null;
  }
  const auth = await readPageAuth(page);
  tracker.add(
    {
      kind: 'project',
      tenantKey: auth.tenantKey,
      projectId,
      name,
      username: auth.username,
      project: currentProject(),
    },
    auth,
  );
  return projectId;
}
