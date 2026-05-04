import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock dependencies
const mockUseParams = vi.fn();
const mockUseSelector = vi.fn();
const mockUseUsername = vi.fn();
const mockUseGetMentorPublicSettingsQuery = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('react-redux', () => ({
  useSelector: (selector: any) => mockUseSelector(selector),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsAuditLogStats: vi.fn(
    ({ tenantKey, mentorId, userId, selectedMentorId }) => (
      <div data-testid="analytics-audit-log-stats">
        <span data-testid="tenant-key">{tenantKey}</span>
        <span data-testid="mentor-id">{mentorId}</span>
        <span data-testid="user-id">{userId}</span>
        <span data-testid="selected-mentor-id">{selectedMentorId}</span>
      </div>
    ),
  ),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorPublicSettingsQuery: (...args: any[]) =>
    mockUseGetMentorPublicSettingsQuery(...args),
}));

vi.mock('@/features/analytics/slice', () => ({
  selectSelectedMentor: vi.fn(),
}));

vi.mock('@/hoc/withPermissions', () => ({
  WithPermissions: ({
    children,
  }: {
    rbacResource: string;
    children: (props: { hasPermission: boolean }) => React.ReactNode;
  }) => <>{children({ hasPermission: true })}</>,
}));

// Import after mocks
const AuditLogPageModule = await import('../page');
const AuditLogPage = AuditLogPageModule.default;

describe('analytics audit page', () => {
  it('should export dynamic config', () => {
    expect(AuditLogPageModule.dynamic).toBe('force-dynamic');
  });

  it('should render AnalyticsAuditLogStats component', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockUseSelector.mockReturnValue(null);
    mockUseUsername.mockReturnValue('testuser');
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
    });

    render(<AuditLogPage />);

    expect(screen.getByTestId('analytics-audit-log-stats')).toBeInTheDocument();
  });

  it('should pass tenantKey, mentorId, and userId from params/hooks', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'my-tenant',
      mentorId: 'my-mentor',
    });
    mockUseSelector.mockReturnValue(null);
    mockUseUsername.mockReturnValue('myuser');
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
    });

    render(<AuditLogPage />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
    expect(screen.getByTestId('mentor-id')).toHaveTextContent('my-mentor');
    expect(screen.getByTestId('user-id')).toHaveTextContent('myuser');
  });

  it('should use selectedMentorInfo unique_id when available', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'param-mentor',
    });
    mockUseSelector.mockReturnValue({
      unique_id: 'selected-mentor-id',
      name: 'Selected Mentor',
    });
    mockUseUsername.mockReturnValue('testuser');
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
    });

    render(<AuditLogPage />);

    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'selected-mentor-id',
    );
  });

  it('should fallback to mentorId when selectedMentorInfo is null', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'fallback-mentor',
    });
    mockUseSelector.mockReturnValue(null);
    mockUseUsername.mockReturnValue('testuser');
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
    });

    render(<AuditLogPage />);

    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'fallback-mentor',
    );
  });

  it('should fallback to mentorId when selectedMentorInfo has no unique_id', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'fallback-mentor',
    });
    mockUseSelector.mockReturnValue({
      name: 'Mentor Without ID',
    });
    mockUseUsername.mockReturnValue('testuser');
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
    });

    render(<AuditLogPage />);

    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'fallback-mentor',
    );
  });

  it('should pass empty string as userId when username is null', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockUseSelector.mockReturnValue(null);
    mockUseUsername.mockReturnValue(null);
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
    });

    render(<AuditLogPage />);

    expect(screen.getByTestId('user-id')).toHaveTextContent('');
  });

  it('should render nothing while mentor public settings have not loaded', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockUseSelector.mockReturnValue(null);
    mockUseUsername.mockReturnValue('testuser');
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({ data: undefined });

    const { container } = render(<AuditLogPage />);

    expect(container.firstChild).toBeNull();
  });
});
