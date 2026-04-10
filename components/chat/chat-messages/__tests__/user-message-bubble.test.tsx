import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserMessageBubble } from '../user-message-bubble';

/**
 * Test suite for the UserMessageBubble component
 *
 * This suite tests the UserMessageBubble component's ability to:
 * 1. Render basic message content
 * 2. Preserve newlines in message content
 * 3. Handle file attachments
 * 4. Handle reply messages
 */

const defaultProps = {
  message: {
    id: '1',
    role: 'user' as const,
    content: 'Hello, World!',
    timestamp: new Date().toISOString(),
    visible: true,
  },
  isHighlighted: false,
  profileImage: '/test-profile.jpg',
  mentorName: 'Test Mentor',
  messages: [],
  onHighlightMessage: vi.fn(),
  onPreviewImage: vi.fn(),
};

describe('UserMessageBubble Component', () => {
  describe('Basic Rendering', () => {
    it('should render message content', () => {
      render(<UserMessageBubble {...defaultProps} />);
      expect(screen.getByText('Hello, World!')).toBeInTheDocument();
    });

    it('should apply highlight style when isHighlighted is true', () => {
      const { container } = render(
        <UserMessageBubble {...defaultProps} isHighlighted={true} />,
      );
      const messageContainer = container.querySelector('.message-container');
      expect(messageContainer).toHaveClass('bg-blue-100');
    });

    it('should not apply highlight style when isHighlighted is false', () => {
      const { container } = render(
        <UserMessageBubble {...defaultProps} isHighlighted={false} />,
      );
      const messageContainer = container.querySelector('.message-container');
      expect(messageContainer).not.toHaveClass('bg-blue-100');
    });
  });

  describe('Newline Preservation', () => {
    it('should preserve single newlines in message content', () => {
      const messageWithNewline = {
        ...defaultProps,
        message: {
          id: '1',
          role: 'user' as const,
          content: 'Line 1\nLine 2',
          timestamp: new Date().toISOString(),
          visible: true,
        },
      };

      const { container } = render(
        <UserMessageBubble {...messageWithNewline} />,
      );
      const messageBubble = container.querySelector('.whitespace-pre-wrap');

      expect(messageBubble).toBeInTheDocument();
      expect(messageBubble?.textContent).toBe('Line 1\nLine 2');
    });

    it('should preserve multiple newlines in message content', () => {
      const messageWithMultipleNewlines = {
        ...defaultProps,
        message: {
          id: '1',
          role: 'user' as const,
          content: 'Line 1\n\nLine 3\n\n\nLine 6',
          timestamp: new Date().toISOString(),
          visible: true,
        },
      };

      const { container } = render(
        <UserMessageBubble {...messageWithMultipleNewlines} />,
      );
      const messageBubble = container.querySelector('.whitespace-pre-wrap');

      expect(messageBubble).toBeInTheDocument();
      expect(messageBubble?.textContent).toBe('Line 1\n\nLine 3\n\n\nLine 6');
    });

    it('should preserve leading and trailing newlines', () => {
      const messageWithEdgeNewlines = {
        ...defaultProps,
        message: {
          id: '1',
          role: 'user' as const,
          content: '\nContent with leading newline\n',
          timestamp: new Date().toISOString(),
          visible: true,
        },
      };

      const { container } = render(
        <UserMessageBubble {...messageWithEdgeNewlines} />,
      );
      const messageBubble = container.querySelector('.whitespace-pre-wrap');

      expect(messageBubble).toBeInTheDocument();
      expect(messageBubble?.textContent).toBe(
        '\nContent with leading newline\n',
      );
    });

    it('should have whitespace-pre-wrap class on message bubble', () => {
      const { container } = render(<UserMessageBubble {...defaultProps} />);
      const messageBubble = container.querySelector(
        '.bg-blue-50.text-gray-800',
      );

      expect(messageBubble).toHaveClass('whitespace-pre-wrap');
    });

    it('should preserve newlines in reply messages', () => {
      const messageWithReply = {
        ...defaultProps,
        message: {
          id: '2',
          role: 'user' as const,
          content: 'Reply Line 1\nReply Line 2',
          timestamp: new Date().toISOString(),
          visible: true,
          replyTo: {
            id: '1',
            role: 'assistant' as const,
            content: 'Original message',
            timestamp: new Date().toISOString(),
            visible: true,
          },
        },
      };

      const { container } = render(<UserMessageBubble {...messageWithReply} />);
      // The reply message bubble should also have whitespace-pre-wrap
      const replyBubbles = container.querySelectorAll('.whitespace-pre-wrap');

      expect(replyBubbles.length).toBeGreaterThan(0);
    });
  });

  describe('File Attachments', () => {
    it('should render image attachments', () => {
      const messageWithImage = {
        ...defaultProps,
        message: {
          id: '1',
          role: 'user' as const,
          content: '',
          timestamp: new Date().toISOString(),
          visible: true,
          fileAttachments: [
            {
              fileName: 'test-image.png',
              fileType: 'image/png',
              fileSize: 1024,
              uploadUrl: 'https://example.com/test-image.png',
            },
          ],
        },
      };

      const { container } = render(<UserMessageBubble {...messageWithImage} />);
      // Should render image attachment
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('should render file attachments', () => {
      const messageWithFile = {
        ...defaultProps,
        message: {
          id: '1',
          role: 'user' as const,
          content: '',
          timestamp: new Date().toISOString(),
          visible: true,
          fileAttachments: [
            {
              fileName: 'document.pdf',
              fileType: 'application/pdf',
              fileSize: 2048,
              uploadUrl: 'https://example.com/document.pdf',
            },
          ],
        },
      };

      render(<UserMessageBubble {...messageWithFile} />);
      // Should render file card with filename
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    it('should render multiple file attachments', () => {
      const messageWithMultipleFiles = {
        ...defaultProps,
        message: {
          id: '1',
          role: 'user' as const,
          content: 'Here are the files',
          timestamp: new Date().toISOString(),
          visible: true,
          fileAttachments: [
            {
              fileName: 'file1.pdf',
              fileType: 'application/pdf',
              fileSize: 1500,
              uploadUrl: 'https://example.com/file1.pdf',
            },
            {
              fileName: 'file2.pdf',
              fileType: 'application/pdf',
              fileSize: 2500,
              uploadUrl: 'https://example.com/file2.pdf',
            },
          ],
        },
      };

      render(<UserMessageBubble {...messageWithMultipleFiles} />);
      expect(screen.getByText('file1.pdf')).toBeInTheDocument();
      expect(screen.getByText('file2.pdf')).toBeInTheDocument();
    });
  });

  describe('Reply Messages', () => {
    it('should render reply context when message has replyTo', () => {
      const messageWithReply = {
        ...defaultProps,
        message: {
          id: '2',
          role: 'user' as const,
          content: 'This is my reply',
          timestamp: new Date().toISOString(),
          visible: true,
          replyTo: {
            id: '1',
            role: 'assistant' as const,
            content: 'Original assistant message',
            timestamp: new Date().toISOString(),
            visible: true,
          },
        },
      };

      render(<UserMessageBubble {...messageWithReply} />);
      expect(
        screen.getByText('Original assistant message'),
      ).toBeInTheDocument();
      expect(screen.getByText('This is my reply')).toBeInTheDocument();
    });

    it('should display mentor name in reply context', () => {
      const messageWithReply = {
        ...defaultProps,
        message: {
          id: '2',
          role: 'user' as const,
          content: 'Reply content',
          timestamp: new Date().toISOString(),
          visible: true,
          replyTo: {
            id: '1',
            role: 'assistant' as const,
            content: 'Original message',
            timestamp: new Date().toISOString(),
            visible: true,
          },
        },
      };

      render(<UserMessageBubble {...messageWithReply} />);
      expect(screen.getByText('Test Mentor')).toBeInTheDocument();
    });
  });

  describe('Empty Content Handling', () => {
    it('should not render message bubble when content is empty and no reply', () => {
      const emptyMessage = {
        ...defaultProps,
        message: {
          id: '1',
          role: 'user' as const,
          content: '',
          timestamp: new Date().toISOString(),
          visible: true,
        },
      };

      const { container } = render(<UserMessageBubble {...emptyMessage} />);
      // Should not have the message content bubble (but container should exist)
      const messageBubble = container.querySelector(
        '.bg-blue-50.rounded-lg.px-4.py-2',
      );
      expect(messageBubble).not.toBeInTheDocument();
    });
  });

  describe('Legacy File Structure', () => {
    it('should render legacy image structure', () => {
      const legacyImageMessage = {
        ...defaultProps,
        message: {
          id: '1',
          role: 'user' as const,
          content: 'image.png',
          timestamp: new Date().toISOString(),
          visible: true,
          url: 'https://example.com/image.png',
          fileType: 'image/png',
        },
      };

      const { container } = render(
        <UserMessageBubble {...legacyImageMessage} />,
      );
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('should render legacy file structure', () => {
      const legacyFileMessage = {
        ...defaultProps,
        message: {
          id: '1',
          role: 'user' as const,
          content: 'document.pdf',
          timestamp: new Date().toISOString(),
          visible: true,
          url: 'https://example.com/document.pdf',
          fileType: 'application/pdf',
        },
      };

      render(<UserMessageBubble {...legacyFileMessage} />);
      // Legacy structure renders the filename in both FileCard and as content
      const elements = screen.getAllByText('document.pdf');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
