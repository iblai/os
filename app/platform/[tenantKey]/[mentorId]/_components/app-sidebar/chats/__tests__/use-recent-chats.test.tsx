/**
 * useRecentChats — unit tests for the extracted chat-history hook.
 *
 * Covers the non-presentational logic moved out of `SidebarChatsSection`:
 * pinned/recent dedup, client-side `filterByMentor`, infinite-query page
 * flattening, and that `handleDelete` triggers a recent refetch.
 *
 * Every SDK / Redux / Next.js dependency is mocked to the minimum shape the
 * hook consumes; mutable `let` state lets each test swap the canned data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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
const updateQueryDataMock = vi.fn(
  (_endpoint: string, _args: unknown, recipe: (draft: any) => void) => {
    const draft: { results: any[] } = { results: [] };
    try {
      recipe(draft);
    } catch {
      // ignore — the test only needs the closure to run.
    }
    return { type: 'mock/updateQueryData' };
  },
);

let mockIsStreaming = false;
let mockNumberOfActiveChatMessages = 0;
let mockActiveChatMessages: Array<{ role?: string }> = [];

let mockRecentInfinite: any = {
  pages: [{ results: [] }],
  pageParams: [1],
};
let mockPinnedPages: any = { results: [] };
let mockHasNextPage = false;
let mockIsFetchingNextPage = false;

// ---------------------------------------------------------------------------
// Module mocks (registered before the hook import)
// ---------------------------------------------------------------------------

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
      updateQueryData: (
        endpoint: string,
        args: unknown,
        recipe: (draft: any) => void,
      ) => updateQueryDataMock(endpoint, args, recipe),
    },
  },
  useAddPinnedMessageMutation: () => [
    addPinnedMessageMock,
    { isLoading: false },
  ],
  useUnPinMessageMutation: () => [unpinMessageMock, { isLoading: false }],
  useDeleteMessageMutation: () => [deleteMessageMock, { isLoading: false }],
  useGetRecentMessagesInfiniteQuery: (
    _args: unknown,
    options?: { skip?: boolean },
  ) => ({
    data: options?.skip ? undefined : mockRecentInfinite,
    refetch: refetchRecentMock,
    fetchNextPage: fetchNextPageMock,
    hasNextPage: mockHasNextPage,
    isFetchingNextPage: mockIsFetchingNextPage,
  }),
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
  selectStreaming: () => mockIsStreaming,
  selectNumberOfActiveChatMessages: () => mockNumberOfActiveChatMessages,
  selectActiveChatMessages: () => mockActiveChatMessages,
}));

import { useRecentChats } from '../use-recent-chats';

const baseArgs = {
  tenantKey: 'tenant-a',
  mentorId: 'mentor-1' as string | undefined,
  resolvedUserId: 'admin-user' as string | null,
  appSessionId: 'sess-active',
  open: true,
  onAfterNav: undefined as undefined | (() => void),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsStreaming = false;
  mockNumberOfActiveChatMessages = 0;
  mockActiveChatMessages = [];
  mockRecentInfinite = { pages: [{ results: [] }], pageParams: [1] };
  mockPinnedPages = { results: [] };
  mockHasNextPage = false;
  mockIsFetchingNextPage = false;
});

describe('useRecentChats', () => {
  it('excludes rows already present in Pinned from Recent (dedup)', () => {
    mockPinnedPages = {
      results: [{ session_id: 'shared', mentor: { unique_id: 'mentor-1' } }],
    };
    mockRecentInfinite = {
      pages: [
        {
          results: [
            { session_id: 'shared', mentor: { unique_id: 'mentor-1' } },
            { session_id: 'recent-only', mentor: { unique_id: 'mentor-1' } },
          ],
        },
      ],
      pageParams: [1],
    };

    const { result } = renderHook(() => useRecentChats(baseArgs));

    expect(result.current.pinned.map((r) => r.session_id)).toEqual(['shared']);
    expect(result.current.recent.map((r) => r.session_id)).toEqual([
      'recent-only',
    ]);
  });

  it('filters out rows belonging to a different mentor (filterByMentor)', () => {
    mockRecentInfinite = {
      pages: [
        {
          results: [
            { session_id: 'same', mentor: { unique_id: 'mentor-1' } },
            { session_id: 'other', mentor: { unique_id: 'mentor-2' } },
            { session_id: 'no-mentor', mentor: null },
          ],
        },
      ],
      pageParams: [1],
    };

    const { result } = renderHook(() => useRecentChats(baseArgs));

    // Rows for a different mentor are dropped; rows without a mentor id pass.
    expect(result.current.recent.map((r) => r.session_id)).toEqual([
      'same',
      'no-mentor',
    ]);
  });

  it('flattens results across multiple infinite-query pages', () => {
    mockRecentInfinite = {
      pages: [
        { results: [{ session_id: 'p1', mentor: { unique_id: 'mentor-1' } }] },
        { results: [{ session_id: 'p2', mentor: { unique_id: 'mentor-1' } }] },
      ],
      pageParams: [1, 2],
    };

    const { result } = renderHook(() => useRecentChats(baseArgs));

    expect(result.current.recent.map((r) => r.session_id)).toEqual([
      'p1',
      'p2',
    ]);
  });

  it('handleDelete calls the delete mutation and refetches recent', async () => {
    const row = { session_id: 'to-delete', mentor: { unique_id: 'mentor-1' } };
    const { result } = renderHook(() => useRecentChats(baseArgs));

    await act(async () => {
      await result.current.handleDelete(row);
    });

    expect(deleteMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ org: 'tenant-a', sessionId: 'to-delete' }),
    );
    expect(refetchRecentMock).toHaveBeenCalled();
    // Deleting a non-active row must NOT emit the new-chat reset event.
    expect(eventBusEmitMock).not.toHaveBeenCalledWith('newChat');
  });

  it('handleDelete starts a new chat when the deleted row is the active session', async () => {
    const row = {
      session_id: 'sess-active',
      mentor: { unique_id: 'mentor-1' },
    };
    const { result } = renderHook(() => useRecentChats(baseArgs));

    await act(async () => {
      await result.current.handleDelete(row);
    });

    expect(eventBusEmitMock).toHaveBeenCalledWith('newChat');
  });

  it('handleDelete short-circuits without a tenant or user id', async () => {
    const { result } = renderHook(() =>
      useRecentChats({ ...baseArgs, resolvedUserId: null }),
    );

    await act(async () => {
      await result.current.handleDelete({ session_id: 'x' });
    });

    expect(deleteMessageMock).not.toHaveBeenCalled();
    expect(refetchRecentMock).not.toHaveBeenCalled();
  });

  it('handlePin pins a row, patches the pinned cache, and refetches both lists', async () => {
    const row = { session_id: 'pin-me', mentor: { unique_id: 'mentor-1' } };
    const { result } = renderHook(() => useRecentChats(baseArgs));

    await act(async () => {
      await result.current.handlePin(row);
    });

    expect(addPinnedMessageMock).toHaveBeenCalled();
    expect(updateQueryDataMock).toHaveBeenCalledWith(
      'getPinnedMessages',
      expect.any(Object),
      expect.any(Function),
    );
    expect(refetchRecentMock).toHaveBeenCalled();
    expect(refetchPinnedMock).toHaveBeenCalled();
  });

  it('handleUnpin unpins a row and refetches both lists', async () => {
    const row = { session_id: 'unpin-me', mentor: { unique_id: 'mentor-1' } };
    const { result } = renderHook(() => useRecentChats(baseArgs));

    await act(async () => {
      await result.current.handleUnpin(row);
    });

    expect(unpinMessageMock).toHaveBeenCalled();
    expect(refetchRecentMock).toHaveBeenCalled();
    expect(refetchPinnedMock).toHaveBeenCalled();
  });

  it('handleExport delegates the row messages to the xlsx helper', () => {
    const messages = [{ role: 'user' }];
    const { result } = renderHook(() => useRecentChats(baseArgs));

    act(() => {
      result.current.handleExport({ session_id: 's', messages });
    });

    expect(exportMessagesToXlsxMock).toHaveBeenCalledWith(messages);
  });

  it('handleSelectRow navigates and repoints chat state for a new session', () => {
    const onAfterNav = vi.fn();
    const row = { session_id: 'new-sess', mentor: { unique_id: 'mentor-1' } };
    const { result } = renderHook(() =>
      useRecentChats({ ...baseArgs, onAfterNav }),
    );

    act(() => {
      result.current.handleSelectRow(row);
    });

    expect(pushMock).toHaveBeenCalledWith(
      '/platform/tenant-a/mentor-1?session=new-sess',
    );
    // Different session than the active one => state is torn down / repointed.
    expect(dispatchMock).toHaveBeenCalled();
    expect(onAfterNav).toHaveBeenCalled();
  });

  it('refetches recent after the first assistant reply lands', () => {
    mockNumberOfActiveChatMessages = 2;
    mockActiveChatMessages = [{ role: 'user' }, { role: 'assistant' }];

    renderHook(() => useRecentChats(baseArgs));

    expect(refetchRecentMock).toHaveBeenCalled();
  });
});
