import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const usersSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsUsersStats: (props: { tenantKey: string }) => {
    usersSpy(props);
    return (
      <div data-testid="analytics-users">
        <span data-testid="tenant-key">{props.tenantKey}</span>
      </div>
    );
  },
}));

const UsersPageModule = await import('../page');
const UsersPage = UsersPageModule.default;

describe('tenant analytics/users page', () => {
  it('should export dynamic config', () => {
    expect(UsersPageModule.dynamic).toBe('force-dynamic');
  });

  it('renders user stats for the tenant with no mentor id', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });

    render(<UsersPage />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
    const props = usersSpy.mock.calls.at(-1)![0];
    expect(props.mentorId).toBe('');
    expect(props.selectedMentorId).toBeUndefined();
  });
});
