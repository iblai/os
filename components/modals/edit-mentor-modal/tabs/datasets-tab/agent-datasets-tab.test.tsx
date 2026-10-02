import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { AgentDatasetsTabWrapper } from './agent-datasets-tab';

// The wrapper reads route params, the URL, redux and env config, then renders
// the SDK `AgentDatasetsTab` inside an `AgentSettingsProvider`. The SDK pieces
// are stubbed so the assertions cover only the wrapper's plumbing.

const mockUseParams = vi.fn();
const mockSearchParamsGet = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockNavigateWithSearchParams = vi.fn();
const mockDisabedDatasets = vi.fn();
const mockMaxFileSize = vi.fn();
const mockExecuteWithTrialCheck = vi.fn();
const mockAgentSettingsProvider = vi.fn();
const mockAgentDatasetsTab = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
    navigateWithSearchParams: mockNavigateWithSearchParams,
  }),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: mockExecuteWithTrialCheck,
  }),
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: () => ['perm'],
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: vi.fn(),
}));

vi.mock('@/lib/config', async (importOriginal) => ({
  config: {
    ...(await importOriginal<typeof import('@/lib/config')>()).config,
    enableRBAC: () => true,
    disabedDatasets: () => mockDisabedDatasets(),
    mentorTrainingMaximumFileSize: () => mockMaxFileSize(),
  },
}));

vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentSettingsProvider: ({
    children,
    ...value
  }: React.PropsWithChildren<Record<string, unknown>>) => {
    mockAgentSettingsProvider(value);
    return <div data-testid="agent-settings-provider">{children}</div>;
  },
  AgentDatasetsTab: (props: Record<string, unknown>) => {
    mockAgentDatasetsTab(props);
    return <div data-testid="agent-datasets-tab" />;
  },
}));

const lastTabProps = () =>
  mockAgentDatasetsTab.mock.calls.at(-1)![0] as Record<string, unknown>;
const lastProviderProps = () =>
  mockAgentSettingsProvider.mock.calls.at(-1)![0] as Record<string, unknown>;

describe('AgentDatasetsTabWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-a',
      mentorId: 'route-mentor',
    });
    mockSearchParamsGet.mockReturnValue(null);
    mockGetMentorId.mockReturnValue(undefined);
    mockUseUsername.mockReturnValue('jane');
    mockDisabedDatasets.mockReturnValue('zip|courses');
    mockMaxFileSize.mockReturnValue('25');
  });

  afterEach(() => cleanup());

  it('lets the SDK render its own pagination and Add Resources modal', () => {
    render(<AgentDatasetsTabWrapper />);

    expect(screen.getByTestId('agent-datasets-tab')).toBeInTheDocument();
    expect(lastTabProps()).not.toHaveProperty('PaginationComponent');
    expect(lastTabProps()).not.toHaveProperty('AddResourceModal');
    expect(lastTabProps()).not.toHaveProperty('dropboxExtensions');
  });

  it('passes env-driven disabled resource types and max upload size', () => {
    render(<AgentDatasetsTabWrapper />);

    expect(lastTabProps()).toMatchObject({
      disabledResourceTypes: ['zip', 'courses'],
      maxUploadSizeMb: 25,
    });
  });

  it('passes no disabled resource types when the env value is empty', () => {
    mockDisabedDatasets.mockReturnValue('');
    mockMaxFileSize.mockReturnValue('not-a-number');

    render(<AgentDatasetsTabWrapper />);

    expect(lastTabProps()).toMatchObject({
      disabledResourceTypes: [],
      maxUploadSizeMb: 60,
    });
  });

  it('feeds the provider tenant, user, RBAC and the route mentor', () => {
    render(<AgentDatasetsTabWrapper />);

    expect(lastProviderProps()).toMatchObject({
      tenantKey: 'tenant-a',
      mentorId: 'route-mentor',
      username: 'jane',
      enableRBAC: true,
      rbacPermissions: ['perm'],
      executeGatedAction: mockExecuteWithTrialCheck,
    });
  });

  it('prefers the active modal mentor over the route mentor', () => {
    mockGetMentorId.mockReturnValue('modal-mentor');

    render(<AgentDatasetsTabWrapper />);

    expect(lastProviderProps().mentorId).toBe('modal-mentor');
  });

  it('falls back to empty strings when route params and user are missing', () => {
    mockUseParams.mockReturnValue({});
    mockUseUsername.mockReturnValue(undefined);

    render(<AgentDatasetsTabWrapper />);

    expect(lastProviderProps()).toMatchObject({
      tenantKey: '',
      mentorId: '',
      username: '',
    });
  });

  describe('URL-sync mode (default)', () => {
    it('drives page and search from the URL', () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === 'datasetsPage' ? '3' : key === 'datasetsSearch' ? 'foo' : null,
      );

      render(<AgentDatasetsTabWrapper />);

      expect(lastTabProps()).toMatchObject({ page: 3, search: 'foo' });
    });

    it.each(['0', '-2', '1.5', 'abc'])(
      'falls back to page 1 for invalid page param %s',
      (value) => {
        mockSearchParamsGet.mockImplementation((key: string) =>
          key === 'datasetsPage' ? value : null,
        );

        render(<AgentDatasetsTabWrapper />);

        expect(lastTabProps()).toMatchObject({ page: 1, search: '' });
      },
    );

    it('pushes page changes to the URL', () => {
      render(<AgentDatasetsTabWrapper />);

      (lastTabProps().onPageChange as (p: number) => void)(4);

      expect(mockNavigateWithSearchParams).toHaveBeenCalledWith({
        datasetsPage: '4',
      });
    });

    it('replaces search changes in the URL and resets the page', () => {
      render(<AgentDatasetsTabWrapper />);
      const onSearchChange = lastTabProps().onSearchChange as (
        s: string,
      ) => void;

      onSearchChange('bar');
      onSearchChange('');

      expect(mockNavigateWithSearchParams).toHaveBeenNthCalledWith(
        1,
        { datasetsSearch: 'bar', datasetsPage: null },
        { replace: true },
      );
      expect(mockNavigateWithSearchParams).toHaveBeenNthCalledWith(
        2,
        { datasetsSearch: null, datasetsPage: null },
        { replace: true },
      );
    });
  });

  describe('picker mode (syncToUrl=false)', () => {
    it('leaves page/search to the SDK local state and never touches the URL', () => {
      mockSearchParamsGet.mockReturnValue('7');

      render(<AgentDatasetsTabWrapper syncToUrl={false} />);

      const props = lastTabProps();
      expect(props).not.toHaveProperty('page');
      expect(props).not.toHaveProperty('search');
      expect(props).not.toHaveProperty('onPageChange');
      expect(props).not.toHaveProperty('onSearchChange');
      expect(mockNavigateWithSearchParams).not.toHaveBeenCalled();
    });

    it('forwards onSelect and selectedDatasetId', () => {
      const onSelect = vi.fn();

      render(
        <AgentDatasetsTabWrapper
          syncToUrl={false}
          onSelect={onSelect}
          selectedDatasetId="ds-1"
        />,
      );

      expect(lastTabProps()).toMatchObject({
        onSelect,
        selectedDatasetId: 'ds-1',
      });
    });

    it('uses the explicit mentorId over the modal and route mentors', () => {
      mockGetMentorId.mockReturnValue('modal-mentor');

      render(
        <AgentDatasetsTabWrapper syncToUrl={false} mentorId="picked-mentor" />,
      );

      expect(lastProviderProps().mentorId).toBe('picked-mentor');
    });
  });
});
