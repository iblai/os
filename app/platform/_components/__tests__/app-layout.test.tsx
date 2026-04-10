import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import AppLayout from '../app-layout';

// ---- Test-controlled mock state ----
let mockMentorSettingsLoading: boolean;
let mockSearchParams: URLSearchParams;
let mockIsTauriApp: boolean;
let mockIsTauriOfflineMode: boolean;
let mockIsOfflineServerOrigin: boolean;

// Mock next/navigation hooks
vi.mock('next/navigation', () => ({
  useParams: () => ({
    mentorId: 'test-mentor',
    tenantKey: 'test-tenant',
  }),
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/platform/test-tenant/test-mentor',
}));

// Mock useMentorSettings hook
vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => ({
    isLoading: mockMentorSettingsLoading,
    data: {},
  }),
}));

// Mock Tauri detection functions
vi.mock('@/types/tauri', () => ({
  isTauriApp: () => mockIsTauriApp,
}));

vi.mock('@/hooks/use-tauri-offline', () => ({
  isTauriOfflineMode: () => mockIsTauriOfflineMode,
  isOfflineServerOrigin: () => mockIsOfflineServerOrigin,
}));

// Mock child components
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  ),
  SidebarInset: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    className?: string;
  }) => (
    <div data-testid="sidebar-inset" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/modals/modal-container', () => ({
  ModalContainer: () => <div data-testid="modal-container">ModalContainer</div>,
}));

vi.mock(
  '@/app/platform/[tenantKey]/[mentorId]/_components/subscription-wrapper',
  () => ({
    SubscriptionWrapper: () => (
      <div data-testid="subscription-wrapper">SubscriptionWrapper</div>
    ),
  }),
);

vi.mock(
  '@/app/platform/[tenantKey]/[mentorId]/_components/hot-keys-wrapper',
  () => ({
    HotKeysWrapper: () => (
      <div data-testid="hot-keys-wrapper">HotKeysWrapper</div>
    ),
  }),
);

vi.mock(
  '@/app/platform/[tenantKey]/[mentorId]/_components/app-sidebar',
  () => ({
    AppSidebar: () => <div data-testid="app-sidebar">AppSidebar</div>,
  }),
);

vi.mock('@/app/platform/[tenantKey]/[mentorId]/_components/nav-bar', () => ({
  NavBar: () => <div data-testid="nav-bar">NavBar</div>,
}));

vi.mock('@/contexts/accessibility-contexts', () => ({
  AccessibilityProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="accessibility-provider">{children}</div>
  ),
}));

vi.mock(
  '@/app/platform/[tenantKey]/[mentorId]/_components/accessibility-fab',
  () => ({
    AccessibilityFab: () => (
      <div data-testid="accessibility-fab">AccessibilityFab</div>
    ),
  }),
);

// Reset mocks before each test
beforeEach(() => {
  mockMentorSettingsLoading = false;
  mockSearchParams = new URLSearchParams();
  mockIsTauriApp = false;
  mockIsTauriOfflineMode = false;
  mockIsOfflineServerOrigin = false;
});

describe('AppLayout', () => {
  describe('loading state', () => {
    it('renders null when mentor settings are loading and not in offline/compact mode', () => {
      mockMentorSettingsLoading = true;

      const { container } = render(
        <AppLayout>
          <div>Children</div>
        </AppLayout>,
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders content when loading but in Tauri offline mode', () => {
      mockMentorSettingsLoading = true;
      mockIsTauriApp = true;
      mockIsTauriOfflineMode = true;

      render(
        <AppLayout>
          <div data-testid="children">Children</div>
        </AppLayout>,
      );

      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
      expect(screen.getByTestId('children')).toBeInTheDocument();
    });

    it('renders content when loading but isOfflineServerOrigin is true', () => {
      mockMentorSettingsLoading = true;
      mockIsOfflineServerOrigin = true;

      render(
        <AppLayout>
          <div data-testid="children">Children</div>
        </AppLayout>,
      );

      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
    });

    it('renders compact mode when loading but compact=true', () => {
      mockMentorSettingsLoading = true;
      mockSearchParams = new URLSearchParams('compact=true');

      render(
        <AppLayout>
          <div data-testid="children">Children</div>
        </AppLayout>,
      );

      expect(screen.getByTestId('children')).toBeInTheDocument();
      expect(screen.queryByTestId('sidebar-provider')).not.toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('renders only main content without sidebar when compact=true', () => {
      mockSearchParams = new URLSearchParams('compact=true');

      render(
        <AppLayout>
          <div data-testid="children">Children</div>
        </AppLayout>,
      );

      const mainContent = screen.getByRole('main');
      expect(mainContent).toBeInTheDocument();
      expect(mainContent).toHaveAttribute('id', 'main-content-container');
      expect(mainContent).toHaveClass(
        'h-dvh',
        'flex',
        'flex-col',
        'overflow-hidden',
      );

      expect(screen.getByTestId('children')).toBeInTheDocument();

      // Should NOT render full layout components
      expect(screen.queryByTestId('sidebar-provider')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('subscription-wrapper'),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('app-sidebar')).not.toBeInTheDocument();
    });

    it('renders compact mode when compact param has value true', () => {
      mockSearchParams = new URLSearchParams('compact=true');

      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>,
      );

      expect(screen.queryByTestId('sidebar-provider')).not.toBeInTheDocument();
    });

    it('does not render compact mode when compact param is false', () => {
      mockSearchParams = new URLSearchParams('compact=false');

      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>,
      );

      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
    });

    it('does not render compact mode when compact param is missing', () => {
      mockSearchParams = new URLSearchParams('');

      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>,
      );

      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
    });
  });

  describe('Tauri offline mode', () => {
    it('does not render SubscriptionWrapper when in Tauri offline mode', () => {
      mockIsTauriApp = true;
      mockIsTauriOfflineMode = true;

      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>,
      );

      expect(
        screen.queryByTestId('subscription-wrapper'),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
    });

    it('does not render SubscriptionWrapper when isOfflineServerOrigin is true', () => {
      mockIsOfflineServerOrigin = true;

      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>,
      );

      expect(
        screen.queryByTestId('subscription-wrapper'),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
    });

    it('renders SubscriptionWrapper when Tauri is running but not offline', () => {
      mockIsTauriApp = true;
      mockIsTauriOfflineMode = false;
      mockIsOfflineServerOrigin = false;

      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>,
      );

      expect(screen.getByTestId('subscription-wrapper')).toBeInTheDocument();
    });
  });

  describe('full layout rendering', () => {
    it('renders all layout components when not loading or in special modes', () => {
      render(
        <AppLayout>
          <div data-testid="children">Children</div>
        </AppLayout>,
      );

      expect(screen.getByTestId('subscription-wrapper')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
      expect(screen.getByTestId('hot-keys-wrapper')).toBeInTheDocument();
      expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-inset')).toBeInTheDocument();
      expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
      expect(screen.getByTestId('modal-container')).toBeInTheDocument();
      expect(screen.getByTestId('accessibility-provider')).toBeInTheDocument();
      expect(screen.getByTestId('accessibility-fab')).toBeInTheDocument();
      expect(screen.getByTestId('children')).toBeInTheDocument();
    });

    it('renders main content container with correct attributes', () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>,
      );

      const mainContent = screen.getByRole('main');
      expect(mainContent).toHaveAttribute('id', 'main-content-container');
      expect(mainContent).toHaveClass('flex-1', 'flex', 'flex-col', 'min-h-0');
    });

    it('passes defaultOpen prop to SidebarProvider', () => {
      render(
        <AppLayout defaultOpen={true}>
          <div>Content</div>
        </AppLayout>,
      );

      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
    });

    it('renders SidebarInset with correct classes', () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>,
      );

      const sidebarInset = screen.getByTestId('sidebar-inset');
      expect(sidebarInset).toHaveClass(
        'h-dvh',
        'flex',
        'flex-col',
        'overflow-hidden',
      );
    });
  });

  describe('combined conditions', () => {
    it('renders null when loading, not offline, and not compact', () => {
      mockMentorSettingsLoading = true;
      mockIsTauriApp = false;
      mockIsTauriOfflineMode = false;
      mockIsOfflineServerOrigin = false;
      mockSearchParams = new URLSearchParams('');

      const { container } = render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>,
      );

      expect(container.firstChild).toBeNull();
    });

    it('prioritizes compact mode over offline mode when both are set', () => {
      mockIsOfflineServerOrigin = true;
      mockSearchParams = new URLSearchParams('compact=true');

      render(
        <AppLayout>
          <div data-testid="children">Content</div>
        </AppLayout>,
      );

      // Compact mode should take priority - simple main container without sidebar
      expect(screen.queryByTestId('sidebar-provider')).not.toBeInTheDocument();
      expect(screen.getByTestId('children')).toBeInTheDocument();
    });

    it('renders in offline mode without SubscriptionWrapper when Tauri is offline', () => {
      mockIsTauriApp = true;
      mockIsTauriOfflineMode = true;
      mockIsOfflineServerOrigin = false;

      render(
        <AppLayout>
          <div data-testid="children">Content</div>
        </AppLayout>,
      );

      expect(
        screen.queryByTestId('subscription-wrapper'),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
      expect(screen.getByTestId('children')).toBeInTheDocument();
    });
  });
});
