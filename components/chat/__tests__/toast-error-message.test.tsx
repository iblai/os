import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastErrorMessage } from '../toast-error-message';

/**
 * Test suite for the ToastErrorMessage component
 *
 * This suite tests the ToastErrorMessage component's ability to:
 * 1. Render basic error messages with support email
 * 2. Handle punctuation in messages (add period when missing)
 * 3. Convert markdown to plain text
 * 4. Log errors to console with tenant context
 * 5. Render mailto link correctly
 */

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock markdownToPlainText
vi.mock('@iblai/iblai-js/web-utils', () => ({
  markdownToPlainText: vi.fn((text: string) => {
    // Simple mock implementation that strips basic markdown
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '$1') // Inline code
      .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links
  }),
}));

describe('ToastErrorMessage Component', () => {
  const defaultProps = {
    message: 'Something went wrong',
    supportEmail: 'support@example.com',
  };

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: 'test-mentor' });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  describe('Basic Rendering', () => {
    it('should render the error message', () => {
      render(<ToastErrorMessage {...defaultProps} />);

      expect(screen.getByText(/Sorry about that!/)).toBeInTheDocument();
    });

    it('should render the support email as a mailto link', () => {
      render(<ToastErrorMessage {...defaultProps} />);

      const link = screen.getByRole('link', { name: 'contact us' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'mailto:support@example.com');
    });

    it('should apply correct styling to the contact link', () => {
      render(<ToastErrorMessage {...defaultProps} />);

      const link = screen.getByRole('link', { name: 'contact us' });
      expect(link).toHaveClass('text-blue-600');
      expect(link).toHaveClass('hover:text-blue-800');
      expect(link).toHaveClass('toast-wrapped-contact-tag');
    });

    it('should render within a div container', () => {
      const { container } = render(<ToastErrorMessage {...defaultProps} />);

      expect(container.querySelector('div')).toBeInTheDocument();
      expect(container.querySelector('span')).toBeInTheDocument();
    });
  });

  describe('Punctuation Handling', () => {
    it('should not add period when message ends with period', () => {
      render(<ToastErrorMessage message="Error occurred." supportEmail="support@example.com" />);

      // Should contain message without double period
      expect(screen.getByText(/Error occurred\./)).toBeInTheDocument();
      expect(screen.queryByText(/Error occurred\.\./)).not.toBeInTheDocument();
    });

    it('should not add period when message ends with exclamation mark', () => {
      render(<ToastErrorMessage message="Error!" supportEmail="support@example.com" />);

      expect(screen.getByText(/Error!/)).toBeInTheDocument();
      expect(screen.queryByText(/Error!\./)).not.toBeInTheDocument();
    });

    it('should not add period when message ends with question mark', () => {
      render(<ToastErrorMessage message="What happened?" supportEmail="support@example.com" />);

      expect(screen.getByText(/What happened\?/)).toBeInTheDocument();
      expect(screen.queryByText(/What happened\?\./)).not.toBeInTheDocument();
    });

    it('should add period when message does not end with punctuation', () => {
      render(
        <ToastErrorMessage message="Something went wrong" supportEmail="support@example.com" />,
      );

      // The message should have a period added
      expect(screen.getByText(/Something went wrong\./)).toBeInTheDocument();
    });

    it('should add period when message ends with letter', () => {
      render(<ToastErrorMessage message="Connection timeout" supportEmail="support@example.com" />);

      expect(screen.getByText(/Connection timeout\./)).toBeInTheDocument();
    });

    it('should add period when message ends with number', () => {
      render(<ToastErrorMessage message="Error code 500" supportEmail="support@example.com" />);

      expect(screen.getByText(/Error code 500\./)).toBeInTheDocument();
    });

    it('should handle empty message', () => {
      render(<ToastErrorMessage message="" supportEmail="support@example.com" />);

      // Empty message should still render the container
      expect(screen.getByText(/Sorry about that!/)).toBeInTheDocument();
    });
  });

  describe('Markdown Conversion', () => {
    it('should convert bold markdown to plain text', () => {
      render(
        <ToastErrorMessage
          message="**Important** error message"
          supportEmail="support@example.com"
        />,
      );

      // Bold should be stripped
      expect(screen.getByText(/Important error message/)).toBeInTheDocument();
    });

    it('should convert italic markdown to plain text', () => {
      render(
        <ToastErrorMessage
          message="*Emphasized* error message"
          supportEmail="support@example.com"
        />,
      );

      expect(screen.getByText(/Emphasized error message/)).toBeInTheDocument();
    });

    it('should convert inline code to plain text', () => {
      render(
        <ToastErrorMessage message="Error in `function`" supportEmail="support@example.com" />,
      );

      expect(screen.getByText(/Error in function/)).toBeInTheDocument();
    });

    it('should convert links to plain text', () => {
      render(
        <ToastErrorMessage
          message="Check [documentation](https://docs.example.com)"
          supportEmail="support@example.com"
        />,
      );

      expect(screen.getByText(/Check documentation/)).toBeInTheDocument();
    });

    it('should handle complex markdown', () => {
      render(
        <ToastErrorMessage
          message="**Bold** and *italic* with `code`"
          supportEmail="support@example.com"
        />,
      );

      expect(screen.getByText(/Bold and italic with code/)).toBeInTheDocument();
    });
  });

  describe('Console Error Logging', () => {
    it('should log error with tenant key on mount', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'my-tenant', mentorId: 'mentor-1' });

      render(<ToastErrorMessage message="Test error" supportEmail="support@example.com" />);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        JSON.stringify({ tenant: 'my-tenant', error: 'Test error' }),
      );
    });

    it('should log error with different tenant key', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'another-tenant', mentorId: 'mentor-2' });

      render(<ToastErrorMessage message="Different error" supportEmail="support@example.com" />);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        JSON.stringify({ tenant: 'another-tenant', error: 'Different error' }),
      );
    });

    it('should log error with undefined tenant when params are null', () => {
      mockUseParams.mockReturnValue(null);

      render(<ToastErrorMessage message="No tenant error" supportEmail="support@example.com" />);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        JSON.stringify({ tenant: undefined, error: 'No tenant error' }),
      );
    });

    it('should log error with undefined tenant when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ mentorId: 'mentor-1' });

      render(<ToastErrorMessage message="Missing tenant" supportEmail="support@example.com" />);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        JSON.stringify({ tenant: undefined, error: 'Missing tenant' }),
      );
    });

    it('should log error only once on mount', () => {
      const { rerender } = render(
        <ToastErrorMessage message="Initial error" supportEmail="support@example.com" />,
      );

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      // Rerender with same props shouldn't trigger new log
      rerender(<ToastErrorMessage message="Initial error" supportEmail="support@example.com" />);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should log new error when message changes', () => {
      const { rerender } = render(
        <ToastErrorMessage message="First error" supportEmail="support@example.com" />,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        JSON.stringify({ tenant: 'test-tenant', error: 'First error' }),
      );

      rerender(<ToastErrorMessage message="Second error" supportEmail="support@example.com" />);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        JSON.stringify({ tenant: 'test-tenant', error: 'Second error' }),
      );
    });
  });

  describe('Support Email Variations', () => {
    it('should handle different support email addresses', () => {
      render(<ToastErrorMessage message="Error" supportEmail="help@company.org" />);

      const link = screen.getByRole('link', { name: 'contact us' });
      expect(link).toHaveAttribute('href', 'mailto:help@company.org');
    });

    it('should handle email with subdomain', () => {
      render(<ToastErrorMessage message="Error" supportEmail="support@mail.company.com" />);

      const link = screen.getByRole('link', { name: 'contact us' });
      expect(link).toHaveAttribute('href', 'mailto:support@mail.company.com');
    });

    it('should handle email with plus sign', () => {
      render(<ToastErrorMessage message="Error" supportEmail="support+test@example.com" />);

      const link = screen.getByRole('link', { name: 'contact us' });
      expect(link).toHaveAttribute('href', 'mailto:support+test@example.com');
    });
  });

  describe('Message Content Edge Cases', () => {
    it('should handle message with only whitespace', () => {
      render(<ToastErrorMessage message="   " supportEmail="support@example.com" />);

      // Should still render the sorry message
      expect(screen.getByText(/Sorry about that!/)).toBeInTheDocument();
    });

    it('should handle message with special characters', () => {
      render(
        <ToastErrorMessage
          message="Error: <script>alert('xss')</script>"
          supportEmail="support@example.com"
        />,
      );

      // Should render safely without executing script
      expect(screen.getByText(/Sorry about that!/)).toBeInTheDocument();
    });

    it('should handle very long message', () => {
      const longMessage = 'Error '.repeat(100);
      render(<ToastErrorMessage message={longMessage} supportEmail="support@example.com" />);

      expect(screen.getByText(/Sorry about that!/)).toBeInTheDocument();
    });

    it('should handle message with newlines', () => {
      render(
        <ToastErrorMessage message="Line 1\nLine 2\nLine 3" supportEmail="support@example.com" />,
      );

      expect(screen.getByText(/Sorry about that!/)).toBeInTheDocument();
    });

    it('should handle message with unicode characters', () => {
      render(<ToastErrorMessage message="Error occurred 🚫" supportEmail="support@example.com" />);

      expect(screen.getByText(/Sorry about that!/)).toBeInTheDocument();
    });

    it('should handle message ending with multiple punctuation', () => {
      render(<ToastErrorMessage message="What happened?!" supportEmail="support@example.com" />);

      // Should not add additional period since it ends with !
      expect(screen.getByText(/What happened\?!/)).toBeInTheDocument();
    });

    it('should handle message with trailing whitespace before punctuation', () => {
      render(<ToastErrorMessage message="Error occurred ." supportEmail="support@example.com" />);

      expect(screen.getByText(/Error occurred \./)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible link text', () => {
      render(<ToastErrorMessage {...defaultProps} />);

      const link = screen.getByRole('link', { name: 'contact us' });
      expect(link).toBeInTheDocument();
    });

    it('should render semantic HTML structure', () => {
      const { container } = render(<ToastErrorMessage {...defaultProps} />);

      // Should have proper nesting: div > span > a
      const div = container.querySelector('div');
      const span = div?.querySelector('span');
      const link = span?.querySelector('a');

      expect(div).toBeInTheDocument();
      expect(span).toBeInTheDocument();
      expect(link).toBeInTheDocument();
    });
  });
});
