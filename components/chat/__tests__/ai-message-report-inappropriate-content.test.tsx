import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Message } from '@iblai/iblai-js/web-utils';

import { AIMessageReportInappropriateContent } from '../ai-message-report-inappropriate-content';

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

describe('AIMessageReportInappropriateContent', () => {
  const mockMessages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'Hello, how are you?',
      timestamp: new Date().toISOString(),
      visible: true,
    },
    {
      id: '2',
      role: 'assistant',
      content: 'I am doing well, thank you!',
      timestamp: new Date().toISOString(),
      visible: true,
    },
  ];

  const defaultProps = {
    mentorName: 'Test Mentor',
    messages: mockMessages,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the flag icon link', () => {
      render(<AIMessageReportInappropriateContent {...defaultProps} />);
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      expect(link).toBeInTheDocument();
    });

    it('should render screen reader text', () => {
      render(<AIMessageReportInappropriateContent {...defaultProps} />);
      const srText = screen.getAllByText('Report Inappropriate Content');
      expect(srText.length).toBeGreaterThanOrEqual(1);
      expect(srText[0]).toHaveClass('sr-only');
    });

    it('should render tooltip content', () => {
      render(<AIMessageReportInappropriateContent {...defaultProps} />);
      expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
        'Report Inappropriate Content',
      );
    });
  });

  describe('mailto link', () => {
    it('should use default support email when no supportEmail prop is provided', () => {
      render(<AIMessageReportInappropriateContent {...defaultProps} />);
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('mailto:support@iblai.zendesk.com'),
      );
    });

    it('should use tenant support email when supportEmail prop is provided', () => {
      render(
        <AIMessageReportInappropriateContent
          {...defaultProps}
          supportEmail="custom@tenant.com"
        />,
      );
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('mailto:custom@tenant.com'),
      );
    });

    it('should fall back to default email when supportEmail is empty string', () => {
      render(
        <AIMessageReportInappropriateContent
          {...defaultProps}
          supportEmail=""
        />,
      );
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('mailto:support@iblai.zendesk.com'),
      );
    });

    it('should include mentor name in the subject', () => {
      render(<AIMessageReportInappropriateContent {...defaultProps} />);
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      const href = link.getAttribute('href')!;
      expect(href).toContain(
        `subject=${encodeURIComponent('Report Inappropriate Content — Test Mentor')}`,
      );
    });

    it('should include conversation content in the body', () => {
      render(<AIMessageReportInappropriateContent {...defaultProps} />);
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      const href = link.getAttribute('href')!;
      const decodedBody = decodeURIComponent(href.split('body=')[1]);
      expect(decodedBody).toContain('[User]: Hello, how are you?');
      expect(decodedBody).toContain('[AI]: I am doing well, thank you!');
    });

    it('should format multiple messages with correct role labels', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Question 1',
          timestamp: '',
          visible: true,
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Answer 1',
          timestamp: '',
          visible: true,
        },
        {
          id: '3',
          role: 'user',
          content: 'Question 2',
          timestamp: '',
          visible: true,
        },
        {
          id: '4',
          role: 'assistant',
          content: 'Answer 2',
          timestamp: '',
          visible: true,
        },
      ];

      render(
        <AIMessageReportInappropriateContent
          {...defaultProps}
          messages={messages}
        />,
      );
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      const href = link.getAttribute('href')!;
      const decodedBody = decodeURIComponent(href.split('body=')[1]);
      expect(decodedBody).toContain('[User]: Question 1');
      expect(decodedBody).toContain('[AI]: Answer 1');
      expect(decodedBody).toContain('[User]: Question 2');
      expect(decodedBody).toContain('[AI]: Answer 2');
    });

    it('should handle empty messages array', () => {
      render(
        <AIMessageReportInappropriateContent {...defaultProps} messages={[]} />,
      );
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      expect(link).toHaveAttribute('href', expect.stringContaining('mailto:'));
    });

    it('should include introductory text in the body', () => {
      render(<AIMessageReportInappropriateContent {...defaultProps} />);
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      const href = link.getAttribute('href')!;
      const decodedBody = decodeURIComponent(href.split('body=')[1]);
      expect(decodedBody).toContain(
        'I would like to report inappropriate content from the following conversation',
      );
    });

    it('should include additional comments section in the body', () => {
      render(<AIMessageReportInappropriateContent {...defaultProps} />);
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      const href = link.getAttribute('href')!;
      const decodedBody = decodeURIComponent(href.split('body=')[1]);
      expect(decodedBody).toContain('Additional comments:');
    });
  });

  describe('styling', () => {
    it('should have correct CSS classes on the link', () => {
      render(<AIMessageReportInappropriateContent {...defaultProps} />);
      const link = screen.getByRole('link', {
        name: /report inappropriate content/i,
      });
      expect(link).toHaveClass('text-gray-500', 'hover:text-gray-700', '-ml-1');
    });
  });
});
