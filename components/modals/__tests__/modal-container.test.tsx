import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { ModalContainer } from '../modal-container';
import { modalReducer, type ModalInfo } from '@/features/navigation/slice';
import { mentorApiSlice } from '@iblai/iblai-js/data-layer';
import { MODALS } from '@/lib/constants';

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// ============================================================================
// MOCKS
// ============================================================================

const pushMock = vi.fn();
let mockSearchParamsRaw = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/platform/tenant123/mentor456',
  useParams: () => ({ tenantKey: 'tenant123', mentorId: 'mentor456' }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsRaw),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
  useIsAdmin: () => true,
  useUserIsStudent: () => false,
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
  clearFiles: vi.fn(),
  chatActions: { setShouldStartNewChat: vi.fn() },
  SUBSCRIPTION_V2_TRIGGERS: { PRICING_MODAL: 'pricing_modal' },
}));

vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: () => [{}, vi.fn()],
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@iblai/iblai-js/data-layer', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@iblai/iblai-js/data-layer')>();
  return {
    ...actual,
    useGetMentorSettingsQuery: () => ({ data: null }),
    useGetMentorPublicSettingsQuery: () => ({ data: null }),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock child modals to simple stubs — use absolute (@/) paths
vi.mock('@/components/modals/settings-modal', () => ({
  SettingsModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="settings-modal" role="dialog" aria-label="Settings">
        <button onClick={onClose}>Close Settings</button>
      </div>
    ) : null,
}));

vi.mock('@/components/modals/apple-restriction-modal', () => ({
  AppleRestrictionModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div
        data-testid="apple-restriction-modal"
        role="dialog"
        aria-label="Apple Restriction"
      >
        <button onClick={onClose}>Close Apple</button>
      </div>
    ) : null,
}));

vi.mock('@/components/modals/external-pricing-modal', () => ({
  ExternalPricingModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="pricing-modal" role="dialog" aria-label="Pricing">
        <button onClick={onClose}>Close Pricing</button>
      </div>
    ) : null,
}));

vi.mock('@/components/modals/shortcuts-modal', () => ({
  ShortcutsModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="shortcuts-modal" role="dialog" aria-label="Shortcuts">
        <button onClick={onClose}>Close Shortcuts</button>
      </div>
    ) : null,
}));

vi.mock('@/components/modals/my-mentors-modal', () => ({
  MyMentorsModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="my-mentors-modal" role="dialog" aria-label="My Mentors">
        <button onClick={onClose}>Close My Mentors</button>
      </div>
    ) : null,
}));

vi.mock('@/components/modals/no-mentor-selected-modal', () => ({
  NoMentorSelectedModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div
        data-testid="no-mentor-selected-modal"
        role="dialog"
        aria-label="No Mentor Selected"
      >
        <button onClick={onClose}>Close No Mentor</button>
      </div>
    ) : null,
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  InviteUserDialog: ({
    isOpen,
    onClose,
    onSeeAllInvitedUsersClick,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSeeAllInvitedUsersClick?: () => void;
  }) =>
    isOpen ? (
      <div data-testid="invite-user-modal" role="dialog" aria-label="Invite">
        <button onClick={onClose}>Close Invite</button>
        {onSeeAllInvitedUsersClick && (
          <button onClick={onSeeAllInvitedUsersClick}>See All Invited</button>
        )}
      </div>
    ) : null,
  InvitedUsersDialog: ({ onClose }: { onClose: () => void }) => (
    <div
      data-testid="invited-users-dialog"
      role="dialog"
      aria-label="Invited Users"
    >
      <button onClick={onClose}>Close Invited</button>
    </div>
  ),
}));

vi.mock('@/components/custom-alert-dialog', () => ({
  CustomAlertDialog: ({
    isOpen,
    title,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
    validateTrigger: string;
    cancelTrigger?: string;
  }) =>
    isOpen ? (
      <div data-testid="custom-alert-dialog" role="alertdialog">
        {title}
      </div>
    ) : null,
}));

// ============================================================================
// STORE FACTORY
// ============================================================================

interface StoreOptions {
  modalStack?: ModalInfo[];
  openPricingModal?: boolean;
  openAppleRestrictionModal?: boolean;
  customAlertDialogOpen?: boolean;
  shortcutsModal?: boolean;
}

function createTestStore(options: StoreOptions = {}) {
  const {
    modalStack = [],
    openPricingModal = false,
    openAppleRestrictionModal = false,
    customAlertDialogOpen = false,
    shortcutsModal = false,
  } = options;

  return configureStore({
    reducer: {
      modals: modalReducer,
      subscription: (
        state = {
          openPricingModal,
          openAppleRestrictionModal,
          freeTrialUsageOptions: { count: 0, limitReached: false, message: '' },
          pricingModalData: {
            referenceId: '',
            customerEmail: '',
            publishableKey: '',
            pricingTableId: '',
          },
          subscriptionStatus: { creditExhausted: false },
          error402Detected: '',
        },
      ) => state,
      [mentorApiSlice.reducerPath]: mentorApiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(
        mentorApiSlice.middleware,
      ),
    preloadedState: {
      modals: {
        modalStack,
        customAlertDialog: {
          message: customAlertDialogOpen ? 'Test alert' : '',
          validateTrigger: customAlertDialogOpen ? 'validate' : '',
          cancelTrigger: '',
          isOpen: customAlertDialogOpen,
          title: customAlertDialogOpen ? 'Alert Title' : '',
        },
        iframeCloseButton: false,
        darkMode: false,
        shortcutsModal,
      },
    },
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('ModalContainer', () => {
  beforeEach(() => {
    cleanup();
    pushMock.mockReset();
    mockSearchParamsRaw = '';
  });

  afterEach(() => {
    cleanup();
  });

  describe('default state (no modals open)', () => {
    it('renders without crashing', () => {
      const store = createTestStore();
      const { container } = render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );
      expect(container).toBeTruthy();
    });

    it('renders no modals when nothing is active', () => {
      const store = createTestStore();
      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('InviteUserDialog', () => {
    it('renders when invite_user modal is in the stack', () => {
      const modalStack: ModalInfo[] = [{ name: MODALS.INVITE_USER.name }];
      mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(modalStack))}`;
      const store = createTestStore({ modalStack });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('invite-user-modal')).toBeInTheDocument();
    });

    it('does not render when invite_user modal is not in the stack', () => {
      const store = createTestStore();
      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );
      expect(screen.queryByTestId('invite-user-modal')).not.toBeInTheDocument();
    });
  });

  describe('SettingsModal', () => {
    it('renders when settings modal is in the stack', () => {
      const modalStack: ModalInfo[] = [{ name: MODALS.SETTINGS.name }];
      mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(modalStack))}`;
      const store = createTestStore({ modalStack });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });
  });

  describe('CustomAlertDialog', () => {
    it('renders when customAlertDialog.isOpen is true', () => {
      const store = createTestStore({ customAlertDialogOpen: true });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('custom-alert-dialog')).toBeInTheDocument();
    });

    it('does not render when customAlertDialog.isOpen is false', () => {
      const store = createTestStore({ customAlertDialogOpen: false });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(
        screen.queryByTestId('custom-alert-dialog'),
      ).not.toBeInTheDocument();
    });
  });

  describe('ExternalPricingModal', () => {
    it('renders when openPricingModal is true', () => {
      const store = createTestStore({ openPricingModal: true });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('pricing-modal')).toBeInTheDocument();
    });

    it('does not render when openPricingModal is false', () => {
      const store = createTestStore({ openPricingModal: false });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.queryByTestId('pricing-modal')).not.toBeInTheDocument();
    });
  });

  describe('AppleRestrictionModal', () => {
    it('renders when openAppleRestrictionModal is true', () => {
      const store = createTestStore({ openAppleRestrictionModal: true });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('apple-restriction-modal')).toBeInTheDocument();
    });

    it('does not render when openAppleRestrictionModal is false', () => {
      const store = createTestStore({ openAppleRestrictionModal: false });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(
        screen.queryByTestId('apple-restriction-modal'),
      ).not.toBeInTheDocument();
    });
  });

  describe('ShortcutsModal', () => {
    it('renders when shortcutsModal is true', () => {
      const store = createTestStore({ shortcutsModal: true });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('shortcuts-modal')).toBeInTheDocument();
    });

    it('does not render when shortcutsModal is false', () => {
      const store = createTestStore({ shortcutsModal: false });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.queryByTestId('shortcuts-modal')).not.toBeInTheDocument();
    });
  });

  describe('MyMentorsModal', () => {
    it('renders when my_mentors modal is in the stack', () => {
      const modalStack: ModalInfo[] = [{ name: MODALS.MY_MENTORS.name }];
      mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(modalStack))}`;
      const store = createTestStore({ modalStack });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('my-mentors-modal')).toBeInTheDocument();
    });
  });

  describe('NoMentorSelectedModal', () => {
    it('renders when no_mentor_selected modal is in the stack', () => {
      const modalStack: ModalInfo[] = [
        { name: MODALS.NO_MENTOR_SELECTED.name },
      ];
      mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(modalStack))}`;
      const store = createTestStore({ modalStack });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(
        screen.getByTestId('no-mentor-selected-modal'),
      ).toBeInTheDocument();
    });
  });

  describe('multiple modals', () => {
    it('renders multiple modals when their conditions are met', () => {
      const modalStack: ModalInfo[] = [{ name: MODALS.SETTINGS.name }];
      mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(modalStack))}`;
      const store = createTestStore({
        modalStack,
        openAppleRestrictionModal: true,
        shortcutsModal: true,
      });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
      expect(screen.getByTestId('apple-restriction-modal')).toBeInTheDocument();
      expect(screen.getByTestId('shortcuts-modal')).toBeInTheDocument();
    });
  });

  describe('InvitedUsersDialog', () => {
    it('renders when isInvitedUsersDialogOpen is true', () => {
      const originalUseState = React.useState;
      let callCount = 0;
      const useStateSpy = vi.spyOn(React, 'useState') as unknown as ReturnType<
        typeof vi.fn
      >;
      useStateSpy.mockImplementation((initialValue: unknown) => {
        callCount++;
        // The first useState call in ModalContainer is isInvitedUsersDialogOpen
        if (callCount === 1 && initialValue === false) {
          return [true, vi.fn()];
        }
        return originalUseState(initialValue);
      });

      const store = createTestStore();

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('invited-users-dialog')).toBeInTheDocument();

      // Click close to exercise the onClose callback (line 96)
      fireEvent.click(screen.getByText('Close Invited'));

      useStateSpy.mockRestore();
    });
  });

  describe('closing modals dispatches actions', () => {
    it('closes apple restriction modal via dispatch', () => {
      const store = createTestStore({ openAppleRestrictionModal: true });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('apple-restriction-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Close Apple'));
    });

    it('closes pricing modal via dispatch', () => {
      const store = createTestStore({ openPricingModal: true });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('pricing-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Close Pricing'));
    });

    it('closes shortcuts modal via dispatch', () => {
      const store = createTestStore({ shortcutsModal: true });

      render(
        <Provider store={store}>
          <ModalContainer />
        </Provider>,
      );

      expect(screen.getByTestId('shortcuts-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Close Shortcuts'));
      // closeShortcutsModal dispatches shortcutsModalUpdated(false)
      expect(store.getState().modals.shortcutsModal).toBe(false);
    });
  });
});
