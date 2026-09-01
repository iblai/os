import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { toast } from 'sonner';

import { GithubFileUploadModal } from '../github-file-upload-modal';

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

// Passthrough so the debounced url updates synchronously and the effect fires.
vi.mock('use-debounce', () => ({
  useDebounce: (value: unknown) => [value],
}));

// Native-ish Select mock so options are clickable in jsdom.
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <div data-testid="select-root" data-value={value} data-disabled={disabled}>
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { onValueChange, disabled }) : null,
      )}
    </div>
  ),
  SelectTrigger: ({ children }: any) => (
    <button data-testid="select-trigger" type="button">
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { onValueChange }) : null,
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div
      role="option"
      data-value={value}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </div>
  ),
}));

function setGithubUrl(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Github Repo URL'), {
    target: { value },
  });
}

describe('GithubFileUploadModal', () => {
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
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{ name: 'main' }, { name: 'dev' }]),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the url input, branch select and submit button', () => {
    render(<GithubFileUploadModal />);
    expect(screen.getByPlaceholderText('Github Repo URL')).toBeInTheDocument();
    expect(screen.getByText('Select Branch')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('does not fetch branches while the url is empty', () => {
    render(<GithubFileUploadModal />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches branches when a github url is entered', async () => {
    render(<GithubFileUploadModal />);
    setGithubUrl('https://github.com/org/repo.git');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/org/repo/branches',
      );
    });
  });

  it('renders fetched branches as options', async () => {
    render(<GithubFileUploadModal />);
    setGithubUrl('https://github.com/org/repo');

    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('dev')).toBeInTheDocument();
    });
  });

  it('keeps the submit button disabled until a branch is selected', async () => {
    render(<GithubFileUploadModal />);
    setGithubUrl('https://github.com/org/repo');

    // url present but no branch selected -> still disabled.
    expect(screen.getByText('Submit').closest('button')).toBeDisabled();

    await waitFor(() => screen.getByText('main'));
    fireEvent.click(screen.getByText('main'));

    await waitFor(() => {
      expect(screen.getByText('Submit').closest('button')).not.toBeDisabled();
    });
  });

  it('submits the github document and shows success toast', async () => {
    render(<GithubFileUploadModal />);
    setGithubUrl('https://github.com/org/repo');

    await waitFor(() => screen.getByText('main'));
    fireEvent.click(screen.getByText('main'));

    await waitFor(() =>
      expect(screen.getByText('Submit').closest('button')).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockAddTrainingDocument).toHaveBeenCalledWith({
        org: 'test-tenant',
        userId: 'test-user',
        formData: {
          url: 'https://github.com/org/repo',
          branch: 'main',
          pathway: 'mentor-from-navigate',
          type: 'github',
        },
      });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Document has been queued for training',
      );
    });
  });

  it('clears the inputs after a successful submit', async () => {
    render(<GithubFileUploadModal />);
    const urlInput = screen.getByPlaceholderText('Github Repo URL');
    fireEvent.change(urlInput, { target: { value: 'https://github.com/o/r' } });

    await waitFor(() => screen.getByText('main'));
    fireEvent.click(screen.getByText('main'));

    await waitFor(() =>
      expect(screen.getByText('Submit').closest('button')).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(urlInput).toHaveValue('');
    });
  });

  it('shows an error message when branch fetch fails (response not ok)', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: vi.fn(),
    });

    render(<GithubFileUploadModal />);
    setGithubUrl('https://github.com/org/repo');

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch branches')).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('shows an unknown error message when fetch rejects with non-Error', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue('boom');

    render(<GithubFileUploadModal />);
    setGithubUrl('https://github.com/org/repo');

    await waitFor(() => {
      expect(screen.getByText('An unknown error occurred')).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('shows agent-not-found error when there is no active mentor', async () => {
    mockGetMentorId.mockReturnValue(null);
    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: '' });

    render(<GithubFileUploadModal />);
    setGithubUrl('https://github.com/org/repo');

    await waitFor(() => screen.getByText('main'));
    fireEvent.click(screen.getByText('main'));

    await waitFor(() =>
      expect(screen.getByText('Submit').closest('button')).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Agent not found');
    });
    expect(mockAddTrainingDocument).not.toHaveBeenCalled();
  });

  it('shows extracted error message when submission fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockAddTrainingDocument.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue({ data: { error: 'Server rejected' } }),
    });

    render(<GithubFileUploadModal />);
    setGithubUrl('https://github.com/org/repo');

    await waitFor(() => screen.getByText('main'));
    fireEvent.click(screen.getByText('main'));

    await waitFor(() =>
      expect(screen.getByText('Submit').closest('button')).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server rejected');
    });

    consoleErrorSpy.mockRestore();
  });
});
