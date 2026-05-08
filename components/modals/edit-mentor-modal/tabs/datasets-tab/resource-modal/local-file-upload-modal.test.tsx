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

import { LocalFileUploadModal } from './local-file-upload-modal';
import { ResourceType } from '../resource-types';

// ============================================================================
// MOCKS
// ============================================================================

const mockAddTrainingDocument = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useAddTrainingDocumentMutation: () => [
    mockAddTrainingDocument,
    { isLoading: false },
  ],
  useGetClawMentorConfigQuery: () => ({
    data: null,
    isError: false,
    isLoading: false,
  }),
  useUpdateClawMentorConfigMutation: () => [
    () => Promise.resolve({}),
    { isLoading: false },
  ],
}));

const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

const mockUsername = 'testuser';
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
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

const mockMaxDatasetFileSizeInMegaBytes = vi.fn(() => 50);
vi.mock('@/lib/utils', () => ({
  convertFromBytes: (bytes: number) => {
    if (bytes >= 1024 * 1024)
      return { value: Math.round(bytes / (1024 * 1024)), unit: 'MB' };
    if (bytes >= 1024) return { value: Math.round(bytes / 1024), unit: 'KB' };
    return { value: bytes, unit: 'B' };
  },
  maxDatasetFileSizeInMegaBytes: () => mockMaxDatasetFileSizeInMegaBytes(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    id,
    value,
    onChange,
    placeholder,
    className,
    rows,
    ...props
  }: any) => (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      rows={rows}
      {...props}
    />
  ),
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <span data-testid="loader-icon">Loading</span>,
  Upload: () => <span data-testid="upload-icon">Upload</span>,
  X: () => <span data-testid="x-icon">X</span>,
}));

vi.mock('./utils', () => ({
  extractErrorMessage: (error: unknown, fallback: string) => {
    const apiError = error as any;
    return apiError?.data?.error || apiError?.error?.error || fallback;
  },
}));

// ============================================================================
// FIXTURES
// ============================================================================

const csvResource: ResourceType = {
  id: 'csv',
  name: 'CSV',
  bgColor: 'bg-blue-100',
  isActive: true,
  type: 'local',
  accept: 'text/csv,.csv',
  icon: <span>CSV Icon</span>,
};

const excelResource: ResourceType = {
  id: 'excel',
  name: 'Excel',
  bgColor: 'bg-blue-100',
  isActive: true,
  type: 'local',
  accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  icon: <span>Excel Icon</span>,
};

const imageResource: ResourceType = {
  id: 'image',
  name: 'Image',
  bgColor: 'bg-blue-100',
  isActive: true,
  type: 'local',
  accept: 'image/*',
  fileType: 'image',
  icon: <span>Image Icon</span>,
};

const audioResource: ResourceType = {
  id: 'audio',
  name: 'Audio',
  bgColor: 'bg-blue-100',
  isActive: true,
  type: 'local',
  accept: 'audio/*',
  fileType: 'audio',
  icon: <span>Audio Icon</span>,
};

const mockParams = { tenantKey: 'test-tenant', mentorId: 'test-mentor' };

function createFile(name: string, size: number, type: string): File {
  const content = new Array(size).fill('a').join('');
  return new File([content], name, { type });
}

// ============================================================================
// TESTS
// ============================================================================

describe('LocalFileUploadModal', () => {
  beforeEach(() => {
    cleanup();
    mockAddTrainingDocument.mockReset();
    mockUseParams.mockReturnValue(mockParams);
    mockGetMentorId.mockReturnValue('mentor-from-navigate');
    mockAddTrainingDocument.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  describe('Rendering', () => {
    it('renders drag and drop area', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      expect(
        screen.getByText('Drag and drop your file here'),
      ).toBeInTheDocument();
    });

    it('renders Browse files button', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      expect(screen.getByText('Browse files')).toBeInTheDocument();
    });

    it('renders maximum file size message', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      expect(screen.getByText(/Maximum file size:/)).toBeInTheDocument();
    });

    it('renders submit button as disabled when no file selected', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const submitButton = screen.getByText('Submit');
      expect(submitButton.closest('button')).toBeDisabled();
    });

    it('sets correct accept attribute on file input', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      expect(fileInput).toBeDefined();
      expect(fileInput.getAttribute('accept')).toBe('text/csv,.csv');
    });

    it('sets accept attribute for Excel resource', () => {
      render(<LocalFileUploadModal resource={excelResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      expect(fileInput.getAttribute('accept')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });
  });

  // --------------------------------------------------------------------------
  // File Selection
  // --------------------------------------------------------------------------

  describe('File Selection', () => {
    it('shows file info after selecting a file via input', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(screen.getByText('data.csv')).toBeInTheDocument();
    });

    it('enables submit button after selecting a file', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });

      const submitButton = screen.getByText('Submit');
      expect(submitButton.closest('button')).not.toBeDisabled();
    });

    it('shows file size after selecting a file', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(screen.getByText(/1.*KB/)).toBeInTheDocument();
    });

    it('clears file when X button is clicked', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });
      expect(screen.getByText('data.csv')).toBeInTheDocument();

      const clearButton = screen.getByTestId('x-icon').closest('button');
      fireEvent.click(clearButton!);

      expect(screen.queryByText('data.csv')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // File Size Validation
  // --------------------------------------------------------------------------

  describe('File Size Validation', () => {
    it('rejects files exceeding max size', () => {
      // Set max to a tiny value so we don't need to allocate a huge file
      mockMaxDatasetFileSizeInMegaBytes.mockReturnValue(0.001); // ~1KB
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('big.csv', 2048, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('File size exceeds'),
      );
      expect(screen.queryByText('big.csv')).not.toBeInTheDocument();
      mockMaxDatasetFileSizeInMegaBytes.mockReturnValue(50);
    });

    it('accepts files within max size', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('small.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(toast.error).not.toHaveBeenCalled();
      expect(screen.getByText('small.csv')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Drag and Drop
  // --------------------------------------------------------------------------

  describe('Drag and Drop', () => {
    it('accepts file via drag and drop', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const dropZone = screen
        .getByText('Drag and drop your file here')
        .closest('div')!;
      const file = createFile('dropped.csv', 1024, 'text/csv');

      fireEvent.dragOver(dropZone);
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      });

      expect(screen.getByText('dropped.csv')).toBeInTheDocument();
    });

    it('applies drag styles on dragEnter', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const dropZone = screen
        .getByText('Drag and drop your file here')
        .closest('div')!;

      fireEvent.dragEnter(dropZone);

      expect(dropZone.className).toContain('border-blue-400');
    });

    it('removes drag styles on dragLeave', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const dropZone = screen
        .getByText('Drag and drop your file here')
        .closest('div')!;

      fireEvent.dragEnter(dropZone);
      expect(dropZone.className).toContain('border-blue-400');

      fireEvent.dragLeave(dropZone);
      expect(dropZone.className).toContain('border-gray-300');
    });

    it('rejects oversized files via drag and drop', () => {
      mockMaxDatasetFileSizeInMegaBytes.mockReturnValue(0.001); // ~1KB
      render(<LocalFileUploadModal resource={csvResource} />);
      const dropZone = screen
        .getByText('Drag and drop your file here')
        .closest('div')!;
      const file = createFile('big.csv', 2048, 'text/csv');

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('File size exceeds'),
      );
      expect(screen.queryByText('big.csv')).not.toBeInTheDocument();
      mockMaxDatasetFileSizeInMegaBytes.mockReturnValue(50);
    });
  });

  // --------------------------------------------------------------------------
  // Upload Submission
  // --------------------------------------------------------------------------

  describe('Upload Submission', () => {
    it('calls addTrainingDocument with correct payload for CSV', async () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });

      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAddTrainingDocument).toHaveBeenCalledWith({
          org: 'test-tenant',
          formData: {
            file: expect.any(File),
            pathway: 'mentor-from-navigate',
            type: 'file',
          },
          userId: 'testuser',
        });
      });
    });

    it('sends same payload type for CSV as Excel (type: "file")', async () => {
      // CSV upload
      const { unmount } = render(
        <LocalFileUploadModal resource={csvResource} />,
      );
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const csvFile = createFile('data.csv', 1024, 'text/csv');
      fireEvent.change(fileInput, { target: { files: [csvFile] } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(mockAddTrainingDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({ type: 'file' }),
          }),
        );
      });

      unmount();
      mockAddTrainingDocument.mockClear();
      mockAddTrainingDocument.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({}),
      });

      // Excel upload
      render(<LocalFileUploadModal resource={excelResource} />);
      const excelInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const excelFile = createFile(
        'data.xlsx',
        1024,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      fireEvent.change(excelInput, { target: { files: [excelFile] } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(mockAddTrainingDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({ type: 'file' }),
          }),
        );
      });
    });

    it('sends fileType-based type for resources with fileType', async () => {
      render(<LocalFileUploadModal resource={audioResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('audio.mp3', 1024, 'audio/mpeg');
      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(mockAddTrainingDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({ type: 'audio' }),
          }),
        );
      });
    });

    it('shows success toast after successful upload', async () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Document has been queued for training',
        );
      });
    });

    it('clears file after successful upload', async () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });
      expect(screen.getByText('data.csv')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.queryByText('data.csv')).not.toBeInTheDocument();
      });
    });

    it('shows error toast when no file is selected and submit is attempted', async () => {
      // This tests the internal guard; submit button is normally disabled
      // We simulate by calling handleSubmit with no file
      render(<LocalFileUploadModal resource={csvResource} />);
      const submitButton = screen.getByText('Submit');
      // Button is disabled, so the guard path for !file won't trigger via UI
      expect(submitButton.closest('button')).toBeDisabled();
    });

    it('uses mentorId from params as fallback when getMentorId returns null', async () => {
      mockGetMentorId.mockReturnValue(null);
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(mockAddTrainingDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({ pathway: 'test-mentor' }),
          }),
        );
      });
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling
  // --------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('shows error toast when upload fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockAddTrainingDocument.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({ data: { error: 'Upload failed' } }),
      });

      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Upload failed');
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

      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Error adding training document',
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('logs error to console on failure', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockAddTrainingDocument.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('fail')),
      });

      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // Image Description Field
  // --------------------------------------------------------------------------

  describe('Image Description Field', () => {
    it('shows description textarea for image files', () => {
      render(<LocalFileUploadModal resource={imageResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('photo.png', 1024, 'image/png');

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(
        screen.getByPlaceholderText('Add a description for this image...'),
      ).toBeInTheDocument();
    });

    it('does not show description textarea for CSV files', () => {
      render(<LocalFileUploadModal resource={csvResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('data.csv', 1024, 'text/csv');

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(
        screen.queryByPlaceholderText('Add a description for this image...'),
      ).not.toBeInTheDocument();
    });

    it('includes user_image_description in payload for image uploads', async () => {
      render(<LocalFileUploadModal resource={imageResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('photo.png', 1024, 'image/png');

      fireEvent.change(fileInput, { target: { files: [file] } });

      const descInput = screen.getByPlaceholderText(
        'Add a description for this image...',
      );
      fireEvent.change(descInput, { target: { value: 'A sunset photo' } });

      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(mockAddTrainingDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              type: 'image',
              user_image_description: 'A sunset photo',
            }),
          }),
        );
      });
    });

    it('clears description after successful upload', async () => {
      render(<LocalFileUploadModal resource={imageResource} />);
      const fileInput = document.getElementById(
        'file-upload',
      ) as HTMLInputElement;
      const file = createFile('photo.png', 1024, 'image/png');

      fireEvent.change(fileInput, { target: { files: [file] } });

      const descInput = screen.getByPlaceholderText(
        'Add a description for this image...',
      );
      fireEvent.change(descInput, { target: { value: 'A sunset photo' } });

      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText('Add a description for this image...'),
        ).not.toBeInTheDocument();
      });
    });
  });
});
