import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  callback: vi.fn(),
  setOAuthComplete: vi.fn(),
  pending: null as null | { serverId: number },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams(
      'code=the-code&state=main:mcp_github:github_tools:alice:abc',
    ),
}));
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyConnectedServicesCallbackQuery: () => [mocks.callback],
}));
vi.mock('@/components/spinner', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));
vi.mock('@/lib/initial-loader', () => ({ hideInitialLoader: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: (key: string) =>
    key === 'oauth_pending_server'
      ? [mocks.pending, vi.fn()]
      : [null, mocks.setOAuthComplete],
}));

const { default: OAuthCallbackPage } = await import('../page');

const answer = (result: Promise<unknown>) =>
  mocks.callback.mockReturnValue({ unwrap: () => result });

describe('OAuth callback page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.callback.mockReset();
    mocks.setOAuthComplete.mockReset();
    mocks.pending = null;
    vi.spyOn(window, 'close').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sends the one-time code once, even when React runs its effects twice', async () => {
    answer(new Promise(() => {}));
    render(
      <StrictMode>
        <OAuthCallbackPage />
      </StrictMode>,
    );
    await act(async () => {});

    expect(mocks.callback).toHaveBeenCalledTimes(1);
    expect(mocks.callback).toHaveBeenCalledWith({
      code: 'the-code',
      state: 'main:mcp_github:github_tools:alice:abc',
      redirect_uri: `${window.location.origin}/google-oauth-callback/`,
    });
  });

  it('keeps the tab open with a plain reason when the sign-in fails, and logs the details', async () => {
    const refusal = { status: 404, data: { detail: 'Invalid state' } };
    answer(Promise.reject(refusal));
    render(<OAuthCallbackPage />);
    await act(async () => {});

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This sign-in link has expired or was already used. Close this tab and try again.',
    );
    expect(screen.getByText('You can close this tab.')).toBeInTheDocument();
    expect(screen.queryByTestId('spinner')).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'Failed to complete OAuth callback:',
      refusal,
    );

    await act(async () => vi.advanceTimersByTime(10_000));
    expect(window.close).not.toHaveBeenCalled();
  });

  it('closes itself a moment after a sign-in that worked', async () => {
    mocks.pending = { serverId: 42 };
    answer(
      Promise.resolve({
        id: 7,
        provider: 'mcp_github',
        service: 'github_tools',
      }),
    );
    render(<OAuthCallbackPage />);
    await act(async () => {});

    expect(mocks.setOAuthComplete).toHaveBeenCalledWith(
      expect.objectContaining({ connectedServiceId: 7, serverId: 42 }),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(window.close).toHaveBeenCalledTimes(1);
  });
});
