/**
 * Direct DM API helpers for the Virtual Machine Shell network feature —
 * network policies, VM secrets and an agent's VM network settings.
 *
 * Journey 77 drives the UI for every checkpoint it covers, but it needs
 * fixtures the UI would be slow or circular to produce (a policy already
 * bound to an agent to prove a delete is refused, a secret whose host the
 * policy lacks) and it must leave no residue behind: a policy bound to an
 * agent cannot be deleted at all, and org-level records are NOT reaped by
 * the run-level residue teardown (which only knows mentors and projects).
 *
 * Endpoints (see the feature ticket / `VIRTUAL_MACHINE_ENDPOINTS` in
 * `@iblai/data-layer`):
 *   GET/POST   {dmBase}/api/ai-account/orgs/{org}/virtual-machine-network-policy/
 *   DELETE     …/virtual-machine-network-policy/?id={id}
 *   GET/POST   {dmBase}/api/ai-account/orgs/{org}/virtual-machine-secret/
 *   DELETE     …/virtual-machine-secret/?env_var={envVar}
 *   PUT        {dmBase}/api/ai-mentor/orgs/{org}/users/{user}/mentors/{mentor}/settings/
 *
 * Auth follows `mentor-cleanup.ts`: `dm_token`, `userData.user_nicename` and
 * `current_tenant` are read off the already-navigated page's localStorage,
 * and the DM base is resolved from the app's own traffic (`dm-api.ts`).
 *
 * Writes THROW on failure so a spec that seeds a fixture fails loudly on the
 * missing backend rather than asserting against nothing. Deletes are
 * best-effort (cleanup must never fail a run) and treat 404 as success.
 */

import type { Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

import { tryResolveDmApiBase } from './dm-api';

export interface VmApiContext {
  dmBase: string;
  dmToken: string;
  username: string;
  tenantKey: string;
}

export interface VmNetworkPolicyRecord {
  id: number;
  name: string;
  allowed_hosts: string[];
  description: string;
}

export interface VmSecretRecord {
  id: number;
  name: string;
  env_var: string;
  allow_hosts: string[];
  source_credential_id: number | null;
  source_field: string;
}

/**
 * Resolves the DM base and the signed-in user's auth context, or `null`
 * when either is unavailable (cleanup paths log and skip; seeding paths
 * throw a clear error instead).
 */
export async function resolveVmApiContext(
  page: Page,
): Promise<VmApiContext | null> {
  const dmBase = await tryResolveDmApiBase(page, {
    allowReload: false,
    timeout: 10_000,
  });
  if (!dmBase) return null;

  const auth = await page.evaluate(() => {
    const dmToken = localStorage.getItem('dm_token');
    let username: string | null = null;
    try {
      const raw = localStorage.getItem('userData');
      if (raw) username = JSON.parse(raw)?.user_nicename ?? null;
    } catch {
      // ignore
    }
    let tenantKey: string | null = null;
    try {
      const raw = localStorage.getItem('current_tenant');
      if (raw) {
        const parsed = JSON.parse(raw);
        tenantKey = typeof parsed === 'string' ? parsed : (parsed?.key ?? null);
      }
    } catch {
      // ignore
    }
    return { dmToken, username, tenantKey };
  });

  if (!auth.dmToken || !auth.username || !auth.tenantKey) return null;
  return {
    dmBase,
    dmToken: auth.dmToken,
    username: auth.username,
    tenantKey: auth.tenantKey,
  };
}

async function requireVmApiContext(page: Page): Promise<VmApiContext> {
  const ctx = await resolveVmApiContext(page);
  if (!ctx) {
    throw new Error(
      '[virtual-machine-api] Could not resolve the DM API base or the auth ' +
        'context (dm_token / userData / current_tenant) from the page — set ' +
        'DM_URL to override the base, and make sure the page is signed in.',
    );
  }
  return ctx;
}

function policiesUrl(ctx: VmApiContext): string {
  return `${ctx.dmBase}/api/ai-account/orgs/${encodeURIComponent(ctx.tenantKey)}/virtual-machine-network-policy/`;
}

function secretsUrl(ctx: VmApiContext): string {
  return `${ctx.dmBase}/api/ai-account/orgs/${encodeURIComponent(ctx.tenantKey)}/virtual-machine-secret/`;
}

function settingsUrl(ctx: VmApiContext, mentorId: string): string {
  return `${ctx.dmBase}/api/ai-mentor/orgs/${encodeURIComponent(ctx.tenantKey)}/users/${encodeURIComponent(ctx.username)}/mentors/${encodeURIComponent(mentorId)}/settings/`;
}

function authHeaders(ctx: VmApiContext): Record<string, string> {
  return {
    Authorization: `Token ${ctx.dmToken}`,
    'Content-Type': 'application/json',
  };
}

/** Lists the org's network policies (empty on any failure). */
export async function listVmNetworkPolicies(
  page: Page,
): Promise<VmNetworkPolicyRecord[]> {
  const ctx = await resolveVmApiContext(page);
  if (!ctx) return [];
  try {
    const res = await page.request.get(policiesUrl(ctx), {
      headers: authHeaders(ctx),
      timeout: 15_000,
    });
    if (!res.ok()) return [];
    const body = (await res.json()) as unknown;
    return Array.isArray(body) ? (body as VmNetworkPolicyRecord[]) : [];
  } catch {
    return [];
  }
}

/** Lists the org's VM secrets (never their values — the API has none). */
export async function listVmSecrets(page: Page): Promise<VmSecretRecord[]> {
  const ctx = await resolveVmApiContext(page);
  if (!ctx) return [];
  try {
    const res = await page.request.get(secretsUrl(ctx), {
      headers: authHeaders(ctx),
      timeout: 15_000,
    });
    if (!res.ok()) return [];
    const body = (await res.json()) as unknown;
    return Array.isArray(body) ? (body as VmSecretRecord[]) : [];
  } catch {
    return [];
  }
}

/** Creates a network policy; throws with the response body on failure. */
export async function createVmNetworkPolicy(
  page: Page,
  body: { name: string; allowed_hosts: string[]; description?: string },
): Promise<VmNetworkPolicyRecord> {
  const ctx = await requireVmApiContext(page);
  const res = await page.request.post(policiesUrl(ctx), {
    headers: authHeaders(ctx),
    data: body,
    timeout: 20_000,
  });
  if (!res.ok()) {
    throw new Error(
      `[virtual-machine-api] POST network policy "${body.name}" → ${res.status()} ${await res.text()}`,
    );
  }
  return (await res.json()) as VmNetworkPolicyRecord;
}

/** Creates a stored-value VM secret; throws with the response body on failure. */
export async function createVmSecret(
  page: Page,
  body: { name: string; env_var: string; allow_hosts: string[]; value: string },
): Promise<VmSecretRecord> {
  const ctx = await requireVmApiContext(page);
  const res = await page.request.post(secretsUrl(ctx), {
    headers: authHeaders(ctx),
    data: body,
    timeout: 20_000,
  });
  if (!res.ok()) {
    throw new Error(
      `[virtual-machine-api] POST VM secret "${body.env_var}" → ${res.status()} ${await res.text()}`,
    );
  }
  return (await res.json()) as VmSecretRecord;
}

/**
 * Partial PUT of an agent's VM network settings — the same keys the UI
 * sends (`enable_virtual_machine`, `virtual_machine_egress`,
 * `virtual_machine_network_policy_id`, `virtual_machine_secret_ids`).
 * Throws on failure so a fixture that did not land is not silently asserted.
 */
export async function putMentorVmNetworkSettings(
  page: Page,
  mentorId: string,
  body: {
    enable_virtual_machine?: boolean;
    virtual_machine_egress?: 'none' | 'registries' | 'public' | 'custom';
    virtual_machine_network_policy_id?: number | null;
    virtual_machine_secret_ids?: number[];
  },
): Promise<void> {
  const ctx = await requireVmApiContext(page);
  const res = await page.request.put(settingsUrl(ctx, mentorId), {
    headers: authHeaders(ctx),
    data: body,
    timeout: 20_000,
  });
  if (!res.ok()) {
    throw new Error(
      `[virtual-machine-api] PUT settings for ${mentorId} → ${res.status()} ${await res.text()}`,
    );
  }
}

/**
 * Best-effort: moves an agent off any policy and unbinds its secrets so the
 * records can be deleted. Never throws.
 */
export async function releaseMentorVmNetwork(
  page: Page,
  mentorId: string,
): Promise<void> {
  try {
    await putMentorVmNetworkSettings(page, mentorId, {
      virtual_machine_egress: 'none',
      virtual_machine_network_policy_id: null,
      virtual_machine_secret_ids: [],
    });
  } catch (err) {
    logger.warn(
      `[virtual-machine-api] Could not release VM network settings for ${mentorId}: ${err}`,
    );
  }
}

/** Best-effort delete of every policy with the given name(s). Never throws. */
export async function deleteVmNetworkPoliciesByName(
  page: Page,
  names: Iterable<string>,
): Promise<void> {
  const wanted = new Set(names);
  if (wanted.size === 0) return;
  const ctx = await resolveVmApiContext(page);
  if (!ctx) {
    logger.warn(
      '[virtual-machine-api] No API context — skipping network policy cleanup',
    );
    return;
  }
  const policies = await listVmNetworkPolicies(page);
  for (const policy of policies) {
    if (!wanted.has(policy.name)) continue;
    try {
      const res = await page.request.delete(
        `${policiesUrl(ctx)}?id=${encodeURIComponent(String(policy.id))}`,
        { headers: authHeaders(ctx), timeout: 15_000 },
      );
      if (res.ok() || res.status() === 404) {
        logger.info(
          `[virtual-machine-api] Deleted network policy ${policy.name} (#${policy.id})`,
        );
      } else {
        logger.warn(
          `[virtual-machine-api] DELETE network policy #${policy.id} → ${res.status()} ${await res.text()}`,
        );
      }
    } catch (err) {
      logger.warn(
        `[virtual-machine-api] Failed to delete network policy #${policy.id}: ${err}`,
      );
    }
  }
}

/** Best-effort delete of the VM secrets with the given env var(s). Never throws. */
export async function deleteVmSecretsByEnvVar(
  page: Page,
  envVars: Iterable<string>,
): Promise<void> {
  const wanted = new Set(envVars);
  if (wanted.size === 0) return;
  const ctx = await resolveVmApiContext(page);
  if (!ctx) {
    logger.warn(
      '[virtual-machine-api] No API context — skipping VM secret cleanup',
    );
    return;
  }
  for (const envVar of wanted) {
    try {
      const res = await page.request.delete(
        `${secretsUrl(ctx)}?env_var=${encodeURIComponent(envVar)}`,
        { headers: authHeaders(ctx), timeout: 15_000 },
      );
      if (res.ok() || res.status() === 404) {
        logger.info(`[virtual-machine-api] Deleted VM secret ${envVar}`);
      } else {
        logger.warn(
          `[virtual-machine-api] DELETE VM secret ${envVar} → ${res.status()} ${await res.text()}`,
        );
      }
    } catch (err) {
      logger.warn(
        `[virtual-machine-api] Failed to delete VM secret ${envVar}: ${err}`,
      );
    }
  }
}
