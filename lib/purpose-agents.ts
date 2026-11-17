/**
 * Agents a tenant binds to one purpose, named in its metadata so the answer is
 * the same for everyone in that organization, on every machine.
 */

export const PURPOSE_AGENTS_KEY = 'purpose_agents';

export const AGENT_PURPOSES = {
  CHROME_EXTENSION: 'chrome_extension',
} as const;

export type AgentPurpose = (typeof AGENT_PURPOSES)[keyof typeof AGENT_PURPOSES];

export const BROWSING_ASSISTANT_NAME = 'Browsing Assistant';

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
  return {
    ...(metadata ?? {}),
    [PURPOSE_AGENTS_KEY]: {
      ...(asRecord(metadata?.[PURPOSE_AGENTS_KEY]) ?? {}),
      [purpose]: mentorId,
    },
  };
}
