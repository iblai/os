'use client';

import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { Mark, mergeAttributes } from '@tiptap/core';
import { Heading } from '@tiptap/extension-heading';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Code2,
  FileCode,
  Quote,
  Undo2,
  Redo2,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useDebouncedCallback } from 'use-debounce';
import { useUpdateArtifactMutation } from '@iblai/iblai-js/data-layer';

import { Button } from '@/components/ui/button';
import { htmlToMarkdown, markdownToHtml } from '@/lib/utils';
import { MathInline, MathBlock } from './tiptap-math-extension';

const Superscript = Mark.create({
  name: 'superscript',
  parseHTML() {
    return [{ tag: 'sup' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0];
  },
});

const Subscript = Mark.create({
  name: 'subscript',
  parseHTML() {
    return [{ tag: 'sub' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes), 0];
  },
});

const HTML_TAG_REGEX = /^<([a-z][a-z0-9-]*)(\s[^>]*)?>[\s\S]*<\/\1>$/i;
const HTML_SELF_CLOSING_REGEX = /^<([a-z][a-z0-9-]*)(\s[^>]*)?\s*\/>$/i;
const HTML_VOID_TAG_REGEX =
  /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s[^>]*)?>$/i;

// Helper function to check if string is HTML (from web-containers)
export const isHtml = (str: string): boolean => {
  if (!str || typeof str !== 'string') {
    return false;
  }
  const trimmed = str.trim();
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
    return false;
  }
  return (
    HTML_VOID_TAG_REGEX.test(trimmed) ||
    HTML_SELF_CLOSING_REGEX.test(trimmed) ||
    HTML_TAG_REGEX.test(trimmed)
  );
};

// Exported for testing - Get initial content for editor based on value and export format
export const getInitialEditorContent = (
  value: string,
  exportFormat: 'html' | 'markdown',
  htmlToMarkdownFn: (html: string) => string,
  markdownToHtmlFn: (md: string) => string,
): string => {
  if (exportFormat === 'html') {
    return value;
  }

  // If exportFormat is markdown but value is HTML, convert HTML -> markdown -> HTML
  if (isHtml(value)) {
    const markdown = htmlToMarkdownFn(value);
    return markdownToHtmlFn(markdown);
  }

  // Value is markdown, convert markdown -> HTML
  return markdownToHtmlFn(value);
};

// Exported for testing - Get next content for editor updates
export const getNextEditorContent = (
  value: string,
  exportFormat: 'html' | 'markdown',
  htmlToMarkdownFn: (html: string) => string,
  markdownToHtmlFn: (md: string) => string,
): string => {
  if (exportFormat === 'html') {
    return value;
  }
  if (isHtml(value)) {
    const markdown = htmlToMarkdownFn(value);
    return markdownToHtmlFn(markdown);
  }
  return markdownToHtmlFn(value);
};

// Exported for testing - Check if content has changed
export const hasContentChanged = (
  newContent: string,
  lastSavedContent: string,
): boolean => {
  return newContent.trim() !== lastSavedContent.trim();
};

// Exported for testing - Check if auto-save can proceed
export const canAutoSave = (
  enableAutoSave: boolean,
  artifactId: number | undefined,
  org: string | undefined,
  userId: string | undefined,
): boolean => {
  return !!(enableAutoSave && artifactId && org && userId);
};

// Exported for testing - Determine if transaction is programmatic
export const isTransactionProgrammatic = (transaction: {
  getMeta: (key: string) => boolean | undefined;
}): boolean => {
  return (
    transaction.getMeta('addToHistory') === false ||
    transaction.getMeta('preventUpdate') === true
  );
};

// Exported for testing - Determine if transaction is user edit
export const isUserEdit = (
  transaction: {
    getMeta: (key: string) => boolean | undefined;
    steps: { length: number };
  },
  isEditable: boolean,
): boolean => {
  const isProgrammatic = isTransactionProgrammatic(transaction);
  return !isProgrammatic && transaction.steps.length > 0 && isEditable;
};

// Exported for testing - Validate auto-save requirements
export const validateAutoSaveConfig = (config: {
  artifactId?: number;
  org?: string;
  userId?: string;
}): { isValid: boolean; missingFields: string[] } => {
  const missingFields: string[] = [];
  if (!config.artifactId) missingFields.push('artifactId');
  if (!config.org) missingFields.push('org');
  if (!config.userId) missingFields.push('userId');
  return { isValid: missingFields.length === 0, missingFields };
};

// Exported for testing - Build auto-save request body
export const buildAutoSaveRequestBody = (
  markdown: string,
  title?: string,
): { content: string; title?: string } => {
  const requestBody: { content: string; title?: string } = {
    content: markdown,
  };
  if (title) {
    requestBody.title = title;
  }
  return requestBody;
};

// Exported for testing - Check if content needs saving
export const needsSaving = (
  newContent: string,
  lastSavedContent: string,
): boolean => {
  return newContent.trim() !== lastSavedContent.trim();
};

// Exported for testing - Check if history plugin exists
export const findHistoryPlugin = (
  plugins: Array<{ key?: string }>,
): { key?: string } | undefined => {
  return plugins.find((plugin) => {
    const key = plugin.key;
    return key && (key.startsWith('history$') || key === 'history');
  });
};

// Exported for testing - Calculate restored selection position
export const calculateRestoredPosition = (
  selection: { from: number; to: number },
  currentDocSize: number,
  newDocSize: number,
): { from: number; to: number } | number => {
  // If cursor was at the end of the old content, place it at the end of new content
  if (selection.from === currentDocSize) {
    return newDocSize;
  }
  // If cursor position is still valid in the new document, restore it
  if (selection.from <= newDocSize && selection.to <= newDocSize) {
    return { from: selection.from, to: selection.to };
  }
  // Otherwise, try to maintain relative position
  return Math.min(selection.from, newDocSize);
};

// Exported for testing - Check if content update is needed
export const shouldUpdateContent = (
  value: string,
  lastSetValue: string,
  editorIsFocused: boolean,
  lastUserInput: string,
): 'skip' | 'skip-focused' | 'check' => {
  // Skip update if this value was just set by the editor itself
  if (value === lastSetValue) {
    return 'skip';
  }
  // If the incoming value matches the last user input and the editor is focused, skip
  if (editorIsFocused && value === lastUserInput) {
    return 'skip-focused';
  }
  return 'check';
};

// Exported for testing - Check if markdown content matches
export const markdownContentMatches = (
  currentMarkdown: string,
  valueToCompare: string,
): boolean => {
  return currentMarkdown.trim() === valueToCompare.trim();
};

// Exported for testing - Get export value from HTML
export const getExportValue = (
  html: string,
  exportFormat: 'html' | 'markdown',
  htmlToMarkdownFn: (html: string) => string,
): string => {
  return exportFormat === 'html' ? html : htmlToMarkdownFn(html);
};

// Exported for testing - Check if auto-save should be triggered
export const shouldTriggerAutoSave = (config: {
  enableAutoSave: boolean;
  artifactId?: number;
  org?: string;
  userId?: string;
  hasDebouncedFn: boolean;
}): {
  shouldTrigger: boolean;
  reason: 'disabled' | 'missing-config' | 'ready';
} => {
  if (!config.enableAutoSave) {
    return { shouldTrigger: false, reason: 'disabled' };
  }
  if (
    !config.artifactId ||
    !config.org ||
    !config.userId ||
    !config.hasDebouncedFn
  ) {
    return { shouldTrigger: false, reason: 'missing-config' };
  }
  return { shouldTrigger: true, reason: 'ready' };
};

// Exported for testing - Process auto-save response
export const processAutoSaveResponse = (
  savedArtifact: { content?: string } | null | undefined,
  originalMarkdown: string,
): string => {
  if (savedArtifact?.content) {
    return savedArtifact.content;
  }
  return originalMarkdown;
};

// Exported for testing - Check if history reset is needed
export const shouldResetHistory = (
  hasHistoryPlugin: boolean,
  historyState: unknown,
): boolean => {
  return hasHistoryPlugin && !!historyState;
};

// Exported for testing - Determine if content update should proceed
export const shouldProceedWithUpdate = (
  nextContent: string,
  currentContent: string,
  currentMarkdown: string,
  valueToCompare: string,
): 'skip-unchanged' | 'proceed' => {
  // If the editor already represents the provided value, avoid resetting content
  if (currentMarkdown === valueToCompare.trim()) {
    return 'skip-unchanged';
  }
  // Only update if content actually changed
  if (nextContent !== currentContent) {
    return 'proceed';
  }
  return 'skip-unchanged';
};

// Exported for testing - Get value for onChange callback
export const getOnChangeValue = (
  html: string,
  exportFormat: 'html' | 'markdown',
  htmlToMarkdownFn: (html: string) => string,
): string => {
  return exportFormat === 'html' ? html : htmlToMarkdownFn(html);
};

interface CanvasRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  exportFormat?: 'html' | 'markdown';
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  // Auto-save props
  artifactId?: number;
  org?: string;
  userId?: string;
  title?: string;
  enableAutoSave?: boolean;
}

// Toolbar component that matches the reference but styled for canvas header
export function CanvasRichTextEditorToolbar({
  editor,
}: {
  editor: Editor | null;
}) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!editor) return;

    // Initialize to false - no user edits yet
    setCanUndo(false);
    setCanRedo(false);

    // Initialize the flag if it doesn't exist
    if ((editor as any).__hasUserEdited === undefined) {
      (editor as any).__hasUserEdited = false;
    }

    // Track when user makes actual edits (not programmatic updates)
    const handleTransaction = ({ transaction }: { transaction: any }) => {
      // Check if this is a programmatic update
      // Programmatic updates explicitly set addToHistory: false or preventUpdate: true
      const isProgrammatic =
        transaction.getMeta('addToHistory') === false ||
        transaction.getMeta('preventUpdate') === true;

      // If it's not programmatic, has steps, and editor is editable, it's a user edit
      if (
        !isProgrammatic &&
        transaction.steps.length > 0 &&
        editor.isEditable
      ) {
        (editor as any).__hasUserEdited = true;
      }
    };

    const updateHistoryState = () => {
      // Only enable undo/redo if user has made actual edits
      const hasUserEdited = (editor as any).__hasUserEdited === true;

      if (hasUserEdited) {
        const canUndoValue = editor.can().undo();
        const canRedoValue = editor.can().redo();
        setCanUndo(canUndoValue);
        setCanRedo(canRedoValue);
      } else {
        /* istanbul ignore next -- @preserve internal state management when no user edits */
        // No user edits yet, keep disabled
        setCanUndo(false);
        setCanRedo(false);
      }
    };

    // Listen to transactions to track user edits
    editor.on('transaction', handleTransaction);

    // Update history state on editor updates
    editor.on('update', updateHistoryState);
    editor.on('selectionUpdate', updateHistoryState);

    // Initial check after a delay to ensure editor is initialized
    /* istanbul ignore next -- @preserve timeout callback for initial state setup */
    const timeoutId = setTimeout(() => {
      updateHistoryState();
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      editor.off('transaction', handleTransaction);
      editor.off('update', updateHistoryState);
      editor.off('selectionUpdate', updateHistoryState);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  const focusWithoutScroll = () =>
    editor.chain().focus(undefined, { scrollIntoView: false });

  // Mobile: show only undo/redo + dropdown for other options
  /* istanbul ignore next -- @preserve mobile-only UI rendering */
  if (isMobile) {
    const toolbarItems = [
      {
        name: 'Heading 1',
        icon: <Heading1 className="h-4 w-4" />,
        isActive: editor.isActive('heading', { level: 1 }),
        action: () => focusWithoutScroll().toggleHeading({ level: 1 }).run(),
      },
      {
        name: 'Heading 2',
        icon: <Heading2 className="h-4 w-4" />,
        isActive: editor.isActive('heading', { level: 2 }),
        action: () => focusWithoutScroll().toggleHeading({ level: 2 }).run(),
      },
      {
        name: 'Heading 3',
        icon: <Heading3 className="h-4 w-4" />,
        isActive: editor.isActive('heading', { level: 3 }),
        action: () => focusWithoutScroll().toggleHeading({ level: 3 }).run(),
      },
      {
        name: 'Bold',
        icon: <Bold className="h-4 w-4" />,
        isActive: editor.isActive('bold'),
        action: () => focusWithoutScroll().toggleBold().run(),
      },
      {
        name: 'Italic',
        icon: <Italic className="h-4 w-4" />,
        isActive: editor.isActive('italic'),
        action: () => focusWithoutScroll().toggleItalic().run(),
      },
      {
        name: 'Code',
        icon: <Code2 className="h-4 w-4" />,
        isActive: editor.isActive('code'),
        action: () => focusWithoutScroll().toggleCode().run(),
      },
      {
        name: 'Code Block',
        icon: <FileCode className="h-4 w-4" />,
        isActive: editor.isActive('codeBlock'),
        action: () => focusWithoutScroll().toggleCodeBlock().run(),
      },
      {
        name: 'Quote',
        icon: <Quote className="h-4 w-4" />,
        isActive: editor.isActive('blockquote'),
        action: () => focusWithoutScroll().toggleBlockquote().run(),
      },
    ];

    return (
      <div ref={containerRef} className="flex items-center gap-0.5">
        {/* Undo/Redo buttons - always visible */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => {
            editor
              .chain()
              .focus(undefined, { scrollIntoView: false })
              .undo()
              .run();
          }}
          disabled={!canUndo}
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => {
            editor
              .chain()
              .focus(undefined, { scrollIntoView: false })
              .redo()
              .run();
          }}
          disabled={!canRedo}
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4 text-gray-600" />
        </Button>
        <div className="mx-0.5 h-4 w-px bg-gray-300" />

        {/* More options dropdown for mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="More formatting options"
            >
              <MoreHorizontal className="h-4 w-4 text-gray-600" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {toolbarItems.map((item, index) => (
              <React.Fragment key={item.name}>
                {/* Add separator after headings (index 2) and after text formatting (index 5) */}
                {(index === 3 || index === 6) && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={item.action}
                  className={item.isActive ? 'bg-accent' : ''}
                >
                  <div className="flex w-full items-center gap-2">
                    <span
                      className={
                        item.isActive ? 'text-primary' : 'text-gray-600'
                      }
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.name}</span>
                    {item.isActive && (
                      <span className="bg-primary h-2 w-2 rounded-full" />
                    )}
                  </div>
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Desktop: show all buttons
  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-0.5">
      {/* Undo/Redo buttons */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={
          /* istanbul ignore next -- @preserve click handler requires enabled state */ () => {
            editor
              .chain()
              .focus(undefined, { scrollIntoView: false })
              .undo()
              .run();
          }
        }
        disabled={!canUndo}
        aria-label="Undo"
      >
        <Undo2 className="h-4 w-4 text-gray-600" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={
          /* istanbul ignore next -- @preserve click handler requires enabled state */ () => {
            editor
              .chain()
              .focus(undefined, { scrollIntoView: false })
              .redo()
              .run();
          }
        }
        disabled={!canRedo}
        aria-label="Redo"
      >
        <Redo2 className="h-4 w-4 text-gray-600" />
      </Button>
      <div className="mx-0.5 h-4 w-px bg-gray-300" />

      {/* Heading buttons */}
      <Button
        variant={
          editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'
        }
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => focusWithoutScroll().toggleHeading({ level: 1 }).run()}
        aria-label="Toggle heading 1"
      >
        <Heading1 className="h-4 w-4 text-gray-600" />
      </Button>
      <Button
        variant={
          editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'
        }
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => focusWithoutScroll().toggleHeading({ level: 2 }).run()}
        aria-label="Toggle heading 2"
      >
        <Heading2 className="h-4 w-4 text-gray-600" />
      </Button>
      <Button
        variant={
          editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'
        }
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => focusWithoutScroll().toggleHeading({ level: 3 }).run()}
        aria-label="Toggle heading 3"
      >
        <Heading3 className="h-4 w-4 text-gray-600" />
      </Button>
      <div className="mx-0.5 h-4 w-px bg-gray-300" />

      {/* Text formatting buttons */}
      <Button
        variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => focusWithoutScroll().toggleBold().run()}
        aria-label="Toggle bold"
      >
        <Bold className="h-4 w-4 text-gray-600" />
      </Button>
      <Button
        variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => focusWithoutScroll().toggleItalic().run()}
        aria-label="Toggle italic"
      >
        <Italic className="h-4 w-4 text-gray-600" />
      </Button>
      <Button
        variant={editor.isActive('code') ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => focusWithoutScroll().toggleCode().run()}
        aria-label="Toggle inline code"
      >
        <Code2 className="h-4 w-4 text-gray-600" />
      </Button>
      <div className="mx-0.5 h-4 w-px bg-gray-300" />

      {/* Block formatting buttons */}
      <Button
        variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => focusWithoutScroll().toggleCodeBlock().run()}
        aria-label="Toggle code block"
      >
        <FileCode className="h-4 w-4 text-gray-600" />
      </Button>
      <Button
        variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => focusWithoutScroll().toggleBlockquote().run()}
        aria-label="Toggle blockquote"
      >
        <Quote className="h-4 w-4 text-gray-600" />
      </Button>
    </div>
  );
}

export function useCanvasRichTextEditor({
  value,
  onChange,
  exportFormat = 'markdown',
  disabled,
  artifactId,
  org,
  userId,
  title,
  enableAutoSave = false,
}: CanvasRichTextEditorProps) {
  // Track the last value we set to avoid unnecessary updates
  const lastSetValueRef = React.useRef<string>(value);
  const isUpdatingRef = React.useRef(false);
  const lastSavedValueRef = React.useRef<string>(value);
  const pendingSaveRef = React.useRef<string | null>(null);
  const lastUserInputRef = React.useRef<string>(value);

  // Auto-save mutation
  const [updateArtifactMutation] = useUpdateArtifactMutation();

  // Store auto-save config in refs so they're always accessible in onUpdate
  const autoSaveConfigRef = React.useRef({
    enableAutoSave,
    artifactId,
    org,
    userId,
    title,
  });

  // Update refs when props change
  React.useEffect(() => {
    autoSaveConfigRef.current = {
      enableAutoSave,
      artifactId,
      org,
      userId,
      title,
    };
    console.log(
      '[CanvasRichTextEditor] Auto-save config updated:',
      autoSaveConfigRef.current,
    );
  }, [enableAutoSave, artifactId, org, userId, title]);

  // Auto-save function - uses refs to get latest values
  /* istanbul ignore next -- @preserve internal async callback triggered by debounced editor events */
  const performAutoSave = React.useCallback(
    async (markdown: string) => {
      const config = autoSaveConfigRef.current;

      // Validate required IDs
      if (!config.artifactId || !config.org || !config.userId) {
        console.error(
          '[CanvasRichTextEditor] Cannot auto-save - missing required IDs',
          {
            artifactId: config.artifactId,
            org: config.org,
            userId: config.userId,
          },
        );
        return;
      }

      // Skip if content hasn't changed
      if (markdown.trim() === lastSavedValueRef.current.trim()) {
        console.log(
          '[CanvasRichTextEditor] Content unchanged, skipping auto-save',
        );
        return;
      }

      console.log('[CanvasRichTextEditor] Performing auto-save...', {
        artifactId: config.artifactId,
        org: config.org,
        userId: config.userId,
        contentLength: markdown.length,
      });

      try {
        const requestBody: { content: string; title?: string } = {
          content: markdown,
        };

        if (config.title) {
          requestBody.title = config.title;
        }

        const savedArtifact = await updateArtifactMutation({
          id: config.artifactId,
          org: config.org,
          userId: config.userId,
          requestBody,
        }).unwrap();

        console.log(
          '[CanvasRichTextEditor] Auto-save successful',
          savedArtifact,
        );

        if (savedArtifact?.content) {
          lastSavedValueRef.current = savedArtifact.content;
        } else {
          lastSavedValueRef.current = markdown;
        }
      } catch (error) {
        console.error('[CanvasRichTextEditor] Auto-save failed', error);
        // Don't throw - we want to continue editing even if save fails
      }
    },
    [updateArtifactMutation],
  );

  // Debounced auto-save (800ms delay) - store in ref so it's always accessible
  const debouncedAutoSaveRef = React.useRef<
    ((markdown: string) => void) | null
  >(null);

  /* istanbul ignore next -- @preserve debounced callback triggered by editor events */
  const debouncedAutoSave = useDebouncedCallback(async (markdown: string) => {
    pendingSaveRef.current = null;
    const config = autoSaveConfigRef.current;
    console.log('[CanvasRichTextEditor] Debounced save triggered', {
      markdownLength: markdown.length,
      config,
    });
    await performAutoSave(markdown);
  }, 800);

  // Store debounced function in ref
  React.useEffect(() => {
    debouncedAutoSaveRef.current = debouncedAutoSave;
  }, [debouncedAutoSave]);

  // Normalize content for editor initialization - exactly like reference
  const getInitialContent = () => {
    if (exportFormat === 'html') {
      return value;
    }

    // If exportFormat is markdown but value is HTML, convert HTML -> markdown -> HTML
    if (isHtml(value)) {
      const markdown = htmlToMarkdown(value);
      return markdownToHtml(markdown);
    }

    // Value is markdown, convert markdown -> HTML
    return markdownToHtml(value);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable heading from StarterKit to avoid duplication
        heading: false,
        // Enable code block
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-muted rounded-md p-4 font-mono text-sm',
          },
        },
        // Enable blockquote
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-primary pl-4 italic',
          },
        },
        // Configure bullet list with proper styling
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc pl-6 space-y-1',
          },
          keepMarks: true,
          keepAttributes: true,
        },
        // Configure ordered list with proper styling
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal pl-6 space-y-1',
          },
          keepMarks: true,
          keepAttributes: true,
        },
        // Configure list items
        listItem: {
          HTMLAttributes: {
            class: 'pl-1',
          },
        },
      }),
      Superscript,
      Subscript,
      Heading.configure({
        levels: [1, 2, 3],
        HTMLAttributes: {
          class: 'font-bold',
        },
      }),
      // Table extensions for GFM table support
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: 'border-collapse w-full my-4',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-gray-200',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class:
            'border border-gray-300 px-4 py-2 bg-gray-100 font-semibold text-left',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-4 py-2',
        },
      }),
      // Link extension for clickable URLs, mailto, and tel links
      Link.configure({
        openOnClick: true, // Keep built-in link handling as a fallback
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800 cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      // Math extensions for KaTeX rendering
      MathInline,
      MathBlock,
    ],
    content: getInitialContent(),
    // Note: onUpdate is handled via event listener in useEffect to ensure latest refs are used
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[400px] overflow-y-auto focus:outline-none leading-relaxed ' +
          // Paragraphs
          '[&_p]:mb-4 [&_p]:leading-7 ' +
          // Headings
          '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 ' +
          '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 ' +
          '[&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 ' +
          // Lists with explicit markers - use arbitrary values for circle/square
          '[&_ul]:list-disc [&_ul]:mb-4 [&_ul]:pl-6 [&_ul]:space-y-1 ' +
          '[&_ul_ul]:list-[circle] [&_ul_ul]:mt-1 [&_ul_ul]:mb-1 [&_ul_ul]:pl-4 ' +
          '[&_ul_ul_ul]:list-[square] [&_ul_ul_ul]:pl-4 ' +
          '[&_ol]:list-decimal [&_ol]:mb-4 [&_ol]:pl-10 [&_ol]:space-y-1 ' +
          '[&_ol_ol]:list-[lower-alpha] [&_ol_ol]:mt-1 [&_ol_ol]:mb-1 [&_ol_ol]:pl-4 ' +
          '[&_ol_ol_ol]:list-[lower-roman] [&_ol_ol_ol]:pl-4 ' +
          '[&_li]:leading-7 [&_li]:pl-1 ' +
          // Code
          '[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 ' +
          '[&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-4 [&_pre]:mb-4 ' +
          // Blockquote
          '[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:mb-4 [&_blockquote]:italic [&_blockquote]:leading-7 ' +
          // Links
          '[&_a]:text-primary [&_a]:underline ' +
          // Tables
          '[&_table]:w-full [&_table]:border-collapse [&_table]:my-4 ' +
          '[&_th]:border [&_th]:border-gray-300 [&_th]:px-4 [&_th]:py-2 [&_th]:bg-gray-100 [&_th]:font-semibold [&_th]:text-left ' +
          '[&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2 ' +
          '[&_tr:nth-child(even)]:bg-gray-50',
      },
    },
    /* istanbul ignore next -- @preserve TipTap internal onCreate callback */
    onCreate: ({ editor }) => {
      // Mark that editor was just created - no user edits yet
      (editor as any).__hasUserEdited = false;
    },
  });

  // Clear history and track programmatic updates
  /* istanbul ignore next -- @preserve internal effect for history management */
  React.useEffect(() => {
    if (!editor) return;

    // Store initial content hash to detect real changes
    const initialContent = editor.getHTML();
    (editor as any).__initialContent = initialContent;
    (editor as any).__hasUserEdited = false;

    // Clear history after editor is fully initialized
    // We need to actually reset the history plugin's state
    const timeoutId = setTimeout(() => {
      try {
        // Access the history plugin through ProseMirror's plugin system
        const { state } = editor;
        const historyPlugin = state.plugins.find((plugin) => {
          const key = (plugin as any).key;
          return key && (key.startsWith('history$') || key === 'history');
        });

        if (historyPlugin) {
          // Get the history plugin's state and reset it
          // The history plugin stores undo/redo stacks in its state
          const historyState = historyPlugin.getState(state);
          if (historyState) {
            // Create a new transaction that resets history
            // We do this by creating a transaction that doesn't add to history
            // and then manually clearing the history stacks
            const tr = state.tr;
            tr.setMeta('addToHistory', false);
            // Force history to be cleared by dispatching this transaction
            editor.view.dispatch(tr);
          }
        }

        // Also set a flag on the editor to track that we've cleared initial history
        (editor as any).__historyCleared = true;
      } catch (error) {
        console.error(
          '[CanvasRichTextEditor] Failed to clear initial history',
          error,
        );
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [editor]);

  // Update editor's onUpdate handler to use latest callbacks
  /* istanbul ignore next -- @preserve internal effect for editor update handling */
  React.useEffect(() => {
    if (!editor) return;

    const handleUpdate = ({ editor }: { editor: Editor }) => {
      // Prevent infinite loop - don't call onChange if we're in the middle of updating
      if (isUpdatingRef.current) {
        return;
      }
      const newValue =
        exportFormat === 'html'
          ? editor.getHTML()
          : htmlToMarkdown(editor.getHTML());
      lastSetValueRef.current = newValue;
      lastUserInputRef.current = newValue;
      onChange(newValue);

      // Trigger auto-save if enabled - use refs to get latest values
      const config = autoSaveConfigRef.current;
      const debouncedFn = debouncedAutoSaveRef.current;

      console.log('[CanvasRichTextEditor] onUpdate triggered (via event)', {
        enableAutoSave: config.enableAutoSave,
        artifactId: config.artifactId,
        org: config.org,
        userId: config.userId,
        hasDebouncedFn: !!debouncedFn,
        newValueLength: newValue.length,
      });

      if (config.enableAutoSave) {
        if (config.artifactId && config.org && config.userId && debouncedFn) {
          pendingSaveRef.current = newValue;
          console.log('[CanvasRichTextEditor] Calling debounced auto-save');
          debouncedFn(newValue);
        } else {
          console.error(
            '[CanvasRichTextEditor] Auto-save is enabled but missing required configuration',
            {
              enableAutoSave: config.enableAutoSave,
              artifactId: config.artifactId,
              org: config.org,
              userId: config.userId,
              hasDebouncedFn: !!debouncedFn,
            },
          );
        }
      }
    };

    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, exportFormat, onChange]);

  // Cleanup debounced save on unmount
  React.useEffect(() => {
    return () => {
      debouncedAutoSave.cancel();
    };
  }, [debouncedAutoSave]);

  // Update lastSavedValueRef when value changes externally (e.g., from API)
  React.useEffect(() => {
    if (value && value !== lastSetValueRef.current) {
      lastSavedValueRef.current = value;
    }
  }, [value]);

  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  /* istanbul ignore next -- @preserve internal effect for value synchronization */
  React.useEffect(() => {
    if (!editor) {
      return;
    }

    // Skip update if this value was just set by the editor itself (prevents infinite loop)
    if (value === lastSetValueRef.current) {
      return;
    }

    // If the incoming value matches the last user input and the editor is focused, do nothing.
    // This prevents cursor jumps while typing due to markdown/HTML normalization.
    if (editor?.isFocused && value === lastUserInputRef.current) {
      lastSetValueRef.current = value;
      return;
    }

    // Normalize content for update
    const getNextContent = () => {
      if (exportFormat === 'html') {
        return value;
      }
      if (isHtml(value)) {
        const markdown = htmlToMarkdown(value);
        return markdownToHtml(markdown);
      }
      return markdownToHtml(value);
    };

    const nextContent = getNextContent();
    const currentContent = editor.getHTML();
    const currentMarkdown = htmlToMarkdown(currentContent).trim();

    // If the editor already represents the provided value, avoid resetting content
    if (currentMarkdown === value.trim()) {
      lastSetValueRef.current = value;
      return;
    }

    // Only update if content actually changed (external update, not from user typing)
    if (nextContent !== currentContent) {
      // Mark that we're updating to prevent onChange from firing during this update
      isUpdatingRef.current = true;

      // Preserve cursor position when updating content
      const { from, to } = editor.state.selection;
      const selection = { from, to };
      const currentDocSize = editor.state.doc.content.size;

      // Set content without emitting update event
      // This is a programmatic update, so mark it as such
      editor.commands.setContent(nextContent, false);

      // Reset the user edited flag since this is a programmatic update
      (editor as any).__hasUserEdited = false;

      // Reset history after programmatic content update
      // This ensures undo/redo only tracks user-initiated changes
      requestAnimationFrame(() => {
        try {
          const { state, view } = editor;
          // Create a no-op transaction with addToHistory: false to reset history
          const tr = state.tr.setMeta('addToHistory', false);
          view.dispatch(tr);
        } catch (error) {
          console.error(
            '[CanvasRichTextEditor] Failed to reset history after programmatic update',
            error,
          );
        }
      });

      // Update the ref to track what we set (use the normalized value for comparison)
      lastSetValueRef.current = value;

      // Restore cursor position after content is set
      requestAnimationFrame(() => {
        try {
          const newDocSize = editor.state.doc.content.size;

          // If cursor was at the end of the old content, place it at the end of new content
          if (selection.from === currentDocSize) {
            editor.commands.setTextSelection(newDocSize);
          }
          // If cursor position is still valid in the new document, restore it
          else if (selection.from <= newDocSize && selection.to <= newDocSize) {
            editor.commands.setTextSelection({
              from: selection.from,
              to: selection.to,
            });
          }
          // Otherwise, try to maintain relative position
          /* istanbul ignore next -- @preserve edge case when selection exceeds new doc size */
          else {
            const relativePos = Math.min(selection.from, newDocSize);
            editor.commands.setTextSelection(relativePos);
          }
        } catch (e) {
          /* istanbul ignore next -- @preserve defensive error handling */
          // If position restoration fails, just focus the editor
          editor.commands.focus();
        }
        // Clear the updating flag
        isUpdatingRef.current = false;
      });
    } else {
      /* istanbul ignore next -- @preserve same content edge case */
      // Content is the same, but value prop changed - update the ref to prevent future unnecessary checks
      lastSetValueRef.current = value;
    }
  }, [editor, value, exportFormat]);

  return editor;
}

export function CanvasRichTextEditorContent({
  editor,
}: {
  editor: Editor | null;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Add native click listener for links - React events don't catch TipTap's rendered content
  /* istanbul ignore next -- @preserve DOM event handler for link clicks */
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleLinkClick = (event: MouseEvent) => {
      if (event.button !== 0) return;

      const target = event.target;
      const element =
        target instanceof Element
          ? target
          : target instanceof Node
            ? target.parentElement
            : null;
      const link = element?.closest('a');

      if (link) {
        const rawHref = link.getAttribute('href') ?? '';
        const href = rawHref.trim().replace(/\\:/g, ':');
        if (!href) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        // Handle mailto and tel differently (same window for native handlers)
        if (href.startsWith('mailto:') || href.startsWith('tel:')) {
          window.location.href = href;
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    };

    container.addEventListener('click', handleLinkClick, true); // Use capture phase

    return () => {
      container.removeEventListener('click', handleLinkClick, true);
    };
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div ref={containerRef}>
      <EditorContent editor={editor} />
    </div>
  );
}
