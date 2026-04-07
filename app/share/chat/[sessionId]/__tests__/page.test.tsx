import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import ShareChatPage from '../page';

// Mocks
const mockPush = vi.fn();
const mockRedirect = vi.fn();
const mockDispatch = vi.fn();
const mockSetTenantKey = vi.fn();
const mockSaveCachedSessionId = vi.fn();

let mockParams: { sessionId?: string } = { sessionId: 'session-123' };

let mockSharedChatData: {
  chatDetails: any;
  messages: any[];
  mentorUniqueId: string | undefined;
  platformKey: string | undefined;
  isLoading: boolean;
  isError: boolean;
  error: any;
} = {
  chatDetails: {
    results: [
      {
        id: 'msg-1',
        type: 'human',
        role: 'user' as const,
        visible: true,
        message: { type: 'human', data: { content: 'Hello!' } },
      },
    ],
    mentor_unique_id: 'mentor-1',
    platform_key: 'main',
  },
  messages: [
    {
      id: 'msg-1',
      type: 'human',
      role: 'user' as const,
      visible: true,
      message: { type: 'human', data: { content: 'Hello!' } },
    },
  ],
  mentorUniqueId: 'mentor-1',
  platformKey: 'main',
  isLoading: false,
  isError: false,
  error: undefined,
};

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush }),
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/hooks/use-shared-chat-messages', () => ({
  useSharedChatMessages: () => mockSharedChatData,
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  chatActions: {
    addUserMessage: vi.fn((payload) => ({ type: 'ADD_MESSAGE', payload })),
    setShowingSharedChat: vi.fn((payload) => ({
      type: 'SET_SHOWING_SHARED',
      payload,
    })),
  },
  useTenantContext: () => ({ setTenantKey: mockSetTenantKey }),
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: () => [{}, mockSaveCachedSessionId],
}));

vi.mock('@/components/spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

describe('ShareChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { sessionId: 'session-123' };
    mockSharedChatData = {
      chatDetails: {
        results: [
          {
            id: 'msg-1',
            type: 'human',
            role: 'user' as const,
            visible: true,
            message: { type: 'human', data: { content: 'Hello!' } },
          },
        ],
        mentor_unique_id: 'mentor-1',
        platform_key: 'main',
      },
      messages: [
        {
          id: 'msg-1',
          type: 'human',
          role: 'user' as const,
          visible: true,
          message: { type: 'human', data: { content: 'Hello!' } },
        },
      ],
      mentorUniqueId: 'mentor-1',
      platformKey: 'main',
      isLoading: false,
      isError: false,
      error: undefined,
    };
  });

  it('dispatches chat actions when data is loaded', async () => {
    render(<ShareChatPage />);

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  it('navigates to platform page when chat details are loaded', async () => {
    render(<ShareChatPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/platform/main/mentor-1');
    });
  });

  it('sets tenant key from chat details', async () => {
    render(<ShareChatPage />);

    await waitFor(() => {
      expect(mockSetTenantKey).toHaveBeenCalledWith('main');
    });
  });

  it('shows spinner when loading', () => {
    mockSharedChatData = {
      ...mockSharedChatData,
      chatDetails: undefined,
      messages: [],
      mentorUniqueId: undefined,
      platformKey: undefined,
      isLoading: true,
    };

    const { getByTestId } = render(<ShareChatPage />);

    expect(getByTestId('spinner')).toBeInTheDocument();
  });

  it('redirects to error page on error', () => {
    mockSharedChatData = {
      ...mockSharedChatData,
      chatDetails: undefined,
      messages: [],
      mentorUniqueId: undefined,
      platformKey: undefined,
      isLoading: false,
      isError: true,
    };

    render(<ShareChatPage />);

    expect(mockRedirect).toHaveBeenCalledWith(
      '/error/404?errorType=sessionNotFound',
    );
  });

  it('returns null when data is loaded but no redirect yet', () => {
    mockSharedChatData = {
      ...mockSharedChatData,
      messages: [],
      isLoading: false,
      isError: false,
    };

    const { container } = render(<ShareChatPage />);

    expect(container.firstChild).toBeNull();
  });
});
