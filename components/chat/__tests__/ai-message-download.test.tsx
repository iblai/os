import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Message } from '@iblai/iblai-js/web-utils';

import { AIMessageDownload } from '../ai-message-download';

// Radix's Tooltip needs a provider that the bubble supplies in the real tree;
// this suite renders the button in isolation (same approach as the share test).
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

const messages: Message[] = [
  {
    id: '1',
    role: 'user',
    content: 'Hello there',
    timestamp: '2024-01-01T00:00:00Z',
    visible: true,
  },
  {
    id: '2',
    role: 'assistant',
    content: '**Hi** back',
    timestamp: '2024-01-01T00:00:05Z',
    visible: true,
  },
];

const props = {
  message: messages[1],
  messages,
  mentorName: 'Test Mentor',
};

// Captured download side effects.
let createdBlobs: Blob[] = [];
let downloadedNames: string[] = [];
let revoked: string[] = [];

let clickSpy: ReturnType<typeof vi.spyOn>;

// jsdom's Blob has no `.text()`, so read it the way the platform allows.
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

const today = () => new Date().toISOString().slice(0, 10);

describe('AIMessageDownload', () => {
  beforeEach(() => {
    createdBlobs = [];
    downloadedNames = [];
    revoked = [];
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedNames.push(this.download);
      });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      createdBlobs.push(blob as Blob);
      return 'blob:mock-url';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revoked.push(url);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the download button with its accessible name', () => {
    render(<AIMessageDownload {...props} />);
    expect(
      screen.getByRole('button', { name: 'Download this chat' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent('Download');
  });

  it('does not show the dialog until the button is clicked', () => {
    render(<AIMessageDownload {...props} />);
    expect(screen.queryByText('Download Chat')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Download this chat' }));

    expect(screen.getByText('Download Chat')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Choose what you would like to download as a text file.',
      ),
    ).toBeInTheDocument();
  });

  const openDialog = () => {
    render(<AIMessageDownload {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download this chat' }));
  };

  it('preselects the whole conversation', () => {
    openDialog();
    expect(screen.getByRole('radio', { name: 'Entire chat' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'This message only' }),
    ).not.toBeChecked();
  });

  it('downloads nothing until the download button is pressed', () => {
    openDialog();
    fireEvent.click(screen.getByRole('radio', { name: 'This message only' }));

    expect(createdBlobs).toHaveLength(0);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Download Chat')).toBeInTheDocument();
  });

  it('downloads the whole conversation as a dated chat transcript', async () => {
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0].type).toBe('text/plain;charset=utf-8');
    expect(downloadedNames).toEqual([`chat-Test Mentor-${today()}.txt`]);
    expect(revoked).toEqual(['blob:mock-url']);

    const text = await readBlob(createdBlobs[0]);
    expect(text).toBe(
      'Chat with Test Mentor\n\n' +
        '[You] 2024-01-01T00:00:00Z\nHello there\n\n----\n' +
        '\n' +
        '[Test Mentor] 2024-01-01T00:00:05Z\nHi back\n\n----\n',
    );
    expect(screen.queryByText('Download Chat')).not.toBeInTheDocument();
  });

  it('downloads only the current message when that choice is made', async () => {
    openDialog();
    fireEvent.click(screen.getByRole('radio', { name: 'This message only' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(downloadedNames).toEqual([`message-Test Mentor-${today()}.txt`]);
    const text = await readBlob(createdBlobs[0]);
    expect(text).toBe(
      'Chat with Test Mentor\n\n[Test Mentor] 2024-01-01T00:00:05Z\nHi back\n\n----\n',
    );
    expect(text).not.toContain('Hello there');
    expect(screen.queryByText('Download Chat')).not.toBeInTheDocument();
  });

  it('falls back to the generic AI label when the mentor has no name', async () => {
    render(<AIMessageDownload {...props} mentorName="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download this chat' }));
    fireEvent.click(screen.getByRole('radio', { name: 'This message only' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    const text = await readBlob(createdBlobs[0]);
    expect(text).toContain('[AI] 2024-01-01T00:00:05Z');
  });

  it('dismisses without downloading when the dialog is closed', () => {
    openDialog();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });

    expect(screen.queryByText('Download Chat')).not.toBeInTheDocument();
    expect(createdBlobs).toHaveLength(0);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('reopens on the default choice after picking the other one', () => {
    openDialog();
    fireEvent.click(screen.getByRole('radio', { name: 'This message only' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    fireEvent.click(screen.getByRole('button', { name: 'Download this chat' }));

    expect(screen.getByRole('radio', { name: 'Entire chat' })).toBeChecked();
  });
});
