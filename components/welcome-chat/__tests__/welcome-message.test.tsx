import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WelcomeMessage } from '../welcome-message';

// Mock dependencies - hoist variables used in vi.mock factories
const { mockUseWelcome, mockConfig } = vi.hoisted(() => ({
  mockUseWelcome: vi.fn(),
  mockConfig: {
    baseWsUrl: vi.fn(),
  },
}));

vi.mock('@/hooks/use-welcome-message', () => ({
  default: (args: any) => mockUseWelcome(args),
}));

vi.mock('@/lib/config', () => ({
  config: mockConfig,
}));

vi.mock('@/components/markdown', () => ({
  default: ({ children, className }: { children: string; className?: string }) => (
    <div data-testid="markdown-content" className={className}>
      {children}
    </div>
  ),
}));

describe('WelcomeMessage', () => {
  const defaultProps = {
    aiWelcomeMessage: 'Default AI welcome',
    sessionId: 'session-123',
    username: 'test-user',
    tenantKey: 'test-tenant',
    mentorUniqueId: 'mentor-123',
    token: 'test-token',
    isNewSession: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWelcome.mockReturnValue({ welcomeMessage: 'Hook welcome message' });
    mockConfig.baseWsUrl.mockReturnValue('wss://example.com');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render Markdown component', () => {
      render(<WelcomeMessage {...defaultProps} />);

      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    it('should render welcomeMessage from hook when available', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: 'From hook' });

      render(<WelcomeMessage {...defaultProps} />);

      expect(screen.getByTestId('markdown-content')).toHaveTextContent('From hook');
    });

    it('should render aiWelcomeMessage when welcomeMessage is empty', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      render(<WelcomeMessage {...defaultProps} aiWelcomeMessage="AI fallback" />);

      expect(screen.getByTestId('markdown-content')).toHaveTextContent('AI fallback');
    });

    it('should prioritize welcomeMessage over aiWelcomeMessage', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: 'Hook message' });

      render(<WelcomeMessage {...defaultProps} aiWelcomeMessage="AI message" />);

      const markdown = screen.getByTestId('markdown-content');
      expect(markdown).toHaveTextContent('Hook message');
      expect(markdown).not.toHaveTextContent('AI message');
    });

    it('should render empty string when both messages are empty', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      render(<WelcomeMessage {...defaultProps} aiWelcomeMessage="" />);

      expect(screen.getByTestId('markdown-content').textContent).toBe('');
    });

    it('should handle null welcomeMessage from hook', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: null });

      render(<WelcomeMessage {...defaultProps} aiWelcomeMessage="Fallback" />);

      expect(screen.getByTestId('markdown-content')).toHaveTextContent('Fallback');
    });

    it('should handle undefined welcomeMessage from hook', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: undefined });

      render(<WelcomeMessage {...defaultProps} aiWelcomeMessage="Fallback" />);

      expect(screen.getByTestId('markdown-content')).toHaveTextContent('Fallback');
    });

    it('should handle special characters in welcome message', () => {
      mockUseWelcome.mockReturnValue({
        welcomeMessage: 'Hello! How can I help? 🤖 <script>alert("xss")</script>',
      });

      render(<WelcomeMessage {...defaultProps} />);

      expect(screen.getByTestId('markdown-content')).toHaveTextContent(
        'Hello! How can I help? 🤖 <script>alert("xss")</script>',
      );
    });

    it('should handle multiline welcome message', () => {
      mockUseWelcome.mockReturnValue({
        welcomeMessage: 'Line 1\nLine 2\n- Item 1',
      });

      render(<WelcomeMessage {...defaultProps} />);

      const markdown = screen.getByTestId('markdown-content');
      expect(markdown).toHaveTextContent('Line 1');
      expect(markdown).toHaveTextContent('Line 2');
      expect(markdown).toHaveTextContent('Item 1');
    });
  });

  describe('className', () => {
    it('should use default className when not provided', () => {
      render(<WelcomeMessage {...defaultProps} />);

      const markdown = screen.getByTestId('markdown-content');
      expect(markdown).toHaveClass('text-gray-600');
      expect(markdown).toHaveClass('text-lg');
      expect(markdown).toHaveClass('max-w-3xl');
    });

    it('should use custom className when provided', () => {
      render(<WelcomeMessage {...defaultProps} className="mt-1 text-[14px] text-gray-600" />);

      const markdown = screen.getByTestId('markdown-content');
      expect(markdown).toHaveClass('mt-1');
      expect(markdown).toHaveClass('text-[14px]');
      expect(markdown).toHaveClass('text-gray-600');
    });

    it('should not have default classes when custom className is provided', () => {
      render(<WelcomeMessage {...defaultProps} className="custom-class" />);

      const markdown = screen.getByTestId('markdown-content');
      expect(markdown).toHaveClass('custom-class');
      expect(markdown).not.toHaveClass('text-lg');
      expect(markdown).not.toHaveClass('max-w-3xl');
    });
  });

  describe('useWelcome hook integration', () => {
    it('should pass correct props to useWelcome hook', () => {
      mockConfig.baseWsUrl.mockReturnValue('wss://test.com');

      render(
        <WelcomeMessage
          aiWelcomeMessage="test"
          sessionId="session-456"
          username="user-123"
          tenantKey="tenant-456"
          mentorUniqueId="mentor-789"
          token="token-abc"
          isNewSession={false}
        />,
      );

      expect(mockUseWelcome).toHaveBeenCalledWith({
        sessionId: 'session-456',
        username: 'user-123',
        tenantKey: 'tenant-456',
        mentorUniqueId: 'mentor-789',
        token: 'token-abc',
        wsUrl: 'wss://test.com/ws/langflow/',
        isNewSession: false,
      });
    });

    it('should construct wsUrl from config.baseWsUrl', () => {
      mockConfig.baseWsUrl.mockReturnValue('wss://custom-ws.example.com');

      render(<WelcomeMessage {...defaultProps} />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          wsUrl: 'wss://custom-ws.example.com/ws/langflow/',
        }),
      );
    });

    it('should pass isNewSession true by default from props', () => {
      render(<WelcomeMessage {...defaultProps} isNewSession={true} />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          isNewSession: true,
        }),
      );
    });

    it('should pass isNewSession false when set', () => {
      render(<WelcomeMessage {...defaultProps} isNewSession={false} />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          isNewSession: false,
        }),
      );
    });

    it('should pass token from props', () => {
      render(<WelcomeMessage {...defaultProps} token="custom-token" />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'custom-token',
        }),
      );
    });

    it('should pass empty string username', () => {
      render(<WelcomeMessage {...defaultProps} username="" />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          username: '',
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty token', () => {
      render(<WelcomeMessage {...defaultProps} token="" />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          token: '',
        }),
      );
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    it('should handle empty tenantKey', () => {
      render(<WelcomeMessage {...defaultProps} tenantKey="" />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantKey: '',
        }),
      );
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    it('should handle empty mentorUniqueId', () => {
      render(<WelcomeMessage {...defaultProps} mentorUniqueId="" />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          mentorUniqueId: '',
        }),
      );
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    it('should handle empty sessionId', () => {
      render(<WelcomeMessage {...defaultProps} sessionId="" />);

      expect(mockUseWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: '',
        }),
      );
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    it('should re-render when aiWelcomeMessage changes', () => {
      const { rerender } = render(
        <WelcomeMessage {...defaultProps} aiWelcomeMessage="Initial" />,
      );

      mockUseWelcome.mockReturnValue({ welcomeMessage: '' });

      rerender(<WelcomeMessage {...defaultProps} aiWelcomeMessage="Updated" />);

      expect(screen.getByTestId('markdown-content')).toHaveTextContent('Updated');
    });

    it('should re-render when welcomeMessage from hook changes', () => {
      mockUseWelcome.mockReturnValue({ welcomeMessage: 'First' });

      const { rerender } = render(<WelcomeMessage {...defaultProps} />);
      expect(screen.getByTestId('markdown-content')).toHaveTextContent('First');

      mockUseWelcome.mockReturnValue({ welcomeMessage: 'Second' });

      rerender(<WelcomeMessage {...defaultProps} />);
      expect(screen.getByTestId('markdown-content')).toHaveTextContent('Second');
    });
  });
});
