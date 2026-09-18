import {
  APICallError,
  jsonSchema,
  tool,
  type ModelMessage,
  type ToolSet,
} from 'ai';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  orgBase,
  buildModel,
  describeError,
  listModels,
  pickModel,
  pruneOldSnapshots,
  runAgent,
  transformBody,
  usedTokens,
  type AgentEvent,
} from '../agent';
import { INSTRUCTIONS } from '../prompt';

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

const finish = (unified: 'stop' | 'tool-calls') => ({
  type: 'finish',
  finishReason: { unified, raw: unified },
  usage: USAGE,
});

const toolStep = (input: unknown = { element: 5 }) => ({
  stream: simulateReadableStream({
    chunks: [
      { type: 'stream-start', warnings: [] },
      // The provider spec streams tool input as JSON text.
      {
        type: 'tool-call',
        toolCallId: 'c1',
        toolName: 'click',
        input: JSON.stringify(input),
      },
      finish('tool-calls'),
    ],
  }),
});

const textStep = (text = 'Done.') => ({
  stream: simulateReadableStream({
    chunks: [
      { type: 'stream-start', warnings: [] },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: text },
      { type: 'text-end', id: 't1' },
      finish('stop'),
    ],
  }),
});

function mockModel(
  ...steps: Array<ReturnType<typeof toolStep> | ReturnType<typeof textStep>>
) {
  const queue = [...steps];
  return new MockLanguageModelV4({
    doStream: async () => (queue.shift() ?? textStep('')) as never,
  });
}

const clickExecute = () =>
  vi.fn(async (_input: { element: number }) => 'Clicked.');

function clickTools(
  execute: ReturnType<typeof clickExecute> = clickExecute(),
): ToolSet {
  return {
    click: tool({
      description: 'click',
      inputSchema: jsonSchema<{ element: number }>({
        type: 'object',
        properties: { element: { type: 'integer' } },
        required: ['element'],
        additionalProperties: false,
      }),
      execute,
    }),
  };
}

const creds = {
  org: 'acme corp',
  username: 'jane',
  dmToken: 't',
};
const user = (content: string): ModelMessage => ({ role: 'user', content });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request shaping', () => {
  it('builds the DM base path and encodes the platform', () => {
    expect(orgBase('https://asgi.example/', creds.org)).toBe(
      'https://asgi.example/api/ai-mentor/orgs/acme%20corp/v1',
    );
  });

  it('adds the user and forbids parallel tool calls', () => {
    expect(transformBody({ model: 'm', stream: true }, 'jane')).toEqual({
      model: 'm',
      stream: true,
      user: 'jane',
      parallel_tool_calls: false,
    });
  });

  it('picks the preferred model, else the first, else nothing', () => {
    // iblai-pro heads the list: the DM seeds it globally and the shim reports it
    // available for every platform, so it is the answer wherever it is listed.
    expect(
      pickModel(['openai/gpt-5', 'anthropic/claude-opus-5', 'iblai/iblai-pro']),
    ).toBe('iblai/iblai-pro');
    expect(
      pickModel([
        'openai/gpt-5',
        'anthropic/claude-sonnet-5',
        'anthropic/claude-opus-5',
      ]),
    ).toBe('anthropic/claude-opus-5');
    expect(pickModel(['openai/gpt-5', 'anthropic/claude-sonnet-5'])).toBe(
      'anthropic/claude-sonnet-5',
    );
    expect(pickModel(['bedrock/anthropic.claude-opus-5'])).toBe(
      'bedrock/anthropic.claude-opus-5',
    );
    expect(pickModel([])).toBe('');
  });

  it('sums step usage and treats missing counts as zero', () => {
    const steps = [
      { usage: { inputTokens: 10, outputTokens: 5 } },
      { usage: { inputTokens: undefined, outputTokens: 3 } },
      {},
    ] as never;
    expect(usedTokens(steps)).toBe(18);
  });
});

describe('pruneOldSnapshots', () => {
  const toolMessage = (
    id: string,
    output: unknown = { type: 'text', value: `page ${id}` },
  ): ModelMessage =>
    ({
      role: 'tool',
      content: [
        { type: 'tool-result', toolCallId: id, toolName: 'click', output },
      ],
    }) as ModelMessage;

  it('keeps the latest tool results and blanks the older text outputs', () => {
    const messages = [
      user('go'),
      toolMessage('1'),
      toolMessage('2', { type: 'json', value: { keep: true } }),
      toolMessage('3'),
      toolMessage('4'),
    ];
    const pruned = pruneOldSnapshots(messages, 2);
    const output = (index: number) =>
      (pruned[index] as { content: Array<{ output: { value: unknown } }> })
        .content[0].output.value;
    expect(output(1)).toBe('(earlier page state omitted)');
    expect(output(2)).toEqual({ keep: true });
    expect(output(3)).toBe('page 3');
    expect(output(4)).toBe('page 4');
    expect(pruned[0]).toBe(messages[0]);
    expect(messages[1]).toEqual(toolMessage('1'));
  });

  it('is a no-op within the keep window', () => {
    const messages = [user('go'), toolMessage('1')];
    expect(pruneOldSnapshots(messages)).toEqual(messages);
  });
});

describe('describeError', () => {
  it('keeps the status of API errors and the message of everything else', () => {
    const api = new APICallError({
      message: 'Insufficient credits.',
      url: 'u',
      requestBodyValues: {},
      statusCode: 402,
    });
    expect(describeError(api)).toEqual({
      type: 'error',
      message: 'Insufficient credits.',
      statusCode: 402,
    });
    expect(describeError(new Error('boom'))).toEqual({
      type: 'error',
      message: 'boom',
    });
    expect(describeError('text')).toEqual({ type: 'error', message: 'text' });
  });
});

describe('listModels', () => {
  const models = (ids: unknown[]) =>
    new Response(
      JSON.stringify({ object: 'list', data: ids.map((id) => ({ id })) }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  const bases = ['https://base.manager.example', 'https://asgi.example'];

  it('calls the models endpoint on the member path with the token header', async () => {
    const fetchMock = vi.fn(async () => models(['openai/gpt-5', 7, undefined]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(listModels(creds, bases)).resolves.toEqual(['openai/gpt-5']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://base.manager.example/api/ai-mentor/orgs/acme%20corp/v1/models?learner_id=jane',
    );
    expect(init.headers).toEqual({ Authorization: 'Token t' });
  });

  // The whole point of the candidate list: the platform serves this endpoint
  // from the DM base, not from the streaming host, and which one answers is not
  // knowable up front.
  it('moves on to the next host when one refuses', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith('https://base.manager.example')
        ? new Response('', { status: 403 })
        : models(['anthropic/claude-opus-5']),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(listModels(creds, bases)).resolves.toEqual([
      'anthropic/claude-opus-5',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // learner_id rides on every attempt; a non-admin member is 403'd without it.
    for (const [url] of fetchMock.mock.calls as unknown as [string][]) {
      expect(url).toContain('learner_id=jane');
    }
  });

  it('names every host and its reason when none answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('https://base.manager.example'))
          throw new TypeError('Failed to fetch');
        return new Response('', { status: 403 });
      }),
    );
    const failure = listModels(creds, bases);
    await expect(failure).rejects.toThrow(
      'https://base.manager.example → Failed to fetch',
    );
    await expect(failure).rejects.toThrow('https://asgi.example → HTTP 403');
  });

  // A bare status cannot tell the DM's own permission denial apart from an edge
  // proxy refusing the chrome-extension:// origin; the body can.
  it('surfaces the error code out of the OpenAI envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                message: 'You do not have permission to access this resource',
                code: 'cannot_access_resource',
              },
            }),
            { status: 403 },
          ),
      ),
    );
    await expect(listModels(creds, bases)).rejects.toThrow(
      'HTTP 403 cannot_access_resource',
    );
  });

  it('falls back to the envelope message when it carries no code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: 'Nope.' } }), {
            status: 403,
          }),
      ),
    );
    await expect(listModels(creds, bases)).rejects.toThrow('HTTP 403 Nope.');
  });

  it('still reports the status when the body cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        text: () => Promise.reject(new Error('stream closed')),
      })),
    );
    await expect(listModels(creds, bases)).rejects.toThrow('HTTP 502');
  });

  it('quotes the body when the refusal is not an OpenAI envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response('<html>Forbidden</html>', { status: 403 }),
      ),
    );
    await expect(listModels(creds, bases)).rejects.toThrow(
      'HTTP 403 <html>Forbidden</html>',
    );
  });

  it('treats an authorised but empty list as no models, not a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => models([])),
    );
    await expect(listModels(creds, bases)).resolves.toEqual([]);
  });

  it('skips a host that answers with an unparseable body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('https://base.manager.example')
          ? new Response('not json', { status: 200 })
          : models(['openai/gpt-5']),
      ),
    );
    await expect(listModels(creds, bases)).resolves.toEqual(['openai/gpt-5']);
  });
});

describe('runAgent', () => {
  const collect = () => {
    const events: AgentEvent[] = [];
    return { events, onEvent: (event: AgentEvent) => events.push(event) };
  };

  it('executes a tool call, feeds the result back and ends on text', async () => {
    const execute = clickExecute();
    const { events, onEvent } = collect();
    const result = await runAgent({
      model: mockModel(toolStep(), textStep('Done.')),
      messages: [user('open billing')],
      tools: clickTools(execute),
      signal: new AbortController().signal,
      onEvent,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toEqual({ element: 5 });
    expect(events.map((event) => event.type)).toEqual([
      'tool-call',
      'tool-result',
      'text',
      'finish',
    ]);
    expect(events[0]).toMatchObject({
      toolName: 'click',
      input: { element: 5 },
    });
    expect(events[3]).toEqual({ type: 'finish', reason: 'stop' });
    expect(result.text).toBe('Done.');
    expect(result.steps).toBe(2);
    expect(result.stoppedBy).toBeNull();
    expect(result.messages[0]).toEqual(user('open billing'));
    expect(result.messages.slice(1).map((message) => message.role)).toEqual([
      'assistant',
      'tool',
      'assistant',
    ]);
  });

  it('stops at the step cap', async () => {
    const execute = clickExecute();
    const { onEvent } = collect();
    const result = await runAgent({
      model: mockModel(toolStep(), toolStep(), toolStep()),
      messages: [user('loop')],
      tools: clickTools(execute),
      signal: new AbortController().signal,
      onEvent,
      maxSteps: 2,
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.steps).toBe(2);
    expect(result.stoppedBy).toBe('steps');
  });

  it('stops when the token budget is spent', async () => {
    const { onEvent } = collect();
    const result = await runAgent({
      model: mockModel(toolStep(), toolStep()),
      messages: [user('loop')],
      tools: clickTools(),
      signal: new AbortController().signal,
      onEvent,
      tokenBudget: 12,
    });
    expect(result.steps).toBe(1);
    expect(result.stoppedBy).toBe('tokens');
  });

  it('does nothing on an already aborted signal', async () => {
    const execute = clickExecute();
    const controller = new AbortController();
    controller.abort();
    const { events, onEvent } = collect();
    await runAgent({
      model: mockModel(toolStep(), textStep()),
      messages: [user('x')],
      tools: clickTools(execute),
      signal: controller.signal,
      onEvent,
    }).catch(() => null);
    expect(execute).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === 'text')).toBe(false);
  });

  it('reports a tool that throws as an error event', async () => {
    const { events, onEvent } = collect();
    await runAgent({
      model: mockModel(toolStep(), textStep()),
      messages: [user('x')],
      tools: clickTools(
        vi.fn(async (_input: { element: number }) => {
          throw new Error('tab closed');
        }),
      ),
      signal: new AbortController().signal,
      onEvent,
    });
    expect(events).toContainEqual({ type: 'error', message: 'tab closed' });
  });
});

describe('buildModel against the DM shim', () => {
  const sse = (frames: string[]) =>
    frames.map((frame) => `${frame}\n\n`).join('');
  const chunk = (
    delta: Record<string, unknown>,
    finish_reason: string | null = null,
  ) =>
    `data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 1, model: 'openai/gpt-5', choices: [{ index: 0, delta, finish_reason }] })}`;

  const respond = (body: string, status = 200, type = 'text/event-stream') =>
    new Response(body, { status, headers: { 'content-type': type } });

  it('sends the member request the shim expects and streams the answer', async () => {
    const fetchMock = vi.fn(async () =>
      respond(
        sse([
          chunk({ role: 'assistant' }),
          ': keepalive',
          chunk({ content: 'Done.' }),
          chunk({}, 'stop'),
          `data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 1, model: 'openai/gpt-5', choices: [], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } })}`,
          'data: [DONE]',
        ]),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const events: AgentEvent[] = [];
    const result = await runAgent({
      model: buildModel({
        ...creds,
        base: 'https://asgi.example',
        model: 'openai/gpt-5',
      }),
      messages: [user('hello')],
      tools: {},
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
    });
    expect(result.text).toBe('Done.');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://asgi.example/api/ai-mentor/orgs/acme%20corp/v1/chat/completions?learner_id=jane',
    );
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe('Token t');
    const body = JSON.parse(String(init.body)) as Record<string, unknown> & {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body).toMatchObject({
      model: 'openai/gpt-5',
      stream: true,
      stream_options: { include_usage: true },
      user: 'jane',
      parallel_tool_calls: false,
    });
    expect(body.messages[0]).toEqual({ role: 'system', content: INSTRUCTIONS });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hello' });
    expect(events.filter((event) => event.type === 'error')).toEqual([]);
  });

  // The user's language reaches the model as part of the system message and
  // nowhere else — no body field, no header.
  it('names the user language in the system message when it has one', async () => {
    const fetchMock = vi.fn(async () =>
      respond(sse([chunk({ content: 'Fini.' }), chunk({}, 'stop')])),
    );
    vi.stubGlobal('fetch', fetchMock);
    await runAgent({
      model: buildModel({
        ...creds,
        base: 'https://asgi.example',
        model: 'openai/gpt-5',
      }),
      messages: [user('bonjour')],
      tools: {},
      signal: new AbortController().signal,
      onEvent: () => {},
      language: 'fr-FR',
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('French');
    expect(body.messages[0].content).toContain('fr-FR');
  });

  it('surfaces the pre-stream 402 with its status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(
          JSON.stringify({
            error: {
              message: 'Insufficient credits.',
              type: 'insufficient_quota',
              code: 'payment_required',
            },
          }),
          402,
          'application/json',
        ),
      ),
    );
    const events: AgentEvent[] = [];
    await runAgent({
      model: buildModel({
        ...creds,
        base: 'https://asgi.example',
        model: 'openai/gpt-5',
      }),
      messages: [user('hello')],
      tools: {},
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
    }).catch(() => null);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'error', statusCode: 402 }),
    );
  });

  it('surfaces a mid-stream error frame', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respond(
          sse([
            chunk({ role: 'assistant' }),
            `data: ${JSON.stringify({ error: { message: 'provider boom', type: 'server_error', status_code: 502 } })}`,
            'data: [DONE]',
          ]),
        ),
      ),
    );
    const events: AgentEvent[] = [];
    await runAgent({
      model: buildModel({
        ...creds,
        base: 'https://asgi.example',
        model: 'openai/gpt-5',
      }),
      messages: [user('hello')],
      tools: {},
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
    }).catch(() => null);
    expect(
      events.some(
        (event) =>
          event.type === 'error' && /provider boom/.test(event.message),
      ),
    ).toBe(true);
  });
});
