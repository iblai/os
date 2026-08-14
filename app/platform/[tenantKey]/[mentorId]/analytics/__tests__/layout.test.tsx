import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockUsePathname = vi.fn();
const mockUseRouter = vi.fn();
const mockUseAppSelector = vi.fn();
const mockCheckRbacPermission = vi.fn();
const mockUseGetMentorPublicSettingsQuery = vi.fn();
const mockUseUsername = vi.fn();
const analyticsLayoutSpy = vi.fn();

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
});
