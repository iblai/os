import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockUseSelector = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('react-redux', () => ({
  useSelector: (selector: any) => mockUseSelector(selector),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsReports: vi.fn(
    ({ tenantKey, mentorId, selectedMentorId, selectedMentorDbId }) => (
      <div data-testid="analytics-reports">
        <span data-testid="tenant-key">{tenantKey}</span>
        <span data-testid="mentor-id">{mentorId}</span>
        <span data-testid="selected-mentor-id">{selectedMentorId}</span>
        <span data-testid="selected-mentor-db-id">{selectedMentorDbId}</span>
      </div>
    ),
  ),
}));

vi.mock('@/features/analytics/slice', () => ({
  selectSelectedMentor: vi.fn(),
}));

const ReportsPageModule = await import('../page');
const ReportsPage = ReportsPageModule.default;

describe('analytics/reports page', () => {
  it('should export dynamic config', () => {
    expect(ReportsPageModule.dynamic).toBe('force-dynamic');
  });

  it('should render component', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockUseSelector.mockReturnValue(null);
    render(<ReportsPage />);
    expect(screen.getByTestId('analytics-reports')).toBeInTheDocument();
  });

  it('should pass correct props', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'my-tenant',
      mentorId: 'my-mentor',
    });
    mockUseSelector.mockReturnValue({ unique_id: 'selected-id' });
    render(<ReportsPage />);
    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'selected-id',
    );
  });

  it('passes selectedMentorDbId from selectedMentorInfo.id', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'my-tenant',
      mentorId: 'my-mentor',
    });
    mockUseSelector.mockReturnValue({
      unique_id: 'selected-id',
      id: 'db-id-777',
    });
    render(<ReportsPage />);
    expect(screen.getByTestId('selected-mentor-db-id')).toHaveTextContent(
      'db-id-777',
    );
  });

  it('passes empty selectedMentorDbId when selectedMentorInfo has no id', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'my-tenant',
      mentorId: 'my-mentor',
    });
    mockUseSelector.mockReturnValue({ unique_id: 'selected-id' });
    render(<ReportsPage />);
    // Empty string renders as an empty text node
    expect(screen.getByTestId('selected-mentor-db-id')).toHaveTextContent('');
  });

  it('passes empty selectedMentorDbId when selectedMentorInfo is null', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'my-tenant',
      mentorId: 'my-mentor',
    });
    mockUseSelector.mockReturnValue(null);
    render(<ReportsPage />);
    expect(screen.getByTestId('selected-mentor-db-id')).toHaveTextContent('');
  });

  it('falls back selectedMentorId to URL mentorId when no selected mentor', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'my-tenant',
      mentorId: 'url-mentor',
    });
    mockUseSelector.mockReturnValue(null);
    render(<ReportsPage />);
    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'url-mentor',
    );
  });
});
