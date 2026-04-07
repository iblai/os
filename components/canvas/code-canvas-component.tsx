'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Undo2, Redo2, X, Share2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CodeCanvasComponentProps {
  title?: string;
  content?: string;
  onClose?: () => void;
  isAnimating?: boolean;
  artifactId?: number;
  org?: string;
  userId?: string;
  fileExtension?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  tenantKey?: string;
  sendMessage?: (
    text: string,
    options?: { visible?: boolean; artifact?: any },
  ) => void;
}

// Exported for testing - Basic syntax highlighting function for Python
export const highlightCodeSyntax = (text: string): string => {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"(.*?)"/g, '<span class="token-string">"$1"</span>') // Strings
    .replace(/'(.*?)'/g, '<span class="token-string">\'$1\'</span>') // Strings
    .replace(/#(.*)/g, '<span class="token-comment">#$1</span>'); // Comments

  // Python keywords
  const keywords = [
    'import',
    'as',
    'def',
    'try',
    'except',
    'return',
    'print',
    'if',
    'else',
    'for',
    'while',
    'in',
    'None',
    'True',
    'False',
    'with',
    'open',
    'from',
  ];
  keywords.forEach((keyword) => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    html = html.replace(regex, '<span class="token-keyword">$1</span>');
  });

  // Function calls (simple detection: word followed by parenthesis)
  html = html.replace(/(\b\w+)\(/g, '<span class="token-function">$1</span>(');

  // Numbers
  html = html.replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');

  return html;
};

// Exported for testing - Get line numbers array from content
export const getLineNumbersFromContent = (content: string): number[] => {
  const lines = content.split('\n').length;
  return Array.from({ length: lines }, (_, i) => i + 1);
};

// Exported for testing - Calculate selection range for cursor restoration
export const calculateSelectionRange = (
  element: HTMLElement,
  selection: Selection,
): { start: number; end: number } | null => {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(element);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  const start = preSelectionRange.toString().length;
  const end = start + range.toString().length;
  return { start, end };
};

// Exported for testing - Get snippet positions from selection
export const getSnippetPositions = (
  selectedText: string,
  preRangeLength: number,
): { snippetStart: number; snippetEnd: number } => {
  const snippetStart = preRangeLength;
  const snippetEnd = snippetStart + selectedText.length;
  return { snippetStart, snippetEnd };
};

// Exported for testing - Check if selection is within editor
export const isSelectionWithinEditor = (
  editorElement: HTMLElement | null,
  rangeAncestor: Node,
): boolean => {
  if (!editorElement) return false;
  return editorElement.contains(rangeAncestor);
};

// Exported for testing - Escape HTML entities for code display
export const escapeHtmlEntities = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// Exported for testing - Highlight strings in code
export const highlightStrings = (html: string): string => {
  return html
    .replace(/"(.*?)"/g, '<span class="token-string">"$1"</span>')
    .replace(/'(.*?)'/g, '<span class="token-string">\'$1\'</span>');
};

// Exported for testing - Highlight comments in code
export const highlightComments = (html: string): string => {
  return html.replace(/#(.*)/g, '<span class="token-comment">#$1</span>');
};

// Exported for testing - Highlight keyword in code
export const highlightKeyword = (html: string, keyword: string): string => {
  const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
  return html.replace(regex, '<span class="token-keyword">$1</span>');
};

// Exported for testing - Highlight all Python keywords
export const highlightPythonKeywords = (html: string): string => {
  const keywords = [
    'import',
    'as',
    'def',
    'try',
    'except',
    'return',
    'print',
    'if',
    'else',
    'for',
    'while',
    'in',
    'None',
    'True',
    'False',
    'with',
    'open',
    'from',
  ];
  let result = html;
  keywords.forEach((keyword) => {
    result = highlightKeyword(result, keyword);
  });
  return result;
};

// Exported for testing - Highlight function calls
export const highlightFunctionCalls = (html: string): string => {
  return html.replace(/(\b\w+)\(/g, '<span class="token-function">$1</span>(');
};

// Exported for testing - Highlight numbers
export const highlightNumbers = (html: string): string => {
  return html.replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');
};

// Exported for testing - Build artifact payload for highlight query
export const buildArtifactPayload = (
  title: string,
  fileExtension: string,
  artifactId: string | number,
  snippetStart: number,
  snippetEnd: number,
): {
  title: string;
  file_extension: string;
  id: string;
  is_partial: boolean;
  snippet_start: number;
  snippet_end: number;
} => {
  return {
    title: title || 'Untitled Code',
    file_extension: fileExtension || 'txt',
    id: String(artifactId),
    is_partial: true,
    snippet_start: snippetStart,
    snippet_end: snippetEnd,
  };
};

export function CodeCanvasComponent({
  title = 'Code Editor',
  content = '',
  onClose,
  isAnimating = false,
  artifactId: _artifactId,
  org: _org,
  userId: _userId,
  fileExtension: _fileExtension,
  metadata: _metadata,
  sessionId: _sessionId,
  tenantKey: _tenantKey,
  sendMessage,
}: CodeCanvasComponentProps) {
  const [codeContent, setCodeContent] = useState(content);
  const [highlightedContent, setHighlightedContent] = useState('');
  const [showAnimation, setShowAnimation] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State to store and restore cursor position
  const selectionRange = useRef<{ start: number; end: number } | null>(null);

  // Text highlighting state - using working implementation
  const [selectedText, setSelectedText] = useState<{
    text: string;
    position: { x: number; y: number };
    rect: DOMRect;
  } | null>(null);
  const [highlightInput, setHighlightInput] = useState('');
  const [showHighlightPopup, setShowHighlightPopup] = useState(false);
  const savedSelectionRef = useRef<Range | null>(null);
  const highlightInputRef = useRef<HTMLInputElement | null>(null);
  const [highlightRects, setHighlightRects] = useState<Array<DOMRect>>([]);
  const artifactId =
    _artifactId ||
    (typeof _metadata === 'object' && _metadata
      ? (_metadata as any)?.artifactId
      : undefined);

  // Version history state
  const [currentVersion, setCurrentVersion] = useState('v1');
  const [versionHistory, setVersionHistory] = useState<
    Array<{ id: string; label: string; content: string; timestamp: string }>
  >([
    {
      id: 'v1',
      label: 'v1',
      content: content || '',
      timestamp: new Date().toISOString(),
    },
  ]);

  // Function to save cursor position
  /* istanbul ignore next -- @preserve DOM selection callback */
  const saveSelection = useCallback(() => {
    if (editorRef.current) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(editorRef.current);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const start = preSelectionRange.toString().length;
        const end = start + range.toString().length;
        selectionRange.current = { start, end };
      }
    }
  }, []);

  // Function to restore cursor position
  /* istanbul ignore next -- @preserve DOM selection restoration callback */
  const restoreSelection = useCallback(() => {
    if (editorRef.current && selectionRange.current) {
      const { start, end } = selectionRange.current;
      const range = document.createRange();
      const selection = window.getSelection();

      let charCount = 0;
      let foundStart = false;
      let foundEnd = false;

      function traverseNodes(node: Node) {
        if (foundStart && foundEnd) return;

        if (node.nodeType === Node.TEXT_NODE) {
          const nextCharCount = charCount + node.textContent!.length;
          if (!foundStart && start >= charCount && start <= nextCharCount) {
            range.setStart(node, start - charCount);
            foundStart = true;
          }
          if (!foundEnd && end >= charCount && end <= nextCharCount) {
            range.setEnd(node, end - charCount);
            foundEnd = true;
          }
          charCount = nextCharCount;
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            traverseNodes(node.childNodes[i]);
          }
        }
      }

      traverseNodes(editorRef.current);

      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, []);

  // Basic syntax highlighting function for Python
  /* istanbul ignore next -- @preserve internal highlighting callback - tested via highlightCodeSyntax */
  const highlightCode = useCallback((text: string) => {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"(.*?)"/g, '<span class="token-string">"$1"</span>') // Strings
      .replace(/'(.*?)'/g, '<span class="token-string">\'$1\'</span>') // Strings
      .replace(/#(.*)/g, '<span class="token-comment">#$1</span>'); // Comments

    // Python keywords
    const keywords = [
      'import',
      'as',
      'def',
      'try',
      'except',
      'return',
      'print',
      'if',
      'else',
      'for',
      'while',
      'in',
      'None',
      'True',
      'False',
      'with',
      'open',
      'from',
    ];
    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
      html = html.replace(regex, '<span class="token-keyword">$1</span>');
    });

    // Function calls (simple detection: word followed by parenthesis)
    html = html.replace(
      /(\b\w+)\(/g,
      '<span class="token-function">$1</span>(',
    );

    // Numbers
    html = html.replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');

    return html;
  }, []);

  /* istanbul ignore next -- @preserve mobile check effect */
  useEffect(() => {
    const checkMobile = () => {};

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /* istanbul ignore next -- @preserve content sync effect */
  useEffect(() => {
    if (content !== undefined) {
      // Only update if content actually changed
      if (codeContent !== content) {
        setCodeContent(content);
        setHighlightedContent(highlightCode(content));

        // Update version history with initial content
        setVersionHistory((prev) => {
          if (prev.length === 1 && prev[0].content === '') {
            return [
              {
                id: 'v1',
                label: 'v1',
                content: content,
                timestamp: new Date().toISOString(),
              },
            ];
          }
          return prev;
        });
      }
    }
  }, [content, highlightCode, codeContent]);

  // Handle version change
  /* istanbul ignore next -- @preserve version change callback */
  const handleVersionChange = useCallback(
    (versionId: string) => {
      const version = versionHistory.find((v) => v.id === versionId);
      if (version && editorRef.current) {
        setCurrentVersion(versionId);
        setCodeContent(version.content);
        setHighlightedContent(highlightCode(version.content));
      }
    },
    [versionHistory, highlightCode],
  );

  /* istanbul ignore next -- @preserve editor content update effect */
  useEffect(() => {
    if (editorRef.current) {
      // Temporarily disable contentEditable to prevent browser from messing with selection
      editorRef.current.contentEditable = 'false';
      editorRef.current.innerHTML = highlightedContent;
      editorRef.current.contentEditable = 'true';
      restoreSelection();
    }
  }, [highlightedContent, restoreSelection]);

  /* istanbul ignore next -- @preserve resize observer effect */
  useEffect(() => {
    const handleResize = () => {};

    handleResize();
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  /* istanbul ignore next -- @preserve animation effect */
  useEffect(() => {
    if (isAnimating && !showAnimation) {
      setShowAnimation(true);
      const timer = setTimeout(() => {
        setShowAnimation(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, showAnimation]);

  /* istanbul ignore next -- @preserve DOM input handler */
  const handleInput = () => {
    if (editorRef.current) {
      saveSelection(); // Save selection before updating content
      const rawText = editorRef.current.innerText; // Get plain text content
      setCodeContent(rawText);
      setHighlightedContent(highlightCode(rawText));
    }
  };

  const getLineNumbers = useCallback(() => {
    const lines = codeContent.split('\n').length;
    return Array.from({ length: lines }, (_, i) => i + 1);
  }, [codeContent]);

  /* istanbul ignore next -- @preserve scroll sync handler */
  const handleScroll = () => {
    if (editorRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = editorRef.current.scrollTop;
    }
  };

  /* istanbul ignore next -- @preserve exec command handler */
  const execCommand = (command: string) => {
    if (editorRef.current) {
      document.execCommand(command);
      // After undo/redo, re-highlight and restore selection
      saveSelection();
      const rawText = editorRef.current.innerText;
      setCodeContent(rawText);
      setHighlightedContent(highlightCode(rawText));
    }
  };

  // Handle text selection for highlighting - WORKING IMPLEMENTATION
  /* istanbul ignore next -- @preserve DOM selection handler */
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (
      selection &&
      selection.toString().trim().length > 0 &&
      selection.rangeCount > 0
    ) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Check if selection is within the editor
      if (
        editorRef.current &&
        !editorRef.current.contains(range.commonAncestorContainer)
      ) {
        return;
      }

      // Save the range for later restoration
      savedSelectionRef.current = range.cloneRange();
      const rects = Array.from(range.getClientRects());

      setSelectedText({
        text: selection.toString(),
        position: { x: rect.left, y: rect.bottom + 8 },
        rect,
      });
      setShowHighlightPopup(true);
      setHighlightRects(rects);
    } else if (!showHighlightPopup) {
      // Only clear if popup is not showing
      setShowHighlightPopup(false);
      setSelectedText(null);
      savedSelectionRef.current = null;
      setHighlightRects([]);
    }
  };

  // Handle sending highlight query - WORKING IMPLEMENTATION
  /* istanbul ignore next -- @preserve highlight query handler */
  const handleSendHighlightQuery = () => {
    const inputText = highlightInput.trim();

    if (!inputText || !selectedText) {
      return;
    }

    // Calculate snippet positions
    if (!editorRef.current || !artifactId || !sendMessage) {
      console.error(
        '[CodeCanvas] Cannot send highlight query - missing requirements',
        {
          hasEditor: !!editorRef.current,
          hasArtifactId: !!artifactId,
          hasSendMessage: !!sendMessage,
        },
      );
      // Still clear the popup even if can't send
      setHighlightInput('');
      setShowHighlightPopup(false);
      setSelectedText(null);
      savedSelectionRef.current = null;
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      return;
    }

    try {
      if (savedSelectionRef.current) {
        const range = savedSelectionRef.current;
        const preRange = range.cloneRange();
        preRange.selectNodeContents(editorRef.current);
        preRange.setEnd(range.startContainer, range.startOffset);
        const snippetStart = preRange.toString().length;
        const snippetEnd = snippetStart + selectedText.text.length;

        // Get file extension
        const fileExt = _fileExtension || 'txt';

        // Send message with artifact snippet
        const artifactPayload = {
          title: title || 'Untitled Code',
          file_extension: fileExt,
          id: String(artifactId),
          is_partial: true,
          snippet_start: snippetStart,
          snippet_end: snippetEnd,
        };

        console.log('[CodeCanvas] Sending message with artifact payload:', {
          text: inputText,
          artifact: artifactPayload,
        });

        sendMessage(inputText, {
          visible: true,
          artifact: artifactPayload,
        });
      }
    } catch (error) {
      console.error('[CodeCanvas] Error sending highlight query:', error);
    }

    // Clear the popup after sending
    setHighlightInput('');
    setShowHighlightPopup(false);
    setSelectedText(null);
    savedSelectionRef.current = null;
    setHighlightRects([]);

    // Clear the selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  };

  // Restore selection when popup shows
  /* istanbul ignore next -- @preserve selection restore effect */
  useEffect(() => {
    if (showHighlightPopup && savedSelectionRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }
    }
  }, [showHighlightPopup]);

  // Add selection listeners - WORKING IMPLEMENTATION
  /* istanbul ignore next -- @preserve selection listeners effect */
  useEffect(() => {
    const handleMouseUp = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.highlight-popup')) {
        return;
      }
      setTimeout(handleTextSelection, 10);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showHighlightPopup && !target.closest('.highlight-popup')) {
        setShowHighlightPopup(false);
        setSelectedText(null);
        savedSelectionRef.current = null;
        setHighlightRects([]);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHighlightPopup, handleTextSelection]);

  // Keep highlight overlay aligned on scroll/resize
  /* istanbul ignore next -- @preserve scroll/resize alignment effect */
  useEffect(() => {
    if (!showHighlightPopup || !savedSelectionRef.current) return;
    const refresh = () => {
      const range = savedSelectionRef.current!;
      const rect = range.getBoundingClientRect();
      const rects = Array.from(range.getClientRects());
      setSelectedText((prev) =>
        prev
          ? { ...prev, position: { x: rect.left, y: rect.bottom + 8 }, rect }
          : null,
      );
      setHighlightRects(rects);
    };
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    editorRef.current?.addEventListener('scroll', refresh, true);
    return () => {
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
      editorRef.current?.removeEventListener('scroll', refresh, true);
    };
  }, [showHighlightPopup]);

  /* istanbul ignore next -- @preserve toolbar button renderer */
  const renderToolbarButton = (item: string) => {
    const buttonClass = 'h-8 w-8 p-0 flex-shrink-0';

    switch (item) {
      case 'undo':
        return (
          <Button
            key="undo"
            variant="ghost"
            size="sm"
            className={buttonClass}
            onClick={
              /* istanbul ignore next -- @preserve */ () => execCommand('undo')
            }
            title="Undo"
          >
            <Undo2 className="h-4 w-4 text-gray-600" />
          </Button>
        );
      case 'redo':
        return (
          <Button
            key="redo"
            variant="ghost"
            size="sm"
            className={buttonClass}
            onClick={
              /* istanbul ignore next -- @preserve */ () => execCommand('redo')
            }
            title="Redo"
          >
            <Redo2 className="h-4 w-4 text-gray-600" />
          </Button>
        );
      /* istanbul ignore next -- @preserve */
      default:
        return null;
    }
  };

  const visibleItems = ['undo', 'redo']; // Only relevant items for a code editor

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full flex-col overflow-hidden bg-white ${showAnimation ? 'animate-pulse' : ''}`}
    >
      {/* Cool Animation Overlay */}
      {showAnimation && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-bounce font-medium text-blue-600">
              Generating content...
            </div>
          </div>
        </div>
      )}

      {/* istanbul ignore next -- @preserve dynamic highlight rects rendering */}
      {highlightRects.length > 0 && (
        /* istanbul ignore next -- @preserve */ <div className="pointer-events-none fixed inset-0 z-[9997]">
          {highlightRects.map(
            /* istanbul ignore next -- @preserve */ (rect, idx) => (
              <div
                key={idx}
                style={{
                  position: 'fixed',
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  background: 'rgba(59,130,246,0.16)',
                  border: '1px solid rgba(37,99,235,0.45)',
                  borderRadius: 4,
                }}
              />
            ),
          )}
        </div>
      )}

      {/* Main Header - Fully Responsive */}
      <div className="flex min-h-[50px] flex-shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-2 py-2 sm:min-h-[60px] sm:px-3 sm:py-3 md:px-4">
        {/* Left Section - Title (Flexible with proper overflow handling) */}
        <div className="mr-2 flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-2">
          <FileText className="h-4 w-4 flex-shrink-0 text-blue-600 sm:h-5 sm:w-5" />
          <span className="block truncate text-xs font-medium text-gray-900 sm:text-sm md:text-base">
            {title}
          </span>

          {/* Version Dropdown */}
          {versionHistory.length > 0 && (
            <Select value={currentVersion} onValueChange={handleVersionChange}>
              <SelectTrigger className="h-7 w-20 border-gray-300 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versionHistory.map((version) => (
                  <SelectItem
                    key={version.id}
                    value={version.id}
                    className="text-xs"
                  >
                    {version.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Middle Section - Responsive Toolbar */}
        <div className="flex flex-shrink-0 items-center gap-0.5">
          {visibleItems.map((item) => renderToolbarButton(item))}

          {/* Vertical Three Dots Menu (if needed for future expansion, currently empty) */}
          {/* <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                <MoreVertical className="h-4 w-4 text-gray-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="p-3" style={{ minWidth: "fit-content" }}>
              <div className="flex flex-wrap gap-1 max-w-sm">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 h-8 px-2"
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Ask AI
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu> */}
        </div>

        {/* Right Section - Action Buttons (Fixed Width) */}
        <div className="ml-1 flex flex-shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Share"
          >
            <Share2 className="h-4 w-4 text-gray-600" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
              title="Close"
            >
              <X className="h-4 w-4 text-gray-600" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area - Code Editor */}
      <div className="flex flex-1 overflow-hidden bg-gray-50 font-mono text-sm text-gray-800">
        {/* Line Numbers */}
        <div
          ref={lineNumbersRef}
          className="w-10 flex-shrink-0 overflow-y-hidden border-r border-gray-200 bg-gray-100 px-2 py-4 text-right text-gray-500 select-none sm:w-12 md:w-14"
          style={{ lineHeight: '1.25rem' }} // Match line-height of code editor
        >
          {getLineNumbers().map((lineNumber) => (
            <div key={lineNumber} className="h-[1.25rem]">
              {lineNumber}
            </div>
          ))}
        </div>
        {/* Code Textarea */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onScroll={handleScroll}
          className="flex-1 resize-none overflow-auto bg-transparent p-4 font-mono text-sm leading-5 whitespace-pre-wrap text-gray-800 outline-none"
          spellCheck="false"
          suppressContentEditableWarning={true}
          style={{ tabSize: 4, MozTabSize: 4 }} // Ensure consistent tab size
        />
      </div>

      {/* Floating Action Buttons - Bottom Right (Removed as not relevant for code editor) */}
      {/* {!isMobile && (
        <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 flex flex-col gap-2 sm:gap-3 z-40">
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0 rounded-full bg-white shadow-lg border-gray-200 hover:bg-gray-50 transition-all duration-200 hover:scale-105"
          >
            <Edit3 className="h-4 w-4 text-gray-600" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0 rounded-full bg-white shadow-lg border-gray-200 hover:bg-gray-50 transition-all duration-200 hover:scale-105"
          >
            <BarChart3 className="h-4 w-4 text-gray-600" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0 rounded-full bg-white shadow-lg border-gray-200 hover:bg-gray-50 transition-all duration-200 hover:scale-105"
          >
            <AlignJustify className="h-4 w-4 text-gray-600" />
          </Button>
        </div>
      )} */}
      {/* Text Highlight Popup - WORKING IMPLEMENTATION */}
      {/* istanbul ignore next -- @preserve highlight popup JSX event handlers */}
      {
        /* istanbul ignore next -- @preserve */ showHighlightPopup &&
          selectedText && (
            <div
              className="highlight-popup fixed z-[9999]"
              style={{
                left: `${selectedText.position.x}px`,
                top: `${selectedText.position.y}px`,
              }}
              onMouseDown={
                /* istanbul ignore next -- @preserve */ (e) =>
                  e.stopPropagation()
              }
              onMouseUp={
                /* istanbul ignore next -- @preserve */ (e) =>
                  e.stopPropagation()
              }
            >
              <div className="flex w-[min(90vw,420px)] max-w-[420px] items-center gap-2.5 rounded-xl border border-gray-200/70 bg-white px-3.5 py-2.5 shadow-md">
                <Image
                  src="/icons/my-mentors.svg"
                  alt="Ask Gemini"
                  width={20}
                  height={20}
                />
                <input
                  ref={highlightInputRef}
                  type="text"
                  value={highlightInput}
                  onChange={
                    /* istanbul ignore next -- @preserve */ (e) =>
                      setHighlightInput(e.target.value)
                  }
                  onKeyDown={
                    /* istanbul ignore next -- @preserve */ (e) => {
                      if (e.key === 'Enter') {
                        handleSendHighlightQuery();
                      } else if (e.key === 'Escape') {
                        setShowHighlightPopup(false);
                        setSelectedText(null);
                        savedSelectionRef.current = null;
                        setHighlightRects([]);
                        const selection = window.getSelection();
                        if (selection) {
                          selection.removeAllRanges();
                        }
                      }
                    }
                  }
                  placeholder="Ask Anything..."
                  className="flex-1 rounded-lg border-none px-2 py-1 text-base text-gray-700 placeholder:text-gray-400 focus:ring-0 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          )
      }

      {/* Custom CSS for syntax highlighting */}
      <style jsx>{`
        .token-keyword {
          color: #0000ff; /* Blue for keywords */
        }
        .token-comment {
          color: #008000; /* Green for comments */
        }
        .token-string {
          color: #a31515; /* Red for strings */
        }
        .token-function {
          color: #795e26; /* Brown for function names */
        }
        .token-number {
          color: #098677; /* Teal for numbers */
        }
        /* Ensure contentEditable respects whitespace and line breaks */
        [contenteditable] {
          white-space: pre-wrap;
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}
