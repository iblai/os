import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '../hover-card';

// HoverCardContent uses a Radix Portal — Radix renders the portal target as
// a descendant of the document body by default in tests, so the content
// becomes queryable through `screen` once the card opens.
function openHoverCard(children: React.ReactNode = 'Content body') {
  render(
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <button>Hover me</button>
      </HoverCardTrigger>
      <HoverCardContent data-testid="hover-content">
        {children}
      </HoverCardContent>
    </HoverCard>,
  );
  const trigger = screen.getByRole('button', { name: 'Hover me' });
  // Radix opens HoverCard on either hover or focus — focus is the most
  // reliable signal in jsdom (which doesn't simulate hover well).
  fireEvent.focus(trigger);
}

describe('HoverCard primitives', () => {
  it('renders trigger before the card is opened', () => {
    render(
      <HoverCard>
        <HoverCardTrigger asChild>
          <button>Open</button>
        </HoverCardTrigger>
        <HoverCardContent>Hidden until open</HoverCardContent>
      </HoverCard>,
    );
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.queryByText('Hidden until open')).not.toBeInTheDocument();
  });

  it('renders content inside a portal when opened', async () => {
    openHoverCard('Visible content');
    expect(await screen.findByText('Visible content')).toBeInTheDocument();
  });

  it('applies the default className to the content', async () => {
    openHoverCard('Styled');
    const content = await screen.findByTestId('hover-content');
    // Sample a few stable class tokens from the base className the
    // primitive applies — full string assertion is brittle, but checking
    // that key tokens are present locks in the styling contract.
    expect(content.className).toContain('rounded-md');
    expect(content.className).toContain('shadow-md');
    expect(content.className).toContain('z-50');
  });

  it('merges custom className with the defaults', async () => {
    render(
      <HoverCard openDelay={0} closeDelay={0}>
        <HoverCardTrigger asChild>
          <button>Trigger</button>
        </HoverCardTrigger>
        <HoverCardContent
          data-testid="hover-content"
          className="custom-hover-class"
        >
          Content
        </HoverCardContent>
      </HoverCard>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Trigger' }));
    const content = await screen.findByTestId('hover-content');
    expect(content).toHaveClass('custom-hover-class');
    expect(content.className).toContain('rounded-md');
  });

  it('forwards refs to the underlying content element', async () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <HoverCard openDelay={0} closeDelay={0}>
        <HoverCardTrigger asChild>
          <button>Trigger</button>
        </HoverCardTrigger>
        <HoverCardContent ref={ref}>Body</HoverCardContent>
      </HoverCard>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Trigger' }));
    await screen.findByText('Body');
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('passes through custom align and sideOffset props', async () => {
    render(
      <HoverCard openDelay={0} closeDelay={0}>
        <HoverCardTrigger asChild>
          <button>Trigger</button>
        </HoverCardTrigger>
        <HoverCardContent
          data-testid="hover-content"
          align="start"
          sideOffset={12}
        >
          Body
        </HoverCardContent>
      </HoverCard>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Trigger' }));
    const content = await screen.findByTestId('hover-content');
    // Radix exposes the resolved alignment via `data-align`. We use it
    // here to verify our align prop actually reached the primitive.
    expect(content.getAttribute('data-align')).toBe('start');
  });

  it('uses the displayName from the Radix primitive', () => {
    // The wrapper preserves Radix's content displayName so React DevTools
    // shows a meaningful component name in the tree.
    expect(HoverCardContent.displayName).toBeTruthy();
  });
});
