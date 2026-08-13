import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigateToPlatformAnalytics = vi.fn();

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    navigateToPlatformAnalytics: mockNavigateToPlatformAnalytics,
  }),
}));

const { AnalyticsScopeSwitch } = await import('../analytics-scope-switch');

describe('AnalyticsScopeSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the label and describes itself for assistive tech', () => {
    render(<AnalyticsScopeSwitch />);

    const button = screen.getByRole('button', {
      name: 'Switch to platform analytics',
    });
    expect(button).toHaveAttribute('title', 'Switch to platform analytics');
    // The label ships in the DOM even while retracted, so the pill can animate
    // open without a re-render and screen readers still reach the text.
    expect(button).toHaveTextContent('Platform Analytics');
  });

  it('asks the navigation hook for the tenant-wide overview when no tab is open', async () => {
    const user = userEvent.setup();
    render(<AnalyticsScopeSwitch />);

    await user.click(screen.getByRole('button'));

    expect(mockNavigateToPlatformAnalytics).toHaveBeenCalledWith('');
  });

  it('keeps the open tab when switching scope', async () => {
    const user = userEvent.setup();
    render(<AnalyticsScopeSwitch tab="users" />);

    await user.click(screen.getByRole('button'));

    expect(mockNavigateToPlatformAnalytics).toHaveBeenCalledWith('users');
  });

  it('keeps the icon out of the accessible name', () => {
    render(<AnalyticsScopeSwitch />);

    const button = screen.getByRole('button');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // Exact match: the icon must not leak into the name the pill announces.
    expect(
      screen.getByRole('button', { name: 'Switch to platform analytics' }),
    ).toBe(button);
  });

  it('merges the caller className onto the button', () => {
    // The layout floats the pill inside a `pointer-events-none` overlay and
    // relies on this to re-enable clicks on the pill itself.
    render(<AnalyticsScopeSwitch className="pointer-events-auto" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('pointer-events-auto');
    // …without dropping its own styling.
    expect(button).toHaveClass('rounded-full');
  });

  it('does not submit a surrounding form', () => {
    render(<AnalyticsScopeSwitch />);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
