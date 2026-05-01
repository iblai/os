import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCreateMentor } from '../use-create-mentor';
import { toast } from 'sonner';

// Store the onSubmit callback so we can trigger it in tests
let onSubmitCallback: ((data: { value: any }) => void | Promise<void>) | null =
  null;

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

      expect(toast.success).toHaveBeenCalledWith('Mentor created successfully');
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

      expect(toast.error).toHaveBeenCalledWith('Failed to create mentor');
      consoleSpy.mockRestore();
    });
  });
});
