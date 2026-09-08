import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock data-layer
const mockGetCredentials = vi.fn();
const mockAddTrainingDocument = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetCredentialsQuery: () => [mockGetCredentials],
  useAddTrainingDocumentMutation: () => [mockAddTrainingDocument],
}));

// Mock useUsername
const mockUseUsername = vi.fn();
vi.mock('../use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils',
  () => ({
    extractErrorMessage: vi.fn(
      (error: unknown, defaultMsg: string) =>
        (error as { message?: string })?.message || defaultMsg,
    ),
  }),
);

import useOneDrivePicker from '../use-one-drive-picker';
import { toast } from 'sonner';

type MutableWindow = Window &
  typeof globalThis & {
    OneDrive?: { open: ReturnType<typeof vi.fn> };
    opener?: unknown;
  };

const win = window as MutableWindow;

/**
 * Covers the parts of `use-one-drive-picker` that no other spec reaches: the
 * SDK <script> load/error callbacks, the `?oauth=` popup callback handler, the
 * `message` listener, and `getFullDomain`'s memoised branch.
 */
describe('useOneDrivePicker — SDK loading, OAuth callback and messages', () => {
  const originalSearch = window.location.search;
  let appendedScript: HTMLScriptElement | null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-1',
    });
    mockUseUsername.mockReturnValue('testuser');
    mockGetCredentials.mockReturnValue({
      unwrap: () => Promise.resolve([{ value: { appId: 'test-app-id' } }]),
    });
    mockAddTrainingDocument.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });

    appendedScript = null;
    delete win.OneDrive;
    delete win.opener;

    // Capture the SDK <script> the hook injects instead of letting jsdom try
    // to fetch it, so the onload/onerror callbacks can be driven by hand.
    vi.spyOn(document.body, 'appendChild').mockImplementation(((node: Node) => {
      if (node instanceof HTMLScriptElement) appendedScript = node;
      return node;
    }) as typeof document.body.appendChild);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', originalSearch || '/');
  });

  const setSearch = (search: string) =>
    window.history.replaceState({}, '', `/${search}`);

  it('injects the SDK script and flips isSDKLoaded when it loads', async () => {
    const { result } = renderHook(() => useOneDrivePicker());

    await waitFor(() => expect(appendedScript).not.toBeNull());
    expect(result.current.isSDKLoaded).toBe(false);

    act(() => {
      appendedScript?.onload?.(new Event('load'));
    });

    await waitFor(() => expect(result.current.isSDKLoaded).toBe(true));
  });

  it('toasts when the SDK script fails to load', async () => {
    renderHook(() => useOneDrivePicker());

    await waitFor(() => expect(appendedScript).not.toBeNull());

    act(() => {
      appendedScript?.onerror?.(new Event('error'));
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to load OneDrive SDK');
  });

  it('marks the SDK loaded without injecting a script when window.OneDrive already exists', async () => {
    win.OneDrive = { open: vi.fn() };

    const { result } = renderHook(() => useOneDrivePicker());

    await waitFor(() => expect(result.current.isSDKLoaded).toBe(true));
    expect(appendedScript).toBeNull();
  });

  describe('?oauth= callback handling', () => {
    it('posts the payload to the opener and closes the popup', async () => {
      const postMessage = vi.fn();
      win.opener = { postMessage };
      const close = vi.spyOn(window, 'close').mockImplementation(() => {});
      const payload = { origin: 'https://example.test', token: 'abc' };
      setSearch(`?oauth=${encodeURIComponent(JSON.stringify(payload))}`);

      renderHook(() => useOneDrivePicker());

      expect(postMessage).toHaveBeenCalledWith(
        { type: 'onedrive-oauth-callback', data: payload },
        'https://example.test',
      );
      expect(close).toHaveBeenCalled();
    });

    it('strips the oauth param from the URL when there is no opener', async () => {
      const replaceState = vi.spyOn(window.history, 'replaceState');
      setSearch(
        `?oauth=${encodeURIComponent(JSON.stringify({ origin: 'https://example.test' }))}`,
      );
      replaceState.mockClear();

      renderHook(() => useOneDrivePicker());

      expect(replaceState).toHaveBeenCalledWith(
        {},
        document.title,
        window.location.pathname,
      );
    });

    it('toasts when the oauth payload is not valid JSON', async () => {
      setSearch('?oauth=not-json');

      renderHook(() => useOneDrivePicker());

      expect(toast.error).toHaveBeenCalledWith(
        'Error processing OneDrive authentication',
      );
    });
  });

  describe('message listener', () => {
    const dispatch = (data: unknown) =>
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data }));
      });

    beforeEach(() => {
      renderHook(() => useOneDrivePicker());
    });

    it('ignores events with no data', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      dispatch(undefined);
      expect(log).not.toHaveBeenCalled();
    });

    it('ignores string messages that do not mention onedrive', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      dispatch('some unrelated message');
      expect(log).not.toHaveBeenCalled();
    });

    it('logs when an onedrive string message is not valid JSON', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      dispatch('onedrive {not json}');

      expect(log).toHaveBeenCalledWith(
        'Non-JSON string message:',
        'onedrive {not json}',
      );
      expect(error).toHaveBeenCalled();
    });

    it('parses an onedrive string message carrying the oauth callback', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      dispatch(
        JSON.stringify({ type: 'onedrive-oauth-callback', source: 'onedrive' }),
      );

      expect(log).toHaveBeenCalledWith(
        'Received OAuth callback message:',
        expect.objectContaining({ type: 'onedrive-oauth-callback' }),
      );
    });

    it('handles an object message carrying the oauth callback', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      dispatch({ type: 'onedrive-oauth-callback' });

      expect(log).toHaveBeenCalledWith(
        'Received OAuth callback message:',
        expect.objectContaining({ type: 'onedrive-oauth-callback' }),
      );
    });
  });

  it('reuses the memoised redirect domain across picker opens', async () => {
    const open = vi.fn();
    win.OneDrive = { open };

    const { result } = renderHook(() => useOneDrivePicker());
    await waitFor(() =>
      expect(result.current.onedriveAppId).toBe('test-app-id'),
    );
    await waitFor(() => expect(result.current.isSDKLoaded).toBe(true));

    act(() => result.current.pickOneDriveFile());
    act(() => result.current.pickOneDriveFile());

    expect(open).toHaveBeenCalledTimes(2);
    const [first] = open.mock.calls[0];
    const [second] = open.mock.calls[1];
    expect(first.advanced.redirectUri).toBe(second.advanced.redirectUri);
    expect(second.advanced.redirectUri).toBe(
      `${window.location.origin}/uploads`,
    );
  });
});
