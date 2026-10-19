import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const overviewSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsOverview: (props: { tenantKey: string }) => {
    overviewSpy(props);
    return (
      <div data-testid="analytics-overview">
        <span data-testid="tenant-key">{props.tenantKey}</span>
      </div>
    );
  },
}));

const TenantAnalyticsPageModule = await import('../page');
const TenantAnalyticsPage = TenantAnalyticsPageModule.default;

describe('tenant analytics page', () => {
  it('should export dynamic config', () => {
    expect(TenantAnalyticsPageModule.dynamic).toBe('force-dynamic');
  });

  it('renders the overview for the tenant', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });

    render(<TenantAnalyticsPage />);

    expect(screen.getByTestId('analytics-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
  });

  it('passes an empty mentor id so stats stay tenant-wide', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });

    render(<TenantAnalyticsPage />);

    const props = overviewSpy.mock.calls.at(-1)![0];
    expect(props.mentorId).toBe('');
    expect(props.selectedMentorId).toBeUndefined();
  });
});
