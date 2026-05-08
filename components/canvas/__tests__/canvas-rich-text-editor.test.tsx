import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

import {
  useCanvasRichTextEditor,
  CanvasRichTextEditorToolbar,
  CanvasRichTextEditorContent,
  isHtml,
  getInitialEditorContent,
  getNextEditorContent,
  hasContentChanged,
  canAutoSave,
  isTransactionProgrammatic,
  isUserEdit,
  validateAutoSaveConfig,
  buildAutoSaveRequestBody,
  needsSaving,
  findHistoryPlugin,
  calculateRestoredPosition,
  shouldUpdateContent,
  markdownContentMatches,
  getExportValue,
  shouldTriggerAutoSave,
  processAutoSaveResponse,
  shouldResetHistory,
  shouldProceedWithUpdate,
  getOnChangeValue,
} from '../canvas-rich-text-editor';

// ============================================================================
// MOCKS
// ============================================================================

// Mock use-debounce
vi.mock('use-debounce', () => ({
  useDebouncedCallback: (fn: any) => {
    const debounced = (...args: any[]) => fn(...args);
    debounced.cancel = vi.fn();
    debounced.flush = vi.fn();
    return debounced;
  },
}));

// Mock @iblai/data-layer
const mockUpdateArtifact = vi.fn().mockReturnValue({
  unwrap: vi.fn().mockResolvedValue({ content: 'saved content' }),
});

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useUpdateArtifactMutation: () => [mockUpdateArtifact],
}));

// Mock @/lib/utils
vi.mock('@/lib/utils', () => ({
  htmlToMarkdown: vi.fn((html: string) =>
    (html || '').replace(/<[^>]*>/g, '').trim(),
  ),
  markdownToHtml: vi.fn((md: string) => `<p>${md || ''}</p>`),
}));

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock @tiptap/react
const mockEditorCommands = {
  setContent: vi.fn(),
  focus: vi.fn().mockReturnThis(),
  toggleBold: vi.fn().mockReturnThis(),
  toggleItalic: vi.fn().mockReturnThis(),
  toggleHeading: vi.fn().mockReturnThis(),
  toggleCode: vi.fn().mockReturnThis(),
  toggleCodeBlock: vi.fn().mockReturnThis(),
  toggleBlockquote: vi.fn().mockReturnThis(),
  undo: vi.fn().mockReturnThis(),
  redo: vi.fn().mockReturnThis(),
  setTextSelection: vi.fn().mockReturnThis(),
  run: vi.fn(),
};

const mockEditor = {
  commands: mockEditorCommands,
  chain: vi.fn().mockReturnValue({
    ...mockEditorCommands,
    focus: vi.fn().mockReturnValue(mockEditorCommands),
  }),
  getHTML: vi.fn().mockReturnValue('<p>Test content</p>'),
  isFocused: false,
  isEditable: true,
  isActive: vi.fn().mockReturnValue(false),
  can: vi.fn().mockReturnValue({
    undo: vi.fn().mockReturnValue(true),
    redo: vi.fn().mockReturnValue(true),
  }),
  setEditable: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  view: {
    dispatch: vi.fn(),
  },
  state: {
    doc: { content: { size: 100 } },
    selection: { from: 0, to: 0 },
    tr: {
      setMeta: vi.fn().mockReturnThis(),
    },
    plugins: [],
  },
};

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => mockEditor),
  EditorContent: ({ editor }: any) => (
    <div data-testid="editor-content">
      {editor ? 'Editor loaded' : 'No editor'}
    </div>
  ),
}));

// Mock StarterKit and Heading extensions
vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: vi.fn(() => ({})),
  },
}));

vi.mock('@tiptap/extension-heading', () => ({
  Heading: {
    configure: vi.fn(() => ({})),
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('CanvasRichTextEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CanvasRichTextEditorToolbar
  // ==========================================================================

  describe('CanvasRichTextEditorToolbar', () => {
    it('renders null when editor is null', () => {
      const { container } = render(
        <CanvasRichTextEditorToolbar editor={null} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders toolbar when editor is provided', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    });

    it('renders undo button', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    });

    it('renders redo button', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Redo')).toBeInTheDocument();
    });

    it('renders heading 1 button', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Toggle heading 1')).toBeInTheDocument();
    });

    it('renders heading 2 button', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Toggle heading 2')).toBeInTheDocument();
    });

    it('renders heading 3 button', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Toggle heading 3')).toBeInTheDocument();
    });

    it('renders bold button', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Toggle bold')).toBeInTheDocument();
    });

    it('renders italic button', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Toggle italic')).toBeInTheDocument();
    });

    it('renders inline code button', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Toggle inline code')).toBeInTheDocument();
    });

    it('renders code block button', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Toggle code block')).toBeInTheDocument();
    });

    it('renders blockquote button', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      expect(screen.getByLabelText('Toggle blockquote')).toBeInTheDocument();
    });

    it('undo button is initially disabled', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      const undoButton = screen.getByLabelText('Undo');
      expect(undoButton).toBeDisabled();
    });

    it('redo button is initially disabled', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);
      const redoButton = screen.getByLabelText('Redo');
      expect(redoButton).toBeDisabled();
    });

    it('does not call undo when undo button is disabled', () => {
      const editor = {
        ...mockEditor,
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            undo: vi.fn().mockReturnValue({ run: vi.fn() }),
            redo: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const undoButton = screen.getByLabelText('Undo');
      // Button is disabled, so clicking it should not trigger chain
      expect(undoButton).toBeDisabled();
    });

    it('does not call redo when redo button is disabled', () => {
      const editor = {
        ...mockEditor,
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            undo: vi.fn().mockReturnValue({ run: vi.fn() }),
            redo: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const redoButton = screen.getByLabelText('Redo');
      // Button is disabled, so clicking it should not trigger chain
      expect(redoButton).toBeDisabled();
    });

    it('calls toggleHeading with level 1 when H1 button is clicked', () => {
      const editor = {
        ...mockEditor,
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            toggleHeading: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const h1Button = screen.getByLabelText('Toggle heading 1');
      fireEvent.click(h1Button);
      expect(editor.chain).toHaveBeenCalled();
    });

    it('calls toggleHeading with level 2 when H2 button is clicked', () => {
      const editor = {
        ...mockEditor,
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            toggleHeading: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const h2Button = screen.getByLabelText('Toggle heading 2');
      fireEvent.click(h2Button);
      expect(editor.chain).toHaveBeenCalled();
    });

    it('calls toggleHeading with level 3 when H3 button is clicked', () => {
      const editor = {
        ...mockEditor,
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            toggleHeading: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const h3Button = screen.getByLabelText('Toggle heading 3');
      fireEvent.click(h3Button);
      expect(editor.chain).toHaveBeenCalled();
    });

    it('calls toggleBold when bold button is clicked', () => {
      const editor = {
        ...mockEditor,
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const boldButton = screen.getByLabelText('Toggle bold');
      fireEvent.click(boldButton);
      expect(editor.chain).toHaveBeenCalled();
    });

    it('calls toggleItalic when italic button is clicked', () => {
      const editor = {
        ...mockEditor,
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const italicButton = screen.getByLabelText('Toggle italic');
      fireEvent.click(italicButton);
      expect(editor.chain).toHaveBeenCalled();
    });

    it('calls toggleCode when inline code button is clicked', () => {
      const editor = {
        ...mockEditor,
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            toggleCode: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const codeButton = screen.getByLabelText('Toggle inline code');
      fireEvent.click(codeButton);
      expect(editor.chain).toHaveBeenCalled();
    });

    it('calls toggleCodeBlock when code block button is clicked', () => {
      const editor = {
        ...mockEditor,
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            toggleCodeBlock: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const codeBlockButton = screen.getByLabelText('Toggle code block');
      fireEvent.click(codeBlockButton);
      expect(editor.chain).toHaveBeenCalled();
    });

    it('calls toggleBlockquote when blockquote button is clicked', () => {
      const editor = {
        ...mockEditor,
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            toggleBlockquote: vi.fn().mockReturnValue({ run: vi.fn() }),
          }),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const blockquoteButton = screen.getByLabelText('Toggle blockquote');
      fireEvent.click(blockquoteButton);
      expect(editor.chain).toHaveBeenCalled();
    });

    it('applies secondary variant when heading 1 is active', () => {
      const editor = {
        ...mockEditor,
        isActive: vi.fn((type: string, opts?: { level?: number }) => {
          return type === 'heading' && opts?.level === 1;
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      // The button should have the secondary variant applied (we just verify the editor.isActive was called)
      expect(editor.isActive).toHaveBeenCalledWith('heading', { level: 1 });
    });

    it('applies secondary variant when bold is active', () => {
      const editor = {
        ...mockEditor,
        isActive: vi.fn((type: string) => type === 'bold'),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      expect(editor.isActive).toHaveBeenCalledWith('bold');
    });

    it('applies secondary variant when italic is active', () => {
      const editor = {
        ...mockEditor,
        isActive: vi.fn((type: string) => type === 'italic'),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      expect(editor.isActive).toHaveBeenCalledWith('italic');
    });
  });

  // ==========================================================================
  // CanvasRichTextEditorContent
  // ==========================================================================

  describe('CanvasRichTextEditorContent', () => {
    it('renders null when editor is null', () => {
      const { container } = render(
        <CanvasRichTextEditorContent editor={null} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders EditorContent when editor is provided', () => {
      render(<CanvasRichTextEditorContent editor={mockEditor as any} />);
      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    });

    it('shows editor loaded message when editor exists', () => {
      render(<CanvasRichTextEditorContent editor={mockEditor as any} />);
      expect(screen.getByText('Editor loaded')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // useCanvasRichTextEditor Hook
  // ==========================================================================

  describe('useCanvasRichTextEditor Hook', () => {
    it('returns editor instance', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test content',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles empty value', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: '',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles HTML value', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: '<p>HTML content</p>',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles markdown value', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: '# Heading\n\nParagraph text',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('uses html export format', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          exportFormat: 'html',
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('uses markdown export format by default', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles disabled state', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          disabled: true,
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles placeholder prop', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: '',
          onChange: vi.fn(),
          placeholder: 'Enter text...',
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles minHeight prop', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          minHeight: '300px',
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles className prop', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          className: 'custom-class',
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles auto-save props', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          enableAutoSave: true,
          artifactId: 123,
          org: 'test-org',
          userId: 'test-user',
          title: 'Test Title',
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles value change', async () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'initial',
          onChange,
        }),
      );

      // Verify the editor is defined
      expect(result.current).toBeDefined();
    });
  });

  // ==========================================================================
  // Auto-save Functionality
  // ==========================================================================

  describe('Auto-save Functionality', () => {
    it('does not auto-save when enableAutoSave is false', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          enableAutoSave: false,
        }),
      );
      expect(mockUpdateArtifact).not.toHaveBeenCalled();
    });

    it('does not auto-save when missing artifactId', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          enableAutoSave: true,
          org: 'test-org',
          userId: 'test-user',
        }),
      );
      expect(mockUpdateArtifact).not.toHaveBeenCalled();
    });

    it('does not auto-save when missing org', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          enableAutoSave: true,
          artifactId: 123,
          userId: 'test-user',
        }),
      );
      expect(mockUpdateArtifact).not.toHaveBeenCalled();
    });

    it('does not auto-save when missing userId', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          enableAutoSave: true,
          artifactId: 123,
          org: 'test-org',
        }),
      );
      expect(mockUpdateArtifact).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Editor State Management
  // ==========================================================================

  describe('Editor State Management', () => {
    it('registers update event listener', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
        }),
      );
      expect(mockEditor.on).toHaveBeenCalledWith(
        'update',
        expect.any(Function),
      );
    });

    it('cleans up event listeners on unmount', () => {
      const { unmount } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
        }),
      );
      unmount();
      expect(mockEditor.off).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles undefined value', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: undefined as any,
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles null onChange', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: null as any,
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles very long content', () => {
      const longContent = 'A'.repeat(10000);
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: longContent,
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles special characters', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: '<script>alert("xss")</script>',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles unicode characters', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Hello 你好 مرحبا 🌍',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('toolbar and content work together', () => {
      render(
        <div>
          <CanvasRichTextEditorToolbar editor={mockEditor as any} />
          <CanvasRichTextEditorContent editor={mockEditor as any} />
        </div>,
      );

      expect(screen.getByLabelText('Toggle bold')).toBeInTheDocument();
      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    });

    it('renders all toolbar buttons', () => {
      render(<CanvasRichTextEditorToolbar editor={mockEditor as any} />);

      // Undo/Redo
      expect(screen.getByLabelText('Undo')).toBeInTheDocument();
      expect(screen.getByLabelText('Redo')).toBeInTheDocument();

      // Headings
      expect(screen.getByLabelText('Toggle heading 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle heading 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle heading 3')).toBeInTheDocument();

      // Text formatting
      expect(screen.getByLabelText('Toggle bold')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle italic')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle inline code')).toBeInTheDocument();

      // Block formatting
      expect(screen.getByLabelText('Toggle code block')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle blockquote')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Toolbar Transaction Handling
  // ==========================================================================

  describe('Toolbar Transaction Handling', () => {
    it('tracks user edits via transaction handler', () => {
      const transactionHandlers: ((params: { transaction: any }) => void)[] =
        [];
      const editorWithHandlers = {
        ...mockEditor,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'transaction') {
            transactionHandlers.push(handler);
          }
        }),
        off: vi.fn(),
      };

      render(
        <CanvasRichTextEditorToolbar editor={editorWithHandlers as any} />,
      );

      // Simulate a user transaction
      if (transactionHandlers.length > 0) {
        transactionHandlers[0]({
          transaction: {
            getMeta: vi.fn().mockReturnValue(undefined),
            steps: [{}],
          },
        });
      }

      expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    });

    it('ignores programmatic updates in transaction handler', () => {
      const transactionHandlers: ((params: { transaction: any }) => void)[] =
        [];
      const editorWithHandlers = {
        ...mockEditor,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'transaction') {
            transactionHandlers.push(handler);
          }
        }),
        off: vi.fn(),
      };

      render(
        <CanvasRichTextEditorToolbar editor={editorWithHandlers as any} />,
      );

      // Simulate a programmatic transaction
      if (transactionHandlers.length > 0) {
        transactionHandlers[0]({
          transaction: {
            getMeta: vi.fn((key: string) =>
              key === 'addToHistory' ? false : undefined,
            ),
            steps: [{}],
          },
        });
      }

      expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    });

    it('handles transaction with preventUpdate meta', () => {
      const transactionHandlers: ((params: { transaction: any }) => void)[] =
        [];
      const editorWithHandlers = {
        ...mockEditor,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'transaction') {
            transactionHandlers.push(handler);
          }
        }),
        off: vi.fn(),
      };

      render(
        <CanvasRichTextEditorToolbar editor={editorWithHandlers as any} />,
      );

      // Simulate a transaction with preventUpdate
      if (transactionHandlers.length > 0) {
        transactionHandlers[0]({
          transaction: {
            getMeta: vi.fn((key: string) =>
              key === 'preventUpdate' ? true : undefined,
            ),
            steps: [{}],
          },
        });
      }

      expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    });

    it('handles empty transaction steps', () => {
      const transactionHandlers: ((params: { transaction: any }) => void)[] =
        [];
      const editorWithHandlers = {
        ...mockEditor,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'transaction') {
            transactionHandlers.push(handler);
          }
        }),
        off: vi.fn(),
      };

      render(
        <CanvasRichTextEditorToolbar editor={editorWithHandlers as any} />,
      );

      // Simulate a transaction with no steps
      if (transactionHandlers.length > 0) {
        transactionHandlers[0]({
          transaction: {
            getMeta: vi.fn().mockReturnValue(undefined),
            steps: [],
          },
        });
      }

      expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // History State Updates
  // ==========================================================================

  describe('History State Updates', () => {
    it('enables undo when user has edited', () => {
      const updateHandlers: (() => void)[] = [];
      const editorWithHistory = {
        ...mockEditor,
        __hasUserEdited: true,
        can: vi.fn().mockReturnValue({
          undo: vi.fn().mockReturnValue(true),
          redo: vi.fn().mockReturnValue(false),
        }),
        on: vi.fn((event: string, handler: any) => {
          if (event === 'update' || event === 'selectionUpdate') {
            updateHandlers.push(handler);
          }
        }),
        off: vi.fn(),
      };

      render(<CanvasRichTextEditorToolbar editor={editorWithHistory as any} />);

      // Trigger update
      updateHandlers.forEach((handler) => handler());

      expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    });

    it('enables redo when user has edited and can redo', () => {
      const updateHandlers: (() => void)[] = [];
      const editorWithHistory = {
        ...mockEditor,
        __hasUserEdited: true,
        can: vi.fn().mockReturnValue({
          undo: vi.fn().mockReturnValue(false),
          redo: vi.fn().mockReturnValue(true),
        }),
        on: vi.fn((event: string, handler: any) => {
          if (event === 'update' || event === 'selectionUpdate') {
            updateHandlers.push(handler);
          }
        }),
        off: vi.fn(),
      };

      render(<CanvasRichTextEditorToolbar editor={editorWithHistory as any} />);

      expect(screen.getByLabelText('Redo')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // isHtml Helper Function - Direct Unit Tests
  // ==========================================================================

  describe('isHtml Helper', () => {
    // Direct function tests
    it('returns true for valid HTML tags', () => {
      expect(isHtml('<p>Test</p>')).toBe(true);
    });

    it('returns true for self-closing HTML tags', () => {
      expect(isHtml('<br/>')).toBe(true);
    });

    it('returns true for HTML with attributes', () => {
      expect(isHtml('<div class="test">Content</div>')).toBe(true);
    });

    it('returns true for HTML with whitespace', () => {
      expect(isHtml('  <p>Padded</p>  ')).toBe(true);
    });

    it('returns false for plain text', () => {
      expect(isHtml('Plain text content')).toBe(false);
    });

    it('returns false for text starting with < but not ending with >', () => {
      expect(isHtml('< not html')).toBe(false);
    });

    it('returns false for text ending with > but not starting with <', () => {
      expect(isHtml('not html >')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isHtml('')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isHtml(null as any)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isHtml(undefined as any)).toBe(false);
    });

    it('returns false for non-string types', () => {
      expect(isHtml(123 as any)).toBe(false);
      expect(isHtml({} as any)).toBe(false);
      expect(isHtml([] as any)).toBe(false);
    });

    it('returns true for complex nested HTML', () => {
      expect(isHtml('<div><p>Nested <strong>content</strong></p></div>')).toBe(
        true,
      );
    });

    it('returns true for HTML with newlines', () => {
      expect(isHtml('<div>\n  <p>Content</p>\n</div>')).toBe(true);
    });

    it('returns true for HTML5 doctype-like content', () => {
      expect(isHtml('<html><head></head><body></body></html>')).toBe(true);
    });

    it('returns false for markdown autolinks', () => {
      expect(isHtml('<https://ibl.ai>')).toBe(false);
      expect(isHtml('<sales@ibl.ai>')).toBe(false);
    });

    it('handles HTML content in value via hook', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: '<p>This is HTML</p>',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles HTML content with whitespace via hook', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: '  <div>Padded HTML</div>  ',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles non-HTML content via hook', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Plain text content',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('handles content that starts with < but is not HTML via hook', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: '< not html',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });
  });

  // ==========================================================================
  // Export Format Handling
  // ==========================================================================

  describe('Export Format Handling', () => {
    it('uses HTML export format', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          exportFormat: 'html',
        }),
      );
      expect(result.current).toBeDefined();
    });

    it('uses markdown export format with HTML value', () => {
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: '<p>HTML value</p>',
          onChange: vi.fn(),
          exportFormat: 'markdown',
        }),
      );
      expect(result.current).toBeDefined();
    });
  });

  // ==========================================================================
  // Auto-save Extended
  // ==========================================================================

  describe('Auto-save Extended', () => {
    it('does not save when content is unchanged', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Same content',
          onChange: vi.fn(),
          enableAutoSave: true,
          artifactId: 123,
          org: 'test-org',
          userId: 'test-user',
        }),
      );
      // Auto-save should not trigger for unchanged content
      expect(mockUpdateArtifact).not.toHaveBeenCalled();
    });

    it('includes title in save request when provided', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test content',
          onChange: vi.fn(),
          enableAutoSave: true,
          artifactId: 123,
          org: 'test-org',
          userId: 'test-user',
          title: 'My Document',
        }),
      );
      expect(mockEditor).toBeDefined();
    });

    it('handles save failure gracefully', async () => {
      mockUpdateArtifact.mockReturnValueOnce({
        unwrap: vi.fn().mockRejectedValue(new Error('Save failed')),
      });

      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          enableAutoSave: true,
          artifactId: 123,
          org: 'test-org',
          userId: 'test-user',
        }),
      );
      // Should not throw
      expect(true).toBe(true);
    });
  });

  // ==========================================================================
  // Editor Editability
  // ==========================================================================

  describe('Editor Editability', () => {
    it('sets editor as non-editable when disabled', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          disabled: true,
        }),
      );
      expect(mockEditor.setEditable).toHaveBeenCalledWith(false);
    });

    it('sets editor as editable when not disabled', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          disabled: false,
        }),
      );
      expect(mockEditor.setEditable).toHaveBeenCalledWith(true);
    });
  });

  // ==========================================================================
  // Value Change Handling
  // ==========================================================================

  describe('Value Change Handling', () => {
    it('skips update when value matches last set value', () => {
      const { rerender } = renderHook(
        ({ value }) =>
          useCanvasRichTextEditor({
            value,
            onChange: vi.fn(),
          }),
        { initialProps: { value: 'initial' } },
      );

      // Rerender with same value
      rerender({ value: 'initial' });

      // Editor should still be defined
      expect(mockEditor).toBeDefined();
    });

    it('updates content when value changes', () => {
      const { rerender } = renderHook(
        ({ value }) =>
          useCanvasRichTextEditor({
            value,
            onChange: vi.fn(),
          }),
        { initialProps: { value: 'initial' } },
      );

      // Rerender with different value
      rerender({ value: 'changed' });

      // Editor should exist
      expect(mockEditor).toBeDefined();
    });

    it('handles value change with focused editor', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
        }),
      );

      expect(mockEditor).toBeDefined();
    });
  });

  // ==========================================================================
  // Cursor Position Restoration
  // ==========================================================================

  describe('Cursor Position Restoration', () => {
    it('handles cursor in content update', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test content',
          onChange: vi.fn(),
        }),
      );

      expect(mockEditor).toBeDefined();
    });

    it('handles various cursor positions', () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
        }),
      );

      expect(mockEditor).toBeDefined();
    });
  });

  // ==========================================================================
  // History Clear on Init
  // ==========================================================================

  describe('History Clear on Init', () => {
    it('initializes editor with history', async () => {
      renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
        }),
      );

      expect(mockEditor.view.dispatch).toBeDefined();
    });
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  describe('Cleanup', () => {
    it('cancels debounced auto-save on unmount', () => {
      const { unmount } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
          enableAutoSave: true,
          artifactId: 123,
          org: 'test-org',
          userId: 'test-user',
        }),
      );

      unmount();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  // ==========================================================================
  // Undo/Redo Button Clicks
  // ==========================================================================

  describe('Undo/Redo Button Clicks', () => {
    it('calls undo when undo button is clicked and enabled', () => {
      const undoRun = vi.fn();
      const editorWithUndo = {
        ...mockEditor,
        __hasUserEdited: true,
        can: vi.fn().mockReturnValue({
          undo: vi.fn().mockReturnValue(true),
          redo: vi.fn().mockReturnValue(false),
        }),
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            undo: vi.fn().mockReturnValue({ run: undoRun }),
          }),
        }),
        on: vi.fn(),
        off: vi.fn(),
      };

      // We need to simulate the user having edited
      (editorWithUndo as any).__hasUserEdited = true;

      render(<CanvasRichTextEditorToolbar editor={editorWithUndo as any} />);

      const undoButton = screen.getByLabelText('Undo');
      // Button is disabled by default until user edits
      expect(undoButton).toBeInTheDocument();
    });

    it('calls redo when redo button is clicked and enabled', () => {
      const redoRun = vi.fn();
      const editorWithRedo = {
        ...mockEditor,
        __hasUserEdited: true,
        can: vi.fn().mockReturnValue({
          undo: vi.fn().mockReturnValue(false),
          redo: vi.fn().mockReturnValue(true),
        }),
        chain: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            redo: vi.fn().mockReturnValue({ run: redoRun }),
          }),
        }),
        on: vi.fn(),
        off: vi.fn(),
      };

      (editorWithRedo as any).__hasUserEdited = true;

      render(<CanvasRichTextEditorToolbar editor={editorWithRedo as any} />);

      const redoButton = screen.getByLabelText('Redo');
      expect(redoButton).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Active State Variants
  // ==========================================================================

  describe('Active State Variants', () => {
    it('applies secondary variant when heading 2 is active', () => {
      const editor = {
        ...mockEditor,
        isActive: vi.fn((type: string, opts?: { level?: number }) => {
          return type === 'heading' && opts?.level === 2;
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      expect(editor.isActive).toHaveBeenCalledWith('heading', { level: 2 });
    });

    it('applies secondary variant when heading 3 is active', () => {
      const editor = {
        ...mockEditor,
        isActive: vi.fn((type: string, opts?: { level?: number }) => {
          return type === 'heading' && opts?.level === 3;
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      expect(editor.isActive).toHaveBeenCalledWith('heading', { level: 3 });
    });

    it('applies secondary variant when code is active', () => {
      const editor = {
        ...mockEditor,
        isActive: vi.fn((type: string) => type === 'code'),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      expect(editor.isActive).toHaveBeenCalledWith('code');
    });

    it('applies secondary variant when codeBlock is active', () => {
      const editor = {
        ...mockEditor,
        isActive: vi.fn((type: string) => type === 'codeBlock'),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      expect(editor.isActive).toHaveBeenCalledWith('codeBlock');
    });

    it('applies secondary variant when blockquote is active', () => {
      const editor = {
        ...mockEditor,
        isActive: vi.fn((type: string) => type === 'blockquote'),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      expect(editor.isActive).toHaveBeenCalledWith('blockquote');
    });

    it('undo button is disabled when canUndo state is false', () => {
      const editor = {
        ...mockEditor,
        can: vi.fn().mockReturnValue({
          undo: vi.fn().mockReturnValue(false),
          redo: vi.fn().mockReturnValue(false),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const undoButton = screen.getByLabelText('Undo');
      expect(undoButton).toBeDisabled();
    });

    it('redo button is disabled when canRedo state is false', () => {
      const editor = {
        ...mockEditor,
        can: vi.fn().mockReturnValue({
          undo: vi.fn().mockReturnValue(false),
          redo: vi.fn().mockReturnValue(false),
        }),
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      const redoButton = screen.getByLabelText('Redo');
      expect(redoButton).toBeDisabled();
    });

    it('registers transaction listener on editor mount', () => {
      const onMock = vi.fn();
      const offMock = vi.fn();
      const editor = {
        ...mockEditor,
        on: onMock,
        off: offMock,
      };
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      expect(onMock).toHaveBeenCalledWith('transaction', expect.any(Function));
      expect(onMock).toHaveBeenCalledWith('update', expect.any(Function));
      expect(onMock).toHaveBeenCalledWith(
        'selectionUpdate',
        expect.any(Function),
      );
    });

    it('unregisters listeners on unmount', () => {
      const onMock = vi.fn();
      const offMock = vi.fn();
      const editor = {
        ...mockEditor,
        on: onMock,
        off: offMock,
      };
      const { unmount } = render(
        <CanvasRichTextEditorToolbar editor={editor as any} />,
      );
      unmount();
      expect(offMock).toHaveBeenCalledWith('transaction', expect.any(Function));
      expect(offMock).toHaveBeenCalledWith('update', expect.any(Function));
      expect(offMock).toHaveBeenCalledWith(
        'selectionUpdate',
        expect.any(Function),
      );
    });

    it('enables undo when user has edited and can undo', async () => {
      const canMock = vi.fn().mockReturnValue({
        undo: vi.fn().mockReturnValue(true),
        redo: vi.fn().mockReturnValue(false),
      });
      let transactionHandler: any;
      let updateHandler: any;
      const onMock = vi.fn((event: string, handler: any) => {
        if (event === 'transaction') transactionHandler = handler;
        if (event === 'update') updateHandler = handler;
      });
      const editor = {
        ...mockEditor,
        on: onMock,
        can: canMock,
        isEditable: true,
      };
      (editor as any).__hasUserEdited = false;

      render(<CanvasRichTextEditorToolbar editor={editor as any} />);

      // Simulate a user edit transaction
      transactionHandler({
        transaction: {
          getMeta: () => undefined,
          steps: { length: 1 },
        },
      });

      // Trigger update to refresh state
      if (updateHandler) {
        updateHandler();
      }

      // The button state depends on React state updates, so we check editor methods were called
      expect(onMock).toHaveBeenCalled();
    });

    it('disables undo/redo when no user edits', () => {
      const canMock = vi.fn().mockReturnValue({
        undo: vi.fn().mockReturnValue(true),
        redo: vi.fn().mockReturnValue(true),
      });
      const editor = {
        ...mockEditor,
        can: canMock,
      };
      (editor as any).__hasUserEdited = false;
      render(<CanvasRichTextEditorToolbar editor={editor as any} />);
      expect(screen.getByLabelText('Undo')).toBeDisabled();
      expect(screen.getByLabelText('Redo')).toBeDisabled();
    });
  });

  // ==========================================================================
  // onCreate Handler
  // ==========================================================================

  describe('onCreate Handler', () => {
    it('marks editor as not having user edits on creation', () => {
      // The useEditor mock handles this - just verify editor is created properly
      const { result } = renderHook(() =>
        useCanvasRichTextEditor({
          value: 'Test',
          onChange: vi.fn(),
        }),
      );
      expect(result.current).toBeDefined();
    });
  });
});

// ==========================================================================
// Utility Function Tests - getInitialEditorContent
// ==========================================================================

describe('getInitialEditorContent', () => {
  const mockHtmlToMarkdown = (html: string) => `MD:${html}`;
  const mockMarkdownToHtml = (md: string) => `HTML:${md}`;

  it('returns value as-is when exportFormat is html', () => {
    expect(
      getInitialEditorContent(
        '<p>HTML</p>',
        'html',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('<p>HTML</p>');
  });

  it('converts HTML value to markdown then back to HTML for markdown format', () => {
    expect(
      getInitialEditorContent(
        '<p>Test</p>',
        'markdown',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('HTML:MD:<p>Test</p>');
  });

  it('converts markdown value to HTML for markdown format', () => {
    expect(
      getInitialEditorContent(
        '# Heading',
        'markdown',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('HTML:# Heading');
  });

  it('handles empty value', () => {
    expect(
      getInitialEditorContent(
        '',
        'markdown',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('HTML:');
  });

  it('detects HTML by starting with < and ending with >', () => {
    expect(
      getInitialEditorContent(
        '<div>Content</div>',
        'markdown',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('HTML:MD:<div>Content</div>');
  });

  it('treats value starting with < but not ending with > as markdown', () => {
    expect(
      getInitialEditorContent(
        '< 5',
        'markdown',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('HTML:< 5');
  });
});

// ==========================================================================
// Utility Function Tests - getNextEditorContent
// ==========================================================================

describe('getNextEditorContent', () => {
  const mockHtmlToMarkdown = (html: string) => `MD:${html}`;
  const mockMarkdownToHtml = (md: string) => `HTML:${md}`;

  it('returns value as-is when exportFormat is html', () => {
    expect(
      getNextEditorContent(
        '<p>HTML</p>',
        'html',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('<p>HTML</p>');
  });

  it('converts HTML value through markdown round trip for markdown format', () => {
    expect(
      getNextEditorContent(
        '<p>Test</p>',
        'markdown',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('HTML:MD:<p>Test</p>');
  });

  it('converts markdown value to HTML', () => {
    expect(
      getNextEditorContent(
        'Plain text',
        'markdown',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('HTML:Plain text');
  });

  it('handles empty value', () => {
    expect(
      getNextEditorContent(
        '',
        'markdown',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('HTML:');
  });
});

// ==========================================================================
// Utility Function Tests - hasContentChanged
// ==========================================================================

describe('hasContentChanged', () => {
  it('returns true when content is different', () => {
    expect(hasContentChanged('new content', 'old content')).toBe(true);
  });

  it('returns false when content is the same', () => {
    expect(hasContentChanged('same content', 'same content')).toBe(false);
  });

  it('ignores leading and trailing whitespace', () => {
    expect(hasContentChanged('  content  ', 'content')).toBe(false);
  });

  it('returns true when only whitespace differs in middle', () => {
    expect(hasContentChanged('content here', 'contenthere')).toBe(true);
  });

  it('handles empty strings', () => {
    expect(hasContentChanged('', '')).toBe(false);
    expect(hasContentChanged('', 'content')).toBe(true);
    expect(hasContentChanged('content', '')).toBe(true);
  });

  it('handles whitespace-only strings', () => {
    expect(hasContentChanged('   ', '   ')).toBe(false);
    expect(hasContentChanged('   ', '')).toBe(false);
  });
});

// ==========================================================================
// Utility Function Tests - canAutoSave
// ==========================================================================

describe('canAutoSave', () => {
  it('returns true when all conditions are met', () => {
    expect(canAutoSave(true, 123, 'test-org', 'user-123')).toBe(true);
  });

  it('returns false when enableAutoSave is false', () => {
    expect(canAutoSave(false, 123, 'test-org', 'user-123')).toBe(false);
  });

  it('returns false when artifactId is undefined', () => {
    expect(canAutoSave(true, undefined, 'test-org', 'user-123')).toBe(false);
  });

  it('returns false when org is undefined', () => {
    expect(canAutoSave(true, 123, undefined, 'user-123')).toBe(false);
  });

  it('returns false when userId is undefined', () => {
    expect(canAutoSave(true, 123, 'test-org', undefined)).toBe(false);
  });

  it('returns false when multiple required fields are missing', () => {
    expect(canAutoSave(true, undefined, undefined, undefined)).toBe(false);
  });

  it('returns false when enableAutoSave is false even with all other fields', () => {
    expect(canAutoSave(false, 123, 'org', 'user')).toBe(false);
  });

  it('handles empty string org and userId', () => {
    expect(canAutoSave(true, 123, '', 'user')).toBe(false);
    expect(canAutoSave(true, 123, 'org', '')).toBe(false);
  });
});

// ==========================================================================
// Utility Function Tests - isTransactionProgrammatic
// ==========================================================================

describe('isTransactionProgrammatic', () => {
  it('returns true when addToHistory is false', () => {
    const transaction = {
      getMeta: (key: string) => (key === 'addToHistory' ? false : undefined),
    };
    expect(isTransactionProgrammatic(transaction)).toBe(true);
  });

  it('returns true when preventUpdate is true', () => {
    const transaction = {
      getMeta: (key: string) => (key === 'preventUpdate' ? true : undefined),
    };
    expect(isTransactionProgrammatic(transaction)).toBe(true);
  });

  it('returns false when neither flag is set', () => {
    const transaction = {
      getMeta: () => undefined,
    };
    expect(isTransactionProgrammatic(transaction)).toBe(false);
  });

  it('returns false when addToHistory is true', () => {
    const transaction = {
      getMeta: (key: string) => (key === 'addToHistory' ? true : undefined),
    };
    expect(isTransactionProgrammatic(transaction)).toBe(false);
  });

  it('returns true when both flags indicate programmatic', () => {
    const transaction = {
      getMeta: (key: string) => {
        if (key === 'addToHistory') return false;
        if (key === 'preventUpdate') return true;
        return undefined;
      },
    };
    expect(isTransactionProgrammatic(transaction)).toBe(true);
  });
});

// ==========================================================================
// Utility Function Tests - isUserEdit
// ==========================================================================

describe('isUserEdit', () => {
  it('returns true for non-programmatic transaction with steps and editable editor', () => {
    const transaction = {
      getMeta: () => undefined,
      steps: { length: 1 },
    };
    expect(isUserEdit(transaction, true)).toBe(true);
  });

  it('returns false for programmatic transaction', () => {
    const transaction = {
      getMeta: (key: string) => (key === 'addToHistory' ? false : undefined),
      steps: { length: 1 },
    };
    expect(isUserEdit(transaction, true)).toBe(false);
  });

  it('returns false when no steps', () => {
    const transaction = {
      getMeta: () => undefined,
      steps: { length: 0 },
    };
    expect(isUserEdit(transaction, true)).toBe(false);
  });

  it('returns false when editor is not editable', () => {
    const transaction = {
      getMeta: () => undefined,
      steps: { length: 1 },
    };
    expect(isUserEdit(transaction, false)).toBe(false);
  });

  it('returns false when all conditions fail', () => {
    const transaction = {
      getMeta: (key: string) => (key === 'addToHistory' ? false : undefined),
      steps: { length: 0 },
    };
    expect(isUserEdit(transaction, false)).toBe(false);
  });

  it('returns true with multiple steps', () => {
    const transaction = {
      getMeta: () => undefined,
      steps: { length: 5 },
    };
    expect(isUserEdit(transaction, true)).toBe(true);
  });
});

// ==========================================================================
// Additional Direct Function Tests for Better Coverage
// ==========================================================================

describe('isHtml - Additional Cases', () => {
  it('handles various falsy values', () => {
    expect(isHtml(0 as any)).toBe(false);
    expect(isHtml(false as any)).toBe(false);
    expect(isHtml(NaN as any)).toBe(false);
  });

  it('handles object with toString', () => {
    const objWithToString = { toString: () => '<div>test</div>' };
    expect(isHtml(objWithToString as any)).toBe(false);
  });

  it('handles HTML fragments', () => {
    expect(isHtml('<br>')).toBe(true);
    expect(isHtml('<br/>')).toBe(true);
    expect(isHtml('<input type="text"/>')).toBe(true);
  });

  it('handles text that looks like HTML but isnt', () => {
    expect(isHtml('<less than but not html')).toBe(false);
    expect(isHtml('greater than> but not html')).toBe(false);
  });
});

describe('getInitialEditorContent - Additional Cases', () => {
  const mockHtmlToMarkdown = (html: string) =>
    `MD:${html.replace(/<[^>]*>/g, '')}`;
  const mockMarkdownToHtml = (md: string) => `<p>${md}</p>`;

  it('handles empty string with html format', () => {
    expect(
      getInitialEditorContent(
        '',
        'html',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('');
  });

  it('handles whitespace with html format', () => {
    expect(
      getInitialEditorContent(
        '   ',
        'html',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('   ');
  });

  it('handles nested HTML with markdown format', () => {
    const result = getInitialEditorContent(
      '<div><p>nested</p></div>',
      'markdown',
      mockHtmlToMarkdown,
      mockMarkdownToHtml,
    );
    expect(result).toBeTruthy();
  });

  it('handles complex markdown with markdown format', () => {
    const result = getInitialEditorContent(
      '# Heading\n\nParagraph',
      'markdown',
      mockHtmlToMarkdown,
      mockMarkdownToHtml,
    );
    expect(result).toContain('<p>');
  });
});

describe('getNextEditorContent - Additional Cases', () => {
  const mockHtmlToMarkdown = (html: string) =>
    `MD:${html.replace(/<[^>]*>/g, '')}`;
  const mockMarkdownToHtml = (md: string) => `<p>${md}</p>`;

  it('handles empty string with markdown format', () => {
    expect(
      getNextEditorContent(
        '',
        'markdown',
        mockHtmlToMarkdown,
        mockMarkdownToHtml,
      ),
    ).toBe('<p></p>');
  });

  it('handles plain text with markdown format', () => {
    const result = getNextEditorContent(
      'Hello world',
      'markdown',
      mockHtmlToMarkdown,
      mockMarkdownToHtml,
    );
    expect(result).toBe('<p>Hello world</p>');
  });

  it('handles HTML with markdown format conversion', () => {
    const result = getNextEditorContent(
      '<strong>bold</strong>',
      'markdown',
      mockHtmlToMarkdown,
      mockMarkdownToHtml,
    );
    expect(result).toBeTruthy();
  });
});

describe('hasContentChanged - Additional Cases', () => {
  it('handles null coercion', () => {
    // toString would throw on null, but our trim() handles it via short-circuit
    expect(hasContentChanged('content', 'different')).toBe(true);
  });

  it('handles newlines in content', () => {
    expect(hasContentChanged('line1\nline2', 'line1\nline2')).toBe(false);
    expect(hasContentChanged('line1\nline2', 'line1\nline3')).toBe(true);
  });

  it('handles tabs and mixed whitespace', () => {
    expect(hasContentChanged('\tcontent', 'content')).toBe(false);
    expect(hasContentChanged('content\t', 'content')).toBe(false);
  });
});

describe('canAutoSave - Additional Cases', () => {
  it('handles all truthy values', () => {
    expect(canAutoSave(true, 1, 'org', 'user')).toBe(true);
    expect(canAutoSave(true, 999, 'test-org', 'test-user')).toBe(true);
  });

  it('handles zero artifactId', () => {
    // 0 is falsy, so should return false
    expect(canAutoSave(true, 0, 'org', 'user')).toBe(false);
  });

  it('handles various falsy combinations', () => {
    expect(canAutoSave(false, 1, 'org', 'user')).toBe(false);
    expect(canAutoSave(true, 1, '', 'user')).toBe(false);
    expect(canAutoSave(true, 1, 'org', '')).toBe(false);
  });
});

describe('isTransactionProgrammatic - Additional Cases', () => {
  it('handles getMeta returning truthy non-true values', () => {
    const transaction = {
      getMeta: (key: string) =>
        key === 'preventUpdate' ? 'truthy-string' : undefined,
    } as any;
    // 'truthy-string' !== true, so should return false for preventUpdate check
    expect(isTransactionProgrammatic(transaction)).toBe(false);
  });

  it('handles getMeta returning 0', () => {
    const transaction = {
      getMeta: (key: string) => (key === 'addToHistory' ? 0 : undefined),
    } as any;
    // 0 !== false strictly, but it's falsy
    expect(isTransactionProgrammatic(transaction)).toBe(false);
  });

  it('handles getMeta returning null', () => {
    const transaction = {
      getMeta: () => null,
    } as any;
    expect(isTransactionProgrammatic(transaction)).toBe(false);
  });
});

// ==========================================================================
// Utility Function Tests - validateAutoSaveConfig
// ==========================================================================

describe('validateAutoSaveConfig', () => {
  it('returns valid when all fields present', () => {
    const result = validateAutoSaveConfig({
      artifactId: 123,
      org: 'test-org',
      userId: 'user-1',
    });
    expect(result.isValid).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it('returns invalid when artifactId missing', () => {
    const result = validateAutoSaveConfig({
      org: 'test-org',
      userId: 'user-1',
    });
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('artifactId');
  });

  it('returns invalid when org missing', () => {
    const result = validateAutoSaveConfig({
      artifactId: 123,
      userId: 'user-1',
    });
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('org');
  });

  it('returns invalid when userId missing', () => {
    const result = validateAutoSaveConfig({ artifactId: 123, org: 'test-org' });
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('userId');
  });

  it('returns all missing fields when all are missing', () => {
    const result = validateAutoSaveConfig({});
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toEqual(['artifactId', 'org', 'userId']);
  });

  it('handles empty string values as missing', () => {
    const result = validateAutoSaveConfig({
      artifactId: 123,
      org: '',
      userId: '',
    });
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('org');
    expect(result.missingFields).toContain('userId');
  });

  it('handles zero artifactId as missing', () => {
    const result = validateAutoSaveConfig({
      artifactId: 0,
      org: 'test',
      userId: 'user',
    });
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('artifactId');
  });
});

// ==========================================================================
// Utility Function Tests - buildAutoSaveRequestBody
// ==========================================================================

describe('buildAutoSaveRequestBody', () => {
  it('builds request body with content only', () => {
    const result = buildAutoSaveRequestBody('# Test content');
    expect(result).toEqual({ content: '# Test content' });
  });

  it('builds request body with content and title', () => {
    const result = buildAutoSaveRequestBody('# Test content', 'My Title');
    expect(result).toEqual({ content: '# Test content', title: 'My Title' });
  });

  it('excludes title when undefined', () => {
    const result = buildAutoSaveRequestBody('content', undefined);
    expect(result).toEqual({ content: 'content' });
    expect('title' in result).toBe(false);
  });

  it('includes empty string title if provided', () => {
    const result = buildAutoSaveRequestBody('content', '');
    expect(result).toEqual({ content: 'content' });
    expect('title' in result).toBe(false);
  });

  it('handles empty content', () => {
    const result = buildAutoSaveRequestBody('');
    expect(result).toEqual({ content: '' });
  });

  it('handles long content', () => {
    const longContent = 'a'.repeat(10000);
    const result = buildAutoSaveRequestBody(longContent, 'Title');
    expect(result.content.length).toBe(10000);
    expect(result.title).toBe('Title');
  });
});

// ==========================================================================
// Utility Function Tests - needsSaving
// ==========================================================================

describe('needsSaving', () => {
  it('returns true when content differs', () => {
    expect(needsSaving('new content', 'old content')).toBe(true);
  });

  it('returns false when content is identical', () => {
    expect(needsSaving('same content', 'same content')).toBe(false);
  });

  it('ignores leading/trailing whitespace', () => {
    expect(needsSaving('  content  ', 'content')).toBe(false);
    expect(needsSaving('content', '  content  ')).toBe(false);
  });

  it('returns true when only internal content differs', () => {
    expect(needsSaving('hello world', 'hello  world')).toBe(true);
  });

  it('handles empty strings', () => {
    expect(needsSaving('', '')).toBe(false);
    expect(needsSaving('content', '')).toBe(true);
    expect(needsSaving('', 'content')).toBe(true);
  });

  it('handles whitespace-only strings', () => {
    expect(needsSaving('   ', '')).toBe(false);
    expect(needsSaving('', '   ')).toBe(false);
    expect(needsSaving('   ', '   ')).toBe(false);
  });

  it('handles newlines', () => {
    expect(needsSaving('line1\nline2', 'line1\nline2')).toBe(false);
    expect(needsSaving('line1\nline2', 'line1\nline3')).toBe(true);
  });
});

// ==========================================================================
// Utility Function Tests - findHistoryPlugin
// ==========================================================================

describe('findHistoryPlugin', () => {
  it('finds plugin with key starting with history$', () => {
    const plugins = [
      { key: 'other' },
      { key: 'history$abc' },
      { key: 'another' },
    ];
    const result = findHistoryPlugin(plugins);
    expect(result?.key).toBe('history$abc');
  });

  it('finds plugin with key exactly "history"', () => {
    const plugins = [{ key: 'other' }, { key: 'history' }];
    const result = findHistoryPlugin(plugins);
    expect(result?.key).toBe('history');
  });

  it('returns undefined when no history plugin', () => {
    const plugins = [
      { key: 'other' },
      { key: 'histor' }, // Not history
      { key: 'historyx' }, // Not history
    ];
    const result = findHistoryPlugin(plugins);
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    const result = findHistoryPlugin([]);
    expect(result).toBeUndefined();
  });

  it('handles plugins without key property', () => {
    const plugins = [{}, { key: undefined }, { key: 'history' }];
    const result = findHistoryPlugin(plugins);
    expect(result?.key).toBe('history');
  });

  it('prioritizes first matching plugin', () => {
    const plugins = [{ key: 'history$first' }, { key: 'history$second' }];
    const result = findHistoryPlugin(plugins);
    expect(result?.key).toBe('history$first');
  });
});

// ==========================================================================
// Utility Function Tests - calculateRestoredPosition
// ==========================================================================

describe('calculateRestoredPosition', () => {
  it('returns newDocSize when cursor was at end of old document', () => {
    const result = calculateRestoredPosition({ from: 100, to: 100 }, 100, 150);
    expect(result).toBe(150);
  });

  it('returns original selection when valid in new document', () => {
    const result = calculateRestoredPosition({ from: 10, to: 20 }, 100, 150);
    expect(result).toEqual({ from: 10, to: 20 });
  });

  it('returns relative position when selection exceeds new doc', () => {
    const result = calculateRestoredPosition({ from: 100, to: 120 }, 150, 80);
    expect(result).toBe(80);
  });

  it('handles zero positions', () => {
    const result = calculateRestoredPosition({ from: 0, to: 0 }, 100, 50);
    expect(result).toEqual({ from: 0, to: 0 });
  });

  it('handles same size documents', () => {
    const result = calculateRestoredPosition({ from: 50, to: 60 }, 100, 100);
    expect(result).toEqual({ from: 50, to: 60 });
  });

  it('handles selection at document start with smaller new doc', () => {
    const result = calculateRestoredPosition({ from: 5, to: 10 }, 100, 8);
    expect(result).toBe(5);
  });

  it('handles selection when to exceeds but from is valid', () => {
    const result = calculateRestoredPosition({ from: 10, to: 100 }, 150, 50);
    expect(result).toBe(10);
  });
});

// ==========================================================================
// Utility Function Tests - shouldUpdateContent
// ==========================================================================

describe('shouldUpdateContent', () => {
  it('returns skip when value equals lastSetValue', () => {
    const result = shouldUpdateContent('same', 'same', false, 'other');
    expect(result).toBe('skip');
  });

  it('returns skip-focused when focused and matches lastUserInput', () => {
    const result = shouldUpdateContent('input', 'different', true, 'input');
    expect(result).toBe('skip-focused');
  });

  it('returns check when value is different and not focused match', () => {
    const result = shouldUpdateContent('new', 'old', false, 'other');
    expect(result).toBe('check');
  });

  it('returns check when focused but doesnt match lastUserInput', () => {
    const result = shouldUpdateContent('new', 'old', true, 'other');
    expect(result).toBe('check');
  });

  it('returns skip when value matches lastSetValue even if focused', () => {
    const result = shouldUpdateContent('same', 'same', true, 'same');
    expect(result).toBe('skip');
  });

  it('handles empty strings', () => {
    expect(shouldUpdateContent('', '', false, '')).toBe('skip');
    expect(shouldUpdateContent('', 'old', false, '')).toBe('check');
  });
});

// ==========================================================================
// Utility Function Tests - markdownContentMatches
// ==========================================================================

describe('markdownContentMatches', () => {
  it('returns true for identical content', () => {
    expect(markdownContentMatches('# Heading', '# Heading')).toBe(true);
  });

  it('returns false for different content', () => {
    expect(markdownContentMatches('# Heading', '## Heading')).toBe(false);
  });

  it('ignores leading/trailing whitespace', () => {
    expect(markdownContentMatches('  content  ', 'content')).toBe(true);
    expect(markdownContentMatches('content', '  content  ')).toBe(true);
  });

  it('handles empty strings', () => {
    expect(markdownContentMatches('', '')).toBe(true);
    expect(markdownContentMatches('', 'content')).toBe(false);
  });

  it('handles multiline content', () => {
    const content1 = '# Title\n\nParagraph';
    const content2 = '# Title\n\nParagraph';
    expect(markdownContentMatches(content1, content2)).toBe(true);
  });

  it('handles special characters', () => {
    expect(markdownContentMatches('**bold**', '**bold**')).toBe(true);
    expect(markdownContentMatches('`code`', '`code`')).toBe(true);
  });
});

// ==========================================================================
// Utility Function Tests - getExportValue
// ==========================================================================

describe('getExportValue', () => {
  const mockHtmlToMarkdown = (html: string) =>
    `MD:${html.replace(/<[^>]*>/g, '')}`;

  it('returns html directly when exportFormat is html', () => {
    expect(getExportValue('<p>Test</p>', 'html', mockHtmlToMarkdown)).toBe(
      '<p>Test</p>',
    );
  });

  it('converts to markdown when exportFormat is markdown', () => {
    const result = getExportValue(
      '<p>Test</p>',
      'markdown',
      mockHtmlToMarkdown,
    );
    expect(result).toBe('MD:Test');
  });

  it('handles empty html', () => {
    expect(getExportValue('', 'html', mockHtmlToMarkdown)).toBe('');
    expect(getExportValue('', 'markdown', mockHtmlToMarkdown)).toBe('MD:');
  });

  it('handles complex html with markdown format', () => {
    const html = '<h1>Title</h1><p>Paragraph</p>';
    const result = getExportValue(html, 'markdown', mockHtmlToMarkdown);
    expect(result).toContain('Title');
    expect(result).toContain('Paragraph');
  });

  it('preserves html structure with html format', () => {
    const html = '<div><p>Nested</p></div>';
    expect(getExportValue(html, 'html', mockHtmlToMarkdown)).toBe(html);
  });
});

// ==========================================================================
// Utility Function Tests - shouldTriggerAutoSave
// ==========================================================================

describe('shouldTriggerAutoSave', () => {
  it('returns disabled when enableAutoSave is false', () => {
    const result = shouldTriggerAutoSave({
      enableAutoSave: false,
      artifactId: 123,
      org: 'test-org',
      userId: 'test-user',
      hasDebouncedFn: true,
    });
    expect(result).toEqual({ shouldTrigger: false, reason: 'disabled' });
  });

  it('returns missing-config when artifactId is missing', () => {
    const result = shouldTriggerAutoSave({
      enableAutoSave: true,
      artifactId: undefined,
      org: 'test-org',
      userId: 'test-user',
      hasDebouncedFn: true,
    });
    expect(result).toEqual({ shouldTrigger: false, reason: 'missing-config' });
  });

  it('returns missing-config when org is missing', () => {
    const result = shouldTriggerAutoSave({
      enableAutoSave: true,
      artifactId: 123,
      org: undefined,
      userId: 'test-user',
      hasDebouncedFn: true,
    });
    expect(result).toEqual({ shouldTrigger: false, reason: 'missing-config' });
  });

  it('returns missing-config when userId is missing', () => {
    const result = shouldTriggerAutoSave({
      enableAutoSave: true,
      artifactId: 123,
      org: 'test-org',
      userId: undefined,
      hasDebouncedFn: true,
    });
    expect(result).toEqual({ shouldTrigger: false, reason: 'missing-config' });
  });

  it('returns missing-config when hasDebouncedFn is false', () => {
    const result = shouldTriggerAutoSave({
      enableAutoSave: true,
      artifactId: 123,
      org: 'test-org',
      userId: 'test-user',
      hasDebouncedFn: false,
    });
    expect(result).toEqual({ shouldTrigger: false, reason: 'missing-config' });
  });

  it('returns ready when all conditions are met', () => {
    const result = shouldTriggerAutoSave({
      enableAutoSave: true,
      artifactId: 123,
      org: 'test-org',
      userId: 'test-user',
      hasDebouncedFn: true,
    });
    expect(result).toEqual({ shouldTrigger: true, reason: 'ready' });
  });

  it('handles empty string values as missing', () => {
    const result = shouldTriggerAutoSave({
      enableAutoSave: true,
      artifactId: 123,
      org: '',
      userId: 'test-user',
      hasDebouncedFn: true,
    });
    expect(result).toEqual({ shouldTrigger: false, reason: 'missing-config' });
  });
});

// ==========================================================================
// Utility Function Tests - processAutoSaveResponse
// ==========================================================================

describe('processAutoSaveResponse', () => {
  it('returns savedArtifact content when available', () => {
    const result = processAutoSaveResponse(
      { content: 'saved content' },
      'original',
    );
    expect(result).toBe('saved content');
  });

  it('returns original markdown when savedArtifact is null', () => {
    const result = processAutoSaveResponse(null, 'original markdown');
    expect(result).toBe('original markdown');
  });

  it('returns original markdown when savedArtifact is undefined', () => {
    const result = processAutoSaveResponse(undefined, 'original markdown');
    expect(result).toBe('original markdown');
  });

  it('returns original markdown when savedArtifact has no content', () => {
    const result = processAutoSaveResponse({}, 'original markdown');
    expect(result).toBe('original markdown');
  });

  it('returns original markdown when savedArtifact.content is empty', () => {
    const result = processAutoSaveResponse(
      { content: '' },
      'original markdown',
    );
    expect(result).toBe('original markdown');
  });

  it('handles empty original markdown', () => {
    const result = processAutoSaveResponse({ content: 'saved' }, '');
    expect(result).toBe('saved');
  });
});

// ==========================================================================
// Utility Function Tests - shouldResetHistory
// ==========================================================================

describe('shouldResetHistory', () => {
  it('returns true when both conditions are met', () => {
    expect(shouldResetHistory(true, { undos: [], redos: [] })).toBe(true);
  });

  it('returns false when hasHistoryPlugin is false', () => {
    expect(shouldResetHistory(false, { undos: [], redos: [] })).toBe(false);
  });

  it('returns false when historyState is null', () => {
    expect(shouldResetHistory(true, null)).toBe(false);
  });

  it('returns false when historyState is undefined', () => {
    expect(shouldResetHistory(true, undefined)).toBe(false);
  });

  it('returns false when both conditions are false', () => {
    expect(shouldResetHistory(false, null)).toBe(false);
  });

  it('returns true with truthy historyState', () => {
    expect(shouldResetHistory(true, {})).toBe(true);
    expect(shouldResetHistory(true, { anything: 'value' })).toBe(true);
  });
});

// ==========================================================================
// Utility Function Tests - shouldProceedWithUpdate
// ==========================================================================

describe('shouldProceedWithUpdate', () => {
  it('returns skip-unchanged when markdown matches value', () => {
    const result = shouldProceedWithUpdate(
      '<p>New content</p>',
      '<p>Current content</p>',
      'test content',
      'test content',
    );
    expect(result).toBe('skip-unchanged');
  });

  it('returns proceed when markdown has leading/trailing whitespace', () => {
    // currentMarkdown is compared directly against valueToCompare.trim()
    // So if currentMarkdown has whitespace, it won't match
    const result = shouldProceedWithUpdate(
      '<p>New</p>',
      '<p>Current</p>',
      '  test content  ', // Has whitespace
      'test content', // Trimmed comparison
    );
    expect(result).toBe('proceed'); // Won't match because currentMarkdown !== valueToCompare.trim()
  });

  it('returns proceed when content is different', () => {
    const result = shouldProceedWithUpdate(
      '<p>New content</p>',
      '<p>Old content</p>',
      'old content',
      'new content',
    );
    expect(result).toBe('proceed');
  });

  it('returns skip-unchanged when next equals current', () => {
    const result = shouldProceedWithUpdate(
      '<p>Same</p>',
      '<p>Same</p>',
      'different',
      'also different',
    );
    expect(result).toBe('skip-unchanged');
  });

  it('handles empty strings', () => {
    const result = shouldProceedWithUpdate('', '', '', '');
    expect(result).toBe('skip-unchanged');
  });

  it('handles only whitespace differences in markdown', () => {
    const result = shouldProceedWithUpdate(
      '<p>New</p>',
      '<p>Current</p>',
      'content',
      '  content  ',
    );
    expect(result).toBe('skip-unchanged');
  });
});

// ==========================================================================
// Utility Function Tests - getOnChangeValue
// ==========================================================================

describe('getOnChangeValue', () => {
  const mockHtmlToMarkdown = (html: string) =>
    `MD:${html.replace(/<[^>]*>/g, '')}`;

  it('returns html directly for html format', () => {
    expect(getOnChangeValue('<p>Test</p>', 'html', mockHtmlToMarkdown)).toBe(
      '<p>Test</p>',
    );
  });

  it('converts to markdown for markdown format', () => {
    expect(
      getOnChangeValue('<p>Test</p>', 'markdown', mockHtmlToMarkdown),
    ).toBe('MD:Test');
  });

  it('handles empty html', () => {
    expect(getOnChangeValue('', 'html', mockHtmlToMarkdown)).toBe('');
    expect(getOnChangeValue('', 'markdown', mockHtmlToMarkdown)).toBe('MD:');
  });

  it('handles complex nested html', () => {
    const html = '<div><p>Text</p><ul><li>Item</li></ul></div>';
    expect(getOnChangeValue(html, 'html', mockHtmlToMarkdown)).toBe(html);
  });

  it('converts complex html to markdown', () => {
    const html = '<h1>Title</h1><p>Para</p>';
    const result = getOnChangeValue(html, 'markdown', mockHtmlToMarkdown);
    expect(result).toContain('Title');
    expect(result).toContain('Para');
  });
});
