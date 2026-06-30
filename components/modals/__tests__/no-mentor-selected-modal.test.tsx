import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import React from 'react';
import { NoMentorSelectedModal } from '../no-mentor-selected-modal';

const mockNavigateToExplore = vi.fn();

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ navigateToExplore: mockNavigateToExplore }),
}));

// Lightweight passthrough mocks for the AlertDialog primitives so the modal
// renders deterministically in jsdom (no radix portal) and the action/cancel
// buttons forward their onClick handlers.
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open?: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
  }: React.ComponentProps<'button'>) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: React.ComponentProps<'button'>) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

describe('NoMentorSelectedModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render content when closed', () => {
    render(<NoMentorSelectedModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('No Agent Selected')).not.toBeInTheDocument();
  });

  it('renders the title, description and actions when open', () => {
    render(<NoMentorSelectedModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText('No Agent Selected')).toBeInTheDocument();
    expect(
      screen.getByText(/select an agent before starting a new chat/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Explore Agents')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('navigates to the tenant-scoped explore page and prevents the default close when Explore Agents is clicked', () => {
    const onClose = vi.fn();
    render(<NoMentorSelectedModal isOpen onClose={onClose} />);

    const action = screen.getByText('Explore Agents');
    const clickEvent = createEvent.click(action);
    const preventDefault = vi.spyOn(clickEvent, 'preventDefault');
    fireEvent(action, clickEvent);

    // Radix's auto-close is suppressed so it can't fire a competing navigation.
    expect(preventDefault).toHaveBeenCalledTimes(1);
    // `true` forces the tenant-scoped /platform/<tenantKey>/explore route.
    expect(mockNavigateToExplore).toHaveBeenCalledWith(true);
    // The route change (a path with no ?modal= param) closes the modal on its
    // own; calling onClose here would push the current path and clobber explore.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without navigating when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<NoMentorSelectedModal isOpen onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigateToExplore).not.toHaveBeenCalled();
  });
});
