import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../empty-state';

describe('EmptyState component', () => {
  it('should render with default message', () => {
    render(<EmptyState />);

    expect(screen.getByText('Sorry, no mentors found!')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<EmptyState message="Custom empty message" />);

    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });

  it('should have correct container structure', () => {
    const { container } = render(<EmptyState />);

    // Check for the outer container
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('flex', 'h-60', 'w-full', 'items-center', 'justify-center');

    // Check for the inner rounded container
    const innerDiv = outerDiv.firstChild as HTMLElement;
    expect(innerDiv).toHaveClass('rounded-lg', 'bg-[#F8F8FB]', 'text-center');
  });
});
