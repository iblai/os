import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CreateMentorForm, CreateMentorInline } from '../create-mentor-form';
import { CreateMentorModal } from '../create-mentor-modal';

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Spy on how the form hook is invoked so we can assert prop pass-through.
const { useCreateMentorSpy } = vi.hoisted(() => ({
  useCreateMentorSpy: vi.fn(),
}));

vi.mock('@/hooks/use-mentors/use-create-mentor', () => ({
  useCreateMentor: (initialValues?: unknown, onCreated?: unknown) => {
    useCreateMentorSpy(initialValues, onCreated);
    return {
      form: {
        Field: ({
          children,
        }: {
          children: (field: unknown) => React.ReactNode;
        }) =>
          children({
            state: { value: '', meta: { isDirty: false } },
            handleChange: vi.fn(),
          }),
        handleSubmit: vi.fn(),
      },
      name: '',
      description: '',
      category: null,
      file: null,
      guidedPrompt: '',
      systemPrompt: '',
      proactivePrompt: '',
      isLoadingCreateMentor: false,
      editPrompt: vi.fn(),
    };
  },
}));

vi.mock('@/hooks/use-tenants', () => ({
  useTenantKey: () => ({ tenant: 'test-tenant' }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: (fn: () => void) => fn(),
    isModalOpen: false,
    FreeTrialDialog: null,
    closeModal: vi.fn(),
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorCategoriesQuery: () => ({ data: [], isLoading: false }),
}));

// Avoid pulling the heavy rich-text editor (and its transitive deps).
vi.mock('@iblai/iblai-js/web-containers', () => ({
  RichTextEditor: () => <textarea data-testid="rich-text-editor" />,
}));

vi.mock('@/lib/config', () => ({
  config: {
    showBaseMentor: () => false,
    iblTemplateMentor: () => 'template-mentor',
  },
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

// ============================================================================
// TESTS
// ============================================================================

describe('CreateMentorForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('dialog variant (default)', () => {
    it('defaults to the dialog variant and renders the sr-only dialog description', () => {
      renderDialogVariant();

      // The dialog-only accessible description is present in the default variant.
      expect(screen.getByText(DESCRIPTION_TEXT)).toBeInTheDocument();
    });

    it('renders the "Create Agent" title using the DialogTitle', () => {
      renderDialogVariant();

      const title = document.querySelector('.ibl-dialog-title');
      expect(title?.textContent).toBe('Create Agent');
    });

    it('passes initialValues straight through to useCreateMentor', () => {
      const initialValues = {
        name: 'Prefilled',
        systemPrompt: 'Custom system prompt',
      };
      renderDialogVariant({ initialValues });

      expect(useCreateMentorSpy).toHaveBeenCalledWith(initialValues, undefined);
    });
  });

  describe('inline variant', () => {
    it('does NOT render the dialog-only sr-only description', () => {
      render(<CreateMentorForm variant="inline" />);

      expect(screen.queryByText(DESCRIPTION_TEXT)).not.toBeInTheDocument();
    });

    it('renders the heading as a plain <h2> (no Radix dialog primitive)', () => {
      render(<CreateMentorForm variant="inline" />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.tagName).toBe('H2');
      expect(heading).toHaveClass('ibl-dialog-title');
      expect(heading.textContent).toBe('Create Agent');
    });

    it('supports a custom title', () => {
      render(<CreateMentorForm variant="inline" title="Spin up an agent" />);

      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
        'Spin up an agent',
      );
    });

    it('hides the header when showHeader is false', () => {
      render(<CreateMentorForm variant="inline" showHeader={false} />);

      expect(
        screen.queryByRole('heading', { level: 2 }),
      ).not.toBeInTheDocument();
    });

    it('applies an extra className to the form container alongside space-y-6', () => {
      const { container } = render(
        <CreateMentorForm variant="inline" className="my-inline-form" />,
      );

      const wrapper = container.querySelector('.my-inline-form');
      expect(wrapper).not.toBeNull();
      expect(wrapper).toHaveClass('space-y-6');
    });

    it('forwards both initialValues and onCreated to useCreateMentor', () => {
      const initialValues = { description: 'desc' };
      const onCreated = vi.fn();
      render(
        <CreateMentorForm
          variant="inline"
          initialValues={initialValues}
          onCreated={onCreated}
        />,
      );

      expect(useCreateMentorSpy).toHaveBeenCalledWith(initialValues, onCreated);
    });
  });

  describe('CreateMentorInline convenience wrapper', () => {
    it('renders the inline variant (no dialog description)', () => {
      render(<CreateMentorInline />);

      expect(screen.queryByText(DESCRIPTION_TEXT)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('forwards props through to the form', () => {
      const initialValues = { name: 'Inline agent' };
      const onCreated = vi.fn();
      render(
        <CreateMentorInline
          initialValues={initialValues}
          onCreated={onCreated}
        />,
      );

      expect(useCreateMentorSpy).toHaveBeenCalledWith(initialValues, onCreated);
    });
  });
});

describe('CreateMentorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a single dialog with the "Create Agent" title', () => {
    render(<CreateMentorModal isOpen onClose={() => {}} />);

    const dialogs = document.querySelectorAll('[role="dialog"]');
    expect(dialogs.length).toBe(1);

    const title = document.querySelector('.ibl-dialog-title');
    expect(title?.textContent).toBe('Create Agent');
  });

  it('forwards initialValues to the underlying form hook', () => {
    const initialValues = { name: 'From modal', guidedPrompt: 'Guided' };
    render(
      <CreateMentorModal
        isOpen
        onClose={() => {}}
        initialValues={initialValues}
      />,
    );

    expect(useCreateMentorSpy).toHaveBeenCalledWith(initialValues, undefined);
  });

  it('does not render a dialog when closed', () => {
    render(<CreateMentorModal isOpen={false} onClose={() => {}} />);

    expect(document.querySelectorAll('[role="dialog"]').length).toBe(0);
  });
});
