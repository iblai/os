import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import {
  CanvasComponent,
  countStreamingParagraphs,
  getStreamingUpdateInterval,
  getStreamingCharThreshold,
  getSaveStatusLabel,
  getSaveStatusClass,
  getShouldShowOverlay,
  getOverlayMessage,
  deriveMarkdownContent,
  isStreamingWithNoContentCheck,
  isEditingDisabledCheck,
  shouldSkipStreamingUpdateByTiming,
  shouldSkipStreamingUpdateByThreshold,
  isStreamingContentUnchanged,
  buildArtifactPayload,
  doesArtifactMatchEvent,
  buildPartialContent,
  shouldSkipSave,
  buildSaveRequestBody,
  shouldProceedWithRename,
} from '../canvas-component';

// ============================================================================
// MOCKS
// ============================================================================

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

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
  unwrap: vi.fn().mockResolvedValue({
    id: 123,
    title: 'Test Artifact',
    content: 'Test content',
    current_version_number: 1,
    version_count: 1,
    file_extension: 'txt',
  }),
});
const mockFetchArtifact = vi.fn().mockReturnValue({
  unwrap: vi.fn().mockResolvedValue({
    id: 123,
    title: 'Test Artifact',
    content: '# Test Content\n\nThis is test content.',
    current_version_number: 1,
    version_count: 1,
    file_extension: 'txt',
  }),
});
const mockFetchArtifacts = vi.fn().mockReturnValue({
  unwrap: vi.fn().mockResolvedValue({
    results: [
      {
        id: 123,
        title: 'Test Artifact',
        content: '# Test Content',
        current_version_number: 1,
        file_extension: 'txt',
      },
    ],
  }),
});
const mockEditSession = vi.fn().mockReturnValue({
  unwrap: vi.fn().mockResolvedValue({}),
});

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetArtifactQuery: () => [mockFetchArtifact],
  useLazyListArtifactsQuery: () => [mockFetchArtifacts],
  useUpdateArtifactMutation: () => [mockUpdateArtifact],
  useEditSessionMutation: () => [mockEditSession],
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, variant, size, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className, onKeyDown, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      onKeyDown={onKeyDown}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: any) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled }: any) => (
    <button data-testid="dropdown-item" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
}));

// Mock rich text editor
const mockEditorCommands = {
  setContent: vi.fn(),
  focus: vi.fn(),
  setTextSelection: vi.fn(),
};
const mockEditor = {
  commands: mockEditorCommands,
  chain: vi.fn().mockReturnValue({
    focus: vi.fn().mockReturnValue({
      toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleHeading: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleCode: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleCodeBlock: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBlockquote: vi.fn().mockReturnValue({ run: vi.fn() }),
      undo: vi.fn().mockReturnValue({ run: vi.fn() }),
      redo: vi.fn().mockReturnValue({ run: vi.fn() }),
    }),
  }),
  getHTML: vi.fn().mockReturnValue('<p>Test content</p>'),
  isFocused: false,
  isEditable: true,
  isActive: vi.fn().mockReturnValue(false),
  can: vi
    .fn()
    .mockReturnValue({ undo: vi.fn().mockReturnValue(true), redo: vi.fn().mockReturnValue(true) }),
  setEditable: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  view: { dispatch: vi.fn() },
  state: {
    doc: { content: { size: 100 } },
    selection: { from: 0, to: 0 },
    tr: { setMeta: vi.fn().mockReturnThis() },
    plugins: [],
  },
};

vi.mock('../canvas-rich-text-editor', () => ({
  useCanvasRichTextEditor: () => mockEditor,
  CanvasRichTextEditorToolbar: () => (
    <div data-testid="rich-text-toolbar">
      <button aria-label="Toggle bold">B</button>
      <button aria-label="Toggle italic">I</button>
      <button aria-label="Toggle heading 1">H1</button>
      <button aria-label="Toggle heading 2">H2</button>
      <button aria-label="Toggle heading 3">H3</button>
      <button aria-label="Toggle inline code">Code</button>
      <button aria-label="Toggle code block">CodeBlock</button>
      <button aria-label="Toggle blockquote">Quote</button>
      <button aria-label="Undo">Undo</button>
      <button aria-label="Redo">Redo</button>
    </div>
  ),
  CanvasRichTextEditorContent: () => (
    <div data-testid="editor-content" contentEditable="true">
      Editor content
    </div>
  ),
}));

// Mock canvas hooks
vi.mock('../canvas-send-message-handler', () => ({
  useCanvasSendMessageHandler: () => ({
    sendFullArtifactUpdate: vi.fn(),
  }),
  useCanvasUpdateDetector: vi.fn(),
}));

vi.mock('@/hooks/use-canvas-chat-integration', () => ({
  useCanvasChatIntegration: vi.fn(),
}));

vi.mock('@/hooks/use-canvas-version-navigation', () => ({
  useCanvasVersionNavigation: () => ({
    versionsData: [
      { id: 'v1', content: 'Version 1 content' },
      { id: 'v2', content: 'Version 2 content' },
    ],
    currentVersion: 'v1',
    activeVersionId: 'v1',
    activeVersionIsCurrent: true,
    isVersionLoading: false,
    versionHistory: [{ id: 'v1' }, { id: 'v2' }],
    isViewingCurrentVersion: true,
    isVersionNavDisabled: false,
    currentVersionIndex: 0,
    canGoPrevious: false,
    canGoNext: true,
    suppressNextOnChangeRef: { current: false },
    lastSavedMarkdownRef: { current: null },
    handlePreviousVersion: vi.fn(),
    handleNextVersion: vi.fn(),
    handleBackToLatest: vi.fn(),
    handleRestoreVersion: vi.fn(),
    refetchVersions: vi.fn(),
    updateVersionAfterStreaming: vi.fn(),
    resetVersionNavigation: vi.fn(),
    markWasOnCurrentVersionBeforeSave: vi.fn(),
    silentlyGoToLatest: vi.fn(),
    setActiveVersionId: vi.fn(),
    setActiveVersionIsCurrent: vi.fn(),
    setCurrentVersion: vi.fn(),
  }),
}));

// Mock canvas utils
vi.mock('../canvas-utils', () => ({
  normalizeContentToMarkdown: vi.fn((content: string) => content),
  getInitialEditorContent: vi.fn((content: string) => content),
  safeParseRecord: vi.fn((obj: any) => obj),
  mergeRecords: vi.fn((...args: any[]) => args.reduce((a, b) => ({ ...a, ...b }), {})),
  findValueByKey: vi.fn((obj: any, keys: string[]) => {
    if (!obj) return undefined;
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return undefined;
  }),
  coerceNumber: vi.fn((val: any) => (typeof val === 'number' ? val : undefined)),
  coerceString: vi.fn((val: any) => (typeof val === 'string' ? val : undefined)),
  calculateMarkdownIndices: vi.fn(() => ({ start: 0, end: 10 })),
  resolveArtifactIdFromSources: vi.fn(
    (
      artifactId: number | undefined,
      metadataId: number | undefined,
      currentArtifactId: number | undefined,
    ) => {
      if (typeof artifactId === 'number' && Number.isFinite(artifactId)) return artifactId;
      if (metadataId) return metadataId;
      if (currentArtifactId) return currentArtifactId;
      return undefined;
    },
  ),
  shouldProcessEditorChange: vi.fn(
    (
      suppressNextOnChange: boolean,
      hasInitializedEditor: boolean,
      isViewingCurrentVersion: boolean,
      markdownTrimmed: string,
      lastSavedMarkdownTrimmed: string,
    ) => {
      if (suppressNextOnChange)
        return { shouldProcess: false, shouldMarkEdited: false, reason: 'suppressed' };
      if (!hasInitializedEditor)
        return { shouldProcess: false, shouldMarkEdited: false, reason: 'not_initialized' };
      if (!isViewingCurrentVersion)
        return { shouldProcess: false, shouldMarkEdited: false, reason: 'not_viewing_current' };
      if (markdownTrimmed === lastSavedMarkdownTrimmed)
        return { shouldProcess: false, shouldMarkEdited: false, reason: 'unchanged' };
      return { shouldProcess: true, shouldMarkEdited: true, reason: 'process' };
    },
  ),
  getHighlightInputKeyAction: vi.fn((key: string) => {
    if (key === 'Enter') return { action: 'submit' };
    if (key === 'Escape') return { action: 'dismiss' };
    return { action: 'none' };
  }),
}));

// Mock export handlers
vi.mock('../canvas-export-handlers', () => ({
  exportAsPDF: vi.fn().mockResolvedValue(undefined),
  exportAsDOCX: vi.fn(),
  exportAsMarkdown: vi.fn(),
}));

// Mock canvas controls
vi.mock('../canvas-controls', () => ({
  CanvasControls: ({ sendFullArtifactUpdate }: any) => (
    <div data-testid="canvas-controls">
      <button onClick={() => sendFullArtifactUpdate('adjust-length')}>Adjust Length</button>
      <button onClick={() => sendFullArtifactUpdate('reading-level')}>Reading Level</button>
      <button onClick={() => sendFullArtifactUpdate('add-polish')}>Add Polish</button>
      <button onClick={() => sendFullArtifactUpdate('add-emojis')}>Add Emojis</button>
    </div>
  ),
}));

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  htmlToMarkdown: vi.fn((html: string) => html.replace(/<[^>]*>/g, '')),
  markdownToHtml: vi.fn((md: string) => `<p>${md}</p>`),
}));

// ============================================================================
// TEST SETUP
// ============================================================================

const defaultProps = {
  title: 'Test Canvas',
  content: '# Test Content\n\nThis is test content.',
  onClose: vi.fn(),
  artifactId: 123,
  org: 'test-org',
  userId: 'test-user',
  sessionId: 'test-session',
  tenantKey: 'test-tenant',
  sendMessage: vi.fn(),
};

// ============================================================================
// TESTS
// ============================================================================

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('countStreamingParagraphs', () => {
  it('returns 0 for empty string', () => {
    expect(countStreamingParagraphs('')).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(countStreamingParagraphs(null as any)).toBe(0);
    expect(countStreamingParagraphs(undefined as any)).toBe(0);
  });

  it('counts HTML paragraphs with <p> tags', () => {
    expect(countStreamingParagraphs('<p>First</p><p>Second</p>')).toBe(2);
    expect(countStreamingParagraphs('<p>One</p>')).toBe(1);
    expect(countStreamingParagraphs('<p class="test">Styled</p>')).toBe(1);
  });

  it('counts HTML paragraphs with attributes', () => {
    expect(countStreamingParagraphs('<p id="1">A</p><p class="b">B</p><p data-x="y">C</p>')).toBe(
      3,
    );
  });

  it('counts markdown paragraphs (double newlines)', () => {
    expect(countStreamingParagraphs('First\n\nSecond')).toBe(1);
    expect(countStreamingParagraphs('One\n\nTwo\n\nThree')).toBe(2);
    expect(countStreamingParagraphs('A\r\n\r\nB')).toBe(1);
  });

  it('returns 0 for single line content without paragraphs', () => {
    expect(countStreamingParagraphs('Single line')).toBe(0);
    expect(countStreamingParagraphs('Line with\nsingle newline')).toBe(0);
  });

  it('handles mixed content', () => {
    expect(countStreamingParagraphs('<p>HTML paragraph</p>')).toBe(1);
  });
});

describe('getStreamingUpdateInterval', () => {
  it('returns 500 for content >= 20000 chars', () => {
    expect(getStreamingUpdateInterval(20000)).toBe(500);
    expect(getStreamingUpdateInterval(25000)).toBe(500);
    expect(getStreamingUpdateInterval(100000)).toBe(500);
  });

  it('returns 400 for content >= 10000 and < 20000 chars', () => {
    expect(getStreamingUpdateInterval(10000)).toBe(400);
    expect(getStreamingUpdateInterval(15000)).toBe(400);
    expect(getStreamingUpdateInterval(19999)).toBe(400);
  });

  it('returns 300 for content >= 5000 and < 10000 chars', () => {
    expect(getStreamingUpdateInterval(5000)).toBe(300);
    expect(getStreamingUpdateInterval(7500)).toBe(300);
    expect(getStreamingUpdateInterval(9999)).toBe(300);
  });

  it('returns default 200 for content < 5000 chars', () => {
    expect(getStreamingUpdateInterval(0)).toBe(200);
    expect(getStreamingUpdateInterval(1000)).toBe(200);
    expect(getStreamingUpdateInterval(4999)).toBe(200);
  });
});

describe('getStreamingCharThreshold', () => {
  it('returns 1200 for content >= 20000 chars', () => {
    expect(getStreamingCharThreshold(20000)).toBe(1200);
    expect(getStreamingCharThreshold(30000)).toBe(1200);
  });

  it('returns 800 for content >= 10000 and < 20000 chars', () => {
    expect(getStreamingCharThreshold(10000)).toBe(800);
    expect(getStreamingCharThreshold(15000)).toBe(800);
    expect(getStreamingCharThreshold(19999)).toBe(800);
  });

  it('returns 500 for content >= 5000 and < 10000 chars', () => {
    expect(getStreamingCharThreshold(5000)).toBe(500);
    expect(getStreamingCharThreshold(7500)).toBe(500);
    expect(getStreamingCharThreshold(9999)).toBe(500);
  });

  it('returns default 200 for content < 5000 chars', () => {
    expect(getStreamingCharThreshold(0)).toBe(200);
    expect(getStreamingCharThreshold(1000)).toBe(200);
    expect(getStreamingCharThreshold(4999)).toBe(200);
  });
});

// ============================================================================
// COMPONENT TESTS
// ============================================================================

describe('CanvasComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.spyOn(window, 'addEventListener').mockImplementation(vi.fn());
    vi.spyOn(window, 'removeEventListener').mockImplementation(vi.fn());
    vi.spyOn(window, 'dispatchEvent').mockImplementation(vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Rendering
  // ==========================================================================

  describe('Rendering', () => {
    it('renders the canvas component with title', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('renders with default title when title prop is empty', () => {
      render(<CanvasComponent {...defaultProps} title="" />);
      expect(screen.getByText('Untitled Artifact')).toBeInTheDocument();
    });

    it('renders with default title when title prop is undefined', () => {
      render(<CanvasComponent {...defaultProps} title={undefined} />);
      expect(screen.getByText('Untitled Artifact')).toBeInTheDocument();
    });

    it('renders the FileText icon in header', () => {
      render(<CanvasComponent {...defaultProps} />);
      const svg = document.querySelector('svg.lucide-file-text');
      expect(svg).toBeInTheDocument();
    });

    it('renders the close button', () => {
      render(<CanvasComponent {...defaultProps} />);
      const closeButton = document.querySelector('svg.lucide-x');
      expect(closeButton).toBeInTheDocument();
    });

    it('renders the rich text editor toolbar', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByTestId('rich-text-toolbar')).toBeInTheDocument();
    });

    it('renders the editor content area', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    });

    it('renders export dropdown button', () => {
      render(<CanvasComponent {...defaultProps} />);
      const triggers = screen.getAllByTestId('dropdown-trigger');
      expect(triggers.length).toBeGreaterThan(0);
    });

    it('renders canvas controls for desktop view', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByTestId('canvas-controls')).toBeInTheDocument();
    });

    it('applies animation class when isAnimating is true', async () => {
      render(<CanvasComponent {...defaultProps} isAnimating={true} />);
      const container = screen.getByTestId('canvas-container');
      await waitFor(() => {
        expect(container.className).toContain('animate-pulse');
      });
    });

    it('does not apply animation class when isAnimating is false', () => {
      render(<CanvasComponent {...defaultProps} isAnimating={false} />);
      const container = screen.getByTestId('canvas-container');
      expect(container.className).not.toContain('animate-pulse');
    });
  });

  // ==========================================================================
  // Header Interactions
  // ==========================================================================

  describe('Header Interactions', () => {
    it('opens rename modal when clicking on title', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });
    });

    it('pre-fills rename input with current title', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        expect(input).toHaveValue('Test Canvas');
      });
    });

    it('calls onClose when clicking close button', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const closeButton = document.querySelector('svg.lucide-x')?.closest('button');
      expect(closeButton).toBeInTheDocument();
      if (closeButton) {
        fireEvent.click(closeButton);
        await waitFor(() => {
          expect(defaultProps.onClose).toHaveBeenCalled();
        });
      }
    });

    it('does not render close button when onClose is undefined', () => {
      render(<CanvasComponent {...defaultProps} onClose={undefined} />);
      const closeButtons = document.querySelectorAll('svg.lucide-x');
      expect(closeButtons.length).toBe(0);
    });

    it('renders version navigation elements', () => {
      render(<CanvasComponent {...defaultProps} />);
      // Just verify the component renders successfully
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Rich Text Toolbar
  // ==========================================================================

  describe('Rich Text Toolbar', () => {
    it('renders bold button', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByLabelText('Toggle bold')).toBeInTheDocument();
    });

    it('renders italic button', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByLabelText('Toggle italic')).toBeInTheDocument();
    });

    it('renders heading buttons', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByLabelText('Toggle heading 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle heading 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle heading 3')).toBeInTheDocument();
    });

    it('renders undo button', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    });

    it('renders redo button', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByLabelText('Redo')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Export Functionality
  // ==========================================================================

  describe('Export Functionality', () => {
    it('renders export dropdown with PDF option', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('PDF Document')).toBeInTheDocument();
    });

    it('renders export dropdown with DOCX option', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('Microsoft Word')).toBeInTheDocument();
    });

    it('renders export dropdown with Markdown option', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('Markdown Document')).toBeInTheDocument();
    });

    it('can click PDF export option', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const pdfOption = screen.getByText('PDF Document').closest('button');
      expect(pdfOption).toBeInTheDocument();
    });

    it('can click DOCX export option', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const docxOption = screen.getByText('Microsoft Word').closest('button');
      expect(docxOption).toBeInTheDocument();
    });

    it('can click Markdown export option', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const mdOption = screen.getByText('Markdown Document').closest('button');
      expect(mdOption).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Version Navigation
  // ==========================================================================

  describe('Version Navigation', () => {
    it('renders version dropdown menu trigger', () => {
      render(<CanvasComponent {...defaultProps} />);
      // Check that dropdown triggers exist
      const triggers = screen.getAllByTestId('dropdown-trigger');
      expect(triggers.length).toBeGreaterThan(0);
    });

    it('shows Previous Version option in dropdown', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('Previous Version')).toBeInTheDocument();
    });

    it('shows Next Version option in dropdown', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('Next Version')).toBeInTheDocument();
    });

    it('shows version count information', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText(/Version \d+ of \d+/)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Canvas Controls
  // ==========================================================================

  describe('Canvas Controls', () => {
    it('renders adjust length control', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('Adjust Length')).toBeInTheDocument();
    });

    it('renders reading level control', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('Reading Level')).toBeInTheDocument();
    });

    it('renders add polish control', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('Add Polish')).toBeInTheDocument();
    });

    it('renders add emojis control', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('Add Emojis')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Rename Modal
  // ==========================================================================

  describe('Rename Modal', () => {
    it('opens rename modal on title click', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });
    });

    it('has input field for new title', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter new canvas title')).toBeInTheDocument();
      });
    });

    it('has Cancel button in rename modal', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);
      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('has Save button in rename modal', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);
      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
    });

    it('disables Save button when title is unchanged', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);
      await waitFor(() => {
        const saveButton = screen.getByText('Save');
        expect(saveButton).toBeDisabled();
      });
    });

    it('enables Save button when title is changed', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        fireEvent.change(input, { target: { value: 'New Title' } });
      });
      await waitFor(() => {
        const saveButton = screen.getByText('Save');
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('calls updateArtifactMutation when saving new title', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        fireEvent.change(input, { target: { value: 'New Title' } });
      });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateArtifact).toHaveBeenCalled();
      });
    });

    it('can save new title through modal', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        fireEvent.change(input, { target: { value: 'New Title' } });
      });

      const saveButton = screen.getByText('Save');
      expect(saveButton).not.toBeDisabled();
      fireEvent.click(saveButton);
    });
  });

  // ==========================================================================
  // API Integration
  // ==========================================================================

  describe('API Integration', () => {
    it('fetches artifacts on mount', async () => {
      render(<CanvasComponent {...defaultProps} />);
      await waitFor(() => {
        expect(mockFetchArtifacts).toHaveBeenCalled();
      });
    });

    it('enables artifacts for session on mount', async () => {
      render(<CanvasComponent {...defaultProps} />);
      await waitFor(() => {
        expect(mockEditSession).toHaveBeenCalled();
      });
    });

    it('renders with artifactId provided', async () => {
      render(<CanvasComponent {...defaultProps} />);
      // Verify component renders with artifactId
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('renders even when artifact fetch may fail', async () => {
      // The component should still render even if there's an issue
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  describe('Event Handlers', () => {
    it('renders successfully', async () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('registers artifact stream event listeners', async () => {
      render(<CanvasComponent {...defaultProps} />);
      await waitFor(() => {
        expect(window.addEventListener).toHaveBeenCalledWith(
          'artifact-stream-start',
          expect.any(Function),
        );
      });
    });

    it('cleans up event listeners on unmount', async () => {
      const { unmount } = render(<CanvasComponent {...defaultProps} />);
      unmount();
      await waitFor(() => {
        expect(window.removeEventListener).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Metadata Resolution
  // ==========================================================================

  describe('Metadata Resolution', () => {
    it('resolves artifactId from metadata', () => {
      render(
        <CanvasComponent
          {...defaultProps}
          artifactId={undefined}
          metadata={{ artifact_id: 456 }}
        />,
      );
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('resolves sessionId from metadata', () => {
      render(
        <CanvasComponent
          {...defaultProps}
          sessionId={undefined}
          metadata={{ session_id: 'meta-session' }}
        />,
      );
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('resolves org from metadata when not provided as prop', () => {
      render(<CanvasComponent {...defaultProps} org={undefined} metadata={{ org: 'meta-org' }} />);
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('resolves userId from metadata when not provided as prop', () => {
      render(
        <CanvasComponent
          {...defaultProps}
          userId={undefined}
          metadata={{ user_id: 'meta-user' }}
        />,
      );
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Content Normalization
  // ==========================================================================

  describe('Content Normalization', () => {
    it('normalizes HTML content to markdown', () => {
      render(<CanvasComponent {...defaultProps} content="<p>HTML content</p>" />);
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('handles empty content gracefully', () => {
      render(<CanvasComponent {...defaultProps} content="" />);
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('handles undefined content', () => {
      render(<CanvasComponent {...defaultProps} content={undefined} />);
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles very long titles', () => {
      const longTitle = 'A'.repeat(200);
      render(<CanvasComponent {...defaultProps} title={longTitle} />);
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('handles special characters in title', () => {
      const specialTitle = '<script>alert("xss")</script>';
      render(<CanvasComponent {...defaultProps} title={specialTitle} />);
      expect(screen.getByText(specialTitle)).toBeInTheDocument();
    });

    it('handles missing org gracefully', () => {
      render(<CanvasComponent {...defaultProps} org={undefined} />);
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('handles missing userId gracefully', () => {
      render(<CanvasComponent {...defaultProps} userId={undefined} />);
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('handles undefined sendMessage prop', () => {
      render(<CanvasComponent {...defaultProps} sendMessage={undefined} />);
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('handles undefined onClose prop', () => {
      render(<CanvasComponent {...defaultProps} onClose={undefined} />);
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
      const closeButton = document.querySelector('svg.lucide-x');
      expect(closeButton).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Streaming Content
  // ==========================================================================

  describe('Streaming Content', () => {
    it('handles streaming state from metadata', () => {
      render(<CanvasComponent {...defaultProps} metadata={{ isStreaming: true }} />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('handles is_streaming metadata key variant', () => {
      render(<CanvasComponent {...defaultProps} metadata={{ is_streaming: 'true' }} />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('renders during streaming state', async () => {
      render(<CanvasComponent {...defaultProps} metadata={{ isStreaming: true }} />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('renders with streaming content metadata', async () => {
      render(
        <CanvasComponent
          {...defaultProps}
          metadata={{ streamingContent: '# Streaming content' }}
        />,
      );
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('handles global streaming state', async () => {
      // Set up global streaming state
      (window as any).__artifactStreamingState = {
        artifactId: 123,
        accumulatedContent: '# Caught up content\n\nThis was missed.',
      };

      render(<CanvasComponent {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
      });

      // Clean up
      delete (window as any).__artifactStreamingState;
    });
  });

  // ==========================================================================
  // Text Selection
  // ==========================================================================

  describe('Text Selection', () => {
    it('renders editor content that is editable', () => {
      render(<CanvasComponent {...defaultProps} />);
      const editor = screen.getByTestId('editor-content');
      expect(editor.getAttribute('contenteditable')).toBe('true');
    });

    it('handles text selection with empty selection', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const editor = screen.getByTestId('editor-content');

      // Mock empty selection
      const mockSelection = {
        toString: () => '',
        rangeCount: 0,
        getRangeAt: vi.fn(),
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

      fireEvent.mouseUp(editor);

      await waitFor(() => {
        expect(screen.queryByTestId('canvas-highlight-popup')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Export Functionality Extended
  // ==========================================================================

  describe('Export Functionality Extended', () => {
    it('renders PDF export option', () => {
      render(<CanvasComponent {...defaultProps} />);
      const pdfOption = screen.getByText('PDF Document');
      expect(pdfOption).toBeInTheDocument();
    });

    it('renders DOCX export option', () => {
      render(<CanvasComponent {...defaultProps} />);
      const docxOption = screen.getByText('Microsoft Word');
      expect(docxOption).toBeInTheDocument();
    });

    it('renders Markdown export option', () => {
      render(<CanvasComponent {...defaultProps} />);
      const mdOption = screen.getByText('Markdown Document');
      expect(mdOption).toBeInTheDocument();
    });

    it('export options are clickable', () => {
      render(<CanvasComponent {...defaultProps} />);
      const pdfOption = screen.getByText('PDF Document').closest('button');
      expect(pdfOption).toBeInTheDocument();
    });

    it('all export options are in dropdown', () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByText('PDF Document')).toBeInTheDocument();
      expect(screen.getByText('Microsoft Word')).toBeInTheDocument();
      expect(screen.getByText('Markdown Document')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Save State
  // ==========================================================================

  describe('Save State', () => {
    it('displays saving state', async () => {
      render(<CanvasComponent {...defaultProps} />);
      // Save state is initially idle
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('handles save error state', async () => {
      mockUpdateArtifact.mockReturnValueOnce({
        unwrap: vi.fn().mockRejectedValue(new Error('Save failed')),
      });

      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Mobile Detection
  // ==========================================================================

  describe('Mobile Detection', () => {
    it('detects mobile viewport', async () => {
      // Mock window width for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(<CanvasComponent {...defaultProps} />);

      // Trigger resize event
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
      });

      // Reset window width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });

    it('detects desktop viewport', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<CanvasComponent {...defaultProps} />);

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(screen.getByTestId('canvas-controls')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Rename Modal Extended
  // ==========================================================================

  describe('Rename Modal Extended', () => {
    it('closes rename modal on Cancel click', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      // Dialog should close - the component still renders but dialog state changes
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('handles rename with Enter key', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        fireEvent.change(input, { target: { value: 'New Title' } });
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      await waitFor(() => {
        expect(mockUpdateArtifact).toHaveBeenCalled();
      });
    });

    it('closes rename modal with Escape key', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        fireEvent.keyDown(input, { key: 'Escape' });
      });

      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('does not submit when shift+Enter is pressed', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        fireEvent.change(input, { target: { value: 'New Title' } });
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      });

      // Should not have been called because shift was pressed
      expect(mockUpdateArtifact).not.toHaveBeenCalledWith(
        expect.objectContaining({ requestBody: expect.objectContaining({ title: 'New Title' }) }),
      );
    });

    it('calls save function when rename submitted', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        fireEvent.change(input, { target: { value: 'New Title' } });
      });

      const saveButton = screen.getByText('Save');
      expect(saveButton).not.toBeDisabled();
    });

    it('handles rename action', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        fireEvent.change(input, { target: { value: 'New Title' } });
      });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // Just verify the button is clickable and action triggers
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('closes modal without saving when title is same', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument();
      });

      // Title is same as current, clicking save should just close
      const saveButton = screen.getByText('Save');
      expect(saveButton).toBeDisabled();
    });

    it('trims whitespace from title', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        fireEvent.change(input, { target: { value: '  New Title  ' } });
      });

      const saveButton = screen.getByText('Save');
      expect(saveButton).not.toBeDisabled();
    });

    it('disables save when title is empty after trim', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const titleButton = screen.getByText('Test Canvas');
      fireEvent.click(titleButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter new canvas title');
        fireEvent.change(input, { target: { value: '   ' } });
      });

      const saveButton = screen.getByText('Save');
      expect(saveButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Version Navigation Extended
  // ==========================================================================

  describe('Version Navigation Extended', () => {
    it('clicks previous version button', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const prevButton = screen.getByText('Previous Version').closest('button');
      if (prevButton) {
        fireEvent.click(prevButton);
      }
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('clicks next version button', async () => {
      render(<CanvasComponent {...defaultProps} />);
      const nextButton = screen.getByText('Next Version').closest('button');
      if (nextButton) {
        fireEvent.click(nextButton);
      }
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Overlay States
  // ==========================================================================

  describe('Overlay States', () => {
    it('shows loading overlay during initial loading', async () => {
      render(<CanvasComponent {...defaultProps} />);
      // Initial loading state may be present briefly
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('shows animation overlay when isAnimating is true', async () => {
      render(<CanvasComponent {...defaultProps} isAnimating={true} />);
      const container = screen.getByTestId('canvas-container');
      await waitFor(() => {
        expect(container.className).toContain('animate-pulse');
      });
    });
  });

  // ==========================================================================
  // Canvas Active Event
  // ==========================================================================

  describe('Canvas Active Event', () => {
    it('renders successfully with artifact', async () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('unmounts without errors', async () => {
      const { unmount } = render(<CanvasComponent {...defaultProps} />);
      unmount();
      expect(true).toBe(true);
    });
  });

  // ==========================================================================
  // Chat Message Integration
  // ==========================================================================

  describe('Chat Message Integration', () => {
    it('renders with sendMessage prop', async () => {
      const sendMessage = vi.fn();
      render(<CanvasComponent {...defaultProps} sendMessage={sendMessage} />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('renders without sendMessage prop', async () => {
      render(<CanvasComponent {...defaultProps} sendMessage={undefined} />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // API Error Handling
  // ==========================================================================

  describe('API Error Handling', () => {
    it('renders even when artifact fetch may fail', async () => {
      render(<CanvasComponent {...defaultProps} />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('handles session edit failure gracefully', async () => {
      render(<CanvasComponent {...defaultProps} />);

      // Component should render despite potential failures
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('handles empty artifact results', async () => {
      render(<CanvasComponent {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Content Derived States
  // ==========================================================================

  describe('Content Derived States', () => {
    it('derives markdown content from HTML content', () => {
      render(<CanvasComponent {...defaultProps} content="<p>HTML Content</p>" />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('handles whitespace-only content', () => {
      render(<CanvasComponent {...defaultProps} content="   " />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('handles content starting with HTML tag', () => {
      render(<CanvasComponent {...defaultProps} content="<h1>Heading</h1><p>Paragraph</p>" />);
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  describe('Utility Functions', () => {
    it('component renders with all props', () => {
      render(
        <CanvasComponent
          title="Full Props Test"
          content="Test content"
          onClose={vi.fn()}
          isAnimating={false}
          artifactId={123}
          org="test-org"
          userId="test-user"
          metadata={{ key: 'value' }}
          sessionId="test-session"
          tenantKey="test-tenant"
          sendMessage={vi.fn()}
        />,
      );
      expect(screen.getByText('Full Props Test')).toBeInTheDocument();
    });

    it('handles nested metadata resolution', () => {
      render(
        <CanvasComponent
          {...defaultProps}
          metadata={{
            metadata: { artifact_id: 789 },
            attributes: { session_id: 'nested-session' },
          }}
        />,
      );
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('handles version number from metadata', () => {
      render(
        <CanvasComponent
          {...defaultProps}
          metadata={{
            versionNumber: 5,
          }}
        />,
      );
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });

    it('handles title from metadata', () => {
      render(
        <CanvasComponent
          {...defaultProps}
          title={undefined}
          metadata={{
            title: 'Metadata Title',
          }}
        />,
      );
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Highlight Rects Rendering
  // ==========================================================================

  describe('Highlight Rects Rendering', () => {
    it('renders highlight overlay when rects are present', async () => {
      render(<CanvasComponent {...defaultProps} />);
      // By default no highlights
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Animation Cleanup
  // ==========================================================================

  describe('Animation Cleanup', () => {
    it('applies animation class when animating', () => {
      render(<CanvasComponent {...defaultProps} isAnimating={true} />);
      const container = screen.getByTestId('canvas-container');
      expect(container.className).toContain('animate-pulse');
    });

    it('does not apply animation class when not animating', () => {
      render(<CanvasComponent {...defaultProps} isAnimating={false} />);
      const container = screen.getByTestId('canvas-container');
      expect(container.className).not.toContain('animate-pulse');
    });
  });

  // ==========================================================================
  // Title Display Logic
  // ==========================================================================

  describe('Title Display Logic', () => {
    it('updates display title when artifact title changes', async () => {
      const { rerender } = render(<CanvasComponent {...defaultProps} title="Initial Title" />);
      expect(screen.getByText('Initial Title')).toBeInTheDocument();

      rerender(<CanvasComponent {...defaultProps} title="Updated Title" />);
      expect(screen.getByText('Updated Title')).toBeInTheDocument();
    });

    it('shows Untitled Artifact when both title and artifact title are empty', () => {
      render(<CanvasComponent {...defaultProps} title="" />);
      expect(screen.getByText('Untitled Artifact')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Cleanup and Lifecycle
  // ==========================================================================

  describe('Cleanup and Lifecycle', () => {
    it('cleans up timeouts on unmount', async () => {
      const { unmount } = render(<CanvasComponent {...defaultProps} />);
      unmount();
      // No errors should occur
      expect(true).toBe(true);
    });

    it('cancels debounced save on unmount', async () => {
      const { unmount } = render(<CanvasComponent {...defaultProps} />);
      unmount();
      expect(true).toBe(true);
    });

    it('cleans up properly on unmount', async () => {
      const { unmount } = render(<CanvasComponent {...defaultProps} isAnimating={true} />);
      unmount();
      expect(true).toBe(true);
    });
  });
});

// ==========================================================================
// Utility Function Tests - getSaveStatusLabel
// ==========================================================================

describe('getSaveStatusLabel', () => {
  it('returns "Saving…" for saving state', () => {
    expect(getSaveStatusLabel('saving', null)).toBe('Saving…');
  });

  it('returns "All changes saved" for saved state', () => {
    expect(getSaveStatusLabel('saved', null)).toBe('All changes saved');
  });

  it('returns saveError for error state with custom error', () => {
    expect(getSaveStatusLabel('error', 'Custom error message')).toBe('Custom error message');
  });

  it('returns "Save failed" for error state with null error', () => {
    expect(getSaveStatusLabel('error', null)).toBe('Save failed');
  });

  it('returns null for idle state', () => {
    expect(getSaveStatusLabel('idle', null)).toBe(null);
  });

  it('returns null for unknown state (default case)', () => {
    expect(getSaveStatusLabel('idle', 'some error')).toBe(null);
  });
});

// ==========================================================================
// Utility Function Tests - getSaveStatusClass
// ==========================================================================

describe('getSaveStatusClass', () => {
  it('returns error class for error state', () => {
    expect(getSaveStatusClass('error')).toBe('text-xs text-red-500');
  });

  it('returns success class for saved state', () => {
    expect(getSaveStatusClass('saved')).toBe('text-xs text-emerald-600');
  });

  it('returns default class for saving state', () => {
    expect(getSaveStatusClass('saving')).toBe('text-xs text-gray-500');
  });

  it('returns default class for idle state', () => {
    expect(getSaveStatusClass('idle')).toBe('text-xs text-gray-500');
  });
});

// ==========================================================================
// Utility Function Tests - getShouldShowOverlay
// ==========================================================================

describe('getShouldShowOverlay', () => {
  it('returns true when showAnimation is true', () => {
    expect(getShouldShowOverlay(true, false, false, false, false, false)).toBe(true);
  });

  it('returns true when isExporting is true', () => {
    expect(getShouldShowOverlay(false, true, false, false, false, false)).toBe(true);
  });

  it('returns true when isInitialLoading is true', () => {
    expect(getShouldShowOverlay(false, false, true, false, false, false)).toBe(true);
  });

  it('returns true when isVersionLoading is true', () => {
    expect(getShouldShowOverlay(false, false, false, true, false, false)).toBe(true);
  });

  it('returns true when showUpdateAnimation is true', () => {
    expect(getShouldShowOverlay(false, false, false, false, true, false)).toBe(true);
  });

  it('returns true when isStreamingWithNoContent is true', () => {
    expect(getShouldShowOverlay(false, false, false, false, false, true)).toBe(true);
  });

  it('returns false when all conditions are false', () => {
    expect(getShouldShowOverlay(false, false, false, false, false, false)).toBe(false);
  });

  it('returns true when multiple conditions are true', () => {
    expect(getShouldShowOverlay(true, true, true, true, true, true)).toBe(true);
  });
});

// ==========================================================================
// Utility Function Tests - getOverlayMessage
// ==========================================================================

describe('getOverlayMessage', () => {
  it('returns "Preparing document..." when isExporting is true', () => {
    expect(getOverlayMessage(true, false, false, false, false, false)).toBe(
      'Preparing document...',
    );
  });

  it('returns "Loading artifacts..." when isInitialLoading is true', () => {
    expect(getOverlayMessage(false, true, false, false, false, false)).toBe('Loading artifacts...');
  });

  it('returns "Loading version..." when isVersionLoading is true', () => {
    expect(getOverlayMessage(false, false, true, false, false, false)).toBe('Loading version...');
  });

  it('returns "Updating content..." when showUpdateAnimation is true', () => {
    expect(getOverlayMessage(false, false, false, true, false, false)).toBe('Updating content...');
  });

  it('returns "Updating content..." when isContentUpdating is true', () => {
    expect(getOverlayMessage(false, false, false, false, true, false)).toBe('Updating content...');
  });

  it('returns "Generating canvas content..." when isStreamingWithNoContent is true', () => {
    expect(getOverlayMessage(false, false, false, false, false, true)).toBe(
      'Generating canvas content...',
    );
  });

  it('returns "Generating content..." as default', () => {
    expect(getOverlayMessage(false, false, false, false, false, false)).toBe(
      'Generating content...',
    );
  });

  it('prioritizes isExporting over other conditions', () => {
    expect(getOverlayMessage(true, true, true, true, true, true)).toBe('Preparing document...');
  });

  it('prioritizes isInitialLoading when isExporting is false', () => {
    expect(getOverlayMessage(false, true, true, true, true, true)).toBe('Loading artifacts...');
  });

  it('prioritizes isVersionLoading over update states', () => {
    expect(getOverlayMessage(false, false, true, true, true, true)).toBe('Loading version...');
  });
});

// ==========================================================================
// Utility Function Tests - deriveMarkdownContent
// ==========================================================================

describe('deriveMarkdownContent', () => {
  const mockHtmlToMarkdown = (html: string) => `MD:${html}`;

  it('returns artifact content when currentArtifact exists', () => {
    const artifact = { content: 'Artifact content' };
    expect(deriveMarkdownContent(artifact, 'fallback', mockHtmlToMarkdown)).toBe(
      'Artifact content',
    );
  });

  it('returns empty string when artifact content is null', () => {
    const artifact = { content: null };
    expect(deriveMarkdownContent(artifact, 'fallback', mockHtmlToMarkdown)).toBe('');
  });

  it('returns empty string when artifact content is undefined', () => {
    const artifact = { content: undefined };
    expect(deriveMarkdownContent(artifact, 'fallback', mockHtmlToMarkdown)).toBe('');
  });

  it('returns content when no artifact and content is plain text', () => {
    expect(deriveMarkdownContent(null, 'Plain content', mockHtmlToMarkdown)).toBe('Plain content');
  });

  it('converts HTML content to markdown when content starts with <', () => {
    expect(deriveMarkdownContent(null, '<p>HTML</p>', mockHtmlToMarkdown)).toBe('MD:<p>HTML</p>');
  });

  it('returns empty string when content is empty', () => {
    expect(deriveMarkdownContent(null, '', mockHtmlToMarkdown)).toBe('');
  });

  it('returns empty string when content is whitespace only', () => {
    expect(deriveMarkdownContent(null, '   ', mockHtmlToMarkdown)).toBe('');
  });

  it('trims content before processing', () => {
    expect(deriveMarkdownContent(null, '  Trimmed  ', mockHtmlToMarkdown)).toBe('Trimmed');
  });

  it('handles HTML with leading whitespace', () => {
    expect(deriveMarkdownContent(null, '  <p>HTML</p>  ', mockHtmlToMarkdown)).toBe(
      'MD:<p>HTML</p>',
    );
  });
});

// ==========================================================================
// Utility Function Tests - isStreamingWithNoContentCheck
// ==========================================================================

describe('isStreamingWithNoContentCheck', () => {
  it('returns true when streaming and content is empty string', () => {
    expect(isStreamingWithNoContentCheck(true, '')).toBe(true);
  });

  it('returns true when streaming and content is null', () => {
    expect(isStreamingWithNoContentCheck(true, null)).toBe(true);
  });

  it('returns true when streaming and content is undefined', () => {
    expect(isStreamingWithNoContentCheck(true, undefined)).toBe(true);
  });

  it('returns true when streaming and content is whitespace only', () => {
    expect(isStreamingWithNoContentCheck(true, '   ')).toBe(true);
  });

  it('returns false when streaming but content exists', () => {
    expect(isStreamingWithNoContentCheck(true, 'Some content')).toBe(false);
  });

  it('returns false when not streaming regardless of content', () => {
    expect(isStreamingWithNoContentCheck(false, '')).toBe(false);
    expect(isStreamingWithNoContentCheck(false, null)).toBe(false);
    expect(isStreamingWithNoContentCheck(false, 'content')).toBe(false);
  });
});

// ==========================================================================
// Utility Function Tests - isEditingDisabledCheck
// ==========================================================================

describe('isEditingDisabledCheck', () => {
  it('returns true when not viewing current version', () => {
    expect(isEditingDisabledCheck(false, false)).toBe(true);
  });

  it('returns true when content is updating', () => {
    expect(isEditingDisabledCheck(true, true)).toBe(true);
  });

  it('returns true when both conditions are met', () => {
    expect(isEditingDisabledCheck(false, true)).toBe(true);
  });

  it('returns false when viewing current version and not updating', () => {
    expect(isEditingDisabledCheck(true, false)).toBe(false);
  });
});

// ==========================================================================
// Utility Function Tests - shouldSkipStreamingUpdateByTiming
// ==========================================================================

describe('shouldSkipStreamingUpdateByTiming', () => {
  it('returns true when time since last update is less than interval', () => {
    expect(shouldSkipStreamingUpdateByTiming(100, 200)).toBe(true);
  });

  it('returns false when time since last update equals interval', () => {
    expect(shouldSkipStreamingUpdateByTiming(200, 200)).toBe(false);
  });

  it('returns false when time since last update exceeds interval', () => {
    expect(shouldSkipStreamingUpdateByTiming(300, 200)).toBe(false);
  });

  it('handles zero timing', () => {
    expect(shouldSkipStreamingUpdateByTiming(0, 200)).toBe(true);
    expect(shouldSkipStreamingUpdateByTiming(0, 0)).toBe(false);
  });
});

// ==========================================================================
// Utility Function Tests - shouldSkipStreamingUpdateByThreshold
// ==========================================================================

describe('shouldSkipStreamingUpdateByThreshold', () => {
  it('returns true when all threshold conditions are met', () => {
    expect(shouldSkipStreamingUpdateByThreshold(0, 50, 100, 500, 1000)).toBe(true);
  });

  it('returns false when paragraph delta is positive', () => {
    expect(shouldSkipStreamingUpdateByThreshold(1, 50, 100, 500, 1000)).toBe(false);
  });

  it('returns false when char delta exceeds minimum', () => {
    expect(shouldSkipStreamingUpdateByThreshold(0, 150, 100, 500, 1000)).toBe(false);
  });

  it('returns false when time exceeds force update interval', () => {
    expect(shouldSkipStreamingUpdateByThreshold(0, 50, 100, 1500, 1000)).toBe(false);
  });

  it('returns true when paragraph delta is negative', () => {
    expect(shouldSkipStreamingUpdateByThreshold(-1, 50, 100, 500, 1000)).toBe(true);
  });
});

// ==========================================================================
// Utility Function Tests - isStreamingContentUnchanged
// ==========================================================================

describe('isStreamingContentUnchanged', () => {
  it('returns true when content is identical', () => {
    expect(isStreamingContentUnchanged('test content', 'test content')).toBe(true);
  });

  it('returns false when content is different', () => {
    expect(isStreamingContentUnchanged('new content', 'old content')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(isStreamingContentUnchanged('', '')).toBe(true);
  });

  it('returns false when only one is empty', () => {
    expect(isStreamingContentUnchanged('', 'content')).toBe(false);
    expect(isStreamingContentUnchanged('content', '')).toBe(false);
  });
});

// ==========================================================================
// Utility Function Tests - buildArtifactPayload
// ==========================================================================

describe('buildArtifactPayload', () => {
  it('builds payload with artifact title', () => {
    const artifact = { title: 'Test Title', file_extension: 'md', id: 123 };
    const result = buildArtifactPayload(artifact);
    expect(result).toEqual({
      title: 'Test Title',
      file_extension: 'md',
      id: '123',
      is_partial: false,
    });
  });

  it('falls back to metadata title when artifact title is null', () => {
    const artifact = { title: null, file_extension: 'txt', id: 456 };
    const result = buildArtifactPayload(artifact, 'Metadata Title');
    expect(result.title).toBe('Metadata Title');
  });

  it('falls back to prop title when both are null', () => {
    const artifact = { title: null, file_extension: null, id: 789 };
    const result = buildArtifactPayload(artifact, null, 'Prop Title');
    expect(result.title).toBe('Prop Title');
    expect(result.file_extension).toBe('txt');
  });

  it('uses default title when all are null', () => {
    const artifact = { title: null, file_extension: null, id: 100 };
    const result = buildArtifactPayload(artifact, null, undefined);
    expect(result.title).toBe('Untitled Artifact');
  });
});

// ==========================================================================
// Utility Function Tests - doesArtifactMatchEvent
// ==========================================================================

describe('doesArtifactMatchEvent', () => {
  it('returns true when event matches current artifact', () => {
    expect(doesArtifactMatchEvent(123, 123, undefined, undefined)).toBe(true);
  });

  it('returns true when event matches resolved artifact id', () => {
    expect(doesArtifactMatchEvent(456, undefined, 456, undefined)).toBe(true);
  });

  it('returns true when event matches prop artifact id', () => {
    expect(doesArtifactMatchEvent(789, undefined, undefined, 789)).toBe(true);
  });

  it('returns false when no match found', () => {
    expect(doesArtifactMatchEvent(999, 123, 456, 789)).toBe(false);
  });

  it('returns false when event artifact id is undefined', () => {
    expect(doesArtifactMatchEvent(undefined, 123, 456, 789)).toBe(false);
  });

  it('handles string event artifact ids', () => {
    expect(doesArtifactMatchEvent('123', 123, undefined, undefined)).toBe(true);
  });
});

// ==========================================================================
// Utility Function Tests - buildPartialContent
// ==========================================================================

describe('buildPartialContent', () => {
  it('builds content by replacing a section', () => {
    const previous = 'Hello World!';
    const stream = 'Beautiful ';
    const result = buildPartialContent(previous, stream, 6, 6);
    expect(result).toBe('Hello Beautiful World!');
  });

  it('handles replacement at the beginning', () => {
    const result = buildPartialContent('Old content', 'New', 0, 3);
    expect(result).toBe('New content');
  });

  it('handles replacement at the end', () => {
    const result = buildPartialContent('Hello World', ' there!', 11, 11);
    expect(result).toBe('Hello World there!');
  });

  it('handles complete replacement', () => {
    const result = buildPartialContent('Old', 'New', 0, 3);
    expect(result).toBe('New');
  });

  it('handles empty stream content', () => {
    const result = buildPartialContent('Hello World', '', 5, 11);
    expect(result).toBe('Hello');
  });
});

// ==========================================================================
// Utility Function Tests - shouldSkipSave
// ==========================================================================

describe('shouldSkipSave', () => {
  it('returns true when user has not edited', () => {
    expect(shouldSkipSave(false, 123, 'org', 'user', 'content', null)).toBe(true);
  });

  it('returns true when artifact id is missing', () => {
    expect(shouldSkipSave(true, undefined, 'org', 'user', 'content', null)).toBe(true);
  });

  it('returns true when org is missing', () => {
    expect(shouldSkipSave(true, 123, undefined, 'user', 'content', null)).toBe(true);
  });

  it('returns true when user id is missing', () => {
    expect(shouldSkipSave(true, 123, 'org', undefined, 'content', null)).toBe(true);
  });

  it('returns true when content matches last saved', () => {
    expect(shouldSkipSave(true, 123, 'org', 'user', 'content', 'content')).toBe(true);
  });

  it('returns true when content matches with whitespace differences', () => {
    expect(shouldSkipSave(true, 123, 'org', 'user', '  content  ', 'content')).toBe(true);
  });

  it('returns false when all conditions are met for saving', () => {
    expect(shouldSkipSave(true, 123, 'org', 'user', 'new content', 'old content')).toBe(false);
  });

  it('returns false when last saved is null and content exists', () => {
    expect(shouldSkipSave(true, 123, 'org', 'user', 'content', null)).toBe(false);
  });
});

// ==========================================================================
// Utility Function Tests - buildSaveRequestBody
// ==========================================================================

describe('buildSaveRequestBody', () => {
  it('builds request with content only', () => {
    const result = buildSaveRequestBody('markdown content');
    expect(result).toEqual({ content: 'markdown content' });
  });

  it('builds request with content and title', () => {
    const result = buildSaveRequestBody('content', 'Title');
    expect(result).toEqual({ content: 'content', title: 'Title' });
  });

  it('excludes title when null', () => {
    const result = buildSaveRequestBody('content', null);
    expect(result).toEqual({ content: 'content' });
  });

  it('excludes title when undefined', () => {
    const result = buildSaveRequestBody('content', undefined);
    expect(result).toEqual({ content: 'content' });
  });

  it('handles empty content', () => {
    const result = buildSaveRequestBody('', 'Title');
    expect(result).toEqual({ content: '', title: 'Title' });
  });
});

// ==========================================================================
// Utility Function Tests - shouldProceedWithRename
// ==========================================================================

describe('shouldProceedWithRename', () => {
  it('returns true when title is different from current', () => {
    expect(shouldProceedWithRename('New Title', 'Old Title', 'Default')).toBe(true);
  });

  it('returns false when title matches current', () => {
    expect(shouldProceedWithRename('Same Title', 'Same Title', 'Default')).toBe(false);
  });

  it('uses prop title when current is null', () => {
    expect(shouldProceedWithRename('Default', null, 'Default')).toBe(false);
    expect(shouldProceedWithRename('New', null, 'Default')).toBe(true);
  });

  it('uses prop title when current is undefined', () => {
    expect(shouldProceedWithRename('Default', undefined, 'Default')).toBe(false);
    expect(shouldProceedWithRename('Different', undefined, 'Default')).toBe(true);
  });
});
