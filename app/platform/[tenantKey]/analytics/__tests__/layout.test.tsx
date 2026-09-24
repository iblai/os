import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockUsePathname = vi.fn();
const mockPush = vi.fn();
const analyticsLayoutSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsLayout: (props: {
    excludeTabs: string[];
    basePath: string;
    onTabChange: (tab: string) => void;
    children: React.ReactNode;
  }) => {
    analyticsLayoutSpy(props);
    return (
      <div data-testid="analytics-layout">
        <span data-testid="exclude-tabs">{props.excludeTabs.join(',')}</span>
        <span data-testid="base-path">{props.basePath}</span>
        {props.children}
      </div>
    );
  },
}));

vi.mock('../../../_components/platform-layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="platform-layout">{children}</div>
  ),
}));

const TenantAnalyticsLayoutModule = await import('../layout');
const TenantAnalyticsLayout = TenantAnalyticsLayoutModule.default;

const renderLayout = () =>
  render(
    <TenantAnalyticsLayout>
      <div data-testid="child">child</div>
    </TenantAnalyticsLayout>,
  );

describe('tenant analytics layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant' });
    mockUsePathname.mockReturnValue('/platform/test-tenant/analytics');
  });

  it('wraps the tab strip in the platform shell', () => {
    renderLayout();

    expect(screen.getByTestId('platform-layout')).toContainElement(
      screen.getByTestId('analytics-layout'),
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('builds the base path without a mentor id', () => {
    renderLayout();

    expect(screen.getByTestId('base-path')).toHaveTextContent(
      '/platform/test-tenant/analytics',
    );
  });

  it('excludes courses and programs tabs', () => {
    renderLayout();

    const excluded = screen.getByTestId('exclude-tabs').textContent!.split(',');
    expect(excluded).toContain('courses');
    expect(excluded).toContain('programs');
  });

  it('keeps the audit tab — the API authorizes the tenant-wide log', () => {
    renderLayout();

    expect(screen.getByTestId('exclude-tabs').textContent).not.toContain(
      'audit',
    );
  });

  it('navigates to the mentor-less tab route on tab change', () => {
    renderLayout();

    const { onTabChange } = analyticsLayoutSpy.mock.calls[0][0];
    onTabChange('users');
    expect(mockPush).toHaveBeenCalledWith(
      '/platform/test-tenant/analytics/users',
    );

    onTabChange('');
    expect(mockPush).toHaveBeenCalledWith('/platform/test-tenant/analytics');
  });
});
