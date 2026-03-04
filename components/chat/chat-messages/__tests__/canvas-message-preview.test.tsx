import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasMessagePreview } from '../canvas-message-preview';
import type { CanvasOpenPayload } from '../types';

// Mock the utils - preserve cn and other exports
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    markdownToHtml: vi.fn((text) => `<p>${text}</p>`),
    isHtml: vi.fn((text) => text.startsWith('<')),
  };
});

// Mock Markdown component
vi.mock('@/components/markdown', () => ({
  default: ({ children, className }: { children?: string; className?: string }) => (
    <div data-testid="markdown" className={className}>
      {children}
    </div>
  ),
}));

// Mock icons
vi.mock('@/components/icons/svg-icons', () => ({
  CanvasIcon: ({ className }: { className?: string }) => (
    <svg data-testid="canvas-icon" className={className} />
  ),
}));

describe('CanvasMessagePreview', () => {
  const mockOnOpenCanvas = vi.fn();

  const defaultPayload: CanvasOpenPayload = {
    title: 'Test Document',
    content: 'Test content for the canvas',
    toolType: 'canvas',
    artifactId: 123,
    org: 'test-org',
    userId: 'test-user',
    fileExtension: 'md',
    metadata: {
      sessionId: 'session-123',
    },
  };

  const defaultProps = {
    title: 'Test Document',
    content: 'This is the full content of the document that will be displayed.',
    payload: defaultPayload,
    onOpenCanvas: mockOnOpenCanvas,
    isStreaming: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<CanvasMessagePreview {...defaultProps} />);
      expect(screen.getByTestId('canvas-message-preview')).toBeInTheDocument();
    });

    it('should display the title', () => {
      render(<CanvasMessagePreview {...defaultProps} />);
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });

    it('should display canvas icon', () => {
      render(<CanvasMessagePreview {...defaultProps} />);
      expect(screen.getByTestId('canvas-icon')).toBeInTheDocument();
    });

    it('should display Open Canvas button', () => {
      render(<CanvasMessagePreview {...defaultProps} />);
      expect(screen.getByTestId('canvas-open-button')).toBeInTheDocument();
      expect(screen.getByText('Open Canvas')).toBeInTheDocument();
    });
  });

  describe('snippet generation', () => {
    it('should truncate long content to SNIPPET_LENGTH (140 chars)', () => {
      const longContent = 'A'.repeat(200);
      render(<CanvasMessagePreview {...defaultProps} content={longContent} />);

      // Find the snippet element (the <p> that shows the preview)
      const snippetElement = screen.getByText(/^A+…$/);
      expect(snippetElement.textContent!.length).toBeLessThanOrEqual(141); // 140 + ellipsis
    });

    it('should not truncate short content', () => {
      const shortContent = 'Short content';
      render(<CanvasMessagePreview {...defaultProps} content={shortContent} />);

      expect(screen.getByText('Short content')).toBeInTheDocument();
    });

    it('should use previewText if provided', () => {
      render(<CanvasMessagePreview {...defaultProps} previewText="Custom preview text" />);

      expect(screen.getByText('Custom preview text')).toBeInTheDocument();
    });

    it('should strip HTML tags from content for snippet', () => {
      const htmlContent = '<p>Hello <strong>World</strong></p>';
      render(<CanvasMessagePreview {...defaultProps} content={htmlContent} />);

      // The stripped content should be displayed
      const paragraphs = screen.getAllByText(/Hello/);
      expect(paragraphs.length).toBeGreaterThan(0);
    });

    it('should strip HTML tags from previewText when it is already HTML', () => {
      const htmlPreview = '<div>Preview <em>content</em> here</div>';
      render(<CanvasMessagePreview {...defaultProps} previewText={htmlPreview} />);

      // isHtml returns true for text starting with '<', so the else branch strips tags
      const elements = screen.getAllByText(/Preview/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('streaming state', () => {
    it('should show loading indicator when isStreaming is true', () => {
      render(<CanvasMessagePreview {...defaultProps} isStreaming={true} />);

      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });

    it('should show spinning loader icon when streaming', () => {
      const { container } = render(<CanvasMessagePreview {...defaultProps} isStreaming={true} />);

      const spinnerIcon = container.querySelector('.animate-spin');
      expect(spinnerIcon).toBeInTheDocument();
    });

    it('should not show loading indicator when isStreaming is false', () => {
      render(<CanvasMessagePreview {...defaultProps} isStreaming={false} />);

      expect(screen.queryByText('Generating...')).not.toBeInTheDocument();
    });

    it('should default isStreaming to false', () => {
      render(
        <CanvasMessagePreview
          title="Test"
          content="Content"
          payload={defaultPayload}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.queryByText('Generating...')).not.toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('should call onOpenCanvas when Open Canvas button is clicked', () => {
      render(<CanvasMessagePreview {...defaultProps} />);

      const button = screen.getByTestId('canvas-open-button');
      fireEvent.click(button);

      expect(mockOnOpenCanvas).toHaveBeenCalledWith(defaultPayload);
      expect(mockOnOpenCanvas).toHaveBeenCalledTimes(1);
    });

    it('should log to console when onOpenCanvas is not provided', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(<CanvasMessagePreview {...defaultProps} onOpenCanvas={undefined} />);

      const button = screen.getByTestId('canvas-open-button');
      fireEvent.click(button);

      expect(consoleSpy).toHaveBeenCalledWith('Open Canvas - no handler provided');
      consoleSpy.mockRestore();
    });
  });

  describe('styling', () => {
    it('should have correct container classes', () => {
      render(<CanvasMessagePreview {...defaultProps} />);

      const container = screen.getByTestId('canvas-message-preview');
      expect(container).toHaveClass('bg-white');
      expect(container).toHaveClass('rounded-lg');
      expect(container).toHaveClass('border');
      expect(container).toHaveClass('border-gray-200');
      expect(container).toHaveClass('shadow-sm');
    });

    it('should have blue icon background', () => {
      const { container } = render(<CanvasMessagePreview {...defaultProps} />);

      const iconContainer = container.querySelector('.bg-\\[\\#D0E0FF\\]');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should have line-clamp-2 on snippet text', () => {
      const { container } = render(<CanvasMessagePreview {...defaultProps} />);

      const snippetEl = container.querySelector('.line-clamp-2');
      expect(snippetEl).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      render(<CanvasMessagePreview {...defaultProps} content="" />);

      expect(screen.getByTestId('canvas-message-preview')).toBeInTheDocument();
    });

    it('should handle empty title', () => {
      render(<CanvasMessagePreview {...defaultProps} title="" />);

      // Title is now rendered via Markdown component (a div), not an h3
      const markdownElements = screen.getAllByTestId('markdown');
      const titleElement = markdownElements[0];
      expect(titleElement.textContent).toBe('');
    });

    it('should handle content with only whitespace', () => {
      render(<CanvasMessagePreview {...defaultProps} content="   " />);

      expect(screen.getByTestId('canvas-message-preview')).toBeInTheDocument();
    });

    it('should handle content with markdown', () => {
      const markdownContent = '# Header\n\n**Bold text** and *italic*';
      render(<CanvasMessagePreview {...defaultProps} content={markdownContent} />);

      // Should render without crashing
      expect(screen.getByTestId('canvas-message-preview')).toBeInTheDocument();
    });

    it('should handle special characters in title', () => {
      render(
        <CanvasMessagePreview {...defaultProps} title={'Test <Document> & "Special" Characters'} />,
      );

      expect(screen.getByText('Test <Document> & "Special" Characters')).toBeInTheDocument();
    });

    it('should handle very long title with truncation', () => {
      const longTitle = 'A'.repeat(100);
      const { container } = render(<CanvasMessagePreview {...defaultProps} title={longTitle} />);

      const titleElement = container.querySelector('.truncate');
      expect(titleElement).toBeInTheDocument();
    });
  });

  describe('payload handling', () => {
    it('should pass the full payload to onOpenCanvas', () => {
      const customPayload: CanvasOpenPayload = {
        title: 'Custom Title',
        content: 'Custom content',
        toolType: 'code',
        artifactId: 456,
        org: 'custom-org',
        userId: 'custom-user',
        fileExtension: 'ts',
        metadata: {
          sessionId: 'custom-session',
          custom: 'data',
        },
      };

      render(<CanvasMessagePreview {...defaultProps} payload={customPayload} />);

      const button = screen.getByTestId('canvas-open-button');
      fireEvent.click(button);

      expect(mockOnOpenCanvas).toHaveBeenCalledWith(customPayload);
    });

    it('should handle payload without metadata', () => {
      const payloadWithoutMetadata: CanvasOpenPayload = {
        title: 'Test',
        content: 'Content',
        toolType: 'canvas',
        artifactId: 789,
      };

      render(<CanvasMessagePreview {...defaultProps} payload={payloadWithoutMetadata} />);

      const button = screen.getByTestId('canvas-open-button');
      fireEvent.click(button);

      expect(mockOnOpenCanvas).toHaveBeenCalledWith(payloadWithoutMetadata);
    });
  });

  describe('accessibility', () => {
    it('should render title and snippet via Markdown components', () => {
      render(<CanvasMessagePreview {...defaultProps} />);

      const markdownElements = screen.getAllByTestId('markdown');
      expect(markdownElements).toHaveLength(2);
      expect(markdownElements[0]).toHaveTextContent('Test Document');
    });

    it('should have clickable button', () => {
      render(<CanvasMessagePreview {...defaultProps} />);

      const button = screen.getByRole('button', { name: /open canvas/i });
      expect(button).toBeInTheDocument();
    });
  });
});
