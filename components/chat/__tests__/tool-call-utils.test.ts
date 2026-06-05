import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolCallInfo } from '@iblai/iblai-js/web-utils';

// Mock TOOL_NAME_MAP before importing the module under test
let mockToolNameMap: Record<string, string> | undefined;

vi.mock('@iblai/iblai-js/web-utils', async () => {
  const actual = await vi.importActual('@iblai/iblai-js/web-utils');
  return {
    ...actual,
    get TOOL_NAME_MAP() {
      return mockToolNameMap;
    },
  };
});

import {
  getFriendlyToolName,
  getQueryLabel,
  formatResult,
} from '../tool-call-utils';

function makeToolCall(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return { id: '1', name: 'test', log: '', result: '', ...overrides };
}

describe('getFriendlyToolName', () => {
  beforeEach(() => {
    mockToolNameMap = {
      web_search_call: 'Searching the web',
      vector_search: 'Searching knowledge base',
    };
  });

  it('returns mapped name for known tools', () => {
    expect(getFriendlyToolName('web_search_call')).toBe('Searching the web');
    expect(getFriendlyToolName('vector_search')).toBe(
      'Searching knowledge base',
    );
  });

  it('title-cases unknown tool names', () => {
    expect(getFriendlyToolName('deep_research_call')).toBe(
      'Deep research call',
    );
  });

  it('handles single-word tool names', () => {
    expect(getFriendlyToolName('calculator')).toBe('Calculator');
  });

  it('handles empty string', () => {
    expect(getFriendlyToolName('')).toBe('');
  });

  it('handles tool names with leading/trailing underscores', () => {
    expect(getFriendlyToolName('_private_tool_')).toBe('Private tool');
  });

  it('returns fallback when TOOL_NAME_MAP is undefined', () => {
    mockToolNameMap = undefined;
    expect(getFriendlyToolName('web_search_call')).toBe('Web search call');
  });
});

describe('getQueryLabel', () => {
  describe('structured input', () => {
    it('extracts from input.query', () => {
      const tc = makeToolCall({ input: { query: 'next F1 race' } });
      expect(getQueryLabel(tc)).toBe('next F1 race');
    });

    it('extracts from input.q', () => {
      const tc = makeToolCall({ input: { q: 'search term' } });
      expect(getQueryLabel(tc)).toBe('search term');
    });

    it('extracts from input.input', () => {
      const tc = makeToolCall({ input: { input: 'user prompt' } });
      expect(getQueryLabel(tc)).toBe('user prompt');
    });

    it('extracts from input.text', () => {
      const tc = makeToolCall({ input: { text: 'some text' } });
      expect(getQueryLabel(tc)).toBe('some text');
    });

    it('prefers query over q over input over text', () => {
      const tc = makeToolCall({
        input: { query: 'q1', q: 'q2', input: 'q3', text: 'q4' },
      });
      expect(getQueryLabel(tc)).toBe('q1');
    });

    it('falls back to first string value in input', () => {
      const tc = makeToolCall({
        input: { customField: 'custom value', num: 42 },
      });
      expect(getQueryLabel(tc)).toBe('custom value');
    });

    it('skips non-string values when finding first string', () => {
      const tc = makeToolCall({ input: { a: 123, b: true, c: 'found' } });
      expect(getQueryLabel(tc)).toBe('found');
    });

    it('returns null when input has no string values', () => {
      const tc = makeToolCall({ input: { a: 123, b: true } });
      expect(getQueryLabel(tc)).toBeNull();
    });

    it('ignores non-string query/q/input/text values', () => {
      const tc = makeToolCall({ input: { query: 42 as unknown as string } });
      // query is not a string, no other string values → null
      expect(getQueryLabel(tc)).toBeNull();
    });
  });

  describe('log string parsing', () => {
    it('extracts query from log with backtick JSON', () => {
      const tc = makeToolCall({
        log: 'Calling tool with `{"query": "F1 schedule"}`',
      });
      expect(getQueryLabel(tc)).toBe('F1 schedule');
    });

    it('extracts q from log', () => {
      const tc = makeToolCall({
        log: 'Calling tool with `{"q": "search"}`',
      });
      expect(getQueryLabel(tc)).toBe('search');
    });

    it('extracts input from log', () => {
      const tc = makeToolCall({
        log: 'Calling tool with `{"input": "data"}`',
      });
      expect(getQueryLabel(tc)).toBe('data');
    });

    it('handles single quotes in log JSON by replacing with double', () => {
      const tc = makeToolCall({
        log: "Calling tool with `{'query': 'test'}`",
      });
      expect(getQueryLabel(tc)).toBe('test');
    });

    it('returns null for log with no backtick JSON', () => {
      const tc = makeToolCall({ log: 'Just a plain log message' });
      expect(getQueryLabel(tc)).toBeNull();
    });

    it('returns null for malformed JSON in log', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const tc = makeToolCall({
        log: 'Calling tool with `{not valid json}`',
      });
      expect(getQueryLabel(tc)).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ToolCallIndicator] Failed to parse log string:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('returns null when parsed log JSON has no query/q/input', () => {
      const tc = makeToolCall({
        log: 'Calling tool with `{"other": "value"}`',
      });
      expect(getQueryLabel(tc)).toBeNull();
    });
  });

  describe('priority', () => {
    it('prefers structured input over log', () => {
      const tc = makeToolCall({
        input: { query: 'from input' },
        log: 'Calling tool with `{"query": "from log"}`',
      });
      expect(getQueryLabel(tc)).toBe('from input');
    });
  });

  it('returns null when no input and no log', () => {
    const tc = makeToolCall({ input: undefined, log: '' });
    expect(getQueryLabel(tc)).toBeNull();
  });
});

describe('formatResult', () => {
  it('collapses 3+ consecutive newlines to 2', () => {
    expect(formatResult('a\n\n\nb')).toBe('a\n\nb');
  });

  it('collapses many consecutive newlines', () => {
    expect(formatResult('a\n\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('preserves double newlines', () => {
    expect(formatResult('a\n\nb')).toBe('a\n\nb');
  });

  it('preserves single newlines', () => {
    expect(formatResult('a\nb')).toBe('a\nb');
  });

  it('trims leading and trailing whitespace', () => {
    expect(formatResult('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(formatResult('')).toBe('');
  });

  it('handles string with only newlines', () => {
    expect(formatResult('\n\n\n\n')).toBe('');
  });
});
