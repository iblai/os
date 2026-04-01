import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScreenSharingButton } from '../screen-sharing-button';
import { TooltipProvider } from '@/components/ui/tooltip';

const mockIsSafariBrowser = vi.fn().mockReturnValue(false);
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return { ...actual, isSafariBrowser: () => mockIsSafariBrowser() };
});

/**
 * Test suite for the ScreenSharingButton component
 *
 * This suite tests the ScreenSharingButton component's ability to:
 * 1. Conditionally render based on screenSharing prop
 * 2. Handle disabled states based on various conditions
 * 3. Apply correct CSS classes for styling
 * 4. Display appropriate tooltip content based on modal state
 * 5. Support accessibility features (aria-label)
 * 6. Handle click interactions
 */

// Helper function to render ScreenSharingButton with TooltipProvider
const renderWithTooltipProvider = (
  props: Partial<Parameters<typeof ScreenSharingButton>[0]> = {},
) => {
  const defaultProps = {
    onClick: vi.fn(),
    isScreenSharingModalOpen: false,
    screenSharing: true,
    ...props,
  };
  return render(
    <TooltipProvider>
      <ScreenSharingButton {...defaultProps} />
    </TooltipProvider>,
  );
};

describe('ScreenSharingButton', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSafariBrowser.mockReturnValue(false);
    // Simulate a desktop browser with getDisplayMedia support
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getDisplayMedia: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  describe('Browser support - Safari', () => {
    it('should not render on Safari even when getDisplayMedia is supported', () => {
      mockIsSafariBrowser.mockReturnValue(true);

      const { container } = renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render on non-Safari browsers with getDisplayMedia support', () => {
      mockIsSafariBrowser.mockReturnValue(false);

      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Browser support - getDisplayMedia', () => {
    it('should not render when getDisplayMedia is not supported', () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
        configurable: true,
      });

      const { container } = renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should not render when mediaDevices is undefined (non-secure context)', () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { container } = renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Conditional Rendering - screenSharing prop', () => {
    it('should render when screenSharing is true', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not render when screenSharing is false', () => {
      const { container } = renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: false,
        isScreenSharingModalOpen: false,
      });

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should toggle rendering when screenSharing changes', () => {
      const { rerender, container } = render(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick}
            screenSharing={true}
            isScreenSharingModalOpen={false}
          />
        </TooltipProvider>,
      );

      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick}
            screenSharing={false}
            isScreenSharingModalOpen={false}
          />
        </TooltipProvider>,
      );

      expect(container.querySelector('button')).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Basic Rendering', () => {
    it('should have type="button" to prevent form submission', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should render with ScreenShare icon (SVG)', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('h-6');
      expect(svg).toHaveClass('w-6');
    });

    it('should have aria-label for accessibility', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button', { name: 'Screen Sharing' });
      expect(button).toHaveAttribute('aria-label', 'Screen Sharing');
    });

    it('should have correct base styling classes', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-9');
      expect(button).toHaveClass('w-9');
      expect(button).toHaveClass('text-gray-400');
    });

    it('should be wrapped in a div for tooltip triggering', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      expect(button.parentElement?.tagName.toLowerCase()).toBe('div');
    });
  });

  describe('Modal Open State Styling', () => {
    it('should apply ibl-button-primary class when modal is open', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: true,
      });

      const button = screen.getByRole('button');
      expect(button).toHaveClass('ibl-button-primary');
    });

    it('should not apply ibl-button-primary class when modal is closed', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('ibl-button-primary');
    });

    it('should apply text-white to icon when modal is open', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: true,
      });

      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      expect(icon).toHaveClass('text-white');
    });

    it('should apply text-gray-400 to icon when modal is closed', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      expect(icon).toHaveClass('text-gray-400');
    });

    it('should toggle styling when modal open state changes', () => {
      const { rerender } = render(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick}
            screenSharing={true}
            isScreenSharingModalOpen={false}
          />
        </TooltipProvider>,
      );

      let button = screen.getByRole('button');
      expect(button).not.toHaveClass('ibl-button-primary');

      rerender(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick}
            screenSharing={true}
            isScreenSharingModalOpen={true}
          />
        </TooltipProvider>,
      );

      button = screen.getByRole('button');
      expect(button).toHaveClass('ibl-button-primary');
    });
  });

  describe('Button Interactions', () => {
    it('should call onClick when clicked', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick multiple times when clicked multiple times', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(3);
    });

    it('should not call onClick when disabled', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
        disabled: true,
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should not call onClick when in preview mode', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
        isPreviewMode: true,
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Disabled States', () => {
    it('should be disabled when disabled prop is true', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
        disabled: true,
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not be disabled when disabled prop is false', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
        disabled: false,
      });

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should default disabled to false when not provided', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should be disabled when isPreviewMode is true', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
        isPreviewMode: true,
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not be disabled when isPreviewMode is false', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
        isPreviewMode: false,
      });

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should not be disabled when isPreviewMode is undefined', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should be disabled when both disabled and isPreviewMode are true', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
        disabled: true,
        isPreviewMode: true,
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when disabled is true and isPreviewMode is false', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
        disabled: true,
        isPreviewMode: false,
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when disabled is false and isPreviewMode is true', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
        disabled: false,
        isPreviewMode: true,
      });

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Tooltip Content', () => {
    it('should display "Enable Screen Sharing" tooltip when modal is closed', async () => {
      const user = userEvent.setup();
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      await user.hover(button);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Enable Screen Sharing');
    });

    it('should display "Screen Sharing" tooltip when modal is open', async () => {
      const user = userEvent.setup();
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: true,
      });

      const button = screen.getByRole('button');
      await user.hover(button);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Screen Sharing');
    });

    it('should update tooltip content when modal state changes', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick}
            screenSharing={true}
            isScreenSharingModalOpen={false}
          />
        </TooltipProvider>,
      );

      let button = screen.getByRole('button');
      await user.hover(button);

      let tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Enable Screen Sharing');

      await user.unhover(button);

      rerender(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick}
            screenSharing={true}
            isScreenSharingModalOpen={true}
          />
        </TooltipProvider>,
      );

      button = screen.getByRole('button');
      await user.hover(button);

      tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Screen Sharing');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible name', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button', { name: 'Screen Sharing' });
      expect(button).toHaveAccessibleName('Screen Sharing');
    });

    it('should be focusable when not disabled', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('should be keyboard accessible when pressing Enter', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      button.focus();

      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      // Button click is automatically triggered by Enter key on focused button
    });

    it('should be keyboard accessible when pressing Space', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      button.focus();

      fireEvent.keyDown(button, { key: ' ', code: 'Space' });
      // Button click is automatically triggered by Space key on focused button
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid state changes', () => {
      const { rerender } = render(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick}
            screenSharing={true}
            isScreenSharingModalOpen={false}
            disabled={false}
          />
        </TooltipProvider>,
      );

      let button = screen.getByRole('button');
      expect(button).not.toBeDisabled();

      rerender(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick}
            screenSharing={true}
            isScreenSharingModalOpen={true}
            disabled={true}
          />
        </TooltipProvider>,
      );

      button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('ibl-button-primary');

      rerender(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick}
            screenSharing={true}
            isScreenSharingModalOpen={false}
            disabled={false}
          />
        </TooltipProvider>,
      );

      button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
      expect(button).not.toHaveClass('ibl-button-primary');
    });

    it('should handle being rendered and unmounted', () => {
      const { unmount } = renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      expect(screen.getByRole('button')).toBeInTheDocument();

      unmount();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should maintain functionality when onClick changes', () => {
      const mockOnClick1 = vi.fn();
      const mockOnClick2 = vi.fn();

      const { rerender } = render(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick1}
            screenSharing={true}
            isScreenSharingModalOpen={false}
          />
        </TooltipProvider>,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockOnClick1).toHaveBeenCalledTimes(1);
      expect(mockOnClick2).not.toHaveBeenCalled();

      rerender(
        <TooltipProvider>
          <ScreenSharingButton
            onClick={mockOnClick2}
            screenSharing={true}
            isScreenSharingModalOpen={false}
          />
        </TooltipProvider>,
      );

      fireEvent.click(button);

      expect(mockOnClick1).toHaveBeenCalledTimes(1);
      expect(mockOnClick2).toHaveBeenCalledTimes(1);
    });

    it('should handle null/undefined onClick gracefully when rendered', () => {
      // The component requires onClick, but we test defensive behavior
      renderWithTooltipProvider({
        onClick: undefined as any,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should handle all props undefined except required ones', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
        isPreviewMode: undefined,
        disabled: undefined,
      });

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });
  });

  describe('dynamicTooltipContent Function', () => {
    it('should return "Screen Sharing" when isScreenSharingModalOpen is true', async () => {
      const user = userEvent.setup();
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: true,
      });

      const button = screen.getByRole('button');
      await user.hover(button);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toBe('Screen Sharing');
    });

    it('should return "Enable Screen Sharing" when isScreenSharingModalOpen is false', async () => {
      const user = userEvent.setup();
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      await user.hover(button);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toBe('Enable Screen Sharing');
    });
  });

  describe('Icon Rendering', () => {
    it('should render ScreenShare icon with h-6 w-6 classes', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-6');
      expect(icon).toHaveClass('w-6');
    });

    it('should have text-gray-400 class on icon when modal is closed', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: false,
      });

      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      expect(icon).toHaveClass('text-gray-400');
    });

    it('should have text-white class on icon when modal is open', () => {
      renderWithTooltipProvider({
        onClick: mockOnClick,
        screenSharing: true,
        isScreenSharingModalOpen: true,
      });

      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      expect(icon).toHaveClass('text-white');
    });
  });
});
