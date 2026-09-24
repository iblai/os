import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../empty-state';

describe('EmptyState component', () => {
  it('should render with default message', () => {
    render(<EmptyState />);

    expect(screen.getByText('Sorry, no agents found!')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<EmptyState message="Custom empty message" />);

    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });

  it('should render a hint under the message when given', () => {
    render(<EmptyState hint="Try a different search term." />);

    expect(screen.getByText('Sorry, no agents found!')).toBeInTheDocument();
    expect(
      screen.getByText('Try a different search term.'),
    ).toBeInTheDocument();
  });

  it('should not render a hint when none is given', () => {
    const { container } = render(<EmptyState />);

    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
