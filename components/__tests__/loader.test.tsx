import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Loader } from '../loader';

describe('Loader component', () => {
  it('should render the loader with correct structure', () => {
    const { container } = render(<Loader />);

    // Check for the outer container
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toBeInTheDocument();
    expect(outerDiv.tagName).toBe('DIV');
    expect(outerDiv).toHaveClass('flex', 'h-full', 'w-full', 'items-center', 'justify-center');
  });

  it('should render the spinner element', () => {
    const { container } = render(<Loader />);

    // Check for the spinner div
    const spinnerDiv = container.querySelector('.animate-spin');
    expect(spinnerDiv).toBeInTheDocument();
    expect(spinnerDiv).toHaveClass('h-16', 'w-16', 'rounded-full', 'border-4');
  });
});
