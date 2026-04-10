import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core');

// Mock isTauriApp
vi.mock('@/types/tauri');

describe('useOAuth', () => {
  let invoke: ReturnType<typeof vi.fn>;
  let isTauriApp: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Import mocked modules
    const tauriCore = await import('@tauri-apps/api/core');
    const tauriTypes = await import('@/types/tauri');

    invoke = vi.mocked(tauriCore.invoke);
    isTauriApp = vi.mocked(tauriTypes.isTauriApp);

    // Default to Tauri mode
    isTauriApp.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default state', async () => {
    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    expect(result.current.isAuthenticating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.authenticate).toBeInstanceOf(Function);
  });

  it('should throw error when not in Tauri app', async () => {
    isTauriApp.mockReturnValue(false);

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    await expect(
      result.current.authenticate('https://oauth.example.com'),
    ).rejects.toThrow('OAuth is only supported in Tauri mobile apps');
  });

  it('should start OAuth flow and poll for result', async () => {
    invoke
      .mockResolvedValueOnce(undefined) // oauth_start
      .mockResolvedValueOnce(null) // first poll - no result
      .mockResolvedValueOnce(null) // second poll - no result
      .mockResolvedValueOnce('https://callback.example.com?code=abc123'); // third poll - success

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    const authenticatePromise = result.current.authenticate(
      'https://oauth.example.com',
    );

    // Fast-forward through polling intervals
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500); // First poll
      await vi.advanceTimersByTimeAsync(500); // Second poll
      await vi.advanceTimersByTimeAsync(500); // Third poll
    });

    const oauthResult = await authenticatePromise;

    expect(invoke).toHaveBeenCalledWith('oauth_start', {
      url: 'https://oauth.example.com',
    });
    expect(invoke).toHaveBeenCalledWith('oauth_get_result');
    expect(oauthResult).toEqual({
      url: 'https://callback.example.com?code=abc123',
      code: 'abc123',
    });
  });

  it('should parse authorization code from callback URL', async () => {
    invoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('https://callback.example.com?code=test-code-123');

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    const authenticatePromise = result.current.authenticate(
      'https://oauth.example.com',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const oauthResult = await authenticatePromise;

    expect(oauthResult).toMatchObject({
      url: 'https://callback.example.com?code=test-code-123',
      code: 'test-code-123',
    });
  });

  it('should parse access token from hash fragment', async () => {
    invoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(
        'https://callback.example.com#access_token=test-token-456',
      );

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    const authenticatePromise = result.current.authenticate(
      'https://oauth.example.com',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const oauthResult = await authenticatePromise;

    expect(oauthResult).toMatchObject({
      url: 'https://callback.example.com#access_token=test-token-456',
      token: 'test-token-456',
    });
  });

  it('should parse token from query param', async () => {
    invoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(
        'https://callback.example.com?token=query-token-789',
      );

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    const authenticatePromise = result.current.authenticate(
      'https://oauth.example.com',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const oauthResult = await authenticatePromise;

    expect(oauthResult).toMatchObject({
      url: 'https://callback.example.com?token=query-token-789',
      token: 'query-token-789',
    });
  });

  it('should parse error from callback URL', async () => {
    invoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(
        'https://callback.example.com?error=access_denied',
      );

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    const authenticatePromise = result.current.authenticate(
      'https://oauth.example.com',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const oauthResult = await authenticatePromise;

    expect(oauthResult).toMatchObject({
      url: 'https://callback.example.com?error=access_denied',
      error: 'access_denied',
    });
  });

  it('should timeout after specified duration', async () => {
    invoke.mockResolvedValue(null);

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    const authenticatePromise = result.current.authenticate(
      'https://oauth.example.com',
      2000,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    const oauthResult = await authenticatePromise;

    expect(oauthResult).toBeNull();
    expect(result.current.error).toBe('Authentication timeout');
  });

  it('should set isAuthenticating during authentication', async () => {
    invoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('https://callback.example.com?code=abc');

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    expect(result.current.isAuthenticating).toBe(false);

    let authenticatePromise: Promise<any>;

    await act(async () => {
      authenticatePromise = result.current.authenticate(
        'https://oauth.example.com',
      );
    });

    // Should be authenticating now
    expect(result.current.isAuthenticating).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    await act(async () => {
      await authenticatePromise!;
    });

    expect(result.current.isAuthenticating).toBe(false);
  });

  it('should handle invoke errors', async () => {
    invoke.mockRejectedValueOnce(new Error('Failed to start OAuth'));

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    await act(async () => {
      try {
        await result.current.authenticate('https://oauth.example.com');
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.error).toBe('Failed to start OAuth');
    expect(result.current.isAuthenticating).toBe(false);
  });

  it('should handle non-Error exceptions', async () => {
    invoke.mockRejectedValueOnce('String error');

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    await act(async () => {
      try {
        await result.current.authenticate('https://oauth.example.com');
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.error).toBe('Unknown error');
    expect(result.current.isAuthenticating).toBe(false);
  });

  it('should use default timeout of 60 seconds', async () => {
    invoke.mockResolvedValue(null);

    // Clear module cache to get fresh import
    vi.resetModules();
    const tauriCore = await import('@tauri-apps/api/core');
    const tauriTypes = await import('@/types/tauri');
    invoke = vi.mocked(tauriCore.invoke);
    isTauriApp = vi.mocked(tauriTypes.isTauriApp);
    isTauriApp.mockReturnValue(true);
    invoke.mockResolvedValue(null);

    const { useOAuth } = await import('../use-oauth');
    const { result } = renderHook(() => useOAuth());

    let authenticatePromise: Promise<any>;

    await act(async () => {
      authenticatePromise = result.current.authenticate(
        'https://oauth.example.com',
      );
    });

    // Fast-forward just under 60 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59000);
    });

    // Should still be polling
    expect(invoke).toHaveBeenCalledWith('oauth_get_result');

    // Fast-forward past 60 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    const oauthResult = await act(async () => {
      return await authenticatePromise!;
    });

    expect(oauthResult).toBeNull();
  });
});
