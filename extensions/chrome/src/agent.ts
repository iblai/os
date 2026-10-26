import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  APICallError,
  RetryError,
  streamText,
  tool,
  wrapLanguageModel,
  type LanguageModel,
  type LanguageModelMiddleware,
  type ModelMessage,
  type ToolCallRepairFunction,
  type ToolSet,
} from 'ai';
import { PAGE_MARK, PICTURE_NOTE, instructions } from './prompt';
import type { Picture } from './tools';

/** How long one run may take; it then stops, saying so. Stop ends it any time. */
export const TIME_LIMIT_MS = 200 * 60_000;
/** Only the latest tool result keeps its page state: one numbering per request. */
export const KEEP_SNAPSHOTS = 1;
/**
 * First match wins. Models that read a picture and call tools head the list.
 * `iblai/iblai-pro` closes it: the DM seeds it into the global model registry
 * and the shim short-circuits its availability check (`openai_compat/views.py`
 * — `if name == "iblai": return True`), so it is listed on every platform, but
 * it is a router that never learns tools are in play and gets no picture.
 */
export const MODEL_PREFERENCE = [
  'anthropic/claude-sonnet-5',
  'anthropic/claude-opus-5',
  'openai/gpt-5',
  'iblai/iblai-pro',
];
/** Providers whose listed models read images; `/v1/models` carries no such flag. */
export const VISION_PROVIDERS = ['anthropic', 'openai', 'google'];

export function wantsPicture(model: string): boolean {
  return VISION_PROVIDERS.includes(model.split('/')[0] ?? '');
}

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

const retryable = (cause: unknown) =>
  new APICallError({
    message: cause instanceof Error ? cause.message : String(cause),
    url: '',
    requestBodyValues: undefined,
    isRetryable: true,
    cause,
  });

/**
 * The DM answers 200 before the model does, so a provider failure arrives as
 * an error frame inside the stream — past the point where the SDK retries — and
 * a dropped connection as a TypeError. Each call is read through before the
 * step sees it and such a failure is thrown as retryable, so the SDK's own
 * retry sends the call again and nothing of the failed attempt reaches the run.
 */
export const retryFailedCalls: LanguageModelMiddleware = {
  wrapStream: async ({ doStream, params }) => {
    try {
      const result = await doStream();
      const [check, keep] = result.stream.tee();
      const reader = check.getReader();
      for (;;) {
        const next = await reader.read();
        if (next.done) return { ...result, stream: keep };
        if (next.value.type === 'error') throw retryable(next.value.error);
      }
    } catch (err) {
      if (err instanceof TypeError && !params.abortSignal?.aborted)
        throw retryable(err);
      throw err;
    }
  },
};

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
  return wrapLanguageModel({
    model: provider(cfg.model),
    middleware: retryFailedCalls,
  });
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

const OMITTED = '(earlier page state omitted)';

/**
 * Older page states drop out of what is sent — the tool results before the
 * last `keep`, and the page a user turn carried once an action followed it —
 * so a request holds one numbering, and stays under the DM's 2.5 MB body cap.
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
  const lastTool = toolIndexes[toolIndexes.length - 1] ?? -1;
  return messages.map((message, index) => {
    if (
      message.role === 'user' &&
      index < lastTool &&
      typeof message.content === 'string'
    ) {
      const cut = message.content.indexOf(PAGE_MARK);
      return cut < 0
        ? message
        : {
            ...message,
            content: message.content.slice(0, cut + PAGE_MARK.length) + OMITTED,
          };
    }
    if (message.role !== 'tool' || !stale.has(index)) return message;
    return {
      ...message,
      content: message.content.map((part) =>
        part.type === 'tool-result' && part.output.type === 'text'
          ? {
              ...part,
              output: { type: 'text' as const, value: OMITTED },
            }
          : part,
      ),
    };
  });
}

export type AgentEvent =
  | { type: 'text'; text: string }
  /** Words said before an action in the same step: not the reply. */
  | { type: 'narration'; text: string }
  | { type: 'tool-call'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string }
  /** A call the SDK could not run or a tool that threw; the run carries on. */
  | { type: 'tool-error'; toolName: string }
  | { type: 'error'; message: string; statusCode?: number }
  | { type: 'finish'; reason: string }
  | { type: 'abort' };

export interface RunOptions {
  model: LanguageModel;
  messages: ModelMessage[];
  tools: ToolSet;
  signal: AbortSignal;
  onEvent: (event: AgentEvent) => void;
  timeLimitMs?: number;
  /** The user's preferred language, named in the system prompt when known. */
  language?: string;
  /** The latest picture of the tab, sent with every model call. */
  picture?: () => Picture | null;
  /** The tools act on a point of the picture too (click_at, type_at). */
  positions?: boolean;
}

export interface RunResult {
  /** The reply: the words of the step that took no action. */
  text: string;
  /** The conversation so far, including this run's assistant and tool messages. */
  messages: ModelMessage[];
  steps: number;
  stoppedBy: 'time' | null;
}

/** Only the message and status reach the UI; the error also carries the request body. */
export function describeError(error: unknown): AgentEvent {
  // A call the SDK retried and gave up on says why the last attempt failed.
  if (RetryError.isInstance(error)) return describeError(error.lastError);
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

/**
 * A call the SDK cannot run — a tool it doesn't have, input that isn't JSON —
 * goes back to the model once with its error, offered the same tools without
 * their `execute`; the call it makes instead runs in the step. None, and the
 * call fails as before.
 */
const repairWith =
  (
    model: LanguageModel,
    signal: AbortSignal,
  ): ToolCallRepairFunction<ToolSet> =>
  async ({ toolCall, tools, instructions, messages, error }) => {
    const { toolCallId, toolName } = toolCall;
    let input: unknown = toolCall.input;
    try {
      input = JSON.parse(toolCall.input);
    } catch {
      // Not JSON is what the error says; the model sees it as it was sent.
    }
    const answer = streamText({
      model,
      instructions,
      messages: [
        ...messages,
        {
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName, input }],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName,
              output: { type: 'error-text', value: error.message },
            },
          ],
        },
      ],
      tools: Object.fromEntries(
        Object.entries(tools).map(([name, { description, inputSchema }]) => [
          name,
          tool({ description, inputSchema }),
        ]),
      ),
      toolChoice: 'required',
      abortSignal: signal,
    });
    const call = (await answer.toolCalls).find((made) => !made.invalid);
    return call
      ? {
          type: 'tool-call',
          toolCallId,
          toolName: call.toolName,
          input: JSON.stringify(call.input),
        }
      : null;
  };

export async function runAgent(options: RunOptions): Promise<RunResult> {
  let stoppedBy: RunResult['stoppedBy'] = null;
  const deadline = AbortSignal.timeout(options.timeLimitMs ?? TIME_LIMIT_MS);
  const signal = AbortSignal.any([options.signal, deadline]);

  const result = streamText({
    model: options.model,
    instructions: instructions(options.language, options.positions),
    messages: options.messages,
    tools: options.tools,
    abortSignal: signal,
    // No step cap: the SDK's default stops after one step.
    // ponytail: every call re-sends the earlier steps, so a run of a few
    // thousand steps fills the model's context and ends on its error — drop
    // the oldest steps if that shows.
    stopWhen: () => false,
    experimental_repairToolCall: repairWith(options.model, signal),
    // The picture rides a trailing user message, never a tool result: the
    // OpenAI wire flattens tool results to text. Per call only — it is not
    // part of the transcript the next step or the next run gets.
    prepareStep: ({ messages }) => {
      const pruned = pruneOldSnapshots(messages);
      const picture = options.picture?.();
      if (!picture) return { messages: pruned };
      const shown: ModelMessage = {
        role: 'user',
        content:
          'dataUrl' in picture
            ? [
                {
                  type: 'image',
                  image: picture.dataUrl,
                  mediaType: 'image/jpeg',
                },
                { type: 'text', text: PICTURE_NOTE },
              ]
            : [{ type: 'text', text: picture.note }],
      };
      return { messages: [...pruned, shown] };
    },
  });

  let text = '';
  let steps = 0;
  // A step's words are narration when an action follows them and the reply
  // when the step ends without one, so they are held until that is known.
  // ponytail: nothing crosses the port while they are held; a text-only
  // stretch past ~30 s could idle the MV3 worker — add an `ack` heartbeat if
  // `errorWorkerGone` ever shows up.
  let said = '';
  let acted = false;
  const flush = () => {
    if (said)
      options.onEvent({ type: acted ? 'narration' : 'text', text: said });
    if (!acted) text += said;
    said = '';
  };
  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        said += part.text;
        break;
      case 'tool-call':
        acted = true;
        flush();
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
        options.onEvent({ type: 'tool-error', toolName: part.toolName });
        break;
      case 'error':
        flush();
        options.onEvent(describeError(part.error));
        break;
      case 'finish-step':
        flush();
        acted = false;
        steps += 1;
        break;
      case 'finish':
        options.onEvent({ type: 'finish', reason: part.finishReason });
        break;
      case 'abort':
        flush();
        if (deadline.aborted) stoppedBy = 'time';
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
