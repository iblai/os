import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ============================================================================
// MOCKS
// ============================================================================
//
// The EvaluationTab is a thin wrapper that reads route params + redux state,
// resolves the mentor's `mentor_unique_id`, then renders the packaged
// `AgentEvaluationTab` inside an `AgentSettingsProvider`. The tests stub each
// dependency so we can assert the wrapper's plumbing without bringing up the
// real data layer / provider tree.

const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();
const mockUseAppSelector = vi.fn();
const mockUseShowFreeTrialDialog = vi.fn();
const mockUseGetMentorSettingsQuery = vi.fn();
const mockEnableRBAC = vi.fn();
const mockGetLLMProviderDetails = vi.fn();
const mockExecuteWithTrialCheck = vi.fn((fn: () => unknown) => fn?.());
const mockAgentSettingsProvider = vi.fn();
const mockAgentEvaluationTab = vi.fn();
const mockIblPagination = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: unknown) => mockUseAppSelector(selector),
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: vi.fn(() => 'selectRbacPermissions'),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => mockUseShowFreeTrialDialog(),
}));

vi.mock('@/lib/config', () => ({
  config: {
    enableRBAC: () => mockEnableRBAC(),
  },
}));

vi.mock('@/lib/utils', () => ({
  getLLMProviderDetails: (...args: unknown[]) =>
    mockGetLLMProviderDetails(...args),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (
    args: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => mockUseGetMentorSettingsQuery(args, options),
}));

vi.mock('@/components/ibl-pagination', () => {
  const Pagination = (props: unknown) => {
    mockIblPagination(props);
    return <div data-testid="ibl-pagination" />;
  };
  return { __esModule: true, default: Pagination };
});

vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentSettingsProvider: ({
    children,
    ...value
  }: React.PropsWithChildren<Record<string, unknown>>) => {
    mockAgentSettingsProvider(value);
    return (
      <div
        data-testid="agent-settings-provider"
        data-tenant-key={String(value.tenantKey)}
        data-mentor-id={String(value.mentorId)}
        data-username={String(value.username)}
        data-enable-rbac={String(value.enableRBAC)}
      >
        {children}
      </div>
    );
  },
  AgentEvaluationTab: (props: Record<string, unknown>) => {
    mockAgentEvaluationTab(props);
    return <div data-testid="agent-evaluation-tab" />;
  },
}));

// Import after mocks so the module under test picks up the stubs.
import { EvaluationTab } from './index';

// ============================================================================
// HELPERS
// ============================================================================

const setDefaults = () => {
  mockUseParams.mockReturnValue({
    tenantKey: 'tenant-x',
    mentorId: 'mentor-slug',
  });
  mockUseUsername.mockReturnValue('alice');
  mockUseAppSelector.mockReturnValue({ read: true });
  mockUseShowFreeTrialDialog.mockReturnValue({
    executeWithTrialCheck: mockExecuteWithTrialCheck,
  });
  mockEnableRBAC.mockReturnValue(true);
  mockUseGetMentorSettingsQuery.mockReturnValue({
    data: { mentor_unique_id: 'mentor-uid-123' },
  });
};

// ============================================================================
// TESTS
// ============================================================================

describe('EvaluationTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    setDefaults();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Provider plumbing', () => {
    it('renders the AgentEvaluationTab inside the AgentSettingsProvider', () => {
      render(<EvaluationTab />);
      const provider = screen.getByTestId('agent-settings-provider');
      expect(provider).toBeInTheDocument();
      expect(
        provider.querySelector('[data-testid="agent-evaluation-tab"]'),
      ).not.toBeNull();
    });

    it('forwards tenantKey, username, enableRBAC, rbacPermissions, and executeGatedAction', () => {
      render(<EvaluationTab />);
      const value = mockAgentSettingsProvider.mock.calls[0][0];
      expect(value).toMatchObject({
        tenantKey: 'tenant-x',
        username: 'alice',
        enableRBAC: true,
        rbacPermissions: { read: true },
      });
      expect(typeof value.executeGatedAction).toBe('function');

      // executeGatedAction should delegate to executeWithTrialCheck
      const sentinel = vi.fn().mockReturnValue('return-value');
      const result = value.executeGatedAction(sentinel);
      expect(mockExecuteWithTrialCheck).toHaveBeenCalledWith(sentinel);
      expect(sentinel).toHaveBeenCalledTimes(1);
      expect(result).toBe('return-value');
    });

    it('passes getLLMProviderDetails and IblPagination through to AgentEvaluationTab', () => {
      render(<EvaluationTab />);
      const props = mockAgentEvaluationTab.mock.calls[0][0];
      expect(typeof props.getLLMProviderDetails).toBe('function');
      expect(typeof props.PaginationComponent).toBe('function');

      // The forwarded getLLMProviderDetails should delegate to the local helper.
      props.getLLMProviderDetails('openai', 'gpt-4');
      expect(mockGetLLMProviderDetails).toHaveBeenCalledWith('openai', 'gpt-4');
    });

    it('reads RBAC permissions via selectRbacPermissions', () => {
      render(<EvaluationTab />);
      // The mock recorded whatever selector was passed to useAppSelector;
      // it should be the imported selectRbacPermissions reference.
      const selectorArg = mockUseAppSelector.mock.calls[0][0];
      expect(typeof selectorArg).toBe('function');
      expect((selectorArg as () => unknown)()).toBe('selectRbacPermissions');
    });
  });

  describe('mentorUniqueId resolution', () => {
    it('uses mentor_unique_id from settings when present', () => {
      render(<EvaluationTab />);
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'mentor-uid-123' }),
      );
    });

    it('falls back to the route mentorId when mentor_unique_id is missing', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: { mentor_unique_id: null },
      });
      render(<EvaluationTab />);
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'mentor-slug' }),
      );
    });

    it('falls back to the route mentorId when the settings query returns no data', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({ data: undefined });
      render(<EvaluationTab />);
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'mentor-slug' }),
      );
    });

    it("falls back to '' when both mentor_unique_id and the route mentorId are missing", () => {
      mockUseParams.mockReturnValue({ tenantKey: 'tenant-x' });
      mockUseGetMentorSettingsQuery.mockReturnValue({ data: undefined });
      render(<EvaluationTab />);
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: '' }),
      );
    });
  });

  describe('Mentor settings query', () => {
    it('passes mentor + org + userId to useGetMentorSettingsQuery', () => {
      render(<EvaluationTab />);
      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        { mentor: 'mentor-slug', org: 'tenant-x', userId: 'alice' },
        expect.objectContaining({ skip: false }),
      );
    });

    it('skips the query when mentorId is missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'tenant-x' });
      render(<EvaluationTab />);
      const opts = mockUseGetMentorSettingsQuery.mock.calls[0][1];
      expect(opts.skip).toBe(true);
    });

    it('skips the query when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ mentorId: 'mentor-slug' });
      render(<EvaluationTab />);
      const opts = mockUseGetMentorSettingsQuery.mock.calls[0][1];
      expect(opts.skip).toBe(true);
    });

    it('skips the query when username is missing', () => {
      mockUseUsername.mockReturnValue(undefined);
      render(<EvaluationTab />);
      const opts = mockUseGetMentorSettingsQuery.mock.calls[0][1];
      expect(opts.skip).toBe(true);
      // Provider still mounts but tenantKey/username fall back to ''.
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ username: '' }),
      );
    });

    it("passes empty string for username when it's undefined", () => {
      mockUseUsername.mockReturnValue(undefined);
      render(<EvaluationTab />);
      const args = mockUseGetMentorSettingsQuery.mock.calls[0][0];
      expect(args.userId).toBe('');
    });
  });

  describe('Empty / fallback inputs', () => {
    it('passes empty string for tenantKey when route param is missing', () => {
      mockUseParams.mockReturnValue({ mentorId: 'mentor-slug' });
      render(<EvaluationTab />);
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ tenantKey: '' }),
      );
    });

    it('reflects enableRBAC=false when config returns false', () => {
      mockEnableRBAC.mockReturnValue(false);
      render(<EvaluationTab />);
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ enableRBAC: false }),
      );
    });
  });
});
