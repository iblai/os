import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { AIMessageSpeak } from '../ai-message-speak';

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

type UtteranceLike = {
  text: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

let speakCalls: UtteranceLike[];
let cancelCalls: number;

class MockSpeechSynthesisUtterance {
  text: string;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

describe('AIMessageSpeak', () => {
  beforeEach(() => {
    speakCalls = [];
    cancelCalls = 0;
    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (window as any).speechSynthesis = {
      speak: (u: UtteranceLike) => speakCalls.push(u),
      cancel: () => {
        cancelCalls += 1;
      },
    };
  });

  afterEach(() => {
    delete (window as any).SpeechSynthesisUtterance;
    delete (window as any).speechSynthesis;
    vi.clearAllMocks();
  });

  it('renders the speak button with the read-aloud label', () => {
    render(<AIMessageSpeak content="Hello world" />);
    expect(
      screen.getByRole('button', { name: /read aloud/i }),
    ).toBeInTheDocument();
  });

  it('speaks the content when clicked', () => {
    render(<AIMessageSpeak content="Hello world" />);
    fireEvent.click(screen.getByRole('button', { name: /read aloud/i }));
    expect(speakCalls).toHaveLength(1);
    expect(speakCalls[0].text).toBe('Hello world');
  });

  it('switches the button label to stop while speaking', () => {
    render(<AIMessageSpeak content="Hello world" />);
    fireEvent.click(screen.getByRole('button', { name: /read aloud/i }));
    expect(
      screen.getByRole('button', { name: /stop reading aloud/i }),
    ).toBeInTheDocument();
  });

  it('cancels speech when toggled off', () => {
    render(<AIMessageSpeak content="Hello world" />);
    fireEvent.click(screen.getByRole('button', { name: /read aloud/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /stop reading aloud/i }),
    );
    expect(cancelCalls).toBeGreaterThanOrEqual(1);
  });

  it('resets the label when the utterance finishes', () => {
    render(<AIMessageSpeak content="Hello world" />);
    fireEvent.click(screen.getByRole('button', { name: /read aloud/i }));
    act(() => {
      speakCalls[0].onend?.();
    });
    expect(
      screen.getByRole('button', { name: /read aloud/i }),
    ).toBeInTheDocument();
  });

  it('cancels any pending speech when unmounted', () => {
    const { unmount } = render(<AIMessageSpeak content="Hello world" />);
    unmount();
    expect(cancelCalls).toBeGreaterThanOrEqual(1);
  });

  it('renders nothing if speech synthesis is unsupported', () => {
    delete (window as any).speechSynthesis;
    const { container } = render(<AIMessageSpeak content="Hello world" />);
    expect(container).toBeEmptyDOMElement();
  });
});
