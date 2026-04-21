import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock dependencies
const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();
const mockGetMentorId = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => mockGetMentorId(),
  }),
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

import { AuditLogTab } from '../audit-log-tab';

describe('AuditLogTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockUseUsername.mockReturnValue('testuser');
    mockGetMentorId.mockReturnValue('modal-mentor');
  });

  it('should render the header with title and description', () => {
    render(<AuditLogTab />);

    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(
      screen.getByText('View who changed what and when for this mentor.'),
    ).toBeInTheDocument();
  });

  it('should render AnalyticsAuditLogStats component', () => {
    render(<AuditLogTab />);

    expect(screen.getByTestId('analytics-audit-log-stats')).toBeInTheDocument();
  });

  it('should pass tenantKey from route params', () => {
    render(<AuditLogTab />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('test-tenant');
  });

  it('should use getMentorId() over route mentorId when available', () => {
    mockGetMentorId.mockReturnValue('modal-mentor-id');

    render(<AuditLogTab />);

    expect(screen.getByTestId('mentor-id')).toHaveTextContent(
      'modal-mentor-id',
    );
    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'modal-mentor-id',
    );
  });

  it('should fallback to route mentorId when getMentorId returns falsy', () => {
    mockGetMentorId.mockReturnValue(null);

    render(<AuditLogTab />);

    expect(screen.getByTestId('mentor-id')).toHaveTextContent('test-mentor');
    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'test-mentor',
    );
  });

  it('should fallback to route mentorId when getMentorId returns empty string', () => {
    mockGetMentorId.mockReturnValue('');

    render(<AuditLogTab />);

    expect(screen.getByTestId('mentor-id')).toHaveTextContent('test-mentor');
    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'test-mentor',
    );
  });

  it('should pass userId from useUsername hook', () => {
    mockUseUsername.mockReturnValue('myuser');

    render(<AuditLogTab />);

    expect(screen.getByTestId('user-id')).toHaveTextContent('myuser');
  });

  it('should pass empty string as userId when username is null', () => {
    mockUseUsername.mockReturnValue(null);

    render(<AuditLogTab />);

    expect(screen.getByTestId('user-id')).toHaveTextContent('');
  });

  it('should pass selectedMentorId same as mentorId', () => {
    mockGetMentorId.mockReturnValue('same-mentor');

    render(<AuditLogTab />);

    const mentorId = screen.getByTestId('mentor-id').textContent;
    const selectedMentorId =
      screen.getByTestId('selected-mentor-id').textContent;
    expect(mentorId).toBe(selectedMentorId);
  });
});
