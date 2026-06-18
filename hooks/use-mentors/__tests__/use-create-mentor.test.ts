import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCreateMentor } from '../use-create-mentor';
import { toast } from 'sonner';

// Store the onSubmit callback so we can trigger it in tests
let onSubmitCallback: ((data: { value: any }) => void | Promise<void>) | null =
  null;
// Capture the defaultValues passed to useForm so we can assert prefill behaviour
let capturedDefaultValues: Record<string, any> | null = null;

// Mock form state that can be updated
let mockFormState = {
  name: '',
  description: '',
  category: null as number | null,
  file: null as File | null,
  base: 'default-agent',
  guidedPrompt: 'Guided prompt',
  systemPrompt: 'System prompt',
  proactivePrompt: 'Proactive prompt',
  moderationPrompt: 'Moderation prompt',
  mentorVisibility: 'public',
};

// Mock dependencies
vi.mock('@tanstack/react-form', () => ({
  useForm: vi.fn((config) => {
    // Store the onSubmit callback
    onSubmitCallback = config.onSubmit;
    // Store the defaultValues so tests can assert prefill/merge behaviour
    capturedDefaultValues = config.defaultValues;

    return {
      store: {
        subscribe: vi.fn(() => vi.fn()),
        getState: vi.fn(() => ({
          values: mockFormState,
        })),
      },
      setFieldValue: vi.fn((field: string, value: any) => {
        (mockFormState as any)[field] = value;
      }),
      handleSubmit: vi.fn(async () => {
        // Call the actual onSubmit callback when handleSubmit is called
        if (onSubmitCallback) {
          await onSubmitCallback({ value: mockFormState });
        }
      }),
      Field: vi.fn(),
      Subscribe: vi.fn(),
      reset: vi.fn(),
    };
  }),
  useStore: vi.fn((_store, selector) => {
    const state = {
      values: mockFormState,
    };
    return selector(state);
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

vi.mock('@/hooks/use-tenants', () => ({
  useTenantKey: vi.fn(() => ({ tenant: 'test-tenant' })),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: vi.fn(() => ({
    navigateToMentor: vi.fn(),
  })),
}));

// Note: a second `vi.mock('@iblai/iblai-js/data-layer', ...)` exists below
// that wires up controllable `mockCreateMentorWithSettings` / `mockUnwrap`
// references — that one is the source of truth. A duplicate factory was
// removed here to keep the active mock unambiguous (which factory "wins" can
// flip when the underlying package version changes the hoist order).

vi.mock('@/lib/constants', () => ({
  DEFAULT_PROMPTS: {
    DEFAULT_SYSTEM_PROMPT: 'System prompt',
    DEFAULT_MODERATION_PROMPT: 'Moderation prompt',
    DEFAULT_PROACTIVE_PROMPT: 'Proactive prompt',
    DEFAULT_GUIDED_PROMPT: 'Guided prompt',
  },
  MENTOR_VISIBILITY: [{ value: 'private' }, { value: 'public' }],
  MODEL_AGENTS: [{ value: 'default-agent' }],
}));

vi.mock('@/lib/config', () => ({
  config: {
    iblTemplateMentor: () => 'template-mentor',
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/platform/test-tenant/test-mentor'),
}));

const { mockCreateMentorWithSettings, mockUnwrap } = vi.hoisted(() => ({
  mockCreateMentorWithSettings: vi.fn(),
  mockUnwrap: vi.fn(),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useCreateMentorMutation: () => [
    (...args: unknown[]) => {
      mockCreateMentorWithSettings(...args);
      return { unwrap: mockUnwrap };
    },
    { isLoading: false },
  ],
}));

describe('useCreateMentor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedDefaultValues = null;
    mockUnwrap.mockResolvedValue({ unique_id: 'new-mentor-id' });

    // Reset mockFormState to default values before each test
    mockFormState = {
      name: '',
      description: '',
      category: null,
      file: null,
      base: 'default-agent',
      guidedPrompt: 'Guided prompt',
      systemPrompt: 'System prompt',
      proactivePrompt: 'Proactive prompt',
      moderationPrompt: 'Moderation prompt',
      mentorVisibility: 'public',
    };
  });

  describe('initialization', () => {
    it('returns form and state values', () => {
      const { result } = renderHook(() => useCreateMentor());

      expect(result.current.form).toBeDefined();
      expect(result.current.name).toBe('');
      expect(result.current.description).toBe('');
      expect(result.current.category).toBeNull();
      expect(result.current.file).toBeNull();
      expect(result.current.isLoadingCreateMentor).toBe(false);
      expect(result.current.editPrompt).toBeDefined();
    });

    it('has default prompt values', () => {
      const { result } = renderHook(() => useCreateMentor());

      expect(result.current.systemPrompt).toBe('System prompt');
      expect(result.current.guidedPrompt).toBe('Guided prompt');
      expect(result.current.proactivePrompt).toBe('Proactive prompt');
    });
  });

  describe('initialValues (prefill)', () => {
    it('uses the built-in defaults when no initialValues are provided', () => {
      renderHook(() => useCreateMentor());

      expect(capturedDefaultValues).toMatchObject({
        name: '',
        description: '',
        category: null,
        file: null,
        systemPrompt: 'System prompt',
        proactivePrompt: 'Proactive prompt',
        guidedPrompt: 'Guided prompt',
        moderationPrompt: 'Moderation prompt',
        mentorVisibility: 'public',
      });
    });

    it('merges provided initialValues over the defaults (including prompts)', () => {
      renderHook(() =>
        useCreateMentor({
          name: 'Prefilled Agent',
          description: 'Prefilled description',
          category: 7,
          systemPrompt: 'Custom system prompt',
          guidedPrompt: 'Custom guided prompt',
        }),
      );

      // Provided values win
      expect(capturedDefaultValues).toMatchObject({
        name: 'Prefilled Agent',
        description: 'Prefilled description',
        category: 7,
        systemPrompt: 'Custom system prompt',
        guidedPrompt: 'Custom guided prompt',
      });
      // Unspecified fields fall back to the defaults
      expect(capturedDefaultValues?.proactivePrompt).toBe('Proactive prompt');
      expect(capturedDefaultValues?.moderationPrompt).toBe('Moderation prompt');
      expect(capturedDefaultValues?.mentorVisibility).toBe('public');
    });

    it('does not mutate the shared defaults across calls', () => {
      renderHook(() => useCreateMentor({ name: 'First' }));
      const first = capturedDefaultValues;

      renderHook(() => useCreateMentor());
      const second = capturedDefaultValues;

      expect(first?.name).toBe('First');
      // A subsequent call with no overrides must still see the pristine default
      expect(second?.name).toBe('');
    });
  });

  describe('onCreated callback', () => {
    it('calls onCreated after a successful creation', async () => {
      const onCreated = vi.fn();
      const { result } = renderHook(() =>
        useCreateMentor(undefined, onCreated),
      );

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(onCreated).toHaveBeenCalledTimes(1);
    });

    it('does not call onCreated when creation fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockUnwrap.mockRejectedValue({ error: { error: 'boom' } });

      const onCreated = vi.fn();
      const { result } = renderHook(() =>
        useCreateMentor(undefined, onCreated),
      );

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(onCreated).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('still succeeds when onCreated is not provided', async () => {
      const { result } = renderHook(() => useCreateMentor());

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(toast.success).toHaveBeenCalledWith('Agent created successfully');
    });
  });

  describe('editPrompt', () => {
    it('updates system prompt', async () => {
      const { result, rerender } = renderHook(() => useCreateMentor());

      await act(async () => {
        result.current.editPrompt('New system prompt', 'systemPrompt');
      });

      // Force a re-render to get the updated value
      rerender();

      expect(result.current.systemPrompt).toBe('New system prompt');
    });

    it('updates guided prompt', async () => {
      const { result, rerender } = renderHook(() => useCreateMentor());

      await act(async () => {
        result.current.editPrompt('New guided prompt', 'guidedPrompt');
      });

      // Force a re-render to get the updated value
      rerender();

      expect(result.current.guidedPrompt).toBe('New guided prompt');
    });

    it('updates proactive prompt', async () => {
      const { result, rerender } = renderHook(() => useCreateMentor());

      await act(async () => {
        result.current.editPrompt('New proactive prompt', 'proactivePrompt');
      });

      // Force a re-render to get the updated value
      rerender();

      expect(result.current.proactivePrompt).toBe('New proactive prompt');
    });
  });

  describe('form submission', () => {
    it('calls createMentorWithSettings with correct data on submit', async () => {
      const { result } = renderHook(() => useCreateMentor());

      // Set form values
      await act(async () => {
        result.current.form.setFieldValue('name', 'Test Mentor');
        result.current.form.setFieldValue('description', 'Test Description');
      });

      // Submit form
      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(mockCreateMentorWithSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          org: 'test-tenant',
          formData: expect.objectContaining({
            new_mentor_name: 'Test Mentor',
            display_name: 'Test Mentor',
            description: 'Test Description',
          }),
          userId: 'test-user',
        }),
      );
    });

    it('shows success toast on successful creation', async () => {
      const { result } = renderHook(() => useCreateMentor());

      await act(async () => {
        result.current.form.setFieldValue('name', 'Test Mentor');
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(toast.success).toHaveBeenCalledWith('Agent created successfully');
    });

    it('shows error toast on failed creation', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockUnwrap.mockRejectedValue({
        error: { error: 'Custom error message' },
      });

      const { result } = renderHook(() => useCreateMentor());

      await act(async () => {
        result.current.form.setFieldValue('name', 'Test Mentor');
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith('Custom error message');
      consoleSpy.mockRestore();
    });

    it('shows default error message when no specific error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockUnwrap.mockRejectedValue({});

      const { result } = renderHook(() => useCreateMentor());

      await act(async () => {
        result.current.form.setFieldValue('name', 'Test Mentor');
      });

      await act(async () => {
        await result.current.form.handleSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to create agent');
      consoleSpy.mockRestore();
    });
  });
});
