import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExpandTab } from '../expand-tab';
import type { Message } from '@iblai/iblai-js/web-utils';

const { mockAdvancedTabsProperties } = vi.hoisted(() => ({
  mockAdvancedTabsProperties: {
    expand: {
      prompts: [
        { type: 'human', content: 'Visible human prompt', hide: false },
        { type: 'human', content: 'Hidden human prompt', hide: true },
        { type: 'ai', content: 'AI prompt that should be skipped' },
      ],
    },
  },
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  advancedTabsProperties: mockAdvancedTabsProperties,
}));

describe('ExpandTab', () => {
  const sendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the translated heading', () => {
    render(<ExpandTab messages={[]} sendMessage={sendMessage} isPreviewMode />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Expand',
    );
  });

  it('sends human prompts (respecting hide) when no messages and not preview mode', () => {
    render(
      <ExpandTab
        messages={[]}
        sendMessage={sendMessage}
        isPreviewMode={false}
      />,
    );

    // Two human prompts -> two calls; ai prompt skipped.
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, 'Visible human prompt', {
      visible: true,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 'Hidden human prompt', {
      visible: false,
    });
  });

  it('does not send prompts in preview mode', () => {
    render(<ExpandTab messages={[]} sendMessage={sendMessage} isPreviewMode />);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does not send prompts when messages already exist', () => {
    const messages = [{ content: 'existing' }] as unknown as Message[];
    render(
      <ExpandTab
        messages={messages}
        sendMessage={sendMessage}
        isPreviewMode={false}
      />,
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
