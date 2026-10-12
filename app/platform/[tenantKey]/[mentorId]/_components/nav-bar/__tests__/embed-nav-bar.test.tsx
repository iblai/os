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
let mockPrivacy = {
  featureEnabled: true,
  privacyModeDisabled: false,
  effective: { mode: 'enabled' },
  messageCount: 0,
};
let mockShowCloseButton = true;
let mockIsLtiLaunch = false;
let mockShowUserProfile = false;
let mockAllowFullscreen = false;
let mockUsername: string | null = 'testuser';
let mockIsLoggedIn = true;
let mockPathname = '/platform/tenant123/mentor123';
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

vi.mock('@/hooks/use-show-close-button', () => ({
  useShowCloseButton: () => mockShowCloseButton,
}));

vi.mock('@/hooks/use-is-lti-launch', () => ({
  useIsLtiLaunch: () => mockIsLtiLaunch,
}));

vi.mock('@/hooks/use-allow-fullscreen', () => ({
  useAllowFullscreen: () => mockAllowFullscreen,
}));

vi.mock('@/hooks/use-show-user-profile', () => ({
  useShowUserProfile: () => mockShowUserProfile,
}));

// Stub the full user-profile menu (the real one pulls in model-download/SDK).
vi.mock('../user-profile', () => ({
  UserProfile: () => <div data-testid="embed-user-profile">User Profile</div>,
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
    documentationUrl: () => 'https://docs.example.com',
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

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

const mockToggleClick = vi.fn();

// Stub the SDK Incognito pill (the real one fires chat-privacy API calls).
vi.mock('@iblai/iblai-js/web-containers', () => ({
  ChatPrivacyToggle: ({ org, userId, mentor, className }: any) => (
    <button
      data-testid="chat-privacy-toggle"
      data-org={org}
      data-user={userId}
      data-mentor={mentor}
      className={className}
      onClick={() => mockToggleClick()}
    >
      Incognito
    </button>
  ),
  useChatPrivacy: () => mockPrivacy,
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
  mentorId: 'mentor123',
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
    mockPrivacy = {
      featureEnabled: true,
      privacyModeDisabled: false,
      effective: { mode: 'enabled' },
      messageCount: 0,
    };
    mockToggleClick.mockReset();
    mockShowCloseButton = true;
    mockIsLtiLaunch = false;
    mockShowUserProfile = false;
    mockAllowFullscreen = false;
    mockUsername = 'testuser';
    mockIsLoggedIn = true;
    mockPathname = '/platform/tenant123/mentor123';
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

    it('does not render close chat button when the close affordance is disabled', () => {
      mockShowCloseButton = false;
      renderEmbedNavBar();
      expect(screen.queryByLabelText('Close chat')).not.toBeInTheDocument();
    });

    it('renders close chat button when the host opts in', () => {
      mockShowCloseButton = true;
      renderEmbedNavBar();
      expect(screen.getByLabelText('Close chat')).toBeInTheDocument();
    });

    // #2586: inside an LMS course (LTI) there is no launcher to reopen the chat.
    it('does not render close chat button in an LTI launch, even when the host opts in', () => {
      mockShowCloseButton = true;
      mockIsLtiLaunch = true;
      renderEmbedNavBar();
      expect(screen.queryByLabelText('Close chat')).not.toBeInTheDocument();
    });

    it('is borderless on the greeting screen', () => {
      renderEmbedNavBar();
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('h-14', 'border-transparent');
      expect(nav).toHaveAttribute('data-elevated', 'false');
    });

    it('gains a hairline and soft shadow once the conversation has messages', () => {
      mockPrivacy.messageCount = 1;
      renderEmbedNavBar();
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('border-[#f0f1f3]');
      expect(nav.className).toContain('shadow-');
      expect(nav).toHaveAttribute('data-elevated', 'true');
    });

    it('shows the agent name as plain text, not a button', () => {
      renderEmbedNavBar({ mentorName: 'Alabama State University' });
      const name = screen.getByText('Alabama State University');
      expect(name.closest('button')).toBeNull();
      expect(
        screen.queryByRole('button', { name: /Alabama State University/ }),
      ).not.toBeInTheDocument();
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
    it('starts a new chat from the header New chat button', () => {
      renderEmbedNavBar();

      fireEvent.click(screen.getByRole('button', { name: 'New chat' }));

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
  // User Profile (host opt-in via show-user-profile)
  // --------------------------------------------------------------------------

  describe('User Profile', () => {
    it('does not render the user profile by default', () => {
      mockShowUserProfile = false;
      renderEmbedNavBar();
      expect(screen.queryByTestId('embed-user-profile')).toBeNull();
    });

    it('renders the user profile when the host opts in', () => {
      mockShowUserProfile = true;
      renderEmbedNavBar();
      expect(screen.getByTestId('embed-user-profile')).toBeInTheDocument();
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

  describe('Full screen toggle', () => {
    let postMessageSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      postMessageSpy = vi.fn();
      Object.defineProperty(window, 'parent', {
        value: { postMessage: postMessageSpy },
        writable: true,
      });
    });

    it('is hidden when the host has not allowed full screen', () => {
      renderEmbedNavBar();
      expect(screen.queryByTestId('embed-fullscreen-toggle')).toBeNull();
    });

    it('is hidden when not iframed even if allowed', () => {
      mockAllowFullscreen = true;
      mockIsIframed = false;
      renderEmbedNavBar();
      expect(screen.queryByTestId('embed-fullscreen-toggle')).toBeNull();
    });

    it('shows a Full screen button when allowed', () => {
      mockAllowFullscreen = true;
      renderEmbedNavBar();
      expect(screen.getByTestId('embed-fullscreen-toggle')).toHaveAttribute(
        'aria-label',
        'Full screen',
      );
    });

    it('posts embedFullscreen to the parent and flips the icon each click', () => {
      mockAllowFullscreen = true;
      renderEmbedNavBar();
      const button = screen.getByTestId('embed-fullscreen-toggle');
      expect(button.querySelector('.lucide-maximize-2')).not.toBeNull();

      fireEvent.click(button);
      expect(postMessageSpy).toHaveBeenLastCalledWith(
        { embedFullscreen: true },
        '*',
      );
      expect(button).toHaveAttribute('aria-label', 'Exit full screen');
      expect(button.querySelector('.lucide-minimize-2')).not.toBeNull();

      fireEvent.click(button);
      expect(postMessageSpy).toHaveBeenLastCalledWith(
        { embedFullscreen: false },
        '*',
      );
      expect(button).toHaveAttribute('aria-label', 'Full screen');
      expect(button.querySelector('.lucide-maximize-2')).not.toBeNull();
    });

    it('goes back to Full screen after the chat is closed', () => {
      mockAllowFullscreen = true;
      renderEmbedNavBar();
      const button = screen.getByTestId('embed-fullscreen-toggle');
      fireEvent.click(button);
      fireEvent.click(screen.getByLabelText('Close chat'));
      expect(button).toHaveAttribute('aria-label', 'Full screen');
    });

    it('keeps the action buttons from being pushed out by a long agent name', () => {
      mockAllowFullscreen = true;
      renderEmbedNavBar();
      const actions = screen.getByTestId(
        'embed-fullscreen-toggle',
      ).parentElement;
      expect(actions).toHaveClass('shrink-0');
      expect(screen.getByLabelText('Close chat').parentElement).toBe(actions);
    });

    it('does nothing in preview mode', () => {
      mockAllowFullscreen = true;
      mockIsPreviewMode = true;
      renderEmbedNavBar();
      const button = screen.getByTestId('embed-fullscreen-toggle');
      fireEvent.click(button);
      expect(postMessageSpy).not.toHaveBeenCalled();
      expect(button).toHaveAttribute('aria-label', 'Full screen');
    });
  });

  // --------------------------------------------------------------------------
  // Default Chat Mode (dropdown with help items)
  // --------------------------------------------------------------------------

  describe('Default Chat Mode', () => {
    it('renders menu options button', () => {
      renderEmbedNavBar();
      expect(screen.getByLabelText('Open menu options')).toBeInTheDocument();
    });

    it('shows Help and Support in dropdown', async () => {
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open menu options'));

      expect(await screen.findByText('Help')).toBeInTheDocument();
      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    it('hides Help item when metadata.show_help is false', async () => {
      mockMetadata = { ...mockMetadata, show_help: false };
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open menu options'));

      expect(screen.queryByText('Help')).not.toBeInTheDocument();
      expect(await screen.findByText('Support')).toBeInTheDocument();
    });

    it('opens help URL when clicking Help', async () => {
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

  describe('Help menu in preview mode', () => {
    it('ignores help menu picks in preview mode', async () => {
      mockIsPreviewMode = true;
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const user = userEvent.setup();
      renderEmbedNavBar();

      await user.click(screen.getByLabelText('Open menu options'));
      await user.click(await screen.findByText('Support'));

      expect(openSpy).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Advanced Chat Mode (settings dropdown)
  // --------------------------------------------------------------------------

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

    it('does not post message in an LTI launch', () => {
      mockIsLtiLaunch = true;
      renderEmbedNavBar();
      pressEscape();
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('does not post message when the close affordance is disabled', () => {
      mockShowCloseButton = false;
      renderEmbedNavBar();
      pressEscape();
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('starts posting again once the close affordance is enabled', () => {
      mockShowCloseButton = false;
      const { rerender } = renderEmbedNavBar();
      pressEscape();
      expect(postMessageSpy).not.toHaveBeenCalled();

      mockShowCloseButton = true;
      rerender(
        <Provider store={createTestStore()}>
          <EmbedNavBar {...defaultProps} />
        </Provider>,
      );
      pressEscape();
      expect(postMessageSpy).toHaveBeenCalledWith(
        { closeEmbed: true, collapseSidebarCopilot: true },
        '*',
      );
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

  // --------------------------------------------------------------------------
  // Incognito toggle (parity with the main NavBar)
  // --------------------------------------------------------------------------

  describe('Incognito in the ? menu', () => {
    async function openMenu() {
      const user = userEvent.setup();
      await user.click(screen.getByLabelText('Open menu options'));
      return user;
    }

    it('is not in the bar itself', () => {
      renderEmbedNavBar();
      expect(
        screen.queryByTestId('chat-privacy-toggle'),
      ).not.toBeInTheDocument();
    });

    it('lists Incognito first, then Help and Support', async () => {
      renderEmbedNavBar();
      await openMenu();
      await screen.findByTestId('embed-incognito-item');
      const items = Array.from(
        document.querySelectorAll(
          '[role="menuitem"], [role="menuitemcheckbox"]',
        ),
      );
      expect(items.map((item) => item.textContent)).toEqual([
        expect.stringContaining('Incognito'),
        'Help',
        'Support',
      ]);
      const incognito = screen.getByTestId('embed-incognito-item');
      expect(incognito).toHaveAttribute('role', 'menuitemcheckbox');
      expect(incognito).toHaveAttribute('aria-checked', 'false');
    });

    it('passes org, userId and mentor through to the SDK toggle', async () => {
      mockUsername = 'jane';
      renderEmbedNavBar({ tenantKey: 'acme', mentorId: 'mentor-xyz' });
      await openMenu();
      const toggle = await screen.findByTestId('chat-privacy-toggle');
      expect(toggle).toHaveAttribute('data-org', 'acme');
      expect(toggle).toHaveAttribute('data-user', 'jane');
      expect(toggle).toHaveAttribute('data-mentor', 'mentor-xyz');
    });

    it('drives the SDK toggle from the row and keeps the menu open', async () => {
      renderEmbedNavBar();
      const user = await openMenu();
      await user.click(await screen.findByTestId('embed-incognito-item'));
      expect(mockToggleClick).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('embed-incognito-item')).toBeInTheDocument();
    });

    it('drives the toggle from the keyboard', async () => {
      renderEmbedNavBar();
      const user = await openMenu();
      await screen.findByTestId('embed-incognito-item');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      expect(mockToggleClick).toHaveBeenCalledTimes(1);
    });

    it('ignores the row in preview mode', async () => {
      mockIsPreviewMode = true;
      renderEmbedNavBar();
      const user = await openMenu();
      await user.click(await screen.findByTestId('embed-incognito-item'));
      expect(mockToggleClick).not.toHaveBeenCalled();
    });

    it('marks an Incognito chat in the header and the menu', async () => {
      mockPrivacy.effective = { mode: 'disabled' };
      renderEmbedNavBar();
      expect(screen.getByText('Incognito chat')).toBeInTheDocument();
      expect(screen.getByTestId('embed-incognito-badge')).toBeInTheDocument();
      await openMenu();
      expect(await screen.findByTestId('embed-incognito-item')).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('hides Incognito when the tenant or agent turns it off', async () => {
      mockPrivacy.privacyModeDisabled = true;
      renderEmbedNavBar();
      await openMenu();
      expect(await screen.findByText('Support')).toBeInTheDocument();
      expect(
        screen.queryByTestId('embed-incognito-item'),
      ).not.toBeInTheDocument();
    });

    it('keeps Incognito while a chat is still private, even when turned off', async () => {
      mockPrivacy.featureEnabled = false;
      mockPrivacy.effective = { mode: 'disabled' };
      renderEmbedNavBar();
      await openMenu();
      expect(
        await screen.findByTestId('embed-incognito-item'),
      ).toBeInTheDocument();
    });

    it('hides Incognito on non-chat routes (e.g. analytics)', async () => {
      mockPathname = '/platform/tenant123/mentor123/analytics';
      renderEmbedNavBar();
      await openMenu();
      expect(await screen.findByText('Support')).toBeInTheDocument();
      expect(
        screen.queryByTestId('embed-incognito-item'),
      ).not.toBeInTheDocument();
    });

    it('hides Incognito when the user is not logged in', async () => {
      mockIsLoggedIn = false;
      renderEmbedNavBar({ isAnonymousMentor: false });
      await openMenu();
      expect(await screen.findByText('Support')).toBeInTheDocument();
      expect(
        screen.queryByTestId('embed-incognito-item'),
      ).not.toBeInTheDocument();
    });

    it('hides Incognito when there is no tenant key', async () => {
      renderEmbedNavBar({ tenantKey: '' });
      await openMenu();
      expect(await screen.findByText('Support')).toBeInTheDocument();
      expect(
        screen.queryByTestId('embed-incognito-item'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Help Items', () => {
    it('uses config fallback when metadata URLs are missing', async () => {
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
