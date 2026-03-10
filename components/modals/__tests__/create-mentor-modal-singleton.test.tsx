import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { modalReducer, type ModalInfo } from '@/features/navigation/slice';
import { mentorApiSlice } from '@iblai/iblai-js/data-layer';
import { MODALS } from '@/lib/constants';

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

// Mock URL.createObjectURL for jsdom environment
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// ============================================================================
// MOCKS
// ============================================================================

// Track URL push calls
const pushMock = vi.fn();
let mockSearchParamsRaw = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => '/platform/tenant123/mentor456',
  useParams: () => ({ tenantKey: 'tenant123', mentorId: 'mentor456' }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsRaw),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
  useUserIsStudent: () => false,
  useIsAdmin: () => true,
  useIsVisiting: () => false,
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: (fn: () => void) => fn(),
    FreeTrialDialog: null,
    closeModal: vi.fn(),
    isModalOpen: false,
  }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({
    toggleSidebar: vi.fn(),
    open: false,
    isMobile: false,
  }),
}));

vi.mock('@/lib/eventBus', () => ({
  default: { emit: vi.fn() },
  RemoteEvents: {},
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantContext: () => ({
    setDetermineUserPath: vi.fn(),
    determineUserPath: false,
    tenantKey: 'tenant123',
    metadata: {},
    setMetadata: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: () => [{}, vi.fn()],
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@iblai/iblai-js/data-layer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@iblai/iblai-js/data-layer')>();
  return {
    ...actual,
    useEditMentorAndRefreshListMutation: () => [vi.fn(), { isLoading: false }],
    useGetMentorCategoriesQuery: () => ({ data: [], isLoading: false }),
  };
});

vi.mock('@/hooks/use-mentors', () => ({
  useMentorsWithPagination: () => ({
    mentors: [],
    isLoading: false,
    isFetching: false,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    currentPage: 1,
    totalPages: 1,
    handlePageChange: vi.fn(),
    queryParams: {},
  }),
}));

vi.mock('@/hooks/use-tenants', () => ({
  useTenantKey: () => ({ tenant: 'tenant123' }),
}));

vi.mock('@/hooks/use-mentors/use-create-mentor', () => ({
  useCreateMentor: () => ({
    form: {
      Field: ({ children }: any) =>
        children({ state: { value: '', meta: { isDirty: false } }, handleChange: vi.fn() }),
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
  }),
}));

// Mock EditMentorModal to avoid complex dependencies
vi.mock('../edit-mentor-modal', () => ({
  EditMentorModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="mock-edit-mentor-modal" role="dialog" aria-label="Edit Mentor">
        <button onClick={onClose}>Close Edit Modal</button>
      </div>
    ) : null,
}));

// ============================================================================
// TEST STORE FACTORY
// ============================================================================

function createTestStore(preloadedStack: ModalInfo[] = []) {
  return configureStore({
    reducer: {
      modals: modalReducer,
      [mentorApiSlice.reducerPath]: mentorApiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }).concat(mentorApiSlice.middleware),
    preloadedState: {
      modals: {
        modalStack: preloadedStack,
        customAlertDialog: {
          message: '',
          validateTrigger: '',
          cancelTrigger: '',
          isOpen: false,
          title: '',
        },
        iframeCloseButton: false,
        darkMode: false,
        shortcutsModal: false,
      },
    },
  });
}

// ============================================================================
// TEST COMPONENT - Simulates the layout that renders CreateMentorModal
// ============================================================================

import { SettingsModal } from '../settings-modal';
import { CreateMentorModal } from '../create-mentor-modal';
import { useNavigate } from '@/hooks/user-navigate';

/**
 * TestLayoutWithNavBar simulates the actual app layout where:
 * - NavBar (parent) renders CreateMentorModal based on Redux state
 * - SettingsModal (child) can trigger openCreateMentorModal
 *
 * This is the pattern we're testing to ensure no duplicate modals.
 */
function TestLayoutWithNavBar() {
  const {
    showCreateMentorModal,
    closeCreateMentorModal,
    showSettingsModal,
    closeSettingsModal,
    openSettingsModal,
    openCreateMentorModal,
  } = useNavigate();

  return (
    <div data-testid="test-layout">
      {/* Trigger buttons for testing */}
      <button data-testid="open-settings" onClick={() => openSettingsModal()}>
        Open Settings
      </button>
      <button data-testid="open-create-mentor-direct" onClick={() => openCreateMentorModal()}>
        Open Create Mentor Direct
      </button>

      {/* Settings Modal - should NOT render CreateMentorModal anymore */}
      {showSettingsModal && (
        <SettingsModal isOpen={showSettingsModal} onClose={closeSettingsModal} />
      )}

      {/* NavBar's CreateMentorModal - the ONLY place it should be rendered */}
      {showCreateMentorModal && (
        <CreateMentorModal isOpen={showCreateMentorModal} onClose={closeCreateMentorModal} />
      )}
    </div>
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe('CreateMentorModal Singleton Behavior', () => {
  beforeEach(() => {
    cleanup();
    pushMock.mockReset();
    mockSearchParamsRaw = '';
  });

  afterEach(() => {
    cleanup();
  });

  // --------------------------------------------------------------------------
  // Core Singleton Tests
  // --------------------------------------------------------------------------

  describe('Only One CreateMentorModal Rendered', () => {
    it('renders exactly one CreateMentorModal when opened via direct button', async () => {
      const modalStack: ModalInfo[] = [{ name: MODALS.CREATE_MENTOR.name }];
      mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(modalStack))}`;
      const store = createTestStore(modalStack);

      render(
        <Provider store={store}>
          <TestLayoutWithNavBar />
        </Provider>,
      );

      await waitFor(() => {
        // Query all dialogs in the document (dialogs render via portal to body)
        const dialogs = document.querySelectorAll('[role="dialog"]');

        // Should only have ONE dialog
        expect(dialogs.length).toBe(1);
      });
    });

    it('does not render CreateMentorModal when modal is not open', () => {
      mockSearchParamsRaw = '';
      const store = createTestStore([]);

      render(
        <Provider store={store}>
          <TestLayoutWithNavBar />
        </Provider>,
      );

      // No dialogs should exist
      const dialogs = document.querySelectorAll('[role="dialog"]');
      expect(dialogs.length).toBe(0);
    });

    it('renders exactly one CreateMentorModal when triggered from SettingsModal', async () => {
      // Start with both settings and create_mentor in the stack
      const modalStack: ModalInfo[] = [
        { name: MODALS.SETTINGS.name },
        { name: MODALS.CREATE_MENTOR.name },
      ];
      mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(modalStack))}`;
      const store = createTestStore(modalStack);

      render(
        <Provider store={store}>
          <TestLayoutWithNavBar />
        </Provider>,
      );

      await waitFor(() => {
        // Query all dialogs in the document
        const dialogs = document.querySelectorAll('[role="dialog"]');

        // Should have 2 dialogs: SettingsModal + CreateMentorModal (from NavBar)
        // NOT 3 (which would happen if SettingsModal also rendered CreateMentorModal)
        expect(dialogs.length).toBe(2);

        // Verify we have exactly one "Create Mentor" dialog
        const createMentorDialogs = Array.from(dialogs).filter((dialog) => {
          const title = dialog.querySelector('.ibl-dialog-title');
          return title?.textContent === 'Create Mentor';
        });
        expect(createMentorDialogs.length).toBe(1);

        // Verify we have exactly one "Settings" dialog
        const settingsDialogs = Array.from(dialogs).filter((dialog) => {
          const title = dialog.querySelector('.ibl-dialog-title');
          return title?.textContent === 'Settings';
        });
        expect(settingsDialogs.length).toBe(1);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Modal Stack Behavior Tests
  // --------------------------------------------------------------------------

  describe('Modal Stack Behavior', () => {
    it('opening CreateMentorModal pushes it to the modal stack', async () => {
      mockSearchParamsRaw = '';
      const store = createTestStore([]);

      render(
        <Provider store={store}>
          <TestLayoutWithNavBar />
        </Provider>,
      );

      // Click direct open button
      fireEvent.click(screen.getByTestId('open-create-mentor-direct'));

      // Verify push was called with create_mentor in stack
      expect(pushMock).toHaveBeenCalled();
      const pushArg = pushMock.mock.calls[0]?.[0] as string;
      expect(pushArg).toContain('create_mentor');
    });
  });

  // --------------------------------------------------------------------------
  // Regression Tests
  // --------------------------------------------------------------------------

  describe('Regression Tests - No Duplicate Modals', () => {
    it('SettingsModal does not render its own CreateMentorModal (fixed regression)', async () => {
      // This test verifies the fix for the bug where SettingsModal
      // was rendering its own CreateMentorModal in addition to NavBar's

      const modalStack: ModalInfo[] = [
        { name: MODALS.SETTINGS.name },
        { name: MODALS.CREATE_MENTOR.name },
      ];
      mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(modalStack))}`;
      const store = createTestStore(modalStack);

      render(
        <Provider store={store}>
          <TestLayoutWithNavBar />
        </Provider>,
      );

      await waitFor(() => {
        // Count all "Create Mentor" dialogs
        const allDialogs = document.querySelectorAll('[role="dialog"]');
        const createMentorDialogCount = Array.from(allDialogs).filter((dialog) => {
          const title = dialog.querySelector('.ibl-dialog-title');
          return title?.textContent === 'Create Mentor';
        }).length;

        // Should be exactly 1, not 2 (which was the bug)
        expect(createMentorDialogCount).toBe(1);
      });
    });
  });
});
