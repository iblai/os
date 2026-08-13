import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const { AnalyticsScopeSwitch } = await import('../analytics-scope-switch');

describe('AnalyticsScopeSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the label and describes itself for assistive tech', () => {
    render(<AnalyticsScopeSwitch tenantKey="test-tenant" />);

    const button = screen.getByRole('button', {
      name: 'Switch to platform analytics',
    });
    expect(button).toHaveAttribute('title', 'Switch to platform analytics');
    // The label ships in the DOM even while retracted, so the pill can animate
    // open without a re-render and screen readers still reach the text.
    expect(button).toHaveTextContent('Platform analytics');
  });

  it('navigates to the tenant-wide overview when no tab is open', async () => {
    const user = userEvent.setup();
    render(<AnalyticsScopeSwitch tenantKey="test-tenant" />);

    await user.click(screen.getByRole('button'));

    expect(mockPush).toHaveBeenCalledWith('/platform/test-tenant/analytics');
  });

  it('keeps the open tab when switching scope', async () => {
    const user = userEvent.setup();
    render(<AnalyticsScopeSwitch tenantKey="test-tenant" tab="users" />);

    await user.click(screen.getByRole('button'));

    expect(mockPush).toHaveBeenCalledWith(
      '/platform/test-tenant/analytics/users',
    );
  });
});
