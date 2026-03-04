import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { AppSidebarFooter } from '../app-sidebar-footer';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider } from '@/components/ui/sidebar';
import rbacReducer from '@/features/rbac/rbac-slice';
import { Home, Settings, LogOut } from 'lucide-react';

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
 * Test suite for the AppSidebarFooter component
 *
 * This suite tests the AppSidebarFooter component's ability to:
 * 1. Conditionally render based on embedMode
 * 2. Filter and render footer items correctly
 * 3. Handle logged in vs logged out states
 * 4. Handle mobile vs desktop views
 * 5. Handle open vs closed sidebar states
 * 6. Handle admin actions and trial checks
 * 7. Handle RBAC permissions filtering
 * 8. Handle click interactions correctly
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
  AuthPopover: ({ children, tenantKey }: { children: React.ReactNode; tenantKey: string }) => (
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
const renderWithProviders = (ui: React.ReactElement, { rbacPermissions = {}, ...options } = {}) => {
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
  isAnAdminAction: false,
  rbacResource: undefined,
  ...overrides,
});

describe('AppSidebarFooter', () => {
  const mockSetOpenMobile = vi.fn();
  const mockExecuteWithTrialCheck = vi.fn((fn) => fn());
  const mockUpdateNavItems = vi.fn((item) => item);
  const mockIsUserTypeAllowed = vi.fn(() => true);

  const defaultProps = {
    embedMode: false,
    footerItems: [],
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

  describe('Embed Mode', () => {
    it('should not render when embedMode is true', () => {
      const items = [createMockItem({ label: 'Footer Item' })];

      renderWithProviders(
        <AppSidebarFooter {...defaultProps} embedMode={true} footerItems={items} />,
      );

      expect(screen.queryByText('Footer Item')).not.toBeInTheDocument();
      // Should not render the SidebarFooter
      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    });

    it('should render when embedMode is false', () => {
      const items = [createMockItem({ label: 'Footer Item' })];

      renderWithProviders(
        <AppSidebarFooter {...defaultProps} embedMode={false} footerItems={items} />,
      );

      expect(screen.getByText('Footer Item')).toBeInTheDocument();
    });
  });

  describe('Basic Rendering', () => {
    it('should render without crashing with empty footer items', () => {
      const { container } = renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={[]} />,
      );

      expect(container).toBeInTheDocument();
    });

    it('should render footer items when provided', () => {
      const items = [
        createMockItem({ label: 'Settings', icon: Settings }),
        createMockItem({ label: 'Logout', icon: LogOut }),
      ];

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('should apply updateNavItemsForStudentsInMainOrAdvertisingTenant to each item', () => {
      const items = [createMockItem({ label: 'Item 1' }), createMockItem({ label: 'Item 2' })];

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} />);

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

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} />);

      expect(screen.getByText('Allowed')).toBeInTheDocument();
      expect(screen.queryByText('Not Allowed')).not.toBeInTheDocument();
    });

    it('should show items without rbacResource', () => {
      const items = [createMockItem({ label: 'No RBAC Resource', rbacResource: undefined })];

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} />);

      expect(screen.getByText('No RBAC Resource')).toBeInTheDocument();
    });

    it('should filter items based on RBAC permissions', () => {
      const rbacResourceFn = vi.fn().mockReturnValue('admin#read');
      const items = [createMockItem({ label: 'RBAC Item', rbacResource: rbacResourceFn })];

      mockCheckRbacPermission.mockReturnValue(false);

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} />);

      expect(screen.queryByText('RBAC Item')).not.toBeInTheDocument();
      expect(rbacResourceFn).toHaveBeenCalledWith(0);
    });

    it('should show items when RBAC permission check passes', () => {
      const rbacResourceFn = vi.fn().mockReturnValue('admin#read');
      const items = [createMockItem({ label: 'RBAC Allowed', rbacResource: rbacResourceFn })];

      mockCheckRbacPermission.mockReturnValue(true);

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} />);

      expect(screen.getByText('RBAC Allowed')).toBeInTheDocument();
    });

    it('should skip RBAC check and show items with rbacResource when user is not logged in', () => {
      mockIsLoggedIn = false;
      const rbacResourceFn = vi.fn().mockReturnValue('admin#read');
      const items = [createMockItem({ label: 'RBAC Skipped', rbacResource: rbacResourceFn })];

      mockCheckRbacPermission.mockReturnValue(false);

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} />);

      expect(screen.getByText('RBAC Skipped')).toBeInTheDocument();
      expect(mockCheckRbacPermission).not.toHaveBeenCalled();
    });
  });

  describe('Logged In User - Open Sidebar (isMobile || open)', () => {
    beforeEach(() => {
      mockIsLoggedIn = true;
    });

    it('should render clickable button when user is logged in and open is true', () => {
      const mockOnClick = vi.fn();
      const items = [createMockItem({ label: 'Test Button', onClick: mockOnClick })];

      renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={items} open={true} isMobile={false} />,
      );

      const button = screen.getByText('Test Button');
      fireEvent.click(button);

      expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should render clickable button when isMobile is true', () => {
      const mockOnClick = vi.fn();
      const items = [createMockItem({ label: 'Mobile Button', onClick: mockOnClick })];

      renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={items} isMobile={true} open={false} />,
      );

      const button = screen.getByText('Mobile Button');
      fireEvent.click(button);

      expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should use executeWithTrialCheck for admin actions when logged in', () => {
      const mockOnClick = vi.fn();
      const items = [
        createMockItem({ label: 'Admin Action', onClick: mockOnClick, isAnAdminAction: true }),
      ];

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} open={true} />);

      const button = screen.getByText('Admin Action');
      fireEvent.click(button);

      expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should not wrap in AuthPopover when logged in', () => {
      const items = [createMockItem({ label: 'Logged In Item' })];

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} open={true} />);

      expect(screen.queryByTestId('auth-popover')).not.toBeInTheDocument();
      expect(screen.getByText('Logged In Item')).toBeInTheDocument();
    });
  });

  describe('Logged Out User - Open Sidebar (isMobile || open)', () => {
    beforeEach(() => {
      mockIsLoggedIn = false;
    });

    it('should wrap in AuthPopover when logged out', () => {
      const items = [createMockItem({ label: 'Logged Out Item' })];

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} open={true} />);

      const authPopover = screen.getByTestId('auth-popover');
      expect(authPopover).toBeInTheDocument();
      expect(authPopover).toHaveAttribute('data-tenant-key', 'test-tenant');
      expect(screen.getByText('Logged Out Item')).toBeInTheDocument();
    });

    it('should pass correct tenantKey to AuthPopover', () => {
      const items = [createMockItem({ label: 'Item' })];

      renderWithProviders(
        <AppSidebarFooter
          {...defaultProps}
          footerItems={items}
          tenantKey="custom-tenant"
          open={true}
        />,
      );

      const authPopover = screen.getByTestId('auth-popover');
      expect(authPopover).toHaveAttribute('data-tenant-key', 'custom-tenant');
    });
  });

  describe('Logged In User - Closed Sidebar (!isMobile && !open)', () => {
    beforeEach(() => {
      mockIsLoggedIn = true;
    });

    it('should render with tooltip when sidebar is closed and logged in', () => {
      const mockOnClick = vi.fn();
      const items = [createMockItem({ label: 'Tooltip Item', onClick: mockOnClick })];

      renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={items} open={false} isMobile={false} />,
      );

      expect(screen.getByText('Tooltip Item')).toBeInTheDocument();
    });

    it('should handle click on closed sidebar item for regular action', () => {
      const mockOnClick = vi.fn();
      const items = [createMockItem({ label: 'Click Closed', onClick: mockOnClick })];

      renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={items} open={false} isMobile={false} />,
      );

      const button = screen.getByText('Click Closed').closest('button');
      fireEvent.click(button!);

      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should use executeWithTrialCheck for admin actions on closed sidebar', () => {
      const mockOnClick = vi.fn();
      const items = [
        createMockItem({ label: 'Admin Closed', onClick: mockOnClick, isAnAdminAction: true }),
      ];

      renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={items} open={false} isMobile={false} />,
      );

      const button = screen.getByText('Admin Closed').closest('button');
      fireEvent.click(button!);

      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should apply place-content-center when sidebar is closed', () => {
      const items = [createMockItem({ label: 'Centered Item' })];

      const { container } = renderWithProviders(
        <AppSidebarFooter
          {...defaultProps}
          footerItems={items}
          open={false}
          openMobile={false}
          isMobile={false}
        />,
      );

      const menu = container.querySelector('[data-sidebar="menu"]');
      expect(menu).toHaveClass('place-content-center');
    });

    it('should not apply place-content-center when sidebar is open', () => {
      const items = [createMockItem({ label: 'Not Centered' })];

      const { container } = renderWithProviders(
        <AppSidebarFooter
          {...defaultProps}
          footerItems={items}
          open={true}
          openMobile={false}
          isMobile={false}
        />,
      );

      const menu = container.querySelector('[data-sidebar="menu"]');
      expect(menu).not.toHaveClass('place-content-center');
    });
  });

  describe('Logged Out User - Closed Sidebar (!isMobile && !open)', () => {
    beforeEach(() => {
      mockIsLoggedIn = false;
    });

    it('should wrap in AuthPopover when logged out and sidebar closed', () => {
      const items = [createMockItem({ label: 'Closed Logged Out' })];

      renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={items} open={false} isMobile={false} />,
      );

      const authPopover = screen.getByTestId('auth-popover');
      expect(authPopover).toBeInTheDocument();
      expect(screen.getByText('Closed Logged Out')).toBeInTheDocument();
    });
  });

  describe('Icon Rendering', () => {
    it('should render icon with correct classes', () => {
      const items = [createMockItem({ label: 'Icon Test', icon: Settings })];

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} open={true} />);

      const button = screen.getByText('Icon Test').closest('button');
      const icon = button?.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-5');
      expect(icon).toHaveClass('w-5');
    });
  });

  describe('Multiple Items', () => {
    it('should render multiple footer items correctly', () => {
      const items = [
        createMockItem({ label: 'Item 1', icon: Home }),
        createMockItem({ label: 'Item 2', icon: Settings }),
        createMockItem({ label: 'Item 3', icon: LogOut }),
      ];

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} />);

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('should filter multiple items based on user type and RBAC', () => {
      const rbacResourceFn = vi.fn().mockReturnValue('admin#read');
      const items = [
        createMockItem({ label: 'User Allowed' }),
        createMockItem({ label: 'User Not Allowed' }),
        createMockItem({ label: 'RBAC Not Allowed', rbacResource: rbacResourceFn }),
      ];

      mockIsUserTypeAllowed
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockCheckRbacPermission.mockReturnValue(false);

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} />);

      expect(screen.getByText('User Allowed')).toBeInTheDocument();
      expect(screen.queryByText('User Not Allowed')).not.toBeInTheDocument();
      expect(screen.queryByText('RBAC Not Allowed')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty footerItems array', () => {
      const { container } = renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={[]} />,
      );

      expect(container).toBeInTheDocument();
    });

    it('should handle rapid prop changes', () => {
      const items = [createMockItem({ label: 'Rapid Change' })];

      const { rerender } = renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={items} open={true} />,
      );

      expect(screen.getByText('Rapid Change')).toBeInTheDocument();

      rerender(
        <Provider store={createTestStore()}>
          <SidebarProvider>
            <TooltipProvider>
              <AppSidebarFooter {...defaultProps} footerItems={items} open={false} />
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

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} />);

      expect(screen.getByText('Unique Key 1')).toBeInTheDocument();
      expect(screen.getByText('Unique Key 2')).toBeInTheDocument();
    });

    it('should toggle between embedMode states', () => {
      const items = [createMockItem({ label: 'Toggle Item' })];

      const { rerender } = renderWithProviders(
        <AppSidebarFooter {...defaultProps} embedMode={false} footerItems={items} />,
      );

      expect(screen.getByText('Toggle Item')).toBeInTheDocument();

      rerender(
        <Provider store={createTestStore()}>
          <SidebarProvider>
            <TooltipProvider>
              <AppSidebarFooter {...defaultProps} embedMode={true} footerItems={items} />
            </TooltipProvider>
          </SidebarProvider>
        </Provider>,
      );

      expect(screen.queryByText('Toggle Item')).not.toBeInTheDocument();
    });
  });

  describe('Mobile State', () => {
    it('should handle openMobile state correctly', () => {
      const items = [createMockItem({ label: 'Mobile Open Item' })];

      renderWithProviders(
        <AppSidebarFooter
          {...defaultProps}
          footerItems={items}
          isMobile={true}
          openMobile={true}
        />,
      );

      expect(screen.getByText('Mobile Open Item')).toBeInTheDocument();
    });

    it('should not apply grid centering when openMobile is true', () => {
      const items = [createMockItem({ label: 'Mobile Item' })];

      const { container } = renderWithProviders(
        <AppSidebarFooter
          {...defaultProps}
          footerItems={items}
          open={false}
          openMobile={true}
          isMobile={true}
        />,
      );

      const menu = container.querySelector('[data-sidebar="menu"]');
      expect(menu).not.toHaveClass('place-content-center');
    });
  });

  describe('SidebarFooter Structure', () => {
    it('should render SidebarFooter with correct classes', () => {
      const items = [createMockItem({ label: 'Footer Structure' })];

      const { container } = renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={items} />,
      );

      const footer = container.querySelector('[data-sidebar="footer"]');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass('flex-none');
      expect(footer).toHaveClass('px-0');
    });

    it('should render SidebarMenu with grid and px-4 classes', () => {
      const items = [createMockItem({ label: 'Menu Structure' })];

      const { container } = renderWithProviders(
        <AppSidebarFooter {...defaultProps} footerItems={items} />,
      );

      const menu = container.querySelector('[data-sidebar="menu"]');
      expect(menu).toBeInTheDocument();
      expect(menu).toHaveClass('grid');
      expect(menu).toHaveClass('px-4');
    });
  });

  describe('Button Styling', () => {
    it('should apply correct styling classes to button', () => {
      const items = [createMockItem({ label: 'Styled Button' })];

      renderWithProviders(<AppSidebarFooter {...defaultProps} footerItems={items} open={true} />);

      const button = screen.getByText('Styled Button').closest('button');
      expect(button).toHaveClass('cursor-pointer');
      expect(button).toHaveClass('space-x-1');
      expect(button).toHaveClass('text-gray-700');
      expect(button).toHaveClass('hover:bg-[#c9d8f8]');
    });
  });
});
