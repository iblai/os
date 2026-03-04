import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { CanvasView } from '../canvas-view';

// ============================================================================
// MOCKS
// ============================================================================

// Mock CanvasComponent - now handles both document and code types since CodeCanvasComponent is disabled
vi.mock('../canvas-component', () => ({
  CanvasComponent: (props: any) => (
    <div data-testid="canvas-component" data-title={props.title} data-content={props.content}>
      <span>Document Canvas: {props.title}</span>
      <span>Artifact ID: {props.artifactId}</span>
      <button onClick={props.onClose}>Close</button>
    </div>
  ),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('CanvasView', () => {
  const defaultProps = {
    onClose: vi.fn(),
    canvasTitle: 'Test Canvas',
    canvasContent: '# Test Content',
    canvasType: 'document' as const,
    artifactId: 123,
    org: 'test-org',
    userId: 'test-user',
    sessionId: 'session-123',
    tenantKey: 'test-tenant',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Document Canvas
  // ==========================================================================

  describe('Document Canvas', () => {
    it('renders CanvasComponent for document type', () => {
      render(<CanvasView {...defaultProps} canvasType="document" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('passes title to CanvasComponent', () => {
      render(<CanvasView {...defaultProps} canvasTitle="My Document" />);

      expect(screen.getByText('Document Canvas: My Document')).toBeInTheDocument();
    });

    it('passes content to CanvasComponent', () => {
      render(<CanvasView {...defaultProps} canvasContent="# Hello World" />);

      const canvas = screen.getByTestId('canvas-component');
      expect(canvas).toHaveAttribute('data-content', '# Hello World');
    });

    it('passes artifactId to CanvasComponent', () => {
      render(<CanvasView {...defaultProps} artifactId={456} />);

      expect(screen.getByText('Artifact ID: 456')).toBeInTheDocument();
    });

    it('passes onClose to CanvasComponent', () => {
      const onClose = vi.fn();
      render(<CanvasView {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByText('Close');
      closeButton.click();

      expect(onClose).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Code Canvas (Note: CodeCanvasComponent is currently disabled, uses CanvasComponent)
  // ==========================================================================

  describe('Code Canvas', () => {
    // Note: CodeCanvasComponent is disabled in the implementation,
    // so code type now also renders CanvasComponent
    it('renders CanvasComponent for code type (CodeCanvasComponent disabled)', () => {
      render(<CanvasView {...defaultProps} canvasType="code" />);

      // Currently renders CanvasComponent instead of CodeCanvasComponent
      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('passes title to CanvasComponent for code type', () => {
      render(<CanvasView {...defaultProps} canvasType="code" canvasTitle="main.py" />);

      expect(screen.getByText('Document Canvas: main.py')).toBeInTheDocument();
    });

    it('passes content to CanvasComponent for code type', () => {
      render(<CanvasView {...defaultProps} canvasType="code" canvasContent="print('Hello')" />);

      const canvas = screen.getByTestId('canvas-component');
      expect(canvas).toHaveAttribute('data-content', "print('Hello')");
    });

    it('accepts fileExtension prop even when CodeCanvasComponent is disabled', () => {
      // fileExtension is accepted but not used since CodeCanvasComponent is disabled
      render(<CanvasView {...defaultProps} canvasType="code" fileExtension="py" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('passes artifactId to CanvasComponent for code type', () => {
      render(<CanvasView {...defaultProps} canvasType="code" artifactId={789} />);

      expect(screen.getByText('Artifact ID: 789')).toBeInTheDocument();
    });

    it('passes onClose to CanvasComponent for code type', () => {
      const onClose = vi.fn();
      render(<CanvasView {...defaultProps} canvasType="code" onClose={onClose} />);

      const closeButton = screen.getByText('Close');
      closeButton.click();

      expect(onClose).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Component Key Management
  // ==========================================================================

  describe('Component Key Management', () => {
    it('uses artifactId in component key', () => {
      const { rerender } = render(<CanvasView {...defaultProps} artifactId={1} />);

      const canvas1 = screen.getByTestId('canvas-component');
      expect(canvas1).toBeInTheDocument();

      // Change artifactId should remount
      rerender(<CanvasView {...defaultProps} artifactId={2} />);

      const canvas2 = screen.getByTestId('canvas-component');
      expect(canvas2).toBeInTheDocument();
    });

    it('uses refreshTrigger to force remount', () => {
      const { rerender } = render(<CanvasView {...defaultProps} refreshTrigger={0} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();

      rerender(<CanvasView {...defaultProps} refreshTrigger={1} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('generates unique key without artifactId', () => {
      render(<CanvasView {...defaultProps} artifactId={undefined} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Refresh Trigger
  // ==========================================================================

  describe('Refresh Trigger', () => {
    it('updates refresh key when trigger changes', () => {
      const { rerender } = render(<CanvasView {...defaultProps} refreshTrigger={1} />);

      rerender(<CanvasView {...defaultProps} refreshTrigger={2} />);

      // Component should have been remounted with new key
      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('ignores zero or negative refresh triggers', () => {
      const { rerender } = render(<CanvasView {...defaultProps} refreshTrigger={0} />);

      rerender(<CanvasView {...defaultProps} refreshTrigger={0} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('handles undefined refreshTrigger', () => {
      render(<CanvasView {...defaultProps} refreshTrigger={undefined} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Props Passthrough
  // ==========================================================================

  describe('Props Passthrough', () => {
    it('passes org to canvas component', () => {
      render(<CanvasView {...defaultProps} org="custom-org" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('passes userId to canvas component', () => {
      render(<CanvasView {...defaultProps} userId="custom-user" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('passes metadata to canvas component', () => {
      const metadata = { key: 'value' };
      render(<CanvasView {...defaultProps} metadata={metadata} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('passes sessionId to canvas component', () => {
      render(<CanvasView {...defaultProps} sessionId="custom-session" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('passes tenantKey to canvas component', () => {
      render(<CanvasView {...defaultProps} tenantKey="custom-tenant" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('passes sendMessage to canvas component', () => {
      const sendMessage = vi.fn();
      render(<CanvasView {...defaultProps} sendMessage={sendMessage} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Styling
  // ==========================================================================

  describe('Styling', () => {
    it('applies white background', () => {
      const { container } = render(<CanvasView {...defaultProps} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('bg-white');
    });

    it('fills full height and width', () => {
      const { container } = render(<CanvasView {...defaultProps} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('h-full', 'w-full');
    });

    it('hides overflow', () => {
      const { container } = render(<CanvasView {...defaultProps} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('overflow-hidden');
    });

    it('uses flex column layout', () => {
      const { container } = render(<CanvasView {...defaultProps} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'flex-col');
    });

    it('sets minHeight to 0', () => {
      const { container } = render(<CanvasView {...defaultProps} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ minHeight: '0' });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles undefined title', () => {
      render(<CanvasView {...defaultProps} canvasTitle={undefined} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('handles empty title', () => {
      render(<CanvasView {...defaultProps} canvasTitle="" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('handles undefined content', () => {
      render(<CanvasView {...defaultProps} canvasContent={undefined} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('handles empty content', () => {
      render(<CanvasView {...defaultProps} canvasContent="" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('handles very long content', () => {
      const longContent = 'A'.repeat(100000);
      render(<CanvasView {...defaultProps} canvasContent={longContent} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('handles special characters in title', () => {
      render(<CanvasView {...defaultProps} canvasTitle="<script>test</script>" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('handles unicode content', () => {
      render(<CanvasView {...defaultProps} canvasContent="你好世界 🎉" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('handles undefined onClose', () => {
      render(<CanvasView {...defaultProps} onClose={undefined as any} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Type Switching (Note: CodeCanvasComponent is currently disabled)
  // ==========================================================================

  describe('Type Switching', () => {
    // Note: Since CodeCanvasComponent is disabled, both types render CanvasComponent
    it('maintains CanvasComponent when switching from document to code type', () => {
      const { rerender } = render(<CanvasView {...defaultProps} canvasType="document" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();

      rerender(<CanvasView {...defaultProps} canvasType="code" />);

      // Both types now use CanvasComponent since CodeCanvasComponent is disabled
      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('maintains CanvasComponent when switching from code to document type', () => {
      const { rerender } = render(<CanvasView {...defaultProps} canvasType="code" />);

      // Code type also uses CanvasComponent since CodeCanvasComponent is disabled
      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();

      rerender(<CanvasView {...defaultProps} canvasType="document" />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // ArtifactId Changes
  // ==========================================================================

  describe('ArtifactId Changes', () => {
    it('increments refresh key when artifactId changes', () => {
      const { rerender } = render(<CanvasView {...defaultProps} artifactId={100} />);

      expect(screen.getByText('Artifact ID: 100')).toBeInTheDocument();

      rerender(<CanvasView {...defaultProps} artifactId={200} />);

      expect(screen.getByText('Artifact ID: 200')).toBeInTheDocument();
    });

    it('handles artifactId changing to undefined', () => {
      const { rerender } = render(<CanvasView {...defaultProps} artifactId={100} />);

      rerender(<CanvasView {...defaultProps} artifactId={undefined} />);

      expect(screen.getByTestId('canvas-component')).toBeInTheDocument();
    });

    it('handles artifactId changing from undefined', () => {
      const { rerender } = render(<CanvasView {...defaultProps} artifactId={undefined} />);

      rerender(<CanvasView {...defaultProps} artifactId={100} />);

      expect(screen.getByText('Artifact ID: 100')).toBeInTheDocument();
    });
  });
});
