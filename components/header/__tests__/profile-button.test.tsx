import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ProfileButton } from '../profile-button';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'test-mentor' }),
}));

// Mock the iblai-js TenantSwitcher — render a sentinel we can assert on
vi.mock('@iblai/iblai-js/web-containers', () => ({
  TenantSwitcher: ({ currentTenantKey }: { currentTenantKey?: string }) => (
    <div data-testid="tenant-switcher">{currentTenantKey ?? ''}</div>
  ),
}));

// Mock useUserTenants
vi.mock('@/hooks/use-user', () => ({
  useUserTenants: () => ({ userTenants: [{ key: 't1', name: 'Tenant 1' }] }),
}));

// Mock the redux selector
vi.mock('@/lib/hooks', () => ({
  useAppSelector: vi.fn(() => ({})),
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: vi.fn(() => ({})),
}));

const mockHandleLogout = vi.fn();
const mockHandleTenantSwitch = vi.fn();
vi.mock('@/lib/utils', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return {
    ...actual,
    handleLogout: () => mockHandleLogout(),
    handleTenantSwitch: () => mockHandleTenantSwitch(),
  };
});

// Mock the dropdown menu primitives to render children directly (no Radix portal)
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    onSelect,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    onSelect?: () => void;
  }) => (
    <div
      data-testid="dropdown-item"
      onClick={() => {
        onClick?.();
        onSelect?.();
      }}
    >
      {children}
    </div>
  ),
}));

const defaultProps = {
  userImage: 'https://example.com/avatar.jpg',
  userName: 'MA',
  onClick: vi.fn(),
  onProfileClick: vi.fn(),
  isInstructor: true,
  setIsInstructor: vi.fn(),
};

describe('ProfileButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the avatar fallback with the userName initials', () => {
    render(<ProfileButton {...defaultProps} />);

    expect(screen.getByText('MA')).toBeInTheDocument();
  });

  it('renders the Profile menu item', () => {
    render(<ProfileButton {...defaultProps} />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('invokes onProfileClick when the Profile item is selected', () => {
    const onProfileClick = vi.fn();
    render(<ProfileButton {...defaultProps} onProfileClick={onProfileClick} />);

    const profileItem = screen.getByText('Profile');
    fireEvent.click(profileItem);

    expect(onProfileClick).toHaveBeenCalledTimes(1);
  });

  it('does NOT render the role toggle on desktop (isMobile=false)', () => {
    render(<ProfileButton {...defaultProps} isMobile={false} />);

    expect(screen.queryByText('User')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('renders User and Admin labels on mobile', () => {
    render(<ProfileButton {...defaultProps} isMobile={true} />);

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders no Learner/Instructor legacy labels on mobile', () => {
    render(<ProfileButton {...defaultProps} isMobile={true} />);

    expect(screen.queryByText('Learner')).not.toBeInTheDocument();
    expect(screen.queryByText('Instructor')).not.toBeInTheDocument();
  });

  it('applies the active style to Admin when isInstructor=true', () => {
    render(
      <ProfileButton {...defaultProps} isMobile={true} isInstructor={true} />,
    );

    expect(screen.getByText('Admin')).toHaveClass('font-semibold');
    expect(screen.getByText('User')).toHaveClass('text-gray-500');
  });

  it('applies the active style to User when isInstructor=false', () => {
    render(
      <ProfileButton {...defaultProps} isMobile={true} isInstructor={false} />,
    );

    expect(screen.getByText('User')).toHaveClass('font-semibold');
    expect(screen.getByText('Admin')).toHaveClass('text-gray-500');
  });

  it('toggles setIsInstructor when the role switch changes', () => {
    const setIsInstructor = vi.fn();
    render(
      <ProfileButton
        {...defaultProps}
        isMobile={true}
        isInstructor={false}
        setIsInstructor={setIsInstructor}
      />,
    );

    const sw = screen.getByRole('switch');
    fireEvent.click(sw);

    expect(setIsInstructor).toHaveBeenCalledWith(true);
  });

  it('renders the TenantSwitcher with the current tenant key', () => {
    render(<ProfileButton {...defaultProps} />);

    expect(screen.getByTestId('tenant-switcher')).toHaveTextContent(
      'test-tenant',
    );
  });

  it('triggers handleLogout when the Logout item is clicked', () => {
    render(<ProfileButton {...defaultProps} />);

    const logoutItem = screen.getByText('Logout');
    fireEvent.click(logoutItem);

    expect(mockHandleLogout).toHaveBeenCalledTimes(1);
  });
});
