/**
 * Agents a tenant binds to one purpose, named in its metadata so the answer is
 * the same for everyone in that organization, on every machine.
 */

export const PURPOSE_AGENTS_KEY = 'purpose_agents';

/**
 * Purposes this organization cannot serve at all, recorded beside the agents.
 *
 * Only an administrator ever finds this out — everyone else is stopped before
 * the create that reveals it — so without writing it down, their colleagues
 * are told a manager can fix it by opening the panel, which is untrue.
 */
export const PURPOSE_UNSUPPORTED_KEY = 'unsupported';

export const AGENT_PURPOSES = {
  CHROME_EXTENSION: 'chrome_extension',
} as const;

export type AgentPurpose = (typeof AGENT_PURPOSES)[keyof typeof AGENT_PURPOSES];

export const BROWSING_ASSISTANT_NAME = 'Browsing Assistant';

/**
 * ibl.ai's own router, so a new agent works in every organization: a
 * third-party provider would only answer where that organization has a key.
 */
export const BROWSING_ASSISTANT_MODEL = {
  provider: 'iblai',
  name: 'iblai-pro',
} as const;

export type TenantMetadataBlob = Record<string, unknown>;

/** Older writes stored metadata values as JSON strings. */
function parsed(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  const candidate = parsed(value);
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : null;
}

/** Null for anything unusable: every caller falls back the same way. */
export function readPurposeAgent(
  metadata: TenantMetadataBlob | undefined | null,
  purpose: AgentPurpose,
): string | null {
  const agents = asRecord(metadata?.[PURPOSE_AGENTS_KEY]);
  const id = agents?.[purpose];
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/**
 * A merged copy for the caller to PUT: the endpoint replaces the object it is
 * given, so sending only this key would delete the rest of the tenant's
 * metadata.
 */
export function withPurposeAgent(
  metadata: TenantMetadataBlob | undefined | null,
  purpose: AgentPurpose,
  mentorId: string,
): TenantMetadataBlob {
  const agents = { ...(asRecord(metadata?.[PURPOSE_AGENTS_KEY]) ?? {}) };
  const unsupported = { ...(asRecord(agents[PURPOSE_UNSUPPORTED_KEY]) ?? {}) };
  // An agent exists now, so a verdict recorded earlier is stale. The key is
  // dropped entirely rather than left empty on every organization.
  delete unsupported[purpose];
  if (Object.keys(unsupported).length) {
    agents[PURPOSE_UNSUPPORTED_KEY] = unsupported;
  } else {
    delete agents[PURPOSE_UNSUPPORTED_KEY];
  }
  return {
    ...(metadata ?? {}),
    [PURPOSE_AGENTS_KEY]: { ...agents, [purpose]: mentorId },
  };
}

/** True only where an administrator has already found this purpose refused. */
export function readPurposeUnsupported(
  metadata: TenantMetadataBlob | undefined | null,
  purpose: AgentPurpose,
): boolean {
  const agents = asRecord(metadata?.[PURPOSE_AGENTS_KEY]);
  return asRecord(agents?.[PURPOSE_UNSUPPORTED_KEY])?.[purpose] === true;
}

/** A merged copy recording that this purpose cannot run here. See above. */
export function withPurposeUnsupported(
  metadata: TenantMetadataBlob | undefined | null,
  purpose: AgentPurpose,
): TenantMetadataBlob {
  const agents = asRecord(metadata?.[PURPOSE_AGENTS_KEY]) ?? {};
  return {
    ...(metadata ?? {}),
    [PURPOSE_AGENTS_KEY]: {
      ...agents,
      [PURPOSE_UNSUPPORTED_KEY]: {
        ...(asRecord(agents[PURPOSE_UNSUPPORTED_KEY]) ?? {}),
        [purpose]: true,
      },
    },
  };
}
