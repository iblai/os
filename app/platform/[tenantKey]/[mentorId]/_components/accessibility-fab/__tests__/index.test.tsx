import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { AccessibilityFab } from '../index';

// Mock hooks
const mockUsePathname = vi.fn();
const mockUseParams = vi.fn();
const mockUseTenantMetadata = vi.fn();
const mockUseEmbedMode = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useParams: () => mockUseParams(),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantMetadata: () => mockUseTenantMetadata(),
  selectChats: (state: any) => state.chatSliceShared?.chats ?? {},
  selectActiveTab: (state: any) => state.chatSliceShared?.activeTab ?? 'chat',
}));

vi.mock('@/hooks/use-embed-mode', () => ({
  useEmbedMode: () => mockUseEmbedMode(),
}));

// Mock child components
vi.mock('@/components/accessibility/floating-accessibility-button', () => ({
  FloatingAccessibilityButton: () => (
    <div data-testid="floating-accessibility-button">Floating Button</div>
  ),
}));

vi.mock('@/components/accessibility/accessibility-toolbar', () => ({
  AccessibilityToolbar: () => (
    <div data-testid="accessibility-toolbar">Toolbar</div>
  ),
}));

// Create a mock Redux store
function createMockStore() {
  return configureStore({
    reducer: {
      chatSliceShared: (state = { chats: { chat: [] }, activeTab: 'chat' }) =>
        state,
    },
  });
}

describe('AccessibilityFab', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/platform/test-tenant/test-mentor');
    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant' });
    mockUseTenantMetadata.mockReturnValue({
      metadata: { accessibility_menu: false },
    });
    mockUseEmbedMode.mockReturnValue(false);
  });

  describe('Rendering behavior', () => {
    it('renders both FloatingAccessibilityButton and AccessibilityToolbar when conditions are met', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: true },
      });

      const store = createMockStore();
      render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(
        screen.getByTestId('floating-accessibility-button'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('accessibility-toolbar')).toBeInTheDocument();
    });

    it('returns null when not in embed mode but accessibility_menu is false', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: false },
      });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(container.firstChild).toBeNull();
      expect(
        screen.queryByTestId('floating-accessibility-button'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('accessibility-toolbar'),
      ).not.toBeInTheDocument();
    });

    it('returns null when not in embed mode and metadata is undefined', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({ metadata: undefined });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(container.firstChild).toBeNull();
      expect(
        screen.queryByTestId('floating-accessibility-button'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('accessibility-toolbar'),
      ).not.toBeInTheDocument();
    });

    it('returns null when accessibility_menu is null', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: null },
      });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Embed mode behavior', () => {
    it('returns null when in embed mode regardless of accessibility_menu value', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: false },
      });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(container.firstChild).toBeNull();
      expect(
        screen.queryByTestId('floating-accessibility-button'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('accessibility-toolbar'),
      ).not.toBeInTheDocument();
    });

    it('returns null when in embed mode even if accessibility_menu is true', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: true },
      });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(container.firstChild).toBeNull();
      expect(
        screen.queryByTestId('floating-accessibility-button'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('accessibility-toolbar'),
      ).not.toBeInTheDocument();
    });

    it('returns null when in embed mode and accessibility_menu is undefined', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseTenantMetadata.mockReturnValue({ metadata: undefined });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(container.firstChild).toBeNull();
      expect(
        screen.queryByTestId('floating-accessibility-button'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('accessibility-toolbar'),
      ).not.toBeInTheDocument();
    });

    it('returns null when in embed mode and metadata is null', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseTenantMetadata.mockReturnValue({ metadata: null });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Analytics page behavior', () => {
    it('returns null when on analytics page even with accessibility_menu enabled', () => {
      mockUsePathname.mockReturnValue(
        '/platform/test-tenant/test-mentor/analytics',
      );
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: true },
      });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(container.firstChild).toBeNull();
      expect(
        screen.queryByTestId('floating-accessibility-button'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('accessibility-toolbar'),
      ).not.toBeInTheDocument();
    });

    it('returns null when on analytics subpage', () => {
      mockUsePathname.mockReturnValue(
        '/platform/test-tenant/test-mentor/analytics/details',
      );
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: true },
      });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(container.firstChild).toBeNull();
    });

    it('analytics check takes precedence over embed mode check', () => {
      mockUsePathname.mockReturnValue(
        '/platform/test-tenant/test-mentor/analytics',
      );
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: true },
      });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Container styling', () => {
    it('renders with correct fixed positioning and styling classes', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: true },
      });

      // Create store with messages so bottom-[21rem] is applied
      const store = configureStore({
        reducer: {
          chatSliceShared: (
            state = {
              chats: {
                chat: [
                  {
                    id: '1',
                    content: 'test',
                    role: 'user',
                    timestamp: new Date().toISOString(),
                    visible: true,
                  },
                ],
              },
              activeTab: 'chat',
            },
          ) => state,
        },
      });

      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      const wrapperDiv = container.querySelector('div.fixed');
      expect(wrapperDiv).toBeInTheDocument();
      expect(wrapperDiv?.className).toContain('fixed');
      expect(wrapperDiv?.className).toContain('bottom-[21rem]');
      expect(wrapperDiv?.className).toContain('right-4');
      expect(wrapperDiv?.className).toContain('flex-col');
      expect(wrapperDiv?.className).toContain('gap-3');
      expect(wrapperDiv?.className).toContain('z-50');
      expect(wrapperDiv?.className).toContain('mb-10');
    });
  });

  describe('Hook integration', () => {
    it('calls useParams with correct type', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(mockUseParams).toHaveBeenCalled();
    });

    it('calls useTenantMetadata with tenantKey from params', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'custom-tenant' });

      const store = createMockStore();
      render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(mockUseTenantMetadata).toHaveBeenCalled();
    });

    it('calls useEmbedMode hook', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(mockUseEmbedMode).toHaveBeenCalled();
    });

    it('calls usePathname hook', () => {
      const store = createMockStore();
      render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(mockUsePathname).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('handles null pathname gracefully when accessibility is enabled', () => {
      mockUsePathname.mockReturnValue(null);
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: true },
      });

      const store = createMockStore();
      render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(
        screen.getByTestId('floating-accessibility-button'),
      ).toBeInTheDocument();
    });

    it('handles undefined pathname gracefully when accessibility is enabled', () => {
      mockUsePathname.mockReturnValue(undefined);
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: true },
      });

      const store = createMockStore();
      render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      expect(
        screen.getByTestId('floating-accessibility-button'),
      ).toBeInTheDocument();
    });

    it('case-sensitive analytics check - renders when path has capital A', () => {
      mockUsePathname.mockReturnValue(
        '/platform/test-tenant/test-mentor/Analytics',
      );
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: true },
      });

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      // Should NOT be null because 'Analytics' with capital A won't match '/analytics'
      expect(container.firstChild).not.toBeNull();
      expect(
        screen.getByTestId('floating-accessibility-button'),
      ).toBeInTheDocument();
    });

    it('order of checks: embed mode checked first', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: true },
      });
      mockUsePathname.mockReturnValue('/platform/test-tenant/test-mentor');

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      // Should be null because embed mode returns early
      expect(container.firstChild).toBeNull();
    });

    it('order of checks: accessibility_menu checked after embed mode', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseTenantMetadata.mockReturnValue({
        metadata: { accessibility_menu: false },
      });
      mockUsePathname.mockReturnValue('/platform/test-tenant/test-mentor');

      const store = createMockStore();
      const { container } = render(
        <Provider store={store}>
          <AccessibilityFab />
        </Provider>,
      );

      // Should be null because accessibility_menu is false
      expect(container.firstChild).toBeNull();
    });
  });
});
