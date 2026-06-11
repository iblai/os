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

import { SettingsTab } from './settings-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockEditMentor = vi.fn();
const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockGetMentorSettingsQuery = vi.fn();
const mockGetMentorCategoriesQuery = vi.fn();
const mockGetClawMentorConfigQuery = vi.fn();
const mockUpdateClawConfig = vi.fn();
const mockUsername = 'testuser';
const mockExecuteWithTrialCheck = vi.fn();
const mockCloseModal = vi.fn();
const mockUseShowFreeTrialDialog = vi.fn();

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => mockUseShowFreeTrialDialog(),
}));

const mockEditMentorLoading = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useEditMentorMutation: () => [
    mockEditMentor,
    { isLoading: mockEditMentorLoading() },
  ],
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockGetMentorSettingsQuery(...args),
  useGetMentorCategoriesQuery: (...args: unknown[]) =>
    mockGetMentorCategoriesQuery(...args),
  useGetClawMentorConfigQuery: (...args: unknown[]) =>
    mockGetClawMentorConfigQuery(...args),
  useUpdateClawMentorConfigMutation: () => [mockUpdateClawConfig, {}],
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('next/dynamic', () => {
  let counter = 0;
  return {
    default: () => {
      const index = counter++;
      if (index === 0) {
        // DeleteMentorModal
        function MockDeleteMentorModal(props: any) {
          if (!props.isOpen) return null;
          return (
            <div data-testid="delete-mentor-modal">
              <button onClick={props.onClose}>Close</button>
            </div>
          );
        }
        return MockDeleteMentorModal;
      }
      // CopyMentorModal
      function MockCopyMentorModal(props: any) {
        return (
          <div data-testid="copy-mentor-modal">
            <button onClick={props.onClose}>Close Copy</button>
          </div>
        );
      }
      return MockCopyMentorModal;
    },
  };
});

vi.mock('next/image', () => ({
  default: (props: any) => <img alt="" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, type, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      type={type}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, disabled, ...props }: any) => (
    <input value={value} onChange={onChange} disabled={disabled} {...props} />
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, disabled, ...props }: any) => (
    <textarea
      value={value}
      onChange={onChange}
      disabled={disabled}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
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

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <div data-testid="select-root" data-value={value} data-disabled={disabled}>
      {React.Children.map(children, (child: any) =>
        React.isValidElement(child)
          ? React.cloneElement(child as any, { onValueChange })
          : child,
      )}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value, ...props }: any) => {
    // Access onValueChange from parent context via props
    return (
      <div data-testid={`select-item-${value}`} data-value={value} {...props}>
        {children}
      </div>
    );
  },
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandInput: (props: any) => <input {...props} />,
  CommandList: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandItem: ({ children, value, onSelect, ...props }: any) => (
    <div
      onClick={() => onSelect(value)}
      data-testid={`category-item-${value}`}
      {...props}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

// Mutable RBAC switch shared by the config + withPermissions mocks so tests
// can flip field-level permission gating on per-case. Hoisted so it exists
// before the (hoisted) vi.mock factories below run.
const rbacState = vi.hoisted(() => ({ enabled: false }));

// Mirror the essential WithFormPermissions behaviour: a present permission
// entry's `write` flag is authoritative regardless of the RBAC config flag, so
// an explicit `write:false` always disables the control. Fields the map omits
// stay enabled here (matching the previous passthrough mock) so object-level
// Save/Delete gating is unaffected.
vi.mock('@/hoc/withPermissions', () => ({
  default: ({ name, permissions, children }: any) => {
    const entry = permissions?.[name];
    const disabled = entry ? entry.write !== true : false;
    return children({ disabled, canDelete: true });
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/lib/config', () => ({
  config: {
    mainTenantKey: () => 'main',
    iblTemplateMentor: () => 'ai-mentor',
    environment: () => 'test',
    enableRBAC: () => rbacState.enabled,
  },
}));

// ============================================================================
// TEST DATA
// ============================================================================

const defaultCategories = [
  { id: 1, name: 'Education' },
  { id: 2, name: 'Science' },
  { id: 3, name: 'Technology' },
];

const defaultMentorSettings = {
  mentor_name: 'Test Mentor',
  mentor_description: 'A test mentor description',
  categories: [{ id: 1, name: 'Education' }],
  profile_image: 'https://example.com/image.png',
  mentor_visibility: 'viewable_by_anyone',
  allow_anonymous: true,
  show_attachment: true,
  show_voice_call: true,
  show_voice_record: false,
  is_lti_accessible: false,
  forkable: true,
  forkable_with_training_data: true,
  show_reasoning: false,
  permissions: {
    field: {
      mentor_name: { read: true, write: true },
      mentor_description: { read: true, write: true },
      profile_image: { read: true, write: true },
      mentor_visibility: { read: true, write: true },
      metadata: { read: true, write: true },
      allow_anonymous: { read: true, write: true },
      is_lti_accessible: { read: true, write: true },
      show_attachment: { read: true, write: true },
      show_voice_call: { read: true, write: true },
      show_voice_record: { read: true, write: true },
    },
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe('SettingsTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    rbacState.enabled = false;

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockEditMentor.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockEditMentorLoading.mockReturnValue(false);
    mockExecuteWithTrialCheck.mockImplementation(async (callback) => {
      await callback();
    });

    mockUseShowFreeTrialDialog.mockReturnValue({
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      isModalOpen: false,
      FreeTrialDialog: null,
      closeModal: mockCloseModal,
    });

    mockGetMentorCategoriesQuery.mockReturnValue({
      data: defaultCategories,
      isLoading: false,
    });

    mockGetMentorSettingsQuery.mockReturnValue({
      data: defaultMentorSettings,
      isLoading: false,
    });

    // Default: no claw-config wired (404 → null) so the save short-circuit
    // does not call updateClawConfig. Tests that need a wired config override
    // this in their own arrangements.
    mockGetClawMentorConfigQuery.mockReturnValue({ data: null });
    mockUpdateClawConfig.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders the settings tab with title and description', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(
        screen.getByText(
          "Configure your agent's basic settings and preferences.",
        ),
      ).toBeInTheDocument();
    });

    it('renders Name field with mentor name', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Mentor')).toBeInTheDocument();
    });

    it('renders Description field with mentor description', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('A test mentor description'),
      ).toBeInTheDocument();
    });

    it('renders Category field', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getAllByText('Education').length).toBeGreaterThanOrEqual(1);
    });

    it('renders Who Can View field', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Who Can View?')).toBeInTheDocument();
    });

    it('renders Who Can Chat field', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Who Can Chat?')).toBeInTheDocument();
    });

    it('renders LTI Accessible toggle', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Allow LTI launches')).toBeInTheDocument();
    });

    it('renders File Attachments toggle', () => {
      render(<SettingsTab />);

      expect(
        screen.getByText('Allow file attachments in chat'),
      ).toBeInTheDocument();
    });

    it('renders Voice Calls toggle', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Enable voice calls')).toBeInTheDocument();
    });

    it('renders Voice Recordings toggle', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Enable voice recordings')).toBeInTheDocument();
    });

    it('renders Image upload section', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Image')).toBeInTheDocument();
    });

    it('renders Save button', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('renders Delete button', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  describe('Tooltip buttons do not submit form', () => {
    it('tooltip triggers have type="button" to prevent form submission', () => {
      render(<SettingsTab />);

      // "More info about chat access" is shared by Who Can View and Who Can Chat
      const chatAccessTriggers = screen.getAllByLabelText(
        'More info about chat access',
      );
      const otherTriggers = [
        screen.getByLabelText('More info about allow lti launches'),
        screen.getByLabelText('More info about allow file attachments in chat'),
        screen.getByLabelText('More info about enable voice calls'),
        screen.getByLabelText('More info about enable voice recordings'),
      ];

      [...chatAccessTriggers, ...otherTriggers].forEach((trigger) => {
        expect(trigger).toHaveAttribute('type', 'button');
      });
    });

    it('clicking tooltip triggers does not call editMentor', async () => {
      render(<SettingsTab />);

      const chatAccessTriggers = screen.getAllByLabelText(
        'More info about chat access',
      );
      fireEvent.click(chatAccessTriggers[0]);
      fireEvent.click(chatAccessTriggers[1]);

      await waitFor(() => {
        expect(mockEditMentor).not.toHaveBeenCalled();
      });
    });

    it('clicking LTI Accessible tooltip does not call editMentor', async () => {
      render(<SettingsTab />);

      const tooltipTrigger = screen.getByLabelText(
        'More info about allow lti launches',
      );
      fireEvent.click(tooltipTrigger);

      await waitFor(() => {
        expect(mockEditMentor).not.toHaveBeenCalled();
      });
    });

    it('clicking File Attachments tooltip does not call editMentor', async () => {
      render(<SettingsTab />);

      const tooltipTrigger = screen.getByLabelText(
        'More info about allow file attachments in chat',
      );
      fireEvent.click(tooltipTrigger);

      await waitFor(() => {
        expect(mockEditMentor).not.toHaveBeenCalled();
      });
    });

    it('clicking Voice Calls tooltip does not call editMentor', async () => {
      render(<SettingsTab />);

      const tooltipTrigger = screen.getByLabelText(
        'More info about enable voice calls',
      );
      fireEvent.click(tooltipTrigger);

      await waitFor(() => {
        expect(mockEditMentor).not.toHaveBeenCalled();
      });
    });

    it('clicking Voice Recordings tooltip does not call editMentor', async () => {
      render(<SettingsTab />);

      const tooltipTrigger = screen.getByLabelText(
        'More info about enable voice recordings',
      );
      fireEvent.click(tooltipTrigger);

      await waitFor(() => {
        expect(mockEditMentor).not.toHaveBeenCalled();
      });
    });
  });

  describe('Form Submission', () => {
    it('submits form when Save button is clicked', async () => {
      render(<SettingsTab />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            mentor: 'test-mentor',
            org: 'test-tenant',
            userId: 'testuser',
          }),
        );
      });
    });

    it('shows success toast when form submission succeeds', async () => {
      render(<SettingsTab />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Agent updated successfully',
        );
      });
    });

    it('shows error toast when form submission fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockEditMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Update failed')),
      });

      render(<SettingsTab />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update agent');
      });

      consoleSpy.mockRestore();
    });

    it('shows Saving... text while submitting', () => {
      mockEditMentorLoading.mockReturnValue(true);

      render(<SettingsTab />);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('Switch Toggles', () => {
    it('reflects show_attachment checked state', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Allow file attachments in chat');
      expect(toggle).toBeChecked();
    });

    it('reflects show_voice_call checked state', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Enable voice calls');
      expect(toggle).toBeChecked();
    });

    it('reflects show_voice_record unchecked state', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Enable voice recordings');
      expect(toggle).not.toBeChecked();
    });

    it('reflects is_lti_accessible unchecked state', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Allow LTI launches');
      expect(toggle).not.toBeChecked();
    });

    it('toggles show_attachment switch', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Allow file attachments in chat');
      fireEvent.click(toggle);

      expect(
        screen.getByLabelText('Allow file attachments in chat'),
      ).not.toBeChecked();
    });

    it('toggles show_voice_call switch', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Enable voice calls');
      fireEvent.click(toggle);

      expect(screen.getByLabelText('Enable voice calls')).not.toBeChecked();
    });

    it('toggles show_voice_record switch', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Enable voice recordings');
      fireEvent.click(toggle);

      expect(screen.getByLabelText('Enable voice recordings')).toBeChecked();
    });

    it('toggles is_lti_accessible switch', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Allow LTI launches');
      fireEvent.click(toggle);

      expect(screen.getByLabelText('Allow LTI launches')).toBeChecked();
    });
  });

  describe('Memory toggle', () => {
    it('renders the Memory switch as disabled when enable_memory_component is unset', () => {
      render(<SettingsTab />);

      expect(
        screen.getByLabelText('Remember past conversations'),
      ).not.toBeChecked();
    });

    it('renders the Memory tooltip describing the agent (not mentor)', () => {
      render(<SettingsTab />);

      expect(
        screen.getByText(
          /Allow this agent to remember and reference information from past conversations\./i,
        ),
      ).toBeInTheDocument();
    });

    it('renders the Memory switch as enabled when enable_memory_component is true', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, enable_memory_component: true },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(
        screen.getByLabelText('Remember past conversations'),
      ).toBeChecked();
    });

    it('does not call editMentor immediately when the Memory toggle is clicked', () => {
      render(<SettingsTab />);

      fireEvent.click(screen.getByLabelText('Remember past conversations'));

      expect(mockEditMentor).not.toHaveBeenCalled();
    });

    it('submits enable_memory_component: true on Save when the user enabled it', async () => {
      render(<SettingsTab />);

      fireEvent.click(screen.getByLabelText('Remember past conversations'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              enable_memory_component: true,
            }),
          }),
        );
      });
    });

    it('submits enable_memory_component: false on Save when the user disabled it', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, enable_memory_component: true },
        isLoading: false,
      });

      render(<SettingsTab />);

      fireEvent.click(screen.getByLabelText('Remember past conversations'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              enable_memory_component: false,
            }),
          }),
        );
      });
    });

    it('omits enable_memory_component on Save when the user did not change it', async () => {
      render(<SettingsTab />);

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });

      const submittedFormData = mockEditMentor.mock.calls[0][0].formData;
      expect(submittedFormData).not.toHaveProperty('enable_memory_component');
    });
  });

  describe('Form Field Changes', () => {
    it('updates mentor name when input changes', () => {
      render(<SettingsTab />);

      const nameInput = screen.getByDisplayValue('Test Mentor');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      expect(screen.getByDisplayValue('New Name')).toBeInTheDocument();
    });

    it('updates mentor description when textarea changes', () => {
      render(<SettingsTab />);

      const descInput = screen.getByDisplayValue('A test mentor description');
      fireEvent.change(descInput, { target: { value: 'New description' } });

      expect(screen.getByDisplayValue('New description')).toBeInTheDocument();
    });

    it('shows validation error when mentor name is cleared', () => {
      render(<SettingsTab />);

      const nameInput = screen.getByDisplayValue('Test Mentor');
      fireEvent.change(nameInput, { target: { value: '' } });

      expect(screen.getByText('Agent name is required')).toBeInTheDocument();
    });

    it('shows validation error when mentor description is cleared', () => {
      render(<SettingsTab />);

      const descInput = screen.getByDisplayValue('A test mentor description');
      fireEvent.change(descInput, { target: { value: '' } });

      expect(
        screen.getByText('Agent description is required'),
      ).toBeInTheDocument();
    });
  });

  describe('Loading and Disabled States', () => {
    it('disables inputs when mentor settings are loading', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: defaultMentorSettings,
        isLoading: true,
      });

      render(<SettingsTab />);

      const nameInput = screen.getByPlaceholderText('Agent Name');
      expect(nameInput).toBeDisabled();
    });

    it('disables inputs when categories are loading', () => {
      mockGetMentorCategoriesQuery.mockReturnValue({
        data: defaultCategories,
        isLoading: true,
      });

      render(<SettingsTab />);

      const nameInput = screen.getByPlaceholderText('Agent Name');
      expect(nameInput).toBeDisabled();
    });

    it('disables Save button when edit mutation is loading', () => {
      mockEditMentorLoading.mockReturnValue(true);

      render(<SettingsTab />);

      const saveButton = screen.getByText('Saving...');
      expect(saveButton).toBeDisabled();
    });

    it('disables switches when loading', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: defaultMentorSettings,
        isLoading: true,
      });

      render(<SettingsTab />);

      const switches = screen.getAllByRole('checkbox');
      switches.forEach((switchEl) => {
        expect(switchEl).toBeDisabled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined mentor settings data', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('handles null mentor settings data', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('handles empty categories list', () => {
      mockGetMentorCategoriesQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('handles mentor with no categories', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, categories: [] },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Select category...')).toBeInTheDocument();
    });

    it('handles mentor with null categories', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, categories: null },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Select category...')).toBeInTheDocument();
    });

    it('handles mentor with no profile image', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, profile_image: '' },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('+ Upload')).toBeInTheDocument();
    });
  });

  describe('getMentorId fallback', () => {
    it('uses getMentorId when it returns a value', () => {
      mockGetMentorId.mockReturnValue('active-mentor-123');

      render(<SettingsTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor: 'active-mentor-123',
        }),
        expect.anything(),
      );
    });

    it('falls back to mentorId from params when getMentorId returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<SettingsTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor: 'test-mentor',
        }),
        expect.anything(),
      );
    });
  });

  describe('Delete Mentor Modal', () => {
    it('opens delete modal when Delete button is clicked', async () => {
      render(<SettingsTab />);

      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('delete-mentor-modal')).toBeInTheDocument();
      });
    });

    it('closes delete modal when close is clicked', async () => {
      render(<SettingsTab />);

      fireEvent.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-mentor-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('delete-mentor-modal'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Free Trial Dialog', () => {
    it('does not render FreeTrialDialog when isModalOpen is false', () => {
      render(<SettingsTab />);

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });

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

      render(<SettingsTab />);

      expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
    });
  });

  describe('Query Parameters', () => {
    it('calls useGetMentorSettingsQuery with correct parameters', () => {
      render(<SettingsTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        {
          mentor: 'test-mentor',
          org: 'test-tenant',
          userId: 'testuser',
        },
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('calls useGetMentorCategoriesQuery with correct parameters', () => {
      render(<SettingsTab />);

      expect(mockGetMentorCategoriesQuery).toHaveBeenCalledWith(
        {
          org: 'test-tenant',
          userId: 'testuser',
        },
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('skips mentor settings query when categories are loading', () => {
      mockGetMentorCategoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<SettingsTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: true,
        }),
      );
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-labels for switches', () => {
      render(<SettingsTab />);

      expect(
        screen.getByLabelText('Allow file attachments in chat'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Enable voice calls')).toBeInTheDocument();
      expect(
        screen.getByLabelText('Enable voice recordings'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Allow LTI launches')).toBeInTheDocument();
    });

    it('has proper region label for settings form content', () => {
      render(<SettingsTab />);

      expect(
        screen.getByLabelText('Settings form content'),
      ).toBeInTheDocument();
    });

    it('has accessible tooltip triggers', () => {
      render(<SettingsTab />);

      expect(
        screen.getByLabelText('More info about allow lti launches'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('More info about allow file attachments in chat'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('More info about enable voice calls'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('More info about enable voice recordings'),
      ).toBeInTheDocument();
    });
  });

  describe('Image Upload', () => {
    it('displays profile image when present', () => {
      render(<SettingsTab />);

      const img = screen.getByRole('img', { name: 'Agent' });
      expect(img).toBeInTheDocument();
    });

    it('shows upload prompt when no image', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, profile_image: null },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('+ Upload')).toBeInTheDocument();
    });

    it('renders remove image button when image is present', () => {
      render(<SettingsTab />);

      expect(screen.getByLabelText('Remove image')).toBeInTheDocument();
    });

    it('removes image when remove button is clicked', () => {
      render(<SettingsTab />);

      const removeButton = screen.getByLabelText('Remove image');
      fireEvent.click(removeButton);

      expect(screen.getByText('+ Upload')).toBeInTheDocument();
    });

    it('clicking the image area triggers file input click', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, profile_image: null },
        isLoading: false,
      });

      render(<SettingsTab />);

      const uploadArea = screen.getByText('+ Upload').closest('div');
      expect(uploadArea).toBeInTheDocument();
      // Click should not throw
      fireEvent.click(uploadArea!);
    });

    it('handles file upload via file input', () => {
      render(<SettingsTab />);

      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // After file upload, the createObjectURL mock should be called for the blob
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('clicking on the image stops propagation', () => {
      render(<SettingsTab />);

      const img = screen.getByRole('img', { name: 'Agent' });
      // Click should not throw and should not open file dialog
      fireEvent.click(img);
    });
  });

  describe('Form submission includes all fields', () => {
    it('submits form with toggled switch values', async () => {
      render(<SettingsTab />);

      // Toggle show_voice_record from false to true
      const toggle = screen.getByLabelText('Enable voice recordings');
      fireEvent.click(toggle);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              show_voice_record: true,
            }),
          }),
        );
      });
    });

    it('submits form with all default field values', async () => {
      render(<SettingsTab />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              mentor_name: 'Test Mentor',
              mentor_description: 'A test mentor description',
              show_attachment: true,
              show_voice_call: true,
              show_voice_record: false,
              is_lti_accessible: false,
              forkable: true,
            }),
          }),
        );
      });
    });
  });

  describe('Copies Toggle', () => {
    it('renders Copies toggle', () => {
      render(<SettingsTab />);

      expect(
        screen.getByText('Allow other admins to clone this agent'),
      ).toBeInTheDocument();
    });

    it('reflects forkable checked state', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText(
        'Allow other admins to clone this agent',
      );
      expect(toggle).toBeChecked();
    });

    it('reflects forkable unchecked state', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, forkable: false },
        isLoading: false,
      });

      render(<SettingsTab />);

      const toggle = screen.getByLabelText(
        'Allow other admins to clone this agent',
      );
      expect(toggle).not.toBeChecked();
    });

    it('toggles forkable switch', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText(
        'Allow other admins to clone this agent',
      );
      fireEvent.click(toggle);

      expect(
        screen.getByLabelText('Allow other admins to clone this agent'),
      ).not.toBeChecked();
    });

    it('submits forkable value when saving', async () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText(
        'Allow other admins to clone this agent',
      );
      fireEvent.click(toggle);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              forkable: false,
            }),
          }),
        );
      });
    });

    it('has tooltip with description', () => {
      render(<SettingsTab />);

      expect(
        screen.getByLabelText(
          'More info about allow other admins to clone this agent',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('Verbose Reasoning Toggle', () => {
    it('renders Verbose Reasoning toggle', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Verbose Reasoning')).toBeInTheDocument();
    });

    it('reflects show_reasoning checked state', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, show_reasoning: true },
        isLoading: false,
      });

      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Verbose reasoning enabled');
      expect(toggle).toBeChecked();
    });

    it('reflects show_reasoning unchecked state', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Verbose reasoning disabled');
      expect(toggle).not.toBeChecked();
    });

    it('toggles show_reasoning switch', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Verbose reasoning disabled');
      fireEvent.click(toggle);

      expect(screen.getByLabelText('Verbose reasoning enabled')).toBeChecked();
    });

    it('submits show_reasoning value when saving', async () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Verbose reasoning disabled');
      fireEvent.click(toggle);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              show_reasoning: true,
            }),
          }),
        );
      });
    });

    it('has tooltip with description', () => {
      render(<SettingsTab />);

      expect(
        screen.getByLabelText('More info about verbose reasoning'),
      ).toBeInTheDocument();
    });
  });

  describe('Copy Mentor Button', () => {
    it('renders Copy button when mentor is forkable', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('hides Copy button when mentor is not forkable', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, forkable: false },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('opens copy modal when Copy button is clicked', async () => {
      render(<SettingsTab />);

      const copyButton = screen.getByText('Copy');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByTestId('copy-mentor-modal')).toBeInTheDocument();
      });
    });

    it('closes copy modal when close is clicked', async () => {
      render(<SettingsTab />);

      fireEvent.click(screen.getByText('Copy'));

      await waitFor(() => {
        expect(screen.getByTestId('copy-mentor-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close Copy'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('copy-mentor-modal'),
        ).not.toBeInTheDocument();
      });
    });

    it('disables Copy button when loading', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: defaultMentorSettings,
        isLoading: true,
      });

      render(<SettingsTab />);

      const copyButton = screen.getByText('Copy');
      expect(copyButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // ADVANCED SANDBOX (CLAW)
  // ==========================================================================

  describe('Sandbox toggle', () => {
    it('renders the Sandbox toggle', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Enable advanced sandbox')).toBeInTheDocument();
    });

    it('reflects enable_claw=true from mentor settings as checked', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, enable_claw: true },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByLabelText('Enable advanced sandbox')).toBeChecked();
    });

    it('reflects enable_claw=false (or missing) from mentor settings as unchecked', () => {
      render(<SettingsTab />);

      expect(
        screen.getByLabelText('Enable advanced sandbox'),
      ).not.toBeChecked();
    });

    it('toggle is enabled regardless of claw config state (admin intent)', () => {
      render(<SettingsTab />);

      const toggle = screen.getByLabelText('Enable advanced sandbox');
      expect(toggle).not.toBeDisabled();
    });

    it('flipping the toggle does not immediately call editMentor', async () => {
      render(<SettingsTab />);

      fireEvent.click(screen.getByLabelText('Enable advanced sandbox'));

      await waitFor(() => {
        expect(screen.getByLabelText('Enable advanced sandbox')).toBeChecked();
      });
      expect(mockEditMentor).not.toHaveBeenCalled();
    });

    it('on Save, includes enable_claw=true in the editMentor formData when toggled on', async () => {
      render(<SettingsTab />);

      fireEvent.click(screen.getByLabelText('Enable advanced sandbox'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            mentor: 'test-mentor',
            org: 'test-tenant',
            formData: expect.objectContaining({ enable_claw: true }),
          }),
        );
      });
    });

    it('on Save, includes enable_claw=false when toggled off', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, enable_claw: true },
        isLoading: false,
      });

      render(<SettingsTab />);

      fireEvent.click(screen.getByLabelText('Enable advanced sandbox'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({ enable_claw: false }),
          }),
        );
      });
    });

    it('on Save with no toggle change, still passes the current enable_claw value', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, enable_claw: true },
        isLoading: false,
      });

      render(<SettingsTab />);
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({ enable_claw: true }),
          }),
        );
      });
    });
  });

  // ==========================================================================
  // CLAW CONFIG SYNC ON SAVE
  //
  // When the Sandbox toggle changes AND a claw-config exists for the
  // mentor, the save must ALSO PATCH /claw-config to keep `enabled` in sync.
  // When no claw-config exists (the data-layer normalises 404 → null), the
  // PATCH is skipped and only mentor-settings is written.
  // ==========================================================================

  describe('Claw config sync on Save', () => {
    const wiredClawConfig = {
      mentor: 'mentor-uuid-123',
      server: 7,
      server_name: 'sandbox-1',
      enabled: false,
      auto_push: false,
    };

    const settingsWithUuid = {
      ...defaultMentorSettings,
      mentor_unique_id: 'mentor-uuid-123',
    };

    it('queries claw-config with org and mentor_unique_id from mentor settings', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: settingsWithUuid,
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(mockGetClawMentorConfigQuery).toHaveBeenCalledWith(
        { org: 'test-tenant', mentorUniqueId: 'mentor-uuid-123' },
        expect.objectContaining({ skip: false }),
      );
    });

    it('PATCHes claw-config when toggle changed AND claw-config exists', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: settingsWithUuid,
        isLoading: false,
      });
      mockGetClawMentorConfigQuery.mockReturnValue({ data: wiredClawConfig });

      render(<SettingsTab />);

      // Flip OFF → ON, save
      fireEvent.click(screen.getByLabelText('Enable advanced sandbox'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockUpdateClawConfig).toHaveBeenCalledWith({
          org: 'test-tenant',
          mentorUniqueId: 'mentor-uuid-123',
          enabled: true,
        });
      });
    });

    it('PATCHes claw-config with enabled=false when toggle is flipped off', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...settingsWithUuid, enable_claw: true },
        isLoading: false,
      });
      mockGetClawMentorConfigQuery.mockReturnValue({
        data: { ...wiredClawConfig, enabled: true },
      });

      render(<SettingsTab />);

      // Flip ON → OFF, save
      fireEvent.click(screen.getByLabelText('Enable advanced sandbox'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockUpdateClawConfig).toHaveBeenCalledWith({
          org: 'test-tenant',
          mentorUniqueId: 'mentor-uuid-123',
          enabled: false,
        });
      });
    });

    it('does NOT PATCH claw-config when no claw-config exists (404 → null)', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: settingsWithUuid,
        isLoading: false,
      });
      mockGetClawMentorConfigQuery.mockReturnValue({ data: null });

      render(<SettingsTab />);

      fireEvent.click(screen.getByLabelText('Enable advanced sandbox'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });
      expect(mockUpdateClawConfig).not.toHaveBeenCalled();
    });

    it('does NOT PATCH claw-config when toggle value did not change, even with config wired', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: settingsWithUuid,
        isLoading: false,
      });
      mockGetClawMentorConfigQuery.mockReturnValue({ data: wiredClawConfig });

      render(<SettingsTab />);
      // No toggle flip — just save other unchanged form fields
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });
      expect(mockUpdateClawConfig).not.toHaveBeenCalled();
    });

    it('still shows success toast when mentor-settings succeeds but claw PATCH fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGetMentorSettingsQuery.mockReturnValue({
        data: settingsWithUuid,
        isLoading: false,
      });
      mockGetClawMentorConfigQuery.mockReturnValue({ data: wiredClawConfig });
      mockUpdateClawConfig.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('claw boom')),
      });

      render(<SettingsTab />);

      fireEvent.click(screen.getByLabelText('Enable advanced sandbox'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(mockUpdateClawConfig).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          // mentor → agent rename: settings-tab.tsx now emits "Agent
          // updated successfully" via the toast.success call after the
          // editMentor mutation resolves.
          'Agent updated successfully',
        );
      });

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // RBAC field-level permissions
  //
  // When RBAC is enabled, fields the user can only READ must be (1) gated in
  // the UI (the control is disabled) and (2) omitted from the PUT payload so
  // the endpoint doesn't reject the save with
  // "No permission to write field: <name>".
  // ==========================================================================
  describe('RBAC field permissions', () => {
    const withFieldPerms = (overrides: Record<string, any>) => ({
      ...defaultMentorSettings,
      permissions: {
        field: {
          ...defaultMentorSettings.permissions.field,
          ...overrides,
        },
      },
    });

    it('disables the Advanced Sandbox toggle when enable_claw is read-only', () => {
      rbacState.enabled = true;
      mockGetMentorSettingsQuery.mockReturnValue({
        data: withFieldPerms({ enable_claw: { read: true, write: false } }),
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByLabelText('Enable advanced sandbox')).toBeDisabled();
    });

    it('disables the Memory toggle when enable_memory_component is read-only', () => {
      rbacState.enabled = true;
      mockGetMentorSettingsQuery.mockReturnValue({
        data: withFieldPerms({
          enable_memory_component: { read: true, write: false },
        }),
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(
        screen.getByLabelText('Remember past conversations'),
      ).toBeDisabled();
    });

    it('disables the Allow Copies toggle when forkable is read-only', () => {
      rbacState.enabled = true;
      mockGetMentorSettingsQuery.mockReturnValue({
        data: withFieldPerms({ forkable: { read: true, write: false } }),
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(
        screen.getByLabelText('Allow other admins to clone this agent'),
      ).toBeDisabled();
    });

    it('keeps the Advanced Sandbox toggle enabled when enable_claw is writable', () => {
      rbacState.enabled = true;
      mockGetMentorSettingsQuery.mockReturnValue({
        data: withFieldPerms({ enable_claw: { read: true, write: true } }),
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(
        screen.getByLabelText('Enable advanced sandbox'),
      ).not.toBeDisabled();
    });

    it('omits read-only fields from the PUT payload on Save', async () => {
      rbacState.enabled = true;
      mockGetMentorSettingsQuery.mockReturnValue({
        data: withFieldPerms({
          mentor_visibility: { read: true, write: false },
          enable_claw: { read: true, write: false },
        }),
        isLoading: false,
      });

      render(<SettingsTab />);

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });

      const formData = mockEditMentor.mock.calls[0][0].formData;
      expect(formData).not.toHaveProperty('mentor_visibility');
      expect(formData).not.toHaveProperty('enable_claw');
      // Writable fields are still sent.
      expect(formData).toHaveProperty('mentor_name', 'Test Mentor');
      expect(formData).toHaveProperty('allow_anonymous');
    });

    it('keeps writable fields in the PUT payload when RBAC is enabled', async () => {
      rbacState.enabled = true;
      // Default fixture marks mentor_visibility as writable.
      render(<SettingsTab />);

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });

      const formData = mockEditMentor.mock.calls[0][0].formData;
      expect(formData).toHaveProperty(
        'mentor_visibility',
        'viewable_by_anyone',
      );
    });

    it('strips an explicit read-only field from the payload even when the RBAC config flag is off', async () => {
      // The endpoint can return field permissions independently of the
      // NEXT_PUBLIC_ENABLE_RBAC flag. WithFormPermissions still disables a
      // write:false control in that case, so the payload must omit it too —
      // otherwise the save fails with "No permission to write field: ...".
      // rbacState.enabled stays false (reset in beforeEach).
      mockGetMentorSettingsQuery.mockReturnValue({
        data: withFieldPerms({
          mentor_visibility: { read: true, write: false },
        }),
        isLoading: false,
      });

      render(<SettingsTab />);

      // The "Who Can View?" select (mentor_visibility) is the first select and
      // is disabled even with the RBAC flag off.
      expect(screen.getAllByTestId('select-root')[0]).toHaveAttribute(
        'data-disabled',
        'true',
      );

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalled();
      });

      const formData = mockEditMentor.mock.calls[0][0].formData;
      expect(formData).not.toHaveProperty('mentor_visibility');
      // Writable fields are still sent.
      expect(formData).toHaveProperty('mentor_name', 'Test Mentor');
    });
  });
});
