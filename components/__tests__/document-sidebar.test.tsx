import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentSidebar } from '../document-sidebar';

const mockRefetch = vi.fn();
let mockVectorDocuments: any[] | undefined;
let mockStatus = 'fulfilled';
let mockIsLoggedIn = true;
let mockIsStreaming = false;

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant' }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, target, className }: any) => (
    <a href={href} target={target} className={className}>
      {children}
    </a>
  ),
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

vi.mock('@web-utils/features', () => ({
  selectStreaming: vi.fn(),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetVectorDocumentsQuery: () => ({
    data: mockVectorDocuments,
    refetch: mockRefetch,
    status: mockStatus,
  }),
}));

const mockDocuments = [
  {
    type: 'document',
    title: 'First Document Title',
    snippet: 'This is the first document snippet.',
    source: 'https://example.com/doc1',
    score: 0.92,
  },
  {
    type: 'document',
    title: 'Second Document Title',
    snippet: 'This is the second document snippet.',
    source: 'https://example.com/doc2',
    score: 0.85,
  },
];

describe('DocumentSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVectorDocuments = mockDocuments;
    mockStatus = 'fulfilled';
    mockIsLoggedIn = true;
    mockIsStreaming = false;
  });

  describe('rendering with documents', () => {
    it('should render the sidebar when documents are present', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      expect(screen.getByText('Retrieved Documents')).toBeInTheDocument();
    });

    it('should render document titles', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      expect(screen.getByText('First Document Title')).toBeInTheDocument();
      expect(screen.getByText('Second Document Title')).toBeInTheDocument();
    });

    it('should render document snippets', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      expect(screen.getByText('This is the first document snippet.')).toBeInTheDocument();
      expect(screen.getByText('This is the second document snippet.')).toBeInTheDocument();
    });

    it('should render document scores formatted to 2 decimal places', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      expect(screen.getByText('0.92')).toBeInTheDocument();
      expect(screen.getByText('0.85')).toBeInTheDocument();
    });

    it('should render document titles as links with correct href and target', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveAttribute('href', 'https://example.com/doc1');
      expect(links[0]).toHaveAttribute('target', '_blank');
      expect(links[1]).toHaveAttribute('href', 'https://example.com/doc2');
      expect(links[1]).toHaveAttribute('target', '_blank');
    });

    it('should render dividers between documents but not after the last one', () => {
      const { container } = render(<DocumentSidebar sessionId="session-1" />);
      const dividers = container.querySelectorAll('.border-t.border-gray-200');
      expect(dividers).toHaveLength(1);
    });

    it('should render links with min-w-0 class for text overflow handling', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveClass('min-w-0');
    });

    it('should render title spans with break-words class', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      const titleSpan = screen.getByText('First Document Title');
      expect(titleSpan).toHaveClass('break-words');
    });
  });

  describe('rendering with no documents', () => {
    it('should render nothing when vectorDocuments is undefined', () => {
      mockVectorDocuments = undefined;
      const { container } = render(<DocumentSidebar sessionId="session-1" />);
      expect(container.innerHTML).toBe('');
    });

    it('should render nothing when vectorDocuments is empty', () => {
      mockVectorDocuments = [];
      const { container } = render(<DocumentSidebar sessionId="session-1" />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('document with missing optional fields', () => {
    it('should handle document with no source by using empty string as href', () => {
      mockVectorDocuments = [
        {
          type: 'document',
          title: 'No Source Doc',
          snippet: 'A snippet.',
          source: undefined,
          score: 0.5,
        },
      ];
      const { container } = render(<DocumentSidebar sessionId="session-1" />);
      const link = container.querySelector('a')!;
      expect(link).toHaveAttribute('href', '');
    });

    it('should handle document with no score', () => {
      mockVectorDocuments = [
        {
          type: 'document',
          title: 'No Score Doc',
          snippet: 'A snippet.',
          source: 'https://example.com',
          score: undefined,
        },
      ];
      render(<DocumentSidebar sessionId="session-1" />);
      expect(screen.getByText('No Score Doc')).toBeInTheDocument();
    });
  });

  describe('collapse toggle (non-modal)', () => {
    it('should show header with Retrieved Documents text when not collapsed', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      expect(screen.getByText('Retrieved Documents')).toBeInTheDocument();
    });

    it('should show documents list when not collapsed', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      expect(screen.getByText('First Document Title')).toBeInTheDocument();
    });

    it('should hide header text and documents when collapsed', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      const header = screen
        .getByText('Retrieved Documents')
        .closest('div[class*="cursor-pointer"]')!;
      fireEvent.click(header);

      expect(screen.queryByText('Retrieved Documents')).not.toBeInTheDocument();
      expect(screen.queryByText('First Document Title')).not.toBeInTheDocument();
    });

    it('should toggle back to expanded when clicked again', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      const header = screen
        .getByText('Retrieved Documents')
        .closest('div[class*="cursor-pointer"]')!;

      fireEvent.click(header);
      expect(screen.queryByText('First Document Title')).not.toBeInTheDocument();

      // The FileText icon's parent div is still clickable when collapsed
      const collapsedHeader = document.querySelector('div[class*="cursor-pointer"]')!;
      fireEvent.click(collapsedHeader);
      expect(screen.getByText('First Document Title')).toBeInTheDocument();
    });

    it('should apply collapsed width class when collapsed', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      const aside = document.querySelector('aside')!;
      expect(aside).toHaveClass('w-[380px]');

      const header = screen
        .getByText('Retrieved Documents')
        .closest('div[class*="cursor-pointer"]')!;
      fireEvent.click(header);
      expect(aside).toHaveClass('w-[40px]');
    });

    it('should change background color when collapsed', () => {
      render(<DocumentSidebar sessionId="session-1" />);
      const aside = document.querySelector('aside')!;
      expect(aside.style.backgroundColor).toBe('rgb(243, 246, 251)');

      const header = screen
        .getByText('Retrieved Documents')
        .closest('div[class*="cursor-pointer"]')!;
      fireEvent.click(header);
      expect(aside.style.backgroundColor).toBe('white');
    });
  });

  describe('modal mode', () => {
    it('should not render the header toggle in modal mode', () => {
      render(<DocumentSidebar isModal={true} sessionId="session-1" />);
      expect(screen.queryByText('Retrieved Documents')).not.toBeInTheDocument();
    });

    it('should always show documents in modal mode', () => {
      render(<DocumentSidebar isModal={true} sessionId="session-1" />);
      expect(screen.getByText('First Document Title')).toBeInTheDocument();
      expect(screen.getByText('Second Document Title')).toBeInTheDocument();
    });

    it('should apply modal-specific classes', () => {
      render(<DocumentSidebar isModal={true} sessionId="session-1" />);
      const aside = document.querySelector('aside')!;
      expect(aside).toHaveClass('max-h-full');
      expect(aside).toHaveClass('w-full');
      expect(aside).toHaveClass('overflow-auto');
    });

    it('should not apply collapsed width classes in modal mode', () => {
      render(<DocumentSidebar isModal={true} sessionId="session-1" />);
      const aside = document.querySelector('aside')!;
      expect(aside).not.toHaveClass('w-[380px]');
      expect(aside).not.toHaveClass('w-[40px]');
    });

    it('should always use #F3F6FB background in modal mode', () => {
      render(<DocumentSidebar isModal={true} sessionId="session-1" />);
      const aside = document.querySelector('aside')!;
      expect(aside.style.backgroundColor).toBe('rgb(243, 246, 251)');
    });
  });

  describe('refetch on streaming end', () => {
    it('should call refetch when streaming ends and user is logged in', () => {
      mockIsStreaming = true;
      const { rerender } = render(<DocumentSidebar sessionId="session-1" />);

      mockIsStreaming = false;
      rerender(<DocumentSidebar sessionId="session-1" />);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should not call refetch when user is not logged in', () => {
      mockIsLoggedIn = false;
      render(<DocumentSidebar sessionId="session-1" />);
      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it('should not call refetch when status is uninitialized', () => {
      mockStatus = 'uninitialized';
      render(<DocumentSidebar sessionId="session-1" />);
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  describe('single document rendering', () => {
    it('should not render a divider when there is only one document', () => {
      mockVectorDocuments = [mockDocuments[0]];
      const { container } = render(<DocumentSidebar sessionId="session-1" />);
      const dividers = container.querySelectorAll('.border-t.border-gray-200');
      expect(dividers).toHaveLength(0);
    });
  });
});
