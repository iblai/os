import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();
const financialSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsFinancialStats: (props: { tenantKey: string }) => {
    financialSpy(props);
    return (
      <div data-testid="analytics-financial">
        <span data-testid="tenant-key">{props.tenantKey}</span>
      </div>
    );
  },
}));

const FinancialPageModule = await import('../page');
const FinancialPage = FinancialPageModule.default;

describe('tenant analytics/financial page', () => {
  it('should export dynamic config', () => {
    expect(FinancialPageModule.dynamic).toBe('force-dynamic');
  });

  it('renders costs for the tenant with no mentor id', () => {
    mockUseParams.mockReturnValue({ tenantKey: 'my-tenant' });

    render(<FinancialPage />);

    expect(screen.getByTestId('tenant-key')).toHaveTextContent('my-tenant');
    const props = financialSpy.mock.calls.at(-1)![0];
    expect(props.mentorId).toBe('');
    expect(props.selectedMentorId).toBeUndefined();
  });
});
