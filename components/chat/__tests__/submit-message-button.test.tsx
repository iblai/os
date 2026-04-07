import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmitMessageButton } from '../submit-message-button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CSS_CLASS_NAMES } from '@/lib/constants';

/**
 * Test suite for the SubmitMessageButton component
 *
 * This suite tests the SubmitMessageButton component's ability to:
 * 1. Render correctly with default and custom props
 * 2. Handle disabled states based on various conditions
 * 3. Apply correct CSS classes for styling and animations
 * 4. Display appropriate tooltip content
 * 5. Support accessibility features (aria-label, screen reader text)
 */

// Helper function to render SubmitMessageButton with TooltipProvider
const renderWithTooltipProvider = (
  props: Parameters<typeof SubmitMessageButton>[0] = {},
) => {
  return render(
    <TooltipProvider>
      <SubmitMessageButton {...props} />
    </TooltipProvider>,
  );
};

describe('SubmitMessageButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeInTheDocument();
    });

    it('should render with submit type', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should render with aria-label for accessibility', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveAttribute('aria-label', 'Send message');
    });

    it('should render screen reader text', () => {
      renderWithTooltipProvider();

      const srText = screen.getByText('Send message');
      expect(srText).toHaveClass('sr-only');
    });

    it('should render the ArrowUp icon with aria-hidden', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should apply the correct CSS class name from constants', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveClass(CSS_CLASS_NAMES.CHAT.SUBMIT_MESSAGE_BUTTON);
    });

    it('should apply gradient background styling', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveClass('bg-gradient-to-r');
      expect(button).toHaveClass('from-[#2563EB]');
      expect(button).toHaveClass('to-[#93C5FD]');
    });

    it('should have correct size classes', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveClass('h-9');
      expect(button).toHaveClass('w-9');
      expect(button).toHaveClass('rounded-lg');
    });

    it('should have hover opacity class', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveClass('hover:opacity-90');
    });
  });

  describe('Disabled State - disabled prop', () => {
    it('should not be disabled by default when disabled prop is false', () => {
      renderWithTooltipProvider({ disabled: false });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toBeDisabled();
    });

    it('should be disabled when disabled prop is true', () => {
      renderWithTooltipProvider({ disabled: true });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeDisabled();
    });

    it('should default disabled to false when not provided', () => {
      renderWithTooltipProvider({});

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toBeDisabled();
    });
  });

  describe('Disabled State - Preview Mode Logic', () => {
    it('should be disabled when isPreviewMode is true and allowAnonymousAccess is false', () => {
      renderWithTooltipProvider({
        isPreviewMode: true,
        allowAnonymousAccess: false,
      });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeDisabled();
    });

    it('should be disabled when isPreviewMode is true and allowAnonymousAccess is undefined', () => {
      renderWithTooltipProvider({ isPreviewMode: true });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeDisabled();
    });

    it('should not be disabled when isPreviewMode is true but allowAnonymousAccess is true', () => {
      renderWithTooltipProvider({
        isPreviewMode: true,
        allowAnonymousAccess: true,
      });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toBeDisabled();
    });

    it('should not be disabled when isPreviewMode is false', () => {
      renderWithTooltipProvider({
        isPreviewMode: false,
        allowAnonymousAccess: false,
      });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toBeDisabled();
    });

    it('should not be disabled when isPreviewMode is undefined', () => {
      renderWithTooltipProvider({ allowAnonymousAccess: false });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toBeDisabled();
    });
  });

  describe('Disabled State - isUploading', () => {
    it('should be disabled when isUploading is true', () => {
      renderWithTooltipProvider({ isUploading: true });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeDisabled();
    });

    it('should not be disabled when isUploading is false', () => {
      renderWithTooltipProvider({ isUploading: false });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toBeDisabled();
    });

    it('should not be disabled when isUploading is undefined', () => {
      renderWithTooltipProvider({});

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toBeDisabled();
    });

    it('should apply uploading styles when isUploading is true', () => {
      renderWithTooltipProvider({ isUploading: true });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveClass('opacity-50');
      expect(button).toHaveClass('cursor-not-allowed');
    });

    it('should not apply uploading styles when isUploading is false', () => {
      renderWithTooltipProvider({ isUploading: false });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toHaveClass('opacity-50');
      expect(button).not.toHaveClass('cursor-not-allowed');
    });
  });

  describe('Combined Disabled States', () => {
    it('should be disabled when disabled is true even if other conditions allow', () => {
      renderWithTooltipProvider({
        disabled: true,
        isPreviewMode: false,
        allowAnonymousAccess: true,
        isUploading: false,
      });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeDisabled();
    });

    it('should be disabled when both isPreviewMode (without anonymous) and isUploading are true', () => {
      renderWithTooltipProvider({
        isPreviewMode: true,
        allowAnonymousAccess: false,
        isUploading: true,
      });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeDisabled();
    });

    it('should be disabled when all disabling conditions are true', () => {
      renderWithTooltipProvider({
        disabled: true,
        isPreviewMode: true,
        allowAnonymousAccess: false,
        isUploading: true,
      });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeDisabled();
    });

    it('should not be disabled when all conditions are permissive', () => {
      renderWithTooltipProvider({
        disabled: false,
        isPreviewMode: false,
        allowAnonymousAccess: true,
        isUploading: false,
      });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toBeDisabled();
    });

    it('should not be disabled when isPreviewMode is true with allowAnonymousAccess true and other conditions allow', () => {
      renderWithTooltipProvider({
        disabled: false,
        isPreviewMode: true,
        allowAnonymousAccess: true,
        isUploading: false,
      });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toBeDisabled();
    });
  });

  describe('Tooltip Content', () => {
    it('should display "Send Message" tooltip when not uploading', async () => {
      const user = userEvent.setup();
      renderWithTooltipProvider({ isUploading: false });

      const button = screen.getByRole('button', { name: 'Send message' });

      // Hover over the button to trigger tooltip
      await user.hover(button);

      // Wait for tooltip to appear
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Send Message');
    });

    it('should display "Uploading Files" tooltip when uploading', async () => {
      const user = userEvent.setup();
      renderWithTooltipProvider({ isUploading: true });

      const button = screen.getByRole('button', { name: 'Send message' });

      // Hover over the button to trigger tooltip
      await user.hover(button);

      // Wait for tooltip to appear
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Uploading Files');
    });

    it('should render tooltip content with proper styling classes', async () => {
      const user = userEvent.setup();
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      await user.hover(button);

      // Verify tooltip appears and has text content
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip.textContent).toContain('Send Message');
    });
  });

  describe('Accessibility', () => {
    it('should be focusable when not disabled', () => {
      renderWithTooltipProvider({ disabled: false });

      const button = screen.getByRole('button', { name: 'Send message' });
      button.focus();
      expect(button).toHaveFocus();
    });

    it('should have descriptive aria-label', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveAccessibleName('Send message');
    });

    it('should have icon hidden from screen readers', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      const svg = button.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have visually hidden text for screen readers', () => {
      renderWithTooltipProvider();

      const srText = screen.getByText('Send message');
      expect(srText).toBeInTheDocument();
      expect(srText.tagName.toLowerCase()).toBe('span');
      expect(srText).toHaveClass('sr-only');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid prop changes', () => {
      const { rerender } = renderWithTooltipProvider({ disabled: false });

      let button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toBeDisabled();

      rerender(
        <TooltipProvider>
          <SubmitMessageButton disabled={true} />
        </TooltipProvider>,
      );

      button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeDisabled();

      rerender(
        <TooltipProvider>
          <SubmitMessageButton disabled={false} isUploading={true} />
        </TooltipProvider>,
      );

      button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50');
    });

    it('should render correctly with all props undefined', () => {
      renderWithTooltipProvider({
        isPreviewMode: undefined,
        allowAnonymousAccess: undefined,
        isUploading: undefined,
        disabled: undefined,
      });

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('should be wrapped in a div for tooltip triggering', () => {
      renderWithTooltipProvider();

      // The button should be wrapped in a div (required for tooltip trigger on disabled elements)
      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button.parentElement?.tagName.toLowerCase()).toBe('div');
    });

    it('should render within form context correctly', () => {
      render(
        <TooltipProvider>
          <form data-testid="test-form">
            <SubmitMessageButton />
          </form>
        </TooltipProvider>,
      );

      const form = screen.getByTestId('test-form');
      const button = screen.getByRole('button', { name: 'Send message' });
      expect(form).toContainElement(button);
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should handle boolean-like falsy values correctly', () => {
      // Test with explicit false values
      renderWithTooltipProvider({
        isPreviewMode: false,
        allowAnonymousAccess: false,
        isUploading: false,
        disabled: false,
      });

      const button = screen.getByRole('button', { name: 'Send message' });
      // Should not be disabled because isPreviewMode is false
      expect(button).not.toBeDisabled();
    });
  });

  describe('CSS Class Application', () => {
    it('should have consistent base classes', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveClass('h-9');
      expect(button).toHaveClass('w-9');
      expect(button).toHaveClass('rounded-lg');
      expect(button).toHaveClass('bg-gradient-to-r');
      expect(button).toHaveClass('from-[#2563EB]');
      expect(button).toHaveClass('to-[#93C5FD]');
      expect(button).toHaveClass('hover:opacity-90');
      expect(button).toHaveClass(CSS_CLASS_NAMES.CHAT.SUBMIT_MESSAGE_BUTTON);
    });

    it('should conditionally apply uploading classes', () => {
      const { rerender } = renderWithTooltipProvider({ isUploading: false });

      let button = screen.getByRole('button', { name: 'Send message' });
      expect(button).not.toHaveClass('opacity-50');
      expect(button).not.toHaveClass('cursor-not-allowed');

      rerender(
        <TooltipProvider>
          <SubmitMessageButton isUploading={true} />
        </TooltipProvider>,
      );

      button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveClass('opacity-50');
      expect(button).toHaveClass('cursor-not-allowed');
    });
  });

  describe('Icon Rendering', () => {
    it('should render ArrowUp icon with correct classes', () => {
      renderWithTooltipProvider();

      const button = screen.getByRole('button', { name: 'Send message' });
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-5');
      expect(icon).toHaveClass('w-5');
      expect(icon).toHaveClass('text-white');
    });
  });
});

/**
 * Test suite for the SubmitMessageButton component
 *
 * This component renders a submit button for sending messages in the chat.
 * It handles various states:
 * 1. Normal state - enabled and clickable
 * 2. Preview mode without anonymous access - disabled
 * 3. Uploading state - disabled with "Uploading Files" tooltip
 * 4. Combinations of these states
 */

describe('SubmitMessageButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<SubmitMessageButton />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render a submit button', () => {
      render(<SubmitMessageButton />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should have aria-label for accessibility', () => {
      render(<SubmitMessageButton />);

      const button = screen.getByRole('button', { name: /send message/i });
      expect(button).toBeInTheDocument();
    });

    it('should render the ArrowUp icon', () => {
      const { container } = render(<SubmitMessageButton />);

      // Check for SVG element (the ArrowUp icon)
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('h-5', 'w-5', 'text-white');
    });

    it('should have screen reader only text', () => {
      render(<SubmitMessageButton />);

      const srText = screen.getByText('Send message');
      expect(srText).toHaveClass('sr-only');
    });

    it('should apply correct base CSS classes', () => {
      render(<SubmitMessageButton />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-9', 'w-9', 'rounded-lg');
      expect(button).toHaveClass(CSS_CLASS_NAMES.CHAT.SUBMIT_MESSAGE_BUTTON);
    });

    it('should have gradient background styling', () => {
      render(<SubmitMessageButton />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gradient-to-r');
    });
  });

  describe('Default State (All Props False/Undefined)', () => {
    it('should be enabled by default', () => {
      render(<SubmitMessageButton />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should not have disabled styling', () => {
      render(<SubmitMessageButton />);

      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('opacity-50');
      expect(button).not.toHaveClass('cursor-not-allowed');
    });

    it('should show "Send Message" tooltip', async () => {
      const user = userEvent.setup();
      render(<SubmitMessageButton />);

      // Hover over the button to trigger tooltip
      const button = screen.getByRole('button');
      await user.hover(button);

      // Check tooltip content is in the document (may be duplicated in visible + sr-only)
      const tooltips = await screen.findAllByText('Send Message');
      expect(tooltips.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Preview Mode', () => {
    it('should be disabled when isPreviewMode is true and allowAnonymousAccess is false', () => {
      render(
        <SubmitMessageButton
          isPreviewMode={true}
          allowAnonymousAccess={false}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when isPreviewMode is true and allowAnonymousAccess is undefined', () => {
      render(<SubmitMessageButton isPreviewMode={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be enabled when isPreviewMode is true but allowAnonymousAccess is true', () => {
      render(
        <SubmitMessageButton
          isPreviewMode={true}
          allowAnonymousAccess={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should be enabled when isPreviewMode is false', () => {
      render(<SubmitMessageButton isPreviewMode={false} />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should be enabled when isPreviewMode is undefined', () => {
      render(<SubmitMessageButton allowAnonymousAccess={false} />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Uploading State', () => {
    it('should be disabled when isUploading is true', () => {
      render(<SubmitMessageButton isUploading={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should have disabled styling when uploading', () => {
      render(<SubmitMessageButton isUploading={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('opacity-50');
      expect(button).toHaveClass('cursor-not-allowed');
    });

    it('should show "Uploading Files" tooltip when uploading', async () => {
      const user = userEvent.setup();
      render(<SubmitMessageButton isUploading={true} />);

      const button = screen.getByRole('button');
      await user.hover(button);

      const tooltips = await screen.findAllByText('Uploading Files');
      expect(tooltips.length).toBeGreaterThanOrEqual(1);
    });

    it('should be enabled when isUploading is false', () => {
      render(<SubmitMessageButton isUploading={false} />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Tooltip Priority', () => {
    it('should show "Uploading Files" when isUploading is true', async () => {
      const user = userEvent.setup();
      render(<SubmitMessageButton isUploading={true} />);

      const button = screen.getByRole('button');
      await user.hover(button);

      const tooltips = await screen.findAllByText('Uploading Files');
      expect(tooltips.length).toBeGreaterThanOrEqual(1);
    });

    it('should show "Send Message" when isUploading is false', async () => {
      const user = userEvent.setup();
      render(<SubmitMessageButton isUploading={false} />);

      const button = screen.getByRole('button');
      await user.hover(button);

      const tooltips = await screen.findAllByText('Send Message');
      expect(tooltips.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Combined States', () => {
    it('should be disabled when isPreviewMode=true, allowAnonymousAccess=false, and isUploading=true', () => {
      render(
        <SubmitMessageButton
          isPreviewMode={true}
          allowAnonymousAccess={false}
          isUploading={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when isPreviewMode=true, allowAnonymousAccess=true, but isUploading=true', () => {
      render(
        <SubmitMessageButton
          isPreviewMode={true}
          allowAnonymousAccess={true}
          isUploading={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be enabled when isPreviewMode=true, allowAnonymousAccess=true, isUploading=false', () => {
      render(
        <SubmitMessageButton
          isPreviewMode={true}
          allowAnonymousAccess={true}
          isUploading={false}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should be disabled when all disabling conditions are true', () => {
      render(
        <SubmitMessageButton
          isPreviewMode={true}
          allowAnonymousAccess={false}
          isUploading={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should have opacity styling when isUploading is true but isPreviewMode logic would not disable', () => {
      render(<SubmitMessageButton isPreviewMode={false} isUploading={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('opacity-50');
    });
  });

  describe('Disabled State Logic', () => {
    describe('isDisabled calculation: (isPreviewMode && !allowAnonymousAccess) || isUploading', () => {
      // Truth table for isDisabled
      const testCases = [
        {
          isPreviewMode: false,
          allowAnonymousAccess: false,
          isUploading: false,
          expected: false,
        },
        {
          isPreviewMode: false,
          allowAnonymousAccess: false,
          isUploading: true,
          expected: true,
        },
        {
          isPreviewMode: false,
          allowAnonymousAccess: true,
          isUploading: false,
          expected: false,
        },
        {
          isPreviewMode: false,
          allowAnonymousAccess: true,
          isUploading: true,
          expected: true,
        },
        {
          isPreviewMode: true,
          allowAnonymousAccess: false,
          isUploading: false,
          expected: true,
        },
        {
          isPreviewMode: true,
          allowAnonymousAccess: false,
          isUploading: true,
          expected: true,
        },
        {
          isPreviewMode: true,
          allowAnonymousAccess: true,
          isUploading: false,
          expected: false,
        },
        {
          isPreviewMode: true,
          allowAnonymousAccess: true,
          isUploading: true,
          expected: true,
        },
      ];

      testCases.forEach(
        ({ isPreviewMode, allowAnonymousAccess, isUploading, expected }) => {
          it(`should ${expected ? 'be disabled' : 'be enabled'} when isPreviewMode=${isPreviewMode}, allowAnonymousAccess=${allowAnonymousAccess}, isUploading=${isUploading}`, () => {
            render(
              <SubmitMessageButton
                isPreviewMode={isPreviewMode}
                allowAnonymousAccess={allowAnonymousAccess}
                isUploading={isUploading}
              />,
            );

            const button = screen.getByRole('button');
            if (expected) {
              expect(button).toBeDisabled();
            } else {
              expect(button).not.toBeDisabled();
            }
          });
        },
      );
    });
  });

  describe('CSS Styling', () => {
    it('should not have opacity styling when enabled', () => {
      render(<SubmitMessageButton />);

      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('opacity-50');
      expect(button).not.toHaveClass('cursor-not-allowed');
    });

    it('should have opacity styling only when isUploading', () => {
      const { rerender } = render(
        <SubmitMessageButton
          isPreviewMode={true}
          allowAnonymousAccess={false}
        />,
      );

      // Preview mode without anonymous access disables button but doesn't add opacity class
      let button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).not.toHaveClass('opacity-50');

      // Now with uploading
      rerender(<SubmitMessageButton isUploading={true} />);
      button = screen.getByRole('button');
      expect(button).toHaveClass('opacity-50');
    });
  });

  describe('Tooltip Component', () => {
    it('should render tooltip content with correct CSS class', async () => {
      const user = userEvent.setup();
      const { container } = render(<SubmitMessageButton />);

      const button = screen.getByRole('button');
      await user.hover(button);

      // Wait for tooltip to appear
      await screen.findAllByText('Send Message');

      // Check that the tooltip content has the expected class
      const tooltipContent = container.ownerDocument.querySelector(
        '.ibl-tooltip-content',
      );
      expect(tooltipContent).toBeInTheDocument();
    });

    it('should have capitalize class on tooltip content', async () => {
      const user = userEvent.setup();
      const { container } = render(<SubmitMessageButton />);

      const button = screen.getByRole('button');
      await user.hover(button);

      // Wait for tooltip to appear
      await screen.findAllByText('Send Message');

      // Check that the tooltip content has capitalize class
      const tooltipContent =
        container.ownerDocument.querySelector('.capitalize');
      expect(tooltipContent).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label', () => {
      render(<SubmitMessageButton />);

      const button = screen.getByLabelText('Send message');
      expect(button).toBeInTheDocument();
    });

    it('should have aria-hidden on the icon', () => {
      const { container } = render(<SubmitMessageButton />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have screen reader text', () => {
      render(<SubmitMessageButton />);

      const srText = screen.getByText('Send message');
      expect(srText).toBeInTheDocument();
      expect(srText).toHaveClass('sr-only');
    });

    it('should be focusable when enabled', () => {
      render(<SubmitMessageButton />);

      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('should not be focusable when disabled', () => {
      render(<SubmitMessageButton isUploading={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Button Type', () => {
    it('should have type="submit" to work with forms', () => {
      render(<SubmitMessageButton />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });
  });

  describe('Icon Rendering', () => {
    it('should render ArrowUp icon with correct size classes', () => {
      const { container } = render(<SubmitMessageButton />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('h-5');
      expect(svg).toHaveClass('w-5');
    });

    it('should render icon with white color', () => {
      const { container } = render(<SubmitMessageButton />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-white');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid prop changes', () => {
      const { rerender } = render(<SubmitMessageButton />);

      // Rapid state changes
      rerender(<SubmitMessageButton isUploading={true} />);
      rerender(<SubmitMessageButton isUploading={false} />);
      rerender(
        <SubmitMessageButton
          isPreviewMode={true}
          allowAnonymousAccess={true}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should handle undefined props gracefully', () => {
      render(
        <SubmitMessageButton
          isPreviewMode={undefined}
          allowAnonymousAccess={undefined}
          isUploading={undefined}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should maintain structure when re-rendered with different props', () => {
      const { rerender, container } = render(<SubmitMessageButton />);

      expect(container.querySelector('button')).toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();

      rerender(<SubmitMessageButton isUploading={true} isPreviewMode={true} />);

      expect(container.querySelector('button')).toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
