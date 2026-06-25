import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock dependencies
const mockUseParams = vi.fn();
const mockUseSelector = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('react-redux', () => ({
  useSelector: (selector: any) => mockUseSelector(selector),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsOverview: vi.fn(({ tenantKey, mentorId, selectedMentorId }) => (
    <div data-testid="analytics-overview">
      <span data-testid="tenant-key">{tenantKey}</span>
      <span data-testid="mentor-id">{mentorId}</span>
      <span data-testid="selected-mentor-id">{selectedMentorId}</span>
    </div>
  )),
}));

vi.mock('@/features/analytics/slice', () => ({
  selectSelectedMentor: vi.fn(),
}));

// Import after mocks
const AnalyticsPageModule = await import('../page');
const AnalyticsPage = AnalyticsPageModule.default;

describe('analytics page', () => {
  it('should export dynamic config', () => {
    expect(AnalyticsPageModule.dynamic).toBe('force-dynamic');
  });

  it('should render AnalyticsOverview component', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });

    mockUseSelector.mockReturnValue(null);

    render(<AnalyticsPage />);

    expect(screen.getByTestId('analytics-overview')).toBeInTheDocument();
  });

  it('should pass tenantKey and mentorId from params', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'my-tenant',
      mentorId: 'my-mentor',
    });

    mockUseSelector.mockReturnValue(null);

    render(<AnalyticsPage />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
    expect(screen.getByTestId('mentor-id')).toHaveTextContent('my-mentor');
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

    render(<AnalyticsPage />);

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

    render(<AnalyticsPage />);

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

    render(<AnalyticsPage />);

    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'fallback-mentor',
    );
  });
});
