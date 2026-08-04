import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
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
  MemoryMenu: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="memory-menu">
      Memory Menu
      <button data-testid="memory-menu-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
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

// ---------------------------------------------------------------------------
// Desktop assistants: Code (opencode) + Cowork (Cua Driver)
// ---------------------------------------------------------------------------

// The real Code button needs Redux and the mentor route; only the Tauri gate
// around it belongs to this component.
vi.mock('../coding-mode-button', () => ({
  CodingModeButton: ({ sessionId }: { sessionId?: string }) => (
    <button data-testid="coding-mode-button" data-session-id={sessionId}>
      Code
    </button>
  ),
}));

let mockIsTauri = false;
const mockIsTauriApp = vi.fn(() => mockIsTauri);
vi.mock('@/types/tauri', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/types/tauri')>()),
  isTauriApp: () => mockIsTauriApp(),
}));

let mockDriverAvailable = false;
let mockDriverSupported = true;
let mockUnsupportedReason: string | undefined;
let mockCoworkOn = false;
let mockLocalLLMEnabled = false;
let mockModelSupportsCowork = false;
const mockGhostInstall = vi.fn();
const mockGhostStop = vi.fn();
const mockSetCoworkEnabled = vi.fn();
vi.mock('@iblai/iblai-js/web-containers', () => ({
  useCuaDriver: () => ({
    isAvailable: mockDriverAvailable,
    isSupported: mockDriverSupported,
    unsupportedReason: mockUnsupportedReason,
    install: () => mockGhostInstall(),
    stop: () => mockGhostStop(),
  }),
  isCoworkEnabled: () => mockCoworkOn,
  // The real helper persists to localStorage, and the default-on pass relies on
  // that write to not fire twice — useCuaDriver hands back a fresh object each
  // render, so its effect re-runs and only the stored key stops it.
  setCoworkEnabled: (value: boolean) => {
    localStorage.setItem('ibl_cowork_enabled', String(value));
    mockSetCoworkEnabled(value);
  },
  isLocalLLMEnabled: () => mockLocalLLMEnabled,
  getLocalLLMModel: () => 'llama3.2',
  modelSupportsCowork: () => mockModelSupportsCowork,
}));

let mockHasRemoteAi = false;
vi.mock('@iblai/iblai-js/web-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@iblai/iblai-js/web-utils')>()),
  hasRemoteAiConfig: () => mockHasRemoteAi,
}));

const mockToastWarning = vi.fn();
vi.mock('sonner', () => ({
  toast: { warning: (...args: unknown[]) => mockToastWarning(...args) },
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
    // Browser defaults: neither desktop assistant is offered, so the tool-list
    // tests below see only the responsive buttons.
    mockIsTauri = false;
    mockDriverAvailable = false;
    mockDriverSupported = true;
    mockUnsupportedReason = undefined;
    mockCoworkOn = false;
    mockLocalLLMEnabled = false;
    mockModelSupportsCowork = false;
    mockHasRemoteAi = false;
    localStorage.clear();
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

  describe('Memory button private-mode gating', () => {
    it('renders MemoryButton inline when isPrivate is false (private mode off)', () => {
      render(
        <InsideButtons
          {...defaultProps}
          memoryEnabled={true}
          username="testuser"
          isPrivate={false}
          containerWidth={1000}
        />,
      );

      expect(screen.getByTestId('memory-button')).toBeInTheDocument();
    });

    it('hides MemoryButton inline when isPrivate is true (private mode active)', () => {
      render(
        <InsideButtons
          {...defaultProps}
          memoryEnabled={true}
          username="testuser"
          isPrivate={true}
          containerWidth={1000}
        />,
      );

      expect(screen.queryByTestId('memory-button')).not.toBeInTheDocument();
    });

    it('hides Memory from the overflow dropdown when isPrivate is true', async () => {
      const user = userEvent.setup();
      render(
        <InsideButtons
          {...defaultProps}
          memoryEnabled={true}
          username="testuser"
          isPrivate={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      await user.click(screen.getByText('•••').closest('button')!);
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const memoryItem = screen
        .getAllByRole('menuitem')
        .find((item) => item.textContent?.includes('Memory'));
      expect(memoryItem).toBeUndefined();
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

      // Closing the menu fires onClose → setHiddenMemoryPopoverOpen(false).
      await user.click(screen.getByTestId('memory-menu-close'));
    });
  });

  // ==========================================================================
  // Desktop assistants
  // ==========================================================================

  describe('Code button (Tauri gate)', () => {
    it('is absent in a plain browser', () => {
      render(<InsideButtons {...defaultProps} />);
      expect(
        screen.queryByTestId('coding-mode-button'),
      ).not.toBeInTheDocument();
    });

    it('renders immediately inside the desktop app and gets the chat id', () => {
      mockIsTauri = true;
      render(<InsideButtons {...defaultProps} sessionId="chat-77" />);

      expect(screen.getByTestId('coding-mode-button')).toHaveAttribute(
        'data-session-id',
        'chat-77',
      );
    });

    it('appears once Tauri injects its globals after mount', () => {
      // Tauri populates window.__TAURI_INTERNALS__ some time after the remote
      // origin loads, so a mount-time read can latch false forever.
      vi.useFakeTimers();
      try {
        render(<InsideButtons {...defaultProps} />);
        expect(
          screen.queryByTestId('coding-mode-button'),
        ).not.toBeInTheDocument();

        mockIsTauri = true;
        act(() => {
          vi.advanceTimersByTime(500);
        });

        expect(screen.getByTestId('coding-mode-button')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('stops polling after ten attempts in a browser', () => {
      vi.useFakeTimers();
      try {
        render(<InsideButtons {...defaultProps} />);
        // One read at mount, then one per tick.
        expect(mockIsTauriApp).toHaveBeenCalledTimes(1);

        act(() => {
          vi.advanceTimersByTime(500 * 11);
        });
        const afterGivingUp = mockIsTauriApp.mock.calls.length;
        expect(afterGivingUp).toBe(12);

        // The interval is cleared, so further time changes nothing.
        act(() => {
          vi.advanceTimersByTime(500 * 10);
        });
        expect(mockIsTauriApp).toHaveBeenCalledTimes(afterGivingUp);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Cowork button', () => {
    /** Cowork is offered wherever the driver is present. */
    const enableCowork = () => {
      mockDriverAvailable = true;
    };

    it('is absent outside the desktop app', () => {
      render(<InsideButtons {...defaultProps} />);
      expect(screen.queryByText('Cowork')).not.toBeInTheDocument();
    });

    it('renders on any desktop the driver supports', () => {
      // Cowork was macOS-only under GhostOS; the Cua Driver runs on Windows,
      // macOS and Linux, so there is no OS gate left — only session support.
      enableCowork();
      render(<InsideButtons {...defaultProps} />);
      expect(screen.getByText('Cowork').closest('button')).toBeEnabled();
    });

    it('stays visible but disabled on an unsupported session, and says why', () => {
      // The chatbox is Cowork's only surface: hiding the pill would leave the
      // user with no way to discover why the feature is missing.
      enableCowork();
      mockDriverSupported = false;
      mockUnsupportedReason = 'kde_unproven';
      render(<InsideButtons {...defaultProps} />);

      const button = screen.getByText('Cowork').closest('button')!;
      expect(button).toBeDisabled();
      expect(button.getAttribute('title')).toMatch(/KDE/);
    });

    it('cannot be toggled on an unsupported session', () => {
      enableCowork();
      mockDriverSupported = false;
      mockUnsupportedReason = 'gnome_helper_missing';
      mockHasRemoteAi = true;
      render(<InsideButtons {...defaultProps} />);

      fireEvent.click(screen.getByText('Cowork'));

      expect(mockSetCoworkEnabled).not.toHaveBeenCalled();
      expect(mockGhostInstall).not.toHaveBeenCalled();
    });

    it('does not default Cowork on for an unsupported session', () => {
      // The default-on pass must respect session support, not just presence.
      enableCowork();
      mockDriverSupported = false;
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'token-abc');
      render(<InsideButtons {...defaultProps} />);

      expect(mockSetCoworkEnabled).not.toHaveBeenCalled();
      expect(mockGhostInstall).not.toHaveBeenCalled();
    });

    it('turns on and installs the driver when the remote AI backend is configured', () => {
      enableCowork();
      mockHasRemoteAi = true;
      localStorage.setItem('ibl_cowork_enabled', 'false');
      render(<InsideButtons {...defaultProps} />);

      fireEvent.click(screen.getByText('Cowork'));

      expect(mockSetCoworkEnabled).toHaveBeenCalledWith(true);
      expect(mockGhostInstall).toHaveBeenCalledTimes(1);
      expect(mockToastWarning).not.toHaveBeenCalled();
    });

    it('turns on with a large enough local model and no remote backend', () => {
      enableCowork();
      mockLocalLLMEnabled = true;
      mockModelSupportsCowork = true;
      localStorage.setItem('ibl_cowork_enabled', 'false');
      render(<InsideButtons {...defaultProps} />);

      fireEvent.click(screen.getByText('Cowork'));

      expect(mockSetCoworkEnabled).toHaveBeenCalledWith(true);
      expect(mockGhostInstall).toHaveBeenCalledTimes(1);
    });

    it('refuses to turn on with no backend at all, and says why', () => {
      enableCowork();
      localStorage.setItem('ibl_cowork_enabled', 'false');
      render(<InsideButtons {...defaultProps} />);

      fireEvent.click(screen.getByText('Cowork'));

      expect(mockToastWarning).toHaveBeenCalledWith(
        'Turn on “Local Models” first — Cowork needs a local AI model.',
      );
      expect(mockSetCoworkEnabled).not.toHaveBeenCalled();
      expect(mockGhostInstall).not.toHaveBeenCalled();
    });

    it('names the size problem when a local model is on but too small', () => {
      enableCowork();
      mockLocalLLMEnabled = true;
      mockModelSupportsCowork = false;
      localStorage.setItem('ibl_cowork_enabled', 'false');
      render(<InsideButtons {...defaultProps} />);

      fireEvent.click(screen.getByText('Cowork'));

      expect(mockToastWarning).toHaveBeenCalledWith(
        'Your local model is too small for Cowork. Pick a model of at least 12GB in Local Models.',
      );
      expect(mockSetCoworkEnabled).not.toHaveBeenCalled();
    });

    it('turns off without any backend check', () => {
      // Switching off must never be blocked by the guard that gates switching on.
      enableCowork();
      mockCoworkOn = true;
      localStorage.setItem('ibl_cowork_enabled', 'true');
      render(<InsideButtons {...defaultProps} />);

      fireEvent.click(screen.getByText('Cowork'));

      expect(mockSetCoworkEnabled).toHaveBeenCalledWith(false);
      expect(mockGhostStop).toHaveBeenCalledTimes(1);
      expect(mockToastWarning).not.toHaveBeenCalled();
    });

    describe('default-on pass', () => {
      it('enables Cowork once for a logged-in desktop user who never chose', () => {
        enableCowork();
        localStorage.setItem('tenant', 'acme');
        localStorage.setItem('dm_token', 'token-abc');
        render(<InsideButtons {...defaultProps} />);

        expect(mockSetCoworkEnabled).toHaveBeenCalledWith(true);
        expect(mockGhostInstall).toHaveBeenCalledTimes(1);
      });

      it('respects an explicit earlier "off"', () => {
        enableCowork();
        localStorage.setItem('tenant', 'acme');
        localStorage.setItem('dm_token', 'token-abc');
        localStorage.setItem('ibl_cowork_enabled', 'false');
        render(<InsideButtons {...defaultProps} />);

        expect(mockSetCoworkEnabled).not.toHaveBeenCalled();
        expect(mockGhostInstall).not.toHaveBeenCalled();
      });

      it('leaves a logged-out user alone', () => {
        enableCowork();
        localStorage.setItem('tenant', 'acme');
        render(<InsideButtons {...defaultProps} />);

        expect(mockSetCoworkEnabled).not.toHaveBeenCalled();
        expect(mockGhostInstall).not.toHaveBeenCalled();
      });
    });
  });
});
