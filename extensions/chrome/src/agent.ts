import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  APICallError,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type StepResult,
  type ToolSet,
} from 'ai';
import { instructions } from './prompt';

export const MAX_STEPS = 40;
export const TOKEN_BUDGET = 200_000;
/** How many of the latest tool results keep their page state in the request. */
export const KEEP_SNAPSHOTS = 2;
/**
 * First match wins. `iblai/iblai-pro` heads it because the DM seeds it into the
 * global model registry and the shim short-circuits its availability check
 * (`openai_compat/views.py` — `if name == "iblai": return True`), so it is
 * listed and resolvable on every platform with no credential row of its own; it
 * is also the DM's own `DEFAULT_MENTOR_LLM_MODEL`. Which means the entries below
 * it are unreachable in practice — they are the answer only if a platform ever
 * stops listing it.
 */
export const MODEL_PREFERENCE = [
  'iblai/iblai-pro',
  'anthropic/claude-opus-5',
  'anthropic/claude-sonnet-5',
  'openai/gpt-5',
];

export interface Credentials {
  /** Platform key (or org slug); the DM resolves either. */
  org: string;
  username: string;
  dmToken: string;
}

export interface ModelConfig extends Credentials {
  /** The DM's streaming (ASGI) host — see `completionsBase` in settings.ts. */
  base: string;
  /** `provider/model`, as listed by GET …/v1/models. */
  model: string;
}

export function orgBase(base: string, org: string): string {
  return `${base.replace(/\/+$/, '')}/api/ai-mentor/orgs/${encodeURIComponent(org)}/v1`;
}

/** The DM honours `parallel_tool_calls`; one page cannot take two actions at once. */
export function transformBody(
  body: Record<string, unknown>,
  username: string,
): Record<string, unknown> {
  return { ...body, user: username, parallel_tool_calls: false };
}

export function buildModel(cfg: ModelConfig): LanguageModel {
  const provider = createOpenAICompatible({
    name: 'ibl-dm',
    baseURL: orgBase(cfg.base, cfg.org),
    // The DM's manager-token scheme; `Bearer` is reserved for platform API keys.
    headers: { Authorization: `Token ${cfg.dmToken}` },
    includeUsage: true,
    // A member who is not a platform admin is only allowed onto their own path.
    queryParams: { learner_id: cfg.username },
    transformRequestBody: (body) => transformBody(body, cfg.username),
  });
  return provider(cfg.model);
}

/**
 * The status plus whatever the body says, because the two 403s this endpoint
 * can return are indistinguishable from the status alone: the DM's own
 * `CannotAccessResource` arrives as the OpenAI envelope with
 * `code: "cannot_access_resource"` (no active `UserPlatformLink` for the org on
 * that deployment), while an edge proxy refusing the `chrome-extension://`
 * origin arrives as something else entirely.
 */
export async function describeHttpError(response: Response): Promise<string> {
  const status = `HTTP ${response.status}`;
  let body = '';
  try {
    body = await response.text();
  } catch {
    return status;
  }
  try {
    const parsed = JSON.parse(body) as {
      error?: { code?: unknown; message?: unknown };
    };
    const detail = parsed.error?.code ?? parsed.error?.message;
    if (typeof detail === 'string' && detail) return `${status} ${detail}`;
  } catch {
    // Not JSON — fall through and quote the body itself.
  }
  const snippet = body.trim().replace(/\s+/g, ' ').slice(0, 200);
  return snippet ? `${status} ${snippet}` : status;
}

function modelIds(body: unknown): string[] {
  const data = (body as { data?: Array<{ id?: unknown }> } | null)?.data;
  return (Array.isArray(data) ? data : [])
    .map((entry) => entry?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * Walks `bases` in order and returns the first host that answers with models.
 * `learner_id` rides on every attempt — a member who is not a platform admin is
 * 403'd without it. When no host answers, the throw names each one and why, so
 * the next run says which of them failed how instead of a bare status.
 */
export async function listModels(
  creds: Credentials,
  bases: string[],
): Promise<string[]> {
  const misses: string[] = [];
  let answeredEmpty = false;
  for (const base of bases) {
    const url = `${orgBase(base, creds.org)}/models?learner_id=${encodeURIComponent(creds.username)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Token ${creds.dmToken}` },
      });
    } catch (err) {
      misses.push(`${base} → ${err instanceof Error ? err.message : 'failed'}`);
      continue;
    }
    if (!response.ok) {
      misses.push(`${base} → ${await describeHttpError(response)}`);
      continue;
    }
    let ids: string[] = [];
    try {
      ids = modelIds(await response.json());
    } catch {
      misses.push(`${base} → unparseable body`);
      continue;
    }
    if (ids.length) return ids;
    // A host that answers with an empty list is reachable and authorised; the
    // platform simply holds no usable model credentials.
    answeredEmpty = true;
  }
  if (answeredEmpty) return [];
  throw new Error(`Model list failed. ${misses.join('; ')}`);
}

export function pickModel(ids: string[]): string {
  return (
    MODEL_PREFERENCE.find((preferred) => ids.includes(preferred)) ??
    ids[0] ??
    ''
  );
}

export function usedTokens(steps: Array<StepResult<ToolSet>>): number {
  return steps.reduce(
    (sum, step) =>
      sum + (step.usage?.inputTokens ?? 0) + (step.usage?.outputTokens ?? 0),
    0,
  );
}

/**
 * Older page states drop out of what is sent: the model only needs the latest
 * ones, and the DM caps a request body at Django's default 2.5 MB.
 */
export function pruneOldSnapshots(
  messages: ModelMessage[],
  keep = KEEP_SNAPSHOTS,
): ModelMessage[] {
  const toolIndexes = messages
    .map((message, index) => (message.role === 'tool' ? index : -1))
    .filter((index) => index >= 0);
  const stale = new Set(
    toolIndexes.slice(0, Math.max(0, toolIndexes.length - keep)),
  );
  return messages.map((message, index) => {
    if (message.role !== 'tool' || !stale.has(index)) return message;
    return {
      ...message,
      content: message.content.map((part) =>
        part.type === 'tool-result' && part.output.type === 'text'
          ? {
              ...part,
              output: {
                type: 'text' as const,
                value: '(earlier page state omitted)',
              },
            }
          : part,
      ),
    };
  });
}

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string }
  | { type: 'error'; message: string; statusCode?: number }
  | { type: 'finish'; reason: string }
  | { type: 'abort' };

export interface RunOptions {
  model: LanguageModel;
  messages: ModelMessage[];
  tools: ToolSet;
  signal: AbortSignal;
  onEvent: (event: AgentEvent) => void;
  maxSteps?: number;
  tokenBudget?: number;
  /** The user's preferred language, named in the system prompt when known. */
  language?: string;
}

export interface RunResult {
  text: string;
  /** The conversation so far, including this run's assistant and tool messages. */
  messages: ModelMessage[];
  steps: number;
  stoppedBy: 'steps' | 'tokens' | null;
}

/** Only the message and status reach the UI; the error also carries the request body. */
export function describeError(error: unknown): AgentEvent {
  if (APICallError.isInstance(error)) {
    return {
      type: 'error',
      message: error.message,
      statusCode: error.statusCode,
    };
  }
  return {
    type: 'error',
    message: error instanceof Error ? error.message : String(error),
  };
}

export async function runAgent(options: RunOptions): Promise<RunResult> {
  const maxSteps = options.maxSteps ?? MAX_STEPS;
  const budget = options.tokenBudget ?? TOKEN_BUDGET;
  let stoppedBy: RunResult['stoppedBy'] = null;

  const result = streamText({
    model: options.model,
    instructions: instructions(options.language),
    messages: options.messages,
    tools: options.tools,
    abortSignal: options.signal,
    timeout: { totalMs: 600_000 },
    stopWhen: [
      ({ steps }) => {
        if (steps.length < maxSteps) return false;
        stoppedBy = 'steps';
        return true;
      },
      ({ steps }) => {
        if (usedTokens(steps) < budget) return false;
        stoppedBy = 'tokens';
        return true;
      },
    ],
    prepareStep: ({ messages }) => ({ messages: pruneOldSnapshots(messages) }),
  });

  let text = '';
  let steps = 0;
  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        text += part.text;
        options.onEvent({ type: 'text', text: part.text });
        break;
      case 'tool-call':
        options.onEvent({
          type: 'tool-call',
          toolName: part.toolName,
          input: part.input,
        });
        break;
      case 'tool-result':
        options.onEvent({ type: 'tool-result', toolName: part.toolName });
        break;
      case 'tool-error':
        options.onEvent(describeError(part.error));
        break;
      case 'error':
        options.onEvent(describeError(part.error));
        break;
      case 'finish-step':
        steps += 1;
        break;
      case 'finish':
        options.onEvent({ type: 'finish', reason: part.finishReason });
        break;
      case 'abort':
        options.onEvent({ type: 'abort' });
        break;
      default:
        break;
    }
  }

  // `result.response` carries only the last step; each step holds its own
  // assistant and tool messages, and together they are this run's transcript.
  let responseMessages: ModelMessage[] = [];
  try {
    responseMessages = (await result.steps).flatMap(
      (step) => step.response.messages,
    );
  } catch {
    // An aborted or failed run has no steps; the caller keeps what it sent.
  }
  return {
    text,
    messages: [...options.messages, ...responseMessages],
    steps,
    stoppedBy,
  };
}
