import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';

import { MemoryButton } from '../memory-button';

// Mock the nested MemoryMenu so these tests focus on the button's
// open/close behaviour and prop forwarding, not the menu internals.
vi.mock('../memory-menu', () => ({
  MemoryMenu: ({ onClose, tenantKey, username }: any) => (
    <div data-testid="memory-menu">
      <span data-testid="memory-menu-tenant">{tenantKey ?? ''}</span>
      <span data-testid="memory-menu-username">{username ?? ''}</span>
      <button data-testid="memory-menu-close" onClick={onClose}>
        close-from-menu
      </button>
    </div>
  ),
}));

// Radix Popover renders its content into a portal; these stubs keep
// everything in the test root and expose open state on the trigger.
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ open, onOpenChange, children }: any) => (
    <div data-testid="popover" data-state={open ? 'open' : 'closed'}>
      {React.Children.map(children, (child: any) =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              __open: open,
              __onOpenChange: onOpenChange,
            } as any)
          : child,
      )}
    </div>
  ),
  PopoverTrigger: ({ children, __onOpenChange }: any) => {
    const child = React.Children.only(children);
    return React.cloneElement(child, {
      onClick: () => __onOpenChange?.(true),
    });
  },
  PopoverContent: ({ children, __open }: any) =>
    __open ? <div data-testid="popover-content">{children}</div> : null,
}));

describe('MemoryButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the Memory label and is closed by default', () => {
    render(<MemoryButton />);

    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByTestId('popover')).toHaveAttribute(
      'data-state',
      'closed',
    );
    expect(screen.queryByTestId('memory-menu')).not.toBeInTheDocument();
  });

  it('opens the popover with MemoryMenu when the trigger is clicked', () => {
    render(<MemoryButton tenantKey="org-1" username="alice" />);

    fireEvent.click(screen.getByRole('button', { name: /memory/i }));

    const menu = screen.getByTestId('memory-menu');
    expect(menu).toBeInTheDocument();
    expect(within(menu).getByTestId('memory-menu-tenant').textContent).toBe(
      'org-1',
    );
    expect(within(menu).getByTestId('memory-menu-username').textContent).toBe(
      'alice',
    );
    expect(screen.getByTestId('popover')).toHaveAttribute('data-state', 'open');
  });

  it('shows the inline close affordance once opened', () => {
    render(<MemoryButton />);

    fireEvent.click(screen.getByRole('button', { name: /memory/i }));

    // The X icon inside the trigger is rendered only while the popover
    // is open; it's still the same Button (name: Memory), but now
    // contains an additional svg.
    const trigger = screen.getByRole('button', { name: /memory/i });
    const svgs = trigger.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('closes via the MemoryMenu onClose callback', () => {
    render(<MemoryButton />);

    fireEvent.click(screen.getByRole('button', { name: /memory/i }));
    expect(screen.getByTestId('popover')).toHaveAttribute('data-state', 'open');

    fireEvent.click(screen.getByTestId('memory-menu-close'));
    expect(screen.getByTestId('popover')).toHaveAttribute(
      'data-state',
      'closed',
    );
    expect(screen.queryByTestId('memory-menu')).not.toBeInTheDocument();
  });

  it('closes via the inline X icon onClick handler', () => {
    render(<MemoryButton />);

    fireEvent.click(screen.getByRole('button', { name: /memory/i }));
    expect(screen.getByTestId('popover')).toHaveAttribute('data-state', 'open');

    // The X icon rendered inside the trigger while open has its own
    // onClick (stops propagation + closes). It's the second svg in
    // the button's subtree.
    const trigger = screen.getByRole('button', { name: /memory/i });
    const xIcon = trigger.querySelectorAll('svg')[1]!;
    fireEvent.click(xIcon);

    expect(screen.getByTestId('popover')).toHaveAttribute(
      'data-state',
      'closed',
    );
  });

  it('forwards undefined tenantKey and username to MemoryMenu when omitted', () => {
    render(<MemoryButton />);

    fireEvent.click(screen.getByRole('button', { name: /memory/i }));

    expect(screen.getByTestId('memory-menu-tenant').textContent).toBe('');
    expect(screen.getByTestId('memory-menu-username').textContent).toBe('');
  });
});
