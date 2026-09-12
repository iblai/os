import { test as setup } from '@playwright/test';
import { navigateToMentorApp } from '../utils/auth';
import { dmBaseFromEnv, resolveDmApiBase } from '../utils/dm-api';
import {
  browserOf,
  countResources,
  failLoudly,
  readAuthFromStorageState,
  runId,
  writeSnapshot,
} from '../utils/resource-tracker';

/**
 * Records the admin user's mentor + project counts before any journey runs.
 * `residue.teardown.ts` compares against them (strictly with
 * `E2E_STRICT_COUNTS=1`) and reads the resolved DM base from the snapshot.
 */
setup('snapshot tenant mentor and project counts', async ({ page }, info) => {
  setup.setTimeout(180_000);
  const browser = browserOf(info.project.name);
  const auth = readAuthFromStorageState(String(info.project.use.storageState));
  if (!auth?.tenantKey) {
    failLoudly(`snapshot-${browser}: no admin auth in storageState — skipped`);
    return;
  }

  let dmBase = dmBaseFromEnv();
  if (!dmBase) {
    await navigateToMentorApp(page);
    dmBase = await resolveDmApiBase(page).catch(() => '');
  }
  if (!dmBase) {
    failLoudly(
      `snapshot-${browser}: cannot resolve the DM API base (set DM_URL)`,
    );
    return;
  }

  let counts: { mentors: number; projects: number } | null = null;
  try {
    counts = await countResources(dmBase, auth);
  } catch (err) {
    failLoudly(`snapshot-${browser}: counting failed: ${err}`);
  }
  writeSnapshot({
    runId: runId(),
    runStart: new Date().toISOString(),
    browser,
    dmBase,
    username: auth.username,
    tenantKey: auth.tenantKey,
    mentors: counts?.mentors ?? null,
    projects: counts?.projects ?? null,
  });
  console.log(
    `[e2e-residue] snapshot ${browser}: mentors=${counts?.mentors ?? '?'} projects=${counts?.projects ?? '?'} ` +
      `(user ${auth.username}, tenant ${auth.tenantKey}, dm ${dmBase}, run ${runId()})`,
  );
});
