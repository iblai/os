import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';

import { ChatPrivacyToggle } from '../chat-privacy-menu';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();
const mockUseChatPrivacy = vi.fn();
const mockSelectSessionId = vi.fn();
const mockSelectMessageCount = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockStartPrivateChat = vi.fn();
const mockDisableChatHistory = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('react-redux', () => ({
  useSelector: (selector: unknown) =>
    typeof selector === 'function'
      ? (selector as (...args: unknown[]) => unknown)(undefined)
      : undefined,
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  selectSessionId: () => mockSelectSessionId(),
  selectNumberOfActiveChatMessages: () => mockSelectMessageCount(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/hooks/use-chat-privacy', () => ({
  useChatPrivacy: (...args: unknown[]) => mockUseChatPrivacy(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

// AlertDialog portals — keep it visible-on-mount so the confirm copy and
// the destructive action button are readable from jsdom.
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div role="dialog">{children}</div> : null),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
}));

function setHook({
  featureEnabled = true,
  effective = { mode: 'normal', source: 'default', is_locked: false },
  isStartingPrivateChat = false,
  isDisablingChatHistory = false,
}: Partial<{
  featureEnabled: boolean;
  effective: { mode: string; source: string; is_locked: boolean };
  isStartingPrivateChat: boolean;
  isDisablingChatHistory: boolean;
}> = {}) {
  mockUseChatPrivacy.mockReturnValue({
    featureEnabled,
    effective,
    startPrivateChat: mockStartPrivateChat,
    disableChatHistory: mockDisableChatHistory,
    isStartingPrivateChat,
    isDisablingChatHistory,
    isLoading: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseParams.mockReturnValue({
    tenantKey: 'acme',
    mentorId: 'mentor-1',
  });
  mockUseUsername.mockReturnValue('alice');
  mockSelectSessionId.mockReturnValue('session-1');
  mockSelectMessageCount.mockReturnValue(0);
  setHook();
});

afterEach(() => {
  cleanup();
});

// ============================================================================
// TESTS
// ============================================================================

describe('ChatPrivacyToggle', () => {
  describe('Gating', () => {
    it('renders nothing when the tenant gate is off', () => {
      setHook({ featureEnabled: false });
      const { container } = render(<ChatPrivacyToggle />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: undefined, mentorId: 'm' });
      const { container } = render(<ChatPrivacyToggle />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when username is missing', () => {
      mockUseUsername.mockReturnValue(undefined);
      const { container } = render(<ChatPrivacyToggle />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('State 1 — Empty conversation, normal mode (inactive icon)', () => {
    it('renders the icon as not-pressed', () => {
      render(<ChatPrivacyToggle />);
      const trigger = screen.getByRole('button', {
        name: /Start a temporary chat/i,
      });
      expect(trigger).toHaveAttribute('aria-pressed', 'false');
    });

    it('click starts a private chat without showing a confirm dialog', async () => {
      mockStartPrivateChat.mockResolvedValueOnce('new-session');
      render(<ChatPrivacyToggle />);

      fireEvent.click(
        screen.getByRole('button', { name: /Start a temporary chat/i }),
      );

      await waitFor(() => {
        expect(mockStartPrivateChat).toHaveBeenCalledTimes(1);
        expect(mockDisableChatHistory).not.toHaveBeenCalled();
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringMatching(/temporary chat/i),
        );
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows an error toast when startPrivateChat returns null', async () => {
      mockStartPrivateChat.mockResolvedValueOnce(null);
      render(<ChatPrivacyToggle />);
      fireEvent.click(
        screen.getByRole('button', { name: /Start a temporary chat/i }),
      );

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });
  });

  describe('State 2 — Empty conversation, private mode (active icon, free toggle off)', () => {
    beforeEach(() => {
      mockSelectMessageCount.mockReturnValue(0);
      setHook({
        effective: { mode: 'disabled', source: 'session', is_locked: false },
      });
    });

    it('renders the icon as pressed (active)', () => {
      render(<ChatPrivacyToggle />);
      const trigger = screen.getByRole('button', {
        name: /Temporary chat is on/i,
      });
      expect(trigger).toHaveAttribute('aria-pressed', 'true');
    });

    it('click reverts the private session via disableChatHistory(false)', async () => {
      mockDisableChatHistory.mockResolvedValueOnce(true);
      render(<ChatPrivacyToggle />);

      fireEvent.click(
        screen.getByRole('button', { name: /Temporary chat is on/i }),
      );

      await waitFor(() => {
        expect(mockDisableChatHistory).toHaveBeenCalledWith(false);
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringMatching(/turned off/i),
        );
      });
    });
  });

  describe('State 3 — Private session with messages (label mode)', () => {
    it('renders a static label and not a button', () => {
      mockSelectMessageCount.mockReturnValue(2);
      setHook({
        effective: { mode: 'disabled', source: 'session', is_locked: false },
      });
      render(<ChatPrivacyToggle />);

      expect(screen.getByText(/Temporary chat/i)).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Mentor-level lock (disabled by the mentor settings)', () => {
    it('renders the same static label and no button, even on an empty session', () => {
      mockSelectMessageCount.mockReturnValue(0);
      setHook({
        effective: { mode: 'disabled', source: 'mentor', is_locked: true },
      });
      render(<ChatPrivacyToggle />);

      expect(screen.getByText(/Temporary chat/i)).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('still renders the label after messages exist', () => {
      mockSelectMessageCount.mockReturnValue(4);
      setHook({
        effective: { mode: 'disabled', source: 'mentor', is_locked: true },
      });
      render(<ChatPrivacyToggle />);

      expect(screen.getByText(/Temporary chat/i)).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('State 4 — Normal session with messages (mid-conversation disable)', () => {
    beforeEach(() => {
      mockSelectMessageCount.mockReturnValue(3);
    });

    it('click opens the confirm dialog instead of mutating immediately', async () => {
      render(<ChatPrivacyToggle />);

      fireEvent.click(
        screen.getByRole('button', {
          name: /Disable chat history for this conversation/i,
        }),
      );

      expect(
        await screen.findByRole('heading', { name: /Disable chat history\?/i }),
      ).toBeInTheDocument();
      expect(mockStartPrivateChat).not.toHaveBeenCalled();
      expect(mockDisableChatHistory).not.toHaveBeenCalled();
    });

    it('confirm posts disable_chathistory=true and leaves the toggle clickable for revert', async () => {
      mockDisableChatHistory.mockResolvedValueOnce(true);
      render(<ChatPrivacyToggle />);

      fireEvent.click(
        screen.getByRole('button', {
          name: /Disable chat history for this conversation/i,
        }),
      );

      const dialog = await screen.findByRole('dialog');
      const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(
        (b) => /^Disable chat history$/i.test(b.textContent ?? ''),
      );
      expect(confirmBtn).toBeTruthy();
      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(mockDisableChatHistory).toHaveBeenCalledWith(true);
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringMatching(/removed from your history/i),
        );
      });
    });

    it('after a mid-conversation disable, pressing the active icon attempts to re-enable', async () => {
      mockDisableChatHistory.mockResolvedValueOnce(true);
      const { rerender } = render(<ChatPrivacyToggle />);

      // Confirm the mid-session disable.
      fireEvent.click(
        screen.getByRole('button', {
          name: /Disable chat history for this conversation/i,
        }),
      );
      const dialog = await screen.findByRole('dialog');
      const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(
        (b) => /^Disable chat history$/i.test(b.textContent ?? ''),
      )!;
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDisableChatHistory).toHaveBeenCalledWith(true);
      });

      // Flip the hook state to mirror what the backend would now report.
      setHook({
        effective: { mode: 'disabled', source: 'session', is_locked: false },
      });
      mockDisableChatHistory.mockResolvedValueOnce(true);
      rerender(<ChatPrivacyToggle />);

      // Active icon should still be a clickable button (not a static label)
      // because the disable happened mid-conversation.
      const reEnable = screen.getByRole('button', {
        name: /Temporary chat is on/i,
      });
      fireEvent.click(reEnable);

      await waitFor(() => {
        // Second call passes false — the re-enable attempt.
        expect(mockDisableChatHistory).toHaveBeenNthCalledWith(2, false);
      });
    });
  });
});
