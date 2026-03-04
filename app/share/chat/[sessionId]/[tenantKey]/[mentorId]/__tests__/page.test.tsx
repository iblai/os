import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import ShareChatWithParamsPage from '../page';

// Mocks
const mockRedirectToAuthSpa = vi.fn();

let mockParams: { sessionId?: string; tenantKey?: string; mentorId?: string } = {
  sessionId: 'session-123',
  tenantKey: 'tenant-abc',
  mentorId: 'mentor-1',
};

let mockSharedChatData: {
  messages: any[];
  isLoading: boolean;
  isError: boolean;
} = {
  messages: [
    {
      id: 'msg-1',
      type: 'human',
      role: 'user' as const,
      visible: true,
      content: 'Hello!',
    },
    {
      id: 'msg-2',
      type: 'ai',
      role: 'assistant' as const,
      visible: true,
      content: 'Hi there!',
    },
  ],
  isLoading: false,
  isError: false,
};

let mockMentorSettings: {
  profileImage?: string;
  mentorName?: string;
  mentorUniqueId?: string;
} | null = {
  profileImage: 'https://example.com/avatar.png',
  mentorName: 'Test Mentor',
  mentorUniqueId: 'mentor-1',
};

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
}));

vi.mock('@/hooks/use-shared-chat-messages', () => ({
  useSharedChatMessages: () => mockSharedChatData,
}));

vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => ({ data: mockMentorSettings }),
}));

vi.mock('@/lib/utils', () => ({
  redirectToAuthSpa: () => mockRedirectToAuthSpa(),
}));

vi.mock('@/app/platform/_components/app-layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock('@/components/chat/chat-messages', () => ({
  ChatMessages: ({
    messages,
    tenantKey,
    mentorName,
    mentorId,
    sessionId,
    handleHighlightMessage,
    handleSubmit,
  }: {
    messages: any[];
    tenantKey: string;
    mentorName: string;
    mentorId: string;
    sessionId: string;
    handleHighlightMessage: () => void;
    handleSubmit: () => void;
  }) => (
    <div data-testid="chat-messages">
      <span data-testid="messages-count">{messages.length}</span>
      <span data-testid="tenant-key">{tenantKey}</span>
      <span data-testid="mentor-name">{mentorName}</span>
      <span data-testid="mentor-id">{mentorId}</span>
      <span data-testid="session-id">{sessionId}</span>
      <button data-testid="highlight-btn" onClick={handleHighlightMessage}>
        Highlight
      </button>
      <button data-testid="submit-btn" onClick={handleSubmit}>
        Submit
      </button>
    </div>
  ),
}));

describe('ShareChatWithParamsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {
      sessionId: 'session-123',
      tenantKey: 'tenant-abc',
      mentorId: 'mentor-1',
    };
    mockSharedChatData = {
      messages: [
        {
          id: 'msg-1',
          type: 'human',
          role: 'user' as const,
          visible: true,
          content: 'Hello!',
        },
        {
          id: 'msg-2',
          type: 'ai',
          role: 'assistant' as const,
          visible: true,
          content: 'Hi there!',
        },
      ],
      isLoading: false,
      isError: false,
    };
    mockMentorSettings = {
      profileImage: 'https://example.com/avatar.png',
      mentorName: 'Test Mentor',
      mentorUniqueId: 'mentor-1',
    };
  });

  it('renders AppLayout wrapper', () => {
    const { getByTestId } = render(<ShareChatWithParamsPage />);

    expect(getByTestId('app-layout')).toBeInTheDocument();
  });

  it('renders ChatMessages component', () => {
    const { getByTestId } = render(<ShareChatWithParamsPage />);

    expect(getByTestId('chat-messages')).toBeInTheDocument();
  });

  it('passes messages to ChatMessages', () => {
    const { getByTestId } = render(<ShareChatWithParamsPage />);

    expect(getByTestId('messages-count').textContent).toBe('2');
  });

  it('passes tenantKey to ChatMessages', () => {
    const { getByTestId } = render(<ShareChatWithParamsPage />);

    expect(getByTestId('tenant-key').textContent).toBe('tenant-abc');
  });

  it('passes mentor settings to ChatMessages', () => {
    const { getByTestId } = render(<ShareChatWithParamsPage />);

    expect(getByTestId('mentor-name').textContent).toBe('Test Mentor');
    expect(getByTestId('mentor-id').textContent).toBe('mentor-1');
  });

  it('passes sessionId to ChatMessages', () => {
    const { getByTestId } = render(<ShareChatWithParamsPage />);

    expect(getByTestId('session-id').textContent).toBe('session-123');
  });

  it('handles missing mentor settings gracefully', () => {
    mockMentorSettings = null;

    const { getByTestId } = render(<ShareChatWithParamsPage />);

    expect(getByTestId('mentor-name').textContent).toBe('');
    expect(getByTestId('mentor-id').textContent).toBe('');
  });

  it('handles missing params gracefully', () => {
    mockParams = {
      sessionId: undefined,
      tenantKey: undefined,
      mentorId: undefined,
    };

    const { getByTestId } = render(<ShareChatWithParamsPage />);

    expect(getByTestId('tenant-key').textContent).toBe('');
  });

  it('redirects to auth when highlight button is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { getByTestId } = render(<ShareChatWithParamsPage />);

    fireEvent.click(getByTestId('highlight-btn'));

    expect(consoleSpy).toHaveBeenCalledWith(
      '[auth-redirect] User clicked login from shared chat page',
    );
    expect(mockRedirectToAuthSpa).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('redirects to auth when submit button is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { getByTestId } = render(<ShareChatWithParamsPage />);

    fireEvent.click(getByTestId('submit-btn'));

    expect(consoleSpy).toHaveBeenCalledWith(
      '[auth-redirect] User clicked login from shared chat page',
    );
    expect(mockRedirectToAuthSpa).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
