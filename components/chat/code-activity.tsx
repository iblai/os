'use client';

/**
 * Plain-words record of what a Code turn does, built from the ACP tool-call
 * metadata the agents send — never from model text, since Code is told to work
 * silently. One describer serves the folded step list here, the sentence on the
 * permission card and the working line's "doing" phase.
 *
 * Module store rather than component state, like `code-permission-card.tsx`: a
 * turn's first step lands before its bubble mounts, and every bubble reads the
 * same record through one trio of Tauri listeners. Nothing is persisted — the
 * SDK keeps its own tool calls in memory only, so this has the same lifetime.
 */

import React, { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  CircleX,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  WRITE_TODOS_TOOL,
  extractLatestTodos,
  type ChatPhase,
  type Todo,
} from '@iblai/iblai-js/web-utils';

/** The ACP ToolCall / ToolCallUpdate fields the describer reads, all optional. */
export interface AcpToolCall {
  toolCallId?: string | null;
  title?: string | null;
  kind?: string | null;
  name?: string | null;
  status?: string | null;
  rawInput?: unknown;
  content?: unknown;
  rawOutput?: unknown;
  locations?: unknown;
  _meta?: unknown;
}

export type StepAction =
  | 'read'
  | 'create'
  | 'edit'
  | 'editMany'
  | 'remove'
  | 'move'
  | 'search'
  | 'run'
  | 'runDescribed'
  | 'install'
  | 'preview'
  | 'open'
  | 'openPreview'
  | 'web'
  | 'helper'
  | 'helperPlain'
  | 'skill'
  | 'plan'
  | 'approve'
  | 'ask'
  | 'connector'
  | 'think'
  | 'other';

export type StepStatus = 'running' | 'done' | 'failed';

export interface CodeStep {
  id: string;
  action: StepAction;
  status: StepStatus;
  /** Sentence parameters: `file`, `count`, `description`, `host`, `query`, `name`. */
  values: Record<string, string | number>;
  /** The literal command, paths, address or failure text, one click away. */
  details?: string;
}

/** What is known about one tool call, merged across its updates. */
export interface StepFacts {
  name?: string;
  title?: string;
  kind?: string;
  status: StepStatus;
  input: Record<string, unknown>;
  paths: string[];
  diffs: { path: string; isNew: boolean }[];
  error?: string;
}

export interface CodeTurn {
  steps: readonly CodeStep[];
  plan?: Todo[];
}

const MAX_INPUT_STRING = 2000;
const MAX_ERROR = 500;
const PREVIEW_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// C0/C1 controls and the bidi controls that could fake a file's extension.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Display-safe: controls stripped, whitespace collapsed, cut by code points. */
function clean(value: string, max: number): string {
  const chars = Array.from(
    value.replace(UNSAFE_CHARS, '').replace(/\s+/g, ' ').trim(),
  );
  return chars.length > max
    ? `${chars.slice(0, max).join('')}…`
    : chars.join('');
}

/** `about/page.tsx`: Next apps are full of `page.tsx`, so one segment is ambiguous. */
function shortPath(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return clean(parts.slice(-2).join('/'), 48);
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
}

// ponytail: two command shapes recognised (install, preview); add a third when a row reads too vaguely.
function commandAction(command: string): 'install' | 'preview' | 'run' {
  let bare = command.trim();
  for (let i = 0; i < 4; i += 1) {
    const next = bare
      .replace(/^cd\s+\S+\s*&&\s*/, '')
      .replace(/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/, '');
    if (next === bare) break;
    bare = next;
  }
  if (/^(?:npm|pnpm|yarn|bun)\s+(?:i|install|add|ci)\b/.test(bare)) {
    return 'install';
  }
  if (
    /^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start|preview)\b/.test(bare) ||
    /^(?:npx\s+)?(?:next\s+dev|vite)\b/.test(bare)
  ) {
    return 'preview';
  }
  return 'run';
}

/** Finished steps stay finished; pending, in_progress and the unknown all run. */
function statusOf(raw: unknown, prev: StepStatus): StepStatus {
  if (prev !== 'running') return prev;
  if (raw === 'completed') return 'done';
  if (raw === 'failed') return 'failed';
  return 'running';
}

function clipStrings(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === 'string' && value.length > MAX_INPUT_STRING
        ? value.slice(0, MAX_INPUT_STRING)
        : value,
    ]),
  );
}

function diffsOf(content: unknown): StepFacts['diffs'] {
  if (!Array.isArray(content)) return [];
  const diffs: StepFacts['diffs'] = [];
  for (const item of content) {
    if (isRecord(item) && item.type === 'diff' && text(item.path)) {
      diffs.push({ path: item.path as string, isNew: item.oldText == null });
    }
  }
  return diffs;
}

function errorOf(content: unknown): string | undefined {
  if (typeof content === 'string') return text(content);
  if (!Array.isArray(content)) return undefined;
  const lines = content.flatMap((item) =>
    isRecord(item) &&
    item.type === 'content' &&
    isRecord(item.content) &&
    typeof item.content.text === 'string'
      ? [item.content.text]
      : [],
  );
  return text(lines.join('\n'));
}

function pathsOf(
  update: AcpToolCall,
  input: Record<string, unknown>,
  diffs: StepFacts['diffs'],
): string[] {
  const paths = new Set<string>();
  if (Array.isArray(update.locations)) {
    for (const location of update.locations) {
      const path = isRecord(location) ? text(location.path) : undefined;
      if (path) paths.add(path);
    }
  }
  for (const diff of diffs) paths.add(diff.path);
  for (const key of ['file_path', 'filePath', 'path']) {
    const path = text(input[key]);
    if (path) paths.add(path);
  }
  return [...paths];
}

/**
 * ACP ToolCallUpdate semantics, hardened: only present, non-blank fields
 * overwrite (Claude's result update has no title or kind), the tool name is
 * set once (opencode's pending title IS the tool name), `content` and
 * `locations` replace but never blank a subject already known, and nothing
 * from `_meta` or a tool's output is kept.
 */
export function mergeToolCall(
  prev: StepFacts | undefined,
  update: AcpToolCall,
): StepFacts {
  const base: StepFacts = prev ?? {
    status: 'running',
    input: {},
    paths: [],
    diffs: [],
  };
  const meta = isRecord(update._meta) ? update._meta : {};
  const claude = isRecord(meta.claudeCode) ? meta.claudeCode : {};
  const input =
    isRecord(update.rawInput) && Object.keys(update.rawInput).length > 0
      ? clipStrings(update.rawInput)
      : base.input;
  const freshDiffs = diffsOf(update.content);
  const diffs = freshDiffs.length > 0 ? freshDiffs : base.diffs;
  const found = pathsOf(update, input, diffs);
  const status = statusOf(update.status, base.status);
  return {
    name:
      base.name ??
      text(claude.toolName) ??
      text(update.name) ??
      text(update.title),
    title: text(update.title) ?? base.title,
    kind: text(update.kind) ?? base.kind,
    status,
    input,
    paths: found.length > 0 ? found : base.paths,
    diffs,
    error:
      status === 'failed'
        ? (errorOf(update.content)?.slice(0, MAX_ERROR) ?? base.error)
        : undefined,
  };
}

/** The plain-words reading of a tool call. Never null: the vaguest is `other`. */
export function describeStep(facts: StepFacts, id: string): CodeStep {
  const name = (facts.name ?? '').toLowerCase();
  const kind = (facts.kind ?? '').toLowerCase();
  const title = facts.title ?? '';
  const { input, paths, diffs } = facts;
  const is = (...names: string[]) =>
    names.includes(name) || names.includes(kind);
  const file: Record<string, string | number> = paths[0]
    ? { file: shortPath(paths[0]) }
    : {};
  const allPaths = paths.join('\n') || undefined;
  const step = (
    action: StepAction,
    values: Record<string, string | number> = {},
    details?: string,
  ): CodeStep => ({
    id,
    action,
    status: facts.status,
    values,
    details: [details, facts.error].filter(Boolean).join('\n') || undefined,
  });

  if (Array.isArray(input.todos) || is('todowrite', 'todoread')) {
    return step('plan');
  }
  const mcp =
    name.match(/^mcp__(.+?)__(.+)$/) ?? title.match(/^mcp\.([^.]+)\.(.+)$/);
  if (mcp) {
    return step(
      'connector',
      { name: clean(mcp[2].replace(/_/g, ' '), 48) },
      title,
    );
  }
  if (is('skill') || text(input.skill)) {
    return step('skill', {}, text(input.skill) ?? text(input.name) ?? title);
  }
  const description = text(input.description);
  if (
    is('task', 'agent') ||
    text(input.subagent_type) ||
    text(input.agentThreadId)
  ) {
    const prompt = text(input.prompt);
    const excerpt = prompt ? clean(prompt, 300) : undefined;
    return description
      ? step('helper', { description: clean(description, 120) }, excerpt)
      : step('helperPlain', {}, excerpt);
  }
  if (is('exitplanmode') || kind === 'switch_mode') {
    return step('approve', {}, text(input.plan));
  }
  if (is('askuserquestion')) return step('ask', {}, title);
  const command = text(input.command) ?? text(input.cmd) ?? text(input.script);
  if (command || is('bash', 'shell', 'powershell')) {
    if (description) {
      return step(
        'runDescribed',
        { description: clean(description, 120) },
        command,
      );
    }
    return step(command ? commandAction(command) : 'run', {}, command);
  }
  const query = text(input.query) ?? title.match(/^Web search: (.+)$/)?.[1];
  const url =
    text(input.url) ??
    (isRecord(input.action) ? text(input.action.url) : undefined) ??
    title.match(/^Open page: (.+)$/)?.[1];
  if (is('websearch') || (query && !url && is('search', 'fetch'))) {
    return step('web', { query: clean(query ?? title, 60) });
  }
  if (url || is('fetch', 'webfetch')) {
    const host = url ? hostOf(url) : undefined;
    if (!host) return step('other', {}, url ?? title);
    return PREVIEW_HOSTS.has(host)
      ? step('openPreview', {}, url)
      : step('open', { host: clean(host, 48) }, url);
  }
  if (is('delete')) return step('remove', file, allPaths);
  if (kind === 'move') return step('move', file, allPaths);
  if (
    is('edit', 'write', 'patch', 'apply_patch', 'multiedit', 'notebookedit')
  ) {
    const creates =
      diffs.length > 0 ? diffs.every((d) => d.isNew) : is('write');
    if (creates) return step('create', file, allPaths);
    if (paths.length > 1)
      return step('editMany', { count: paths.length }, allPaths);
    return step('edit', file, allPaths);
  }
  const listing = /^list\b/.test(name) || /^list files/i.test(title);
  if (is('read') && !listing) return step('read', file, allPaths);
  if (listing || is('glob', 'grep', 'codesearch', 'list', 'search')) {
    return step('search', {}, text(input.pattern));
  }
  if (kind === 'think') return step('think', {}, title);
  return step('other', {}, title);
}

export type StepForm = 'running' | 'done' | 'failed' | 'want';
type Translate = ReturnType<typeof useTranslations<'chatCodeActivity'>>;

export function stepSentence(
  t: Translate,
  step: CodeStep,
  form: StepForm,
): string {
  return t(step.action, {
    form,
    file: t('aFile'),
    count: 0,
    description: '',
    host: '',
    query: '',
    name: '',
    ...step.values,
  });
}

/**
 * The working line's phase for a Code turn: reply text first (so the stalled-
 * reply reassurance still works when a step never reports completion), then
 * the latest step while it runs (an older stuck step never shows stale), else
 * thinking. `workflow` rather than `tool`: the line narrates, no row animates.
 */
export function codeTurnPhase(
  steps: readonly CodeStep[],
  content: string | undefined,
  t: Translate,
): ChatPhase {
  if ((content ?? '').trim()) return { kind: 'writing' };
  const last = steps[steps.length - 1];
  if (last?.status === 'running') {
    return { kind: 'workflow', detail: stepSentence(t, last, 'running') };
  }
  return { kind: 'thinking' };
}

// ---------------------------------------------------------------------------
// Shared store
// ---------------------------------------------------------------------------

const EMPTY_TURN: CodeTurn = { steps: [] };
// ponytail: kept for the app session like the SDK's tool calls; 200 turns is a few MB at worst.
const MAX_TURNS = 200;
const turns = new Map<string, CodeTurn>();
const facts = new Map<string, Map<string, StepFacts>>();
const subscribers = new Set<() => void>();
let listening = false;

function publish() {
  subscribers.forEach((notify) => notify());
}

function turnFor(generationId: string): CodeTurn {
  const existing = turns.get(generationId);
  if (existing) return existing;
  if (turns.size >= MAX_TURNS) {
    const oldest = turns.keys().next().value;
    if (oldest !== undefined) {
      turns.delete(oldest);
      facts.delete(oldest);
    }
  }
  turns.set(generationId, EMPTY_TURN);
  return EMPTY_TURN;
}

/** ACP plan entries and opencode's `todowrite` rows through the SDK's normaliser. */
function todosOf(entries: unknown): Todo[] | undefined {
  if (!Array.isArray(entries)) return undefined;
  return extractLatestTodos([
    {
      id: '',
      name: WRITE_TODOS_TOOL,
      input: { todos: entries },
      log: '',
      result: '',
    },
  ]);
}

export function applyToolCall(
  generationId: string | undefined,
  update: AcpToolCall | undefined,
): void {
  const id = update ? text(update.toolCallId) : undefined;
  if (!generationId || !id || !update) return;
  const turn = turnFor(generationId);
  const byId = facts.get(generationId) ?? new Map<string, StepFacts>();
  facts.set(generationId, byId);
  const merged = mergeToolCall(byId.get(id), update);
  byId.set(id, merged);
  const step = describeStep(merged, id);
  let next: CodeTurn | undefined;
  if (step.action === 'plan') {
    const plan = todosOf(merged.input.todos);
    if (plan) next = { ...turn, plan };
  } else {
    const index = turn.steps.findIndex((s) => s.id === id);
    if (index < 0) {
      next = { ...turn, steps: [...turn.steps, step] };
    } else if (JSON.stringify(turn.steps[index]) !== JSON.stringify(step)) {
      const steps = turn.steps.slice();
      steps[index] = step;
      next = { ...turn, steps };
    }
  }
  if (!next) return;
  turns.set(generationId, next);
  publish();
}

export function applyPlan(
  generationId: string | undefined,
  update: { entries?: unknown } | undefined,
): void {
  if (!generationId) return;
  const plan = todosOf(update?.entries);
  if (!plan) return;
  turns.set(generationId, { ...turnFor(generationId), plan });
  publish();
}

/** A crash-respawn into the same generation starts over, as the SDK does. */
export function clearTurn(generationId: string | undefined): void {
  if (!generationId || !turns.delete(generationId)) return;
  facts.delete(generationId);
  publish();
}

function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

async function startListening() {
  if (listening || !isTauriApp()) return;
  listening = true;
  const { listen } = await import('@tauri-apps/api/event');
  await listen<{ generation_id?: string; update?: AcpToolCall }>(
    'opencode:tool_call',
    (evt) => applyToolCall(evt.payload.generation_id, evt.payload.update),
  );
  await listen<{ generation_id?: string; update?: { entries?: unknown } }>(
    'opencode:plan',
    (evt) => applyPlan(evt.payload.generation_id, evt.payload.update),
  );
  await listen<{ generation_id?: string }>('ollama:restart', (evt) =>
    clearTurn(evt.payload.generation_id),
  );
}

// A new chat's first step lands before any bubble mounts, and the listeners
// deliberately outlive every subscriber, as the permission store's do.
void startListening();

function subscribe(notify: () => void) {
  subscribers.add(notify);
  void startListening();
  return () => {
    subscribers.delete(notify);
  };
}

export function useCodeTurn(generationId: string | undefined): CodeTurn {
  return useSyncExternalStore(
    subscribe,
    () => (generationId && turns.get(generationId)) || EMPTY_TURN,
    () => EMPTY_TURN,
  );
}

/** Test support only: module state outlives any component by design. */
export function resetCodeActivityForTests(): void {
  turns.clear();
  facts.clear();
  listening = false;
  publish();
}

// ---------------------------------------------------------------------------
// The folded step list
// ---------------------------------------------------------------------------

type RowStatus = StepStatus | 'stopped';

/** Distinct shapes, never colour alone (WCAG 1.4.1), with an sr-only label. */
const ROW_META: Record<RowStatus, { Icon: typeof Circle; labelKey: string }> = {
  running: { Icon: CircleDot, labelKey: 'statusRunning' },
  done: { Icon: CircleCheck, labelKey: 'statusDone' },
  failed: { Icon: CircleX, labelKey: 'statusFailed' },
  stopped: { Icon: Circle, labelKey: 'statusStopped' },
};

const StepRow = React.memo(function StepRow({
  step,
  stale,
}: {
  step: CodeStep;
  /** The turn ended while this step was still running. */
  stale: boolean;
}) {
  const t = useTranslations('chatCodeActivity');
  const status: RowStatus = stale ? 'stopped' : step.status;
  const { Icon, labelKey } = ROW_META[status];
  const body = (
    <>
      <Icon
        aria-hidden="true"
        className="mt-0.5 h-3 w-3 shrink-0 text-gray-400"
      />
      <span className="sr-only">{t(labelKey)}</span>
      <span className="min-w-0 flex-1 text-gray-700 dark:text-gray-300">
        {stepSentence(t, step, step.status)}
      </span>
    </>
  );
  return (
    <li data-testid="code-activity-step" data-status={status}>
      {step.details ? (
        <details>
          <summary className="flex cursor-pointer list-none items-start gap-1.5 [&::-webkit-details-marker]:hidden">
            {body}
          </summary>
          {/* bg-gray-200 is the bubble's own inline-code surface, as on the permission card. */}
          <code
            data-testid="code-activity-details"
            className="mt-1 ml-[18px] block max-h-32 overflow-y-auto rounded bg-gray-200 px-1.5 py-1 font-mono break-all whitespace-pre-wrap text-gray-700"
          >
            {step.details}
          </code>
        </details>
      ) : (
        <div className="flex items-start gap-1.5">{body}</div>
      )}
    </li>
  );
});

export function CodeActivity({
  generationId,
  isCurrentlyStreaming = false,
}: {
  generationId: string;
  isCurrentlyStreaming?: boolean;
}) {
  const t = useTranslations('chatCodeActivity');
  const { steps } = useCodeTurn(generationId);
  // Folded by default: the working line narrates the live step, this is the record.
  const [isOpen, setIsOpen] = useState(false);

  if (steps.length === 0) return null;

  const isActive =
    isCurrentlyStreaming && steps.some((step) => step.status === 'running');

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mb-2"
      data-testid="code-activity"
    >
      <CollapsibleTrigger
        className="flex cursor-pointer items-center gap-1 pt-1 text-xs text-gray-500 transition-colors hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
        data-testid="code-activity-trigger"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-90',
          )}
        />
        <span className="font-medium">
          {t('steps', { count: steps.length })}
        </span>
        {isActive && (
          <span className="inline-flex gap-0.5" aria-hidden="true">
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:0ms] motion-reduce:animate-none" />
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:150ms] motion-reduce:animate-none" />
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:300ms] motion-reduce:animate-none" />
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-2 pl-4">
        <ol
          className="space-y-1.5 border-l-2 border-gray-200 pt-2 pl-3 text-xs leading-relaxed dark:border-gray-700"
          data-testid="code-activity-steps"
        >
          {steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              stale={!isCurrentlyStreaming && step.status === 'running'}
            />
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
