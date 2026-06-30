import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { toast } from 'sonner';

import { UrlUploadModal } from '../url-upload-model';
import { ResourceType } from '../../resource-types';

const mockAddTrainingDocument = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useAddTrainingDocumentMutation: () => [
    mockAddTrainingDocument,
    { isLoading: false },
  ],
}));

const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

const mockGetMentorId = vi.fn((): string | null => 'mentor-from-navigate');
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ getMentorId: mockGetMentorId }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const urlResource: ResourceType = {
  id: 'url',
  name: 'URL',
  bgColor: 'bg-blue-100',
  isActive: true,
  type: 'url',
  icon: <span>URL</span>,
};

const youtubeResource: ResourceType = {
  id: 'youtube',
  name: 'YouTube',
  bgColor: 'bg-blue-100',
  isActive: true,
  type: 'url',
  fileType: 'youtube',
  icon: <span>YT</span>,
};

const blackboardResource: ResourceType = {
  id: 'blackboard',
  name: 'Blackboard',
  bgColor: 'bg-blue-100',
  isActive: true,
  type: 'url',
  fileType: 'blackboard',
  icon: <span>BB</span>,
};

function typeUrl(value: string) {
  fireEvent.change(screen.getByPlaceholderText('URL'), {
    target: { value },
  });
}

describe('UrlUploadModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'mentor-123',
    });
    mockGetMentorId.mockReturnValue('mentor-from-navigate');
    mockAddTrainingDocument.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
  });

  it('renders input and submit button', () => {
    render(<UrlUploadModal resource={urlResource} />);
    expect(screen.getByPlaceholderText('URL')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('disables submit button when url is empty', () => {
    render(<UrlUploadModal resource={urlResource} />);
    expect(screen.getByText('Submit').closest('button')).toBeDisabled();
  });

  it('enables submit button when url has a value', () => {
    render(<UrlUploadModal resource={urlResource} />);
    typeUrl('https://example.com');
    expect(screen.getByText('Submit').closest('button')).not.toBeDisabled();
  });

  // -- URL resource --------------------------------------------------------
  it('submits a valid URL and shows success toast', async () => {
    render(<UrlUploadModal resource={urlResource} />);
    typeUrl('https://example.com');
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockAddTrainingDocument).toHaveBeenCalledWith({
        org: 'test-tenant',
        formData: {
          type: 'url',
          pathway: 'mentor-from-navigate',
          url: 'https://example.com',
        },
        userId: 'test-user',
      });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Document has been queued for training',
      );
    });
  });

  it('rejects an invalid URL', () => {
    render(<UrlUploadModal resource={urlResource} />);
    typeUrl('not a url');
    fireEvent.click(screen.getByText('Submit'));

    expect(toast.error).toHaveBeenCalledWith('Invalid URL');
    expect(mockAddTrainingDocument).not.toHaveBeenCalled();
  });

  it('clears the input after a successful submit', async () => {
    render(<UrlUploadModal resource={urlResource} />);
    const input = screen.getByPlaceholderText('URL');
    fireEvent.change(input, { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  // -- YouTube resource ----------------------------------------------------
  it('submits a valid YouTube URL using fileType as the type', async () => {
    render(<UrlUploadModal resource={youtubeResource} />);
    typeUrl('https://youtube.com/watch?v=abcdefghijk');
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockAddTrainingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({ type: 'youtube' }),
        }),
      );
    });
  });

  it('rejects an invalid YouTube URL', () => {
    render(<UrlUploadModal resource={youtubeResource} />);
    typeUrl('https://vimeo.com/123');
    fireEvent.click(screen.getByText('Submit'));

    expect(toast.error).toHaveBeenCalledWith('Invalid YouTube URL');
    expect(mockAddTrainingDocument).not.toHaveBeenCalled();
  });

  // -- Blackboard resource -------------------------------------------------
  it('submits a valid Blackboard URL', async () => {
    render(<UrlUploadModal resource={blackboardResource} />);
    typeUrl('https://bb.example.com/ultra/courses/123');
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockAddTrainingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({ type: 'blackboard' }),
        }),
      );
    });
  });

  it('rejects an invalid Blackboard URL', () => {
    render(<UrlUploadModal resource={blackboardResource} />);
    typeUrl('https://bb.example.com/courses/123');
    fireEvent.click(screen.getByText('Submit'));

    expect(toast.error).toHaveBeenCalledWith('Invalid Blackboard URL');
    expect(mockAddTrainingDocument).not.toHaveBeenCalled();
  });

  // -- Fallbacks & errors --------------------------------------------------
  it('falls back to params mentorId when getMentorId returns null', async () => {
    mockGetMentorId.mockReturnValue(null);
    render(<UrlUploadModal resource={urlResource} />);
    typeUrl('https://example.com');
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockAddTrainingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({ pathway: 'mentor-123' }),
        }),
      );
    });
  });

  it('shows extracted error message when submission fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockAddTrainingDocument.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue({ data: { error: 'Server rejected' } }),
    });

    render(<UrlUploadModal resource={urlResource} />);
    typeUrl('https://example.com');
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server rejected');
    });

    consoleErrorSpy.mockRestore();
  });

  it('shows fallback error message when error has no details', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockAddTrainingDocument.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue({}),
    });

    render(<UrlUploadModal resource={urlResource} />);
    typeUrl('https://example.com');
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Error adding training document',
      );
    });

    consoleErrorSpy.mockRestore();
  });
});
