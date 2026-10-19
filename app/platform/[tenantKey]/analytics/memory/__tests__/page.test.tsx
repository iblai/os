import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();
const memorySpy = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsMemoryStats: (props: { tenantKey: string; userId?: string }) => {
    memorySpy(props);
    return (
      <div data-testid="analytics-memory">
        <span data-testid="tenant-key">{props.tenantKey}</span>
        <span data-testid="user-id">{props.userId}</span>
      </div>
    );
  },
}));

const MemoryPageModule = await import('../page');
const MemoryPage = MemoryPageModule.default;

describe('tenant analytics/memory page', () => {
  it('should export dynamic config', () => {
    expect(MemoryPageModule.dynamic).toBe('force-dynamic');
  });

  it('renders memories for the tenant with no mentor id', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });
    mockUseUsername.mockReturnValue('testuser');

    render(<MemoryPage />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
    expect(screen.getByTestId('user-id')).toHaveTextContent('testuser');
    const props = memorySpy.mock.calls.at(-1)![0];
    expect(props.mentorId).toBe('');
  });
});
