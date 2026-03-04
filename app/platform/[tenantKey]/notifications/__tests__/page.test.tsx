import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test' }),
  useSearchParams: () => ({ get: () => null }),
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

describe('tenant notifications page', () => {
  it('should export dynamic config', () => {
    expect(PageModule.dynamic).toBe('force-dynamic');
  });

  it('should render', () => {
    const { getByTestId } = render(<Page />);
    expect(getByTestId('notification-display')).toBeInTheDocument();
  });
});
