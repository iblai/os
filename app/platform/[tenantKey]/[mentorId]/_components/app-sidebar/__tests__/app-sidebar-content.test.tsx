import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { AppSidebarContent } from '../app-sidebar-content';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider } from '@/components/ui/sidebar';
import rbacReducer from '@/features/rbac/rbac-slice';
import { Home, Settings, Users } from 'lucide-react';

// Mock window.matchMedia for SidebarProvider's useMobile hook
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

/**
 * Test suite for the AppSidebarContent component
 *
 * This suite tests the AppSidebarContent component's ability to:
 * 1. Filter and render content items correctly
 * 2. Handle logged in vs logged out states
 * 3. Handle mobile vs desktop views
 * 4. Handle open vs closed sidebar states
 * 5. Handle admin actions and trial checks
 * 6. Handle RBAC permissions filtering
 * 7. Handle click interactions correctly
 */

// Mock isLoggedIn function
let mockIsLoggedIn = true;
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils');
  return {
    ...actual,
    isLoggedIn: () => mockIsLoggedIn,
  };
});

// Mock checkRbacPermission
const mockCheckRbacPermission = vi.fn();
vi.mock('@/hoc/withPermissions', () => ({
  checkRbacPermission: (...args: unknown[]) => mockCheckRbacPermission(...args),
}));

// Mock AuthPopover
vi.mock('@/components/auth-popover', () => ({
  AuthPopover: ({
    children,
    tenantKey,
  }: {
    children: React.ReactNode;
    tenantKey: string;
  }) => (
    <div data-testid="auth-popover" data-tenant-key={tenantKey}>
      {children}
    </div>
  ),
}));

// Create test store with RBAC
const createTestStore = (rbacPermissions = {}) =>
  configureStore({
    reducer: {
      rbac: rbacReducer,
    },
    preloadedState: {
      rbac: {
        rbacPermissions,
      },
    },
  });

// Helper to render with providers
const renderWithProviders = (
  ui: React.ReactElement,
  { rbacPermissions = {}, ...options } = {},
) => {
  const store = createTestStore(rbacPermissions);
  return {
    store,
    ...render(
      <Provider store={store}>
        <SidebarProvider>
          <TooltipProvider>{ui}</TooltipProvider>
        </SidebarProvider>
      </Provider>,
      options,
    ),
  };
};

// Create mock items
const createMockItem = (overrides = {}) => ({
  label: 'Test Item',
  icon: Home,
  onClick: vi.fn(),
  hasBorder: false,
  isAnAdminAction: false,
  rbacResource: undefined,
  ...overrides,
});

describe('AppSidebarContent', () => {
  const mockSetOpenMobile = vi.fn();
  const mockExecuteWithTrialCheck = vi.fn((fn) => fn());
  const mockUpdateNavItems = vi.fn((item) => item);
  const mockIsUserTypeAllowed = vi.fn(() => true);

  const defaultProps = {
    contentItems: [],
    isUserTypeAllowed: mockIsUserTypeAllowed,
    isMobile: false,
    open: true,
    openMobile: false,
    setOpenMobile: mockSetOpenMobile,
    executeWithTrialCheck: mockExecuteWithTrialCheck,
    updateNavItemsForStudentsInMainOrAdvertisingTenant: mockUpdateNavItems,
    tenantKey: 'test-tenant',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoggedIn = true;
    mockCheckRbacPermission.mockReturnValue(true);
  });

  describe('Basic Rendering', () => {
    it('should render without crashing with empty content items', () => {
      const { container } = renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={[]} />,
      );

      expect(container).toBeInTheDocument();
    });

    it('should render content items when provided', () => {
      const items = [
        createMockItem({ label: 'Home' }),
        createMockItem({ label: 'Settings', icon: Settings }),
      ];

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should apply updateNavItemsForStudentsInMainOrAdvertisingTenant to each item', () => {
      const items = [
        createMockItem({ label: 'Item 1' }),
        createMockItem({ label: 'Item 2' }),
      ];

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      expect(mockUpdateNavItems).toHaveBeenCalledTimes(2);
    });
  });

  describe('Filtering', () => {
    it('should filter items based on isUserTypeAllowed', () => {
      const items = [
        createMockItem({ label: 'Allowed' }),
        createMockItem({ label: 'Not Allowed' }),
      ];

      mockIsUserTypeAllowed
        .mockReturnValueOnce(true) // First item allowed
        .mockReturnValueOnce(false); // Second item not allowed

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      expect(screen.getByText('Allowed')).toBeInTheDocument();
      expect(screen.queryByText('Not Allowed')).not.toBeInTheDocument();
    });

    it('should show items without rbacResource', () => {
      const items = [
        createMockItem({ label: 'No RBAC Resource', rbacResource: undefined }),
      ];

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      expect(screen.getByText('No RBAC Resource')).toBeInTheDocument();
    });

    it('should filter items based on RBAC permissions', () => {
      const rbacResourceFn = vi.fn().mockReturnValue('mentors#read');
      const items = [
        createMockItem({ label: 'RBAC Item', rbacResource: rbacResourceFn }),
      ];

      mockCheckRbacPermission.mockReturnValue(false);

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      expect(screen.queryByText('RBAC Item')).not.toBeInTheDocument();
      expect(rbacResourceFn).toHaveBeenCalledWith(0);
    });

    it('should show items when RBAC permission check passes', () => {
      const rbacResourceFn = vi.fn().mockReturnValue('mentors#read');
      const items = [
        createMockItem({ label: 'RBAC Allowed', rbacResource: rbacResourceFn }),
      ];

      mockCheckRbacPermission.mockReturnValue(true);

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      expect(screen.getByText('RBAC Allowed')).toBeInTheDocument();
    });

    it('should skip RBAC check and show items with rbacResource when user is not logged in', () => {
      mockIsLoggedIn = false;
      const rbacResourceFn = vi.fn().mockReturnValue('mentors#read');
      const items = [
        createMockItem({ label: 'RBAC Skipped', rbacResource: rbacResourceFn }),
      ];

      mockCheckRbacPermission.mockReturnValue(false);

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      expect(screen.getByText('RBAC Skipped')).toBeInTheDocument();
      expect(mockCheckRbacPermission).not.toHaveBeenCalled();
    });
  });

  describe('Logged In User - Open Sidebar (isMobile || open)', () => {
    beforeEach(() => {
      mockIsLoggedIn = true;
    });

    it('should render regular button when user is logged in and open is true', () => {
      const mockOnClick = vi.fn();
      const items = [
        createMockItem({ label: 'Test Button', onClick: mockOnClick }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={true}
          isMobile={false}
        />,
      );

      const button = screen.getByText('Test Button');
      fireEvent.click(button);

      expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should render regular button when isMobile is true', () => {
      const mockOnClick = vi.fn();
      const items = [
        createMockItem({ label: 'Mobile Button', onClick: mockOnClick }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          isMobile={true}
          open={false}
        />,
      );

      const button = screen.getByText('Mobile Button');
      fireEvent.click(button);

      expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should use executeWithTrialCheck for admin actions when logged in', () => {
      const mockOnClick = vi.fn();
      const items = [
        createMockItem({
          label: 'Admin Action',
          onClick: mockOnClick,
          isAnAdminAction: true,
        }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={true}
        />,
      );

      const button = screen.getByText('Admin Action');
      fireEvent.click(button);

      expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should apply border styling when item has hasBorder true', () => {
      const items = [
        createMockItem({ label: 'Bordered Item', hasBorder: true }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={true}
        />,
      );

      const button = screen.getByText('Bordered Item').closest('button');
      expect(button).toHaveClass('border');
      expect(button).toHaveClass('border-[#c9d8f8]');
    });

    it('should apply hover styling when item does not have border', () => {
      const items = [createMockItem({ label: 'Hover Item', hasBorder: false })];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={true}
        />,
      );

      const button = screen.getByText('Hover Item').closest('button');
      expect(button).toHaveClass('hover:bg-[#c9d8f8]');
    });
  });

  describe('Logged Out User - Open Sidebar (isMobile || open)', () => {
    beforeEach(() => {
      mockIsLoggedIn = false;
    });

    it('should wrap admin action in AuthPopover when logged out', () => {
      const items = [
        createMockItem({
          label: 'Admin When Logged Out',
          isAnAdminAction: true,
        }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={true}
        />,
      );

      const authPopover = screen.getByTestId('auth-popover');
      expect(authPopover).toBeInTheDocument();
      expect(authPopover).toHaveAttribute('data-tenant-key', 'test-tenant');
      expect(screen.getByText('Admin When Logged Out')).toBeInTheDocument();
    });

    it('should not wrap non-admin action in AuthPopover when logged out', () => {
      const mockOnClick = vi.fn();
      const items = [
        createMockItem({
          label: 'Regular When Logged Out',
          isAnAdminAction: false,
          onClick: mockOnClick,
        }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={true}
        />,
      );

      expect(screen.queryByTestId('auth-popover')).not.toBeInTheDocument();

      const button = screen.getByText('Regular When Logged Out');
      fireEvent.click(button);

      expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
      expect(mockOnClick).toHaveBeenCalled();
    });
  });

  describe('Logged In User - Closed Sidebar (!isMobile && !open)', () => {
    beforeEach(() => {
      mockIsLoggedIn = true;
    });

    it('should render with tooltip when sidebar is closed and logged in', () => {
      const mockOnClick = vi.fn();
      const items = [
        createMockItem({ label: 'Tooltip Item', onClick: mockOnClick }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={false}
          isMobile={false}
        />,
      );

      // The item should still be rendered
      expect(screen.getByText('Tooltip Item')).toBeInTheDocument();
    });

    it('should handle click on closed sidebar item for regular action', () => {
      const mockOnClick = vi.fn();
      const items = [
        createMockItem({ label: 'Click Closed', onClick: mockOnClick }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={false}
          isMobile={false}
        />,
      );

      const button = screen.getByText('Click Closed').closest('button');
      fireEvent.click(button!);

      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should use executeWithTrialCheck for admin actions on closed sidebar', () => {
      const mockOnClick = vi.fn();
      const items = [
        createMockItem({
          label: 'Admin Closed',
          onClick: mockOnClick,
          isAnAdminAction: true,
        }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={false}
          isMobile={false}
        />,
      );

      const button = screen.getByText('Admin Closed').closest('button');
      fireEvent.click(button!);

      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should apply grid place-content-center when sidebar is closed', () => {
      const items = [createMockItem({ label: 'Centered Item' })];

      const { container } = renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={false}
          openMobile={false}
          isMobile={false}
        />,
      );

      // Check for the SidebarMenuItem with the grid class
      const menuItem = container.querySelector('[data-sidebar="menu-item"]');
      expect(menuItem).toHaveClass('grid');
      expect(menuItem).toHaveClass('place-content-center');
    });
  });

  describe('Logged Out User - Closed Sidebar (!isMobile && !open)', () => {
    beforeEach(() => {
      mockIsLoggedIn = false;
    });

    it('should wrap admin action in AuthPopover with Tooltip when logged out and sidebar closed', () => {
      const items = [
        createMockItem({
          label: 'Admin Closed Logged Out',
          isAnAdminAction: true,
        }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={false}
          isMobile={false}
        />,
      );

      const authPopover = screen.getByTestId('auth-popover');
      expect(authPopover).toBeInTheDocument();
      expect(screen.getByText('Admin Closed Logged Out')).toBeInTheDocument();
    });

    it('should render regular item with tooltip but no AuthPopover when not admin and logged out', () => {
      const mockOnClick = vi.fn();
      const items = [
        createMockItem({
          label: 'Regular Closed Logged Out',
          isAnAdminAction: false,
          onClick: mockOnClick,
        }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={false}
          isMobile={false}
        />,
      );

      expect(screen.queryByTestId('auth-popover')).not.toBeInTheDocument();
      expect(screen.getByText('Regular Closed Logged Out')).toBeInTheDocument();

      const button = screen
        .getByText('Regular Closed Logged Out')
        .closest('button');
      fireEvent.click(button!);

      expect(mockOnClick).toHaveBeenCalled();
    });
  });

  describe('Icon Rendering', () => {
    it('should render icon with correct classes for open sidebar', () => {
      const items = [createMockItem({ label: 'Icon Test', icon: Users })];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={true}
        />,
      );

      const button = screen.getByText('Icon Test').closest('button');
      const icon = button?.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-5');
      expect(icon).toHaveClass('w-5');
    });

    it('should render icon with text-gray-500 class for open sidebar', () => {
      const items = [createMockItem({ label: 'Icon Gray', icon: Settings })];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={true}
        />,
      );

      const button = screen.getByText('Icon Gray').closest('button');
      const icon = button?.querySelector('svg');
      expect(icon).toHaveClass('text-gray-500');
    });

    it('should render icon for closed sidebar', () => {
      const items = [createMockItem({ label: 'Closed Icon', icon: Home })];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={false}
          isMobile={false}
        />,
      );

      const button = screen.getByText('Closed Icon').closest('button');
      const icon = button?.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-5');
      expect(icon).toHaveClass('w-5');
    });
  });

  describe('Multiple Items', () => {
    it('should render multiple items correctly', () => {
      const items = [
        createMockItem({ label: 'Item 1', icon: Home }),
        createMockItem({ label: 'Item 2', icon: Settings }),
        createMockItem({ label: 'Item 3', icon: Users }),
      ];

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('should filter multiple items based on user type and RBAC', () => {
      const rbacResourceFn = vi.fn().mockReturnValue('admin#read');
      const items = [
        createMockItem({ label: 'User Allowed' }),
        createMockItem({ label: 'User Not Allowed' }),
        createMockItem({
          label: 'RBAC Not Allowed',
          rbacResource: rbacResourceFn,
        }),
      ];

      mockIsUserTypeAllowed
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockCheckRbacPermission.mockReturnValue(false);

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      expect(screen.getByText('User Allowed')).toBeInTheDocument();
      expect(screen.queryByText('User Not Allowed')).not.toBeInTheDocument();
      expect(screen.queryByText('RBAC Not Allowed')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty contentItems array', () => {
      const { container } = renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={[]} />,
      );

      // Should not crash and container should be present
      expect(container).toBeInTheDocument();
    });

    it('should handle rapid prop changes', () => {
      const items = [createMockItem({ label: 'Rapid Change' })];

      const { rerender } = renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={true}
        />,
      );

      expect(screen.getByText('Rapid Change')).toBeInTheDocument();

      rerender(
        <Provider store={createTestStore()}>
          <SidebarProvider>
            <TooltipProvider>
              <AppSidebarContent
                {...defaultProps}
                contentItems={items}
                open={false}
              />
            </TooltipProvider>
          </SidebarProvider>
        </Provider>,
      );

      expect(screen.getByText('Rapid Change')).toBeInTheDocument();
    });

    it('should use item.label as key for list rendering', () => {
      const items = [
        createMockItem({ label: 'Unique Key 1' }),
        createMockItem({ label: 'Unique Key 2' }),
      ];

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      // Both items should render without key warnings (implicitly tested by successful render)
      expect(screen.getByText('Unique Key 1')).toBeInTheDocument();
      expect(screen.getByText('Unique Key 2')).toBeInTheDocument();
    });

    it('should handle items with both hasBorder variations', () => {
      const items = [
        createMockItem({ label: 'With Border', hasBorder: true }),
        createMockItem({ label: 'Without Border', hasBorder: false }),
      ];

      renderWithProviders(
        <AppSidebarContent {...defaultProps} contentItems={items} />,
      );

      const withBorderButton = screen
        .getByText('With Border')
        .closest('button');
      const withoutBorderButton = screen
        .getByText('Without Border')
        .closest('button');

      expect(withBorderButton).toHaveClass('border');
      expect(withoutBorderButton).not.toHaveClass('border');
      expect(withoutBorderButton).toHaveClass('hover:bg-[#c9d8f8]');
    });
  });

  describe('Mobile State', () => {
    it('should handle openMobile state correctly', () => {
      const items = [createMockItem({ label: 'Mobile Open Item' })];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          isMobile={true}
          openMobile={true}
        />,
      );

      expect(screen.getByText('Mobile Open Item')).toBeInTheDocument();
    });

    it('should not apply grid centering when openMobile is true', () => {
      const items = [createMockItem({ label: 'Mobile Item' })];

      const { container } = renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          open={false}
          openMobile={true}
          isMobile={true}
        />,
      );

      const menuItem = container.querySelector('[data-sidebar="menu-item"]');
      expect(menuItem).not.toHaveClass('grid');
    });
  });

  describe('TenantKey Prop', () => {
    it('should pass tenantKey to AuthPopover when rendering admin action for logged out user', () => {
      mockIsLoggedIn = false;
      const items = [createMockItem({ label: 'Admin', isAnAdminAction: true })];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          tenantKey="custom-tenant"
          open={true}
        />,
      );

      const authPopover = screen.getByTestId('auth-popover');
      expect(authPopover).toHaveAttribute('data-tenant-key', 'custom-tenant');
    });

    it('should pass tenantKey to AuthPopover in closed sidebar mode', () => {
      mockIsLoggedIn = false;
      const items = [
        createMockItem({ label: 'Admin Closed', isAnAdminAction: true }),
      ];

      renderWithProviders(
        <AppSidebarContent
          {...defaultProps}
          contentItems={items}
          tenantKey="another-tenant"
          open={false}
          isMobile={false}
        />,
      );

      const authPopover = screen.getByTestId('auth-popover');
      expect(authPopover).toHaveAttribute('data-tenant-key', 'another-tenant');
    });
  });
});
