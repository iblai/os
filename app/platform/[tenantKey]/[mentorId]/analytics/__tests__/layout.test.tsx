import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUseParams = vi.fn();
const mockUsePathname = vi.fn();
const mockUseRouter = vi.fn();
const mockUseAppSelector = vi.fn();
const mockCheckRbacPermission = vi.fn();
const mockUseGetMentorPublicSettingsQuery = vi.fn();
const mockUseUsername = vi.fn();
const analyticsLayoutSpy = vi.fn();
const mockNavigateToPlatformAnalytics = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  usePathname: () => mockUsePathname(),
  useRouter: () => mockUseRouter(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsLayout: (props: {
    excludeTabs: string[];
    children: React.ReactNode;
  }) => {
    analyticsLayoutSpy(props);
    return (
      <div data-testid="analytics-layout">
        <span data-testid="exclude-tabs">{props.excludeTabs.join(',')}</span>
        {props.children}
      </div>
    );
  },
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorPublicSettingsQuery: (...args: unknown[]) =>
    mockUseGetMentorPublicSettingsQuery(...args),
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: unknown) => mockUseAppSelector(selector),
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: vi.fn(),
}));

vi.mock('@/hoc/withPermissions', () => ({
  checkRbacPermission: (...args: unknown[]) => mockCheckRbacPermission(...args),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    navigateToPlatformAnalytics: mockNavigateToPlatformAnalytics,
  }),
}));

const AnalyticsLayoutWrapperModule = await import('../layout');
const AnalyticsLayoutWrapper = AnalyticsLayoutWrapperModule.default;

describe('AnalyticsLayoutWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockUsePathname.mockReturnValue(
      '/platform/test-tenant/test-mentor/analytics',
    );
    mockUseRouter.mockReturnValue({ push: vi.fn() });
    mockUseAppSelector.mockReturnValue({});
    mockUseUsername.mockReturnValue('testuser');
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
    });
  });

  it('always excludes courses and programs tabs', () => {
    mockCheckRbacPermission.mockReturnValue(true);
    render(
      <AnalyticsLayoutWrapper>
        <div>child</div>
      </AnalyticsLayoutWrapper>,
    );

    const excluded = screen.getByTestId('exclude-tabs').textContent!.split(',');
    expect(excluded).toContain('courses');
    expect(excluded).toContain('programs');
  });

  it('excludes audit tab when view_audit_logs permission is denied', () => {
    mockCheckRbacPermission.mockImplementation(
      (_permissions: unknown, resource: string) =>
        resource !== '/mentors/42/#view_audit_logs',
    );

    render(
      <AnalyticsLayoutWrapper>
        <div>child</div>
      </AnalyticsLayoutWrapper>,
    );

    expect(screen.getByTestId('exclude-tabs').textContent).toContain('audit');
  });

  it('includes audit tab when view_audit_logs permission is granted', () => {
    mockCheckRbacPermission.mockReturnValue(true);

    render(
      <AnalyticsLayoutWrapper>
        <div>child</div>
      </AnalyticsLayoutWrapper>,
    );

    expect(screen.getByTestId('exclude-tabs').textContent).not.toContain(
      'audit',
    );
  });

  it('excludes audit tab while mentor public settings have not loaded', () => {
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({ data: undefined });
    mockCheckRbacPermission.mockReturnValue(true);

    render(
      <AnalyticsLayoutWrapper>
        <div>child</div>
      </AnalyticsLayoutWrapper>,
    );

    expect(screen.getByTestId('exclude-tabs').textContent).toContain('audit');
  });

  it('checks view_audit_logs against the mentor_id from public settings', () => {
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({
      data: { mentor_id: 99 },
    });
    mockCheckRbacPermission.mockReturnValue(true);

    render(
      <AnalyticsLayoutWrapper>
        <div>child</div>
      </AnalyticsLayoutWrapper>,
    );

    expect(mockCheckRbacPermission).toHaveBeenCalledWith(
      expect.anything(),
      '/mentors/99/#view_audit_logs',
    );
  });

  describe('platform analytics switch', () => {
    const clickSwitch = async () => {
      const user = userEvent.setup();
      await user.click(
        screen.getByRole('button', { name: 'Switch to platform analytics' }),
      );
    };

    beforeEach(() => {
      mockCheckRbacPermission.mockReturnValue(true);
    });

    it('offers the switch to the tenant-wide section', () => {
      render(
        <AnalyticsLayoutWrapper>
          <div>child</div>
        </AnalyticsLayoutWrapper>,
      );

      expect(
        screen.getByRole('button', { name: 'Switch to platform analytics' }),
      ).toBeInTheDocument();
    });

    // The pill is floated over the SDK's tab strip, which owns that row. jsdom
    // does not compute pointer-events, so the invariant is asserted on the
    // classes: the overlay spans the strip and must stay click-through, with
    // only the pill itself taking pointer events back. Dropping either half
    // makes the tabs (or the pill) unclickable. The offset itself is left to
    // design — it is nudged by eye, and pinning the pixel here would only
    // create churn.
    it('floats the switch in a click-through overlay across the tab strip', () => {
      render(
        <AnalyticsLayoutWrapper>
          <div>child</div>
        </AnalyticsLayoutWrapper>,
      );

      const button = screen.getByRole('button', {
        name: 'Switch to platform analytics',
      });
      expect(button).toHaveClass('pointer-events-auto');

      const overlay = button.parentElement!;
      expect(overlay).toHaveClass(
        'pointer-events-none',
        'absolute',
        'inset-x-0',
        'justify-center',
      );
    });

    it('keeps the overlay a sibling of the tab strip, not a child of it', () => {
      render(
        <AnalyticsLayoutWrapper>
          <div>child</div>
        </AnalyticsLayoutWrapper>,
      );

      // Nested inside, the SDK layout's own overflow/scroll handling would clip
      // or scroll the pill away with the tabs.
      const overlay = screen.getByRole('button', {
        name: 'Switch to platform analytics',
      }).parentElement!;
      expect(screen.getByTestId('analytics-layout')).not.toContainElement(
        overlay,
      );
      expect(overlay.parentElement).toHaveClass('relative');
    });

    // The URL shape belongs to `navigateToPlatformAnalytics` (covered in
    // hooks/__tests__/user-navigate.test.ts); what the layout owns is which tab
    // it hands over.
    it('asks for the tenant-wide overview when switching from the overview', async () => {
      render(
        <AnalyticsLayoutWrapper>
          <div>child</div>
        </AnalyticsLayoutWrapper>,
      );
      await clickSwitch();

      expect(mockNavigateToPlatformAnalytics).toHaveBeenCalledWith('');
    });

    it('carries the open tab across to the tenant-wide section', async () => {
      mockUsePathname.mockReturnValue(
        '/platform/test-tenant/test-mentor/analytics/users',
      );

      render(
        <AnalyticsLayoutWrapper>
          <div>child</div>
        </AnalyticsLayoutWrapper>,
      );
      await clickSwitch();

      expect(mockNavigateToPlatformAnalytics).toHaveBeenCalledWith('users');
    });

    it('falls back to the tenant overview for tabs with no tenant-wide route', async () => {
      mockUsePathname.mockReturnValue(
        '/platform/test-tenant/test-mentor/analytics/courses/course-1',
      );

      render(
        <AnalyticsLayoutWrapper>
          <div>child</div>
        </AnalyticsLayoutWrapper>,
      );
      await clickSwitch();

      expect(mockNavigateToPlatformAnalytics).toHaveBeenCalledWith('');
    });
  });
});
