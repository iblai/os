import { describe, it, expect, vi } from 'vitest';

/**
 * The streaming re-render guard on ToolCallItem: streaming events rebuild
 * the tool list every tick, so object identity changes while content does
 * not — and without this equality a dozen expanded tool rows re-rendered
 * several times a second, which is a big share of what froze phone webviews
 * during Code turns. (Lives apart from tool-call-item.test.tsx, which is in
 * the deferred yalc-import-failure bucket.)
 */

// Factory mock (no importOriginal): the real module resolves through the
// yalc web-utils dist, whose optional deps vite cannot resolve at collection
// time. Only TOOL_NAME_MAP (a value import in tool-call-utils) is needed.
vi.mock('@iblai/iblai-js/web-utils', () => ({
  TOOL_NAME_MAP: {},
}));

import { toolCallItemPropsEqual } from '../tool-call-item';

const base = {
  toolCall: {
    name: 'web_search',
    input: { query: 'llamas' },
    result: 'found 3',
    log: undefined,
  },
  shouldPulse: false,
  isCurrentlyStreaming: true,
} as never;

describe('toolCallItemPropsEqual (streaming re-render guard)', () => {
  it('treats a rebuilt-but-identical toolCall as equal (no re-render)', () => {
    const rebuilt = {
      ...(base as object),
      toolCall: {
        ...(base as { toolCall: object }).toolCall,
        input: { query: 'llamas' },
      },
    } as never;
    expect(toolCallItemPropsEqual(base, rebuilt)).toBe(true);
  });

  it('re-renders when the result, query, or flags actually change', () => {
    const b = base as {
      toolCall: Record<string, unknown>;
      shouldPulse: boolean;
    };
    expect(
      toolCallItemPropsEqual(base, {
        ...b,
        toolCall: { ...b.toolCall, result: 'found 4' },
      } as never),
    ).toBe(false);
    expect(
      toolCallItemPropsEqual(base, {
        ...b,
        toolCall: { ...b.toolCall, input: { query: 'alpacas' } },
      } as never),
    ).toBe(false);
    expect(
      toolCallItemPropsEqual(base, { ...b, shouldPulse: true } as never),
    ).toBe(false);
  });
});
