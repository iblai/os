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

vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: vi.fn(() => ({
    data: { voiceProvider: 'browser' },
  })),
}));

vi.mock('@/providers/use-user', () => ({
  useUsername: vi.fn(() => 'tester'),
}));

vi.mock('@/hooks/use-shared-chat-messages', () => ({
  useSharedChatMessages: vi.fn(() => ({ messages: [] })),
}));

const fetchTtsMock = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetChatMessageTtsQuery: () => [fetchTtsMock, { isFetching: false }],
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

const baseMessage = {
  id: '42',
  role: 'assistant' as const,
  content: 'Hello world',
  timestamp: '',
  visible: true,
};

const renderSpeak = (overrides: Partial<typeof baseMessage> = {}) =>
  render(
    <AIMessageSpeak
      message={{ ...baseMessage, ...overrides }}
      mentorId="mentor-1"
      tenantKey="org-1"
      sessionId="session-1"
    />,
  );

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
    fetchTtsMock.mockReset();
  });

  afterEach(() => {
    delete (window as any).SpeechSynthesisUtterance;
    delete (window as any).speechSynthesis;
    vi.clearAllMocks();
  });

  it('renders the speak button with the read-aloud label', () => {
    renderSpeak();
    expect(
      screen.getByRole('button', { name: /read aloud/i }),
    ).toBeInTheDocument();
  });

  it('speaks the content when clicked', () => {
    renderSpeak();
    fireEvent.click(screen.getByRole('button', { name: /read aloud/i }));
    expect(speakCalls).toHaveLength(1);
    expect(speakCalls[0].text).toBe('Hello world');
  });

  it('switches the button label to stop while speaking', () => {
    renderSpeak();
    fireEvent.click(screen.getByRole('button', { name: /read aloud/i }));
    expect(
      screen.getByRole('button', { name: /stop reading aloud/i }),
    ).toBeInTheDocument();
  });

  it('cancels speech when toggled off', () => {
    renderSpeak();
    fireEvent.click(screen.getByRole('button', { name: /read aloud/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /stop reading aloud/i }),
    );
    expect(cancelCalls).toBeGreaterThanOrEqual(1);
  });

  it('resets the label when the utterance finishes', () => {
    renderSpeak();
    fireEvent.click(screen.getByRole('button', { name: /read aloud/i }));
    act(() => {
      speakCalls[0].onend?.();
    });
    expect(
      screen.getByRole('button', { name: /read aloud/i }),
    ).toBeInTheDocument();
  });

  it('cancels any pending speech when unmounted', () => {
    const { unmount } = renderSpeak();
    unmount();
    expect(cancelCalls).toBeGreaterThanOrEqual(1);
  });

  it('renders nothing if speech synthesis is unsupported', () => {
    delete (window as any).speechSynthesis;
    const { container } = renderSpeak();
    expect(container).toBeEmptyDOMElement();
  });
});
