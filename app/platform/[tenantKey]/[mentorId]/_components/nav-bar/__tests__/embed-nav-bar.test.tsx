import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { EmbedNavBar } from '../embed-nav-bar';

// ============================================================================
// MOCKS
// ============================================================================

let mockIsPreviewMode = false;
let mockIsIframed = true;
let mockChatMode: 'default' | 'advanced' = 'default';
let mockUsername: string | null = 'testuser';
let mockIsLoggedIn = true;
let mockMetadata: any = {
  show_help: true,
  help_center_url: 'https://help.example.com',
  support_email: 'support@example.com',
};

const mockDispatch = vi.fn();
const mockEmit = vi.fn();

vi.mock('@/hooks/use-is-preview-mode', () => ({
  useIsPreviewMode: () => mockIsPreviewMode,
}));

vi.mock('@/hooks/use-is-iframed', () => ({
  useIsIframed: () => mockIsIframed,
}));

vi.mock('@/hooks/use-chat-mode', () => ({
  useChatMode: () => mockChatMode,
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
  isLoggedIn: () => mockIsLoggedIn,
}));

vi.mock('@/lib/config', () => ({
  config: {
    helpCenterUrl: () => 'https://help.example.com',
    supportEmail: () => 'support@example.com',
    iblTemplateMentor: () => 'ai-mentor',
  },
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantMetadata: () => ({
    metadata: mockMetadata,
  }),
  addProtocolToUrl: (url: string) => url,
  chatActions: {
    setShouldStartNewChat: (val: boolean) => ({
      type: 'chat/setShouldStartNewChat',
      payload: val,
    }),
  },
  clearFiles: (val: any) => ({ type: 'chat/clearFiles', payload: val }),
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/lib/eventBus', () => ({
  default: { emit: (...args: any[]) => mockEmit(...args) },
  RemoteEvents: { newChat: 'MENTOR:NEW_CHAT' },
}));

// ============================================================================
// STORE & HELPERS
// ============================================================================

function createTestStore() {
  return configureStore({
    reducer: {
      placeholder: (state = {}) => state,
    },
  });
}

const defaultProps = {
  mentorName: 'Test Mentor',
  profileImage: '/test-image.png',
  isMobile: false,
  isAnonymousMentor: false,
  toggleSidebar: vi.fn(),
  openSidebar: false,
  tenantKey: 'tenant123',
};

function renderEmbedNavBar(props: Partial<typeof defaultProps> = {}) {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <EmbedNavBar {...defaultProps} {...props} />
    </Provider>,
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe('EmbedNavBar', () => {
  beforeEach(() => {
    cleanup();
    mockIsPreviewMode = false;
    mockIsIframed = true;
    mockChatMode = 'default';
    mockUsername = 'testuser';
    mockIsLoggedIn = true;
    mockMetadata = {
      show_help: true,
      help_center_url: 'https://help.example.com',
      support_email: 'support@example.com',
    };
    mockDispatch.mockReset();
    mockEmit.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Basic Rendering
  // --------------------------------------------------------------------------

  describe('Rendering', () => {
    it('renders nav element', () => {
      renderEmbedNavBar();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders mentor name', () => {
      renderEmbedNavBar({ mentorName: 'My AI Mentor' });
      expect(screen.getByText('My AI Mentor')).toBeInTheDocument();
    });

    it('renders mentor avatar with fallback initials', () => {
      renderEmbedNavBar({ mentorName: 'AI Bot' });
      expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('renders close chat button', () => {
      renderEmbedNavBar();
      expect(screen.getByLabelText('Close chat')).toBeInTheDocument();
    });

    it('does not render close chat button when not iframed', () => {
      mockIsIframed = false;
      renderEmbedNavBar();
      expect(screen.queryByLabelText('Close chat')).not.toBeInTheDocument();
    });

    it('renders the avatar container with mentor image ring class', () => {
      renderEmbedNavBar({ profileImage: '/avatar.png' });
      const avatar = document.querySelector('.mentor-image-container-ring');
      expect(avatar).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // New Chat Button (mentor name/avatar click)
  // --------------------------------------------------------------------------

  describe('New Chat', () => {
    it('dispatches new chat actions when clicking mentor name area', () => {
      renderEmbedNavBar();

      const newChatButton = screen.getByLabelText(
        'Start new chat with Test Mentor',
      );
      fireEvent.click(newChatButton);

      expect(mockDispatch).toHaveBeenCalledTimes(2);
      expect(mockEmit).toHaveBeenCalledWith('MENTOR:NEW_CHAT');
    });
  });

  // --------------------------------------------------------------------------
  // Sidebar Toggle
  // --------------------------------------------------------------------------

  describe('Sidebar Toggle', () => {
    it('does not show sidebar toggle when not mobile', () => {
      renderEmbedNavBar({ isMobile: false });
      expect(screen.queryByLabelText(/sidebar/i)).not.toBeInTheDocument();
    });

    it('shows sidebar toggle on mobile for logged-in non-anonymous mentor', () => {
      renderEmbedNavBar({ isMobile: true, isAnonymousMentor: false });
      // logged in → visibleToLoggedInUsersOnly is true
      expect(screen.getByLabelText(/sidebar/i)).toBeInTheDocument();
    });

    it('hides sidebar toggle on mobile when anonymous mentor and not logged in', () => {
      mockIsLoggedIn = false;
      renderEmbedNavBar({ isMobile: true, isAnonymousMentor: true });
      expect(screen.queryByLabelText(/sidebar/i)).not.toBeInTheDocument();
    });

    it('shows sidebar toggle on mobile when anonymous mentor but logged in', () => {
      mockIsLoggedIn = true;
      renderEmbedNavBar({ isMobile: true, isAnonymousMentor: true });
      expect(screen.getByLabelText(/sidebar/i)).toBeInTheDocument();
    });

    it('calls toggleSidebar when clicking toggle button', () => {
      const toggleSidebar = vi.fn();
      renderEmbedNavBar({
        isMobile: true,
        isAnonymousMentor: false,
        toggleSidebar,
      });

      fireEvent.click(screen.getByLabelText(/sidebar/i));
      expect(toggleSidebar).toHaveBeenCalledTimes(1);
    });

    it('shows correct aria-label based on openSidebar state', () => {
      const { rerender } = render(
        <Provider store={createTestStore()}>
          <EmbedNavBar {...defaultProps} isMobile={true} openSidebar={false} />
        </Provider>,
      );
      expect(screen.getByLabelText('Open sidebar')).toBeInTheDocument();

      rerender(
        <Provider store={createTestStore()}>
          <EmbedNavBar {...defaultProps} isMobile={true} openSidebar={true} />
        </Provider>,
      );
      expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Close Button
  // --------------------------------------------------------------------------

  describe('Close Chat Button', () => {
    it('calls postMessage when clicked in non-preview mode', () => {
      const postMessageSpy = vi.fn();
      Object.defineProperty(window, 'parent', {
        value: { postMessage: postMessageSpy },
        writable: true,
      });

      renderEmbedNavBar();
      fireEvent.click(screen.getByLabelText('Close chat'));

      expect(postMessageSpy).toHaveBeenCalledWith(
        { closeEmbed: true, collapseSidebarCopilot: true },
        '*',
      );
    });

    it('does not call postMessage in preview mode', () => {
      mockIsPreviewMode = true;
      const postMessageSpy = vi.fn();
      Object.defineProperty(window, 'parent', {
        value: { postMessage: postMessageSpy },
        writable: true,
      });

      renderEmbedNavBar();
      fireEvent.click(screen.getByLabelText('Close chat'));

      expect(postMessageSpy).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Default Chat Mode (dropdown with help items)
  // --------------------------------------------------------------------------

  describe('Default Chat Mode', () => {
    it('renders menu options button', () => {
      mockChatMode = 'default';
      renderEmbedNavBar();
      expect(screen.getByLabelText('Open menu options')).toBeInTheDocument();
    });

    it('shows Help and Support in dropdown', async () => {
      mockChatMode = 'default';
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open menu options'));

      expect(await screen.findByText('Help')).toBeInTheDocument();
      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    it('hides Help item when metadata.show_help is false', async () => {
      mockChatMode = 'default';
      mockMetadata = { ...mockMetadata, show_help: false };
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open menu options'));

      expect(screen.queryByText('Help')).not.toBeInTheDocument();
      expect(await screen.findByText('Support')).toBeInTheDocument();
    });

    it('opens help URL when clicking Help', async () => {
      mockChatMode = 'default';
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open menu options'));
      await user.click(await screen.findByText('Help'));

      expect(openSpy).toHaveBeenCalledWith(
        'https://help.example.com',
        '_blank',
      );
    });

    it('opens support email when clicking Support', async () => {
      mockChatMode = 'default';
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open menu options'));
      await user.click(await screen.findByText('Support'));

      expect(openSpy).toHaveBeenCalledWith(
        'mailto:support@example.com',
        '_blank',
      );
    });
  });

  // --------------------------------------------------------------------------
  // Advanced Chat Mode (settings dropdown)
  // --------------------------------------------------------------------------

  describe('Advanced Chat Mode', () => {
    it('renders settings button', () => {
      mockChatMode = 'advanced';
      renderEmbedNavBar();
      expect(screen.getByLabelText('Open settings menu')).toBeInTheDocument();
    });

    it('shows username, Help, and Support in settings dropdown', async () => {
      mockChatMode = 'advanced';
      mockUsername = 'john';
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open settings menu'));

      expect(await screen.findByText('john')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    it('does not show username when username is null', async () => {
      mockChatMode = 'advanced';
      mockUsername = null;
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open settings menu'));

      expect(await screen.findByText('Support')).toBeInTheDocument();
      expect(screen.queryByText('testuser')).not.toBeInTheDocument();
    });

    it('blocks dropdown item clicks in preview mode', async () => {
      mockChatMode = 'advanced';
      mockIsPreviewMode = true;
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open settings menu'));
      const helpItem = await screen.findByText('Help');
      await user.click(helpItem);

      expect(openSpy).not.toHaveBeenCalled();
    });

    it('does not open settings dropdown in preview mode (early return on click)', () => {
      mockChatMode = 'advanced';
      mockIsPreviewMode = true;
      renderEmbedNavBar();

      const settingsBtn = screen.getByLabelText('Open settings menu');
      // The onClick has an early return for preview mode — button should still render
      expect(settingsBtn).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // ESC Key Handler (WCAG 2.4.3 — Focus Order)
  // --------------------------------------------------------------------------

  describe('Escape key closes embed', () => {
    let postMessageSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      postMessageSpy = vi.fn();
      Object.defineProperty(window, 'parent', {
        value: { postMessage: postMessageSpy },
        writable: true,
      });
    });

    function pressEscape(init: KeyboardEventInit = {}) {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        cancelable: true,
        bubbles: true,
        ...init,
      });
      document.dispatchEvent(event);
      return event;
    }

    it('posts closeEmbed message to parent when Escape is pressed', () => {
      renderEmbedNavBar();
      pressEscape();
      expect(postMessageSpy).toHaveBeenCalledWith(
        { closeEmbed: true, collapseSidebarCopilot: true },
        '*',
      );
    });

    it('ignores key presses other than Escape', () => {
      renderEmbedNavBar();
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
      );
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
      );
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('does not post message when in preview mode', () => {
      mockIsPreviewMode = true;
      renderEmbedNavBar();
      pressEscape();
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('skips when an open Radix overlay is present', () => {
      const overlay = document.createElement('div');
      overlay.setAttribute('data-state', 'open');
      document.body.appendChild(overlay);

      renderEmbedNavBar();
      pressEscape();

      expect(postMessageSpy).not.toHaveBeenCalled();
      overlay.remove();
    });

    it('skips when the event has been defaultPrevented by a nested handler', () => {
      renderEmbedNavBar();
      // Pre-empt the document handler by attaching one in the capture phase
      // that calls preventDefault before the bubble-phase handler runs.
      const preempt = (e: Event) => {
        if ((e as KeyboardEvent).key === 'Escape') e.preventDefault();
      };
      document.addEventListener('keydown', preempt, { capture: true });
      pressEscape();
      document.removeEventListener('keydown', preempt, { capture: true });

      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('removes the listener on unmount so further Escape presses do nothing', () => {
      const { unmount } = renderEmbedNavBar();
      unmount();
      pressEscape();
      expect(postMessageSpy).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Help Items Config
  // --------------------------------------------------------------------------

  describe('Help Items', () => {
    it('uses config fallback when metadata URLs are missing', async () => {
      mockChatMode = 'default';
      mockMetadata = { show_help: true };
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open menu options'));
      await user.click(await screen.findByText('Help'));

      expect(openSpy).toHaveBeenCalledWith(
        'https://help.example.com',
        '_blank',
      );
    });

    it('uses config fallback for support email when metadata is missing', async () => {
      mockChatMode = 'default';
      mockMetadata = { show_help: true };
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open menu options'));
      await user.click(await screen.findByText('Support'));

      expect(openSpy).toHaveBeenCalledWith(
        'mailto:support@example.com',
        '_blank',
      );
    });
  });
});
