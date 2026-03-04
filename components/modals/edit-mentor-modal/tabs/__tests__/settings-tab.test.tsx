import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

import { SettingsTab } from '../settings-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockEditMentor = vi.fn();
const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockGetMentorSettingsQuery = vi.fn();
const mockGetMentorCategoriesQuery = vi.fn();
const mockUsername = 'testuser';
const mockExecuteWithTrialCheck = vi.fn();
const mockCloseModal = vi.fn();
const mockUseShowFreeTrialDialog = vi.fn();
const mockCopy = vi.fn();
const mockCopyStatus = vi.fn();
const mockEditMentorLoading = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

// Mock next/dynamic - make dynamic imports synchronous
vi.mock('next/dynamic', () => ({
  default: () => {
    return ({ isOpen, onClose }: any) =>
      isOpen ? (
        <div data-testid="delete-mentor-modal">
          <button onClick={onClose} data-testid="close-delete-modal">
            Cancel
          </button>
        </div>
      ) : null;
  },
}));

// Mock hooks
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

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({
    copy: mockCopy,
    status: mockCopyStatus(),
  }),
}));

// Mock data-layer
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useEditMentorMutation: () => [mockEditMentor, { isLoading: mockEditMentorLoading() }],
  useGetMentorSettingsQuery: (...args: unknown[]) => mockGetMentorSettingsQuery(...args),
  useGetMentorCategoriesQuery: (...args: unknown[]) => mockGetMentorCategoriesQuery(...args),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock WithFormPermissions
const mockWithFormPermissionsCanDelete = vi.fn();

vi.mock('@/hoc/withPermissions', () => ({
  default: ({ children }: any) =>
    children({ disabled: false, canDelete: mockWithFormPermissionsCanDelete() }),
}));

// Mock UI components to avoid Radix UI jsdom issues
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, type, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} type={type} {...props}>
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

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, disabled, placeholder, readOnly, className, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      readOnly={readOnly}
      className={className}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, disabled, placeholder, className, ...props }: any) => (
    <textarea
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className, ...props }: any) => (
    <label className={className} {...props}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <div data-testid="select-root" data-value={value} data-disabled={disabled}>
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { onValueChange, currentValue: value }) : null,
      )}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value, ...props }: any) => (
    <div
      role="option"
      data-value={value}
      onClick={() => {
        // Find parent Select's onValueChange through DOM traversal
        const event = new CustomEvent('select-value', { detail: value, bubbles: true });
        props.ref?.current?.dispatchEvent(event);
      }}
      {...props}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
  PopoverTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandInput: (props: any) => <input data-testid="command-input" {...props} />,
  CommandItem: ({ children, value, onSelect }: any) => (
    <div role="option" data-value={value} onClick={() => onSelect?.(value)}>
      {children}
    </div>
  ),
  CommandList: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const defaultCategories = [
  { id: 1, name: 'Education' },
  { id: 2, name: 'Technology' },
  { id: 3, name: 'Health' },
];

const defaultMentorSettings = {
  mentor_name: 'Test Mentor',
  mentor_description: 'A helpful test mentor description',
  profile_image: 'https://example.com/avatar.jpg',
  mentor_visibility: 'viewable_by_tenant_admins',
  allow_anonymous: true,
  show_attachment: true,
  show_voice_call: true,
  show_voice_record: false,
  is_lti_accessible: false,
  categories: [{ id: 1, name: 'Education' }],
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

    Element.prototype.scrollIntoView = vi.fn();

    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: 'test-mentor' });
    mockGetMentorId.mockReturnValue(null);
    mockEditMentor.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockEditMentorLoading.mockReturnValue(false);
    mockCopyStatus.mockReturnValue('idle');
    mockWithFormPermissionsCanDelete.mockReturnValue(true);

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
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Rendering
  // ==========================================================================
  describe('Rendering', () => {
    it('renders the settings tab with title and description', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(
        screen.getByText("Configure your mentor's basic settings and preferences."),
      ).toBeInTheDocument();
    });

    it('renders the Name field with mentor name', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Mentor')).toBeInTheDocument();
    });

    it('renders the Unique ID field with mentor ID', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Unique ID')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test-mentor')).toBeInTheDocument();
    });

    it('renders the Description field with mentor description', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A helpful test mentor description')).toBeInTheDocument();
    });

    it('renders the Category field', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Category')).toBeInTheDocument();
      // "Education" appears in both the combobox trigger and the category list
      expect(screen.getAllByText('Education').length).toBeGreaterThanOrEqual(1);
    });

    it('renders "Select category..." when no category is selected', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, categories: [] },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Select category...')).toBeInTheDocument();
    });

    it('renders the Who Can View select', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Who Can View?')).toBeInTheDocument();
    });

    it('renders visibility options', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Administrators')).toBeInTheDocument();
      expect(screen.getByText('Students')).toBeInTheDocument();
      // "Anyone" appears in both the visibility select and chat access select
      expect(screen.getAllByText('Anyone').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the Who Can Chat select', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Who Can Chat?')).toBeInTheDocument();
    });

    it('renders chat access options', () => {
      render(<SettingsTab />);

      // "Anyone" appears as both a visibility option and a chat access option
      expect(screen.getAllByRole('option', { name: 'Anyone' }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Authenticated Users')).toBeInTheDocument();
    });

    it('renders LTI Accessible toggle', () => {
      render(<SettingsTab />);

      expect(screen.getByText('LTI Accessible?')).toBeInTheDocument();
    });

    it('renders Show Attachment toggle', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Show Attachment')).toBeInTheDocument();
    });

    it('renders Show Voice Call toggle', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Show Voice Call')).toBeInTheDocument();
    });

    it('renders Show Voice Record toggle', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Show Voice Record')).toBeInTheDocument();
    });

    it('renders the Image upload section', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Image')).toBeInTheDocument();
    });

    it('renders mentor image when profile_image is a URL', () => {
      render(<SettingsTab />);

      const img = screen.getByAltText('Mentor');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('renders upload placeholder when no profile image', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, profile_image: '' },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('+ Upload')).toBeInTheDocument();
    });

    it('renders Save button', () => {
      render(<SettingsTab />);

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('renders Delete button when canDelete is true', () => {
      render(<SettingsTab />);

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('does not render Delete button when canDelete is false', () => {
      mockWithFormPermissionsCanDelete.mockReturnValue(false);

      render(<SettingsTab />);

      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    });

    it('renders the settings form content region', () => {
      render(<SettingsTab />);

      expect(screen.getByRole('region', { name: 'Settings form content' })).toBeInTheDocument();
    });

    it('renders tooltips for fields', () => {
      render(<SettingsTab />);

      // "More info about chat access" appears twice: once for "Who Can View?" and once for "Who Can Chat?"
      expect(screen.getAllByLabelText('More info about chat access')).toHaveLength(2);
      expect(screen.getByLabelText('More info about lti accessibility')).toBeInTheDocument();
      expect(screen.getByLabelText('More info about show attachment')).toBeInTheDocument();
      expect(screen.getByLabelText('More info about show voice call')).toBeInTheDocument();
      expect(screen.getByLabelText('More info about show voice record')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Form Interactions
  // ==========================================================================
  describe('Form Interactions', () => {
    it('updates mentor name on input change', async () => {
      const user = userEvent.setup();
      render(<SettingsTab />);

      const input = screen.getByDisplayValue('Test Mentor');
      await user.clear(input);
      await user.type(input, 'New Mentor Name');

      expect(input).toHaveValue('New Mentor Name');
    });

    it('updates mentor description on textarea change', async () => {
      const user = userEvent.setup();
      render(<SettingsTab />);

      const textarea = screen.getByDisplayValue('A helpful test mentor description');
      await user.clear(textarea);
      await user.type(textarea, 'Updated description');

      expect(textarea).toHaveValue('Updated description');
    });

    it('shows validation message when name is cleared', async () => {
      const user = userEvent.setup();
      render(<SettingsTab />);

      const input = screen.getByDisplayValue('Test Mentor');
      await user.clear(input);

      await waitFor(() => {
        expect(screen.getByText('Mentor name is required')).toBeInTheDocument();
      });
    });

    it('shows validation message when description is cleared', async () => {
      const user = userEvent.setup();
      render(<SettingsTab />);

      const textarea = screen.getByDisplayValue('A helpful test mentor description');
      await user.clear(textarea);

      await waitFor(() => {
        expect(screen.getByText('Mentor description is required')).toBeInTheDocument();
      });
    });

    it('selects a category from the category list', async () => {
      render(<SettingsTab />);

      const techOption = screen.getByText('Technology');
      fireEvent.click(techOption);

      // The form should update the category value
      expect(techOption).toBeInTheDocument();
    });

    it('toggles LTI accessible switch', () => {
      render(<SettingsTab />);

      const ltiSwitch = screen.getByLabelText('Is lti accessible disabled');
      expect(ltiSwitch).not.toBeChecked();

      fireEvent.click(ltiSwitch);

      expect(ltiSwitch).toBeChecked();
    });

    it('toggles show attachment switch', () => {
      render(<SettingsTab />);

      const attachmentSwitch = screen.getByLabelText('Show attachment enabled');
      expect(attachmentSwitch).toBeChecked();

      fireEvent.click(attachmentSwitch);

      expect(attachmentSwitch).not.toBeChecked();
    });

    it('toggles show voice call switch', () => {
      render(<SettingsTab />);

      const voiceCallSwitch = screen.getByLabelText('Show voice call enabled');
      expect(voiceCallSwitch).toBeChecked();

      fireEvent.click(voiceCallSwitch);

      expect(voiceCallSwitch).not.toBeChecked();
    });

    it('toggles show voice record switch', () => {
      render(<SettingsTab />);

      const voiceRecordSwitch = screen.getByLabelText('Show voice record disabled');
      expect(voiceRecordSwitch).not.toBeChecked();

      fireEvent.click(voiceRecordSwitch);

      expect(voiceRecordSwitch).toBeChecked();
    });
  });

  // ==========================================================================
  // Copy to Clipboard
  // ==========================================================================
  describe('Copy to Clipboard', () => {
    it('copies mentor ID when copy button is clicked', () => {
      render(<SettingsTab />);

      const copyButton = screen.getByLabelText('Copy unique ID to clipboard');
      fireEvent.click(copyButton);

      expect(mockCopy).toHaveBeenCalledWith('test-mentor');
    });

    it('shows check icon when copy is successful', () => {
      mockCopyStatus.mockReturnValue('success');

      render(<SettingsTab />);

      expect(screen.getByLabelText('Unique ID copied to clipboard')).toBeInTheDocument();
    });

    it('shows copy icon when status is idle', () => {
      mockCopyStatus.mockReturnValue('idle');

      render(<SettingsTab />);

      expect(screen.getByLabelText('Copy unique ID to clipboard')).toBeInTheDocument();
    });

    it('disables copy button when no mentor ID', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: '' });
      mockGetMentorId.mockReturnValue(null);

      render(<SettingsTab />);

      // The unique ID input should be empty, and copy button disabled
      const copyButton = screen.getByLabelText('Copy unique ID to clipboard');
      expect(copyButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Form Submission
  // ==========================================================================
  describe('Form Submission', () => {
    it('calls editMentor on form submit', async () => {
      render(<SettingsTab />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

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

    it('shows success toast on successful submit', async () => {
      render(<SettingsTab />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Mentor updated successfully');
      });
    });

    it('shows error toast on failed submit', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockEditMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Update failed')),
      });

      render(<SettingsTab />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update mentor');
      });

      consoleSpy.mockRestore();
    });

    it('calls executeWithTrialCheck before submitting', async () => {
      render(<SettingsTab />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      });
    });

    it('shows "Saving..." text when edit mutation is loading', () => {
      mockEditMentorLoading.mockReturnValue(true);

      render(<SettingsTab />);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('shows "Save" text when edit mutation is not loading', () => {
      render(<SettingsTab />);

      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('submits with file when profile_image is a File', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, profile_image: '' },
        isLoading: false,
      });

      render(<SettingsTab />);

      const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      await userEvent.upload(fileInput, file);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              uploaded_profile_image: expect.any(File),
            }),
          }),
        );
      });
    });

    it('includes boolean fields in submission', async () => {
      render(<SettingsTab />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              show_attachment: true,
              show_voice_call: true,
              show_voice_record: false,
              is_lti_accessible: false,
            }),
          }),
        );
      });
    });

    it('converts allow_anonymous string to boolean in submission', async () => {
      render(<SettingsTab />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            formData: expect.objectContaining({
              allow_anonymous: true,
            }),
          }),
        );
      });
    });
  });

  // ==========================================================================
  // Image Upload
  // ==========================================================================
  describe('Image Upload', () => {
    it('handles file selection via file input', async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, profile_image: '' },
        isLoading: false,
      });

      render(<SettingsTab />);

      const file = new File(['test-content'], 'photo.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      // Manually trigger change event since the input is hidden
      fireEvent.change(fileInput, { target: { files: [file] } });

      // After uploading, the image should be displayed
      await waitFor(() => {
        expect(screen.getByAltText('Mentor')).toBeInTheDocument();
      });
    });

    it('clears image when remove button is clicked', async () => {
      render(<SettingsTab />);

      // Image should be displayed
      expect(screen.getByAltText('Mentor')).toBeInTheDocument();

      const removeButton = screen.getByLabelText('Remove image');
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText('+ Upload')).toBeInTheDocument();
      });
    });

    it('renders file input with image accept type', () => {
      render(<SettingsTab />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toHaveAttribute('accept', 'image/*');
    });
  });

  // ==========================================================================
  // Delete Modal
  // ==========================================================================
  describe('Delete Modal', () => {
    it('opens delete modal when Delete button is clicked', async () => {
      render(<SettingsTab />);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('delete-mentor-modal')).toBeInTheDocument();
      });
    });

    it('closes delete modal when cancel is clicked', async () => {
      render(<SettingsTab />);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('delete-mentor-modal')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('close-delete-modal');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('delete-mentor-modal')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Loading and Disabled States
  // ==========================================================================
  describe('Loading and Disabled States', () => {
    it('disables form fields when categories are loading', () => {
      mockGetMentorCategoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<SettingsTab />);

      const nameInput = screen.getByPlaceholderText('Mentor Name');
      expect(nameInput).toBeDisabled();
    });

    it('disables form fields when mentor settings are loading', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: defaultMentorSettings,
        isLoading: true,
      });

      render(<SettingsTab />);

      const nameInput = screen.getByPlaceholderText('Mentor Name');
      expect(nameInput).toBeDisabled();
    });

    it('disables form fields when edit mentor is loading', () => {
      mockEditMentorLoading.mockReturnValue(true);

      render(<SettingsTab />);

      const nameInput = screen.getByPlaceholderText('Mentor Name');
      expect(nameInput).toBeDisabled();
    });

    it('disables Save button when form is loading', () => {
      mockEditMentorLoading.mockReturnValue(true);

      render(<SettingsTab />);

      const saveButton = screen.getByRole('button', { name: /saving/i });
      expect(saveButton).toBeDisabled();
    });

    it('disables Delete button when form is loading', () => {
      mockEditMentorLoading.mockReturnValue(true);

      render(<SettingsTab />);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it('enables fields when nothing is loading', () => {
      render(<SettingsTab />);

      const nameInput = screen.getByPlaceholderText('Mentor Name');
      expect(nameInput).not.toBeDisabled();
    });
  });

  // ==========================================================================
  // Free Trial Dialog
  // ==========================================================================
  describe('Free Trial Dialog', () => {
    it('does not render FreeTrialDialog when isModalOpen is false', () => {
      render(<SettingsTab />);

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });

    it('does not render FreeTrialDialog when FreeTrialDialog is null even if isModalOpen is true', () => {
      mockUseShowFreeTrialDialog.mockReturnValue({
        executeWithTrialCheck: mockExecuteWithTrialCheck,
        isModalOpen: true,
        FreeTrialDialog: null,
        closeModal: mockCloseModal,
      });

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

    it('calls closeModal when FreeTrialDialog close is triggered', () => {
      const MockFreeTrialDialog = ({ isOpen, onClose }: any) =>
        isOpen ? (
          <div data-testid="free-trial-dialog">
            <button onClick={onClose} data-testid="close-trial-btn">
              Close Trial
            </button>
          </div>
        ) : null;

      mockUseShowFreeTrialDialog.mockReturnValue({
        executeWithTrialCheck: mockExecuteWithTrialCheck,
        isModalOpen: true,
        FreeTrialDialog: MockFreeTrialDialog,
        closeModal: mockCloseModal,
      });

      render(<SettingsTab />);

      fireEvent.click(screen.getByTestId('close-trial-btn'));

      expect(mockCloseModal).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles undefined mentor settings data gracefully', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('handles null mentor settings data gracefully', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('handles empty categories array', () => {
      mockGetMentorCategoriesQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('handles undefined categories', () => {
      mockGetMentorCategoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<SettingsTab />);

      // Component renders without crashing even when categories query returns undefined
      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('handles mentor with no categories', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, categories: null },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Select category...')).toBeInTheDocument();
    });

    it('handles mentor with empty categories', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, categories: [] },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Select category...')).toBeInTheDocument();
    });

    it('handles allow_anonymous being false', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, allow_anonymous: false },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Who Can Chat?')).toBeInTheDocument();
    });

    it('handles undefined mentor_visibility', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, mentor_visibility: undefined },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Who Can View?')).toBeInTheDocument();
    });

    it('handles missing permissions field', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, permissions: undefined },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('handles missing permissions.field', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, permissions: {} },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Query Parameters
  // ==========================================================================
  describe('Query Parameters', () => {
    it('passes correct params to useGetMentorSettingsQuery', () => {
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

    it('passes correct params to useGetMentorCategoriesQuery', () => {
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

    it('skips categories query when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: '', mentorId: 'test-mentor' });

      render(<SettingsTab />);

      expect(mockGetMentorCategoriesQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: true,
        }),
      );
    });
  });

  // ==========================================================================
  // Switch States
  // ==========================================================================
  describe('Switch States', () => {
    it('reflects is_lti_accessible value in switch', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, is_lti_accessible: true },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByLabelText('Is lti accessible enabled')).toBeChecked();
    });

    it('reflects show_attachment false in switch', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, show_attachment: false },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByLabelText('Show attachment disabled')).not.toBeChecked();
    });

    it('reflects show_voice_call false in switch', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, show_voice_call: false },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByLabelText('Show voice call disabled')).not.toBeChecked();
    });

    it('reflects show_voice_record true in switch', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, show_voice_record: true },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByLabelText('Show voice record enabled')).toBeChecked();
    });

    it('defaults show_attachment to true when undefined', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, show_attachment: undefined },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByLabelText('Show attachment enabled')).toBeChecked();
    });

    it('defaults show_voice_call to true when undefined', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, show_voice_call: undefined },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByLabelText('Show voice call enabled')).toBeChecked();
    });

    it('defaults show_voice_record to true when undefined', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, show_voice_record: undefined },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByLabelText('Show voice record enabled')).toBeChecked();
    });

    it('defaults is_lti_accessible to false when undefined', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, is_lti_accessible: undefined },
        isLoading: false,
      });

      render(<SettingsTab />);

      expect(screen.getByLabelText('Is lti accessible disabled')).not.toBeChecked();
    });
  });

  // ==========================================================================
  // Accessibility
  // ==========================================================================
  describe('Accessibility', () => {
    it('has proper aria-labels for switch toggles', () => {
      render(<SettingsTab />);

      expect(screen.getByLabelText('Show attachment enabled')).toBeInTheDocument();
      expect(screen.getByLabelText('Show voice call enabled')).toBeInTheDocument();
      expect(screen.getByLabelText('Show voice record disabled')).toBeInTheDocument();
      expect(screen.getByLabelText('Is lti accessible disabled')).toBeInTheDocument();
    });

    it('has accessible remove image button', () => {
      render(<SettingsTab />);

      expect(screen.getByLabelText('Remove image')).toBeInTheDocument();
    });

    it('has accessible copy button', () => {
      render(<SettingsTab />);

      expect(screen.getByLabelText('Copy unique ID to clipboard')).toBeInTheDocument();
    });

    it('has accessible category select', () => {
      render(<SettingsTab />);

      expect(screen.getByLabelText('Select a category')).toBeInTheDocument();
    });
  });
});
