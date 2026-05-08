import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RetrievedDocumentsButton } from '../retrieved-documents-button';

const mockRefetch = vi.fn();
let mockVectorDocuments: any[] | undefined;
let mockStatus = 'fulfilled';
let mockIsLoggedIn = true;
let mockIsStreaming = false;

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant' }),
}));

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils');
  return {
    ...actual,
    isLoggedIn: () => mockIsLoggedIn,
  };
});

vi.mock('@/lib/hooks', () => ({
  useAppSelector: () => mockIsStreaming,
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  selectStreaming: vi.fn(),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetVectorDocumentsQuery: () => ({
    data: mockVectorDocuments,
    refetch: mockRefetch,
    status: mockStatus,
  }),
}));

vi.mock('@/components/document-sidebar', () => ({
  DocumentSidebar: ({ isModal, sessionId }: any) => (
    <div
      data-testid="document-sidebar"
      data-is-modal={isModal}
      data-session-id={sessionId}
    />
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: any) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children, className }: any) => (
    <div data-testid="dialog-header" className={className}>
      {children}
    </div>
  ),
  DialogTitle: ({ children }: any) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

const mockDocuments = [
  {
    type: 'document',
    title: 'First Document',
    snippet: 'First snippet.',
    source: 'https://example.com/doc1',
    score: 0.92,
  },
];

describe('RetrievedDocumentsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVectorDocuments = mockDocuments;
    mockStatus = 'fulfilled';
    mockIsLoggedIn = true;
    mockIsStreaming = false;
  });

  describe('rendering', () => {
    it('should render the button when documents are present', () => {
      render(<RetrievedDocumentsButton sessionId="session-1" />);
      expect(
        screen.getByRole('button', { name: /retrieved documents/i }),
      ).toBeInTheDocument();
    });

    it('should render nothing when vectorDocuments is undefined', () => {
      mockVectorDocuments = undefined;
      const { container } = render(
        <RetrievedDocumentsButton sessionId="session-1" />,
      );
      expect(container.innerHTML).toBe('');
    });

    it('should render nothing when vectorDocuments is empty', () => {
      mockVectorDocuments = [];
      const { container } = render(
        <RetrievedDocumentsButton sessionId="session-1" />,
      );
      expect(container.innerHTML).toBe('');
    });

    it('should display "Retrieved Documents" text in the button', () => {
      render(<RetrievedDocumentsButton sessionId="session-1" />);
      expect(screen.getByText('Retrieved Documents')).toBeInTheDocument();
    });
  });

  describe('dialog', () => {
    it('should not show dialog initially', () => {
      render(<RetrievedDocumentsButton sessionId="session-1" />);
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should open dialog when button is clicked', () => {
      render(<RetrievedDocumentsButton sessionId="session-1" />);
      fireEvent.click(
        screen.getByRole('button', { name: /retrieved documents/i }),
      );
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('should render dialog with correct classes', () => {
      render(<RetrievedDocumentsButton sessionId="session-1" />);
      fireEvent.click(
        screen.getByRole('button', { name: /retrieved documents/i }),
      );
      const content = screen.getByTestId('dialog-content');
      expect(content).toHaveClass('flex');
      expect(content).toHaveClass('max-h-[80vh]');
      expect(content).toHaveClass('flex-col');
      expect(content).toHaveClass('gap-0');
      expect(content).toHaveClass('p-0');
    });

    it('should render dialog header with title', () => {
      render(<RetrievedDocumentsButton sessionId="session-1" />);
      fireEvent.click(
        screen.getByRole('button', { name: /retrieved documents/i }),
      );
      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
    });

    it('should render DocumentSidebar in modal mode with correct sessionId', () => {
      render(<RetrievedDocumentsButton sessionId="session-1" />);
      fireEvent.click(
        screen.getByRole('button', { name: /retrieved documents/i }),
      );
      const sidebar = screen.getByTestId('document-sidebar');
      expect(sidebar).toHaveAttribute('data-is-modal', 'true');
      expect(sidebar).toHaveAttribute('data-session-id', 'session-1');
    });
  });

  describe('refetch on streaming end', () => {
    it('should call refetch when streaming ends and user is logged in', () => {
      mockIsStreaming = true;
      const { rerender } = render(
        <RetrievedDocumentsButton sessionId="session-1" />,
      );

      mockIsStreaming = false;
      rerender(<RetrievedDocumentsButton sessionId="session-1" />);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should not call refetch when user is not logged in', () => {
      mockIsLoggedIn = false;
      render(<RetrievedDocumentsButton sessionId="session-1" />);
      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it('should not call refetch when status is uninitialized', () => {
      mockStatus = 'uninitialized';
      render(<RetrievedDocumentsButton sessionId="session-1" />);
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });
});
