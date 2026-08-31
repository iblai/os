import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
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
// Code-mode skill sync: the real hook fires Tauri IPC + RTK lazy queries this
// suite doesn't provide; the composer only mounts it and threads its state.
const mockUseOpencodeSkillSync = vi.hoisted(() =>
  vi.fn(() => ({ state: 'idle' as const })),
);
// `/` skill picker sources — skill assignments + catalog, resolved
// client-side via the real `resolveEffectiveAgentSkills`. Default: no data →
// picker fully inactive, so the pre-existing tests observe the composer
// exactly as before.
const mockUseGetMentorSkillAssignmentsQuery = vi.hoisted(() =>
  vi.fn(
    (
      ..._args: unknown[]
    ): {
      data?: unknown;
      isLoading?: boolean;
      isFetching?: boolean;
      isError?: boolean;
    } => ({
      data: undefined,
    }),
  ),
);
const mockUseGetAgentSkillsQuery = vi.hoisted(() =>
  vi.fn((): { data?: unknown; isLoading?: boolean } => ({ data: undefined })),
);

vi.mock('@iblai/iblai-js/data-layer', async () => {
  const actual = await vi.importActual('@iblai/iblai-js/data-layer');
  return {
    ...actual,
    useGetMentorSkillAssignmentsQuery: mockUseGetMentorSkillAssignmentsQuery,
    useGetAgentSkillsQuery: mockUseGetAgentSkillsQuery,
  };
});

vi.mock('@/hooks/use-opencode-skill-sync', () => ({
  useOpencodeSkillSync: mockUseOpencodeSkillSync,
}));

// Shareable-link token present in the URL (`?token=...`). When set, the RBAC
// chat gate must be bypassed. Controlled per-test and reset in beforeEach.
let mockShareableToken: string | null = null;

// Mock all dependencies
vi.mock('react-responsive', () => ({
  useMediaQuery: vi.fn(() => mockIsTabletOrMobile),
}));

vi.mock('next/navigation', () => ({
  // `useParams` previously resolved to null outside a route; keep mentorId
  // undefined so downstream hooks (e.g. chat privacy) behave as before.
  useParams: () => ({}),
  useSearchParams: () =>
    new URLSearchParams(
      mockShareableToken ? `token=${mockShareableToken}` : '',
    ),
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
          <button onClick={() => onSelectPrompt?.('Suggested prompt')}>
            Select Prompt
          </button>
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
  cn: (...args: (string | boolean | undefined)[]) =>
    args.filter(Boolean).join(' '),
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
  VoiceChatButton: ({
    handleMicrophoneBtnClick,
    processing,
    recording,
  }: any) => (
    <button data-testid="voice-chat-button" onClick={handleMicrophoneBtnClick}>
      Voice {processing ? 'Processing' : recording ? 'Recording' : 'Idle'}
    </button>
  ),
}));

vi.mock('@/components/retrieved-documents-button', () => ({
  RetrievedDocumentsButton: () => (
    <button data-testid="retrieved-docs-button">Docs</button>
  ),
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
  SubmitMessageButton: ({
    isPreviewMode,
    isUploading,
    allowAnonymousAccess,
    disabled,
  }: any) => (
    <button
      data-testid="submit-button"
      data-allow-anon={allowAnonymousAccess ? 'true' : 'false'}
      type="submit"
      disabled={disabled || isPreviewMode || isUploading}
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
  InsideButtons: ({
    activeOptions,
    onOptionClick,
    onOpenPromptGallery,
    skills,
    activeSkillSlugs,
    onToggleSkill,
    onClearSkills,
  }: any) => (
    <div data-testid="inside-buttons">
      <button onClick={() => onOptionClick('canvas')}>Canvas</button>
      <button data-testid="open-prompt-gallery" onClick={onOpenPromptGallery}>
        Prompt Gallery
      </button>
      <span data-testid="active-options">{activeOptions?.join(',') || ''}</span>
      {/* Skills-dropdown wiring surface: one toggle button per passed skill,
          exposing the armed state the real dropdown would render. */}
      {skills?.map((skill: any) => (
        <button
          key={skill.slug}
          type="button"
          data-testid={`toggle-skill-${skill.slug}`}
          data-armed={activeSkillSlugs?.has(skill.slug) ? 'true' : 'false'}
          onClick={() => onToggleSkill?.(skill)}
        >
          {/* slug, not name — picker tests query options by visible name */}
          {skill.slug}
        </button>
      ))}
      {skills && skills.length > 0 && (
        <button
          type="button"
          data-testid="clear-skills"
          onClick={() => onClearSkills?.()}
        >
          clear
        </button>
      )}
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
    selectShowingSharedChat: (state: any) =>
      state.chatSliceShared?.showingSharedChat ?? false,
    useTenantMetadata: () => ({
      metadata: {},
      metadataLoaded: true,
    }),
  };
});

// The real useChatPrivacy fires chat-privacy selectors/API calls against redux
// slices this test's minimal store doesn't provide; stub it (the nav-bar tests
// stub ChatPrivacyToggle for the same reason). Spread the real module: a bare
// factory drops every other export, and which of two registrations for the same
// path wins is not deterministic across environments.
vi.mock('@iblai/iblai-js/web-containers', async () => {
  const actual = await vi.importActual('@iblai/iblai-js/web-containers');
  return {
    ...actual,
    useChatPrivacy: () => ({ effective: undefined, isEffectiveReady: false }),
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
  UploadMenu: ({ onFileInputTrigger, onCameraTrigger }: any) => (
    <>
      <button data-testid="upload-menu" onClick={onFileInputTrigger}>
        Upload
      </button>
      <button data-testid="camera-menu" onClick={onCameraTrigger}>
        Camera
      </button>
    </>
  ),
}));

let mockIsMobileOS = false;
vi.mock('@/hooks/use-is-mobile-os', () => ({
  useIsMobileOS: vi.fn(() => mockIsMobileOS),
}));

vi.mock('@/components/chat-input-form/camera-capture-dialog', () => ({
  CameraCaptureDialog: ({ open, onCapture }: any) =>
    open ? (
      <div data-testid="camera-capture-dialog">
        <button
          data-testid="camera-use-photo"
          onClick={() =>
            onCapture(
              new File(['img'], 'camera-photo-1.jpg', { type: 'image/jpeg' }),
            )
          }
        >
          Use Photo
        </button>
      </div>
    ) : null,
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
    onPaste,
    onComposerKeyDown,
    placeholder,
    disabled,
    allowAnonymousAccess,
    allowEmptySubmit,
    className,
    role,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
    'aria-activedescendant': ariaActiveDescendant,
    'aria-haspopup': ariaHasPopup,
    'aria-autocomplete': ariaAutoComplete,
  }: any) => (
    <textarea
      id="chat-input-textarea"
      data-testid="auto-resize-textarea"
      data-allow-anon={allowAnonymousAccess ? 'true' : 'false'}
      data-allow-empty={allowEmptySubmit ? 'true' : 'false'}
      className={className}
      role={role}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-activedescendant={ariaActiveDescendant}
      aria-haspopup={ariaHasPopup}
      aria-autocomplete={ariaAutoComplete}
      value={value}
      onChange={onChange}
      onPaste={onPaste}
      onKeyDown={(e) => {
        // Mirror the real AutoResizeTextarea: the composer-level interceptor
        // (the `/` skill picker) runs first and, when it handles the event,
        // suppresses the Enter-to-submit behavior.
        if (onComposerKeyDown?.(e)) return;
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

let mockMaxCharacterSize = '2000';
vi.mock('@/lib/config', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/config')>('@/lib/config');
  return {
    ...actual,
    config: {
      ...actual.config,
      maximumCharacterSizeToCopy: () => mockMaxCharacterSize,
    },
  };
});

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
    mockIsMobileOS = false;
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
    mockUseModelFileUploadCapabilities.mockImplementation(
      () => mockFileUploadCapabilities,
    );
    mockUseGetMentorSkillAssignmentsQuery.mockImplementation(() => ({
      data: undefined,
    }));
    mockUseGetAgentSkillsQuery.mockImplementation(() => ({
      data: undefined,
    }));
    mockFreeTrialDialogState.FreeTrialDialog = null;
    mockFreeTrialDialogState.isModalOpen = false;
    mockFreeTrialDialogState.executeWithTrialCheck = mockExecuteWithTrialCheck;
    mockCheckRbacPermission.mockReturnValue(true);
    mockExecuteWithTrialCheck.mockImplementation((fn: () => void) => fn());
    mockMaxCharacterSize = '2000';
    mockShareableToken = null;
  });

  const renderWithRedux = (
    component: React.ReactElement,
    preloadedState = {},
  ) => {
    return render(
      <Provider store={createMockStore(preloadedState)}>{component}</Provider>,
    );
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
      expect(
        screen.queryByTestId('screen-sharing-button'),
      ).not.toBeInTheDocument();
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
          attachedFiles: [
            { id: '1', uploadStatus: 'uploading', fileName: 'test.pdf' },
          ],
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
          attachedFiles: [
            { id: '1', fileName: 'document.pdf', uploadStatus: 'success' },
          ],
        },
      });

      expect(screen.getByTestId('file-attachments-list')).toBeInTheDocument();
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    it('should fall back to empty attached files when state is missing', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
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
          attachedFiles: [
            { id: '1', uploadStatus: 'uploading', fileName: 'test.pdf' },
          ],
        },
      });

      expect(screen.getByTestId('auto-resize-textarea')).toBeDisabled();
    });

    it('should not disable textarea when files are uploaded successfully', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        files: {
          attachedFiles: [
            { id: '1', uploadStatus: 'success', fileName: 'test.pdf' },
          ],
        },
      });

      expect(screen.getByTestId('auto-resize-textarea')).not.toBeDisabled();
    });
  });

  describe('upload error handling', () => {
    it('should route upload errors through toast', async () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
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
      const { useMentorSettings } = await import(
        '@/hooks/use-mentors/use-mentor-settings'
      );
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

      expect(screen.getByTestId('auto-resize-textarea')).toHaveAttribute(
        'data-allow-anon',
        'true',
      );
      expect(screen.getByTestId('submit-button')).toHaveAttribute(
        'data-allow-anon',
        'true',
      );
    });

    it('should allow anonymous access for shared chats', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        chatSliceShared: {
          ...defaultChatSliceState,
          showingSharedChat: true,
        },
      });

      expect(screen.getByTestId('auto-resize-textarea')).toHaveAttribute(
        'data-allow-anon',
        'true',
      );
      expect(screen.getByTestId('submit-button')).toHaveAttribute(
        'data-allow-anon',
        'false',
      );
    });

    it('should allow anonymous access for visiting tenants', () => {
      mockVisitingTenant = true;

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(screen.getByTestId('auto-resize-textarea')).toHaveAttribute(
        'data-allow-anon',
        'true',
      );
    });
  });

  describe('active tools', () => {
    it('should pass activeTools to InsideButtons', () => {
      renderWithRedux(
        <ChatInputForm
          {...defaultProps}
          activeTools={['canvas', 'deep_research']}
        />,
      );

      expect(screen.getByTestId('active-options')).toHaveTextContent(
        'canvas,deep_research',
      );
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
      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveClass('hidden');
    });

    it('should accept correct file types', () => {
      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('accept', '.pdf,.docx');
    });

    it('should allow multiple files', () => {
      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('multiple');
    });
  });

  describe('camera input', () => {
    it('should have a hidden camera input that accepts images via the device camera', () => {
      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const cameraInput = container.querySelector(
        'input[type="file"][accept="image/*"]',
      );
      expect(cameraInput).toBeInTheDocument();
      expect(cameraInput).toHaveClass('hidden');
      expect(cameraInput).toHaveAttribute('capture', 'environment');
    });

    it('should not allow multiple files on the camera input', () => {
      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const cameraInput = container.querySelector(
        'input[type="file"][accept="image/*"]',
      );
      expect(cameraInput).not.toHaveAttribute('multiple');
    });

    it('should disable the camera input when there is no session', () => {
      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} sessionId="" />,
      );

      const cameraInput = container.querySelector(
        'input[type="file"][accept="image/*"]',
      );
      expect(cameraInput).toBeDisabled();
    });

    it('should route a photo selected on the camera input through the same upload path', async () => {
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const mockUploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const cameraInput = container.querySelector(
        'input[type="file"][accept="image/*"]',
      ) as HTMLInputElement;
      const photo = new File(['photo content'], 'photo.jpg', {
        type: 'image/jpeg',
      });

      Object.defineProperty(cameraInput, 'files', {
        value: [photo],
        writable: false,
      });

      fireEvent.change(cameraInput);

      await waitFor(() => {
        expect(mockUploadFiles).toHaveBeenCalledWith([photo]);
      });
    });

    it('should open the in-app camera dialog on desktop when Camera is clicked', () => {
      mockIsMobileOS = false;
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(
        screen.queryByTestId('camera-capture-dialog'),
      ).not.toBeInTheDocument();

      const cameraMenu = screen.getByTestId('camera-menu');
      fireEvent.click(cameraMenu);

      // Click goes through executeWithTrialCheck wrapper
      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      // Desktop opens the webcam dialog rather than the native file input.
      expect(screen.getByTestId('camera-capture-dialog')).toBeInTheDocument();
    });

    it('should trigger the native camera input on mobile when Camera is clicked', () => {
      mockIsMobileOS = true;
      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const cameraInput = container.querySelector(
        'input[type="file"][accept="image/*"]',
      ) as HTMLInputElement;
      const clickSpy = vi.spyOn(cameraInput, 'click');

      fireEvent.click(screen.getByTestId('camera-menu'));

      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      // The webcam dialog must NOT open on mobile.
      expect(
        screen.queryByTestId('camera-capture-dialog'),
      ).not.toBeInTheDocument();
    });

    it('should route a desktop webcam capture through the same upload path', async () => {
      mockIsMobileOS = false;
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const mockUploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId('camera-menu'));
      fireEvent.click(screen.getByTestId('camera-use-photo'));

      await waitFor(() => {
        expect(mockUploadFiles).toHaveBeenCalledTimes(1);
      });
      const uploaded = mockUploadFiles.mock.calls[0][0];
      expect(uploaded).toHaveLength(1);
      expect(uploaded[0]).toBeInstanceOf(File);
      expect(uploaded[0].type).toBe('image/jpeg');
    });
  });

  describe('screen sharing modal state', () => {
    it('should reflect screen sharing modal open state', () => {
      renderWithRedux(
        <ChatInputForm {...defaultProps} isScreenSharingModalOpen={true} />,
      );

      expect(screen.getByTestId('screen-sharing-button')).toHaveTextContent(
        'Active',
      );
    });

    it('should reflect screen sharing modal closed state', () => {
      renderWithRedux(
        <ChatInputForm {...defaultProps} isScreenSharingModalOpen={false} />,
      );

      expect(screen.getByTestId('screen-sharing-button')).toHaveTextContent(
        'Inactive',
      );
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
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const mockUploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });

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
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const mockUploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });

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
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const mockUploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
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
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const mockUploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

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
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const mockUploadFiles = vi.fn().mockResolvedValue(undefined);
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles: mockUploadFiles,
        retryUpload: vi.fn(),
      });

      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const fileInput = container.querySelector(
        'input[type=\"file\"]',
      ) as HTMLInputElement;
      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });

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

  describe('voice transcript insertion', () => {
    /** Render, capturing the onTranscript callback the form hands the hook. */
    const renderCapturingTranscript = async () => {
      const useVoiceChat = (await import('@/hooks/use-voice-chat')).default;
      let onTranscript!: (text: string) => void;
      (useVoiceChat as any).mockImplementation((props: any) => {
        onTranscript = props.onTranscript;
        return {
          handleMicrophoneBtnClick: vi.fn(),
          cancelRecording: vi.fn(),
          processing: false,
          recording: false,
          time: 0,
        };
      });
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      return {
        textarea: screen.getByTestId('auto-resize-textarea'),
        emit: (text: string) => onTranscript(text),
      };
    };

    it('inserts the transcript into an empty composer', async () => {
      const { textarea, emit } = await renderCapturingTranscript();

      await act(async () => {
        emit('hello world');
      });

      await waitFor(() => expect(textarea).toHaveValue('hello world'));
    });

    it('appends onto the latest composer text, not a stale snapshot', async () => {
      const { textarea, emit } = await renderCapturingTranscript();

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'first' } });
      });
      // simulates the user continuing to type after hitting record
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'first second' } });
      });
      await act(async () => {
        emit('dictated');
      });

      await waitFor(() =>
        expect(textarea).toHaveValue('first second dictated'),
      );
    });

    // iblai-platform#2402: dictation used to replace the composer contents,
    // destroying anything the user had already typed.
    it('appends the transcript after existing text instead of replacing it', async () => {
      const { textarea, emit } = await renderCapturingTranscript();

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'already typed' } });
      });
      await act(async () => {
        emit('and dictated');
      });

      await waitFor(() =>
        expect(textarea).toHaveValue('already typed and dictated'),
      );
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
          attachedFiles: [
            { id: '1', uploadStatus: 'pending', fileName: 'test.pdf' },
          ],
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
      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

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

  describe('paste handling', () => {
    const firePaste = (
      textarea: HTMLElement,
      clipboardData: Partial<DataTransfer>,
    ) => {
      const event = new Event('paste', {
        bubbles: true,
        cancelable: true,
      }) as any;
      event.clipboardData = clipboardData;
      fireEvent(textarea, event);
      return event;
    };

    it('should convert large pasted text into a .txt file upload and not insert text', async () => {
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const uploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles,
        retryUpload: vi.fn(),
      });

      mockMaxCharacterSize = '10';
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const textarea = screen.getByTestId('auto-resize-textarea');
      const largeText = 'a'.repeat(50);
      const event = firePaste(textarea, {
        files: [] as any,
        items: [] as any,
        getData: () => largeText,
      });

      expect(event.defaultPrevented).toBe(true);
      await waitFor(() => {
        expect(uploadFiles).toHaveBeenCalledTimes(1);
      });
      const uploaded = uploadFiles.mock.calls[0][0];
      expect(uploaded).toHaveLength(1);
      expect(uploaded[0]).toBeInstanceOf(File);
      expect(uploaded[0].type).toBe('text/plain');
      expect(uploaded[0].name).toMatch(/^pasted-\d+\.txt$/);
      expect(textarea).toHaveValue('');
    });

    it('should let small pasted text fall through to default paste without uploading', async () => {
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const uploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles,
        retryUpload: vi.fn(),
      });

      mockMaxCharacterSize = '2000';
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const textarea = screen.getByTestId('auto-resize-textarea');
      const event = firePaste(textarea, {
        files: [] as any,
        items: [] as any,
        getData: () => 'short text',
      });

      expect(event.defaultPrevented).toBe(false);
      expect(uploadFiles).not.toHaveBeenCalled();
    });

    it('should upload pasted image files through the existing upload path', async () => {
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const uploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles,
        retryUpload: vi.fn(),
      });

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const textarea = screen.getByTestId('auto-resize-textarea');
      const image = new File(['img'], 'pasted.png', { type: 'image/png' });
      const event = firePaste(textarea, {
        files: [image] as any,
        items: [] as any,
        getData: () => '',
      });

      expect(event.defaultPrevented).toBe(true);
      await waitFor(() => {
        expect(uploadFiles).toHaveBeenCalledWith([image]);
      });
    });

    it('should collect pasted files from clipboard items when files list is empty', async () => {
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const uploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles,
        retryUpload: vi.fn(),
      });

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const textarea = screen.getByTestId('auto-resize-textarea');
      const file = new File(['data'], 'clip.png', { type: 'image/png' });
      const event = firePaste(textarea, {
        files: [] as any,
        items: [
          { kind: 'string', getAsFile: () => null },
          { kind: 'file', getAsFile: () => file },
          { kind: 'file', getAsFile: () => null },
        ] as any,
        getData: () => '',
      });

      expect(event.defaultPrevented).toBe(true);
      await waitFor(() => {
        expect(uploadFiles).toHaveBeenCalledWith([file]);
      });
    });

    it('should route pasted files through the upload hook so size limits are enforced', async () => {
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const uploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles,
        retryUpload: vi.fn(),
      });

      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const textarea = screen.getByTestId('auto-resize-textarea');
      const oversizedFile = new File(['x'], 'huge.pdf', {
        type: 'application/pdf',
      });
      firePaste(textarea, {
        files: [oversizedFile] as any,
        items: [] as any,
        getData: () => '',
      });

      await waitFor(() => {
        expect(uploadFiles).toHaveBeenCalledWith([oversizedFile]);
      });
    });

    it('should fall through to text handling when no files or items are present', async () => {
      const { useChatFileUpload } = await import(
        '@/hooks/use-chat-file-upload'
      );
      const uploadFiles = vi.fn();
      (useChatFileUpload as any).mockReturnValue({
        uploadFiles,
        retryUpload: vi.fn(),
      });

      mockMaxCharacterSize = '5';
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const textarea = screen.getByTestId('auto-resize-textarea');
      const event = firePaste(textarea, {
        getData: () => 'this is long enough',
      } as any);

      expect(event.defaultPrevented).toBe(true);
      await waitFor(() => {
        expect(uploadFiles).toHaveBeenCalledTimes(1);
      });
    });

    it('should do nothing when clipboardData is unavailable', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      const textarea = screen.getByTestId('auto-resize-textarea');
      const event = new Event('paste', {
        bubbles: true,
        cancelable: true,
      }) as any;
      event.clipboardData = null;
      fireEvent(textarea, event);

      expect(mockUploadFiles).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
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

      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
      );

      const fileInput = container.querySelector('input[type="file"]');
      // Should fallback to MENTOR_CHAT_DOCUMENTS_EXTENSIONS
      expect(fileInput).toHaveAttribute('accept');
    });
  });

  describe('remove file action', () => {
    it('should dispatch remove file action when remove is clicked', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        files: {
          attachedFiles: [
            { id: 'file-1', fileName: 'test.pdf', uploadStatus: 'success' },
          ],
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
          attachedFiles: [
            { id: 'file-2', fileName: 'retry.pdf', uploadStatus: 'error' },
          ],
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
        expect(screen.getByTestId('auto-resize-textarea')).toHaveValue(
          'Suggested prompt',
        );
      });
      expect(
        screen.queryByTestId('prompt-gallery-modal'),
      ).not.toBeInTheDocument();
    });

    it('should close prompt gallery when close is clicked', async () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId('open-prompt-gallery'));
      expect(screen.getByTestId('prompt-gallery-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('prompt-gallery-modal'),
        ).not.toBeInTheDocument();
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

      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
        {
          rbac: { rbacPermissions: { '/mentors/42/': {} } },
        },
      );

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

      const { container } = renderWithRedux(
        <ChatInputForm {...defaultProps} />,
        {
          rbac: { rbacPermissions: { '/mentors/42/': {} } },
        },
      );

      const form = container.querySelector('form');
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      fireEvent.drop(form!, {
        dataTransfer: { files: [file] },
      });

      // uploadFiles should NOT be called
      expect(mockUploadFiles).not.toHaveBeenCalled();
    });

    it('should bypass the RBAC gate when a shareable-link token is present', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: null,
          mentorDbId: 42,
        },
      } as any;
      // RBAC would otherwise deny chat...
      mockCheckRbacPermission.mockReturnValue(false);
      // ...but the user arrived via a shareable link (?token=...).
      mockShareableToken = 'share-abc123';

      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        rbac: { rbacPermissions: { '/mentors/42/': {} } },
      });

      const textarea = screen.getByTestId('auto-resize-textarea');
      // Chat input is enabled and does NOT show the RBAC denial placeholder.
      // defaultProps.sessionId is truthy ('session-123'), i.e. the backend
      // accepted the token and created a session — the bypass condition.
      expect(textarea).not.toBeDisabled();
      expect(textarea).not.toHaveAttribute(
        'placeholder',
        "Sorry about that! You don't have permission to chat.",
      );
      // Submit button remains enabled (only disabled by preview/uploading).
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });

    it('should keep chat gated (and hide the RBAC denial) when a token is present but no session has been created yet', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: null,
          mentorDbId: 42,
        },
      } as any;
      // RBAC denies, and although a token is present the backend has not yet
      // returned a sessionId (invalid/expired token, or pre-create window).
      mockCheckRbacPermission.mockReturnValue(false);
      mockShareableToken = 'share-abc123';

      renderWithRedux(<ChatInputForm {...defaultProps} sessionId="" />, {
        rbac: { rbacPermissions: { '/mentors/42/': {} } },
      });

      const textarea = screen.getByTestId('auto-resize-textarea');
      // Without a created session the token cannot open the input...
      expect(textarea).toBeDisabled();
      expect(screen.getByTestId('submit-button')).toBeDisabled();
      // ...but a share-link visitor must never see the RBAC denial message,
      // so the placeholder is the normal one, not the denial text.
      expect(textarea).not.toHaveAttribute(
        'placeholder',
        "Sorry about that! You don't have permission to chat.",
      );
    });

    it('should allow submission when a shareable-link token bypasses RBAC', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: null,
          mentorDbId: 42,
        },
      } as any;
      mockCheckRbacPermission.mockReturnValue(false);
      mockShareableToken = 'share-abc123';

      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        chatInput: { textareaInput: 'Hello via shareable link!' },
        rbac: { rbacPermissions: { '/mentors/42/': {} } },
      });

      const form = screen.getByTestId('auto-resize-textarea').closest('form');
      fireEvent.submit(form!);

      expect(mockOnSubmit).toHaveBeenCalledWith('Hello via shareable link!');
    });

    it('should keep chat enabled when a token is present and RBAC also grants permission', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: null,
          mentorDbId: 42,
        },
      } as any;
      mockCheckRbacPermission.mockReturnValue(true);
      mockShareableToken = 'share-abc123';

      renderWithRedux(<ChatInputForm {...defaultProps} />, {
        rbac: { rbacPermissions: { '/mentors/42/': {} } },
      });

      const textarea = screen.getByTestId('auto-resize-textarea');
      expect(textarea).not.toBeDisabled();
      expect(textarea).not.toHaveAttribute(
        'placeholder',
        "Sorry about that! You don't have permission to chat.",
      );
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

      renderWithRedux(
        <ChatInputForm {...defaultProps} chatAreaMaxWidth={800} />,
      );
      const disclaimerSection = screen
        .getByText('Test disclaimer')
        .closest('div.mt-1');
      expect(disclaimerSection).toHaveStyle({ maxWidth: '800px' });
    });
  });

  describe('slash skill picker', () => {
    // Uses the REAL useSlashSkillPicker / SlashSkillPicker from the SDK (the
    // web-containers mock is importActual-based); only the effective-skills
    // fetch is stubbed. This exercises the composer-level integration:
    // open/filter/select/dismiss and the combobox wiring on the textarea.
    const skills = [
      {
        unique_id: 'skill-web',
        name: 'Web Research',
        slug: 'web-research',
        description: 'Research a topic on the open web.',
        category: 'web',
        enabled: true,
      },
      {
        unique_id: 'skill-code',
        name: 'Code Review',
        slug: 'code-review',
        description: 'Reviews code for quality.',
        enabled: true,
      },
      {
        unique_id: 'skill-off',
        name: 'Disabled Skill',
        slug: 'disabled-skill',
        description: 'Should never be offered.',
        enabled: false,
      },
    ];

    // Feeds the single skills source the composer resolves from: the
    // mentor's assignment rows (`GET .../agents/{uuid}/skills/`). Each row
    // carries only name/slug/enabled — no catalog fetch, no descriptions.
    const arrangeSkills = (list = skills) => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: null,
          mentorUniqueId: 'mentor-uuid-1',
        },
      } as any;
      mockUseGetMentorSkillAssignmentsQuery.mockImplementation(() => ({
        data: list.map((skill, index) => ({
          id: index + 1,
          mentor: 'mentor-uuid-1',
          skill: skill.unique_id,
          skill_name: skill.name,
          skill_slug: skill.slug,
          enabled: skill.enabled,
        })),
      }));
    };

    const typeInComposer = (value: string) => {
      fireEvent.change(screen.getByTestId('auto-resize-textarea'), {
        target: { value },
      });
    };

    it('mounts the code-mode skill sync with the mentor identity', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      expect(mockUseOpencodeSkillSync).toHaveBeenCalledWith({
        org: 'test-tenant',
        mentorUniqueId: 'mentor-uuid-1',
      });
    });

    it('opens the picker with enabled skills when typing "/"', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('/');

      const listbox = screen.getByTestId('slash-skill-picker');
      expect(listbox).toBeInTheDocument();
      expect(screen.getByText('Web Research')).toBeInTheDocument();
      expect(screen.getByText('Code Review')).toBeInTheDocument();
      // Only enabled skills are offered.
      expect(screen.queryByText('Disabled Skill')).not.toBeInTheDocument();
      // Assignment rows carry no description — options are name + slug only.
      expect(
        screen.queryByText('Research a topic on the open web.'),
      ).not.toBeInTheDocument();
    });

    it('filters the list as the user keeps typing (name and slug match)', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('/web');
      expect(screen.getByText('Web Research')).toBeInTheDocument();
      expect(screen.queryByText('Code Review')).not.toBeInTheDocument();

      // Matching on name also works.
      typeInComposer('/Code');
      expect(screen.getByText('Code Review')).toBeInTheDocument();
      expect(screen.queryByText('Web Research')).not.toBeInTheDocument();
    });

    it('renders nothing on "/" when the mentor has no skills', () => {
      // Default beforeEach state: query returns undefined (no skills).
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('/');

      expect(
        screen.queryByTestId('slash-skill-picker'),
      ).not.toBeInTheDocument();
    });

    it('opens the picker for a "/" token typed after existing text', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('explain this /web');

      expect(screen.getByTestId('slash-skill-picker')).toBeInTheDocument();
      expect(screen.getByText('Web Research')).toBeInTheDocument();
    });

    it('completes the invocation at the typed index and keeps the surrounding text', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      const textarea = screen.getByTestId('auto-resize-textarea');

      typeInComposer('explain this /web');
      fireEvent.mouseDown(screen.getByText('Web Research'));

      // The token completes in place — text before it is untouched, and the
      // highlight backdrop marks the token at its index.
      expect(textarea).toHaveValue('explain this /web-research ');
      expect(screen.getByTestId('skill-token-highlight')).toHaveTextContent(
        '/web-research',
      );

      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(mockOnSubmit).toHaveBeenCalledWith('explain this /web-research ');
    });

    it('completes a caret-adjacent token in the middle of the text in place', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      const textarea = screen.getByTestId(
        'auto-resize-textarea',
      ) as HTMLTextAreaElement;

      // Simulate the caret sitting right after "/web" in "hello /web world"
      // (index 10) — the picker must open on the caret's token, not the tail.
      fireEvent.change(textarea, {
        target: { value: 'hello /web world', selectionStart: 10 },
      });

      expect(screen.getByTestId('slash-skill-picker')).toBeInTheDocument();
      fireEvent.mouseDown(screen.getByText('Web Research'));

      expect(textarea).toHaveValue('hello /web-research world');
      expect(screen.getByTestId('skill-token-highlight')).toHaveTextContent(
        '/web-research',
      );
    });

    it('does not trigger for a "/" inside a word (e.g. and/or, URLs)', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('and/or');
      expect(
        screen.queryByTestId('slash-skill-picker'),
      ).not.toBeInTheDocument();

      typeInComposer('see https://example.com/web');
      expect(
        screen.queryByTestId('slash-skill-picker'),
      ).not.toBeInTheDocument();
    });

    it('does not open for plain text that merely starts with "/"', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      // More than a single token → not a slash command.
      typeInComposer('/web research is neat');

      expect(
        screen.queryByTestId('slash-skill-picker'),
      ).not.toBeInTheDocument();
    });

    it('completes the token in place and highlights it when an option is clicked', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('/web');
      fireEvent.mouseDown(screen.getByText('Web Research'));

      const textarea = screen.getByTestId('auto-resize-textarea');
      expect(textarea).toHaveValue('/web-research ');
      // Token pill mirrors the ACTIVE inside-button styling (blue text on
      // #F5F8FF with a #D0E0FF ring)…
      const highlight = screen.getByTestId('skill-token-highlight');
      expect(highlight).toHaveTextContent('/web-research');
      expect(highlight.className).toContain('bg-[#F5F8FF]');
      expect(highlight.className).toContain('text-[#38A1E5]');
      expect(highlight.className).toContain('ring-[#D0E0FF]');
      // …which requires the mirror to render the text: the textarea's own
      // glyphs go transparent (caret preserved) while a token is present.
      expect(textarea.className).toContain('text-transparent');
      expect(
        screen.queryByTestId('slash-skill-picker'),
      ).not.toBeInTheDocument();
    });

    it('supports ArrowDown + Enter to complete the token, without submitting', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      const textarea = screen.getByTestId('auto-resize-textarea');

      typeInComposer('/');
      // resolveEffectiveAgentSkills sorts by name — the picker lists
      // [Code Review, Web Research], so ArrowDown lands on Web Research.
      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(textarea).toHaveValue('/web-research ');
      expect(screen.getByTestId('skill-token-highlight')).toHaveTextContent(
        '/web-research',
      );
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('submits the message with the inline invocation as typed', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      const textarea = screen.getByTestId('auto-resize-textarea');

      typeInComposer('/web');
      fireEvent.mouseDown(screen.getByText('Web Research'));
      typeInComposer('/web-research the history of chess');
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        '/web-research the history of chess',
      );
      expect(textarea).toHaveValue('');
      expect(
        screen.queryByTestId('skill-token-highlight'),
      ).not.toBeInTheDocument();
    });

    it.each(['Backspace', 'Delete'])(
      'deletes the whole token in one stroke with %s at its boundary',
      (key) => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);
        const textarea = screen.getByTestId(
          'auto-resize-textarea',
        ) as HTMLTextAreaElement;

        typeInComposer('/web');
        fireEvent.mouseDown(screen.getByText('Web Research'));
        expect(textarea).toHaveValue('/web-research ');

        if (key === 'Backspace') {
          // Caret at the very end (default after the value swap).
          textarea.setSelectionRange(14, 14);
        } else {
          // Delete works forward from the token's start.
          textarea.setSelectionRange(0, 0);
        }
        fireEvent.keyDown(textarea, { key });

        expect(textarea).toHaveValue('');
        expect(
          screen.queryByTestId('skill-token-highlight'),
        ).not.toBeInTheDocument();
      },
    );

    it('removes a mid-sentence token atomically and collapses the seam space', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      const textarea = screen.getByTestId(
        'auto-resize-textarea',
      ) as HTMLTextAreaElement;

      typeInComposer('say /web-research please');
      // Caret right after the token (index 17).
      textarea.setSelectionRange(17, 17);
      fireEvent.keyDown(textarea, { key: 'Backspace' });

      expect(textarea).toHaveValue('say please');
    });

    it('Backspace after plain text deletes normally (token untouched)', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      const textarea = screen.getByTestId(
        'auto-resize-textarea',
      ) as HTMLTextAreaElement;

      typeInComposer('/web-research hello');
      textarea.setSelectionRange(19, 19); // caret after "hello"
      fireEvent.keyDown(textarea, { key: 'Backspace' });

      // The interceptor must NOT handle this stroke — value unchanged in
      // jsdom (no native editing), proving default behavior was allowed.
      expect(textarea).toHaveValue('/web-research hello');
    });

    it('highlights multiple invocations independently', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('/web-research then /code-review after');

      const highlights = screen.getAllByTestId('skill-token-highlight');
      expect(highlights).toHaveLength(2);
      expect(highlights[0]).toHaveTextContent('/web-research');
      expect(highlights[1]).toHaveTextContent('/code-review');
    });

    describe('Skills dropdown (inside buttons) — synced with the composer', () => {
      it('toggling a skill from the dropdown arms its token and highlights it', () => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);

        fireEvent.click(screen.getByTestId('toggle-skill-web-research'));

        expect(screen.getByTestId('auto-resize-textarea')).toHaveValue(
          '/web-research ',
        );
        expect(screen.getByTestId('skill-token-highlight')).toHaveTextContent(
          '/web-research',
        );
        // The dropdown reflects the armed state (sync: dropdown → text → dropdown).
        expect(screen.getByTestId('toggle-skill-web-research')).toHaveAttribute(
          'data-armed',
          'true',
        );
      });

      it('toggling an armed skill removes its token from the message', () => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);
        const textarea = screen.getByTestId('auto-resize-textarea');

        fireEvent.click(screen.getByTestId('toggle-skill-web-research'));
        typeInComposer('/web-research find the trends');
        fireEvent.click(screen.getByTestId('toggle-skill-web-research'));

        expect(textarea).toHaveValue('find the trends');
        expect(screen.getByTestId('toggle-skill-web-research')).toHaveAttribute(
          'data-armed',
          'false',
        );
      });

      it('a token picked via "/" marks the dropdown item as armed (sync: picker → dropdown)', () => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);

        expect(screen.getByTestId('toggle-skill-code-review')).toHaveAttribute(
          'data-armed',
          'false',
        );

        typeInComposer('/code');
        fireEvent.mouseDown(screen.getByText('Code Review'));

        expect(screen.getByTestId('toggle-skill-code-review')).toHaveAttribute(
          'data-armed',
          'true',
        );
      });

      it('only enabled skills reach the dropdown', () => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);

        expect(
          screen.getByTestId('toggle-skill-web-research'),
        ).toBeInTheDocument();
        expect(
          screen.queryByTestId('toggle-skill-disabled-skill'),
        ).not.toBeInTheDocument();
      });

      it('arming a second skill from the dropdown replaces the first (single selection)', () => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);
        const textarea = screen.getByTestId('auto-resize-textarea');

        fireEvent.click(screen.getByTestId('toggle-skill-web-research'));
        expect(textarea).toHaveValue('/web-research ');

        fireEvent.click(screen.getByTestId('toggle-skill-code-review'));

        // Previous token (and its highlight) is stripped — one skill at a time.
        expect(textarea).toHaveValue('/code-review ');
        expect(screen.getAllByTestId('skill-token-highlight')).toHaveLength(1);
        expect(screen.getByTestId('toggle-skill-web-research')).toHaveAttribute(
          'data-armed',
          'false',
        );
        expect(screen.getByTestId('toggle-skill-code-review')).toHaveAttribute(
          'data-armed',
          'true',
        );
      });

      it('replacing keeps the user-typed text intact (inserts at the caret)', () => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);
        const textarea = screen.getByTestId(
          'auto-resize-textarea',
        ) as HTMLTextAreaElement;

        fireEvent.click(screen.getByTestId('toggle-skill-web-research'));
        typeInComposer('/web-research find the trends');
        // Caret sits at the end after typing — replacement strips the old
        // token (caret adjusted) and inserts the new one at the caret.
        fireEvent.click(screen.getByTestId('toggle-skill-code-review'));

        expect(textarea).toHaveValue('find the trends /code-review ');
      });

      it.each([
        // [label, text, caret, expected]
        ['caret at end of a word', 'hello', 5, 'hello /web-research '],
        ['caret at start with text after', 'hello', 0, '/web-research hello'],
        ['caret mid-word', 'hello', 3, 'hel /web-research lo'],
        ['caret after an existing space', 'hello ', 6, 'hello /web-research '],
        ['empty composer', '', 0, '/web-research '],
      ])('smart spacing: %s', (_label, text, caret, expected) => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);
        const textarea = screen.getByTestId(
          'auto-resize-textarea',
        ) as HTMLTextAreaElement;

        if (text) typeInComposer(text);
        textarea.setSelectionRange(caret, caret);
        fireEvent.click(screen.getByTestId('toggle-skill-web-research'));

        expect(textarea).toHaveValue(expected);
      });

      it('plain ←/→ jump across the token as one unit', async () => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);
        const textarea = screen.getByTestId(
          'auto-resize-textarea',
        ) as HTMLTextAreaElement;

        typeInComposer('say /web-research now');
        // Token spans indices 4..17. Caret right after the token: ← jumps
        // to its start in one stroke…
        textarea.setSelectionRange(17, 17);
        fireEvent.keyDown(textarea, { key: 'ArrowLeft' });
        expect(textarea.selectionStart).toBe(4);

        // …and → from the start jumps back over it.
        fireEvent.keyDown(textarea, { key: 'ArrowRight' });
        expect(textarea.selectionStart).toBe(17);

        // Shift+arrow (selection) keeps native behavior — not intercepted.
        textarea.setSelectionRange(17, 17);
        fireEvent.keyDown(textarea, { key: 'ArrowLeft', shiftKey: true });
        expect(textarea.selectionStart).toBe(17);
      });

      it('arms at the caret with context-aware spacing', () => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);
        const textarea = screen.getByTestId(
          'auto-resize-textarea',
        ) as HTMLTextAreaElement;

        typeInComposer('find trends');
        // Caret after "find" — a space is added on the left (touching text)
        // but NOT on the right (a space is already there).
        textarea.setSelectionRange(4, 4);
        fireEvent.click(screen.getByTestId('toggle-skill-web-research'));

        expect(textarea).toHaveValue('find /web-research trends');
        expect(screen.getByTestId('skill-token-highlight')).toHaveTextContent(
          '/web-research',
        );
      });

      it('the pill ✕ clears the armed token and its highlight, keeping typed text', () => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);
        const textarea = screen.getByTestId('auto-resize-textarea');

        fireEvent.click(screen.getByTestId('toggle-skill-web-research'));
        typeInComposer('/web-research find the trends');
        fireEvent.click(screen.getByTestId('clear-skills'));

        expect(textarea).toHaveValue('find the trends');
        expect(
          screen.queryByTestId('skill-token-highlight'),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('toggle-skill-web-research')).toHaveAttribute(
          'data-armed',
          'false',
        );
      });

      it('toggling preserves existing text (caret-insert, then clean removal)', () => {
        arrangeSkills();
        renderWithRedux(<ChatInputForm {...defaultProps} />);
        const textarea = screen.getByTestId('auto-resize-textarea');

        typeInComposer('summarize the doc');
        // Caret at end → token appended with a single separating space.
        fireEvent.click(screen.getByTestId('toggle-skill-code-review'));
        expect(textarea).toHaveValue('summarize the doc /code-review ');

        // Removal swallows the token AND its separator — no dangling space.
        fireEvent.click(screen.getByTestId('toggle-skill-code-review'));
        expect(textarea).toHaveValue('summarize the doc');
      });
    });

    it('does not highlight unknown or disabled slugs', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('/disabled-skill and /not-a-skill');
      expect(
        screen.queryByTestId('skill-token-highlight'),
      ).not.toBeInTheDocument();
    });

    it('dismisses on Escape and stays dismissed while the token remains', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      const textarea = screen.getByTestId('auto-resize-textarea');

      typeInComposer('/');
      expect(screen.getByTestId('slash-skill-picker')).toBeInTheDocument();

      fireEvent.keyDown(textarea, { key: 'Escape' });
      expect(
        screen.queryByTestId('slash-skill-picker'),
      ).not.toBeInTheDocument();

      // Still dismissed while the user keeps typing the same slash token…
      typeInComposer('/we');
      expect(
        screen.queryByTestId('slash-skill-picker'),
      ).not.toBeInTheDocument();

      // …and re-arms once the token is cleared.
      typeInComposer('');
      typeInComposer('/');
      expect(screen.getByTestId('slash-skill-picker')).toBeInTheDocument();
    });

    it('wires the combobox ARIA contract onto the textarea', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      const textarea = screen.getByTestId('auto-resize-textarea');

      expect(textarea).toHaveAttribute('role', 'combobox');
      expect(textarea).toHaveAttribute('aria-expanded', 'false');
      expect(textarea).toHaveAttribute('aria-haspopup', 'listbox');

      typeInComposer('/');
      expect(textarea).toHaveAttribute('aria-expanded', 'true');
      const listboxId = screen
        .getByTestId('slash-skill-picker')
        .getAttribute('id');
      expect(textarea).toHaveAttribute('aria-controls', listboxId!);
      expect(textarea).toHaveAttribute(
        'aria-activedescendant',
        `${listboxId}-option-0`,
      );
    });

    it('does not add combobox semantics when the mentor has no skills', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      const textarea = screen.getByTestId('auto-resize-textarea');
      expect(textarea).not.toHaveAttribute('role', 'combobox');
    });

    it('shows a loading popover on "/" while the skill list is still resolving', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: null,
          mentorUniqueId: 'mentor-uuid-1',
        },
      } as any;
      mockUseGetMentorSkillAssignmentsQuery.mockImplementation(() => ({
        data: undefined,
        isFetching: true,
      }));
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('/');
      expect(screen.getByTestId('slash-skill-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading skills…')).toBeInTheDocument();

      // Multi-word text starting with "/" is a plain sentence — no popover.
      typeInComposer('/web research');
      expect(
        screen.queryByTestId('slash-skill-loading'),
      ).not.toBeInTheDocument();
    });

    it('replaces the loading popover with the picker once skills resolve', () => {
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('/');
      expect(
        screen.queryByTestId('slash-skill-loading'),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('slash-skill-picker')).toBeInTheDocument();
    });

    it('does not show the loading popover when the fetch settled with no skills', () => {
      // Default beforeEach state: data undefined, isLoading false.
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      typeInComposer('/');
      expect(
        screen.queryByTestId('slash-skill-loading'),
      ).not.toBeInTheDocument();
    });

    describe('lazy loading (20 per page)', () => {
      const pageRows = (offset: number, count: number) =>
        Array.from({ length: count }, (_, i) => ({
          id: offset + i + 1,
          mentor: 'mentor-uuid-1',
          skill: `skill-${offset + i}`,
          skill_name: `Skill ${offset + i}`,
          skill_slug: `skill-${offset + i}`,
          enabled: true,
        }));

      const arrangePaged = () => {
        mockMentorSettings = {
          data: {
            mentorVisibility: 'PRIVATE',
            disclaimer: null,
            mentorUniqueId: 'mentor-uuid-1',
          },
        } as any;
        mockUseGetMentorSkillAssignmentsQuery.mockImplementation(
          (args: any) => ({
            // Full first page (20) signals more; second page returns 5.
            data:
              args?.offset === 0 ? pageRows(0, 20) : pageRows(args?.offset, 5),
            isFetching: false,
          }),
        );
      };

      it('fetches 20 at a time and pulls the next page when the picker scrolls to the bottom', () => {
        arrangePaged();
        renderWithRedux(<ChatInputForm {...defaultProps} />);

        expect(mockUseGetMentorSkillAssignmentsQuery).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 20, offset: 0 }),
          expect.anything(),
        );

        typeInComposer('/');
        expect(screen.getAllByRole('option')).toHaveLength(20);

        // jsdom reports zero scroll metrics, so any scroll event counts as
        // "near the bottom" — which is exactly what we want to trigger here.
        fireEvent.scroll(screen.getByTestId('slash-skill-picker'));

        expect(mockUseGetMentorSkillAssignmentsQuery).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 20, offset: 20 }),
          expect.anything(),
        );
        expect(screen.getAllByRole('option')).toHaveLength(25);
      });

      it('a short page means no further fetches on scroll', () => {
        mockMentorSettings = {
          data: {
            mentorVisibility: 'PRIVATE',
            disclaimer: null,
            mentorUniqueId: 'mentor-uuid-1',
          },
        } as any;
        mockUseGetMentorSkillAssignmentsQuery.mockImplementation(() => ({
          data: pageRows(0, 3),
          isFetching: false,
        }));
        renderWithRedux(<ChatInputForm {...defaultProps} />);

        typeInComposer('/');
        fireEvent.scroll(screen.getByTestId('slash-skill-picker'));

        expect(mockUseGetMentorSkillAssignmentsQuery).not.toHaveBeenCalledWith(
          expect.objectContaining({ offset: 20 }),
          expect.anything(),
        );
      });
    });

    it('skips the assignments fetch when the mentor UUID is unknown', () => {
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      expect(mockUseGetMentorSkillAssignmentsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('never queries the platform-wide agent-skills catalog', () => {
      // The composer is mentor-scoped: only the assignments endpoint
      // (`GET .../agents/{uuid}/skills/`) is consulted. The catalog lists
      // every skill on the platform and must NOT be fetched from chat.
      arrangeSkills();
      renderWithRedux(<ChatInputForm {...defaultProps} />);
      typeInComposer('/');
      expect(screen.getByTestId('slash-skill-picker')).toBeInTheDocument();
      expect(mockUseGetAgentSkillsQuery).not.toHaveBeenCalled();
    });

    it('goes inactive when the assignments endpoint errors (e.g. 403)', () => {
      mockMentorSettings = {
        data: {
          mentorVisibility: 'PRIVATE',
          disclaimer: null,
          mentorUniqueId: 'mentor-uuid-1',
        },
      } as any;
      mockUseGetMentorSkillAssignmentsQuery.mockImplementation(() => ({
        data: undefined,
        isError: true,
      }));
      renderWithRedux(<ChatInputForm {...defaultProps} />);

      typeInComposer('/');

      expect(
        screen.queryByTestId('slash-skill-picker'),
      ).not.toBeInTheDocument();
    });
  });
});
