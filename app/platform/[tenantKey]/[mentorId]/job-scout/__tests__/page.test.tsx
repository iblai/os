import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div data-testid="avatar">{children}</div>,
  AvatarImage: () => null,
  AvatarFallback: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Send: () => <span>Send</span>,
}));

const JobScoutPageModule = await import('../page');
const JobScoutPage = JobScoutPageModule.default;

describe('job-scout page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should export dynamic config', () => {
    expect(JobScoutPageModule.dynamic).toBe('force-dynamic');
  });

  it('should render initial state', () => {
    render(<JobScoutPage />);
    expect(screen.getByRole('heading', { name: /AI Job Scout Assistant/i })).toBeInTheDocument();
  });

  it('should render suggestion cards', () => {
    render(<JobScoutPage />);
    expect(screen.getByText(/improve my presentation skills/i)).toBeInTheDocument();
  });

  it('should handle prompt click', async () => {
    render(<JobScoutPage />);
    const card = screen.getByText(/improve my presentation skills/i);
    fireEvent.click(card);

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(/Improving presentation skills/i)).toBeInTheDocument();
  });
});
