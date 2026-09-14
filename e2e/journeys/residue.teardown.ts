import { request, test as teardown } from '@playwright/test';
import { dmBaseFromEnv } from '../utils/dm-api';
import {
  browserOf,
  countResources,
  deleteResources,
  describeResource,
  failLoudly,
  isGone,
  listResources,
  loadAuthDirectory,
  readAuthFromStorageState,
  readResidue,
  readSnapshot,
  residueFile,
  type TrackedResource,
} from '../utils/resource-tracker';
import { E2E_MENTOR_RE } from '../utils/mentor-sweeper';
import { E2E_PROJECT_RE } from '../utils/project-sweeper';

/**
 * Run-level residue check for one browser project. Re-deletes everything the
 * run registered in `e2e/.residue/<runId>.jsonl`, asserts each id now 404s,
 * and prints before/after tenant counts (a non-zero delta fails the run when
 * `E2E_STRICT_COUNTS=1`). Any problem goes through `failLoudly`.
 */
teardown('reap and assert run residue', async ({}, info) => {
  teardown.setTimeout(600_000);
  const browser = browserOf(info.project.name);
  const snapshot = readSnapshot(browser);
  const dmBase = dmBaseFromEnv() || snapshot?.dmBase || '';
  const entries = readResidue().filter(
    (e) => e.project === 'unknown' || browserOf(e.project) === browser,
  );
  console.log(
    `[e2e-residue] teardown ${browser}: ${entries.length} tracked resource(s) in ${residueFile()}`,
  );
  if (!dmBase) {
    failLoudly(
      `teardown-${browser}: cannot resolve the DM API base — ${entries.length} tracked resource(s) not verified (set DM_URL)`,
    );
    return;
  }

  const authDir = loadAuthDirectory();
  const tokensFor = (username: string) => authDir.get(username);
  const failed = await deleteResources(dmBase, tokensFor, entries);

  const present: TrackedResource[] = [];
  const ctx = await request.newContext();
  try {
    for (let i = 0; i < entries.length; i += 4) {
      await Promise.all(
        entries.slice(i, i + 4).map(async (r) => {
          const tokens = tokensFor(r.username);
          if (!tokens || !(await isGone(ctx, dmBase, tokens, r)))
            present.push(r);
        }),
      );
    }
  } finally {
    await ctx.dispose().catch(() => {});
  }

  const problems: string[] = [];
  if (failed.length)
    problems.push(
      `${failed.length} delete(s) failed: ${failed.map(describeResource).join(', ')}`,
    );
  if (present.length)
    problems.push(
      `${present.length} still present after teardown: ${present.map(describeResource).join(', ')}`,
    );

  const auth = readAuthFromStorageState(String(info.project.use.storageState));
  if (!snapshot || !auth?.tenantKey) {
    problems.push(`snapshot for ${browser} missing — counts not compared`);
  } else {
    let after: { mentors: number; projects: number } | null = null;
    try {
      after = await countResources(dmBase, auth);
    } catch (err) {
      problems.push(`counting after the run failed: ${err}`);
    }
    const delta = (before: number | null, now: number | undefined) =>
      before === null || now === undefined ? 'n/a' : String(now - before);
    const mentorDelta = delta(snapshot.mentors, after?.mentors);
    const projectDelta = delta(snapshot.projects, after?.projects);
    console.log(
      `[e2e-residue] counts ${browser}: mentors before=${snapshot.mentors ?? '?'} after=${after?.mentors ?? '?'} delta=${mentorDelta}; ` +
        `projects before=${snapshot.projects ?? '?'} after=${after?.projects ?? '?'} delta=${projectDelta} ` +
        `(user ${auth.username}, tenant ${auth.tenantKey})`,
    );
    if (
      process.env.E2E_STRICT_COUNTS === '1' &&
      (mentorDelta !== '0' || projectDelta !== '0')
    )
      problems.push(
        `E2E_STRICT_COUNTS: mentor delta ${mentorDelta}, project delta ${projectDelta}`,
      );
    try {
      const all = await listResources(dmBase, auth);
      const since = Date.parse(snapshot.runStart);
      const newSince = (
        items: Record<string, unknown>[],
        re: RegExp,
        kind: string,
        idKey: string,
      ) =>
        items
          .filter((i) => Number(re.exec(String(i.name ?? ''))?.[1]) >= since)
          .map((i) => `  ${kind} ${String(i[idKey])} "${String(i.name)}"`);
      const lines = [
        ...newSince(all.mentors, E2E_MENTOR_RE, 'mentor', 'unique_id'),
        ...newSince(all.projects, E2E_PROJECT_RE, 'project', 'id'),
      ];
      console.log(
        [`[e2e-residue] new since runStart: ${lines.length}`, ...lines].join(
          '\n',
        ),
      );
    } catch (err) {
      console.warn(`[e2e-residue] listing new resources failed: ${err}`);
    }
  }

  if (problems.length) {
    failLoudly(`teardown-${browser}: ${problems.join('; ')}`);
    return;
  }
  console.log(
    `[e2e-residue] teardown ${browser}: OK — all ${entries.length} tracked resource(s) are gone`,
  );
});
