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
  AnalyticsFinancialStats: vi.fn(
    ({ tenantKey, mentorId, selectedMentorId }) => (
      <div data-testid="analytics-financial-stats">
        <span data-testid="tenant-key">{tenantKey}</span>
        <span data-testid="mentor-id">{mentorId}</span>
        <span data-testid="selected-mentor-id">{selectedMentorId}</span>
      </div>
    ),
  ),
}));

vi.mock('@/features/analytics/slice', () => ({
  selectSelectedMentor: vi.fn(),
}));

// Import after mocks
const FinancialPageModule = await import('../page');
const FinancialPage = FinancialPageModule.default;

describe('analytics/financial page', () => {
  it('should export dynamic config', () => {
    expect(FinancialPageModule.dynamic).toBe('force-dynamic');
  });

  it('should render AnalyticsFinancialStats component', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });

    mockUseSelector.mockReturnValue(null);

    render(<FinancialPage />);

    expect(screen.getByTestId('analytics-financial-stats')).toBeInTheDocument();
  });

  it('should pass correct props from params', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'my-tenant',
      mentorId: 'my-mentor',
    });

    mockUseSelector.mockReturnValue(null);

    render(<FinancialPage />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
    expect(screen.getByTestId('mentor-id')).toHaveTextContent('my-mentor');
    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'my-mentor',
    );
  });

  it('should use selectedMentorInfo unique_id when available', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'param-mentor',
    });

    mockUseSelector.mockReturnValue({
      unique_id: 'selected-mentor-id',
    });

    render(<FinancialPage />);

    expect(screen.getByTestId('selected-mentor-id')).toHaveTextContent(
      'selected-mentor-id',
    );
  });
});
