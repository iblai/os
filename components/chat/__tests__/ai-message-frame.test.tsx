import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Message } from '@iblai/iblai-js/web-utils';

import {
  AIMessageFrame,
  AIWorkingMessage,
  hasArtifactVersions,
  hasVisibleBubbleContent,
} from '../ai-message-frame';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CSS_CLASS_NAMES } from '@/lib/constants';

const baseMessage = (overrides: Partial<Message> = {}): Message =>
  ({
    id: 'm-1',
    role: 'assistant',
    content: '',
    timestamp: '2026-07-29T10:44:00.000Z',
    visible: true,
    ...overrides,
  }) as Message;

describe('hasArtifactVersions', () => {
  it('is false without a message', () => {
    expect(hasArtifactVersions(undefined)).toBe(false);
  });

  it('is false for an empty version list', () => {
    expect(hasArtifactVersions(baseMessage({ artifactVersions: [] }))).toBe(
      false,
    );
  });

  it('is true once a version exists', () => {
    expect(
      hasArtifactVersions(
        baseMessage({
          artifactVersions: [{ id: 1 }],
        } as unknown as Partial<Message>),
      ),
    ).toBe(true);
  });
});

describe('hasVisibleBubbleContent', () => {
  it('is false for an empty streaming message', () => {
    expect(
      hasVisibleBubbleContent({ content: '', message: baseMessage() }),
    ).toBe(false);
  });

  it('is false for whitespace-only content', () => {
    expect(hasVisibleBubbleContent({ content: '   \n ' })).toBe(false);
  });

  it('is false when content is omitted entirely', () => {
    expect(hasVisibleBubbleContent({})).toBe(false);
  });

  it('is true once a token has arrived', () => {
    expect(hasVisibleBubbleContent({ content: 'Sure —' })).toBe(true);
  });

  it('ignores reasoning and tool calls while showReasoning is off', () => {
    expect(
      hasVisibleBubbleContent({
        content: '',
        reasoningContent: 'pondering',
        toolCalls: [{ id: 'tc1', name: 'web_search', log: '', result: '' }],
      }),
    ).toBe(false);
  });

  it('is true for visible reasoning', () => {
    expect(
      hasVisibleBubbleContent({
        content: '',
        reasoningContent: 'pondering',
        showReasoning: true,
      }),
    ).toBe(true);
  });

  it('is true for visible tool calls', () => {
    expect(
      hasVisibleBubbleContent({
        content: '',
        toolCalls: [{ id: 'tc1', name: 'web_search', log: '', result: '' }],
        showReasoning: true,
      }),
    ).toBe(true);
  });

  it('is false for a visible but empty tool-call list', () => {
    expect(
      hasVisibleBubbleContent({
        content: '',
        toolCalls: [],
        showReasoning: true,
      }),
    ).toBe(false);
  });

  it('is true for a message carrying actions', () => {
    expect(
      hasVisibleBubbleContent({
        content: '',
        message: baseMessage({
          actions: [{ actionType: 'noop', text: 'Join' }],
        } as unknown as Partial<Message>),
      }),
    ).toBe(true);
  });

  it('is true for a message carrying an artifact version', () => {
    expect(
      hasVisibleBubbleContent({
        content: '',
        message: baseMessage({
          artifactVersions: [{ id: 1 }],
        } as unknown as Partial<Message>),
      }),
    ).toBe(true);
  });
});

describe('AIMessageFrame', () => {
  it('renders one avatar/name/timestamp header around its children', () => {
    render(
      <AIMessageFrame
        profileImage="/avatar.png"
        mentorName="Mentor"
        timestamp="10:44AM"
      >
        <p>bubble</p>
      </AIMessageFrame>,
    );

    expect(screen.getByText('Mentor')).toBeInTheDocument();
    expect(screen.getByText('10:44AM')).toBeInTheDocument();
    expect(screen.getByText('bubble')).toBeInTheDocument();
    // Radix only swaps in the real <img> once it loads, so the fallback is what
    // is observable in jsdom — and it is the mentor's initials.
    expect(screen.getByText('ME')).toBeInTheDocument();
  });
});

describe('AIWorkingMessage', () => {
  const renderPlaceholder = () =>
    render(
      <TooltipProvider>
        <AIWorkingMessage
          phase={{ kind: 'tool', name: 'web_search' }}
          profileImage="/avatar.png"
          mentorName="Mentor"
          timestamp="10:44AM"
        />
      </TooltipProvider>,
    );

  it('frames the shimmer as an agent message', () => {
    renderPlaceholder();

    const placeholder = screen.getByTestId('chat-working-message');
    expect(within(placeholder).getByText('Mentor')).toBeInTheDocument();
    expect(within(placeholder).getByText('10:44AM')).toBeInTheDocument();
    expect(
      within(placeholder).getByTestId('chat-working-indicator'),
    ).toBeInTheDocument();
    expect(
      within(placeholder).getByText('Using web_search…'),
    ).toBeInTheDocument();
  });

  it('does not masquerade as a real AI response', () => {
    const { container } = renderPlaceholder();

    expect(
      container.querySelector(`.${CSS_CLASS_NAMES.CHAT.AI_MESSAGE_RESPONSE}`),
    ).not.toBeInTheDocument();
  });

  it('renders an empty frame once the turn goes idle', () => {
    render(
      <TooltipProvider>
        <AIWorkingMessage
          phase={{ kind: 'idle' }}
          profileImage="/avatar.png"
          mentorName="Mentor"
          timestamp="10:44AM"
        />
      </TooltipProvider>,
    );

    expect(
      screen.queryByTestId('chat-working-indicator'),
    ).not.toBeInTheDocument();
  });
});
