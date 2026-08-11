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
  AnalyticsUsersStats: vi.fn(({ selectedMentorId }) => (
    <div data-testid="analytics-users">
      <span data-testid="selected-mentor-id">{selectedMentorId}</span>
    </div>
  )),
}));

vi.mock('@/features/analytics/slice', () => ({
  selectSelectedMentor: vi.fn(),
}));

const UsersPageModule = await import('../page');
const UsersPage = UsersPageModule.default;

describe('analytics/users page', () => {
  it('should export dynamic config', () => {
    expect(UsersPageModule.dynamic).toBe('force-dynamic');
  });

  it('should render component', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'test', mentorId: 'test' });
    mockUseSelector.mockReturnValue(null);
    render(<UsersPage />);
    expect(screen.getByTestId('analytics-users')).toBeInTheDocument();
  });
});
