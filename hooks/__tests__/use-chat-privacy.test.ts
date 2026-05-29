import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useChatPrivacy } from '../use-chat-privacy';

// ============================================================================
// MOCKS
// ============================================================================

const mockDispatch = vi.fn();
const mockUseDmToken = vi.fn();
const mockTenantConfigQuery = vi.fn();
const mockEffectiveQuery = vi.fn();
const mockUpdateSessionIds = vi.fn((id: string) => ({
  type: 'chat/updateSessionIds',
  payload: id,
}));
const mockInvalidateTags = vi.fn((tags: string[]) => ({
  type: 'rtk/invalidateTags',
  payload: tags,
}));

vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetTenantChatPrivacyConfigQuery: (...args: unknown[]) =>
    mockTenantConfigQuery(...args),
  useGetChatPrivacyEffectiveQuery: (...args: unknown[]) =>
    mockEffectiveQuery(...args),
  chatPrivacyApiSlice: {
    util: {
      invalidateTags: (...args: unknown[]) =>
        // @ts-expect-error spread typing
        mockInvalidateTags(...args),
    },
  },
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  chatActions: {
    updateSessionIds: (id: string) => mockUpdateSessionIds(id),
  },
}));

vi.mock('@/hooks/use-tokens', () => ({
  useDmToken: () => mockUseDmToken(),
}));

vi.mock('@/lib/config', () => ({
  config: {
    dmUrl: () => 'https://dm.test',
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const ARGS = {
  org: 'acme',
  userId: 'alice',
  mentor: 'mentor-1',
  session: 'session-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseDmToken.mockReturnValue('TOKEN');
  mockTenantConfigQuery.mockReturnValue({
    data: { allow_user_chat_privacy_control: true },
    isLoading: false,
  });
  mockEffectiveQuery.mockReturnValue({
    data: { mode: 'normal', source: 'default', is_locked: false },
    isLoading: false,
  });
});

afterEach(() => {
  // @ts-expect-error reset fetch
  global.fetch = undefined;
});

// ============================================================================
// TESTS
// ============================================================================

describe('useChatPrivacy', () => {
  describe('tenant gate', () => {
    it('reports featureEnabled=true when allow_user_chat_privacy_control is true', () => {
      const { result } = renderHook(() => useChatPrivacy(ARGS));
      expect(result.current.featureEnabled).toBe(true);
    });

    it('reports featureEnabled=false when the tenant gate is off', () => {
      mockTenantConfigQuery.mockReturnValue({
        data: { allow_user_chat_privacy_control: false },
        isLoading: false,
      });
      const { result } = renderHook(() => useChatPrivacy(ARGS));
      expect(result.current.featureEnabled).toBe(false);
    });

    it('skips the effective-mode query when the tenant gate is off', () => {
      mockTenantConfigQuery.mockReturnValue({
        data: { allow_user_chat_privacy_control: false },
        isLoading: false,
      });
      renderHook(() => useChatPrivacy(ARGS));
      // skipToken should have been passed — the call args won't be `{ org, userId, ... }`
      const callArg = mockEffectiveQuery.mock.calls.at(-1)?.[0];
      expect(callArg).not.toEqual(
        expect.objectContaining({ org: 'acme', userId: 'alice' }),
      );
    });
  });

  describe('effective fallback', () => {
    it('returns the SDK-resolved effective payload when present', () => {
      mockEffectiveQuery.mockReturnValue({
        data: { mode: 'disabled', source: 'session', is_locked: false },
        isLoading: false,
      });
      const { result } = renderHook(() => useChatPrivacy(ARGS));
      expect(result.current.effective).toEqual({
        mode: 'disabled',
        source: 'session',
        is_locked: false,
      });
    });

    it('falls back to a normal/default/unlocked shape when the query has no data', () => {
      mockEffectiveQuery.mockReturnValue({ data: undefined, isLoading: false });
      const { result } = renderHook(() => useChatPrivacy(ARGS));
      expect(result.current.effective).toEqual({
        mode: 'normal',
        source: 'default',
        is_locked: false,
      });
    });
  });

  describe('startPrivateChat', () => {
    it('POSTs to /sessions/ with disable_chathistory=true and dispatches the new session id', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ session_id: 'new-session-xyz' }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() => useChatPrivacy(ARGS));

      let returned: string | null = null;
      await act(async () => {
        returned = await result.current.startPrivateChat();
      });

      expect(returned).toBe('new-session-xyz');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://dm.test/api/ai-mentor/orgs/acme/sessions/');
      expect(init).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Token TOKEN' }),
      });
      expect(JSON.parse(init.body as string)).toEqual({
        mentor: 'mentor-1',
        disable_chathistory: true,
      });
      expect(mockUpdateSessionIds).toHaveBeenCalledWith('new-session-xyz');
      expect(mockInvalidateTags).toHaveBeenCalledWith(['ChatPrivacyEffective']);
    });

    it('returns null and does not dispatch when the response is not ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() => useChatPrivacy(ARGS));

      let returned: string | null = 'sentinel';
      await act(async () => {
        returned = await result.current.startPrivateChat();
      });

      expect(returned).toBeNull();
      expect(mockUpdateSessionIds).not.toHaveBeenCalled();
    });

    it('refuses to call fetch when required identity is missing', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() =>
        useChatPrivacy({ ...ARGS, org: undefined }),
      );
      let returned: string | null = 'sentinel';
      await act(async () => {
        returned = await result.current.startPrivateChat();
      });

      expect(returned).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('disableChatHistory', () => {
    it('POSTs to the session disable-chathistory route and invalidates the effective tag', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'session-1',
          disable_chathistory: true,
        }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() => useChatPrivacy(ARGS));

      let ok = false;
      await act(async () => {
        ok = await result.current.disableChatHistory();
      });

      expect(ok).toBe(true);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://dm.test/api/ai-mentor/orgs/acme/users/alice/sessions/session-1/disable-chathistory/',
      );
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        disable_chathistory: true,
      });
      expect(mockInvalidateTags).toHaveBeenCalledWith(['ChatPrivacyEffective']);
    });

    it('passes the `disabled` argument through to the request body', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() => useChatPrivacy(ARGS));

      await act(async () => {
        await result.current.disableChatHistory(false);
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body as string)).toEqual({
        disable_chathistory: false,
      });
    });

    it('returns false when the backend rejects (e.g. 400 one-way violation)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({}),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() => useChatPrivacy(ARGS));

      let ok = true;
      await act(async () => {
        ok = await result.current.disableChatHistory();
      });

      expect(ok).toBe(false);
      expect(mockInvalidateTags).not.toHaveBeenCalled();
    });

    it('refuses to call fetch when there is no active session', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const { result } = renderHook(() =>
        useChatPrivacy({ ...ARGS, session: undefined }),
      );
      let ok = true;
      await act(async () => {
        ok = await result.current.disableChatHistory();
      });

      expect(ok).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
