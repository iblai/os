import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { useFileDragDrop } from '../use-file-drag-drop';

const mockUploadFiles = vi.fn();

let mockFileUploadCapabilities = {
  supportsFileUpload: true,
  allSupportedTypes: ['.pdf', '.docx', 'image/png'],
  maxFileSizeMB: 10,
  maxFilesPerMessage: 5,
  supportsImages: true,
  supportsDocuments: true,
  supportedImageTypes: ['image/png'],
  supportedDocumentTypes: ['.pdf', '.docx'],
  supportsFileUrls: false,
};

vi.mock('@/hooks/use-model-file-upload-capabilities', () => ({
  useModelFileUploadCapabilities: vi.fn(() => mockFileUploadCapabilities),
}));

vi.mock('@/hooks/use-chat-file-upload', () => ({
  useChatFileUpload: vi.fn(() => ({
    uploadFiles: mockUploadFiles,
    retryUpload: vi.fn(),
  })),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const createDragEvent = (overrides: Record<string, unknown> = {}): React.DragEvent => {
  const preventDefault = vi.fn();
  return {
    preventDefault,
    dataTransfer: { types: ['Files'], files: [] },
    relatedTarget: null,
    currentTarget: { contains: vi.fn(() => false) },
    ...overrides,
  } as unknown as React.DragEvent;
};

describe('useFileDragDrop', () => {
  const defaultOptions = { org: 'test-org', userId: 'test-user' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileUploadCapabilities = {
      supportsFileUpload: true,
      allSupportedTypes: ['.pdf', '.docx', 'image/png'],
      maxFileSizeMB: 10,
      maxFilesPerMessage: 5,
      supportsImages: true,
      supportsDocuments: true,
      supportedImageTypes: ['image/png'],
      supportedDocumentTypes: ['.pdf', '.docx'],
      supportsFileUrls: false,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return isDraggingFile as false initially', () => {
    const { result } = renderHook(() => useFileDragDrop(defaultOptions));
    expect(result.current.isDraggingFile).toBe(false);
  });

  describe('window-level preventDefault', () => {
    it('should add dragover and drop listeners on mount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      renderHook(() => useFileDragDrop(defaultOptions));

      expect(addSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('drop', expect.any(Function));
    });

    it('should remove listeners on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useFileDragDrop(defaultOptions));
      unmount();

      expect(removeSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('drop', expect.any(Function));
    });

    it('should call preventDefault on window dragover events', () => {
      renderHook(() => useFileDragDrop(defaultOptions));

      const event = new Event('dragover', { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('should call preventDefault on window drop events', () => {
      renderHook(() => useFileDragDrop(defaultOptions));

      const event = new Event('drop', { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('handleDragOver', () => {
    it('should set isDraggingFile to true when dragging files', () => {
      const { result } = renderHook(() => useFileDragDrop(defaultOptions));
      const event = createDragEvent({ dataTransfer: { types: ['Files'], files: [] } });

      act(() => {
        result.current.handleDragOver(event);
      });

      expect(result.current.isDraggingFile).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not set isDraggingFile when dragging non-file content', () => {
      const { result } = renderHook(() => useFileDragDrop(defaultOptions));
      const event = createDragEvent({ dataTransfer: { types: ['text/plain'], files: [] } });

      act(() => {
        result.current.handleDragOver(event);
      });

      expect(result.current.isDraggingFile).toBe(false);
    });
  });

  describe('handleDragLeave', () => {
    it('should set isDraggingFile to false when leaving the container', () => {
      const { result } = renderHook(() => useFileDragDrop(defaultOptions));

      // First set dragging to true
      act(() => {
        result.current.handleDragOver(createDragEvent());
      });
      expect(result.current.isDraggingFile).toBe(true);

      // Then leave the container (relatedTarget is null = left the container)
      act(() => {
        result.current.handleDragLeave(createDragEvent({ relatedTarget: null }));
      });

      expect(result.current.isDraggingFile).toBe(false);
    });

    it('should not set isDraggingFile to false when moving to a child element', () => {
      const { result } = renderHook(() => useFileDragDrop(defaultOptions));

      act(() => {
        result.current.handleDragOver(createDragEvent());
      });
      expect(result.current.isDraggingFile).toBe(true);

      const childNode = document.createElement('div');
      const event = createDragEvent({
        relatedTarget: childNode,
        currentTarget: { contains: vi.fn(() => true) },
      });

      act(() => {
        result.current.handleDragLeave(event);
      });

      expect(result.current.isDraggingFile).toBe(true);
    });
  });

  describe('handleDrop', () => {
    it('should upload supported files and reset isDraggingFile', async () => {
      const { result } = renderHook(() => useFileDragDrop(defaultOptions));
      const file = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
      const event = createDragEvent({ dataTransfer: { files: [file] } });

      // Set dragging first
      act(() => {
        result.current.handleDragOver(createDragEvent());
      });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockUploadFiles).toHaveBeenCalledWith([file]);
      expect(result.current.isDraggingFile).toBe(false);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should reject all unsupported files with a toast error', async () => {
      const { result } = renderHook(() => useFileDragDrop(defaultOptions));
      const file = new File(['test'], 'app.exe', { type: 'application/x-msdownload' });
      const event = createDragEvent({ dataTransfer: { files: [file] } });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(toast.error).toHaveBeenCalledWith('The dropped file type is not supported.');
      expect(mockUploadFiles).not.toHaveBeenCalled();
    });

    it('should partially reject unsupported files in a mixed drop', async () => {
      const { result } = renderHook(() => useFileDragDrop(defaultOptions));
      const pdfFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
      const exeFile = new File(['test'], 'app.exe', { type: 'application/x-msdownload' });
      const event = createDragEvent({ dataTransfer: { files: [pdfFile, exeFile] } });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockUploadFiles).toHaveBeenCalledWith([pdfFile]);
      expect(toast.error).toHaveBeenCalledWith('1 file was rejected due to unsupported type.');
    });

    it('should pluralize rejection message for multiple rejected files', async () => {
      const { result } = renderHook(() => useFileDragDrop(defaultOptions));
      const pdfFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
      const exeFile = new File(['test'], 'a.exe', { type: 'application/x-msdownload' });
      const batFile = new File(['test'], 'b.bat', { type: 'application/x-msdos-program' });
      const event = createDragEvent({ dataTransfer: { files: [pdfFile, exeFile, batFile] } });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockUploadFiles).toHaveBeenCalledWith([pdfFile]);
      expect(toast.error).toHaveBeenCalledWith('2 files were rejected due to unsupported type.');
    });

    it('should not upload when drop has no files', async () => {
      const { result } = renderHook(() => useFileDragDrop(defaultOptions));
      const event = createDragEvent({ dataTransfer: { files: [] } });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockUploadFiles).not.toHaveBeenCalled();
    });

    it('should accept files matching wildcard MIME types', async () => {
      const { result } = renderHook(() => useFileDragDrop(defaultOptions));
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      const event = createDragEvent({ dataTransfer: { files: [file] } });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockUploadFiles).toHaveBeenCalledWith([file]);
    });

    it('should fall back to MENTOR_CHAT_DOCUMENTS_EXTENSIONS when capabilities are empty', async () => {
      mockFileUploadCapabilities = {
        ...mockFileUploadCapabilities,
        allSupportedTypes: [],
      };

      const { result } = renderHook(() => useFileDragDrop(defaultOptions));
      // video/* is in MENTOR_CHAT_DOCUMENTS_EXTENSIONS
      const file = new File(['test'], 'clip.mp4', { type: 'video/mp4' });
      const event = createDragEvent({ dataTransfer: { files: [file] } });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockUploadFiles).toHaveBeenCalledWith([file]);
    });
  });
});
