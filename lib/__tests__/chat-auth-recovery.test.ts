import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsAuthRecoveryInProgress = vi.fn();
const mockMarkAuthRecovery = vi.fn();
const mockIsInIframe = vi.fn();
const mockSendMessageToParentWebsite = vi.fn();

vi.mock('@/lib/auth-recovery-lock', () => ({
  isAuthRecoveryInProgress: () => mockIsAuthRecoveryInProgress(),
  markAuthRecovery: () => mockMarkAuthRecovery(),
}));

vi.mock('@/lib/utils', () => ({
  isInIframe: () => mockIsInIframe(),
  sendMessageToParentWebsite: (p: unknown) => mockSendMessageToParentWebsite(p),
}));

vi.mock('@/lib/token-refresh', () => ({
  tokenRefreshUrl: () => 'https://auth.ibl.ai/login/complete?tenant=acme',
}));

import { recoverFromChatAuthFailure } from '../chat-auth-recovery';

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAuthRecoveryInProgress.mockReturnValue(false);
  mockIsInIframe.mockReturnValue(false);
  Object.defineProperty(window, 'location', {
    value: { href: 'https://os.ibl.ai/platform/acme/bot' },
    writable: true,
  });
});

describe('recoverFromChatAuthFailure', () => {
  // It used to mint a replacement token from the edX session; now it asks the
  // auth app. Crucially this is a refresh — /login/complete keeps the session
  // and returns the user here, so nobody is signed out for an expired token.
  it('sends the user to the auth app to re-mint, without logging them out', () => {
    recoverFromChatAuthFailure();

    expect(window.location.href).toBe(
      'https://auth.ibl.ai/login/complete?tenant=acme',
    );
  });

  it('takes the shared lock so the API 401s do not redirect again', () => {
    recoverFromChatAuthFailure();
    expect(mockMarkAuthRecovery).toHaveBeenCalledTimes(1);
  });

  it('stands down when a recovery is already running', () => {
    mockIsAuthRecoveryInProgress.mockReturnValue(true);

    recoverFromChatAuthFailure();

    expect(mockMarkAuthRecovery).not.toHaveBeenCalled();
    expect(window.location.href).toBe('https://os.ibl.ai/platform/acme/bot');
  });

  // Navigating an embed would tear the chat out of the host page.
  it('asks the host instead when embedded', () => {
    mockIsInIframe.mockReturnValue(true);

    recoverFromChatAuthFailure();

    expect(mockSendMessageToParentWebsite).toHaveBeenCalledWith({
      authExpired: true,
    });
    expect(window.location.href).toBe('https://os.ibl.ai/platform/acme/bot');
  });

  it('returns nothing, so the rejected message is not resent', () => {
    expect(recoverFromChatAuthFailure()).toBeUndefined();
  });
});
