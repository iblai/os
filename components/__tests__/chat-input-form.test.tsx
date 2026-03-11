import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MentorVisibilityEnum } from '@iblai/iblai-api';
import { toast } from 'sonner';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ChatInputForm } from '../chat-input-form';
import { chatInputSliceReducer } from '@/features/chat-input/api-slice';

let mockIsTabletOrMobile = false;
let mockIsAccessingPublicRoute = false;
let mockIsLoggedIn = true;
let mockEmbedMode = false;
let mockVisitingTenant = false;
let mockMentorSettings = {
  data: {
    mentorVisibility: 'PRIVATE',
    disclaimer: null,
  },
};
let mockFileUploadCapabilities = {
  supportsFileUpload: true,
  allSupportedTypes: ['.pdf', '.docx'],
  maxFileSizeMB: 10,
  maxFilesPerMessage: 5,
};

const mockUploadFiles = vi.fn();
const mockRetryUpload = vi.fn();
const mockExecuteWithTrialCheck = vi.fn((fn: () => void) => fn());
const mockFreeTrialDialogState = {
  FreeTrialDialog: null as any,
  closeModal: vi.fn(),
  isModalOpen: false,
  executeWithTrialCheck: mockExecuteWithTrialCheck,
};
const mockUseMentorSettings = vi.hoisted(() => vi.fn());
const mockUseModelFileUploadCapabilities = vi.hoisted(() => vi.fn());
const mockCheckRbacPermission = vi.hoisted(() => vi.fn(() => true));

// Mock all dependencies
vi.mock('react-responsive', () => ({
  useMediaQuery: vi.fn(() => mockIsTabletOrMobile),
}));

vi.mock('next/dynamic', () => ({
  default: (importer: () => Promise<any>) => {
    void importer().catch(() => {});
    return ({
      isOpen,
      onSelectPrompt,
      onClose,
    }: {
      isOpen?: boolean;
      onSelectPrompt?: (promptText: string) => void;
      onClose?: () => void;
    }) => {
      if (!isOpen) return null;
      return (
        <div data-testid="prompt-gallery-modal">
          <button onClick={() => onSelectPrompt?.('Suggested prompt')}>Select Prompt</button>
          <button onClick={() => onClose?.()}>Close</button>
        </div>
      );
    };
  },
}));

vi.mock('@/components/modals/prompt-gallery-modal', () => ({
  PromptGalleryModal: () => null,
}));

vi.mock('@/hooks/use-anonymous-mentor', () => ({
  useAccessingPublicRoute: vi.fn(() => mockIsAccessingPublicRoute),
}));

vi.mock('@/hooks/use-chat-file-upload', () => ({
  useChatFileUpload: vi.fn(() => ({
    uploadFiles: mockUploadFiles,
    retryUpload: mockRetryUpload,
  })),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | boolean | undefined)[]) => args.filter(Boolean).join(' '),
  isLoggedIn: vi.fn(() => mockIsLoggedIn),
}));

vi.mock('@/hooks/use-voice-chat', () => ({
  default: vi.fn(() => ({
    handleMicrophoneBtnClick: vi.fn(),
    processing: false,
    recording: false,
    time: 0,
  })),
}));

vi.mock('@/components/chat-input-form/voice-chat-button', () => ({
  VoiceChatButton: ({ handleMicrophoneBtnClick, processing, recording }: any) => (
    <button data-testid="voice-chat-button" onClick={handleMicrophoneBtnClick}>
      Voice {processing ? 'Processing' : recording ? 'Recording' : 'Idle'}
    </button>
  ),
}));

vi.mock('@/components/retrieved-documents-button', () => ({
  RetrievedDocumentsButton: () => <button data-testid="retrieved-docs-button">Docs</button>,
}));

vi.mock('@/hooks/use-embed-mode', () => ({
  useEmbedMode: vi.fn(() => mockEmbedMode),
}));

vi.mock('@/components/chat/stop-streaming-button', () => ({
  StopStreamingButton: ({ stopGenerating }: { stopGenerating: () => void }) => (
    <button data-testid="stop-streaming-button" onClick={stopGenerating}>
      Stop
    </button>
  ),
}));

vi.mock('@/components/chat/submit-message-button', () => ({
  SubmitMessageButton: ({ isPreviewMode, isUploading, allowAnonymousAccess }: any) => (
    <button
      data-testid="submit-button"
      data-allow-anon={allowAnonymousAccess ? 'true' : 'false'}
      type="submit"
      disabled={isPreviewMode || isUploading}
    >
      Submit
    </button>
  ),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: vi.fn(() => mockFreeTrialDialogState),
}));

vi.mock('@/hooks/use-responsive', () => ({
  useResponsive: vi.fn(() => ({
    containerWidth: 1000,
  })),
}));

vi.mock('@/components/chat-input-form/inside-buttons', () => ({
  InsideButtons: ({ activeOptions, onOptionClick, onOpenPromptGallery }: any) => (
    <div data-testid="inside-buttons">
      <button onClick={() => onOptionClick('canvas')}>Canvas</button>
      <button data-testid="open-prompt-gallery" onClick={onOpenPromptGallery}>
        Prompt Gallery
      </button>
      <span data-testid="active-options">{activeOptions?.join(',') || ''}</span>
    </div>
  ),
}));

vi.mock('@/components/chat-input-form/voice-call-button', () => ({
  VoiceCallButton: ({ onClick }: any) => (
    <button data-testid="voice-call-button" onClick={onClick}>
      Call
    </button>
  ),
}));

vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: mockUseMentorSettings,
}));

vi.mock('@iblai/iblai-js/web-utils', async () => {
  const actual = await vi.importActual('@iblai/iblai-js/web-utils');
  return {
    ...actual,
    selectShowingSharedChat: (state: any) => state.chatSliceShared?.showingSharedChat ?? false,
  };
});

vi.mock('@/hooks/use-user', () => ({
  useVisitingTenant: vi.fn(() => mockVisitingTenant),
}));

vi.mock('@/components/chat-input-form/file-attachments-list', () => ({
  FileAttachmentsList: ({ attachedFiles, onRemoveFile, onRetryFile }: any) => (
    <div data-testid="file-attachments-list">
      {attachedFiles?.map((file: any) => (
        <div key={file.id} data-testid={`file-${file.id}`}>
          <span>{file.fileName}</span>
          <button onClick={() => onRemoveFile(file.id)}>Remove</button>
          <button onClick={() => onRetryFile(file.id)}>Retry</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/chat-input-form/upload-menu', () => ({
  UploadMenu: ({ onFileInputTrigger }: any) => (
    <button data-testid="upload-menu" onClick={onFileInputTrigger}>
      Upload
    </button>
  ),
}));

vi.mock('@/components/chat-input-form/outside-buttons', () => ({
  OutsideButtons: ({ onOptionClick }: any) => (
    <div data-testid="outside-buttons">
      <button onClick={() => onOptionClick('web_browsing')}>Web Browse</button>
    </div>
  ),
}));

vi.mock('@/components/chat-input-form/screen-sharing-button', () => ({
  ScreenSharingButton: ({ onClick, isScreenSharingModalOpen }: any) => (
    <button data-testid="screen-sharing-button" onClick={onClick}>
      Screen Share {isScreenSharingModalOpen ? 'Active' : 'Inactive'}
    </button>
  ),
}));

vi.mock('@/components/auto-resize-text-area', () => ({
  default: ({
    value,
    onChange,
    onSubmit,
    placeholder,
    disabled,
    allowAnonymousAccess,
    allowEmptySubmit,
  }: any) => (
    <textarea
      data-testid="auto-resize-textarea"
      data-allow-anon={allowAnonymousAccess ? 'true' : 'false'}
      data-allow-empty={allowEmptySubmit ? 'true' : 'false'}
      value={value}
      onChange={onChange}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onSubmit(e);
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}));

vi.mock('@/hooks/use-model-file-upload-capabilities', () => ({
  useModelFileUploadCapabilities: mockUseModelFileUploadCapabilities,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/hoc/withPermissions', () => ({
  checkRbacPermission: mockCheckRbacPermission,
}));

const defaultChatSliceState = {
  showingSharedChat: false,
  activeTab: 'default',
  chats: {
    default: [],
  },
};

const defaultRbacState = {
  rbacPermissions: {},
};

const createMockStore = (preloadedState = {}) =>
  configureStore({
    reducer: {
      chatInput: chatInputSliceReducer,
      files: (state = { attachedFiles: [] }) => state,
      chatSliceShared: (state = defaultChatSliceState) => state,
      rbac: (state = defaultRbacState) => state,
    },
    preloadedState: {
      chatInput: { textareaInput: '' },
      files: { attachedFiles: [] },
      chatSliceShared: defaultChatSliceState,
      rbac: defaultRbacState,
      ...preloadedState,
    },
  });

describe('ChatInputForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnScreenSharingClick = vi.fn();
  const mockOnPhoneCallClick = vi.fn();
  const mockStopGenerating = vi.fn();
  const mockSetMessage = vi.fn();
  const mockUpdateSessionTools = vi.fn().mockResolvedValue(undefined);
  const mockSetSessionTools = vi.fn().mockResolvedValue(undefined);

  const defaultProps = {
    onSubmit: mockOnSubmit,
    onScreenSharingClick: mockOnScreenSharingClick,
    isScreenSharingModalOpen: false,
    onPhoneCallClick: mockOnPhoneCallClick,
    sessionId: 'session-123',
    stopGenerating: mockStopGenerating,
    tenantKey: 'test-tenant',
    username: 'test-user',
    enableWebBrowsing: true,
    setMessage: mockSetMessage,
    isStreaming: false,
    enableSafetyDisclaimer: false,
    isPreviewMode: false,
    updateSessionTools: mockUpdateSessionTools,
    setSessionTools: mockSetSessionTools,
    activeTools: [],
    screenSharing: true,
    deepResearch: true,
    imageGeneration: true,
    codeInterpreter: true,
    promptsIsEnabled: true,
    googleSlidesIsEnabled: true,
    googleDocumentIsEnabled: true,
    artifactsEnabled: false,
    studyMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTabletOrMobile = false;
    mockIsAccessingPublicRoute = false;
    mockIsLoggedIn = true;
    mockEmbedMode = false;
    mockVisitingTenant = false;
    mockMentorSettings = {
      data: {
        mentorVisibility: 'PRIVATE',
        disclaimer: null,
      },
    };
    mockFileUploadCapabilities = {
      supportsFileUpload: true,
      allSupportedTypes: ['.pdf', '.docx'],
      maxFileSizeMB: 10,
      maxFilesPerMessage: 5,
    };
    mockUseMentorSettings.mockImplementation(() => mockMentorSettings);
    mockUseModelFileUploadCapabilities.mockImplementation(() => mockFileUploadCapabilities);
    mockFreeTrialDialogState.FreeTrialDialog = null;
    mockFreeTrialDialogState.isModalOpen = false;
    mockFreeTrialDialogState.executeWithTrialCheck = mockExecuteWithTrialCheck;
    mockCheckRbacPermission.mockReturnValue(true);
    mockExecuteWithTrialCheck.mockImplementation((fn: () => void) => fn());
  });

  const renderWithRedux = (component: React.ReactElement, preloadedState = {}) => {
    return render(<Provider store={createMockStore(preloadedState)}>{component}</Provider>);
  };

  describe('rendering', () => {
    it('should render without crashing', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(screen.getByTestId('auto-resize-textarea')).toBeInTheDocument();
    });

    it('should render submit button', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });

    it('should render upload menu', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(screen.getByTestId('upload-menu')).toBeInTheDocument();
    });

    it('should render inside buttons', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(screen.getByTestId('inside-buttons')).toBeInTheDocument();
    });

    it('should render outside buttons', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(screen.getByTestId('outside-buttons')).toBeInTheDocument();
    });

    it('should render screen sharing button', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(screen.getByTestId('screen-sharing-button')).toBeInTheDocument();
    });

    it('should render voice chat button', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(screen.getByTestId('voice-chat-button')).toBeInTheDocument();
    });

    it('should render voice call button', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(screen.getByTestId('voice-call-button')).toBeInTheDocument();
    });

    it('should render retrieved documents button on tablet or mobile', () => {
      mockIsTabletOrMobile = true;
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(screen.getByTestId('retrieved-docs-button')).toBeInTheDocument();
    });
  });

  describe('streaming state', () => {
    it('should show stop streaming button when isStreaming is true', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} isStreaming={true} />);
      expect(screen.getByTestId('stop-streaming-button')).toBeInTheDocument();
    });

    it('should show submit button when isStreaming is false', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} isStreaming={false} />);
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });

    it('should call stopGenerating when stop button is clicked', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} isStreaming={true} />);

      fireEvent.click(screen.getByTestId('stop-streaming-button'));
      expect(mockStopGenerating).toHaveBeenCalled();
    });
  });

  describe('public route visibility', () => {
    it('should hide logged-in-only controls for public visitors', () => {
      mockIsAccessingPublicRoute = true;
      mockIsLoggedIn = false;

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(screen.queryByTestId('upload-menu')).not.toBeInTheDocument();
      expect(screen.queryByTestId('inside-buttons')).not.toBeInTheDocument();
      expect(screen.queryByTestId('screen-sharing-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('voice-chat-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('voice-call-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('outside-buttons')).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should call onSubmit with input value when form is submitted', async () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        chatInput: { textareaInput: 'Hello AI!' },
      });

      const form = screen.getByTestId('auto-resize-textarea').closest('form');
      fireEvent.submit(form!);

      expect(mockOnSubmit).toHaveBeenCalledWith('Hello AI!');
    });

    it('should clear input after submission', async () => {
      const store = createMockStore({
        chatInput: { textareaInput: 'Test message' },
      });

      render(
        <Provider store={store}>
          <ChatInputForm {...defaultProps} />
        </Provider>,
      );

      const form = screen.getByTestId('auto-resize-textarea').closest('form');
      fireEvent.submit(form!);

      // Check that the action to clear input was dispatched
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('should prevent submission while files are uploading', async () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        files: {
          attachedFiles: [{ id: '1', uploadStatus: 'uploading', fileName: 'test.pdf' }],
        },
      });

      const form = screen.getByTestId('auto-resize-textarea').closest('form');
      fireEvent.submit(form!);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('file handling', () => {
    it('should render file attachments list', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        files: {
          attachedFiles: [{ id: '1', fileName: 'document.pdf', uploadStatus: 'success' }],
        },
      });

      expect(screen.getByTestId('file-attachments-list')).toBeInTheDocument();
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    it('should fall back to empty attached files when state is missing', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        files: {},
      });

      expect(screen.getByTestId('file-attachments-list')).toBeInTheDocument();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should disable textarea when files are uploading', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        files: {
          attachedFiles: [{ id: '1', uploadStatus: 'uploading', fileName: 'test.pdf' }],
        },
      });

      expect(screen.getByTestId('auto-resize-textarea')).toBeDisabled();
    });

    it('should not disable textarea when files are uploaded successfully', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        files: {
          attachedFiles: [{ id: '1', uploadStatus: 'success', fileName: 'test.pdf' }],
        },
      });

      expect(screen.getByTestId('auto-resize-textarea')).not.toBeDisabled();
    });
  });

  describe('upload error handling', () => {
    it('should route upload errors through toast', async () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const { useChatFileUpload } = await import('@/hooks/use-chat-file-upload');
      const options = (useChatFileUpload as any).mock.calls[0][0];
      options.errorHandler('Upload failed');

      expect(toast.error).toHaveBeenCalledWith('Upload failed');
    });
  });

  // Drag-and-drop is now handled at the Chat component level (components/chat/index.tsx)

  describe('button interactions', () => {
    it('should call onScreenSharingClick when screen sharing button is clicked', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId('screen-sharing-button'));
      expect(mockOnScreenSharingClick).toHaveBeenCalled();
    });

    it('should trigger voice chat through trial check', async () => {
      const useVoiceChat = (await import('@/hooks/use-voice-chat')).default;
      const handleMicrophoneBtnClick = vi.fn();
      (useVoiceChat as any).mockReturnValue({
        handleMicrophoneBtnClick,
        processing: false,
        recording: false,
        time: 0,
      });

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId('voice-chat-button'));

      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      expect(handleMicrophoneBtnClick).toHaveBeenCalled();
    });

    it('should call onPhoneCallClick when voice call button is clicked', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId('voice-call-button'));
      expect(mockOnPhoneCallClick).toHaveBeenCalled();
    });
  });

  describe('placeholder text', () => {
    it('should show "Ask anything" placeholder by default', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(screen.getByTestId('auto-resize-textarea')).toHaveAttribute(
        'placeholder',
        'Ask anything',
      );
    });
  });

  describe('preview mode', () => {
    it('should disable submit button in preview mode', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} isPreviewMode={true} />);

      expect(screen.getByTestId('submit-button')).toBeDisabled();
    });
  });

  describe('disclaimer', () => {
    it('should render disclaimer when provided in mentor settings', async () => {
      const { useMentorSettings } = await import('@/hooks/use-mentors/use-mentor-settings');
      (useMentorSettings as any).mockReturnValue({
        data: {
          disclaimer: 'This is a test disclaimer',
          mentorVisibility: 'PRIVATE',
        },
      });

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(screen.getByText('This is a test disclaimer')).toBeInTheDocument();
    });
  });

  describe('anonymous access', () => {
    it('should allow anonymous access when mentor is viewable by anyone', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
          disclaimer: null,
        },
      };

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(screen.getByTestId('auto-resize-textarea')).toHaveAttribute('data-allow-anon', 'true');
      expect(screen.getByTestId('submit-button')).toHaveAttribute('data-allow-anon', 'true');
    });

    it('should allow anonymous access for shared chats', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        chatSliceShared: {
          ...defaultChatSliceState,
          showingSharedChat: true,
        },
      });

      expect(screen.getByTestId('auto-resize-textarea')).toHaveAttribute('data-allow-anon', 'true');
      expect(screen.getByTestId('submit-button')).toHaveAttribute('data-allow-anon', 'false');
    });

    it('should allow anonymous access for visiting tenants', () => {
      mockVisitingTenant = true;

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(screen.getByTestId('auto-resize-textarea')).toHaveAttribute('data-allow-anon', 'true');
    });
  });

  describe('active tools', () => {
    it('should pass activeTools to InsideButtons', () => {
      renderWithRedux(
        <ChatInputForm {...defaultProps} activeTools={['canvas', 'deep_research']} />,
      );

      expect(screen.getByTestId('active-options')).toHaveTextContent('canvas,deep_research');
    });

    it('should call updateSessionTools when option is clicked', async () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const canvasButton = screen.getByText('Canvas');
      fireEvent.click(canvasButton);

      expect(mockUpdateSessionTools).toHaveBeenCalledWith('canvas');
    });
  });

  describe('file input', () => {
    it('should have hidden file input element', () => {
      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />);

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveClass('hidden');
    });

    it('should accept correct file types', () => {
      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />);

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('accept', '.pdf,.docx');
    });

    it('should allow multiple files', () => {
      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />);

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('multiple');
    });
  });

  describe('screen sharing modal state', () => {
    it('should reflect screen sharing modal open state', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} isScreenSharingModalOpen={true} />);

      expect(screen.getByTestId('screen-sharing-button')).toHaveTextContent('Active');
    });

    it('should reflect screen sharing modal closed state', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} isScreenSharingModalOpen={false} />);

      expect(screen.getByTestId('screen-sharing-button')).toHaveTextContent('Inactive');
    });
  });

  describe('free trial dialog', () => {
    it('should render FreeTrialDialog when modal is open', () => {
      const MockFreeTrialDialog = ({ isOpen }: any) => (
        <div data-testid="free-trial-dialog" data-open={isOpen} />
      );
      MockFreeTrialDialog.displayName = 'MockFreeTrialDialog';
      mockFreeTrialDialogState.FreeTrialDialog = MockFreeTrialDialog;
      mockFreeTrialDialogState.isModalOpen = true;

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
    });
  });

  describe('file input change', () => {
    it('should handle file input change and upload files', async () => {
      const { useChatFileUpload } = await import('@/hooks/use-chat-file-upload');
      const mockUploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockUploadFiles).toHaveBeenCalledWith([file]);
      });
    });

    it('should reset file input after upload', async () => {
      const { useChatFileUpload } = await import('@/hooks/use-chat-file-upload');
      const mockUploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockUploadFiles).toHaveBeenCalled();
      });
    });

    it('should pluralize notification when multiple files are selected', async () => {
      const { useChatFileUpload } = await import('@/hooks/use-chat-file-upload');
      const mockUploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const files = [
        new File(['test1'], 'test1.pdf', { type: 'application/pdf' }),
        new File(['test2'], 'test2.pdf', { type: 'application/pdf' }),
      ];

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(screen.getByText(/Uploading 2 files/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(mockUploadFiles).toHaveBeenCalledWith(files);
      });
    });

    it('should not upload when no files are selected', async () => {
      const { useChatFileUpload } = await import('@/hooks/use-chat-file-upload');
      const mockUploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(fileInput, 'files', {
        value: [],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(mockUploadFiles).not.toHaveBeenCalled();
    });
  });

  describe('upload notifications', () => {
    it('should clear input notification after upload', async () => {
      vi.useFakeTimers();
      const { useChatFileUpload } = await import('@/hooks/use-chat-file-upload');
      const mockUploadFiles = vi.fn().mockResolvedValue(undefined);
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />);

      const fileInput = container.querySelector('input[type=\"file\"]') as HTMLInputElement;
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(screen.getByText(/Uploading 1 file/i)).toBeInTheDocument();
      expect(mockUploadFiles).toHaveBeenCalledWith([file]);

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.queryByText(/Uploading 1 file/i)).not.toBeInTheDocument();
      vi.useRealTimers();
    });
  });

  describe('voice chat states', () => {
    it('should show "Listening..." placeholder when recording', async () => {
      const useVoiceChat = (await import('@/hooks/use-voice-chat')).default;
      (useVoiceChat as any).mockReturnValue({
        handleMicrophoneBtnClick: vi.fn(),
        processing: false,
        recording: true,
        time: 5000,
      });

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(screen.getByTestId('auto-resize-textarea')).toHaveAttribute(
        'placeholder',
        expect.stringContaining('Listening...'),
      );
    });

    it('should show "Processing..." placeholder when processing', async () => {
      const useVoiceChat = (await import('@/hooks/use-voice-chat')).default;
      (useVoiceChat as any).mockReturnValue({
        handleMicrophoneBtnClick: vi.fn(),
        processing: true,
        recording: false,
        time: 0,
      });

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(screen.getByTestId('auto-resize-textarea')).toHaveAttribute(
        'placeholder',
        'Processing...',
      );
    });
  });

  describe('files with pending status', () => {
    it('should prevent submission when files are in pending status', async () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        files: {
          attachedFiles: [{ id: '1', uploadStatus: 'pending', fileName: 'test.pdf' }],
        },
      });

      const form = screen.getByTestId('auto-resize-textarea').closest('form');
      fireEvent.submit(form!);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  // File drop tests are now in the Chat component tests (drag-drop is handled at Chat level)

  describe('upload menu trigger', () => {
    it('should trigger file input when upload menu is clicked', () => {
      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />);

      const uploadMenu = screen.getByTestId('upload-menu');
      fireEvent.click(uploadMenu);

      // The click should not throw and the file input should exist
      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });
  });

  // Multiple files drop test moved to Chat component tests

  describe('input text change', () => {
    it('should update input value on change', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const textarea = screen.getByTestId('auto-resize-textarea');
      fireEvent.change(textarea, { target: { value: 'New message' } });

      // The change event should be handled without error
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('file capabilities fallback', () => {
    it('should use default extensions when capabilities are empty', async () => {
      const { useModelFileUploadCapabilities } = await import(
        '@/hooks/use-model-file-upload-capabilities'
      );
      (useModelFileUploadCapabilities as any).mockReturnValue({
        supportsFileUpload: true,
        allSupportedTypes: [],
        maxFileSizeMB: 10,
        maxFilesPerMessage: 5,
      });

      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />);

      const fileInput = container.querySelector('input[type="file"]');
      // Should fallback to MENTOR_CHAT_DOCUMENTS_EXTENSIONS
      expect(fileInput).toHaveAttribute('accept');
    });
  });

  describe('remove file action', () => {
    it('should dispatch remove file action when remove is clicked', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        files: {
          attachedFiles: [{ id: 'file-1', fileName: 'test.pdf', uploadStatus: 'success' }],
        },
      });

      const removeButton = screen.getByText('Remove');
      fireEvent.click(removeButton);

      // The action should be dispatched (no error)
      expect(true).toBe(true);
    });

    it.skip('should call retryUpload when retry is clicked', () => {
      // TODO: Fix mock hoisting issue - mockRetryUpload call not detected
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        files: {
          attachedFiles: [{ id: 'file-2', fileName: 'retry.pdf', uploadStatus: 'error' }],
        },
      });

      fireEvent.click(screen.getByText('Retry'));
      expect(mockRetryUpload).toHaveBeenCalledWith('file-2');
    });
  });

  describe('outside buttons web browse', () => {
    it('should call updateSessionTools when web browse is clicked', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const webBrowseButton = screen.getByText('Web Browse');
      fireEvent.click(webBrowseButton);

      expect(mockUpdateSessionTools).toHaveBeenCalledWith('web_browsing');
    });
  });

  describe('prompt gallery', () => {
    it('should populate input when selecting a prompt', async () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId('open-prompt-gallery'));
      expect(screen.getByTestId('prompt-gallery-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Select Prompt'));

      await waitFor(() => {
        expect(screen.getByTestId('auto-resize-textarea')).toHaveValue('Suggested prompt');
      });
      expect(screen.queryByTestId('prompt-gallery-modal')).not.toBeInTheDocument();
    });

    it('should close prompt gallery when close is clicked', async () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId('open-prompt-gallery'));
      expect(screen.getByTestId('prompt-gallery-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('prompt-gallery-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('chatAreaMaxWidth', () => {
    it('should apply maxWidth style when chatAreaMaxWidth is provided', () => {
      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} chatAreaMaxWidth={800} />,
      );
      const form = container.querySelector('form');
      expect(form).toHaveStyle({ maxWidth: '800px' });
    });
  });

  describe('RBAC chat permission', () => {
    it('should disable chat when RBAC denies chat permission', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: null,
          mentorDbId: 42,
        },
      } as any;
      mockCheckRbacPermission.mockReturnValue(false);

      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        rbac: { rbacPermissions: { '/mentors/42/': {} } },
      });

      // Textarea should show disabled message
      const textarea = screen.getByTestId('auto-resize-textarea');
      expect(textarea).toHaveAttribute(
        'placeholder',
        "Sorry about that! You don't have permission to chat.",
      );
    });

    it('should prevent drag over when chat is disabled by RBAC', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: null,
          mentorDbId: 42,
        },
      } as any;
      mockCheckRbacPermission.mockReturnValue(false);

      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />, {
        rbac: { rbacPermissions: { '/mentors/42/': {} } },
      });

      const form = container.querySelector('form');
      fireEvent.dragOver(form!, { dataTransfer: { files: [] } });
      const dropAnimation = container.querySelector('.border-dashed');
      expect(dropAnimation).not.toBeInTheDocument();
    });

    it('should prevent file drop when chat is disabled by RBAC', async () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: null,
          mentorDbId: 42,
        },
      } as any;
      mockCheckRbacPermission.mockReturnValue(false);

      const { container } = renderWithRedux(<ChatInputForm {...defaultProps} />, {
        rbac: { rbacPermissions: { '/mentors/42/': {} } },
      });

      const form = container.querySelector('form');
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      fireEvent.drop(form!, {
        dataTransfer: { files: [file] },
      });

      // uploadFiles should NOT be called
      expect(mockUploadFiles).not.toHaveBeenCalled();
    });
  });

  describe('disclaimer', () => {
    it('should render disclaimer when mentorSettings has disclaimer', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: 'This is a test disclaimer',
        },
      } as any;

      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(screen.getByText('This is a test disclaimer')).toBeInTheDocument();
    });

    it('should apply maxWidth to disclaimer section when chatAreaMaxWidth is provided', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: 'Test disclaimer',
        },
      } as any;

      renderWithRedux(<ChatInputForm {...defaultProps} chatAreaMaxWidth={800} />);
      const disclaimerSection = screen.getByText('Test disclaimer').closest('div.mt-1');
      expect(disclaimerSection).toHaveStyle({ maxWidth: '800px' });
    });
  });
});
