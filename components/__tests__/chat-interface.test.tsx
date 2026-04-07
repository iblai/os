import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatInterface } from '../chat-interface';
import React from 'react';

// Mock the Chat component
vi.mock('../chat', () => ({
  Chat: vi.fn(({ mode, isPreviewMode, hasBorder, isInCanvasView }) => (
    <div data-testid="chat-component">
      <span data-testid="mode">{mode}</span>
      <span data-testid="preview-mode">{String(isPreviewMode)}</span>
      <span data-testid="has-border">{String(hasBorder)}</span>
      <span data-testid="in-canvas-view">{String(isInCanvasView)}</span>
    </div>
  )),
}));

describe('ChatInterface', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<ChatInterface />);
      expect(screen.getByTestId('chat-component')).toBeInTheDocument();
    });

    it('should render with correct container styling', () => {
      const { container } = render(<ChatInterface />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass('h-full');
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('flex-col');
      expect(wrapper).toHaveClass('overflow-hidden');
    });
  });

  describe('Chat component props', () => {
    it('should pass mode="default" to Chat component', () => {
      render(<ChatInterface />);
      expect(screen.getByTestId('mode')).toHaveTextContent('default');
    });

    it('should pass isPreviewMode=false to Chat component', () => {
      render(<ChatInterface />);
      expect(screen.getByTestId('preview-mode')).toHaveTextContent('false');
    });

    it('should pass hasBorder=false to Chat component', () => {
      render(<ChatInterface />);
      expect(screen.getByTestId('has-border')).toHaveTextContent('false');
    });

    it('should pass isInCanvasView=false by default to Chat component', () => {
      render(<ChatInterface />);
      expect(screen.getByTestId('in-canvas-view')).toHaveTextContent('false');
    });

    it('should pass isInCanvasView=true when prop is provided', () => {
      render(<ChatInterface isInCanvasView={true} />);
      expect(screen.getByTestId('in-canvas-view')).toHaveTextContent('true');
    });
  });

  describe('containerRef handling', () => {
    it('should apply ref to the container div', () => {
      const containerRef = React.createRef<HTMLDivElement>();
      render(<ChatInterface containerRef={containerRef} />);

      expect(containerRef.current).toBeInstanceOf(HTMLDivElement);
      expect(containerRef.current).toHaveClass('h-full');
    });

    it('should work without containerRef', () => {
      render(<ChatInterface />);
      expect(screen.getByTestId('chat-component')).toBeInTheDocument();
    });

    it('should handle null ref', () => {
      const containerRef = {
        current: null,
      } as React.RefObject<HTMLDivElement | null>;
      render(<ChatInterface containerRef={containerRef} />);

      // After render, the ref should be populated
      expect(containerRef.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('props combinations', () => {
    it('should handle both props together', () => {
      const containerRef = React.createRef<HTMLDivElement>();
      render(
        <ChatInterface containerRef={containerRef} isInCanvasView={true} />,
      );

      expect(containerRef.current).toBeInstanceOf(HTMLDivElement);
      expect(screen.getByTestId('in-canvas-view')).toHaveTextContent('true');
    });

    it('should handle default isInCanvasView with containerRef', () => {
      const containerRef = React.createRef<HTMLDivElement>();
      render(<ChatInterface containerRef={containerRef} />);

      expect(containerRef.current).toBeInstanceOf(HTMLDivElement);
      expect(screen.getByTestId('in-canvas-view')).toHaveTextContent('false');
    });
  });

  describe('layout structure', () => {
    it('should have the correct DOM structure', () => {
      const { container } = render(<ChatInterface />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.tagName).toBe('DIV');
      expect(wrapper.children.length).toBeGreaterThan(0);
    });

    it('should contain the Chat component', () => {
      render(<ChatInterface />);
      const chatComponent = screen.getByTestId('chat-component');
      expect(chatComponent).toBeInTheDocument();
    });
  });
});
