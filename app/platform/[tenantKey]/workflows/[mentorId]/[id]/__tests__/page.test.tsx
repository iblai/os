import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkflowDetailPage from '../page';

const mockPush = vi.fn();
const mockBack = vi.fn();
let mockParams: Record<string, string> = {};
let mockSearch = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useParams: () => mockParams,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

// The route is a thin wrapper: the only thing under test is how it derives
// and forwards the WorkflowEditor props.
const mockWorkflowEditor = vi.fn();
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  WorkflowEditor: (props: Record<string, unknown>) => {
    mockWorkflowEditor(props);
    return <div data-testid="workflow-editor" />;
  },
}));

let mockUsername: string | null = 'test-user';
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

let mockAxdToken: string | undefined = 'axd-token';
vi.mock('@/hooks/use-tokens', () => ({
  useAxdToken: () => mockAxdToken,
}));

const mockOpenEditMentorModal = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ openEditMentorModal: mockOpenEditMentorModal }),
}));

const mockExecuteWithTrialCheck = vi.fn((fn: () => unknown) => fn());
vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: mockExecuteWithTrialCheck,
  }),
}));

const mockRbacPermissions = { '/mentors/#write': true };
vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: () => mockRbacPermissions,
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({}),
}));

let mockEnableRBAC = false;
vi.mock('@/lib/config', () => ({
  config: {
    baseWsUrl: () => 'wss://ws.example.com',
    enableRBAC: () => mockEnableRBAC,
  },
}));

const mockRedirectToAuthSpa = vi.fn();
vi.mock('@/lib/utils', () => ({
  redirectToAuthSpa: (...args: unknown[]) => mockRedirectToAuthSpa(...args),
  disabledDatasetResourceTypes: () => ['zip', 'courses'],
  maxDatasetFileSizeInMegaBytes: () => 60,
}));

type EditorProps = {
  tenantKey: string;
  workflowId: string;
  username: string;
  axdToken: string;
  baseWsUrl: string;
  redirectToAuthSpa: (...args: unknown[]) => unknown;
  onBack: () => void;
  onDeleted: () => void;
  onOpenAgentSettings: (mentorId?: string) => void;
  agentSettings: Record<string, unknown>;
};

const renderAndGetProps = () => {
  render(<WorkflowDetailPage />);
  return mockWorkflowEditor.mock.calls.at(-1)![0] as EditorProps;
};

describe('WorkflowDetailPage (thin wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {
      tenantKey: 'test-tenant',
      mentorId: 'entry-mentor',
      id: 'wf-1',
    };
    mockSearch = 'listMentorId=list-mentor';
    mockUsername = 'test-user';
    mockAxdToken = 'axd-token';
    mockEnableRBAC = false;
  });

  it('renders the SDK WorkflowEditor', () => {
    render(<WorkflowDetailPage />);
    expect(screen.getByTestId('workflow-editor')).toBeInTheDocument();
  });

  it('maps the route, identity and socket config onto the editor', () => {
    const props = renderAndGetProps();

    expect(props).toMatchObject({
      tenantKey: 'test-tenant',
      workflowId: 'wf-1',
      username: 'test-user',
      axdToken: 'axd-token',
      baseWsUrl: 'wss://ws.example.com',
    });
  });

  it('passes empty identity strings while the user or token is missing', () => {
    mockUsername = null;
    mockAxdToken = undefined;

    const props = renderAndGetProps();

    expect(props.username).toBe('');
    expect(props.axdToken).toBe('');
  });

  it('forwards the app redirectToAuthSpa', () => {
    const props = renderAndGetProps();

    props.redirectToAuthSpa('/back', 'test-tenant', true);

    expect(mockRedirectToAuthSpa).toHaveBeenCalledWith(
      '/back',
      'test-tenant',
      true,
    );
  });

  it('forwards RBAC, the trial gate and the dataset upload config', () => {
    mockEnableRBAC = true;

    const props = renderAndGetProps();

    expect(props.agentSettings).toEqual({
      enableRBAC: true,
      rbacPermissions: mockRbacPermissions,
      executeGatedAction: mockExecuteWithTrialCheck,
      datasetResourceConfig: {
        disabledResourceTypes: ['zip', 'courses'],
        maxUploadSizeMb: 60,
      },
    });
  });

  it('onBack goes back in history', () => {
    const props = renderAndGetProps();

    props.onBack();

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('onDeleted returns to the list of the agent the user came from', () => {
    const props = renderAndGetProps();

    props.onDeleted();

    expect(mockPush).toHaveBeenCalledWith(
      '/platform/test-tenant/workflows/list-mentor',
    );
  });

  it('onDeleted falls back to the route agent without listMentorId', () => {
    mockSearch = '';

    const props = renderAndGetProps();
    props.onDeleted();

    expect(mockPush).toHaveBeenCalledWith(
      '/platform/test-tenant/workflows/entry-mentor',
    );
  });

  it('onOpenAgentSettings opens the edit-agent modal for that agent', () => {
    const props = renderAndGetProps();

    props.onOpenAgentSettings('agent-42');

    expect(mockOpenEditMentorModal).toHaveBeenCalledWith(undefined, 'agent-42');
  });
});
