import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const mockDisabledAnalyticsReports = vi.fn();
const reportsSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/lib/config', () => ({
  config: {
    disabledAnalyticsReports: () => mockDisabledAnalyticsReports(),
  },
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsReports: (props: { tenantKey: string }) => {
    reportsSpy(props);
    return (
      <div data-testid="analytics-reports">
        <span data-testid="tenant-key">{props.tenantKey}</span>
      </div>
    );
  },
}));

const ReportsPageModule = await import('../page');
const ReportsPage = ReportsPageModule.default;

describe('tenant analytics/reports page', () => {
  it('should export dynamic config', () => {
    expect(ReportsPageModule.dynamic).toBe('force-dynamic');
  });

  it('renders reports for the tenant with no mentor id', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });
    mockDisabledAnalyticsReports.mockReturnValue('');

    render(<ReportsPage />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
    const props = reportsSpy.mock.calls.at(-1)![0];
    expect(props.selectedMentorId).toBe('');
    expect(props.selectedMentorDbId).toBeUndefined();
  });

  it('passes the disabled reports from config', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });
    mockDisabledAnalyticsReports.mockReturnValue('one|two');

    render(<ReportsPage />);

    expect(reportsSpy.mock.calls.at(-1)![0].disabledReports).toEqual([
      'one',
      'two',
    ]);
  });
});
