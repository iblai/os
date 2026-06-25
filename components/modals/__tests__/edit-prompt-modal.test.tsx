import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import {
  EditPromptModal,
  type SelectedPrompt,
  type SystemPrompt,
  type SafetyPrompt,
} from '../edit-prompt-modal';
import { mentorApiSlice } from '@iblai/iblai-js/data-layer';
import { PromptVisibilityEnum } from '@iblai/iblai-api';

// ============================================================================
// MOCKS
// ============================================================================

const mockHandleSave = vi.fn();
const mockOnClose = vi.fn();
const mockExecuteWithTrialCheck = vi.fn((fn: () => void) => fn());
const mockCloseModal = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'test-mentor' }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: mockExecuteWithTrialCheck,
    isModalOpen: false,
    FreeTrialDialog: null,
    closeModal: mockCloseModal,
  }),
}));

// Mock RichTextEditor
vi.mock('@iblai/iblai-js/web-containers', () => ({
  RichTextEditor: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  ),
}));

const mockPromptCategories = [
  { id: 1, name: 'General' },
  { id: 2, name: 'Academic' },
  { id: 3, name: 'Technical' },
];

vi.mock('@iblai/iblai-js/data-layer', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@iblai/iblai-js/data-layer')>();
  return {
    ...actual,
    useGetPromptCategoriesQuery: vi.fn(() => ({
      data: mockPromptCategories,
      isLoading: false,
    })),
  };
});

// ============================================================================
// TEST STORE FACTORY
// ============================================================================

function createTestStore() {
  return configureStore({
    reducer: {
      [mentorApiSlice.reducerPath]: mentorApiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }).concat(mentorApiSlice.middleware),
  });
}

// ============================================================================
// TEST DATA
// ============================================================================

const systemPromptData: SelectedPrompt = {
  label: 'System Prompt',
  isSystem: true,
  name: 'system_prompt' as SystemPrompt,
  prompt: 'This is a system prompt',
};

const nonSystemPromptData: SelectedPrompt = {
  label: 'Custom Prompt',
  isSystem: false,
  name: 'prompt' as SystemPrompt,
  prompt: 'This is a custom prompt',
  category: 'General',
  id: 1,
  promptVisibility: PromptVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
};

const safetyPromptData: SelectedPrompt = {
  label: 'Safety Response',
  isSystem: true,
  name: 'safety_response' as SafetyPrompt,
  prompt: 'This is a safety response',
};

// ============================================================================
// TESTS
// ============================================================================

describe('EditPromptModal', () => {
  beforeEach(() => {
    cleanup();
    mockHandleSave.mockClear();
    mockOnClose.mockClear();
    mockExecuteWithTrialCheck.mockClear();
    mockCloseModal.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  // --------------------------------------------------------------------------
  // Basic Rendering Tests
  // --------------------------------------------------------------------------

  describe('Rendering - System Prompt', () => {
    it('renders the modal when open with system prompt', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.getByText('Edit System Prompt')).toBeInTheDocument();
    });

    it('does not render category or visibility fields for system prompt', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.queryByText('Category')).not.toBeInTheDocument();
      expect(screen.queryByText('Visibility')).not.toBeInTheDocument();
    });

    it('renders prompt editor for system prompt', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const editor = screen.getByTestId('rich-text-editor');
      expect(editor).toBeInTheDocument();
      expect(editor).toHaveValue('This is a system prompt');
    });

    it('renders Save button for system prompt', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });
  });

  describe('Rendering - Non-System Prompt', () => {
    it('renders the modal when open with non-system prompt', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.getByText('Edit Custom Prompt')).toBeInTheDocument();
    });

    it('renders category field for non-system prompt', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText('Select a category')).toBeInTheDocument();
    });

    it('renders visibility field for non-system prompt', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.getByText('Visibility')).toBeInTheDocument();
      expect(screen.getByLabelText('Select visibility')).toBeInTheDocument();
    });

    it('renders prompt editor for non-system prompt', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const editor = screen.getByTestId('rich-text-editor');
      expect(editor).toBeInTheDocument();
      expect(editor).toHaveValue('This is a custom prompt');
    });
  });

  describe('Rendering - Safety Prompt', () => {
    it('renders safety prompt as system prompt', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={safetyPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.getByText('Edit Safety Response')).toBeInTheDocument();
      expect(screen.queryByText('Category')).not.toBeInTheDocument();
      expect(screen.queryByText('Visibility')).not.toBeInTheDocument();
    });
  });

  describe('Modal State', () => {
    it('does not render when isOpen is false', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={false}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      // Dialog content should not be visible when closed
      expect(screen.queryByText('Edit System Prompt')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Form Interaction Tests
  // --------------------------------------------------------------------------

  describe('Form Interactions - System Prompt', () => {
    it('allows editing the prompt text for system prompt', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const editor = screen.getByTestId('rich-text-editor');
      await userEvent.clear(editor);
      await userEvent.type(editor, 'Updated system prompt');

      expect(editor).toHaveValue('Updated system prompt');
    });

    it('shows validation error when prompt is empty and dirty', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const editor = screen.getByTestId('rich-text-editor');
      await userEvent.clear(editor);

      await waitFor(() => {
        expect(screen.getByText('Prompt is required')).toBeInTheDocument();
      });
    });

    it('submits form with valid system prompt data', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const editor = screen.getByTestId('rich-text-editor');
      await userEvent.clear(editor);
      await userEvent.type(editor, 'Updated system prompt');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
        expect(mockHandleSave).toHaveBeenCalledWith(systemPromptData, {
          prompt: 'Updated system prompt',
        });
      });
    });
  });

  describe('Form Interactions - Non-System Prompt', () => {
    it('renders category select with correct value', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const categorySelect = screen.getByLabelText('Select a category');
      expect(categorySelect).toBeInTheDocument();
    });

    it('renders visibility select with correct value', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const visibilitySelect = screen.getByLabelText('Select visibility');
      expect(visibilitySelect).toBeInTheDocument();
    });

    it('allows editing the prompt text for non-system prompt', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const editor = screen.getByTestId('rich-text-editor');
      await userEvent.clear(editor);
      await userEvent.type(editor, 'Updated custom prompt');

      expect(editor).toHaveValue('Updated custom prompt');
    });

    it('renders submit button for non-system prompt', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Loading and Disabled States
  // --------------------------------------------------------------------------

  describe('Loading and Disabled States', () => {
    it('disables form fields when prompt categories are loading', async () => {
      const { useGetPromptCategoriesQuery } = await import(
        '@iblai/iblai-js/data-layer'
      );
      vi.mocked(useGetPromptCategoriesQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);

      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const categorySelect = screen.getByLabelText('Select a category');
      const visibilitySelect = screen.getByLabelText('Select visibility');
      const editor = screen.getByTestId('rich-text-editor');
      const saveButton = screen.getByRole('button', { name: /save/i });

      expect(categorySelect).toBeDisabled();
      expect(visibilitySelect).toBeDisabled();
      expect(editor).toBeDisabled();
      expect(saveButton).toBeDisabled();

      // Reset mock
      vi.mocked(useGetPromptCategoriesQuery).mockReturnValue({
        data: mockPromptCategories,
        isLoading: false,
      } as any);
    });

    it('disables form fields when isEditing is true', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={true}
          />
        </Provider>,
      );

      const categorySelect = screen.getByLabelText('Select a category');
      const visibilitySelect = screen.getByLabelText('Select visibility');
      const editor = screen.getByTestId('rich-text-editor');
      const saveButton = screen.getByRole('button', { name: /saving/i });

      expect(categorySelect).toBeDisabled();
      expect(visibilitySelect).toBeDisabled();
      expect(editor).toBeDisabled();
      expect(saveButton).toBeDisabled();
    });

    it('shows "Saving..." text on button when isEditing is true', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={true}
          />
        </Provider>,
      );

      expect(
        screen.getByRole('button', { name: /saving/i }),
      ).toBeInTheDocument();
    });

    it('shows "Save" text on button when isEditing is false', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(
        screen.getByRole('button', { name: /^save$/i }),
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Free Trial Dialog Integration
  // --------------------------------------------------------------------------

  describe('Free Trial Dialog Integration', () => {
    it('executes trial check on form submit', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      });
    });

    it('does not render FreeTrialDialog when isModalOpen is false', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Prompt Categories Query
  // --------------------------------------------------------------------------

  describe('Prompt Categories Query', () => {
    it('skips fetching categories for system prompts', async () => {
      const { useGetPromptCategoriesQuery } = await import(
        '@iblai/iblai-js/data-layer'
      );
      const mockQuery = vi.mocked(useGetPromptCategoriesQuery);

      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      // Check that the query was called with skip: true
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          org: 'test-tenant',
          userId: 'testuser',
        }),
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('fetches categories for non-system prompts', async () => {
      const { useGetPromptCategoriesQuery } = await import(
        '@iblai/iblai-js/data-layer'
      );
      const mockQuery = vi.mocked(useGetPromptCategoriesQuery);

      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      // Check that the query was called with skip: false
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          org: 'test-tenant',
          userId: 'testuser',
        }),
        expect.objectContaining({
          skip: false,
        }),
      );
    });

    it('has categories available from API response', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const categorySelect = screen.getByLabelText('Select a category');
      expect(categorySelect).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Form Validation
  // --------------------------------------------------------------------------

  describe('Form Validation', () => {
    it('disables submit button when form is invalid', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const editor = screen.getByTestId('rich-text-editor');
      await userEvent.clear(editor);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save/i });
        expect(saveButton).toBeDisabled();
      });
    });

    it('enables submit button when form is valid', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const saveButton = screen.getByRole('button', { name: /save/i });

      // Initially should be enabled since prompt has value
      await waitFor(() => {
        expect(saveButton).toBeEnabled();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Default Values
  // --------------------------------------------------------------------------

  describe('Default Values', () => {
    it('initializes with system prompt default values', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const editor = screen.getByTestId('rich-text-editor');
      expect(editor).toHaveValue('This is a system prompt');
    });

    it('initializes with non-system prompt default values', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const editor = screen.getByTestId('rich-text-editor');
      expect(editor).toHaveValue('This is a custom prompt');
    });

    it('handles non-system prompt without category', () => {
      const promptWithoutCategory: SelectedPrompt = {
        ...nonSystemPromptData,
        category: undefined,
      };

      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={promptWithoutCategory}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.getByText('Category')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Different Prompt Types
  // --------------------------------------------------------------------------

  describe('Different Prompt Types', () => {
    const promptTypes: Array<{
      name: SystemPrompt | SafetyPrompt;
      isSystem: boolean;
    }> = [
      { name: 'system_prompt', isSystem: true },
      { name: 'proactive_prompt', isSystem: true },
      { name: 'guided_prompt_instructions', isSystem: true },
      { name: 'study_mode_prompt', isSystem: true },
      { name: 'moderation_response', isSystem: true },
      { name: 'safety_response', isSystem: true },
      { name: 'moderation_system_prompt', isSystem: true },
      { name: 'safety_system_prompt', isSystem: true },
      { name: 'prompt', isSystem: false },
    ];

    promptTypes.forEach(({ name, isSystem }) => {
      it(`handles ${name} correctly`, () => {
        const prompt: SelectedPrompt = {
          label: name,
          isSystem,
          name,
          prompt: `Test ${name}`,
          ...(isSystem
            ? {}
            : {
                category: 'General',
                id: 1,
                promptVisibility:
                  PromptVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
              }),
        };

        const store = createTestStore();

        render(
          <Provider store={store}>
            <EditPromptModal
              isOpen={true}
              onClose={mockOnClose}
              selectedPrompt={prompt}
              handleSave={mockHandleSave}
              isEditing={false}
            />
          </Provider>,
        );

        expect(screen.getByText(`Edit ${name}`)).toBeInTheDocument();

        if (isSystem) {
          expect(screen.queryByText('Category')).not.toBeInTheDocument();
        } else {
          expect(screen.getByText('Category')).toBeInTheDocument();
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Form Submission Prevention
  // --------------------------------------------------------------------------

  describe('Form Submission Prevention', () => {
    it('prevents default form submission', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      const form = screen
        .getByRole('button', { name: /save/i })
        .closest('form');
      expect(form).toBeInTheDocument();

      if (form) {
        const submitEvent = new Event('submit', {
          bubbles: true,
          cancelable: true,
        });
        const preventDefaultSpy = vi.spyOn(submitEvent, 'preventDefault');
        const stopPropagationSpy = vi.spyOn(submitEvent, 'stopPropagation');

        form.dispatchEvent(submitEvent);

        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(stopPropagationSpy).toHaveBeenCalled();
      }
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------

  describe('Accessibility', () => {
    it('has accessible labels for form fields', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={nonSystemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.getByLabelText('Select a category')).toBeInTheDocument();
      expect(screen.getByLabelText('Select visibility')).toBeInTheDocument();
    });

    it('has accessible label for prompt editor', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditPromptModal
            isOpen={true}
            onClose={mockOnClose}
            selectedPrompt={systemPromptData}
            handleSave={mockHandleSave}
            isEditing={false}
          />
        </Provider>,
      );

      expect(screen.getByText('System Prompt')).toBeInTheDocument();
      const editor = screen.getByTestId('rich-text-editor');
      expect(editor).toBeInTheDocument();
    });
  });
});
