import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  act,
  waitFor,
  renderHook,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import en from '../../../messages/en.json';
import {
  CodeActivity,
  applyPlan,
  applyToolCall,
  clearTurn,
  codeTurnPhase,
  describeStep,
  mergeToolCall,
  resetCodeActivityForTests,
  stepSentence,
  useCodeTurn,
  type AcpToolCall,
  type CodeStep,
  type StepForm,
} from '../code-activity';

/**
 * The plain-words record of a Code turn. The fixtures are shaped like what the
 * installed adapters send (claude-agent-acp 0.83, codex-acp 2.0, opencode
 * 1.18's ACP server) and like the paired phone's relay, which puts the raw
 * opencode tool name in both `title` and `kind`.
 */

const { listeners, listen } = vi.hoisted(() => ({
  listeners: new Map<string, (evt: { payload: unknown }) => void>(),
  listen: vi.fn(
    async (name: string, cb: (evt: { payload: unknown }) => void) => {
      listeners.set(name, cb);
      return () => {};
    },
  ),
}));

vi.mock('@tauri-apps/api/event', () => ({ listen }));

const t = createTranslator({
  locale: 'en',
  messages: en as Record<string, unknown>,
  namespace: 'chatCodeActivity',
}) as unknown as Parameters<typeof stepSentence>[0];

/** Merge the updates in order and read the step. */
function stepOf(updates: AcpToolCall[], id = 't1'): CodeStep {
  const facts = updates.reduce(
    (prev, update) => mergeToolCall(prev, update),
    undefined as ReturnType<typeof mergeToolCall> | undefined,
  );
  return describeStep(facts!, id);
}

function sentence(updates: AcpToolCall[], form: StepForm = 'done'): string {
  return stepSentence(t, stepOf(updates), form);
}

async function emit(name: string, payload: unknown) {
  await waitFor(() => expect(listeners.has(name)).toBe(true));
  act(() => listeners.get(name)!({ payload }));
}

const claude = (toolName: string, update: AcpToolCall): AcpToolCall => ({
  ...update,
  _meta: { claudeCode: { toolName } },
});

beforeEach(() => {
  (window as unknown as { __TAURI__: object }).__TAURI__ = {};
  resetCodeActivityForTests();
  listeners.clear();
  listen.mockClear();
});

afterEach(() => {
  delete (window as unknown as { __TAURI__?: object }).__TAURI__;
});

describe('describeStep', () => {
  it.each<[string, AcpToolCall[], string, StepForm?]>([
    [
      'a Claude command before its input arrived',
      [
        claude('Bash', {
          title: 'Terminal',
          kind: 'execute',
          status: 'pending',
        }),
      ],
      'Running a command',
      'running',
    ],
    [
      'a Claude command with its own description',
      [
        claude('Bash', {
          title: 'Terminal',
          kind: 'execute',
          status: 'pending',
        }),
        {
          title: 'pnpm install',
          rawInput: {
            command: 'pnpm install',
            description: 'Install what the app needs',
          },
          content: [
            {
              type: 'content',
              content: { type: 'text', text: 'Install what the app needs' },
            },
          ],
        },
        { status: 'completed', rawOutput: { stdout: 'ok' } },
      ],
      'Ran a command: Install what the app needs',
    ],
    [
      'an install command without a description',
      [
        {
          title: 'cd app && pnpm i',
          kind: 'execute',
          rawInput: { command: 'cd app && pnpm i' },
          status: 'completed',
        },
      ],
      'Installed what the app needs',
    ],
    [
      'a preview command behind an environment prefix',
      [
        {
          title: 'FOO=1 npm run dev',
          kind: 'execute',
          rawInput: { command: 'FOO=1 npm run dev' },
          status: 'completed',
        },
      ],
      'Started the preview',
    ],
    [
      'a Claude read with its location',
      [
        claude('Read', { title: 'Read File', kind: 'read', status: 'pending' }),
        {
          title: 'Read src/app/page.tsx (1 - 50)',
          rawInput: {
            file_path: '/home/u/ws/src/app/page.tsx',
            offset: 1,
            limit: 50,
          },
          locations: [{ path: '/home/u/ws/src/app/page.tsx', line: 1 }],
        },
        { status: 'completed' },
      ],
      'Read app/page.tsx',
    ],
    [
      'a Claude write of a new file',
      [
        claude('Write', {
          title: 'Preparing file…',
          kind: 'edit',
          status: 'pending',
        }),
        {
          title: 'Write src/new.ts',
          rawInput: { file_path: '/ws/src/new.ts', content: 'x' },
          content: [
            {
              type: 'diff',
              path: '/ws/src/new.ts',
              oldText: null,
              newText: 'x',
            },
          ],
        },
        { status: 'completed' },
      ],
      'Created src/new.ts',
    ],
    [
      'a Claude edit of an existing file',
      [
        claude('Edit', {
          title: 'Edit src/app/about/page.tsx',
          kind: 'edit',
          rawInput: {
            file_path: '/ws/src/app/about/page.tsx',
            old_string: 'a',
            new_string: 'b',
          },
          content: [
            {
              type: 'diff',
              path: '/ws/src/app/about/page.tsx',
              oldText: 'a',
              newText: 'b',
            },
          ],
          locations: [{ path: '/ws/src/app/about/page.tsx' }],
          status: 'completed',
        }),
      ],
      'Changed about/page.tsx',
    ],
    [
      'a Claude file search',
      [
        claude('Glob', {
          title: 'Find `src` `**/*.ts`',
          kind: 'search',
          rawInput: { pattern: '**/*.ts', path: 'src' },
          status: 'completed',
        }),
      ],
      'Looked through the app’s files',
    ],
    [
      'a Claude text search',
      [
        claude('Grep', {
          title: 'grep -n "foo" src',
          kind: 'search',
          rawInput: { pattern: 'foo', path: 'src' },
          status: 'completed',
        }),
      ],
      'Looked through the app’s files',
    ],
    [
      'a fetch of the local preview',
      [
        claude('WebFetch', {
          title: 'Fetch http://localhost:3000/',
          kind: 'fetch',
          rawInput: { url: 'http://localhost:3000/', prompt: 'x' },
          status: 'completed',
        }),
      ],
      'Checked the preview',
    ],
    [
      'a fetch of a web page',
      [
        claude('WebFetch', {
          title: 'Fetch https://www.example.com/docs?token=abc',
          kind: 'fetch',
          rawInput: {
            url: 'https://www.example.com/docs?token=abc',
            prompt: 'x',
          },
          status: 'completed',
        }),
      ],
      'Opened example.com',
    ],
    [
      'a web search',
      [
        claude('WebSearch', {
          title: 'Search "best pizza"',
          kind: 'fetch',
          rawInput: { query: 'best pizza' },
          status: 'completed',
        }),
      ],
      'Searched the web for “best pizza”',
    ],
    [
      'a Claude side task',
      [
        claude('Task', {
          title: 'Find the login page',
          kind: 'think',
          rawInput: {
            description: 'Find the login page',
            prompt: 'Look for…',
            subagent_type: 'Explore',
          },
          status: 'completed',
        }),
      ],
      'Finished a side task: Find the login page',
    ],
    [
      'a Claude skill',
      [
        claude('Skill', {
          title: 'Load skill: iblai-vibe-ops-init',
          kind: 'other',
          rawInput: { skill: 'iblai-vibe-ops-init' },
          status: 'completed',
        }),
      ],
      'Looked up how to do this',
    ],
    [
      'a Claude connector tool',
      [
        claude('mcp__srv__get_data', {
          title: 'mcp__srv__get_data',
          kind: 'other',
          rawInput: { id: 1 },
          status: 'completed',
        }),
      ],
      'Used get data',
    ],
    [
      'a Claude plan approval',
      [
        claude('ExitPlanMode', {
          title: 'Approve Plan',
          kind: 'switch_mode',
          rawInput: { plan: '1. do it' },
          status: 'completed',
        }),
      ],
      'Got the go-ahead for its plan',
    ],
    [
      'a Claude question',
      [
        claude('AskUserQuestion', {
          title: 'Which colour?',
          kind: 'other',
          rawInput: { questions: [] },
          status: 'completed',
        }),
      ],
      'Asked you a question',
    ],
    [
      'a Codex file read',
      [
        {
          title: "Read file 'src/x.ts'",
          kind: 'read',
          name: 'exec_command',
          locations: [{ path: '/ws/src/x.ts' }],
          status: 'completed',
        },
      ],
      'Read src/x.ts',
    ],
    [
      'a Codex directory listing',
      [
        {
          title: "List files in 'src'",
          kind: 'read',
          name: 'exec_command',
          status: 'completed',
        },
      ],
      'Looked through the app’s files',
    ],
    [
      'a Codex text search',
      [
        {
          title: "Search for 'foo' in src",
          kind: 'search',
          name: 'exec_command',
          status: 'completed',
        },
      ],
      'Looked through the app’s files',
    ],
    [
      'a Codex change to two files',
      [
        {
          title: 'Editing files',
          kind: 'edit',
          content: [
            { type: 'diff', path: '/ws/a.ts', oldText: 'a', newText: 'b' },
            { type: 'diff', path: '/ws/b.ts', oldText: 'a', newText: 'b' },
          ],
          status: 'completed',
        },
      ],
      'Changed 2 files',
    ],
    [
      'a Codex new file',
      [
        {
          title: 'Editing files',
          kind: 'edit',
          content: [{ type: 'diff', path: '/ws/a.ts', newText: 'b' }],
          status: 'completed',
        },
      ],
      'Created ws/a.ts',
    ],
    [
      'a Codex command',
      [
        {
          title: 'pnpm test',
          kind: 'execute',
          name: 'exec_command',
          rawInput: { command: 'pnpm test', cwd: '/ws' },
          status: 'completed',
        },
      ],
      'Ran a command',
    ],
    [
      'a Codex connector tool',
      [
        {
          title: 'mcp.github.list_issues',
          kind: 'execute',
          rawInput: { server: 'github', tool: 'list_issues', arguments: {} },
          status: 'completed',
        },
      ],
      'Used list issues',
    ],
    [
      'a Codex web search',
      [
        {
          title: 'Web search: pizza near me',
          kind: 'search',
          status: 'completed',
        },
      ],
      'Searched the web for “pizza near me”',
    ],
    [
      'a Codex page open',
      [
        {
          title: 'Open page: https://example.com/a/b',
          kind: 'search',
          status: 'completed',
        },
      ],
      'Opened example.com',
    ],
    [
      'a Codex compaction',
      [{ title: 'Compact conversation', kind: 'think', status: 'completed' }],
      'Worked something out',
    ],
    [
      'an opencode command whose location is the workspace',
      [
        { title: 'bash', kind: 'execute', status: 'pending' },
        {
          title: 'pnpm build',
          rawInput: { command: 'pnpm build', description: 'Build the app' },
          locations: [{ path: '/ws' }],
          status: 'completed',
        },
      ],
      'Ran a command: Build the app',
    ],
    [
      'an opencode read still pending under its tool name',
      [{ title: 'read', kind: 'read', status: 'pending' }],
      'Reading a file',
      'running',
    ],
    [
      'a paired phone’s command',
      [
        {
          title: 'bash',
          kind: 'bash',
          status: 'in_progress',
          rawInput: { command: 'ls', description: 'List files' },
          content: '',
        },
      ],
      'Running a command: List files',
      'running',
    ],
    [
      'a paired phone’s page fetch',
      [
        {
          title: 'webfetch',
          kind: 'webfetch',
          rawInput: { url: 'https://example.org/x' },
          status: 'completed',
        },
      ],
      'Opened example.org',
    ],
    [
      'a paired phone’s new file',
      [
        {
          title: 'write',
          kind: 'write',
          rawInput: { filePath: '/ws/app/page.tsx', content: 'x' },
          status: 'completed',
        },
      ],
      'Created app/page.tsx',
    ],
    [
      'a paired phone’s file search',
      [
        {
          title: 'glob',
          kind: 'glob',
          rawInput: { pattern: '**/*.css' },
          status: 'completed',
        },
      ],
      'Looked through the app’s files',
    ],
    [
      'an unknown tool',
      [{ title: 'frobnicate', kind: 'other', status: 'completed' }],
      'Finished a step',
    ],
  ])('describes %s', (_label, updates, expected, form = 'done') => {
    expect(sentence(updates, form)).toBe(expected);
  });

  it.each(['bash', 'tool', 'todowrite', 'exec_command', 'mcp__x__y', 'banana'])(
    'never shows the raw tool name %s',
    (name) => {
      const text = sentence([{ title: name, kind: name, status: 'completed' }]);
      expect(text).not.toContain(name);
      expect(text).not.toBe('');
    },
  );

  it('keeps the exact command, path or address one click away', () => {
    expect(
      stepOf([
        { title: 'x', kind: 'execute', rawInput: { command: 'rm -rf dist' } },
      ]).details,
    ).toBe('rm -rf dist');
    expect(
      stepOf([{ title: 'x', kind: 'read', locations: [{ path: '/ws/a.ts' }] }])
        .details,
    ).toBe('/ws/a.ts');
    expect(
      stepOf([
        {
          title: 'x',
          kind: 'fetch',
          rawInput: { url: 'https://example.com/p?q=1' },
        },
      ]).details,
    ).toBe('https://example.com/p?q=1');
    expect(stepOf([{ title: 'frobnicate', kind: 'other' }]).details).toBe(
      'frobnicate',
    );
  });

  it('appends the failure text to the details', () => {
    const step = stepOf([
      { title: 'read', kind: 'read', rawInput: { filePath: '/ws/src/x.ts' } },
      {
        title: 'read',
        status: 'failed',
        content: [
          {
            type: 'content',
            content: { type: 'text', text: 'file not found' },
          },
        ],
      },
    ]);
    expect(stepSentence(t, step, step.status)).toBe('Couldn’t read src/x.ts');
    expect(step.details).toBe('/ws/src/x.ts\nfile not found');
  });

  it('shows a file by its last two path segments, on any platform', () => {
    expect(
      sentence([
        {
          title: 'x',
          kind: 'read',
          rawInput: { file_path: '/home/rei/ws/src/app/page.tsx' },
        },
      ]),
    ).toBe('Read app/page.tsx');
    expect(
      sentence([
        {
          title: 'x',
          kind: 'read',
          rawInput: { file_path: 'C:\\Users\\x\\app\\page.tsx' },
        },
      ]),
    ).toBe('Read app/page.tsx');
    expect(
      sentence([
        { title: 'x', kind: 'read', rawInput: { file_path: '/ws/src/app/' } },
      ]),
    ).toBe('Read src/app');
  });

  it('shows a web page by its site only, never its path or query', () => {
    const text = sentence([
      {
        title: 'x',
        kind: 'fetch',
        rawInput: { url: 'https://www.example.com/secret/path?token=abc' },
      },
    ]);
    expect(text).toBe('Opened example.com');
  });

  it('falls back to the vague sentence when an address does not parse', () => {
    expect(
      sentence([{ title: 'x', kind: 'fetch', rawInput: { url: 'not a url' } }]),
    ).toBe('Finished a step');
  });

  it('cuts a long search by characters without splitting an emoji', () => {
    const query = `${'a'.repeat(59)}😀${'b'.repeat(10)}`;
    const text = sentence([{ title: 'x', kind: 'fetch', rawInput: { query } }]);
    expect(text).toContain('😀…”');
    expect(text).not.toMatch(/b{2}/);
  });

  it('strips control and bidi characters from what it shows', () => {
    const text = sentence([
      {
        title: 'x',
        kind: 'read',
        rawInput: { file_path: '/ws/evil\u202Egnp.exe\u0007' },
      },
    ]);
    expect(text).toBe('Read ws/evilgnp.exe');
  });

  it('ignores inputs that are not strings', () => {
    expect(
      sentence([
        claude('Bash', {
          title: 'x',
          kind: 'execute',
          rawInput: { command: 42, description: ['x'] },
        }),
      ]),
    ).toBe('Ran a command');
    expect(
      sentence([
        { title: 'x', kind: 'read', rawInput: 'nope', locations: 'nope' },
      ]),
    ).toBe('Read a file');
  });
});

describe('mergeToolCall', () => {
  it('keeps the step when the result update carries no title or kind', () => {
    const text = sentence([
      claude('Read', {
        title: 'Read src/x.ts',
        kind: 'read',
        rawInput: { file_path: '/ws/src/x.ts' },
      }),
      { status: 'completed', rawOutput: 'contents' },
    ]);
    expect(text).toBe('Read src/x.ts');
  });

  it('never blanks a file it already knew', () => {
    const text = sentence([
      { title: 'read', kind: 'read', rawInput: { filePath: '/ws/src/x.ts' } },
      { title: 'read', status: 'completed', locations: [], rawInput: {} },
    ]);
    expect(text).toBe('Read src/x.ts');
  });

  it('never reopens a finished step', () => {
    const step = stepOf([
      { title: 'x', kind: 'read', status: 'completed' },
      { status: 'in_progress' },
    ]);
    expect(step.status).toBe('done');
  });

  it('clips long input strings and keeps nothing from _meta', () => {
    const facts = mergeToolCall(undefined, {
      title: 'x',
      kind: 'edit',
      rawInput: { content: 'y'.repeat(5000) },
      _meta: { terminal_output_delta: { data: 'secret' } },
    });
    expect((facts.input.content as string).length).toBe(2000);
    expect(JSON.stringify(facts)).not.toContain('secret');
  });
});

describe('the store', () => {
  it('records a turn’s steps before its bubble exists', () => {
    applyToolCall('g1', {
      toolCallId: 't1',
      title: 'read',
      kind: 'read',
      status: 'pending',
    });
    const { result } = renderHook(() => useCodeTurn('g1'));
    expect(result.current.steps).toHaveLength(1);
  });

  it('keeps turns apart by generation', () => {
    applyToolCall('g1', { toolCallId: 't1', title: 'read', kind: 'read' });
    applyToolCall('g2', { toolCallId: 't1', title: 'bash', kind: 'execute' });
    expect(
      renderHook(() => useCodeTurn('g1')).result.current.steps[0].action,
    ).toBe('read');
    expect(
      renderHook(() => useCodeTurn('g2')).result.current.steps[0].action,
    ).toBe('run');
    expect(
      renderHook(() => useCodeTurn(undefined)).result.current.steps,
    ).toHaveLength(0);
  });

  it('updates a known id in place and keeps the order steps started in', () => {
    applyToolCall('g1', { toolCallId: 't1', title: 'read', kind: 'read' });
    applyToolCall('g1', { toolCallId: 't2', title: 'bash', kind: 'execute' });
    applyToolCall('g1', {
      toolCallId: 't1',
      title: 'read',
      kind: 'read',
      status: 'completed',
    });
    const { steps } = renderHook(() => useCodeTurn('g1')).result.current;
    expect(steps.map((s) => [s.id, s.status])).toEqual([
      ['t1', 'done'],
      ['t2', 'running'],
    ]);
  });

  it('ignores an update without an id or a generation', () => {
    applyToolCall('g1', { toolCallId: '', title: 'read', kind: 'read' });
    applyToolCall(undefined, { toolCallId: 't1', title: 'read', kind: 'read' });
    applyToolCall('g1', undefined);
    expect(
      renderHook(() => useCodeTurn('g1')).result.current.steps,
    ).toHaveLength(0);
  });

  it('publishes nothing for a burst of output-only updates', () => {
    applyToolCall('g1', {
      toolCallId: 't1',
      title: 'pnpm test',
      kind: 'execute',
      rawInput: { command: 'pnpm test' },
    });
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useCodeTurn('g1');
    });
    const before = result.current;
    for (let i = 0; i < 50; i += 1) {
      act(() => {
        applyToolCall('g1', {
          toolCallId: 't1',
          _meta: {
            terminal_output_delta: { data: `line ${i}\n`, terminal_id: 'x' },
          },
        });
      });
    }
    expect(result.current).toBe(before);
    expect(renders).toBe(1);
  });

  it('gives a changed step a new object while its siblings keep theirs', () => {
    applyToolCall('g1', { toolCallId: 't1', title: 'read', kind: 'read' });
    applyToolCall('g1', { toolCallId: 't2', title: 'bash', kind: 'execute' });
    const { result } = renderHook(() => useCodeTurn('g1'));
    const [first, second] = result.current.steps;
    act(() => {
      applyToolCall('g1', { toolCallId: 't2', status: 'completed' });
    });
    expect(result.current.steps[0]).toBe(first);
    expect(result.current.steps[1]).not.toBe(second);
  });

  it('takes the plan from a plan update and from opencode’s todo tool', () => {
    applyPlan('g1', {
      entries: [
        { content: 'Add the page', status: 'in_progress', priority: 'medium' },
        { content: '  ', status: 'pending' },
        { content: 'Ship', status: 'mystery' },
      ],
    });
    expect(renderHook(() => useCodeTurn('g1')).result.current.plan).toEqual([
      { content: 'Add the page', status: 'in_progress' },
      { content: 'Ship', status: 'pending' },
    ]);
    applyToolCall('g2', {
      toolCallId: 't1',
      title: 'todowrite',
      kind: 'todowrite',
      rawInput: { todos: [{ content: 'Do a', status: 'completed' }] },
    });
    const turn = renderHook(() => useCodeTurn('g2')).result.current;
    expect(turn.plan).toEqual([{ content: 'Do a', status: 'completed' }]);
    expect(turn.steps).toHaveLength(0);
    applyPlan('g3', { entries: 'nope' });
    applyPlan(undefined, { entries: [] });
    expect(
      renderHook(() => useCodeTurn('g3')).result.current.plan,
    ).toBeUndefined();
  });

  it('clears a turn on ollama:restart', async () => {
    renderHook(() => useCodeTurn('g1'));
    await emit('opencode:tool_call', {
      generation_id: 'g1',
      update: { toolCallId: 't1', title: 'read', kind: 'read' },
    });
    await emit('opencode:plan', {
      generation_id: 'g1',
      update: { entries: [{ content: 'Plan', status: 'pending' }] },
    });
    const { result } = renderHook(() => useCodeTurn('g1'));
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.plan).toHaveLength(1);
    await emit('ollama:restart', { generation_id: 'g1' });
    expect(result.current.steps).toHaveLength(0);
    expect(result.current.plan).toBeUndefined();
    clearTurn('never-seen');
    clearTurn(undefined);
  });

  it('keeps only the newest 200 turns', () => {
    for (let i = 0; i <= 200; i += 1) {
      applyToolCall(`g${i}`, { toolCallId: 't', title: 'read', kind: 'read' });
    }
    expect(
      renderHook(() => useCodeTurn('g0')).result.current.steps,
    ).toHaveLength(0);
    expect(
      renderHook(() => useCodeTurn('g1')).result.current.steps,
    ).toHaveLength(1);
    expect(
      renderHook(() => useCodeTurn('g200')).result.current.steps,
    ).toHaveLength(1);
  });

  it('listens once for the whole app and keeps listening after the last subscriber leaves', async () => {
    const first = renderHook(() => useCodeTurn('g1'));
    const second = renderHook(() => useCodeTurn('g1'));
    await waitFor(() => expect(listeners.size).toBe(3));
    expect(listen).toHaveBeenCalledTimes(3);
    first.unmount();
    second.unmount();
    await emit('opencode:tool_call', {
      generation_id: 'g1',
      update: { toolCallId: 't1', title: 'read', kind: 'read' },
    });
    expect(
      renderHook(() => useCodeTurn('g1')).result.current.steps,
    ).toHaveLength(1);
  });

  it('does not listen outside the desktop app', async () => {
    delete (window as unknown as { __TAURI__?: object }).__TAURI__;
    renderHook(() => useCodeTurn('g1'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listen).not.toHaveBeenCalled();
  });
});

describe('codeTurnPhase', () => {
  const running: CodeStep = {
    id: 't2',
    action: 'edit',
    status: 'running',
    values: { file: 'app/page.tsx' },
  };
  const done: CodeStep = {
    id: 't1',
    action: 'read',
    status: 'done',
    values: {},
  };

  it('says what the latest step is doing', () => {
    expect(codeTurnPhase([done, running], '', t)).toEqual({
      kind: 'workflow',
      detail: 'Changing app/page.tsx',
    });
  });

  it('writes once reply text streams', () => {
    expect(codeTurnPhase([running], 'Done.', t)).toEqual({ kind: 'writing' });
  });

  it('thinks between steps, and an older stuck step never shows stale', () => {
    expect(codeTurnPhase([done], undefined, t)).toEqual({ kind: 'thinking' });
    expect(codeTurnPhase([running, done], '', t)).toEqual({ kind: 'thinking' });
    expect(codeTurnPhase([], '', t)).toEqual({ kind: 'thinking' });
  });
});

describe('CodeActivity', () => {
  function seed() {
    applyToolCall('g1', {
      toolCallId: 't1',
      title: 'read',
      kind: 'read',
      rawInput: { filePath: '/ws/app/page.tsx' },
      status: 'completed',
    });
    applyToolCall('g1', {
      toolCallId: 't2',
      title: 'pnpm test',
      kind: 'execute',
      rawInput: { command: 'pnpm test' },
      status: 'failed',
      content: [{ type: 'content', content: { type: 'text', text: 'exit 1' } }],
    });
    applyToolCall('g1', {
      toolCallId: 't3',
      title: 'edit',
      kind: 'edit',
      rawInput: { filePath: '/ws/app/layout.tsx' },
    });
  }

  it('renders nothing without steps', () => {
    const { container } = render(<CodeActivity generationId="g1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('folds into a step count, closed by default, and opens to one sentence per step', async () => {
    seed();
    render(<CodeActivity generationId="g1" isCurrentlyStreaming />);
    expect(screen.getByText('3 steps')).toBeInTheDocument();
    expect(screen.queryByTestId('code-activity-steps')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('code-activity-trigger'));
    const rows = screen.getAllByTestId('code-activity-step');
    expect(rows.map((row) => row.getAttribute('data-status'))).toEqual([
      'done',
      'failed',
      'running',
    ]);
    expect(within(rows[0]).getByText('Read app/page.tsx')).toBeInTheDocument();
    expect(
      within(rows[1]).getByText('A command didn’t go through'),
    ).toBeInTheDocument();
    expect(
      within(rows[2]).getByText('Changing app/layout.tsx'),
    ).toBeInTheDocument();
  });

  it('keeps the exact command and failure text one click away', async () => {
    seed();
    render(<CodeActivity generationId="g1" />);
    await userEvent.click(screen.getByTestId('code-activity-trigger'));
    const details = screen.getAllByTestId('code-activity-details');
    expect(details.map((d) => d.textContent)).toEqual([
      '/ws/app/page.tsx',
      'pnpm test\nexit 1',
      '/ws/app/layout.tsx',
    ]);
  });

  it('labels every status for screen readers, hides the icons, and the rows never animate', async () => {
    seed();
    render(<CodeActivity generationId="g1" isCurrentlyStreaming />);
    await userEvent.click(screen.getByTestId('code-activity-trigger'));
    const list = screen.getByTestId('code-activity-steps');
    for (const label of ['Done', 'Didn’t go through', 'Running']) {
      expect(within(list).getByText(label)).toHaveClass('sr-only');
    }
    list
      .querySelectorAll('svg')
      .forEach((icon) => expect(icon).toHaveAttribute('aria-hidden', 'true'));
    expect(list.querySelector('[class*="animate-"]')).toBeNull();
  });

  it('shows the dots only while a step runs in a live turn', () => {
    seed();
    const { container, rerender } = render(
      <CodeActivity generationId="g1" isCurrentlyStreaming />,
    );
    expect(container.querySelector('.animate-bounce')).not.toBeNull();
    rerender(<CodeActivity generationId="g1" isCurrentlyStreaming={false} />);
    expect(container.querySelector('.animate-bounce')).toBeNull();
  });

  it('reads an unfinished step as stopped once the turn is over', async () => {
    seed();
    render(<CodeActivity generationId="g1" isCurrentlyStreaming={false} />);
    await userEvent.click(screen.getByTestId('code-activity-trigger'));
    const row = screen.getAllByTestId('code-activity-step')[2];
    expect(row).toHaveAttribute('data-status', 'stopped');
    expect(within(row).getByText('Stopped')).toHaveClass('sr-only');
    expect(
      within(row).getByText('Changing app/layout.tsx'),
    ).toBeInTheDocument();
  });

  it('renders nothing on the server', () => {
    seed();
    expect(renderToString(<CodeActivity generationId="g1" />)).toBe('');
  });
});
