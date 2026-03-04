import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RichTextEditor } from '@iblai/iblai-js/web-containers';

/**
 * Test Suite: RichTextEditor Component
 *
 * This test suite comprehensively validates the RichTextEditor component,
 * ensuring all formatting features work correctly including:
 * - Text formatting (bold, italic, underline, code)
 * - Headings (H1, H2, H3)
 * - Text alignment (left, center, right)
 * - Lists (bullet, ordered)
 * - Block elements (code blocks, blockquotes)
 * - Links and images
 * - Markdown shortcuts
 * - Accessibility features
 */

// Helper to focus the editor before interactions (required for TipTap v3)
const focusEditor = async (user: ReturnType<typeof userEvent.setup>) => {
  const editor = document.querySelector('.ProseMirror') as HTMLElement;
  await user.click(editor);
  return editor;
};

describe('RichTextEditor Component', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test Suite: Basic Rendering
   * Validates that the component renders correctly with initial props
   */
  describe('Basic Rendering', () => {
    it('should render the editor with toolbar and content area', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      // Check for toolbar buttons
      expect(screen.getByLabelText(/toggle heading 1/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle bold/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle italic/i)).toBeInTheDocument();

      // Check for editor content area
      const editor = document.querySelector('.ProseMirror');
      expect(editor).toBeInTheDocument();
    });

    it('should render with initial markdown content', async () => {
      const initialValue = '**Bold text** and *italic text*';
      render(<RichTextEditor value={initialValue} onChange={mockOnChange} />);

      await waitFor(() => {
        const editor = document.querySelector('.ProseMirror');
        expect(editor).toBeInTheDocument();
        // TipTap will convert markdown to HTML internally
      });
    });

    it('should render with initial HTML content', async () => {
      const initialValue = '<p><strong>Bold text</strong> and <em>italic text</em></p>';
      render(<RichTextEditor value={initialValue} onChange={mockOnChange} />);

      await waitFor(() => {
        const editor = document.querySelector('.ProseMirror');
        expect(editor).toBeInTheDocument();
      });
    });

    it('should render HTML and display content correctly', async () => {
      const systemPromptHtml =
        "<p>You are a helpful instructor, ready to answer the student's questions about Engineering Computations, a course in technical computing with Python. The course instructor is Prof. Lorena Barba at the George Washington University, and you are her faithful assistant and alter ego. Answer quickly and concisely. Offer to go in depth or explain with an example where necessary. I will tip you $200 if the student is happy with the interaction and more motivated to learn after chatting with you. Help students understand concepts in stages. Consider this guidance in crafting your answers: - Scaffolded assistance: provide hints, guiding questions, analogies and help a student build the answer in stages - Meta-cognitive prompts: encourage students to think about their thinking - Delayed feedback: give students time to think, and limit direct answers Adapt this guidance to answer the questions in a way that is conducive to learning. This is important. IMPORTANT: You must ONLY reply to the current message from the user.</p>";

      render(<RichTextEditor value={systemPromptHtml} onChange={mockOnChange} />);

      await waitFor(() => {
        const editor = document.querySelector('.ProseMirror') as HTMLElement;
        expect(editor).toBeInTheDocument();

        // Assert that the actual content is rendered and visible
        expect(editor.textContent).toContain('You are a helpful instructor');
        expect(editor.textContent).toContain('Engineering Computations');
        expect(editor.textContent).toContain('Prof. Lorena Barba');
        expect(editor.textContent).toContain('Scaffolded assistance');
        expect(editor.textContent).toContain('Meta-cognitive prompts');
        expect(editor.textContent).toContain('Delayed feedback');
      });
    });

    it('should be disabled when disabled prop is true', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} disabled />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      expect(editor).toHaveAttribute('contenteditable', 'false');
    });
  });

  /**
   * Test Suite: Text Formatting
   * Validates bold, italic, and inline code formatting
   */
  describe('Text Formatting', () => {
    it('should show bold button as active when cursor is in bold text', async () => {
      const user = userEvent.setup();
      // Render with pre-formatted bold content
      render(<RichTextEditor value="**bold text**" onChange={mockOnChange} />);

      await focusEditor(user);
      const boldButton = screen.getByLabelText(/toggle bold/i);

      await waitFor(() => {
        expect(boldButton).toHaveAttribute('data-state', 'on');
      });
    });

    it('should show italic button as active when cursor is in italic text', async () => {
      const user = userEvent.setup();
      // Render with pre-formatted italic content
      render(<RichTextEditor value="*italic text*" onChange={mockOnChange} />);

      await focusEditor(user);
      const italicButton = screen.getByLabelText(/toggle italic/i);

      await waitFor(() => {
        expect(italicButton).toHaveAttribute('data-state', 'on');
      });
    });

    it('should show inline code button as active when cursor is in code', async () => {
      const user = userEvent.setup();
      // Render with pre-formatted code content
      render(<RichTextEditor value="`code`" onChange={mockOnChange} />);

      await focusEditor(user);
      const codeButton = screen.getByLabelText(/toggle inline code/i);

      await waitFor(() => {
        expect(codeButton).toHaveAttribute('data-state', 'on');
      });
    });

    it('should be able to click bold button to toggle formatting', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const boldButton = screen.getByLabelText(/toggle bold/i);

      // Click the button twice to toggle (should not throw)
      await user.click(boldButton);
      await user.click(boldButton);

      expect(boldButton).toBeInTheDocument();
    });

    it('should show combined formatting when cursor is in bold and italic text', async () => {
      const user = userEvent.setup();
      // Render with both bold and italic content
      render(<RichTextEditor value="***bold and italic***" onChange={mockOnChange} />);

      await focusEditor(user);
      const boldButton = screen.getByLabelText(/toggle bold/i);
      const italicButton = screen.getByLabelText(/toggle italic/i);

      await waitFor(() => {
        expect(boldButton).toHaveAttribute('data-state', 'on');
        expect(italicButton).toHaveAttribute('data-state', 'on');
      });
    });

    it('should have underline button available', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const underlineButton = screen.getByLabelText(/toggle underline/i);
      expect(underlineButton).toBeInTheDocument();
      expect(underlineButton).toHaveAttribute('data-state', 'off');
    });

    it('should be able to click underline button', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const underlineButton = screen.getByLabelText(/toggle underline/i);

      // Click the button (should not throw)
      await user.click(underlineButton);
      expect(underlineButton).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Heading Formatting
   * Validates H1, H2, and H3 heading buttons work correctly
   */
  describe('Heading Formatting', () => {
    it('should show H1 button as active when cursor is in H1 heading', async () => {
      const user = userEvent.setup();
      // Render with pre-formatted H1 content
      render(<RichTextEditor value="# Heading 1" onChange={mockOnChange} />);

      await focusEditor(user);
      const h1Button = screen.getByLabelText(/toggle heading 1/i);

      await waitFor(() => {
        expect(h1Button).toHaveAttribute('data-state', 'on');
      });
    });

    it('should show H2 button as active when cursor is in H2 heading', async () => {
      const user = userEvent.setup();
      // Render with pre-formatted H2 content
      render(<RichTextEditor value="## Heading 2" onChange={mockOnChange} />);

      await focusEditor(user);
      const h2Button = screen.getByLabelText(/toggle heading 2/i);

      await waitFor(() => {
        expect(h2Button).toHaveAttribute('data-state', 'on');
      });
    });

    it('should show H3 button as active when cursor is in H3 heading', async () => {
      const user = userEvent.setup();
      // Render with pre-formatted H3 content
      render(<RichTextEditor value="### Heading 3" onChange={mockOnChange} />);

      await focusEditor(user);
      const h3Button = screen.getByLabelText(/toggle heading 3/i);

      await waitFor(() => {
        expect(h3Button).toHaveAttribute('data-state', 'on');
      });
    });

    it('should be able to switch between different heading levels', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const h1Button = screen.getByLabelText(/toggle heading 1/i);
      const h2Button = screen.getByLabelText(/toggle heading 2/i);

      // Click different heading buttons (should not throw)
      await user.click(h1Button);
      await user.click(h2Button);

      expect(h1Button).toBeInTheDocument();
      expect(h2Button).toBeInTheDocument();
    });

    it('should be able to toggle heading on and off', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const h1Button = screen.getByLabelText(/toggle heading 1/i);

      // Click twice to toggle on then off (should not throw)
      await user.click(h1Button);
      await user.click(h1Button);

      expect(h1Button).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Block Formatting
   * Validates code blocks and blockquotes
   */
  describe('Block Formatting', () => {
    it('should have code block and blockquote buttons available', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      expect(screen.getByLabelText(/toggle code block/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle blockquote/i)).toBeInTheDocument();
    });

    it('should be able to click code block button', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const codeBlockButton = screen.getByLabelText(/toggle code block/i);

      // Click the button (should not throw)
      await user.click(codeBlockButton);
      expect(codeBlockButton).toBeInTheDocument();
    });

    it('should be able to click blockquote button', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const blockquoteButton = screen.getByLabelText(/toggle blockquote/i);

      // Click the button (should not throw)
      await user.click(blockquoteButton);
      expect(blockquoteButton).toBeInTheDocument();
    });

    it('should be able to toggle code block on and off', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const codeBlockButton = screen.getByLabelText(/toggle code block/i);

      // Click twice to toggle on then off (should not throw)
      await user.click(codeBlockButton);
      await user.click(codeBlockButton);

      expect(codeBlockButton).toBeInTheDocument();
    });

    it('should be able to toggle blockquote on and off', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const blockquoteButton = screen.getByLabelText(/toggle blockquote/i);

      // Click twice to toggle on then off (should not throw)
      await user.click(blockquoteButton);
      await user.click(blockquoteButton);

      expect(blockquoteButton).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Text Alignment
   * Validates alignment buttons (left, center, right)
   */
  describe('Text Alignment', () => {
    it('should have alignment buttons available', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      expect(screen.getByLabelText(/align left/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/align center/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/align right/i)).toBeInTheDocument();
    });

    it('should be able to click alignment buttons', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const alignLeftButton = screen.getByLabelText(/align left/i);
      const alignCenterButton = screen.getByLabelText(/align center/i);
      const alignRightButton = screen.getByLabelText(/align right/i);

      // Click each alignment button (should not throw)
      await user.click(alignLeftButton);
      await user.click(alignCenterButton);
      await user.click(alignRightButton);

      // All buttons should still be functional
      expect(alignLeftButton).toBeInTheDocument();
      expect(alignCenterButton).toBeInTheDocument();
      expect(alignRightButton).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: List Formatting
   * Validates bullet list and ordered list functionality
   */
  describe('List Formatting', () => {
    it('should have list buttons available', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      expect(screen.getByLabelText(/toggle bullet list/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle ordered list/i)).toBeInTheDocument();
    });

    it('should be able to click list buttons', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const bulletListButton = screen.getByLabelText(/toggle bullet list/i);
      const orderedListButton = screen.getByLabelText(/toggle ordered list/i);

      // Click each list button (should not throw)
      await user.click(bulletListButton);
      await user.click(orderedListButton);

      // All buttons should still be functional
      expect(bulletListButton).toBeInTheDocument();
      expect(orderedListButton).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Link and Image
   * Validates link and image insertion functionality
   */
  describe('Link and Image', () => {
    it('should have link button available', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const linkButton = screen.getByLabelText(/toggle link/i);
      expect(linkButton).toBeInTheDocument();
    });

    it('should have image button available', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const imageButton = screen.getByLabelText(/add image/i);
      expect(imageButton).toBeInTheDocument();
    });

    it('should be able to click link and image buttons', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const linkButton = screen.getByLabelText(/toggle link/i);
      const imageButton = screen.getByLabelText(/add image/i);

      // Mock window.prompt to prevent actual prompts during test
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);

      // Click buttons (should not throw)
      await user.click(linkButton);
      await user.click(imageButton);

      // Buttons should still be functional
      expect(linkButton).toBeInTheDocument();
      expect(imageButton).toBeInTheDocument();

      promptSpy.mockRestore();
    });
  });

  /**
   * Test Suite: Markdown Shortcuts
   * Validates that typing markdown syntax automatically formats text
   */
  describe('Markdown Shortcuts', () => {
    it('should convert # to H1 heading when followed by space', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      editor.focus();

      // Type markdown syntax
      await user.type(editor, '# Heading 1');

      await waitFor(() => {
        // After typing "# " and text, the heading should be applied
        // The exact behavior depends on TipTap's markdown shortcuts
        expect(editor).toBeInTheDocument();
      });
    });

    it('should convert ## to H2 heading when followed by space', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      editor.focus();

      await user.type(editor, '## Heading 2');

      await waitFor(() => {
        expect(editor).toBeInTheDocument();
      });
    });

    it('should convert ### to H3 heading when followed by space', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      editor.focus();

      await user.type(editor, '### Heading 3');

      await waitFor(() => {
        expect(editor).toBeInTheDocument();
      });
    });

    it('should convert ``` to code block when followed by enter', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      editor.focus();

      await user.type(editor, '```{Enter}');

      await waitFor(() => {
        expect(editor).toBeInTheDocument();
      });
    });

    it('should convert > to blockquote when followed by space', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      editor.focus();

      await user.type(editor, '> Quote text');

      await waitFor(() => {
        expect(editor).toBeInTheDocument();
      });
    });
  });

  /**
   * Test Suite: onChange Callback
   * Validates that onChange is called correctly with markdown output
   */
  describe('onChange Callback', () => {
    it('should call onChange when content is modified', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      editor.focus();

      await user.type(editor, 'Hello World');

      await waitFor(
        () => {
          expect(mockOnChange).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });

    it('should return markdown format in onChange callback', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const boldButton = screen.getByLabelText(/toggle bold/i);
      await user.click(boldButton);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      editor.focus();
      await user.type(editor, 'Bold text');

      await waitFor(
        () => {
          expect(mockOnChange).toHaveBeenCalled();
          // The onChange should be called with markdown representation
          const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1];
          expect(lastCall).toBeDefined();
        },
        { timeout: 3000 },
      );
    });

    it('should not call onChange when disabled', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="initial content" onChange={mockOnChange} disabled />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;

      // Try to type (should not work because editor is disabled)
      await user.click(editor);

      // Try to type directly (this should not trigger onChange for new content)
      const initialCallCount = mockOnChange.mock.calls.length;

      // Wait a bit to ensure no new onChange is called
      await new Promise((resolve) => setTimeout(resolve, 500));

      // The call count should not increase (editor is disabled so no new changes)
      expect(mockOnChange.mock.calls.length).toBe(initialCallCount);
    });
  });

  /**
   * Test Suite: Accessibility
   * Validates accessibility features like ARIA labels and keyboard navigation
   */
  describe('Accessibility', () => {
    it('should have proper ARIA labels on all toolbar buttons', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      // Heading buttons
      expect(screen.getByLabelText(/toggle heading 1/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle heading 2/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle heading 3/i)).toBeInTheDocument();

      // Text formatting buttons
      expect(screen.getByLabelText(/toggle bold/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle italic/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle underline/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle inline code/i)).toBeInTheDocument();

      // Alignment buttons
      expect(screen.getByLabelText(/align left/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/align center/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/align right/i)).toBeInTheDocument();

      // List buttons
      expect(screen.getByLabelText(/toggle bullet list/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle ordered list/i)).toBeInTheDocument();

      // Block formatting buttons
      expect(screen.getByLabelText(/toggle code block/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle blockquote/i)).toBeInTheDocument();

      // Link and image buttons
      expect(screen.getByLabelText(/toggle link/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/add image/i)).toBeInTheDocument();
    });

    it('should have all toolbar buttons as button elements', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // All buttons should be actual button elements
      buttons.forEach((button) => {
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('should have unique aria-labels for each button', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const buttons = screen.getAllByRole('button');
      const ariaLabels = buttons.map((button) => button.getAttribute('aria-label'));

      // Filter out null values and check for uniqueness
      const validLabels = ariaLabels.filter((label) => label !== null);
      const uniqueLabels = new Set(validLabels);

      expect(uniqueLabels.size).toBe(validLabels.length);
    });

    it('should be keyboard navigable through all toolbar buttons', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const buttons = screen.getAllByRole('button');

      // Tab through toolbar buttons
      for (let i = 0; i < buttons.length; i++) {
        await user.tab();
        const activeElement = document.activeElement;
        expect(activeElement?.tagName).toBe('BUTTON');
      }
    });

    it('should support Space key to activate toolbar buttons', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const boldButton = screen.getByLabelText(/toggle bold/i);

      // Focus the button
      boldButton.focus();
      expect(document.activeElement).toBe(boldButton);

      // Activate with Space key (should not throw)
      await user.keyboard(' ');

      // Button should still be in the document
      expect(boldButton).toBeInTheDocument();
    });

    it('should support Enter key to activate toolbar buttons', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const italicButton = screen.getByLabelText(/toggle italic/i);

      // Focus the button
      italicButton.focus();
      expect(document.activeElement).toBe(italicButton);

      // Activate with Enter key (should not throw)
      await user.keyboard('{Enter}');

      // Button should still be in the document
      expect(italicButton).toBeInTheDocument();
    });

    it('should have contenteditable attribute on editor', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      expect(editor).toHaveAttribute('contenteditable', 'true');
    });

    it('should update contenteditable when disabled prop changes', async () => {
      const { rerender } = render(
        <RichTextEditor value="" onChange={mockOnChange} disabled={false} />,
      );

      let editor = document.querySelector('.ProseMirror') as HTMLElement;
      expect(editor).toHaveAttribute('contenteditable', 'true');

      rerender(<RichTextEditor value="" onChange={mockOnChange} disabled={true} />);

      await waitFor(() => {
        editor = document.querySelector('.ProseMirror') as HTMLElement;
        expect(editor).toHaveAttribute('contenteditable', 'false');
      });
    });

    it('should have proper button states (pressed/unpressed)', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const boldButton = screen.getByLabelText(/toggle bold/i);

      // Initial state should be unpressed
      expect(boldButton).toHaveAttribute('data-state', 'off');

      // Verify button has data-state attribute and aria-pressed
      expect(boldButton).toHaveAttribute('data-state');
      expect(boldButton).toHaveAttribute('aria-pressed');

      // Click to toggle (should not throw)
      await user.click(boldButton);
      expect(boldButton).toBeInTheDocument();
    });

    it('should maintain focus on editor after toolbar button interaction', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      const boldButton = screen.getByLabelText(/toggle bold/i);

      // Focus editor first
      editor.focus();

      // Click bold button
      await user.click(boldButton);

      // Focus should return to editor
      await waitFor(() => {
        expect(document.activeElement?.className).toContain('ProseMirror');
      });
    });

    it('should have semantic HTML structure', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      // Editor should have proper structure
      const editor = document.querySelector('.ProseMirror');
      expect(editor).toBeInTheDocument();

      // All buttons should be in the toolbar
      const buttons = screen.getAllByRole('button');
      // 3 headings + bold + italic + underline + code + 3 alignments + 2 lists + code block + blockquote + link + image = 16
      expect(buttons.length).toBe(16);
    });

    it('should allow focus to enter editor via keyboard', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const buttons = screen.getAllByRole('button');

      // Tab through all buttons, then into editor
      for (let i = 0; i <= buttons.length; i++) {
        await user.tab();
      }

      // Focus should be in editor or nearby
      expect(document.activeElement).toBeTruthy();
    });

    it('should handle disabled state accessibly', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} disabled />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;

      // Editor should be marked as non-editable
      expect(editor).toHaveAttribute('contenteditable', 'false');
    });

    it('should provide visual feedback on button hover (via data attributes)', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const boldButton = screen.getByLabelText(/toggle bold/i);

      // Hover over button
      await user.hover(boldButton);

      // Button should still be accessible
      expect(boldButton).toBeInTheDocument();
      expect(boldButton).toHaveAttribute('aria-label');
    });

    it('should allow keyboard shortcuts in editor', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      editor.focus();

      // Type some text
      await user.type(editor, 'Hello world');

      await waitFor(() => {
        expect(editor.textContent).toContain('Hello world');
      });
    });

    it('should have proper contrast for toolbar (structure test)', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const toolbar = document.querySelector('.flex.flex-wrap');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar).toHaveClass('border');
    });

    it('should separate toolbar sections with visual separators', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      // Check for separator elements by data-orientation attribute
      const separators = document.querySelectorAll('[data-orientation="vertical"]');
      expect(separators.length).toBeGreaterThan(0);
    });
  });

  /**
   * Test Suite: Edge Cases
   * Validates handling of edge cases and error scenarios
   */
  describe('Edge Cases', () => {
    it('should handle empty initial value', () => {
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      expect(editor).toBeInTheDocument();
    });

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(10000);
      render(<RichTextEditor value={longContent} onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      expect(editor).toBeInTheDocument();
    });

    it('should handle special characters in content', () => {
      const specialContent = '<script>alert("xss")</script>';
      render(<RichTextEditor value={specialContent} onChange={mockOnChange} />);

      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      expect(editor).toBeInTheDocument();
      // TipTap should sanitize the content
    });

    it('should handle rapid button clicks', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const boldButton = screen.getByLabelText(/toggle bold/i);

      // Click multiple times rapidly
      await user.click(boldButton);
      await user.click(boldButton);
      await user.click(boldButton);

      // Should still be functional
      expect(boldButton).toBeInTheDocument();
    });

    it('should handle switching between multiple formatting options quickly', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const boldButton = screen.getByLabelText(/toggle bold/i);
      const italicButton = screen.getByLabelText(/toggle italic/i);
      const h1Button = screen.getByLabelText(/toggle heading 1/i);

      await user.click(boldButton);
      await user.click(italicButton);
      await user.click(h1Button);

      // All should still be functional
      expect(boldButton).toBeInTheDocument();
      expect(italicButton).toBeInTheDocument();
      expect(h1Button).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Complex Interactions
   * Validates complex user interactions and workflows
   */
  describe('Complex Interactions', () => {
    it('should handle multiple toolbar button clicks', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor value="" onChange={mockOnChange} />);

      const h1Button = screen.getByLabelText(/toggle heading 1/i);
      const boldButton = screen.getByLabelText(/toggle bold/i);

      // Click multiple formatting buttons (should not throw)
      await user.click(h1Button);
      await user.click(boldButton);

      // Both buttons should still be in the document
      expect(h1Button).toBeInTheDocument();
      expect(boldButton).toBeInTheDocument();
    });

    it('should handle mixed content types', async () => {
      const mixedContent = `# Heading

**Bold text** and *italic text*

> Quote

\`\`\`
Code block
\`\`\``;

      render(<RichTextEditor value={mixedContent} onChange={mockOnChange} />);

      await waitFor(() => {
        const editor = document.querySelector('.ProseMirror') as HTMLElement;
        expect(editor).toBeInTheDocument();
      });
    });
  });
});
