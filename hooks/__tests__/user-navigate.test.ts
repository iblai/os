import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNavigate, useSidebarNavigation } from '../user-navigate';

// ---- Hoisted mocks ----
const mocked = vi.hoisted(() => ({
  // next/navigation mocks
  push: vi.fn(),
  pathname: '/platform/test-tenant/mentor-123',
  useParams: vi.fn(() => ({
    tenantKey: 'test-tenant',
    mentorId: 'mentor-123',
  })) as any,
  useSearchParams: vi.fn(() => new URLSearchParams()),

  // Redux mocks
  dispatch: vi.fn(),

  // Navigation slice selectors/actions
  selectModalStack: vi.fn(() => []) as any,
  selectModalMentorId: vi.fn(() => undefined),
  setModalStack: vi.fn((payload) => ({ type: 'setModalStack', payload })),

  // Chat actions
  setShouldStartNewChat: vi.fn((payload) => ({
    type: 'setShouldStartNewChat',
    payload,
  })),
  clearFiles: vi.fn(() => ({ type: 'clearFiles' })),

  // Hooks
  useUsername: vi.fn(() => 'test-user'),
  useShowFreeTrialDialog: vi.fn(() => ({
    executeWithTrialCheck: (fn: () => void) => fn(),
    isNewlyUserOnPreFreeOrAdvertisingMode: () => false,
  })),
  useTenantContext: vi.fn(() => ({
    setDetermineUserPath: vi.fn(),
  })),
  useLocalStorage: vi.fn(() => [{}, vi.fn()]),

  // Data layer queries
  useGetMentorSettingsQuery: vi.fn(() => ({
    data: undefined,
  })),
  useGetMentorPublicSettingsQuery: vi.fn(() => ({
    data: undefined,
  })),

  // Event bus
  emit: vi.fn(),

  // Config
  mainTenantKey: vi.fn(() => 'main-tenant'),
  hideAnalytics: vi.fn(() => 'false'),
}));

// ---- Mock modules ----
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocked.push }),
  usePathname: () => mocked.pathname,
  useParams: mocked.useParams,
  useSearchParams: mocked.useSearchParams,
}));

vi.mock('react-redux', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-redux')>();
  return {
    ...actual,
    useDispatch: () => mocked.dispatch,
    useSelector: (selector: any) =>
      selector({ modals: { modalStack: mocked.selectModalStack() as any } }),
  };
});

vi.mock('@/features/navigation/slice', () => ({
  setModalStack: mocked.setModalStack,
  selectModalStack: (state: any) => state.modals.modalStack,
  selectModalMentorId: mocked.selectModalMentorId,
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  chatActions: {
    setShouldStartNewChat: mocked.setShouldStartNewChat,
  },
  clearFiles: mocked.clearFiles,
  useTenantContext: mocked.useTenantContext,
}));

vi.mock('@/lib/constants', () => ({
  ANONYMOUS_USERNAME: 'anonymous',
  LOCAL_STORAGE_KEYS: {
    SESSION_ID: 'session_id',
  },
  MODALS: {
    CREATE_MENTOR: { name: 'create_mentor' },
    INVITE_USER: { name: 'invite_user' },
    SETTINGS: { name: 'settings' },
    MY_MENTORS: { name: 'my_mentors' },
    LLM_PROVIDERS: { name: 'llm_providers' },
    EDIT_MENTOR: {
      name: 'edit_mentor',
      tabs: {
        settings: 'settings',
        llm: 'llm',
        prompts: 'prompts',
      },
    },
    ADD_PROMPT: { name: 'add_prompt' },
    ADD_RESOURCE: { name: 'add_resource' },
    NO_MENTOR_SELECTED: { name: 'no_mentor_selected' },
  },
  UserType: {
    STUDENT: 'student',
    FREE_TRIAL: 'free_trial',
    ADMIN: 'admin',
    ANONYMOUS: 'anonymous',
    VISITING: 'visiting',
  },
}));

vi.mock('@/lib/eventBus', () => ({
  default: {
    emit: mocked.emit,
  },
  RemoteEvents: {
    newChat: 'MENTOR:NEW_CHAT',
  },
}));

vi.mock('@/lib/config', () => ({
  config: {
    mainTenantKey: mocked.mainTenantKey,
    hideAnalytics: mocked.hideAnalytics,
  },
}));

vi.mock('../use-user', () => ({
  useUsername: mocked.useUsername,
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: mocked.useGetMentorSettingsQuery,
  useGetMentorPublicSettingsQuery: mocked.useGetMentorPublicSettingsQuery,
}));

vi.mock('@iblai/iblai-api', () => ({
  MentorVisibilityEnum: {
    VIEWABLE_BY_ANYONE: 'viewable_by_anyone',
  },
}));

vi.mock('../user-user-actions', () => ({
  useShowFreeTrialDialog: mocked.useShowFreeTrialDialog,
}));

vi.mock('../use-local-storage', () => ({
  useLocalStorage: mocked.useLocalStorage,
}));

vi.mock('lucide-react', () => ({
  ChartLine: () => null,
  Globe2: () => null,
  Mail: () => null,
  PenSquare: () => null,
  CirclePlus: () => null,
  Settings: () => null,
  LucideMail: () => null,
  Workflow: () => null,
}));

describe('user-navigate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.pathname = '/platform/test-tenant/mentor-123';
    mocked.useParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'mentor-123',
    });
    mocked.useSearchParams.mockReturnValue(new URLSearchParams());
    mocked.selectModalStack.mockReturnValue([]);
    mocked.selectModalMentorId.mockReturnValue(undefined);
    mocked.useGetMentorSettingsQuery.mockReturnValue({ data: undefined });
    mocked.useGetMentorPublicSettingsQuery.mockReturnValue({ data: undefined });
    mocked.useLocalStorage.mockReturnValue([{}, vi.fn()]);
    mocked.useTenantContext.mockReturnValue({ setDetermineUserPath: vi.fn() });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useNavigate', () => {
    describe('parseModalStack', () => {
      it('should return empty array when no modal param', () => {
        const { result } = renderHook(() => useNavigate());
        expect(result.current.modalStack).toEqual([]);
      });

      it('should parse valid JSON modal stack', () => {
        const modalStack = [
          { name: 'settings' },
          { name: 'profile', tab: 'general' },
        ];
        mocked.useSearchParams.mockReturnValue(
          new URLSearchParams({ modal: JSON.stringify(modalStack) }),
        );

        renderHook(() => useNavigate());

        expect(mocked.setModalStack).toHaveBeenCalledWith(modalStack);
      });

      it('should handle single modal object', () => {
        const modal = { name: 'settings', tab: 'general' };
        mocked.useSearchParams.mockReturnValue(
          new URLSearchParams({ modal: JSON.stringify(modal) }),
        );

        renderHook(() => useNavigate());

        expect(mocked.setModalStack).toHaveBeenCalledWith([modal]);
      });

      it('should handle backward compatibility with string modal name', () => {
        mocked.useSearchParams.mockReturnValue(
          new URLSearchParams({ modal: 'settings' }),
        );

        renderHook(() => useNavigate());

        expect(mocked.setModalStack).toHaveBeenCalledWith([
          { name: 'settings' },
        ]);
      });

      it('should return empty array for invalid JSON', () => {
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        // Set initial Redux stack to be non-empty so dispatch will happen
        mocked.selectModalStack.mockReturnValue([{ name: 'someModal' }]);

        mocked.useSearchParams.mockReturnValue(
          new URLSearchParams({ modal: '{invalid json}' }),
        );

        renderHook(() => useNavigate());

        // Should call setModalStack with empty array after catching JSON parse error
        expect(mocked.setModalStack).toHaveBeenCalledWith([]);
        consoleErrorSpy.mockRestore();
      });

      it('should warn for invalid modal stack format', () => {
        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        mocked.useSearchParams.mockReturnValue(
          new URLSearchParams({
            modal: JSON.stringify([{ invalid: 'object' }]),
          }),
        );

        renderHook(() => useNavigate());

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Invalid modal stack format'),
          expect.any(String),
        );
        consoleWarnSpy.mockRestore();
      });
    });

    describe('navigation functions', () => {
      it('navigateToHome - should navigate to home with tenantKey and mentorId', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToHome();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('navigateToHome - should navigate to home with only tenantKey', () => {
        mocked.useParams.mockReturnValue({ tenantKey: 'test-tenant' });
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToHome();

        expect(mocked.push).toHaveBeenCalledWith('/platform/test-tenant');
      });

      it('navigateToHome - should warn when tenantKey is missing', () => {
        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});
        mocked.useParams.mockReturnValue({});
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToHome();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cannot navigate to home'),
        );
        consoleWarnSpy.mockRestore();
      });

      it('navigateToExplore - should navigate to explore with mentorId', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToExplore();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123/explore',
        );
      });

      it('navigateToExplore - should navigate to explore without mentorId when requested', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToExplore(true);

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/explore',
        );
      });

      it('navigateToExplore - should navigate with only tenantKey', () => {
        mocked.useParams.mockReturnValue({ tenantKey: 'test-tenant' });
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToExplore();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/explore',
        );
      });

      it('navigateToAnalytics - should navigate to analytics with mentorId', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToAnalytics();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123/analytics',
        );
      });

      it('navigateToAnalytics - should navigate to analytics without mentorId', () => {
        mocked.useParams.mockReturnValue({ tenantKey: 'test-tenant' });
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToAnalytics();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/analytics',
        );
      });

      it('navigateToMentor - should navigate to new mentor and clear session cache', () => {
        const saveCachedSessionId = vi.fn();
        mocked.useLocalStorage.mockReturnValue([
          { 'mentor-456': 'session-1' },
          saveCachedSessionId,
        ]);

        const { result } = renderHook(() => useNavigate());

        result.current.navigateToMentor('mentor-456');

        expect(saveCachedSessionId).toHaveBeenCalledWith({});
        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-456?switching-mentor=true',
        );
      });

      it('navigateToMentor - should navigate without switching param when same mentor', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToMentor('mentor-123');

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('navigateToMentor - should navigate with prependStackParam', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToMentor('mentor-456', 'tab=settings');

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-456?tab=settings&switching-mentor=true',
        );
      });

      it('navigateToMentor - should use newTenantKey when provided', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToMentor('mentor-456', undefined, 'new-tenant');

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/new-tenant/mentor-456?switching-mentor=true',
        );
      });

      it('navigateToMentorInProject - should navigate to mentor in project', () => {
        mocked.useParams.mockReturnValue({
          tenantKey: 'test-tenant',
          mentorId: 'mentor-123',
          projectId: 'project-1',
        });
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToMentorInProject('mentor-456');

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/projects/project-1/mentor-456?switching-mentor=true',
        );
      });

      it('navigateToMentorInProject - should use provided projectId', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToMentorInProject('mentor-456', 'project-2');

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/projects/project-2/mentor-456?switching-mentor=true',
        );
      });

      it('navigateToProject - should navigate to project with mentor', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToProject('project-1', 'mentor-456');

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/projects/project-1/mentor-456?switching-mentor=true',
        );
      });

      it('navigateToNotifications - should navigate to notifications with mentorId', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToNotifications();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123/notifications/',
        );
      });

      it('navigateToNotifications - should navigate to specific notification', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToNotifications('notif-123');

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123/notifications/notif-123',
        );
      });

      it('navigateToNotifications - should navigate without mentorId', () => {
        mocked.useParams.mockReturnValue({ tenantKey: 'test-tenant' });
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToNotifications();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/notifications/',
        );
      });

      it('navigateToMentorInProject - should warn when tenantKey is missing', () => {
        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});
        mocked.useParams.mockReturnValue({});
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToMentorInProject('mentor-456');

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cannot navigate to mentor'),
        );
        consoleWarnSpy.mockRestore();
      });

      it('navigateToProject - should warn when tenantKey is missing', () => {
        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});
        mocked.useParams.mockReturnValue({});
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToProject('project-1', 'mentor-456');

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cannot navigate to mentor'),
        );
        consoleWarnSpy.mockRestore();
      });

      it('navigateToNotifications - should warn when tenantKey is missing', () => {
        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});
        mocked.useParams.mockReturnValue({});
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToNotifications();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cannot navigate to notifications'),
        );
        consoleWarnSpy.mockRestore();
      });

      it('navigateToWorkflows - should navigate to workflows with mentorId', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToWorkflows();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/workflows/mentor-123',
        );
      });

      it('navigateToWorkflows - should navigate to workflows without mentorId when mentorId is missing', () => {
        mocked.useParams.mockReturnValue({ tenantKey: 'test-tenant' });
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToWorkflows();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/workflows',
        );
      });

      it('navigateToWorkflows - should warn when tenantKey is missing', () => {
        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});
        mocked.useParams.mockReturnValue({});
        const { result } = renderHook(() => useNavigate());

        result.current.navigateToWorkflows();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cannot navigate to workflows'),
        );
        consoleWarnSpy.mockRestore();
      });
    });

    describe('modal management', () => {
      it('openModal - should open a modal', () => {
        mocked.selectModalStack.mockReturnValue([]);
        const { result } = renderHook(() => useNavigate());

        result.current.openModal('settings');

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(JSON.stringify([{ name: 'settings' }])),
          ),
        );
      });

      it('openModal - should open modal with tab', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openModal('settings', 'general');

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(
                JSON.stringify([{ name: 'settings', tab: 'general' }]),
              ),
          ),
        );
      });

      it('openModal - should open modal with mentorId', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openModal('edit_mentor', 'settings', 'mentor-456');

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(
                JSON.stringify([
                  {
                    name: 'edit_mentor',
                    tab: 'settings',
                    mentorId: 'mentor-456',
                  },
                ]),
              ),
          ),
        );
      });

      it('openModal - should stack modals', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'settings' }]);
        const { result } = renderHook(() => useNavigate());

        result.current.openModal('profile');

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(
                JSON.stringify([{ name: 'settings' }, { name: 'profile' }]),
              ),
          ),
        );
      });

      it('closeModal - should remove modal param when only one modal', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'settings' }]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeModal();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('closeModal - should pop from stack when multiple modals', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'settings' },
          { name: 'profile' },
        ]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeModal();

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(JSON.stringify([{ name: 'settings' }])),
          ),
        );
      });

      it('closeModal - should do nothing when stack is empty', () => {
        mocked.selectModalStack.mockReturnValue([]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeModal();

        expect(mocked.push).not.toHaveBeenCalled();
      });

      it('changeModalTab - should update current modal tab', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'settings', tab: 'general' },
        ]);
        const { result } = renderHook(() => useNavigate());

        result.current.changeModalTab('advanced');

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(
                JSON.stringify([{ name: 'settings', tab: 'advanced' }]),
              ),
          ),
        );
      });

      it('changeModalTab - should do nothing when stack is empty', () => {
        mocked.selectModalStack.mockReturnValue([]);
        const { result } = renderHook(() => useNavigate());

        result.current.changeModalTab('advanced');

        expect(mocked.push).not.toHaveBeenCalled();
      });

      it('changeModalTab - should update only last modal in stack', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'settings', tab: 'general' },
          { name: 'profile', tab: 'info' },
        ]);
        const { result } = renderHook(() => useNavigate());

        result.current.changeModalTab('preferences');

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(
                JSON.stringify([
                  { name: 'settings', tab: 'general' },
                  { name: 'profile', tab: 'preferences' },
                ]),
              ),
          ),
        );
      });
    });

    describe('specific modal functions', () => {
      it('openCreateMentorModal - should open create mentor modal', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openCreateMentorModal();

        expect(mocked.push).toHaveBeenCalled();
      });

      it('openCreateMentorModal - should open with tab', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openCreateMentorModal('advanced');

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(
                JSON.stringify([{ name: 'create_mentor', tab: 'advanced' }]),
              ),
          ),
        );
      });

      it('openInviteUserModal - should open invite user modal', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openInviteUserModal();

        expect(mocked.push).toHaveBeenCalled();
      });

      it('openSettingsModal - should open settings modal', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openSettingsModal();

        expect(mocked.push).toHaveBeenCalled();
      });

      it('openMyMentorsModal - should open my mentors modal', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openMyMentorsModal();

        expect(mocked.push).toHaveBeenCalled();
      });

      it('openLLMProvidersModal - should open LLM providers modal', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openLLMProvidersModal();

        expect(mocked.push).toHaveBeenCalled();
      });

      it('openEditMentorModal - should open edit mentor modal with default settings tab', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openEditMentorModal();

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(
                JSON.stringify([{ name: 'edit_mentor', tab: 'settings' }]),
              ),
          ),
        );
      });

      it('openEditMentorModal - should open with custom tab', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openEditMentorModal('llm');

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(
                JSON.stringify([{ name: 'edit_mentor', tab: 'llm' }]),
              ),
          ),
        );
      });

      it('openEditMentorModal - should open with mentorId', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openEditMentorModal('prompts', 'mentor-456');

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining(
            'modal=' +
              encodeURIComponent(
                JSON.stringify([
                  {
                    name: 'edit_mentor',
                    tab: 'prompts',
                    mentorId: 'mentor-456',
                  },
                ]),
              ),
          ),
        );
      });

      it('openAddPromptModal - should open add prompt modal', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openAddPromptModal();

        expect(mocked.push).toHaveBeenCalled();
      });

      it('openAddResourceModal - should open add resource modal', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openAddResourceModal();

        expect(mocked.push).toHaveBeenCalled();
      });

      it('openNoMentorSelectedModal - should open no mentor selected modal', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.openNoMentorSelectedModal();

        expect(mocked.push).toHaveBeenCalled();
      });

      it('closeCreateMentorModal - should close modal', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'create_mentor' }]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeCreateMentorModal();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('closeInviteUserModal - should close modal', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'invite_user' }]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeInviteUserModal();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('closeSettingsModal - should close modal', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'settings' }]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeSettingsModal();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('closeMyMentorsModal - should close modal', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'my_mentors' }]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeMyMentorsModal();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('closeLLMProvidersModal - should close modal', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'llm_providers' }]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeLLMProvidersModal();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('closeEditMentorModal - should close modal', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'edit_mentor' }]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeEditMentorModal();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('closeAddPromptModal - should close modal', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'add_prompt' }]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeAddPromptModal();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('closeAddResourceModal - should close modal', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'add_resource' }]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeAddResourceModal();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });

      it('closeNoMentorSelectedModal - should close modal', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'no_mentor_selected' },
        ]);
        const { result } = renderHook(() => useNavigate());

        result.current.closeNoMentorSelectedModal();

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });
    });

    describe('modal state checks', () => {
      it('showCreateMentorModal - should return true when modal is open', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'create_mentor' }]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.showCreateMentorModal).toBe(true);
      });

      it('showCreateMentorModal - should return false when modal is not open', () => {
        mocked.selectModalStack.mockReturnValue([]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.showCreateMentorModal).toBe(false);
      });

      it('showInviteUserModal - should return correct state', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'invite_user' }]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.showInviteUserModal).toBe(true);
      });

      it('showSettingsModal - should return correct state', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'settings' }]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.showSettingsModal).toBe(true);
      });

      it('showMyMentorsModal - should return correct state', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'my_mentors' }]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.showMyMentorsModal).toBe(true);
      });

      it('showLLMProvidersModal - should return correct state', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'llm_providers' }]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.showLLMProvidersModal).toBe(true);
      });

      it('showEditMentorModal - should return true when modal is open', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'edit_mentor' }]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.showEditMentorModal).toBe(true);
      });

      it('showEditMentorModal - should return false for viewable_by_anyone mentor on different tenant', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'edit_mentor' }]);
        mocked.useGetMentorSettingsQuery.mockReturnValue({
          data: {
            mentor_visibility: 'viewable_by_anyone',
            platform_key: 'main-tenant',
          } as any,
        });
        mocked.useParams.mockReturnValue({
          tenantKey: 'other-tenant',
          mentorId: 'mentor-123',
        });

        const { result } = renderHook(() => useNavigate());

        expect(result.current.showEditMentorModal).toBe(false);
      });

      it('showAddPromptModal - should return correct state', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'add_prompt' }]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.showAddPromptModal).toBe(true);
      });

      it('showAddResourceModal - should return correct state', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'add_resource' }]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.showAddResourceModal).toBe(true);
      });

      it('showNoMentorSelectedModal - should return correct state', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'no_mentor_selected' },
        ]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.showNoMentorSelectedModal).toBe(true);
      });
    });

    describe('modal tab getters', () => {
      it('getCreateMentorTab - should return tab for create mentor modal', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'create_mentor', tab: 'advanced' },
        ]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getCreateMentorTab()).toBe('advanced');
      });

      it('getInviteUserTab - should return tab for invite user modal', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'invite_user', tab: 'bulk' },
        ]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getInviteUserTab()).toBe('bulk');
      });

      it('getSettingsTab - should return tab for settings modal', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'settings', tab: 'profile' },
        ]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getSettingsTab()).toBe('profile');
      });

      it('getMyMentorsTab - should return tab for my mentors modal', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'my_mentors', tab: 'favorites' },
        ]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getMyMentorsTab()).toBe('favorites');
      });

      it('getLLMProvidersTab - should return tab for LLM providers modal', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'llm_providers', tab: 'openai' },
        ]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getLLMProvidersTab()).toBe('openai');
      });

      it('getEditMentorTab - should return tab for edit mentor modal', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'edit_mentor', tab: 'prompts' },
        ]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getEditMentorTab()).toBe('prompts');
      });

      it('getEditMentorTab - should return default settings tab when no tab specified', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'edit_mentor' }]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getEditMentorTab()).toBe('settings');
      });

      it('getAddResourceTab - should return tab for add resource modal', () => {
        mocked.selectModalStack.mockReturnValue([
          { name: 'add_resource', tab: 'url' },
        ]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getAddResourceTab()).toBe('url');
      });

      it('getModalTab - should return undefined for non-existent modal', () => {
        mocked.selectModalStack.mockReturnValue([]);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getCreateMentorTab()).toBeUndefined();
      });
    });

    describe('getMentorId', () => {
      it('should return mentorId from modal', () => {
        mocked.selectModalMentorId.mockReturnValue('mentor-456' as any);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getMentorId()).toBe('mentor-456');
      });

      it('should return undefined when no mentorId in modal', () => {
        mocked.selectModalMentorId.mockReturnValue(undefined);
        const { result } = renderHook(() => useNavigate());

        expect(result.current.getMentorId()).toBeUndefined();
      });
    });

    describe('navigateWithSearchParams', () => {
      it('should navigate with search params', () => {
        const { result } = renderHook(() => useNavigate());

        result.current.navigateWithSearchParams({
          tab: 'settings',
          filter: 'active',
        });

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123?tab=settings&filter=active',
        );
      });

      it('should remove params with null value', () => {
        mocked.useSearchParams.mockReturnValue(
          new URLSearchParams({ tab: 'settings', filter: 'active' }),
        );
        const { result } = renderHook(() => useNavigate());

        result.current.navigateWithSearchParams({ filter: null });

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123?tab=settings',
        );
      });

      it('should navigate without search string when all params removed', () => {
        mocked.useSearchParams.mockReturnValue(
          new URLSearchParams({ tab: 'settings' }),
        );
        const { result } = renderHook(() => useNavigate());

        result.current.navigateWithSearchParams({ tab: null });

        expect(mocked.push).toHaveBeenCalledWith(
          '/platform/test-tenant/mentor-123',
        );
      });
    });

    describe('getUpdatedModalStack', () => {
      it('should return updated modal stack with new modal', () => {
        mocked.selectModalStack.mockReturnValue([{ name: 'settings' }]);
        const { result } = renderHook(() => useNavigate());

        const updatedStack = result.current.getUpdatedModalStack(
          'profile',
          'info',
        );

        expect(updatedStack).toEqual([
          { name: 'settings' },
          { name: 'profile', tab: 'info' },
        ]);
      });

      it('should return modal stack with mentorId', () => {
        const { result } = renderHook(() => useNavigate());

        const updatedStack = result.current.getUpdatedModalStack(
          'edit_mentor',
          'settings',
          'mentor-456',
        );

        expect(updatedStack).toEqual([
          { name: 'edit_mentor', tab: 'settings', mentorId: 'mentor-456' },
        ]);
      });
    });

    describe('edge cases', () => {
      it('should handle multiple search params correctly', () => {
        mocked.useSearchParams.mockReturnValue(
          new URLSearchParams({
            tab: 'settings',
            sort: 'name',
            filter: 'active',
          }),
        );
        const { result } = renderHook(() => useNavigate());

        result.current.navigateWithSearchParams({
          modal: JSON.stringify([{ name: 'settings' }]),
        });

        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining('tab=settings'),
        );
        expect(mocked.push).toHaveBeenCalledWith(
          expect.stringContaining('sort=name'),
        );
      });

      it('should handle switching between mentors multiple times', () => {
        const saveCachedSessionId = vi.fn();
        const cachedSessions = {
          'mentor-1': 'session-1',
          'mentor-2': 'session-2',
          'mentor-3': 'session-3',
        };
        mocked.useLocalStorage.mockReturnValue([
          cachedSessions,
          saveCachedSessionId,
        ]);

        const { result } = renderHook(() => useNavigate());

        result.current.navigateToMentor('mentor-2');

        expect(saveCachedSessionId).toHaveBeenCalledWith({
          'mentor-1': 'session-1',
          'mentor-3': 'session-3',
        });
      });

      it('should handle empty pathname gracefully', () => {
        mocked.pathname = '';
        const { result } = renderHook(() => useNavigate());

        result.current.navigateWithSearchParams({ tab: 'settings' });

        expect(mocked.push).toHaveBeenCalledWith('?tab=settings');
      });
    });
  });

  describe('useSidebarNavigation', () => {
    beforeEach(() => {
      mocked.pathname = '/platform/test-tenant/mentor-123';
      mocked.useParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: 'mentor-123',
      });
    });

    it('should return content items', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      expect(result.current.contentItems).toBeDefined();
      expect(result.current.contentItems.length).toBeGreaterThan(0);
    });

    it('should return footer items', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      expect(result.current.footerItems).toBeDefined();
      expect(result.current.footerItems.length).toBeGreaterThan(0);
    });

    it('should have New Chat in content items', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const newChatItem = result.current.contentItems.find(
        (item) => item.label === 'New Chat',
      );
      expect(newChatItem).toBeDefined();
    });

    it('should have Mentors in content items', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const mentorsItem = result.current.contentItems.find(
        (item) => item.label === 'Mentors',
      );
      expect(mentorsItem).toBeDefined();
    });

    it('should have New Mentor in content items', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const newMentorItem = result.current.contentItems.find(
        (item) => item.label === 'New Mentor',
      );
      expect(newMentorItem).toBeDefined();
    });

    it('should have Invite Users in content items', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const inviteUsersItem = result.current.contentItems.find(
        (item) => item.label === 'Invite Users',
      );
      expect(inviteUsersItem).toBeDefined();
    });

    it('should have Settings in footer items', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const settingsItem = result.current.footerItems.find(
        (item) => item.label === 'Settings',
      );
      expect(settingsItem).toBeDefined();
    });

    it('should have Analytics in footer items', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const analyticsItem = result.current.footerItems.find(
        (item) => item.label === 'Analytics',
      );
      expect(analyticsItem).toBeDefined();
    });

    it('should have Notifications in footer items', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const notificationsItem = result.current.footerItems.find(
        (item) => item.label === 'Notifications',
      );
      expect(notificationsItem).toBeDefined();
    });

    it('New Chat onClick - should clear files when mentorId exists and on chat page', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const newChatItem = result.current.contentItems.find(
        (item) => item.label === 'New Chat',
      );
      newChatItem?.onClick();

      expect(mocked.dispatch).toHaveBeenCalledWith(mocked.clearFiles());
      expect(mocked.emit).toHaveBeenCalledWith('MENTOR:NEW_CHAT');
      expect(mocked.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'setShouldStartNewChat' }),
      );
    });

    it('New Chat onClick - should open no mentor selected modal when no mentorId', () => {
      mocked.useParams.mockReturnValue({ tenantKey: 'test-tenant' });
      // Reset push so we can assert the modal-open navigation specifically
      mocked.push.mockClear();
      const { result } = renderHook(() => useSidebarNavigation());

      const newChatItem = result.current.contentItems.find(
        (item) => item.label === 'New Chat',
      );
      newChatItem?.onClick();

      // The no-mentorId branch dispatches clearFiles, opens the
      // "no mentor selected" modal, and returns early — it does NOT
      // dispatch setShouldStartNewChat (see useSidebarNavigation in
      // hooks/user-navigate.ts). Opening the modal pushes a new URL via
      // the navigation router, so we assert on router.push instead.
      expect(mocked.dispatch).toHaveBeenCalledWith(mocked.clearFiles());
      expect(mocked.push).toHaveBeenCalled();
      expect(mocked.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'setShouldStartNewChat' }),
      );
    });

    it('New Chat onClick - should navigate to home when not on chat page', () => {
      mocked.pathname = '/platform/test-tenant/mentor-123/analytics';
      const { result } = renderHook(() => useSidebarNavigation());

      const newChatItem = result.current.contentItems.find(
        (item) => item.label === 'New Chat',
      );
      newChatItem?.onClick();

      expect(mocked.push).toHaveBeenCalledWith(
        '/platform/test-tenant/mentor-123',
      );
    });

    it('Mentors onClick - should navigate to explore', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const mentorsItem = result.current.contentItems.find(
        (item) => item.label === 'Mentors',
      );
      mentorsItem?.onClick();

      expect(mocked.push).toHaveBeenCalledWith(
        '/platform/test-tenant/mentor-123/explore',
      );
    });

    it('New Mentor onClick - should execute with trial check', () => {
      const executeWithTrialCheck = vi.fn((fn) => fn());
      mocked.useShowFreeTrialDialog.mockReturnValue({
        executeWithTrialCheck,
        isNewlyUserOnPreFreeOrAdvertisingMode: () => false,
      });

      const { result } = renderHook(() => useSidebarNavigation());

      const newMentorItem = result.current.contentItems.find(
        (item) => item.label === 'New Mentor',
      );
      newMentorItem?.onClick();

      expect(executeWithTrialCheck).toHaveBeenCalled();
    });

    it('Invite Users onClick - should execute with trial check', () => {
      const executeWithTrialCheck = vi.fn((fn) => fn());
      mocked.useShowFreeTrialDialog.mockReturnValue({
        executeWithTrialCheck,
        isNewlyUserOnPreFreeOrAdvertisingMode: () => false,
      });

      const { result } = renderHook(() => useSidebarNavigation());

      const inviteUsersItem = result.current.contentItems.find(
        (item) => item.label === 'Invite Users',
      );
      inviteUsersItem?.onClick();

      expect(executeWithTrialCheck).toHaveBeenCalled();
    });

    it('Analytics onClick - should execute with trial check', () => {
      const executeWithTrialCheck = vi.fn((fn) => fn());
      mocked.useShowFreeTrialDialog.mockReturnValue({
        executeWithTrialCheck,
        isNewlyUserOnPreFreeOrAdvertisingMode: () => false,
      });

      const { result } = renderHook(() => useSidebarNavigation());

      const analyticsItem = result.current.footerItems.find(
        (item) => item.label === 'Analytics',
      );
      analyticsItem?.onClick();

      expect(executeWithTrialCheck).toHaveBeenCalled();
    });

    it('Settings onClick - should execute with trial check', () => {
      const executeWithTrialCheck = vi.fn((fn) => fn());
      mocked.useShowFreeTrialDialog.mockReturnValue({
        executeWithTrialCheck,
        isNewlyUserOnPreFreeOrAdvertisingMode: () => false,
      });

      const { result } = renderHook(() => useSidebarNavigation());

      const settingsItem = result.current.footerItems.find(
        (item) => item.label === 'Settings',
      );
      settingsItem?.onClick();

      expect(executeWithTrialCheck).toHaveBeenCalled();
    });

    it('Notifications onClick - should navigate to notifications', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const notificationsItem = result.current.footerItems.find(
        (item) => item.label === 'Notifications',
      );
      notificationsItem?.onClick();

      expect(mocked.push).toHaveBeenCalled();
    });

    it('should hide Analytics when config.hideAnalytics is true', () => {
      mocked.hideAnalytics.mockReturnValue('true');
      const { result } = renderHook(() => useSidebarNavigation());

      const analyticsItem = result.current.footerItems.find(
        (item) => item.label === 'Analytics',
      );
      expect(analyticsItem).toBeUndefined();
    });

    it('should show Analytics when config.hideAnalytics is false', () => {
      mocked.hideAnalytics.mockReturnValue('false');
      const { result } = renderHook(() => useSidebarNavigation());

      const analyticsItem = result.current.footerItems.find(
        (item) => item.label === 'Analytics',
      );
      expect(analyticsItem).toBeDefined();
    });

    it('should correctly identify chat page with platform pattern', () => {
      mocked.pathname = '/platform/test-tenant/mentor-123';
      const { result } = renderHook(() => useSidebarNavigation());

      const newChatItem = result.current.contentItems.find(
        (item) => item.label === 'New Chat',
      );
      newChatItem?.onClick();

      expect(mocked.emit).toHaveBeenCalledWith('MENTOR:NEW_CHAT');
    });

    it('should correctly identify chat page with projects pattern', () => {
      mocked.pathname = '/platform/test-tenant/projects/project-1/mentor-123';
      const { result } = renderHook(() => useSidebarNavigation());

      const newChatItem = result.current.contentItems.find(
        (item) => item.label === 'New Chat',
      );
      newChatItem?.onClick();

      expect(mocked.emit).toHaveBeenCalledWith('MENTOR:NEW_CHAT');
    });

    it('should have correct user types for New Chat', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const newChatItem = result.current.contentItems.find(
        (item) => item.label === 'New Chat',
      );
      expect(newChatItem?.userTypes).toContain('student');
      expect(newChatItem?.userTypes).toContain('free_trial');
      expect(newChatItem?.userTypes).toContain('admin');
      expect(newChatItem?.userTypes).toContain('anonymous');
    });

    it('should have correct user types for Mentors', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const mentorsItem = result.current.contentItems.find(
        (item) => item.label === 'Mentors',
      );
      expect(mentorsItem?.userTypes).toContain('student');
      expect(mentorsItem?.userTypes).toContain('visiting');
    });

    it('should have correct user types for admin actions', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const newMentorItem = result.current.contentItems.find(
        (item) => item.label === 'New Mentor',
      );
      expect(newMentorItem?.userTypes).toContain('admin');
      expect(newMentorItem?.isAnAdminAction).toBe(true);

      const inviteUsersItem = result.current.contentItems.find(
        (item) => item.label === 'Invite Users',
      );
      expect(inviteUsersItem?.userTypes).toContain('admin');
      expect(inviteUsersItem?.isAnAdminAction).toBe(true);
    });

    it('should have rbacResource for New Mentor', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const newMentorItem = result.current.contentItems.find(
        (item) => item.label === 'New Mentor',
      );
      expect(newMentorItem?.rbacResource).toBeDefined();
      expect(newMentorItem?.rbacResource?.(1)).toBe('/mentors/#create');
    });

    it('should have rbacResource for Analytics', () => {
      mocked.useGetMentorPublicSettingsQuery.mockReturnValue({
        data: { mentor_id: 'mentor-123' } as any,
      });

      const { result } = renderHook(() => useSidebarNavigation());

      const analyticsItem = result.current.footerItems.find(
        (item) => item.label === 'Analytics',
      );
      expect(analyticsItem?.rbacResource).toBeDefined();
      expect(analyticsItem?.rbacResource?.(1)).toContain('mentor-123');
    });

    it('should have Workflows in content items', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const workflowsItem = result.current.contentItems.find(
        (item) => item.label === 'Workflows',
      );
      expect(workflowsItem).toBeDefined();
    });

    it('Workflows onClick - should navigate to workflows', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const workflowsItem = result.current.contentItems.find(
        (item) => item.label === 'Workflows',
      );
      workflowsItem?.onClick();

      expect(mocked.push).toHaveBeenCalledWith(
        '/platform/test-tenant/workflows/mentor-123',
      );
    });

    it('should have hasBorder flag for New Chat', () => {
      const { result } = renderHook(() => useSidebarNavigation());

      const newChatItem = result.current.contentItems.find(
        (item) => item.label === 'New Chat',
      );
      expect(newChatItem?.hasBorder).toBe(true);
    });
  });
});
