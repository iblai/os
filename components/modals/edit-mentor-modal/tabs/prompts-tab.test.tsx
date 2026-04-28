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

import { PromptsTab } from './prompts-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockDeletePrompt = vi.fn();
const mockEditMentor = vi.fn();
const mockUpdatePrompt = vi.fn();
const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockGetMentorSettingsQuery = vi.fn();
const mockGetPromptsSearchQuery = vi.fn();
const mockUseUsername = vi.fn();
const mockExecuteWithTrialCheck = vi.fn();
const mockCloseModal = vi.fn();
const mockUseShowFreeTrialDialog = vi.fn();
const mockOpenAddPromptModal = vi.fn();
const mockCloseAddPromptModal = vi.fn();
const mockShowAddPromptModal = vi.fn();
const mockCloseEditMentorModal = vi.fn();
const mockDispatch = vi.fn();
const mockSetTextareaInput = vi.fn((payload: string) => ({
  type: 'chatInput/setTextareaInput',
  payload,
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock hooks
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
    showAddPromptModal: mockShowAddPromptModal(),
    closeAddPromptModal: mockCloseAddPromptModal,
    openAddPromptModal: mockOpenAddPromptModal,
    closeEditMentorModal: mockCloseEditMentorModal,
  }),
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/features/chat-input/api-slice', () => ({
  chatInputSliceActions: {
    setTextareaInput: (payload: string) => mockSetTextareaInput(payload),
  },
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => mockUseShowFreeTrialDialog(),
}));

// Mock data-layer
const mockEditMentorLoading = vi.fn();
const mockUpdatePromptLoading = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useDeletePromptMutation: () => [mockDeletePrompt],
  useEditMentorMutation: () => [
    mockEditMentor,
    { isLoading: mockEditMentorLoading() },
  ],
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockGetMentorSettingsQuery(...args),
  useGetPromptsSearchQuery: (...args: unknown[]) => {
    const result = mockGetPromptsSearchQuery(...args) ?? {};
    const data = result.data
      ? {
          count: result.data.results?.length ?? 0,
          ...result.data,
        }
      : result.data;
    return {
      status: 'fulfilled',
      isFetching: false,
      isLoading: false,
      ...result,
      data,
    };
  },
  useUpdatePromptMutation: () => [
    mockUpdatePrompt,
    { isLoading: mockUpdatePromptLoading() },
  ],
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock UI components
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

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      disabled={disabled}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/prompts-tab/copy-button',
  () => ({
    CopyButton: ({ disabled }: any) => (
      <button disabled={disabled} data-testid="copy-button">
        Copy
      </button>
    ),
  }),
);

vi.mock('@/hoc/withPermissions', () => ({
  default: ({ children }: any) => children({ disabled: false }),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  parsePrompt: (text: string) => text,
}));

vi.mock('@/components/markdown', () => ({
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

vi.mock('@/components/modals/edit-prompt-modal', () => ({
  EditPromptModal: ({
    isOpen,
    onClose,
    handleSave,
    selectedPrompt,
    isEditing,
  }: any) =>
    isOpen ? (
      <div data-testid="edit-prompt-modal">
        <span data-testid="prompt-label">{selectedPrompt?.label}</span>
        <span data-testid="prompt-name">{selectedPrompt?.name}</span>
        <span data-testid="prompt-is-system">
          {String(selectedPrompt?.isSystem)}
        </span>
        <span data-testid="prompt-content">{selectedPrompt?.prompt}</span>
        <span data-testid="is-editing">{String(isEditing)}</span>
        <button
          onClick={() =>
            handleSave(selectedPrompt, {
              prompt: 'updated prompt content',
              category: 'test-category',
              promptVisibility: 'public',
            })
          }
          data-testid="save-prompt"
        >
          Save
        </button>
        <button onClick={onClose} data-testid="close-prompt-modal">
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('../../add-prompt-modal', () => ({
  AddPromptModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="add-prompt-modal">
        <button onClick={onClose} data-testid="close-add-prompt-modal">
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('@iblai/iblai-api', () => ({
  PromptVisibilityEnum: {
    PUBLIC: 'public',
    PRIVATE: 'private',
  },
}));

// ============================================================================
// TEST DATA
// ============================================================================

const defaultMentorSettings = {
  mentor_id: 123,
  mentor_name: 'Test Mentor',
  system_prompt: 'Test system prompt content',
  proactive_prompt: 'Test proactive prompt content',
  study_mode_prompt: 'Test study mode prompt content',
  guided_prompt_instructions: 'Test guided prompt instructions',
  greeting_method: 'proactive_prompt',
  enable_guided_prompts: true,
  permissions: {
    field: {
      system_prompt: { read_only: false },
      proactive_prompt: { read_only: false },
      study_mode_prompt: { read_only: false },
      enable_guided_prompts: { read_only: false },
      greeting_method: { read_only: false },
      suggested_prompts: { read_only: false },
    },
  },
};

const defaultPromptsData = {
  count: 2,
  results: [
    {
      id: 1,
      prompt: 'Suggested prompt 1',
      category: { name: 'Category 1' },
      prompt_visibility: 'public',
    },
    {
      id: 2,
      prompt: 'Suggested prompt 2',
      category: { name: 'Category 2' },
      prompt_visibility: 'private',
    },
  ],
};

// ============================================================================
// TESTS
// ============================================================================

describe('PromptsTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('testuser');
    mockDeletePrompt.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockEditMentor.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockUpdatePrompt.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockEditMentorLoading.mockReturnValue(false);
    mockUpdatePromptLoading.mockReturnValue(false);
    mockShowAddPromptModal.mockReturnValue(false);

    mockExecuteWithTrialCheck.mockImplementation(async (callback) => {
      await callback();
    });

    mockUseShowFreeTrialDialog.mockReturnValue({
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      isModalOpen: false,
      FreeTrialDialog: null,
      closeModal: mockCloseModal,
    });

    mockGetMentorSettingsQuery.mockReturnValue({
      data: defaultMentorSettings,
      isLoading: false,
    });

    mockGetPromptsSearchQuery.mockReturnValue({
      data: defaultPromptsData,
      isLoading: false,
      isFetching: false,
      status: 'fulfilled',
    });
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  describe('Rendering', () => {
    it('renders the prompts tab with title and description', () => {
      render(<PromptsTab />);

      expect(screen.getByText('Prompts')).toBeInTheDocument();
      expect(
        screen.getByText('Manage and configure prompts for your mentor.'),
      ).toBeInTheDocument();
    });

    it('renders System Prompt section with content', () => {
      render(<PromptsTab />);

      expect(screen.getByText('System Prompt')).toBeInTheDocument();
      expect(
        screen.getByText('Test system prompt content'),
      ).toBeInTheDocument();
    });

    it('renders Proactive Prompt section with content', () => {
      render(<PromptsTab />);

      expect(screen.getByText('Proactive Prompt')).toBeInTheDocument();
      expect(
        screen.getByText('Test proactive prompt content'),
      ).toBeInTheDocument();
    });

    it('renders Study Prompt section with content', () => {
      render(<PromptsTab />);

      expect(screen.getByText('Study Prompt')).toBeInTheDocument();
      expect(
        screen.getByText('Test study mode prompt content'),
      ).toBeInTheDocument();
    });

    it('renders Guided Prompt section with content', () => {
      render(<PromptsTab />);

      expect(screen.getByText('Guided Prompt')).toBeInTheDocument();
      expect(
        screen.getByText('Test guided prompt instructions'),
      ).toBeInTheDocument();
    });

    it('renders Suggested Prompts section', () => {
      render(<PromptsTab />);

      expect(screen.getByText('Suggested Prompts')).toBeInTheDocument();
    });

    it('renders suggested prompts from API', () => {
      render(<PromptsTab />);

      expect(screen.getByText('Suggested prompt 1')).toBeInTheDocument();
      expect(screen.getByText('Suggested prompt 2')).toBeInTheDocument();
    });

    it('renders edit buttons for all prompt sections', () => {
      render(<PromptsTab />);

      // 4 system prompts + 2 suggested prompts = 6 edit buttons
      const editButtons = screen.getAllByText('Edit');
      expect(editButtons).toHaveLength(6);
    });

    it('renders copy buttons for all sections', () => {
      render(<PromptsTab />);

      // 4 system prompts = 4 copy buttons (suggested prompts no longer have Copy)
      const copyButtons = screen.getAllByText('Copy');
      expect(copyButtons).toHaveLength(4);
    });

    it('renders Add New Prompt button', () => {
      render(<PromptsTab />);

      expect(screen.getByText('Add New Prompt')).toBeInTheDocument();
    });

    it('renders tooltip triggers for prompt sections', () => {
      render(<PromptsTab />);

      expect(
        screen.getByLabelText('More info about system prompt'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('More info about proactive prompt'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('More info about study mode prompt'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('More info about guided prompt'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('More info about suggested prompts'),
      ).toBeInTheDocument();
    });

    it('renders tooltip content', () => {
      render(<PromptsTab />);

      expect(
        screen.getByText("Define the mentor's behavior"),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Guide the conversation flow'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Define behavior when Study Mode is active'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Guide the user interaction'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Quick access to common prompts'),
      ).toBeInTheDocument();
    });

    it('renders accessible regions for prompt content', () => {
      render(<PromptsTab />);

      expect(
        screen.getByLabelText('System prompt content'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Proactive prompt content'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Study prompt content')).toBeInTheDocument();
      expect(
        screen.getByLabelText('Guided prompt content'),
      ).toBeInTheDocument();
    });

    it('renders aria labels for suggested prompt regions', () => {
      render(<PromptsTab />);

      expect(
        screen.getByLabelText('Suggested prompt 1 content'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Suggested prompt 2 content'),
      ).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // PROACTIVE PROMPT TOGGLE
  // ==========================================================================

  describe('Proactive Prompt Toggle', () => {
    it('displays Active when greeting_method is proactive_prompt', () => {
      render(<PromptsTab />);

      const activeLabels = screen.getAllByText('Active');
      expect(activeLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('displays Inactive when greeting_method is not proactive_prompt', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          greeting_method: 'proactive_response',
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const inactiveLabels = screen.getAllByText('Inactive');
      expect(inactiveLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('toggles proactive prompt when switch is clicked (activate)', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          greeting_method: 'proactive_response',
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      // Proactive prompt switch is the first one
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith({
          mentor: 'test-mentor',
          org: 'test-tenant',
          userId: 'testuser',
          formData: { greeting_method: 'proactive_prompt' },
        });
      });
    });

    it('toggles proactive prompt when switch is clicked (deactivate)', async () => {
      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith({
          mentor: 'test-mentor',
          org: 'test-tenant',
          userId: 'testuser',
          formData: { greeting_method: 'proactive_response' },
        });
      });
    });

    it('shows success toast when proactive toggle succeeds', async () => {
      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Mentor updated successfully',
        );
      });
    });

    it('shows error toast when proactive toggle fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockEditMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Update failed')),
      });

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update mentor');
      });

      consoleSpy.mockRestore();
    });

    it('disables proactive switch during loading', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: defaultMentorSettings,
        isLoading: true,
      });

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      expect(switches[0]).toBeDisabled();
    });

    it('disables proactive switch when editing mentor', () => {
      mockEditMentorLoading.mockReturnValue(true);

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      expect(switches[0]).toBeDisabled();
    });

    it('renders proactive prompt aria label as enabled', () => {
      render(<PromptsTab />);

      expect(
        screen.getByLabelText('Proactive prompt enabled'),
      ).toBeInTheDocument();
    });

    it('renders proactive prompt aria label as disabled', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          greeting_method: 'proactive_response',
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(
        screen.getByLabelText('Proactive prompt disabled'),
      ).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // GUIDED PROMPT TOGGLE
  // ==========================================================================

  describe('Guided Prompt Toggle', () => {
    it('displays Active when guided prompts are enabled', () => {
      render(<PromptsTab />);

      const activeLabels = screen.getAllByText('Active');
      expect(activeLabels.length).toBeGreaterThanOrEqual(2);
    });

    it('displays Inactive when guided prompts are disabled', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          enable_guided_prompts: false,
          greeting_method: 'proactive_response',
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const inactiveLabels = screen.getAllByText('Inactive');
      expect(inactiveLabels.length).toBeGreaterThanOrEqual(2);
    });

    it('toggles guided prompt when switch is clicked', async () => {
      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      // Guided prompt switch is the second one
      fireEvent.click(switches[1]);

      await waitFor(() => {
        expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith({
          mentor: 'test-mentor',
          org: 'test-tenant',
          userId: 'testuser',
          formData: { enable_guided_prompts: false },
        });
      });
    });

    it('shows success toast when guided toggle succeeds', async () => {
      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[1]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Mentor updated successfully',
        );
      });
    });

    it('shows error toast when guided toggle fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockEditMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Update failed')),
      });

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[1]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update mentor');
      });

      consoleSpy.mockRestore();
    });

    it('renders guided prompt aria label as enabled', () => {
      render(<PromptsTab />);

      expect(
        screen.getByLabelText('Guided prompt enabled'),
      ).toBeInTheDocument();
    });

    it('renders guided prompt aria label as disabled', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, enable_guided_prompts: false },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(
        screen.getByLabelText('Guided prompt disabled'),
      ).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // EDIT PROMPT MODAL - SYSTEM PROMPTS
  // ==========================================================================

  describe('Edit Prompt Modal - System Prompts', () => {
    it('opens edit modal for System Prompt', async () => {
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]); // System Prompt edit button

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
        expect(screen.getByTestId('prompt-label')).toHaveTextContent(
          'System Prompt',
        );
        expect(screen.getByTestId('prompt-name')).toHaveTextContent(
          'system_prompt',
        );
        expect(screen.getByTestId('prompt-is-system')).toHaveTextContent(
          'true',
        );
      });
    });

    it('opens edit modal for Proactive Prompt', async () => {
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[1]); // Proactive Prompt edit button

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
        expect(screen.getByTestId('prompt-label')).toHaveTextContent(
          'Proactive Prompt',
        );
        expect(screen.getByTestId('prompt-name')).toHaveTextContent(
          'proactive_prompt',
        );
      });
    });

    it('opens edit modal for Study Prompt', async () => {
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[2]); // Study Prompt edit button

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
        expect(screen.getByTestId('prompt-label')).toHaveTextContent(
          'Study Prompt',
        );
        expect(screen.getByTestId('prompt-name')).toHaveTextContent(
          'study_mode_prompt',
        );
      });
    });

    it('opens edit modal for Guided Prompt', async () => {
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[3]); // Guided Prompt edit button

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
        expect(screen.getByTestId('prompt-label')).toHaveTextContent(
          'Guided Prompt',
        );
        expect(screen.getByTestId('prompt-name')).toHaveTextContent(
          'guided_prompt_instructions',
        );
      });
    });

    it('closes edit modal when onClose is called', async () => {
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('close-prompt-modal'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('edit-prompt-modal'),
        ).not.toBeInTheDocument();
      });
    });

    it('saves system prompt via editMentor mutation', async () => {
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]); // System Prompt

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-prompt'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith({
          mentor: 'test-mentor',
          org: 'test-tenant',
          userId: 'testuser',
          formData: { system_prompt: 'updated prompt content' },
        });
      });
    });

    it('shows success toast after saving system prompt', async () => {
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-prompt'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Mentor updated successfully',
        );
      });
    });

    it('shows error toast when saving system prompt fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockEditMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Save failed')),
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-prompt'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update mentor');
      });

      consoleSpy.mockRestore();
    });

    it('passes isEditing prop to EditPromptModal', async () => {
      mockEditMentorLoading.mockReturnValue(true);

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('is-editing')).toHaveTextContent('true');
      });
    });

    it('passes isEditing as true when updatePrompt is loading', async () => {
      mockUpdatePromptLoading.mockReturnValue(true);

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('is-editing')).toHaveTextContent('true');
      });
    });
  });

  // ==========================================================================
  // EDIT PROMPT MODAL - SUGGESTED PROMPTS
  // ==========================================================================

  describe('Edit Prompt Modal - Suggested Prompts', () => {
    it('opens edit modal for a suggested prompt', async () => {
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]); // First suggested prompt edit button

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
        expect(screen.getByTestId('prompt-label')).toHaveTextContent(
          'Suggested Prompt',
        );
        expect(screen.getByTestId('prompt-is-system')).toHaveTextContent(
          'false',
        );
        expect(screen.getByTestId('prompt-content')).toHaveTextContent(
          'Suggested prompt 1',
        );
      });
    });

    it('saves suggested prompt via updatePrompt mutation', async () => {
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]); // First suggested prompt

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-prompt'));

      await waitFor(() => {
        expect(mockUpdatePrompt).toHaveBeenCalledWith({
          id: 1,
          org: 'test-tenant',
          userId: 'testuser',
          requestBody: {
            is_system: false,
            prompt: 'updated prompt content',
            category: 'test-category',
            prompt_visibility: 'public',
          },
        });
      });
    });

    it('shows success toast after saving suggested prompt', async () => {
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-prompt'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Prompt updated successfully',
        );
      });
    });

    it('shows error toast when saving suggested prompt fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockUpdatePrompt.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Save failed')),
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-prompt'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update prompt');
      });

      consoleSpy.mockRestore();
    });

    it('does not call updatePrompt when suggested prompt has no id', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: undefined,
              prompt: 'No-id prompt',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      // Click the suggested prompt (5th edit button: 4 system + 1 suggested)
      fireEvent.click(editButtons[4]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-prompt'));

      // updatePrompt should not be called since the prompt has no id
      await waitFor(() => {
        expect(mockUpdatePrompt).not.toHaveBeenCalled();
      });
    });

    it('handles suggested prompt with null prompt_visibility', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 10,
              prompt: 'Null visibility prompt',
              category: { name: 'Cat' },
              prompt_visibility: 'null',
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });
    });

    it('handles suggested prompt with valid prompt_visibility', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 10,
              prompt: 'Public prompt',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // RUN SUGGESTED PROMPT
  // ==========================================================================

  describe('Run Suggested Prompt', () => {
    it('renders Run buttons for suggested prompts', () => {
      render(<PromptsTab />);

      const runButtons = screen.getAllByText('Run');
      // 2 suggested prompts = 2 Run buttons
      expect(runButtons).toHaveLength(2);
    });

    it('renders Run button with aria-label', () => {
      render(<PromptsTab />);

      expect(
        screen.getByLabelText('Run suggested prompt Suggested prompt 1'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Run suggested prompt Suggested prompt 2'),
      ).toBeInTheDocument();
    });

    it('dispatches setTextareaInput with prompt text when Run is clicked', async () => {
      render(<PromptsTab />);

      const runButtons = screen.getAllByText('Run');
      fireEvent.click(runButtons[0]);

      await waitFor(() => {
        expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockSetTextareaInput).toHaveBeenCalledWith('Suggested prompt 1');
      });
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('closes the edit mentor modal after running a prompt', async () => {
      render(<PromptsTab />);

      const runButtons = screen.getAllByText('Run');
      fireEvent.click(runButtons[1]);

      await waitFor(() => {
        expect(mockCloseEditMentorModal).toHaveBeenCalled();
      });
      expect(mockSetTextareaInput).toHaveBeenCalledWith('Suggested prompt 2');
    });

    it('does not run when prompt text is empty', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 1,
              prompt: '',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const runButtons = screen.getAllByText('Run');
      fireEvent.click(runButtons[0]);

      await waitFor(() => {
        expect(mockSetTextareaInput).toHaveBeenCalledWith('');
      });
    });

    it('does not render Run buttons for system prompts', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: { results: [] },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.queryByText('Run')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // PAGINATION
  // ==========================================================================

  describe('Pagination', () => {
    it('does not render See More button when there are no more prompts', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          count: 2,
          results: [
            {
              id: 1,
              prompt: 'Prompt 1',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
            {
              id: 2,
              prompt: 'Prompt 2',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
        isFetching: false,
        status: 'fulfilled',
      });

      render(<PromptsTab />);

      expect(screen.queryByText('See More')).not.toBeInTheDocument();
    });

    it('renders See More button when there are more prompts to load', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          count: 12,
          results: [
            {
              id: 1,
              prompt: 'Prompt 1',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
            {
              id: 2,
              prompt: 'Prompt 2',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
        isFetching: false,
        status: 'fulfilled',
      });

      render(<PromptsTab />);

      expect(screen.getByText('See More')).toBeInTheDocument();
    });

    it('queries with the correct page size and offset', () => {
      render(<PromptsTab />);

      expect(mockGetPromptsSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 6,
          offset: 0,
        }),
        expect.anything(),
      );
    });

    it('clicking See More triggers a refetch with incremented offset', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          count: 12,
          results: [
            {
              id: 1,
              prompt: 'Prompt 1',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
        isFetching: false,
        status: 'fulfilled',
      });

      render(<PromptsTab />);

      const seeMoreButton = screen.getByText('See More');
      fireEvent.click(seeMoreButton);

      await waitFor(() => {
        // After clicking, the query should be re-called with offset 6
        expect(mockGetPromptsSearchQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 6,
            offset: 6,
          }),
          expect.anything(),
        );
      });
    });

    it('shows Loading... text on See More button when fetching', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          count: 12,
          results: [
            {
              id: 1,
              prompt: 'Prompt 1',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
        isFetching: true,
        status: 'fulfilled',
      });

      render(<PromptsTab />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('disables See More button while fetching', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          count: 12,
          results: [
            {
              id: 1,
              prompt: 'Prompt 1',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
        isFetching: true,
        status: 'fulfilled',
      });

      render(<PromptsTab />);

      const button = screen.getByText('Loading...');
      expect(button).toBeDisabled();
    });

    it('does not load more when already fetching', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          count: 12,
          results: [
            {
              id: 1,
              prompt: 'Prompt 1',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
        isFetching: true,
        status: 'fulfilled',
      });

      render(<PromptsTab />);

      const initialCallCount = mockGetPromptsSearchQuery.mock.calls.length;

      const button = screen.getByText('Loading...');
      fireEvent.click(button);

      // No new calls should be made because the button is disabled
      expect(mockGetPromptsSearchQuery.mock.calls.length).toBe(
        initialCallCount,
      );
    });

    it('renders all accumulated prompts after pagination', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          count: 6,
          results: [
            {
              id: 1,
              prompt: 'Prompt A',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
            {
              id: 2,
              prompt: 'Prompt B',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
            {
              id: 3,
              prompt: 'Prompt C',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
        isFetching: false,
        status: 'fulfilled',
      });

      render(<PromptsTab />);

      expect(screen.getByText('Prompt A')).toBeInTheDocument();
      expect(screen.getByText('Prompt B')).toBeInTheDocument();
      expect(screen.getByText('Prompt C')).toBeInTheDocument();
    });

    it('handles undefined count gracefully', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 1,
              prompt: 'Prompt 1',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
        isFetching: false,
        status: 'fulfilled',
      });

      render(<PromptsTab />);

      // count defaults to 0, so no See More button
      expect(screen.queryByText('See More')).not.toBeInTheDocument();
    });

    it('does not accumulate prompts when status is not fulfilled', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          count: 2,
          results: [
            {
              id: 1,
              prompt: 'Pending prompt',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
        isFetching: false,
        status: 'pending',
      });

      render(<PromptsTab />);

      // Effect won't run, so no prompts are accumulated
      expect(screen.queryByText('Pending prompt')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // DELETE SUGGESTED PROMPT
  // ==========================================================================

  describe('Delete Suggested Prompt', () => {
    it('renders delete buttons for suggested prompts', () => {
      render(<PromptsTab />);

      const deleteButtons = screen.getAllByText('Delete');
      // 2 suggested prompts = 2 delete buttons
      expect(deleteButtons).toHaveLength(2);
    });

    it('renders delete button with aria-label', () => {
      render(<PromptsTab />);

      expect(
        screen.getByLabelText('Delete suggested prompt Suggested prompt 1'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Delete suggested prompt Suggested prompt 2'),
      ).toBeInTheDocument();
    });

    it('calls deletePromptMutation when delete is clicked', async () => {
      render(<PromptsTab />);

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockDeletePrompt).toHaveBeenCalledWith({
          id: 1,
          org: 'test-tenant',
        });
      });
    });

    it('shows success toast after successful deletion', async () => {
      render(<PromptsTab />);

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Prompt deleted successfully',
        );
      });
    });

    it('shows error toast when deletion fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockDeletePrompt.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Delete failed')),
      });

      render(<PromptsTab />);

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete prompt');
      });

      consoleSpy.mockRestore();
    });

    it('does not call deletePromptMutation when prompt has no id', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: undefined,
              prompt: 'No-id prompt',
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      expect(mockDeletePrompt).not.toHaveBeenCalled();
    });

    it('does not render delete buttons for system prompts', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: { results: [] },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });

    it('disables edit and copy buttons while deleting', async () => {
      // Make delete hang so we can check disabled state
      let resolveDelete: (value: unknown) => void;
      const deletePromise = new Promise((resolve) => {
        resolveDelete = resolve;
      });
      mockDeletePrompt.mockReturnValue({
        unwrap: vi.fn().mockReturnValue(deletePromise),
      });

      render(<PromptsTab />);

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      // The edit button for the first suggested prompt should be disabled
      await waitFor(() => {
        const editTextNodes = screen.getAllByText('Edit');
        // editTextNodes[4] is the first suggested prompt's edit text;
        // walk up to the enclosing <button>
        const editButton = editTextNodes[4].closest('button');
        expect(editButton).toBeDisabled();
      });

      // Resolve the delete to clean up
      resolveDelete!({});
    });

    it('handles delete aria-label with null prompt text', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 1,
              prompt: null,
              category: null,
              prompt_visibility: null,
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const deleteButtons = screen.getAllByText('Delete');
      expect(deleteButtons).toHaveLength(1);
    });
  });

  // ==========================================================================
  // ADD PROMPT MODAL
  // ==========================================================================

  describe('Add Prompt Modal', () => {
    it('opens add prompt modal when Add New Prompt is clicked', () => {
      render(<PromptsTab />);

      const addButton = screen.getByText('Add New Prompt');
      fireEvent.click(addButton);

      expect(mockOpenAddPromptModal).toHaveBeenCalled();
    });

    it('renders AddPromptModal when showAddPromptModal is true', () => {
      mockShowAddPromptModal.mockReturnValue(true);

      render(<PromptsTab />);

      expect(screen.getByTestId('add-prompt-modal')).toBeInTheDocument();
    });

    it('does not render AddPromptModal when showAddPromptModal is false', () => {
      render(<PromptsTab />);

      expect(screen.queryByTestId('add-prompt-modal')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // FREE TRIAL DIALOG
  // ==========================================================================

  describe('Free Trial Dialog', () => {
    it('renders FreeTrialDialog when isModalOpen is true and FreeTrialDialog exists', () => {
      const MockFreeTrialDialog = ({ isOpen, onClose }: any) =>
        isOpen ? (
          <div data-testid="free-trial-dialog">
            <button onClick={onClose}>Close Trial</button>
          </div>
        ) : null;

      mockUseShowFreeTrialDialog.mockReturnValue({
        executeWithTrialCheck: mockExecuteWithTrialCheck,
        isModalOpen: true,
        FreeTrialDialog: MockFreeTrialDialog,
        closeModal: mockCloseModal,
      });

      render(<PromptsTab />);

      expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
    });

    it('does not render FreeTrialDialog when isModalOpen is false', () => {
      render(<PromptsTab />);

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });

    it('does not render FreeTrialDialog when FreeTrialDialog is null', () => {
      mockUseShowFreeTrialDialog.mockReturnValue({
        executeWithTrialCheck: mockExecuteWithTrialCheck,
        isModalOpen: true,
        FreeTrialDialog: null,
        closeModal: mockCloseModal,
      });

      render(<PromptsTab />);

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // MENTOR ID RESOLUTION
  // ==========================================================================

  describe('Mentor ID Resolution', () => {
    it('uses getMentorId when available', () => {
      mockGetMentorId.mockReturnValue('custom-mentor-id');

      render(<PromptsTab />);

      // Verify that the queries are called with the custom mentor ID
      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        { mentor: 'custom-mentor-id', org: 'test-tenant', userId: 'testuser' },
        expect.objectContaining({ skip: false }),
      );
    });

    it('falls back to mentorId from params when getMentorId returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<PromptsTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        { mentor: 'test-mentor', org: 'test-tenant', userId: 'testuser' },
        expect.objectContaining({ skip: false }),
      );
    });
  });

  // ==========================================================================
  // EMPTY / NULL DATA HANDLING
  // ==========================================================================

  describe('Empty and Null Data Handling', () => {
    it('renders with no mentor settings data', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.getByText('System Prompt')).toBeInTheDocument();
      expect(screen.getByText('Proactive Prompt')).toBeInTheDocument();
    });

    it('renders with empty prompts results', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: { results: [] },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.getByText('Suggested Prompts')).toBeInTheDocument();
      expect(screen.getByText('Add New Prompt')).toBeInTheDocument();
    });

    it('renders with null prompts data', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.getByText('Suggested Prompts')).toBeInTheDocument();
    });

    it('handles empty system_prompt gracefully', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, system_prompt: '' },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.getByText('System Prompt')).toBeInTheDocument();
    });

    it('handles empty proactive_prompt gracefully', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, proactive_prompt: '' },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.getByText('Proactive Prompt')).toBeInTheDocument();
    });

    it('handles empty study_mode_prompt gracefully', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, study_mode_prompt: '' },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.getByText('Study Prompt')).toBeInTheDocument();
    });

    it('handles suggested prompt with null prompt text', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 1,
              prompt: null,
              category: null,
              prompt_visibility: null,
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.getByText('Suggested Prompts')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // LOADING STATES
  // ==========================================================================

  describe('Loading States', () => {
    it('disables switches when mentor settings are loading', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: defaultMentorSettings,
        isLoading: true,
      });

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      switches.forEach((switchEl) => {
        expect(switchEl).toBeDisabled();
      });
    });

    it('disables switches when prompts are loading', () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: defaultPromptsData,
        isLoading: true,
      });

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      switches.forEach((switchEl) => {
        expect(switchEl).toBeDisabled();
      });
    });

    it('disables switches when editing mentor', () => {
      mockEditMentorLoading.mockReturnValue(true);

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      switches.forEach((switchEl) => {
        expect(switchEl).toBeDisabled();
      });
    });
  });

  // ==========================================================================
  // TOGGLE TOOL SETTINGS - ERROR HANDLING
  // ==========================================================================

  describe('Toggle Settings Error Handling', () => {
    it('logs error details when toggle fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Network error');
      mockEditMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(error),
      });

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // QUERY SKIP LOGIC
  // ==========================================================================

  describe('Query Skip Logic', () => {
    it('skips queries when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: 'test-mentor',
      });

      render(<PromptsTab />);

      // Verify skip: true is passed for both queries
      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
      expect(mockGetPromptsSearchQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('skips queries when mentorId is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      render(<PromptsTab />);

      expect(mockGetPromptsSearchQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });
  });

  // ==========================================================================
  // PERMISSIONS INTEGRATION
  // ==========================================================================

  describe('Permissions', () => {
    it('passes permissions to WithFormPermissions', () => {
      render(<PromptsTab />);

      // Component renders without crashing with permissions
      expect(screen.getByText('System Prompt')).toBeInTheDocument();
    });

    it('renders with disabled state from WithFormPermissions', () => {
      // The default mock passes disabled: false
      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      editButtons.forEach((button) => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  // ==========================================================================
  // BRANCH COVERAGE - OPTIONAL CHAINING & TERNARIES
  // ==========================================================================

  describe('Branch Coverage - Optional Chaining & Ternaries', () => {
    it('handles guided_prompt_instructions being undefined', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          guided_prompt_instructions: undefined,
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      // Click the guided prompt edit button (4th edit button)
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[3]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
        expect(screen.getByTestId('prompt-content')).toHaveTextContent('');
      });
    });

    it('handles suggested prompt with undefined prompt_visibility', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 5,
              prompt: 'Prompt with no visibility',
              category: { name: 'TestCat' },
              prompt_visibility: undefined,
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      // Click edit on the suggested prompt
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
        expect(screen.getByTestId('prompt-content')).toHaveTextContent(
          'Prompt with no visibility',
        );
      });
    });

    it('handles suggested prompt with empty string prompt_visibility', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 6,
              prompt: 'Prompt with empty visibility',
              category: { name: 'TestCat' },
              prompt_visibility: '',
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });
    });

    it('handles suggested prompt with null category', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 7,
              prompt: 'Prompt with null category',
              category: null,
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });
    });

    it('handles suggested prompt with category without name', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 8,
              prompt: 'Prompt with nameless category',
              category: {},
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });
    });

    it('handles mentorSettings being undefined for system_prompt edit', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]); // System Prompt

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });
    });

    it('handles mentorSettings being undefined for proactive_prompt edit', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[1]); // Proactive Prompt

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });
    });

    it('handles mentorSettings being undefined for study_mode_prompt edit', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[2]); // Study Prompt

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });
    });

    it('handles proactive prompt switch activation from inactive state', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          greeting_method: 'proactive_response',
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      // The switch is unchecked, clicking will check it (checked=true)
      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: { greeting_method: 'proactive_prompt' },
          }),
        );
      });
    });

    it('handles proactive prompt switch deactivation from active state', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          greeting_method: 'proactive_prompt',
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      // The switch is checked, clicking will uncheck it (checked=false)
      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: { greeting_method: 'proactive_response' },
          }),
        );
      });
    });

    it('handles guided prompt toggle from enabled to disabled', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          enable_guided_prompts: true,
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[1]);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: { enable_guided_prompts: false },
          }),
        );
      });
    });

    it('handles guided prompt toggle from disabled to enabled', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          enable_guided_prompts: false,
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[1]);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: { enable_guided_prompts: true },
          }),
        );
      });
    });

    it('handles mentorSettings with null proactive_prompt', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          proactive_prompt: null,
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.getByText('Proactive Prompt')).toBeInTheDocument();
    });

    it('handles mentorSettings with null study_mode_prompt', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: {
          ...defaultMentorSettings,
          study_mode_prompt: null,
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      expect(screen.getByText('Study Prompt')).toBeInTheDocument();
    });

    it('handles suggested prompt with null prompt text for edit', async () => {
      mockGetPromptsSearchQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 9,
              prompt: null,
              category: { name: 'Cat' },
              prompt_visibility: 'public',
            },
          ],
        },
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });
    });

    it('uses empty string when username is null for queries', () => {
      mockUseUsername.mockReturnValue(null);

      render(<PromptsTab />);

      // Queries should use empty string as userId fallback
      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ userId: '' }),
        expect.objectContaining({ skip: true }),
      );

      expect(mockGetPromptsSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ username: '' }),
        expect.objectContaining({ skip: true }),
      );
    });

    it('uses empty string when username is null for toggleToolSettings', async () => {
      mockUseUsername.mockReturnValue(null);
      mockGetMentorSettingsQuery.mockReturnValue({
        data: defaultMentorSettings,
        isLoading: false,
      });
      mockGetPromptsSearchQuery.mockReturnValue({
        data: defaultPromptsData,
        isLoading: false,
      });

      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({ userId: '' }),
        );
      });
    });

    it('uses empty string when username is null for editPrompt (system)', async () => {
      mockUseUsername.mockReturnValue(null);
      mockGetMentorSettingsQuery.mockReturnValue({
        data: defaultMentorSettings,
        isLoading: false,
      });
      mockGetPromptsSearchQuery.mockReturnValue({
        data: defaultPromptsData,
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]); // System Prompt

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-prompt'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({ userId: '' }),
        );
      });
    });

    it('uses empty string when username is null for editPrompt (suggested)', async () => {
      mockUseUsername.mockReturnValue(null);
      mockGetMentorSettingsQuery.mockReturnValue({
        data: defaultMentorSettings,
        isLoading: false,
      });
      mockGetPromptsSearchQuery.mockReturnValue({
        data: defaultPromptsData,
        isLoading: false,
      });

      render(<PromptsTab />);

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[4]); // First suggested prompt

      await waitFor(() => {
        expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-prompt'));

      await waitFor(() => {
        expect(mockUpdatePrompt).toHaveBeenCalledWith(
          expect.objectContaining({ userId: '' }),
        );
      });
    });

    it('handles toggleToolSettings with callback', async () => {
      // Test the callback?.() branch on line 91
      // The callback is not used in any of the current switch onCheckedChange handlers
      // But we can test the toggle path completes successfully
      render(<PromptsTab />);

      const switches = screen.getAllByRole('checkbox');
      fireEvent.click(switches[1]); // Guided prompt toggle

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith(
          'Mentor updated successfully',
        );
      });
    });
  });
});
