import { describe, it, expect } from 'vitest';
import type { Message } from '@iblai/iblai-js/web-utils';

import {
  buildMessageTranscript,
  buildTranscript,
  flattenMarkdown,
  type TranscriptLabels,
} from '../chat-transcript';

const labels: TranscriptLabels = {
  header: 'Chat with Test Mentor',
  roleUser: 'You',
  roleAi: 'Test Mentor',
};

const msg = (over: Partial<Message>): Message => ({
  id: '1',
  role: 'assistant',
  content: 'hello',
  timestamp: '2024-01-01T00:00:00Z',
  visible: true,
  ...over,
});

describe('flattenMarkdown', () => {
  it('returns an empty string for empty input', () => {
    expect(flattenMarkdown('')).toBe('');
  });

  it('strips headings of every level', () => {
    expect(flattenMarkdown('# One\n## Two\n###### Six')).toBe('One\nTwo\nSix');
  });

  it('strips bold and italic markers in both syntaxes', () => {
    expect(flattenMarkdown('**bold** and *italic*')).toBe('bold and italic');
    expect(flattenMarkdown('__bold__ and _italic_')).toBe('bold and italic');
  });

  it('unwraps inline code without touching its contents', () => {
    expect(flattenMarkdown('use `a * b _ c` now')).toBe('use a * b _ c now');
  });

  it('keeps fenced code block contents and drops the fences', () => {
    expect(flattenMarkdown('```js\nconst a = 1;\n```')).toBe('const a = 1;');
    expect(flattenMarkdown('~~~\nraw *text*\n~~~')).toBe('raw *text*');
  });

  it('renders links as text plus url, and images as alt text', () => {
    expect(flattenMarkdown('see [docs](https://x.test)')).toBe(
      'see docs (https://x.test)',
    );
    expect(flattenMarkdown('![a picture](https://x.test/i.png)')).toBe(
      'a picture',
    );
  });

  it('normalises list bullets and preserves indentation', () => {
    expect(flattenMarkdown('* one\n+ two\n  - three')).toBe(
      '- one\n- two\n  - three',
    );
  });

  it('strips blockquote markers, including nested ones', () => {
    expect(flattenMarkdown('> quoted\n>> deeper')).toBe('quoted\ndeeper');
  });

  it('preserves newlines and blank lines', () => {
    expect(flattenMarkdown('a\n\nb\n')).toBe('a\n\nb\n');
  });

  it('leaves a lone backtick alone', () => {
    expect(flattenMarkdown('a ` b')).toBe('a ` b');
  });
});

describe('buildTranscript', () => {
  it('renders the header even with no messages', () => {
    expect(buildTranscript([], labels)).toBe('Chat with Test Mentor\n\n');
  });

  it('labels each role and separates messages', () => {
    const text = buildTranscript(
      [
        msg({ id: '1', role: 'user', content: 'Hi there' }),
        msg({ id: '2', role: 'assistant', content: '**Hello**' }),
      ],
      labels,
    );
    expect(text).toBe(
      'Chat with Test Mentor\n\n' +
        '[You] 2024-01-01T00:00:00Z\nHi there\n\n----\n' +
        '\n' +
        '[Test Mentor] 2024-01-01T00:00:00Z\nHello\n\n----\n',
    );
  });

  it('drops invisible messages', () => {
    const text = buildTranscript(
      [
        msg({ id: '1', content: 'shown' }),
        msg({ id: '2', content: 'hidden', visible: false }),
      ],
      labels,
    );
    expect(text).toContain('shown');
    expect(text).not.toContain('hidden');
  });

  it('drops system messages', () => {
    const text = buildTranscript(
      [
        msg({ id: '1', content: 'shown' }),
        msg({ id: '2', role: 'system', content: 'internal prompt' }),
      ],
      labels,
    );
    expect(text).not.toContain('internal prompt');
  });
});

describe('buildMessageTranscript', () => {
  it('renders a single message under the same header', () => {
    expect(buildMessageTranscript(msg({ content: 'Just me' }), labels)).toBe(
      'Chat with Test Mentor\n\n[Test Mentor] 2024-01-01T00:00:00Z\nJust me\n\n----\n',
    );
  });
});
