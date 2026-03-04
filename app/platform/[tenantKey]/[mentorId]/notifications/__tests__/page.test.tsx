import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockUseSearchParams = vi.fn();
const mockUseUsername = vi.fn();
const mockUseIsAdmin = vi.fn();
const mockUseAppSelector = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
  useIsAdmin: () => mockUseIsAdmin(),
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: any) => mockUseAppSelector(selector),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  NotificationDisplay: ({ org, userId }: any) => (
    <div data-testid="notification-display">
      <span data-testid="org">{org}</span>
      <span data-testid="user-id">{userId}</span>
    </div>
  ),
}));

vi.mock('@/lib/config', () => ({
  config: { enableRBAC: () => true },
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: vi.fn(),
}));

const NotificationsPageModule = await import('../page');
const NotificationsPage = NotificationsPageModule.default;

describe('notifications page', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant' });
    mockUseSearchParams.mockReturnValue({ get: () => null });
    mockUseUsername.mockReturnValue('testuser');
    mockUseIsAdmin.mockReturnValue(false);
    mockUseAppSelector.mockReturnValue({});
  });

  it('should export dynamic config', () => {
    expect(NotificationsPageModule.dynamic).toBe('force-dynamic');
  });

  it('should render NotificationDisplay component', () => {
    render(<NotificationsPage />);
    expect(screen.getByTestId('notification-display')).toBeInTheDocument();
  });

  it('should pass tenantKey as org', () => {
    render(<NotificationsPage />);
    expect(screen.getByTestId('org')).toHaveTextContent('test-tenant');
  });

  it('should pass username as userId', () => {
    render(<NotificationsPage />);
    expect(screen.getByTestId('user-id')).toHaveTextContent('testuser');
  });
});
