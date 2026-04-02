import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Navigation } from '../navigation';

describe('Navigation component', () => {
  it('should render the navigation element', () => {
    const { container } = render(<Navigation />);

    // Check for the nav element
    const navElement = container.querySelector('nav');
    expect(navElement).toBeInTheDocument();
    expect(navElement).toHaveClass(
      'hidden',
      'w-[270px]',
      'border-r',
      'bg-gray-50/40',
      'lg:block',
    );
  });

  it('should render the inner flex container', () => {
    const { container } = render(<Navigation />);

    // Check for the inner div with flex classes
    const innerDiv = container.querySelector('nav > div');
    expect(innerDiv).toBeInTheDocument();
    expect(innerDiv).toHaveClass('flex', 'h-full', 'flex-col', 'gap-2', 'p-4');
  });
});
