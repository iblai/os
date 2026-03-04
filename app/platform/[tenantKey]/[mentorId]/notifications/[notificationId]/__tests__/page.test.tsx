import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockUseSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
  useIsAdmin: () => false,
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: () => ({}),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  NotificationDisplay: () => <div data-testid="notification-display" />,
}));

vi.mock('@/lib/config', () => ({
  config: { enableRBAC: () => true },
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: vi.fn(),
}));

const PageModule = await import('../page');
const Page = PageModule.default;

describe('notification detail page', () => {
  it('should export dynamic config', () => {
    expect(PageModule.dynamic).toBe('force-dynamic');
  });

  it('should render component', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'test', notificationId: '123' });
    mockUseSearchParams.mockReturnValue({ get: () => null });
    const { getByTestId } = render(<Page />);
    expect(getByTestId('notification-display')).toBeInTheDocument();
  });
});
