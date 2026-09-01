import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { GraderTab } from './grader-tab';

// ============================================================================
// MOCKS
// ============================================================================
//
// next-intl is deliberately NOT mocked here: the global vitest setup provides
// a real English translator over messages/en.json, so rendering this wrapper
// proves every `tabsGraderTab` key exists and its ICU message compiles. The
// two strings the SDK interpolates itself ({total}) are fetched with `t.raw`
// in the wrapper — a plain `t()` there would throw under this real translator,
// which is exactly the regression this test guards against.

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockExecuteWithTrialCheck = vi.fn();
const mockUseGetMentorSettingsQuery = vi.fn();
const mockAgentSettingsProvider = vi.fn();
const mockAgentGraderTab = vi.fn();
const mockRbacPermissions = { mentors: {} };

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: mockExecuteWithTrialCheck,
  }),
}));

vi.mock('@/lib/config', () => ({
  config: {
    enableRBAC: () => mockEnableRBAC(),
  },
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ rbac: { rbacPermissions: mockRbacPermissions } }),
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: (state: {
    rbac: { rbacPermissions: typeof mockRbacPermissions };
  }) => state.rbac.rbacPermissions,
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (
    args: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => mockUseGetMentorSettingsQuery(args, options),
}));

// GraderTab imports from `@iblai/iblai-js/web-containers/next` (the Next-only
// entry — that's where AgentGraderTab / AgentSettingsProvider are actually
// exported). Vitest keys mocks by module specifier, so we mock the exact path
// the source uses.
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentSettingsProvider: ({
    children,
    ...value
  }: {
    children: React.ReactNode;
    tenantKey: string;
    mentorId: string;
    username: string;
    enableRBAC: boolean;
  }) => {
    mockAgentSettingsProvider(value);
    return (
      <div
        data-testid="agent-settings-provider"
        data-tenant-key={value.tenantKey}
        data-mentor-id={value.mentorId}
        data-username={value.username}
        data-enable-rbac={String(value.enableRBAC)}
      >
        {children}
      </div>
    );
  },
  AgentGraderTab: (props: unknown) => {
    mockAgentGraderTab(props);
    return <div data-testid="agent-grader-tab">AgentGraderTab</div>;
  },
}));

/** The `labels` prop captured from the last AgentGraderTab render. */
function capturedLabels() {
  const call = mockAgentGraderTab.mock.calls.at(-1);
  expect(call).toBeDefined();
  return call![0].labels;
}

// ============================================================================
// TESTS
// ============================================================================

describe('GraderTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'url-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('test-user');
    mockEnableRBAC.mockReturnValue(false);
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_unique_id: 'uuid-1234' },
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('wraps AgentGraderTab in an AgentSettingsProvider with the resolved identity', () => {
      render(<GraderTab />);

      const provider = screen.getByTestId('agent-settings-provider');
      expect(provider).toHaveAttribute('data-tenant-key', 'test-tenant');
      expect(provider).toHaveAttribute('data-username', 'test-user');
      expect(provider).toHaveAttribute('data-enable-rbac', 'false');
      expect(screen.getByTestId('agent-grader-tab')).toBeInTheDocument();

      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantKey: 'test-tenant',
          username: 'test-user',
          enableRBAC: false,
          rbacPermissions: mockRbacPermissions,
          executeGatedAction: mockExecuteWithTrialCheck,
        }),
      );
    });

    it('forwards the config-derived enableRBAC flag to the provider', () => {
      mockEnableRBAC.mockReturnValue(true);

      render(<GraderTab />);

      expect(screen.getByTestId('agent-settings-provider')).toHaveAttribute(
        'data-enable-rbac',
        'true',
      );
    });
  });

  describe('Mentor id resolution', () => {
    it('passes the mentor unique_id from settings (grader endpoints are UUID-keyed)', () => {
      render(<GraderTab />);

      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'uuid-1234' }),
      );
    });

    it('falls back to the active mentor id while settings have not loaded', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({ data: undefined });

      render(<GraderTab />);

      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'url-mentor' }),
      );
    });

    it('prefers getMentorId() from the modal stack over the URL param', () => {
      mockGetMentorId.mockReturnValue('modal-mentor');
      mockUseGetMentorSettingsQuery.mockReturnValue({ data: undefined });

      render(<GraderTab />);

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mentor: 'modal-mentor' }),
        expect.objectContaining({ skip: false }),
      );
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'modal-mentor' }),
      );
    });

    it('skips the settings query until the identity is complete', () => {
      mockUseUsername.mockReturnValue(undefined);

      render(<GraderTab />);

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });
  });

  describe('Guard clauses', () => {
    it.each([
      ['tenantKey', { tenantKey: undefined, mentorId: 'url-mentor' }],
      ['mentorId', { tenantKey: 'test-tenant', mentorId: undefined }],
    ])('renders nothing when %s is missing', (_field, params) => {
      mockUseParams.mockReturnValue(params);

      const { container } = render(<GraderTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
      expect(mockAgentGraderTab).not.toHaveBeenCalled();
    });

    it('renders nothing when username is missing', () => {
      mockUseUsername.mockReturnValue(undefined);

      const { container } = render(<GraderTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentGraderTab).not.toHaveBeenCalled();
    });
  });

  describe('Labels (everything from translations, no static strings)', () => {
    it('resolves every label slot from the tabsGraderTab en catalog', () => {
      render(<GraderTab />);

      const labels = capturedLabels();
      expect(labels.header.title).toBe('Grader');
      expect(labels.capability.title).toBe('Grading');
      expect(labels.subTabs.setup).toBeTruthy();
      expect(labels.subTabs.rubric).toBeTruthy();
      expect(labels.denied.title).toBeTruthy();
      expect(labels.warnings.noConfig).toBeTruthy();
      expect(labels.warnings.noCriteria).toBeTruthy();
      expect(labels.config.gradingMode.options.submission).toBeTruthy();
      expect(labels.config.feedbackMode.options.both).toBeTruthy();
      expect(labels.config.instructions.label).toBeTruthy();
      expect(labels.criteria.modal.name.label).toBeTruthy();
      expect(labels.criteria.deleteModal.title).toBeTruthy();
      expect(labels.toasts.toggleOn).toBeTruthy();

      // A missing key would surface as the raw "tabsGraderTab.<key>" echo —
      // make sure none leaked through anywhere in the tree.
      const flatten = (value: unknown): string[] =>
        typeof value === 'string'
          ? [value]
          : typeof value === 'object' && value !== null
            ? Object.values(value).flatMap(flatten)
            : [];
      for (const text of flatten(labels)) {
        expect(text).not.toMatch(/^tabsGraderTab\./);
      }
    });

    it('keeps the {total} placeholder intact for the SDK to interpolate', () => {
      render(<GraderTab />);

      const labels = capturedLabels();
      expect(labels.criteria.totalPoints).toContain('{total}');
      expect(labels.criteria.scoreHint).toContain('{total}');
      expect(labels.results.overrideModal.pointsHelp).toContain('{total}');
      expect(labels.results.overrideModal.pointsRange).toContain('{total}');
    });

    it('interpolates the criterion name into the actions aria label', () => {
      render(<GraderTab />);

      const labels = capturedLabels();
      expect(labels.criteria.actionsAria('Clarity')).toBe(
        'Actions for Clarity',
      );
    });

    it('interpolates the learner email into the override aria label', () => {
      render(<GraderTab />);

      const labels = capturedLabels();
      expect(labels.results.overrideButtonAria('learner@example.com')).toBe(
        'Override grade for learner@example.com',
      );
    });

    it('resolves the grade-results section from the catalog', () => {
      render(<GraderTab />);

      const labels = capturedLabels();
      expect(labels.subTabs.results).toBeTruthy();
      expect(labels.results.sectionTitle).toBeTruthy();
      expect(labels.results.columns.learner).toBeTruthy();
      expect(labels.results.statusValues.pending).toBeTruthy();
      expect(labels.results.overrideModal.title).toBeTruthy();
      expect(labels.results.toasts.overrideSaved).toBeTruthy();
    });
  });

  // The wrapper reads only the `tabsGraderTab` namespace, so drift between
  // locale files would silently fall back to English (or echo the key) for
  // the affected language. Lock all four catalogs to the same key set and
  // keep the SDK-interpolated placeholders present in every locale.
  describe('Locale catalog parity', () => {
    it('ships identical tabsGraderTab key sets with SDK placeholders in all locales', async () => {
      const catalogs = {
        en: (await import('../../../../messages/en.json')).default,
        es: (await import('../../../../messages/es.json')).default,
        fr: (await import('../../../../messages/fr.json')).default,
        zh: (await import('../../../../messages/zh.json')).default,
      };

      const graderKeys = (messages: object) =>
        Object.keys(
          (messages as { tabsGraderTab: Record<string, string> }).tabsGraderTab,
        ).sort();
      const enKeys = graderKeys(catalogs.en);
      expect(enKeys.length).toBeGreaterThan(0);

      for (const [locale, messages] of Object.entries(catalogs)) {
        const tab = (messages as { tabsGraderTab: Record<string, string> })
          .tabsGraderTab;
        expect(graderKeys(messages), locale).toEqual(enKeys);
        for (const [key, value] of Object.entries(tab)) {
          expect(value, `${locale}.${key}`).toBeTruthy();
        }
        expect(tab.criteriaTotalPoints, locale).toContain('{total}');
        expect(tab.criteriaScoreHint, locale).toContain('{total}');
        expect(tab.criteriaActionsAria, locale).toContain('{name}');
        expect(tab.overrideModalPointsHelp, locale).toContain('{total}');
        expect(tab.overrideModalPointsRange, locale).toContain('{total}');
        expect(tab.resultsOverrideButtonAria, locale).toContain('{email}');
      }
    });
  });
});
