import React from 'react';
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
  AnalyticsTopicsStats: vi.fn(({ selectedMentorId }) => (
    <div data-testid="analytics-topics">
      <span data-testid="selected-mentor-id">{selectedMentorId}</span>
    </div>
  )),
}));

vi.mock('@/features/analytics/slice', () => ({
  selectSelectedMentor: vi.fn(),
}));

const TopicsPageModule = await import('../page');
const TopicsPage = TopicsPageModule.default;

describe('analytics/topics page', () => {
  it('should export dynamic config', () => {
    expect(TopicsPageModule.dynamic).toBe('force-dynamic');
  });

  it('should render component', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'test', mentorId: 'test' });
    mockUseSelector.mockReturnValue(null);
    render(<TopicsPage />);
    expect(screen.getByTestId('analytics-topics')).toBeInTheDocument();
  });
});
