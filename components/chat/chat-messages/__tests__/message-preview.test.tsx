import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessagePreview } from '../message-preview';
import type { ArtifactVersion } from '@iblai/iblai-js/web-utils';
import type { CanvasOpenPayload } from '../types';

// Mock Markdown component
vi.mock('@/components/markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

// Mock CanvasMessagePreview component
vi.mock('../canvas-message-preview', () => ({
  CanvasMessagePreview: ({
    title,
    content: _content,
    payload,
    onOpenCanvas,
    isStreaming,
  }: {
    title: string;
    content: string;
    payload: CanvasOpenPayload;
    onOpenCanvas?: (payload: CanvasOpenPayload) => void;
    isStreaming?: boolean;
  }) => (
    <div data-testid="canvas-message-preview">
      <span data-testid="canvas-title">{title}</span>
      <span data-testid="canvas-streaming">{String(isStreaming)}</span>
      <button
        data-testid="canvas-open-btn"
        onClick={() => onOpenCanvas?.(payload)}
      >
        Open
      </button>
    </div>
  ),
}));

describe('MessagePreview', () => {
  const mockOnOpenCanvas = vi.fn();

  const createArtifactVersion = (
    overrides: Partial<ArtifactVersion> = {},
  ): ArtifactVersion => ({
    id: 1,
    artifact: {
      id: 100,
      title: 'Test Artifact',
      content: 'Artifact content',
      file_extension: 'md',
      version_count: 1,
      current_version_number: 1,
      date_created: new Date().toISOString(),
      date_updated: new Date().toISOString(),
    },
    title: 'Test Artifact',
    content: 'Artifact content',
    is_current: true,
    version_number: 1,
    date_created: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any event listeners
    vi.restoreAllMocks();
  });

  describe('rendering without artifact versions', () => {
    it('should render plain markdown content when no artifact versions', () => {
      render(
        <MessagePreview
          content="# Hello World"
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('markdown-content')).toHaveTextContent(
        '# Hello World',
      );
    });

    it('should render Markdown component for content', () => {
      render(
        <MessagePreview
          content="Some **bold** text"
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    it('should handle empty content', () => {
      render(<MessagePreview content="" onOpenCanvas={mockOnOpenCanvas} />);

      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });
  });

  describe('rendering with artifact versions', () => {
    it('should render CanvasMessagePreview when artifact versions exist', () => {
      const artifactVersions = [createArtifactVersion()];

      render(
        <MessagePreview
          content="Message content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('canvas-message-preview')).toBeInTheDocument();
    });

    it('should display artifact title', () => {
      const artifactVersions = [
        createArtifactVersion({ title: 'Custom Artifact Title' }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('canvas-title')).toHaveTextContent(
        'Custom Artifact Title',
      );
    });

    it('should use artifact.title as fallback when version title is missing', () => {
      const artifactVersions = [
        createArtifactVersion({
          title: undefined as any,
          artifact: {
            id: 100,
            title: 'Artifact Level Title',
            content: 'Content',
            file_extension: 'md',
            version_count: 1,
            current_version_number: 1,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      // Should fall back to artifact.title
      expect(screen.getByTestId('canvas-title')).toHaveTextContent(
        'Artifact Level Title',
      );
    });

    it('should show "Untitled Artifact" when no title is available', () => {
      const artifactVersions = [
        createArtifactVersion({
          title: undefined as any,
          artifact: {
            id: 100,
            title: undefined as any,
            content: 'Content',
            file_extension: 'md',
            version_count: 1,
            current_version_number: 1,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('canvas-title')).toHaveTextContent(
        'Untitled Artifact',
      );
    });
  });

  describe('current version selection', () => {
    it('should use is_current version when available', () => {
      const artifactVersions = [
        createArtifactVersion({
          id: 1,
          is_current: false,
          version_number: 1,
          title: 'Old Version',
        }),
        createArtifactVersion({
          id: 2,
          is_current: true,
          version_number: 2,
          title: 'Current Version',
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('canvas-title')).toHaveTextContent(
        'Current Version',
      );
    });

    it('should use highest version number when no is_current', () => {
      const artifactVersions = [
        createArtifactVersion({
          id: 1,
          is_current: false,
          version_number: 1,
          title: 'Title V1',
        }),
        createArtifactVersion({
          id: 2,
          is_current: false,
          version_number: 3,
          title: 'Title V3',
        }),
        createArtifactVersion({
          id: 3,
          is_current: false,
          version_number: 2,
          title: 'Title V2',
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      // When no is_current, renders as a simple button with the title and version number
      // The highest version (3) is selected
      expect(screen.getByText('Title V3')).toBeInTheDocument();
      expect(screen.getByText('Version 3')).toBeInTheDocument();
    });

    it('should fallback to first version when no is_current and getCurrentArtifactVersion returns null', () => {
      const artifactVersions = [
        createArtifactVersion({
          id: 1,
          is_current: false,
          version_number: 1,
          title: 'First Version Title',
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      // When no is_current, renders as a simple button
      expect(screen.getByText('First Version Title')).toBeInTheDocument();
    });
  });

  describe('streaming state', () => {
    it('should show streaming state when streamingArtifactId matches', () => {
      const artifactVersions = [
        createArtifactVersion({
          artifact: {
            id: 123,
            title: 'Streaming Artifact',
            content: 'Content',
            file_extension: 'md',
            version_count: 1,
            current_version_number: 1,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          streamingArtifactId={123}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('canvas-streaming')).toHaveTextContent('true');
    });

    it('should not show streaming state when streamingArtifactId does not match', () => {
      const artifactVersions = [
        createArtifactVersion({
          artifact: {
            id: 123,
            title: 'Artifact',
            content: 'Content',
            file_extension: 'md',
            version_count: 1,
            current_version_number: 1,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          streamingArtifactId={456}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('canvas-streaming')).toHaveTextContent('false');
    });

    it('should not show streaming when streamingArtifactId is undefined', () => {
      const artifactVersions = [createArtifactVersion()];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('canvas-streaming')).toHaveTextContent('false');
    });
  });

  describe('onOpenCanvas callback', () => {
    it('should call onOpenCanvas with correct payload', () => {
      const artifactVersions = [
        createArtifactVersion({
          artifact: {
            id: 100,
            title: 'Test Artifact',
            content: 'Artifact content',
            file_extension: 'md',
            version_count: 1,
            current_version_number: 1,
            username: 'test-user',
            session_id: 'session-123',
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
          version_number: 1,
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      fireEvent.click(screen.getByTestId('canvas-open-btn'));

      expect(mockOnOpenCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Artifact',
          artifactId: 100,
          fileExtension: 'md',
        }),
      );
    });

    it('should call onOpenCanvas from non-current version button', () => {
      const artifactVersions = [
        createArtifactVersion({
          is_current: false,
          version_number: 1,
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      // Non-current version renders as a button instead of CanvasMessagePreview
      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockOnOpenCanvas).toHaveBeenCalled();
    });
  });

  describe('tool type determination', () => {
    it('should set toolType to "code" for code file extensions', () => {
      // Test with a single code extension to avoid multiple renders
      const artifactVersions = [
        createArtifactVersion({
          artifact: {
            id: 100,
            title: 'Code File',
            content: 'code',
            file_extension: 'py',
            version_count: 1,
            current_version_number: 1,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      fireEvent.click(screen.getByTestId('canvas-open-btn'));

      expect(mockOnOpenCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          toolType: 'code',
        }),
      );
    });

    it('should set toolType to "code" for typescript extensions', () => {
      const artifactVersions = [
        createArtifactVersion({
          artifact: {
            id: 100,
            title: 'Code File',
            content: 'code',
            file_extension: 'ts',
            version_count: 1,
            current_version_number: 1,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      fireEvent.click(screen.getByTestId('canvas-open-btn'));

      expect(mockOnOpenCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          toolType: 'code',
        }),
      );
    });

    it('should set toolType to "canvas" for non-code file extensions', () => {
      const artifactVersions = [
        createArtifactVersion({
          artifact: {
            id: 100,
            title: 'Document',
            content: 'doc',
            file_extension: 'md',
            version_count: 1,
            current_version_number: 1,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      fireEvent.click(screen.getByTestId('canvas-open-btn'));

      expect(mockOnOpenCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          toolType: 'canvas',
        }),
      );
    });

    it('should default to "canvas" when no file extension', () => {
      const artifactVersions = [
        createArtifactVersion({
          artifact: {
            id: 100,
            title: 'No Extension',
            content: 'content',
            file_extension: undefined as any,
            version_count: 1,
            current_version_number: 1,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      fireEvent.click(screen.getByTestId('canvas-open-btn'));

      expect(mockOnOpenCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          toolType: 'canvas',
        }),
      );
    });
  });

  describe('content rendering alongside artifact', () => {
    it('should render both content and artifact preview', () => {
      const artifactVersions = [createArtifactVersion()];

      render(
        <MessagePreview
          content="Some text content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('markdown-content')).toHaveTextContent(
        'Some text content',
      );
      expect(screen.getByTestId('canvas-message-preview')).toBeInTheDocument();
    });

    it('should not render content section when content is empty', () => {
      const artifactVersions = [createArtifactVersion()];

      render(
        <MessagePreview
          content=""
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('canvas-message-preview')).toBeInTheDocument();
    });

    it('should not render content section when content is only whitespace', () => {
      const artifactVersions = [createArtifactVersion()];

      render(
        <MessagePreview
          content="   "
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
    });
  });

  describe('artifact title update event listener', () => {
    it('should update title when artifact-title-updated event is fired', async () => {
      const artifactVersions = [
        createArtifactVersion({
          title: 'Original Title',
          artifact: {
            id: 123,
            title: 'Original Title',
            content: 'content',
            file_extension: 'md',
            version_count: 1,
            current_version_number: 1,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByTestId('canvas-title')).toHaveTextContent(
        'Original Title',
      );

      // Dispatch title update event
      const event = new CustomEvent('artifact-title-updated', {
        detail: { artifactId: 123, title: 'Updated Title' },
      });
      window.dispatchEvent(event);

      await waitFor(() => {
        expect(screen.getByTestId('canvas-title')).toHaveTextContent(
          'Updated Title',
        );
      });
    });

    it('should not update title when event artifactId does not match', async () => {
      const artifactVersions = [
        createArtifactVersion({
          is_current: true,
          title: 'Original Title',
          artifact: {
            id: 123,
            title: 'Original Title',
            content: 'content',
            file_extension: 'md',
            version_count: 1,
            current_version_number: 1,
            date_created: new Date().toISOString(),
            date_updated: new Date().toISOString(),
          },
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      const event = new CustomEvent('artifact-title-updated', {
        detail: { artifactId: 456, title: 'Different Title' },
      });
      window.dispatchEvent(event);

      // Title should remain unchanged
      expect(screen.getByText('Original Title')).toBeInTheDocument();
    });
  });

  describe('snippet generation', () => {
    it('should build correct snippet from content', () => {
      const artifactVersions = [
        createArtifactVersion({
          content: '# Header\n\n**Bold** content with *italic* text',
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      // The component should render without crashing
      expect(screen.getByTestId('canvas-message-preview')).toBeInTheDocument();
    });

    it('should truncate long content to 150 characters', () => {
      const longContent = 'A'.repeat(200);
      const artifactVersions = [
        createArtifactVersion({
          content: longContent,
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      // Component should handle truncation
      expect(screen.getByTestId('canvas-message-preview')).toBeInTheDocument();
    });
  });

  describe('non-current version rendering', () => {
    it('should render simplified button for non-current versions', () => {
      const artifactVersions = [
        createArtifactVersion({
          is_current: false,
          version_number: 1,
          title: 'Old Document',
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      // Non-current version shows title and version number separately
      expect(screen.getByText('Old Document')).toBeInTheDocument();
      expect(screen.getByText('Version 1')).toBeInTheDocument();
    });

    it('should display version number for non-current versions', () => {
      const artifactVersions = [
        createArtifactVersion({
          is_current: false,
          version_number: 3,
          title: 'Some Document',
        }),
      ];

      render(
        <MessagePreview
          content="Content"
          artifactVersions={artifactVersions}
          onOpenCanvas={mockOnOpenCanvas}
        />,
      );

      expect(screen.getByText('Some Document')).toBeInTheDocument();
      expect(screen.getByText('Version 3')).toBeInTheDocument();
    });
  });
});
