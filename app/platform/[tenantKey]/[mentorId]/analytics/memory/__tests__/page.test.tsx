import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockUseSelector = vi.fn();
const mockUseUsername = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('react-redux', () => ({
  useSelector: (selector: any) => mockUseSelector(selector),
}));

// `@/hooks/use-user` is mocked wholesale rather than partially: importing the
// real module pulls in `@/lib/hooks`, which reads `useDispatch` off react-redux
// at module scope — and react-redux is itself mocked here down to `useSelector`.
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsMemoryStats: vi.fn(({ tenantKey, mentorId, userId }) => (
    <div data-testid="analytics-memory">
      <span data-testid="tenant-key">{tenantKey}</span>
      <span data-testid="mentor-id">{mentorId}</span>
      <span data-testid="user-id">{userId}</span>
    </div>
  )),
}));

vi.mock('@/features/analytics/slice', () => ({
  selectSelectedMentor: vi.fn(),
}));

const MemoryPageModule = await import('../page');
const MemoryPage = MemoryPageModule.default;

describe('analytics/memory page', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-a',
      mentorId: 'mentor-1',
    });
    mockUseSelector.mockReturnValue(null);
    mockUseUsername.mockReturnValue('admin-user');
  });

  it('should export dynamic config', () => {
    expect(MemoryPageModule.dynamic).toBe('force-dynamic');
  });

  it('should render component', () => {
    render(<MemoryPage />);
    expect(screen.getByTestId('analytics-memory')).toBeInTheDocument();
  });

  it('falls back to the route mentorId when no mentor is selected', () => {
    render(<MemoryPage />);
    expect(screen.getByTestId('tenant-key')).toHaveTextContent('tenant-a');
    expect(screen.getByTestId('mentor-id')).toHaveTextContent('mentor-1');
    expect(screen.getByTestId('user-id')).toHaveTextContent('admin-user');
  });

  it('prefers the selected mentor unique_id over the route mentorId', () => {
    mockUseSelector.mockReturnValue({ unique_id: 'mentor-selected' });
    render(<MemoryPage />);
    expect(screen.getByTestId('mentor-id')).toHaveTextContent(
      'mentor-selected',
    );
  });
});
