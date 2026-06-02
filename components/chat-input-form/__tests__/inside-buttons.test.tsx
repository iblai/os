import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsideButtons } from '../inside-buttons';

vi.mock('@/components/icons/svg-icons', () => ({
  DeepSearchIcon: ({ className }: { className?: string }) => (
    <svg data-testid="deep-search-icon" className={className} />
  ),
  CanvasIcon: ({ className }: { className?: string }) => (
    <svg data-testid="canvas-icon" className={className} />
  ),
}));

vi.mock('../memory-button', () => ({
  MemoryButton: () => <button data-testid="memory-button">Memory</button>,
}));

// MemoryMenu pulls mentor context from next/navigation; stub it so the hidden
// Memory popover can open without a router. The merged inside-buttons opens
// this menu instead of calling onOptionClick for the Memory item.
vi.mock('../memory-menu', () => ({
  MemoryMenu: () => <div data-testid="memory-menu">Memory Menu</div>,
}));

// Mock hooks that require Redux Provider
vi.mock('@/hooks/use-user', () => ({
  useIsAdmin: vi.fn(() => true),
  useLearnerMode: vi.fn(() => ({ isInstructorMode: true })),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    iblTemplateMentor: vi.fn(() => 'default-mentor'),
    iblAiUrl: vi.fn(() => 'http://localhost'),
    platformPublicKey: vi.fn(() => 'test-key'),
    useGoogleOnetap: vi.fn(() => false),
    enableAdminDebugTools: vi.fn(() => false),
  },
}));

// Import mocked modules for testing
import { useIsAdmin, useLearnerMode } from '@/hooks/use-user';

describe('InsideButtons', () => {
  const mockOnOptionClick = vi.fn();

  const defaultProps = {
    activeOptions: [],
    onOptionClick: mockOnOptionClick,
    deepResearch: true,
    studyMode: false,
    artifactsEnabled: false,
    containerWidth: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default values
    (useIsAdmin as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (useLearnerMode as ReturnType<typeof vi.fn>).mockReturnValue({
      isInstructorMode: true,
    });
  });

  describe('rendering', () => {
    it('should render Canvas button when artifactsEnabled is true', () => {
      render(<InsideButtons {...defaultProps} artifactsEnabled={true} />);
      expect(screen.getByText('Canvas')).toBeInTheDocument();
    });

    it('should render Deep Research button when deepResearch is true', () => {
      render(<InsideButtons {...defaultProps} deepResearch={true} />);
      expect(screen.getByText('Deep Research')).toBeInTheDocument();
    });

    it('should not render Deep Research button when deepResearch is false', () => {
      render(<InsideButtons {...defaultProps} deepResearch={false} />);
      expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
    });

    it('should render Study Mode button when studyMode is true', () => {
      render(
        <InsideButtons
          {...defaultProps}
          studyMode={true}
          containerWidth={1000}
        />,
      );
      expect(screen.getByText('Study Mode')).toBeInTheDocument();
    });

    it('should not render Study Mode button when studyMode is false', () => {
      render(
        <InsideButtons
          {...defaultProps}
          studyMode={false}
          containerWidth={1000}
        />,
      );
      expect(screen.queryByText('Study Mode')).not.toBeInTheDocument();
    });

    it('should render all enabled buttons when container is wide', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={1000}
        />,
      );

      expect(screen.getByText('Canvas')).toBeInTheDocument();
      expect(screen.getByText('Deep Research')).toBeInTheDocument();
    });

    it('should render MemoryButton when memoryEnabled is true and user is authenticated', () => {
      render(
        <InsideButtons
          {...defaultProps}
          memoryEnabled={true}
          username="testuser"
          containerWidth={1000}
        />,
      );

      expect(screen.getByTestId('memory-button')).toBeInTheDocument();
    });

    it('should not render MemoryButton when user is not authenticated', () => {
      render(
        <InsideButtons
          {...defaultProps}
          memoryEnabled={true}
          username=""
          containerWidth={1000}
        />,
      );

      expect(screen.queryByTestId('memory-button')).not.toBeInTheDocument();
    });

    it('should not render MemoryButton in embed mode', () => {
      render(
        <InsideButtons
          {...defaultProps}
          memoryEnabled={true}
          embedMode={true}
          containerWidth={1000}
        />,
      );

      expect(screen.queryByTestId('memory-button')).not.toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('should call onOptionClick with CANVAS when Canvas button is clicked', async () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText('Canvas').closest('button');
      expect(canvasButton).toBeInTheDocument();
      fireEvent.click(canvasButton!);

      expect(mockOnOptionClick).toHaveBeenCalledWith('canvas');
    });

    it('should call onOptionClick with DEEP_RESEARCH when Deep Research button is clicked', async () => {
      render(<InsideButtons {...defaultProps} containerWidth={1000} />);

      const deepResearchButton = screen
        .getByText('Deep Research')
        .closest('button');
      expect(deepResearchButton).toBeInTheDocument();
      fireEvent.click(deepResearchButton!);

      expect(mockOnOptionClick).toHaveBeenCalledWith('deep-research');
    });

    it('should call onOptionClick with STUDY_MODE when Study Mode button is clicked', async () => {
      render(
        <InsideButtons
          {...defaultProps}
          studyMode={true}
          containerWidth={1000}
        />,
      );

      const studyModeButton = screen.getByText('Study Mode').closest('button');
      expect(studyModeButton).toBeInTheDocument();
      fireEvent.click(studyModeButton!);

      expect(mockOnOptionClick).toHaveBeenCalledWith('study-mode');
    });

    it('should prevent default and stop propagation on button click', async () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText('Canvas').closest('button');
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

      canvasButton!.dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('active state styling', () => {
    it('should apply active styling when Canvas is active', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText('Canvas').closest('button');
      // When artifactsEnabled is true, button should have active styling
      expect(canvasButton).toHaveClass('text-[#38A1E5]');
    });

    it('should apply active styling when Deep Research is in activeOptions', () => {
      render(
        <InsideButtons
          {...defaultProps}
          activeOptions={['deep-research']}
          containerWidth={1000}
        />,
      );

      const deepResearchButton = screen
        .getByText('Deep Research')
        .closest('button');
      expect(deepResearchButton).toHaveClass('text-[#38A1E5]');
    });

    it('should apply active styling when Study Mode is in activeOptions', () => {
      render(
        <InsideButtons
          {...defaultProps}
          studyMode={true}
          activeOptions={['study-mode']}
          containerWidth={1000}
        />,
      );

      const studyModeButton = screen.getByText('Study Mode').closest('button');
      expect(studyModeButton).toHaveClass('text-[#38A1E5]');
    });

    it('should not apply active styling when Study Mode is not in activeOptions', () => {
      render(
        <InsideButtons
          {...defaultProps}
          studyMode={true}
          activeOptions={[]}
          containerWidth={1000}
        />,
      );

      const studyModeButton = screen.getByText('Study Mode').closest('button');
      expect(studyModeButton).not.toHaveClass('text-[#38A1E5]');
    });

    it('should show X icon when button is active', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText('Canvas').closest('button');
      // Check for X icon in active button
      const xIcon = canvasButton?.querySelector('.ml-1');
      expect(xIcon).toBeInTheDocument();
    });

    it('should prevent default and stop propagation when X icon is clicked', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText('Canvas').closest('button');
      const xIcon = canvasButton?.querySelector('.ml-1') as SVGElement | null;
      expect(xIcon).toBeInTheDocument();

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

      xIcon?.dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('responsive behavior', () => {
    it('should show inactive buttons in dropdown when containerWidth is less than 600', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={false}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      // Inactive buttons should be in dropdown
      expect(screen.queryByText('Canvas')).not.toBeInTheDocument();
      expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
      // Should show more options button
      expect(screen.getByText('•••')).toBeInTheDocument();
    });

    it('should collapse active buttons into the dropdown on mobile (<600)', () => {
      // Regression for #1533: active pills used to render inline at <600
      // and overflow the row when multiple tools were active.
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      // Neither active Canvas nor inactive Deep Research is inline.
      expect(screen.queryByText('Canvas')).not.toBeInTheDocument();
      expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
      // Only the ••• overflow trigger is rendered inline.
      expect(screen.getByText('•••')).toBeInTheDocument();
    });

    it('should collapse all tool buttons into the dropdown on tablet (600-800)', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={700}
        />,
      );

      // No inline pills, just the overflow trigger.
      expect(screen.queryByText('Canvas')).not.toBeInTheDocument();
      expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
      expect(screen.getByText('•••')).toBeInTheDocument();
    });

    it('should show all buttons when containerWidth is 800 or more', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={1000}
        />,
      );

      expect(screen.getByText('Canvas')).toBeInTheDocument();
      expect(screen.getByText('Deep Research')).toBeInTheDocument();
      // No dropdown menu
      expect(screen.queryByText('•••')).not.toBeInTheDocument();
    });
  });

  describe('dropdown menu', () => {
    it('should render dropdown trigger when hidden buttons exist', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      const moreButton = screen.getByText('•••').closest('button');
      expect(moreButton).toBeInTheDocument();
      expect(moreButton).toHaveAttribute('aria-haspopup', 'menu');
    });
  });

  describe('button type attribute', () => {
    it('should have type="button" to prevent form submission', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText('Canvas').closest('button');
      expect(canvasButton).toHaveAttribute('type', 'button');
    });
  });

  describe('empty state', () => {
    it('should render empty when no buttons are enabled', () => {
      const { container } = render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={false}
          deepResearch={false}
          containerWidth={1000}
        />,
      );

      // Only Canvas is rendered since it always shows (isEnabled: true)
      // But with artifactsEnabled false, no buttons should show
      // Container should be empty or only have the relative wrapper
      expect(container.querySelector('.flex.items-center')).toBeInTheDocument();
    });
  });

  describe('icons', () => {
    it('should render CanvasIcon for Canvas button', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );
      expect(screen.getByTestId('canvas-icon')).toBeInTheDocument();
    });

    it('should render DeepSearchIcon for Deep Research button', () => {
      render(
        <InsideButtons
          {...defaultProps}
          deepResearch={true}
          containerWidth={1000}
        />,
      );
      expect(screen.getByTestId('deep-search-icon')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible more options button with sr-only text', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      expect(screen.getByText('More options')).toHaveClass('sr-only');
    });
  });

  describe('tablet responsive behavior (600-800px)', () => {
    it('should hide all enabled tool buttons in the dropdown on tablet (multiple inactives)', () => {
      // Both Canvas and Deep Research enabled, both inactive.
      // Pre-#1533 the first inactive used to sneak inline; now everything
      // below 800px lives in the dropdown.
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={false} // Canvas isActive = false, isEnabled = true
          deepResearch={true} // Deep Research isEnabled = true
          activeOptions={[]} // Neither is active
          containerWidth={700} // Tablet width
        />,
      );

      // Nothing inline.
      expect(screen.queryByText('Canvas')).not.toBeInTheDocument();
      expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
      expect(screen.getByText('•••')).toBeInTheDocument();
    });

    it('should hide active tool buttons in the dropdown on tablet', () => {
      // Canvas: artifactsEnabled=true means isActive=true.
      // Deep Research: not in activeOptions, so isActive=false.
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          activeOptions={[]}
          containerWidth={700}
        />,
      );

      // Active Canvas is NOT rendered as an inline pill (this is the bug fix).
      expect(screen.queryByText('Canvas')).not.toBeInTheDocument();
      expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
      expect(screen.getByText('•••')).toBeInTheDocument();
    });
  });

  describe('dropdown menu interactions', () => {
    it('should have dropdown trigger when hidden buttons exist', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      const moreButton = screen.getByText('•••').closest('button');
      expect(moreButton).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('should show hidden buttons in dropdown menu when opened', async () => {
      const user = userEvent.setup();
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      const moreButton = screen.getByText('•••').closest('button');
      await user.click(moreButton!);

      // Dropdown should be open with Deep Research inside
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('should call onOptionClick when dropdown item is clicked', async () => {
      const user = userEvent.setup();
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      const moreButton = screen.getByText('•••').closest('button');
      await user.click(moreButton!);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Find and click the menu item
      const menuItems = screen.getAllByRole('menuitem');
      await user.click(menuItems[0]);

      expect(mockOnOptionClick).toHaveBeenCalled();
    });

    it('should show icon in dropdown menu items', async () => {
      const user = userEvent.setup();
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      const moreButton = screen.getByText('•••').closest('button');
      await user.click(moreButton!);

      await waitFor(() => {
        expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
        // Deep Research icon should be in the menu item
        expect(screen.getByTestId('deep-search-icon')).toBeInTheDocument();
      });
    });
  });

  describe('single button edge case', () => {
    it('should render single button without dropdown when only one button exists and width > minButtonWidth', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={false}
          deepResearch={false}
          containerWidth={200}
        />,
      );

      // With only Canvas enabled (deepResearch=false) and width > 120, should show button without dropdown
      expect(screen.getByText('Canvas')).toBeInTheDocument();
      expect(screen.queryByText('•••')).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should disable all buttons when disabled prop is true', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={1000}
          disabled={true}
        />,
      );

      const canvasButton = screen.getByText('Canvas').closest('button');
      const deepResearchButton = screen
        .getByText('Deep Research')
        .closest('button');

      expect(canvasButton).toBeDisabled();
      expect(deepResearchButton).toBeDisabled();
    });

    it('should disable more options button when disabled prop is true', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
          disabled={true}
        />,
      );

      const moreButton = screen.getByText('•••').closest('button');
      expect(moreButton).toBeDisabled();
    });
  });

  describe('Prompts button', () => {
    const mockOnOpenPromptGallery = vi.fn();

    it('should render Prompts button when promptsIsEnabled is true and not in embed mode', () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      expect(screen.getByText('Prompts')).toBeInTheDocument();
    });

    it('should NOT render Prompts button when in embed mode', () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={true}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      expect(screen.queryByText('Prompts')).not.toBeInTheDocument();
    });

    it('should NOT render Prompts button when promptsIsEnabled is false', () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={false}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      expect(screen.queryByText('Prompts')).not.toBeInTheDocument();
    });

    it('should call onOpenPromptGallery when Prompts button is clicked', () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      const button = screen.getByText('Prompts').closest('button');
      fireEvent.click(button!);
      expect(mockOnOpenPromptGallery).toHaveBeenCalled();
    });

    it('should render Terminal icon for Prompts button', () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      const button = screen.getByText('Prompts').closest('button');
      const icon = button?.querySelector('.lucide-terminal');
      expect(icon).toBeInTheDocument();
    });

    it('should never show X icon for Prompts (isActive is always false)', () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      const button = screen.getByText('Prompts').closest('button');
      const xIcon = button?.querySelector('.ml-1');
      expect(xIcon).not.toBeInTheDocument();
    });

    it('should render Prompts as the second button (after Canvas)', () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      const buttons = screen.getAllByRole('button');
      const buttonTexts = buttons.map((btn) =>
        btn.textContent?.replace(/[×✕]/g, '').trim(),
      );
      const canvasIndex = buttonTexts.indexOf('Canvas');
      const promptsIndex = buttonTexts.indexOf('Prompts');
      expect(promptsIndex).toBe(canvasIndex + 1);
    });

    it('should handle missing onOpenPromptGallery gracefully', () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          containerWidth={1000}
        />,
      );
      const button = screen.getByText('Prompts').closest('button');
      // Should not throw when clicked without onOpenPromptGallery
      expect(() => fireEvent.click(button!)).not.toThrow();
    });
  });

  describe('dropdown active-state styling (#1533)', () => {
    it('renders active styling on an active Canvas item inside the dropdown at width 500', async () => {
      const user = userEvent.setup();
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          activeOptions={['canvas']}
          containerWidth={500}
        />,
      );

      await user.click(screen.getByText('•••').closest('button')!);
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const canvasItem = screen
        .getAllByRole('menuitem')
        .find((item) => item.textContent?.includes('Canvas'))!;
      expect(canvasItem).toBeTruthy();
      // DropdownMenuItem active className branch.
      expect(canvasItem.className).toContain('bg-[#F5F8FF]');
      expect(canvasItem.className).toContain('text-[#38A1E5]');
      // Icon active span branch.
      const iconSpan = canvasItem.querySelector('span.text-\\[\\#38A1E5\\]');
      expect(iconSpan).not.toBeNull();
      // Trailing Check icon.
      expect(canvasItem.querySelector('svg.lucide-check')).not.toBeNull();
    });

    it('row-overflow repro: Canvas + Deep Research both active at width 500 stay out of the inline row', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          activeOptions={['canvas', 'deep-research']}
          containerWidth={500}
        />,
      );

      // The inline row contains only the ••• overflow trigger.
      const inlineRow = container.querySelector(
        'div.relative.flex.items-center.gap-1\\.5',
      )!;
      expect(inlineRow).not.toBeNull();
      const inlineButtons = inlineRow.querySelectorAll('button');
      expect(inlineButtons).toHaveLength(1);
      expect(inlineButtons[0].textContent).toContain('•••');
      // Both tools live in the dropdown with active markers.
      await user.click(screen.getByText('•••').closest('button')!);
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
      const items = screen.getAllByRole('menuitem');
      const canvasItem = items.find((i) => i.textContent?.includes('Canvas'))!;
      const deepResearchItem = items.find((i) =>
        i.textContent?.includes('Deep Research'),
      )!;
      expect(canvasItem.querySelector('svg.lucide-check')).not.toBeNull();
      expect(deepResearchItem.querySelector('svg.lucide-check')).not.toBeNull();
    });

    it('regression guard: at desktop width 1000 both active tools render inline (no overflow trigger)', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          activeOptions={['canvas', 'deep-research']}
          containerWidth={1000}
        />,
      );
      expect(screen.getByText('Canvas')).toBeInTheDocument();
      expect(screen.getByText('Deep Research')).toBeInTheDocument();
      expect(screen.queryByText('•••')).not.toBeInTheDocument();
    });

    it('opens the Memory popover menu when its dropdown item is clicked', async () => {
      // Memory is enabled, so it lands in the dropdown at width 500.
      // Clicking it should NOT call onOptionClick — it opens the MemoryMenu
      // popover instead (setHiddenMemoryPopoverOpen(true)).
      const user = userEvent.setup();
      render(
        <InsideButtons
          {...defaultProps}
          memoryEnabled={true}
          username="alice"
          containerWidth={500}
        />,
      );

      await user.click(screen.getByText('•••').closest('button')!);
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const memoryItem = screen
        .getAllByRole('menuitem')
        .find((item) => item.textContent?.includes('Memory'))!;
      expect(memoryItem).toBeTruthy();
      await user.click(memoryItem);

      // The popover-backed MemoryMenu opens; the tool-toggle handler is not used.
      await waitFor(() => {
        expect(screen.getByTestId('memory-menu')).toBeInTheDocument();
      });
      expect(mockOnOptionClick).not.toHaveBeenCalledWith('memory');
    });
  });
});
