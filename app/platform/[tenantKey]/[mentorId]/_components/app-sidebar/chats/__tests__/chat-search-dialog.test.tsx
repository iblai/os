/**
 * ChatSearchDialog — unit tests for the mentor-scoped chat-search palette.
 *
 * The dialog reuses the `useRecentChats` hook, so the SDK / Redux / Next.js
 * dependencies are mocked to the minimal shape it consumes. Mutable `let`
 * state lets each test swap the canned data.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------

const pushMock = vi.fn();
const dispatchMock = vi.fn();
const refetchRecentMock = vi.fn(() => Promise.resolve(undefined));
const refetchPinnedMock = vi.fn(() => Promise.resolve(undefined));
const fetchNextPageMock = vi.fn(() => Promise.resolve(undefined));
const addPinnedMessageMock = vi.fn(() => ({
  unwrap: () => Promise.resolve({}),
}));
const unpinMessageMock = vi.fn(() => ({ unwrap: () => Promise.resolve({}) }));
const deleteMessageMock = vi.fn(() => ({ unwrap: () => Promise.resolve({}) }));
const exportMessagesToXlsxMock = vi.fn();
const eventBusEmitMock = vi.fn();
const recentInfiniteArgsMock = vi.fn();

let mockActiveSessionId = 'sess-active';
let mockRecentInfinite: any = {
  pages: [{ results: [] }],
  pageParams: [1],
};
let mockPinnedPages: any = { results: [] };
let mockHasNextPage = false;
let mockIsFetchingNextPage = false;

// ---------------------------------------------------------------------------
// Module mocks (registered before the component import)
// ---------------------------------------------------------------------------

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: any) => {
    try {
      return selector({});
    } catch {
      return undefined;
    }
  },
}));

vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: () => [{}, vi.fn()],
}));

vi.mock('@/features/utils', () => ({
  getUserName: () => 'admin-user',
}));

vi.mock('@/components/markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/eventBus', () => ({
  default: { emit: (...args: unknown[]) => eventBusEmitMock(...args) },
  RemoteEvents: {
    newChat: 'newChat',
    stopChatGenerating: 'stopChatGenerating',
  },
}));

vi.mock('../../export-messages', () => ({
  exportMessagesToXlsx: (...args: unknown[]) =>
    exportMessagesToXlsxMock(...args),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  chatApiSlice: {
    util: {
      updateQueryData: () => ({ type: 'mock/updateQueryData' }),
    },
  },
  useAddPinnedMessageMutation: () => [
    addPinnedMessageMock,
    { isLoading: false },
  ],
  useUnPinMessageMutation: () => [unpinMessageMock, { isLoading: false }],
  useDeleteMessageMutation: () => [deleteMessageMock, { isLoading: false }],
  useGetRecentMessagesInfiniteQuery: (
    args: unknown,
    options?: { skip?: boolean },
  ) => {
    recentInfiniteArgsMock(args);
    return {
      data: options?.skip ? undefined : mockRecentInfinite,
      refetch: refetchRecentMock,
      fetchNextPage: fetchNextPageMock,
      hasNextPage: mockHasNextPage,
      isFetchingNextPage: mockIsFetchingNextPage,
    };
  },
  useGetPinnedMessagesQuery: (
    _args: unknown,
    options?: { skip?: boolean; selectFromResult?: (state: any) => any },
  ) => {
    const state = {
      data: options?.skip ? undefined : mockPinnedPages,
      isError: false,
      isLoading: false,
    };
    return options?.selectFromResult
      ? { ...options.selectFromResult(state), refetch: refetchPinnedMock }
      : { ...state, refetch: refetchPinnedMock };
  },
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  chatActions: {
    setShouldStartNewChat: (...a: unknown[]) => ({
      type: 'chat/setShouldStartNewChat',
      payload: a,
    }),
    updateSessionIds: (...a: unknown[]) => ({
      type: 'chat/updateSessionIds',
      payload: a,
    }),
    resetIsTyping: (...a: unknown[]) => ({
      type: 'chat/resetIsTyping',
      payload: a,
    }),
    setStreaming: (...a: unknown[]) => ({
      type: 'chat/setStreaming',
      payload: a,
    }),
    resetCurrentStreamingMessage: (...a: unknown[]) => ({
      type: 'chat/resetCurrentStreamingMessage',
      payload: a,
    }),
    setActiveTab: (...a: unknown[]) => ({
      type: 'chat/setActiveTab',
      payload: a,
    }),
  },
  clearFiles: (...a: unknown[]) => ({ type: 'chat/clearFiles', payload: a }),
  selectSessionId: () => mockActiveSessionId,
  selectStreaming: () => false,
  selectNumberOfActiveChatMessages: () => 0,
  selectActiveChatMessages: () => [],
}));

import { ChatSearchDialog } from '../chat-search-dialog';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  tenantKey: 'tenant-a',
  mentorId: 'mentor-1' as string | undefined,
  username: 'admin-user' as string | null,
  onNewChat: vi.fn(),
};

function renderDialog(overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, ...overrides };
  const view = render(<ChatSearchDialog {...props} />);
  return { props, view };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockActiveSessionId = 'sess-active';
  mockRecentInfinite = { pages: [{ results: [] }], pageParams: [1] };
  mockPinnedPages = { results: [] };
  mockHasNextPage = false;
  mockIsFetchingNextPage = false;
});

describe('ChatSearchDialog', () => {
  it('renders the search input, New Chat button, and result rows when open', () => {
    mockRecentInfinite = {
      pages: [
        {
          results: [
            {
              session_id: 'sess-1',
              title: 'First chat',
              mentor: { unique_id: 'mentor-1' },
            },
          ],
        },
      ],
      pageParams: [1],
    };
    renderDialog();

    expect(
      screen.getByPlaceholderText('searchChatsPlaceholder'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'newChat' })).toBeInTheDocument();
    expect(screen.getByText('First chat')).toBeInTheDocument();
  });

  it('shows the empty state when there are no recent chats', () => {
    renderDialog();
    expect(screen.getByText('noRecentChats')).toBeInTheDocument();
  });

  it('passes the current mentor into the recent-messages query arg', () => {
    renderDialog();
    const lastArgs = recentInfiniteArgsMock.mock.calls.at(-1)?.[0] as {
      mentor?: string;
      org?: string;
    };
    expect(lastArgs?.mentor).toBe('mentor-1');
    expect(lastArgs?.org).toBe('tenant-a');
  });

  it('updates the query arg with the debounced search term', () => {
    vi.useFakeTimers();
    try {
      renderDialog();
      const input = screen.getByPlaceholderText('searchChatsPlaceholder');
      fireEvent.change(input, { target: { value: 'invoice' } });
      const hasBefore = recentInfiniteArgsMock.mock.calls.some(
        (c) => (c?.[0] as { search?: string })?.search === 'invoice',
      );
      expect(hasBefore).toBe(false);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      const hasAfter = recentInfiniteArgsMock.mock.calls.some(
        (c) => (c?.[0] as { search?: string })?.search === 'invoice',
      );
      expect(hasAfter).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clicking New Chat calls onNewChat and closes the dialog', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'newChat' }));
    expect(props.onNewChat).toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('clicking a result row navigates and closes the dialog', () => {
    mockRecentInfinite = {
      pages: [
        {
          results: [
            {
              session_id: 'sess-1',
              title: 'First chat',
              mentor: { unique_id: 'mentor-1' },
            },
          ],
        },
      ],
      pageParams: [1],
    };
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'First chat' }));
    expect(pushMock).toHaveBeenCalledWith(
      '/platform/tenant-a/mentor-1?session=sess-1',
    );
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fetches the next page when the sentinel intersects and a next page exists', () => {
    let ioCallback: ((entries: unknown[]) => void) | null = null;
    const prevIO = (window as any).IntersectionObserver;
    (window as any).IntersectionObserver = class {
      constructor(cb: (entries: unknown[]) => void) {
        ioCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    try {
      // First render mounts the Radix portal content (the sentinel node);
      // flipping `hasNextPage` then re-rendering re-runs the sentinel effect
      // now that the node exists, so the observer attaches.
      mockHasNextPage = false;
      const { view } = renderDialog();
      mockHasNextPage = true;
      view.rerender(<ChatSearchDialog {...baseProps} />);
      expect(ioCallback).not.toBeNull();
      act(() => {
        ioCallback?.([{ isIntersecting: true }]);
      });
      expect(fetchNextPageMock).toHaveBeenCalled();
    } finally {
      (window as any).IntersectionObserver = prevIO;
    }
  });

  it('does not fetch the next page when there is no next page', () => {
    let ioCallback: ((entries: unknown[]) => void) | null = null;
    const prevIO = (window as any).IntersectionObserver;
    (window as any).IntersectionObserver = class {
      constructor(cb: (entries: unknown[]) => void) {
        ioCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    try {
      // Attach the observer (via a benign dep flip that re-runs the effect
      // after the sentinel node mounts) while `hasNextPage` stays false — the
      // intersecting callback must then NOT request another page.
      mockHasNextPage = false;
      mockIsFetchingNextPage = false;
      const { view } = renderDialog();
      mockIsFetchingNextPage = true;
      view.rerender(<ChatSearchDialog {...baseProps} />);
      expect(ioCallback).not.toBeNull();
      act(() => {
        ioCallback?.([{ isIntersecting: true }]);
      });
      expect(fetchNextPageMock).not.toHaveBeenCalled();
    } finally {
      (window as any).IntersectionObserver = prevIO;
    }
  });

  it('shows a loading spinner while fetching more chats', () => {
    mockIsFetchingNextPage = true;
    const { view } = renderDialog();
    expect(view.getByRole('status')).toBeInTheDocument();
  });

  it('does not show the loading spinner on the initial fetch', () => {
    mockIsFetchingNextPage = false;
    const { view } = renderDialog();
    expect(view.queryByRole('status')).not.toBeInTheDocument();
  });
});
