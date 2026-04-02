import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingAccessibilityButton } from '../floating-accessibility-button';

// Mock the accessibility context
const mockSetIsToolbarOpen = vi.fn();
let mockIsToolbarOpen = false;

vi.mock('@/contexts/accessibility-contexts', () => ({
  useAccessibility: () => ({
    isToolbarOpen: mockIsToolbarOpen,
    setIsToolbarOpen: mockSetIsToolbarOpen,
  }),
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className }: any) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      data-testid="accessibility-icon"
    />
  ),
}));

describe('FloatingAccessibilityButton', () => {
  beforeEach(() => {
    mockIsToolbarOpen = false;
    mockSetIsToolbarOpen.mockClear();
  });

  it('renders the button', () => {
    render(<FloatingAccessibilityButton />);
    const button = screen.getByRole('button', {
      name: /open accessibility menu/i,
    });
    expect(button).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<FloatingAccessibilityButton />);
    const button = screen.getByLabelText('Open Accessibility Menu');
    expect(button).toBeInTheDocument();
  });

  it('renders the accessibility icon image', () => {
    render(<FloatingAccessibilityButton />);
    const image = screen.getByTestId('accessibility-icon');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/accessibility-icon.svg');
    expect(image).toHaveAttribute('alt', 'Accessibility');
  });

  it('image has correct dimensions', () => {
    render(<FloatingAccessibilityButton />);
    const image = screen.getByTestId('accessibility-icon');
    expect(image).toHaveAttribute('width', '44');
    expect(image).toHaveAttribute('height', '44');
  });

  it('toggles toolbar from closed to open when clicked', () => {
    mockIsToolbarOpen = false;
    render(<FloatingAccessibilityButton />);
    const button = screen.getByRole('button', {
      name: /open accessibility menu/i,
    });

    fireEvent.click(button);

    expect(mockSetIsToolbarOpen).toHaveBeenCalledWith(true);
    expect(mockSetIsToolbarOpen).toHaveBeenCalledTimes(1);
  });

  it('toggles toolbar from open to closed when clicked', () => {
    mockIsToolbarOpen = true;
    render(<FloatingAccessibilityButton />);
    const button = screen.getByRole('button', {
      name: /open accessibility menu/i,
    });

    fireEvent.click(button);

    expect(mockSetIsToolbarOpen).toHaveBeenCalledWith(false);
    expect(mockSetIsToolbarOpen).toHaveBeenCalledTimes(1);
  });

  it('has correct styling classes', () => {
    render(<FloatingAccessibilityButton />);
    const button = screen.getByRole('button', {
      name: /open accessibility menu/i,
    });

    expect(button.className).toContain('rounded-full');
    expect(button.className).toContain('bg-[#38A1E5]');
    expect(button.className).toContain('hover:bg-[#2E8BC7]');
    expect(button.className).toContain('shadow-lg');
  });

  it('has size icon variant', () => {
    render(<FloatingAccessibilityButton />);
    const button = screen.getByRole('button', {
      name: /open accessibility menu/i,
    });

    // Check for icon size classes (h-14 w-14)
    expect(button.className).toContain('h-14');
    expect(button.className).toContain('w-14');
  });

  it('handles multiple clicks correctly', () => {
    mockIsToolbarOpen = false;
    render(<FloatingAccessibilityButton />);
    const button = screen.getByRole('button', {
      name: /open accessibility menu/i,
    });

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockSetIsToolbarOpen).toHaveBeenCalledTimes(3);
    // First click should toggle to true (from false)
    expect(mockSetIsToolbarOpen).toHaveBeenNthCalledWith(1, true);
  });

  it('button is accessible via keyboard', () => {
    render(<FloatingAccessibilityButton />);
    const button = screen.getByRole('button', {
      name: /open accessibility menu/i,
    });

    // Simulate keyboard navigation
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('image has text-white class for styling', () => {
    render(<FloatingAccessibilityButton />);
    const image = screen.getByTestId('accessibility-icon');
    expect(image).toHaveClass('text-white');
  });

  it('button has transition and hover scale effects', () => {
    render(<FloatingAccessibilityButton />);
    const button = screen.getByRole('button', {
      name: /open accessibility menu/i,
    });

    expect(button.className).toContain('transition-all');
    expect(button.className).toContain('duration-200');
    expect(button.className).toContain('hover:scale-105');
  });
});
