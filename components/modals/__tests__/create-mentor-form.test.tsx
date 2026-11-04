import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  canWriteAgentField,
  getCreateAgentFieldVisibility,
} from '@iblai/iblai-js/web-utils';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CreateMentorForm, CreateMentorInline } from '../create-mentor-form';
import { CreateMentorModal } from '../create-mentor-modal';

// ============================================================================
// MOCKS
// ============================================================================

const { navigateToMentor, createMutation, unwrap, freeTrial } = vi.hoisted(
  () => ({
    navigateToMentor: vi.fn(),
    createMutation: vi.fn(),
    unwrap: vi.fn(),
    freeTrial: {
      isModalOpen: false,
      FreeTrialDialog: null as React.ComponentType<{
        isOpen: boolean;
        onClose: () => void;
      }> | null,
    },
  }),
);

type FieldPermissions = Record<string, { write: boolean }> | undefined | null;

const { fieldPermissions, categoriesQuery, useCreateAgentFieldPermissions } =
  vi.hoisted(() => ({
    fieldPermissions: {
      permissions: undefined as
        | Record<string, { write: boolean }>
        | undefined
        | null,
      isLoading: false,
    },
    categoriesQuery: { isLoading: false },
    useCreateAgentFieldPermissions: vi.fn(),
  }));

vi.mock('@/hooks/use-tenants', () => ({
  useTenantKey: () => ({ tenant: 'test-tenant' }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ navigateToMentor }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/platform/test-tenant/test-mentor',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'test-mentor' }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: (fn: () => void) => fn(),
    isModalOpen: freeTrial.isModalOpen,
    FreeTrialDialog: freeTrial.FreeTrialDialog,
    closeModal: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Lightweight next/image stand-in.
vi.mock('next/image', () => ({
  default: function NextImageStub(props: Record<string, unknown>) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Avoid pulling the heavy rich-text editor (and its transitive deps).
vi.mock('@iblai/iblai-js/web-containers', () => ({
  useCreateAgentFieldPermissions,
  RichTextEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/lib/config', () => ({
  config: {
    showBaseMentor: () => true,
    iblTemplateMentor: () => 'template-mentor',
  },
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorCategoriesQuery: () => ({
    data: [
      { id: 1, name: 'General' },
      { id: 2, name: 'Technical' },
    ],
    isLoading: categoriesQuery.isLoading,
  }),
  useCreateMentorMutation: () => [
    (...args: unknown[]) => {
      createMutation(...args);
      return { unwrap };
    },
    { isLoading: false },
  ],
}));

// The SDK hook is stubbed only to keep the Redux store out of the test; the
// visibility and the payload come from the SDK's own helpers.
useCreateAgentFieldPermissions.mockImplementation(() => ({
  permissions: fieldPermissions.permissions,
  isLoading: fieldPermissions.isLoading,
  visibility: getCreateAgentFieldVisibility(fieldPermissions.permissions),
  canWrite: (field: string) =>
    canWriteAgentField(fieldPermissions.permissions, field),
}));

// ============================================================================
// HELPERS
// ============================================================================

const DESCRIPTION_TEXT = /Create a new agent by filling out the required/i;

function renderDialogVariant(props = {}) {
  return render(
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>
        <CreateMentorForm {...props} />
      </DialogContent>
    </Dialog>,
  );
}

async function fillRequiredAndGoToPrompts(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(screen.getByPlaceholderText('Agent Name'), 'My Agent');
  await user.type(
    screen.getByPlaceholderText('Agent Description'),
    'A helpful agent',
  );

  // Category (Popover + cmdk)
  await user.click(screen.getByRole('combobox', { name: /select category/i }));
  await user.click(await screen.findByText('General'));

  // Move to the prompts tab
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

// ============================================================================
// TESTS
// ============================================================================

describe('CreateMentorForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwrap.mockResolvedValue({ unique_id: 'new-mentor-id' });
    freeTrial.isModalOpen = false;
    freeTrial.FreeTrialDialog = null;
    fieldPermissions.permissions = undefined;
    fieldPermissions.isLoading = false;
    categoriesQuery.isLoading = false;
  });

  afterEach(() => {
    cleanup();
  });

  describe('header / variants', () => {
    it('defaults to the dialog variant: renders sr-only description + DialogTitle', () => {
      renderDialogVariant();

      expect(screen.getByText(DESCRIPTION_TEXT)).toBeInTheDocument();
      expect(document.querySelector('.ibl-dialog-title')?.textContent).toBe(
        'Create Agent',
      );
    });

    it('inline variant: no dialog description, heading is a plain <h2>', () => {
      render(<CreateMentorForm variant="inline" />);

      expect(screen.queryByText(DESCRIPTION_TEXT)).not.toBeInTheDocument();
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.tagName).toBe('H2');
      expect(heading).toHaveClass('ibl-dialog-title');
      expect(heading.textContent).toBe('Create Agent');
    });

    it('supports a custom title and hidden header', () => {
      const { rerender } = render(
        <CreateMentorForm variant="inline" title="Spin up an agent" />,
      );
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
        'Spin up an agent',
      );

      rerender(<CreateMentorForm variant="inline" showHeader={false} />);
      expect(
        screen.queryByRole('heading', { level: 2 }),
      ).not.toBeInTheDocument();
    });

    it('applies a custom className to the inline container (with space-y-6)', () => {
      const { container } = render(
        <CreateMentorForm variant="inline" className="my-inline-form" />,
      );
      const wrapper = container.querySelector('.my-inline-form');
      expect(wrapper).not.toBeNull();
      expect(wrapper).toHaveClass('space-y-6');
    });
  });

  describe('prefill via initialValues', () => {
    it('pre-populates settings fields and prompt text', async () => {
      const user = userEvent.setup();
      render(
        <CreateMentorForm
          variant="inline"
          initialValues={{
            name: 'Prefilled Agent',
            description: 'Prefilled description',
            category: 1,
            systemPrompt: 'Custom system prompt',
          }}
        />,
      );

      expect(screen.getByPlaceholderText('Agent Name')).toHaveValue(
        'Prefilled Agent',
      );
      expect(screen.getByPlaceholderText('Agent Description')).toHaveValue(
        'Prefilled description',
      );
      // category 1 -> "General" displayed in the combobox
      expect(
        screen.getByRole('combobox', { name: /select category/i }).textContent,
      ).toContain('General');

      // Prompt prefilled value shows on the prompts tab
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText('Custom system prompt')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows required errors after a field is touched and cleared', async () => {
      const user = userEvent.setup();
      render(<CreateMentorForm variant="inline" />);

      const name = screen.getByPlaceholderText('Agent Name');
      await user.type(name, 'x');
      await user.clear(name);
      expect(screen.getByText('Agent name is required')).toBeInTheDocument();

      const description = screen.getByPlaceholderText('Agent Description');
      await user.type(description, 'y');
      await user.clear(description);
      expect(
        screen.getByText('Agent description is required'),
      ).toBeInTheDocument();
    });
  });

  describe('settings interactions', () => {
    it('selects visibility and base, and handles image upload + removal', async () => {
      const user = userEvent.setup();
      render(<CreateMentorForm variant="inline" />);

      // Visibility (Radix Select) — pick a value different from the default
      // ("Students") so onValueChange actually fires.
      await user.click(
        screen.getByRole('combobox', { name: /select agent visibility/i }),
      );
      await user.click(screen.getByRole('option', { name: 'Administrators' }));

      // Base (Radix Select, shown because showBaseMentor() === true)
      await user.click(
        screen.getByRole('combobox', { name: /select base model/i }),
      );
      await user.click(screen.getByRole('option', { name: 'OpenAI' }));

      // Image upload area: click + keyboard activation
      const uploadArea = screen.getByRole('button', {
        name: /upload agent image/i,
      });
      await user.click(uploadArea);
      fireEvent.keyDown(uploadArea, { key: 'Enter' });
      fireEvent.keyDown(uploadArea, { key: ' ' });

      // Upload a file via the hidden input -> preview shows
      const fileInput = screen.getByLabelText(
        'Select agent image file',
      ) as HTMLInputElement;
      const file = new File(['data'], 'avatar.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      const removeButton = await screen.findByRole('button', {
        name: /remove uploaded image/i,
      });
      expect(removeButton).toBeInTheDocument();

      // Remove the uploaded image
      await user.click(removeButton);
      expect(
        screen.queryByRole('button', { name: /remove uploaded image/i }),
      ).not.toBeInTheDocument();
    });

    // The Dialog's scroll lock cancels every wheel event outside its content,
    // so the list must be portaled into the Dialog, not document.body.
    it('lets the mouse wheel scroll the category list inside the dialog', async () => {
      const user = userEvent.setup();
      renderDialogVariant();

      await user.click(
        screen.getByRole('combobox', { name: /select category/i }),
      );
      await screen.findByText('General');
      const list = document.querySelector<HTMLElement>('[cmdk-list]')!;
      expect(list.closest('[role="dialog"]')).not.toBeNull();
      list.style.overflowY = 'auto';
      Object.defineProperty(list, 'scrollHeight', { value: 1000 });
      Object.defineProperty(list, 'clientHeight', { value: 300 });

      const wheel = new WheelEvent('wheel', {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
      });
      list.dispatchEvent(wheel);

      expect(wheel.defaultPrevented).toBe(false);
    });
  });

  describe('prompts tab + submission', () => {
    it('opens each prompt editor, edits a prompt, and submits successfully', async () => {
      const user = userEvent.setup();
      const onCreated = vi.fn();
      render(<CreateMentorForm variant="inline" onCreated={onCreated} />);

      await fillRequiredAndGoToPrompts(user);

      // Open the System Prompt editor, edit it, then close.
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);
      const editor = await screen.findByTestId('rich-text-editor');
      await user.clear(editor);
      await user.type(editor, 'Edited system prompt');
      await user.keyboard('{Escape}');

      // Open the Proactive + Guided editors to cover the value branches.
      await waitFor(() =>
        expect(
          screen.queryByTestId('rich-text-editor'),
        ).not.toBeInTheDocument(),
      );
      const editButtons2 = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons2[1]);
      await screen.findByTestId('rich-text-editor');
      await user.keyboard('{Escape}');

      await waitFor(() =>
        expect(
          screen.queryByTestId('rich-text-editor'),
        ).not.toBeInTheDocument(),
      );
      const editButtons3 = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons3[2]);
      await screen.findByTestId('rich-text-editor');
      await user.keyboard('{Escape}');

      // Submit
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(createMutation).toHaveBeenCalledTimes(1);
        expect(navigateToMentor).toHaveBeenCalledWith(
          'new-mentor-id',
          undefined,
          undefined,
        );
        expect(onCreated).toHaveBeenCalledTimes(1);
      });
      // This test drives many sequential userEvent interactions (opening each
      // prompt editor in turn). It runs in ~1s in isolation but can exceed the
      // default 5s under the heavily-parallel full-suite run, so give it headroom.
    }, 15000);
  });

  describe('prompt editor Save button', () => {
    it.each([0, 1, 2])(
      'closes editor %i on Save and shows the typed text in the form',
      async (index) => {
        const user = userEvent.setup();
        render(<CreateMentorForm variant="inline" />);
        await fillRequiredAndGoToPrompts(user);

        await user.click(
          screen.getAllByRole('button', { name: /edit/i })[index],
        );
        const dialog = await screen.findByRole('dialog');
        const editor = within(dialog).getByTestId('rich-text-editor');
        await user.clear(editor);
        await user.type(editor, 'Typed prompt');
        await user.click(within(dialog).getByRole('button', { name: 'Save' }));

        await waitFor(() =>
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
        expect(screen.getByText('Typed prompt')).toBeInTheDocument();
        expect(createMutation).not.toHaveBeenCalled();
      },
      15000,
    );
  });

  describe('free trial dialog', () => {
    it('renders the FreeTrialDialog when the trial gate is open', () => {
      freeTrial.isModalOpen = true;
      function FreeTrialDialogStub({ isOpen }: { isOpen: boolean }) {
        return isOpen ? <div data-testid="free-trial-dialog" /> : null;
      }
      freeTrial.FreeTrialDialog = FreeTrialDialogStub;

      render(<CreateMentorForm variant="inline" />);

      expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
    });
  });

  describe('field permissions', () => {
    function setPermissions(permissions: FieldPermissions) {
      fieldPermissions.permissions = permissions;
    }

    async function fillVisibleRequired(
      user: ReturnType<typeof userEvent.setup>,
    ) {
      await user.type(screen.getByPlaceholderText('Agent Name'), 'My Agent');
      if (screen.queryByPlaceholderText('Agent Description')) {
        await user.type(
          screen.getByPlaceholderText('Agent Description'),
          'A helpful agent',
        );
      }
      if (screen.queryByRole('combobox', { name: /select category/i })) {
        await user.click(
          screen.getByRole('combobox', { name: /select category/i }),
        );
        await user.click(await screen.findByText('General'));
      }
    }

    it('asks for the permissions of the current organization', () => {
      render(<CreateMentorForm variant="inline" />);

      expect(useCreateAgentFieldPermissions).toHaveBeenCalledWith({
        org: 'test-tenant',
      });
    });

    it('hides a field the user may not write and leaves it out of the payload', async () => {
      setPermissions({ mentor_visibility: { write: false } });
      const user = userEvent.setup();
      render(<CreateMentorForm variant="inline" />);

      expect(
        screen.queryByRole('combobox', { name: /select agent visibility/i }),
      ).not.toBeInTheDocument();

      await fillRequiredAndGoToPrompts(user);
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(createMutation).toHaveBeenCalledTimes(1));
      const { formData } = createMutation.mock.calls[0][0] as {
        formData: Record<string, unknown>;
      };
      expect(formData).not.toHaveProperty('mentor_visibility');
      expect(formData).toMatchObject({
        new_mentor_name: 'My Agent',
        display_name: 'My Agent',
        description: 'A helpful agent',
        categories: [1],
      });
    });

    it('does not require a hidden description to move on', async () => {
      setPermissions({ description: { write: false } });
      const user = userEvent.setup();
      render(<CreateMentorForm variant="inline" />);

      expect(
        screen.queryByPlaceholderText('Agent Description'),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

      await fillVisibleRequired(user);

      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
      expect(screen.getByRole('tab', { name: 'Prompts' })).toBeEnabled();
    });

    it('does not require a hidden category to move on', async () => {
      setPermissions({ categories: { write: false } });
      const user = userEvent.setup();
      render(<CreateMentorForm variant="inline" />);

      expect(
        screen.queryByRole('combobox', { name: /select category/i }),
      ).not.toBeInTheDocument();

      await fillVisibleRequired(user);

      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });

    it('hides the image and base fields the user may not write', () => {
      setPermissions({
        uploaded_profile_image: { write: false },
        template_name: { write: false },
      });
      render(<CreateMentorForm variant="inline" />);

      expect(
        screen.queryByRole('button', { name: /upload agent image/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('combobox', { name: /select base model/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Agent Name')).toBeInTheDocument();
    });

    it('saves from the Settings tab when no prompt may be written', async () => {
      setPermissions({
        system_prompt: { write: false },
        proactive_prompt: { write: false },
        guided_prompt_instructions: { write: false },
      });
      const user = userEvent.setup();
      const onCreated = vi.fn();
      render(<CreateMentorForm variant="inline" onCreated={onCreated} />);

      expect(
        screen.queryByRole('tab', { name: 'Prompts' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Next' }),
      ).not.toBeInTheDocument();
      const save = screen.getByRole('button', { name: 'Save' });
      expect(save).toBeDisabled();

      await fillVisibleRequired(user);
      expect(save).toBeEnabled();
      await user.click(save);

      await waitFor(() => expect(createMutation).toHaveBeenCalledTimes(1));
      const { formData } = createMutation.mock.calls[0][0] as {
        formData: Record<string, unknown>;
      };
      expect(formData).not.toHaveProperty('system_prompt');
      expect(formData).not.toHaveProperty('proactive_prompt');
      expect(formData).not.toHaveProperty('guided_prompt_instructions');
      expect(formData).toMatchObject({
        new_mentor_name: 'My Agent',
        description: 'A helpful agent',
        moderation_system_prompt: expect.any(String),
      });
      await waitFor(() => {
        expect(navigateToMentor).toHaveBeenCalledWith(
          'new-mentor-id',
          undefined,
          undefined,
        );
        expect(onCreated).toHaveBeenCalledTimes(1);
      });
    });

    it('does not create the agent on Enter in the name field when saving from Settings', async () => {
      setPermissions({
        system_prompt: { write: false },
        proactive_prompt: { write: false },
        guided_prompt_instructions: { write: false },
      });
      const user = userEvent.setup();
      render(<CreateMentorForm variant="inline" />);

      await fillVisibleRequired(user);
      await user.type(screen.getByPlaceholderText('Agent Name'), '{Enter}');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(createMutation).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('shows a prompt card only for each prompt the user may write', async () => {
      setPermissions({ proactive_prompt: { write: false } });
      const user = userEvent.setup();
      render(<CreateMentorForm variant="inline" />);

      await fillRequiredAndGoToPrompts(user);

      expect(screen.getByText('System Prompts')).toBeInTheDocument();
      expect(screen.queryByText('Proactive Prompts')).not.toBeInTheDocument();
      expect(screen.getByText('Guided Prompts')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('shows every field and the Prompts tab while the permissions are unknown', () => {
      setPermissions(undefined);
      render(<CreateMentorForm variant="inline" />);

      expect(screen.getByPlaceholderText('Agent Name')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Agent Description'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: /select category/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: /select agent visibility/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: /select base model/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /upload agent image/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Prompts' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    });

    it('keeps the name field, disabled, and holds the gated fields back while the permissions load', () => {
      fieldPermissions.isLoading = true;
      const prefilled = {
        name: 'Prefilled Agent',
        description: 'Prefilled description',
        category: 1,
      };
      const { rerender } = render(
        <CreateMentorForm variant="inline" initialValues={prefilled} />,
      );

      const name = screen.getByPlaceholderText('Agent Name');
      expect(name).toBeDisabled();
      expect(name).toHaveValue('Prefilled Agent');
      expect(
        screen.queryByPlaceholderText('Agent Description'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('combobox', { name: /select category/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('tab', { name: 'Prompts' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Next' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Save' }),
      ).not.toBeInTheDocument();

      fieldPermissions.isLoading = false;
      rerender(<CreateMentorForm variant="inline" initialValues={prefilled} />);

      expect(screen.getByPlaceholderText('Agent Name')).toBeEnabled();
      expect(screen.getByPlaceholderText('Agent Description')).toHaveValue(
        'Prefilled description',
      );
      expect(screen.getByRole('tab', { name: 'Prompts' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });

    it('decides between Next and Save only once the permissions arrive', () => {
      fieldPermissions.isLoading = true;
      const prefilled = {
        name: 'Prefilled Agent',
        description: 'Prefilled description',
        category: 1,
      };
      const { rerender } = render(
        <CreateMentorForm variant="inline" initialValues={prefilled} />,
      );

      expect(
        screen.queryByRole('button', { name: 'Next' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Save' }),
      ).not.toBeInTheDocument();

      setPermissions({
        system_prompt: { write: false },
        proactive_prompt: { write: false },
        guided_prompt_instructions: { write: false },
      });
      fieldPermissions.isLoading = false;
      rerender(<CreateMentorForm variant="inline" initialValues={prefilled} />);

      expect(
        screen.queryByRole('button', { name: 'Next' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('tab', { name: 'Prompts' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('lets the user move on to Prompts while the categories load when the settings are filled in', () => {
      categoriesQuery.isLoading = true;
      render(
        <CreateMentorForm
          variant="inline"
          initialValues={{
            name: 'Prefilled Agent',
            description: 'Prefilled description',
            category: 1,
          }}
        />,
      );

      expect(screen.getByPlaceholderText('Agent Name')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
      expect(screen.getByRole('tab', { name: 'Prompts' })).toBeEnabled();
    });
  });

  describe('CreateMentorInline convenience wrapper', () => {
    it('renders the inline variant', () => {
      render(<CreateMentorInline />);
      expect(screen.queryByText(DESCRIPTION_TEXT)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });
  });
});

describe('CreateMentorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwrap.mockResolvedValue({ unique_id: 'new-mentor-id' });
    freeTrial.isModalOpen = false;
    freeTrial.FreeTrialDialog = null;
    fieldPermissions.permissions = undefined;
    fieldPermissions.isLoading = false;
    categoriesQuery.isLoading = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a single dialog with the "Create Agent" title', () => {
    render(<CreateMentorModal isOpen onClose={() => {}} />);

    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
    expect(document.querySelector('.ibl-dialog-title')?.textContent).toBe(
      'Create Agent',
    );
  });

  it('pre-populates fields from initialValues', () => {
    render(
      <CreateMentorModal
        isOpen
        onClose={() => {}}
        initialValues={{ name: 'From modal' }}
      />,
    );

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(within(dialog).getByPlaceholderText('Agent Name')).toHaveValue(
      'From modal',
    );
  });

  it('does not render a dialog when closed', () => {
    render(<CreateMentorModal isOpen={false} onClose={() => {}} />);
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(0);
  });
});
