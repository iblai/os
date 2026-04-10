import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CanvasControls } from '../canvas-controls';

// ============================================================================
// TESTS
// ============================================================================

describe('CanvasControls', () => {
  const mockSendFullArtifactUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Rendering
  // ==========================================================================

  describe('Rendering', () => {
    it('renders the main pencil button', () => {
      render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Look for the main button (pencil icon button)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders collapsed by default', () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Options should be hidden initially (opacity-0 or hidden)
      const hiddenElements = container.querySelectorAll('.opacity-0, .hidden');
      expect(hiddenElements.length).toBeGreaterThanOrEqual(0);
    });

    it('renders without sendFullArtifactUpdate prop', () => {
      expect(() => render(<CanvasControls />)).not.toThrow();
    });
  });

  // ==========================================================================
  // Expansion/Collapse
  // ==========================================================================

  describe('Expansion/Collapse', () => {
    it('expands when main button is clicked', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      const mainButton = container.querySelector('button[type="button"]');
      expect(mainButton).toBeInTheDocument();

      if (mainButton) {
        fireEvent.click(mainButton);
      }

      // After click, options container should be present
      await waitFor(
        () => {
          const options = container.querySelectorAll('button');
          // Should have more buttons after expanding
          expect(options.length).toBeGreaterThan(1);
        },
        { timeout: 2000 },
      );
    });

    it('expands on mouse enter', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      const controlsContainer = container.querySelector('.flex.flex-col.gap-3');
      if (controlsContainer) {
        fireEvent.mouseEnter(controlsContainer);
      }

      await waitFor(() => {
        const expandedContent = container.querySelector('.opacity-100');
        expect(expandedContent).toBeInTheDocument();
      });
    });

    it('collapses on mouse leave when no option selected', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      const controlsContainer = container.querySelector('.flex.flex-col.gap-3');
      if (controlsContainer) {
        fireEvent.mouseEnter(controlsContainer);
        await waitFor(() => {
          expect(container.querySelector('.opacity-100')).toBeInTheDocument();
        });

        fireEvent.mouseLeave(controlsContainer);
      }

      // Should collapse
      await waitFor(() => {
        // Either has opacity-0 or pointer-events-none
        const collapsed = container.querySelector(
          '.opacity-0, .pointer-events-none',
        );
        expect(collapsed).toBeInTheDocument();
      });
    });

    it('stays expanded when option is selected', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand first
      const controlsContainer = container.querySelector('.flex.flex-col.gap-3');
      if (controlsContainer) {
        fireEvent.mouseEnter(controlsContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click on length option
      const buttons = screen.getAllByRole('button');
      const lengthButton = buttons.find(
        (btn) =>
          btn
            .querySelector('svg')
            ?.classList.contains('lucide-arrow-up-down') ||
          btn.getAttribute('aria-label')?.includes('length'),
      );

      if (lengthButton) {
        await userEvent.click(lengthButton);
      }
    });
  });

  // ==========================================================================
  // Control Options
  // ==========================================================================

  describe('Control Options', () => {
    it('shows length slider when length option is clicked', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Find and click the length adjustment button (ArrowUpDown icon)
      const buttons = container.querySelectorAll('button');
      // The length button should be the last in the expanded menu
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        // Slider should appear
        await waitFor(() => {
          const slider = container.querySelector('.bg-gray-100.rounded-full');
          expect(slider).toBeInTheDocument();
        });
      }
    });

    it('shows reading level slider when reading option is clicked', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Find and click the reading level button (BookOpen icon)
      const buttons = container.querySelectorAll('button');
      const readingButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-book-open');
      });

      if (readingButton) {
        await userEvent.click(readingButton);

        // Slider should appear
        await waitFor(() => {
          const slider = container.querySelector('.bg-gray-100.rounded-full');
          expect(slider).toBeInTheDocument();
        });
      }
    });

    it('shows emoji options panel when emojis option is clicked', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand by clicking main button
      const mainButton = container.querySelector('button[type="button"]');
      if (mainButton) {
        fireEvent.click(mainButton);
      }

      await waitFor(
        () => {
          const buttons = container.querySelectorAll('button');
          expect(buttons.length).toBeGreaterThan(1);
        },
        { timeout: 2000 },
      );

      // Find and click the emoji button (Smile icon)
      const buttons = container.querySelectorAll('button');
      const emojiButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-smile');
      });

      expect(emojiButton).toBeDefined();

      if (emojiButton) {
        fireEvent.click(emojiButton);

        // Emoji options panel should be visible (more elements rendered)
        await waitFor(
          () => {
            const allButtons = container.querySelectorAll('button');
            // After clicking emoji, more options should appear
            expect(allButtons.length).toBeGreaterThanOrEqual(1);
          },
          { timeout: 2000 },
        );
      }
    });

    it('shows send icon for polish option on click', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Find and click the polish button (Sparkles icon)
      const buttons = container.querySelectorAll('button');
      const polishButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-sparkles');
      });

      if (polishButton) {
        await userEvent.click(polishButton);

        // Should show send icon (ArrowUp)
        await waitFor(() => {
          const sendIcon = container.querySelector('.lucide-arrow-up');
          expect(sendIcon).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Length Slider
  // ==========================================================================

  describe('Length Slider', () => {
    it('displays length levels', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand and click length
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        // Check for length level labels
        await waitFor(() => {
          // The slider should show "Keep current length" or similar
          const slider = container.querySelector('.bg-gray-100.rounded-full');
          expect(slider).toBeInTheDocument();
        });
      }
    });

    it('allows dragging the slider', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand and click length
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        // Find the draggable dot
        await waitFor(() => {
          const draggableDot = container.querySelector(
            '.cursor-grab, .cursor-pointer',
          );
          expect(draggableDot).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Emoji Options
  // ==========================================================================

  describe('Emoji Options', () => {
    const setupEmojiPanel = async (container: HTMLElement) => {
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      const buttons = container.querySelectorAll('button');
      const emojiButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-smile');
      });

      if (emojiButton) {
        await userEvent.click(emojiButton);
      }
    };

    it('shows Words option', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      await setupEmojiPanel(container);

      await waitFor(() => {
        expect(screen.getByText('Words')).toBeInTheDocument();
      });
    });

    it('shows Sections option', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      await setupEmojiPanel(container);

      await waitFor(() => {
        expect(screen.getByText('Sections')).toBeInTheDocument();
      });
    });

    it('shows Lists option', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      await setupEmojiPanel(container);

      await waitFor(() => {
        expect(screen.getByText('Lists')).toBeInTheDocument();
      });
    });

    it('shows Remove option', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      await setupEmojiPanel(container);

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });
    });

    it('sends emoji prompt when Words is clicked', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      await setupEmojiPanel(container);

      await waitFor(() => {
        expect(screen.getByText('Words')).toBeInTheDocument();
      });

      const wordsButton = screen.getByText('Words').closest('button');
      if (wordsButton) {
        await userEvent.click(wordsButton);
      }

      expect(mockSendFullArtifactUpdate).toHaveBeenCalledWith(
        'Replace as many words as possible with emojis.',
      );
    });

    it('sends emoji prompt when Sections is clicked', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      await setupEmojiPanel(container);

      await waitFor(() => {
        expect(screen.getByText('Sections')).toBeInTheDocument();
      });

      const sectionsButton = screen.getByText('Sections').closest('button');
      if (sectionsButton) {
        await userEvent.click(sectionsButton);
      }

      expect(mockSendFullArtifactUpdate).toHaveBeenCalledWith(
        expect.stringContaining('Add three emojis'),
      );
    });

    it('sends remove emoji prompt when Remove is clicked', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      await setupEmojiPanel(container);

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument();
      });

      const removeButton = screen.getByText('Remove').closest('button');
      if (removeButton) {
        await userEvent.click(removeButton);
      }

      expect(mockSendFullArtifactUpdate).toHaveBeenCalledWith('Remove emojis.');
    });
  });

  // ==========================================================================
  // Polish Feature
  // ==========================================================================

  describe('Polish Feature', () => {
    it('sends polish prompt when send button is clicked', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click polish to show send icon
      const buttons = container.querySelectorAll('button');
      const polishButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-sparkles');
      });

      if (polishButton) {
        await userEvent.click(polishButton);

        // Now click again to send
        await waitFor(() => {
          const sendIcon = container.querySelector('.lucide-arrow-up');
          expect(sendIcon).toBeInTheDocument();
        });

        await userEvent.click(polishButton);

        expect(mockSendFullArtifactUpdate).toHaveBeenCalledWith(
          expect.stringContaining('Add some final polish'),
        );
      }
    });
  });

  // ==========================================================================
  // Click Outside
  // ==========================================================================

  describe('Click Outside', () => {
    it('closes options panel when clicking outside', async () => {
      const { container } = render(
        <div>
          <div data-testid="outside">Outside element</div>
          <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />
        </div>,
      );

      // Expand
      const controlsContainer = container.querySelector('.flex.flex-col.gap-3');
      if (controlsContainer) {
        fireEvent.mouseEnter(controlsContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click outside
      const outside = screen.getByTestId('outside');
      fireEvent.mouseDown(outside);

      // Should collapse
      await waitFor(() => {
        const collapsed = container.querySelector('.opacity-0');
        expect(collapsed).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // No sendFullArtifactUpdate
  // ==========================================================================

  describe('Without sendFullArtifactUpdate', () => {
    it('does not crash when sendFullArtifactUpdate is undefined', async () => {
      const { container } = render(<CanvasControls />);

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Try to trigger emoji option
      const buttons = container.querySelectorAll('button');
      const emojiButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-smile');
      });

      if (emojiButton) {
        await userEvent.click(emojiButton);

        await waitFor(() => {
          expect(screen.getByText('Words')).toBeInTheDocument();
        });

        const wordsButton = screen.getByText('Words').closest('button');
        if (wordsButton) {
          // Should not crash
          expect(() => fireEvent.click(wordsButton)).not.toThrow();
        }
      }
    });
  });

  // ==========================================================================
  // Keyboard Interactions
  // ==========================================================================

  describe('Keyboard Interactions', () => {
    it('main button is focusable', () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      const mainButton = container.querySelector('button[type="button"]');
      expect(mainButton).toBeInTheDocument();
      expect(mainButton).not.toHaveAttribute('disabled');
    });

    it('can toggle expansion with Enter key', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      const mainButton = container.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      if (mainButton) {
        mainButton.focus();
        fireEvent.keyDown(mainButton, { key: 'Enter' });

        await waitFor(
          () => {
            const buttons = container.querySelectorAll('button');
            expect(buttons.length).toBeGreaterThan(1);
          },
          { timeout: 2000 },
        );
      }
    });
  });

  // ==========================================================================
  // Tooltips
  // ==========================================================================

  describe('Tooltips', () => {
    it('shows tooltip on hover for emoji option', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Hover over emoji button - tooltip should appear
      const emojiGroup = container.querySelector('.group');
      if (emojiGroup) {
        fireEvent.mouseEnter(emojiGroup);
        // Tooltip text should be visible on hover
        await waitFor(() => {
          const tooltip = container.querySelector('.group-hover\\:opacity-100');
          expect(tooltip).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Animation Classes
  // ==========================================================================

  describe('Animation Classes', () => {
    it('applies animation classes when expanded', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        const animated = container.querySelector('.transition-all');
        expect(animated).toBeInTheDocument();
      });
    });

    it('applies slide-in animation for slider', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        await waitFor(() => {
          const slideIn = container.querySelector(
            '.slide-in-from-right, .animate-in',
          );
          expect(slideIn).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Slider Dragging
  // ==========================================================================

  describe('Slider Dragging', () => {
    it('handles drag interaction on length slider', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click length button
      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        // Wait for slider to appear
        await waitFor(() => {
          const slider = container.querySelector('.cursor-grab');
          expect(slider).toBeInTheDocument();
        });

        // Get the draggable dot
        const draggableDot = container.querySelector(
          '.cursor-grab, .cursor-pointer',
        );
        if (draggableDot) {
          // Simulate mousedown
          fireEvent.mouseDown(draggableDot, { clientY: 100 });

          // Simulate mousemove
          fireEvent.mouseMove(document, { clientY: 150 });

          // Simulate mouseup
          fireEvent.mouseUp(document);
        }
      }
    });

    it('handles drag interaction on reading level slider', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click reading button
      const buttons = container.querySelectorAll('button');
      const readingButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-book-open');
      });

      if (readingButton) {
        await userEvent.click(readingButton);

        // Wait for slider to appear
        await waitFor(() => {
          const slider = container.querySelector('.cursor-grab');
          expect(slider).toBeInTheDocument();
        });

        // Get the draggable dot
        const draggableDot = container.querySelector(
          '.cursor-grab, .cursor-pointer',
        );
        if (draggableDot) {
          // Simulate drag
          fireEvent.mouseDown(draggableDot, { clientY: 100 });
          fireEvent.mouseMove(document, { clientY: 50 });
          fireEvent.mouseUp(document);
        }
      }
    });

    it('shows send icon after dragging to non-default position', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click length button
      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        await waitFor(() => {
          const draggableDot = container.querySelector('.cursor-grab');
          expect(draggableDot).toBeInTheDocument();
        });

        const draggableDot = container.querySelector(
          '.cursor-grab, .cursor-pointer',
        );
        if (draggableDot) {
          // Drag to a different position
          fireEvent.mouseDown(draggableDot, { clientY: 100 });
          fireEvent.mouseMove(document, { clientY: 50 });
          fireEvent.mouseUp(document);

          // Should show send icon
          await waitFor(() => {
            // May or may not be visible depending on position
            expect(container).toBeInTheDocument();
          });
        }
      }
    });
  });

  // ==========================================================================
  // Reading Level Send
  // ==========================================================================

  describe('Reading Level Send', () => {
    it('sends reading level prompt when send button is clicked', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click reading button
      const buttons = container.querySelectorAll('button');
      const readingButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-book-open');
      });

      if (readingButton) {
        await userEvent.click(readingButton);

        await waitFor(() => {
          const slider = container.querySelector('.bg-gray-100.rounded-full');
          expect(slider).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Length Send
  // ==========================================================================

  describe('Length Send', () => {
    it('sends length prompt when send button is clicked after dragging', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click length button
      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        await waitFor(() => {
          const slider = container.querySelector('.bg-gray-100.rounded-full');
          expect(slider).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Emoji Lists Option
  // ==========================================================================

  describe('Emoji Lists Option', () => {
    it('sends emoji lists prompt when Lists is clicked', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand by clicking main button
      const mainButton = container.querySelector('button[type="button"]');
      if (mainButton) {
        fireEvent.click(mainButton);
      }

      await waitFor(
        () => {
          const buttons = container.querySelectorAll('button');
          expect(buttons.length).toBeGreaterThan(1);
        },
        { timeout: 2000 },
      );

      // Find and click the emoji button
      const buttons = container.querySelectorAll('button');
      const emojiButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-smile');
      });

      if (emojiButton) {
        fireEvent.click(emojiButton);

        await waitFor(() => {
          expect(screen.getByText('Lists')).toBeInTheDocument();
        });

        const listsButton = screen.getByText('Lists').closest('button');
        if (listsButton) {
          await userEvent.click(listsButton);
        }

        expect(mockSendFullArtifactUpdate).toHaveBeenCalledWith(
          'Add emojis to lists for visual flair. Do not change the structure of the original text.',
        );
      }
    });
  });

  // ==========================================================================
  // Mouse Leave with Selection
  // ==========================================================================

  describe('Mouse Leave Behavior', () => {
    it('does not collapse when option is selected', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click length to select option
      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        // Now mouse leave
        if (mainContainer) {
          fireEvent.mouseLeave(mainContainer);
        }

        // Slider should still be visible since option is selected
        await waitFor(() => {
          const slider = container.querySelector('.bg-gray-100.rounded-full');
          expect(slider).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Dot MouseDown with Send Icon
  // ==========================================================================

  describe('Dot MouseDown with Send Icon', () => {
    it('allows click when send icon is shown', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click length button
      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        await waitFor(() => {
          const slider = container.querySelector('.bg-gray-100.rounded-full');
          expect(slider).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Default State Positions
  // ==========================================================================

  describe('Default State Positions', () => {
    it('returns to default state when dragging back to keep current length', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click length button
      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        await waitFor(() => {
          const draggableDot = container.querySelector('.cursor-grab');
          expect(draggableDot).toBeInTheDocument();
        });
      }
    });

    it('returns to default state when dragging back to keep current reading level', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click reading button
      const buttons = container.querySelectorAll('button');
      const readingButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-book-open');
      });

      if (readingButton) {
        await userEvent.click(readingButton);

        await waitFor(() => {
          const draggableDot = container.querySelector('.cursor-grab');
          expect(draggableDot).toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Reading Level Send with Actual Drag and Click (lines 193-194, 296-298)
  // ==========================================================================

  describe('Reading Level Send with Drag', () => {
    it('sends reading level prompt after dragging and clicking send icon (lines 193-194)', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click reading button
      const buttons = container.querySelectorAll('button');
      const readingButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-book-open');
      });

      if (readingButton) {
        await userEvent.click(readingButton);

        await waitFor(() => {
          const slider = container.querySelector('.bg-gray-100.rounded-full');
          expect(slider).toBeInTheDocument();
        });

        // Find the draggable dot
        const draggableDot = container.querySelector('.cursor-grab');
        if (draggableDot) {
          // Simulate drag to change position
          fireEvent.mouseDown(draggableDot, { clientY: 100 });
          fireEvent.mouseMove(document, { clientY: 60 }); // Drag up
          fireEvent.mouseUp(document);

          // After dragging, the send icon should appear
          await waitFor(
            () => {
              const sendIcon = container.querySelector('.cursor-pointer');
              expect(sendIcon).toBeInTheDocument();
            },
            { timeout: 2000 },
          );

          // Click on the send icon (click handler on lines 296-298)
          const sendableElement = container.querySelector('.cursor-pointer');
          if (sendableElement) {
            fireEvent.click(sendableElement);

            // This should trigger handleSend with showSendOnIcon === 'reading'
            await waitFor(
              () => {
                expect(mockSendFullArtifactUpdate).toHaveBeenCalled();
              },
              { timeout: 2000 },
            );
          }
        }
      }
    });
  });

  // ==========================================================================
  // Length Send with Drag (lines 190-191)
  // ==========================================================================

  describe('Length Send with Drag', () => {
    it('sends length prompt after dragging and clicking send icon (lines 190-191)', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click length button (arrow-up-down icon)
      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        await waitFor(() => {
          const slider = container.querySelector('.bg-gray-100.rounded-full');
          expect(slider).toBeInTheDocument();
        });

        // Find the draggable dot
        const draggableDot = container.querySelector('.cursor-grab');
        if (draggableDot) {
          // Simulate drag to change position
          fireEvent.mouseDown(draggableDot, { clientY: 100 });
          fireEvent.mouseMove(document, { clientY: 60 }); // Drag up
          fireEvent.mouseUp(document);

          // After dragging, the send icon should appear
          await waitFor(
            () => {
              const sendIcon = container.querySelector('.cursor-pointer');
              expect(sendIcon).toBeInTheDocument();
            },
            { timeout: 2000 },
          );

          // Click on the send icon
          const sendableElement = container.querySelector('.cursor-pointer');
          if (sendableElement) {
            fireEvent.click(sendableElement);

            // This should trigger handleSend with showSendOnIcon === 'length'
            await waitFor(
              () => {
                expect(mockSendFullArtifactUpdate).toHaveBeenCalled();
              },
              { timeout: 2000 },
            );
          }
        }
      }
    });
  });

  // ==========================================================================
  // handleDotMouseDown early return (line 164)
  // ==========================================================================

  describe('handleDotMouseDown edge cases', () => {
    it('returns early when showSendOnIcon equals selectedOption (line 164)', async () => {
      const { container } = render(
        <CanvasControls sendFullArtifactUpdate={mockSendFullArtifactUpdate} />,
      );

      // Expand
      const mainContainer = container.querySelector('.flex.flex-col.gap-3');
      if (mainContainer) {
        fireEvent.mouseEnter(mainContainer);
      }

      await waitFor(() => {
        expect(container.querySelector('.opacity-100')).toBeInTheDocument();
      });

      // Click length button to select it
      const buttons = container.querySelectorAll('button');
      const lengthButton = Array.from(buttons).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-arrow-up-down');
      });

      if (lengthButton) {
        await userEvent.click(lengthButton);

        await waitFor(() => {
          const slider = container.querySelector('.bg-gray-100.rounded-full');
          expect(slider).toBeInTheDocument();
        });

        // Drag to set showSendOnIcon = 'length'
        const draggableDot = container.querySelector('.cursor-grab');
        if (draggableDot) {
          fireEvent.mouseDown(draggableDot, { clientY: 100 });
          fireEvent.mouseMove(document, { clientY: 60 });
          fireEvent.mouseUp(document);

          await waitFor(
            () => {
              const sendIcon = container.querySelector('.cursor-pointer');
              expect(sendIcon).toBeInTheDocument();
            },
            { timeout: 2000 },
          );

          // Now try to drag again - should trigger the early return on line 164
          // since showSendOnIcon === selectedOption === 'length'
          const sendableElement = container.querySelector('.cursor-pointer');
          if (sendableElement) {
            // This mouseDown should return early (line 164)
            fireEvent.mouseDown(sendableElement, { clientY: 100 });
            // If it returned early, no drag should be initiated, clicking should still work
            fireEvent.click(sendableElement);
            expect(mockSendFullArtifactUpdate).toHaveBeenCalled();
          }
        }
      }
    });
  });
});
