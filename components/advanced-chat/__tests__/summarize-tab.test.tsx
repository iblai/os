import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SummarizeTab } from '../summarize-tab';
import type { Message } from '@iblai/iblai-js/web-utils';

const { mockAdvancedTabsProperties } = vi.hoisted(() => ({
  mockAdvancedTabsProperties: {
    summarize: {
      prompts: [
        { type: 'human', content: 'Visible summarize prompt', hide: false },
        { type: 'human', content: 'Hidden summarize prompt', hide: true },
        { type: 'ai', content: 'AI prompt skipped' },
      ],
    },
  },
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  advancedTabsProperties: mockAdvancedTabsProperties,
}));

describe('SummarizeTab', () => {
  const sendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the translated heading', () => {
    render(
      <SummarizeTab messages={[]} sendMessage={sendMessage} isPreviewMode />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Summarize',
    );
  });

  it('sends human prompts (respecting hide) when no messages and not preview mode', () => {
    render(
      <SummarizeTab
        messages={[]}
        sendMessage={sendMessage}
        isPreviewMode={false}
      />,
    );

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, 'Visible summarize prompt', {
      visible: true,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 'Hidden summarize prompt', {
      visible: false,
    });
  });

  it('does not send prompts in preview mode', () => {
    render(
      <SummarizeTab messages={[]} sendMessage={sendMessage} isPreviewMode />,
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does not send prompts when messages already exist', () => {
    const messages = [{ content: 'existing' }] as unknown as Message[];
    render(
      <SummarizeTab
        messages={messages}
        sendMessage={sendMessage}
        isPreviewMode={false}
      />,
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
