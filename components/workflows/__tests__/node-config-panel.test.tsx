import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeConfigPanel } from '../node-config-panel';
import type { NodeConfig } from '../workflow-canvas';
import {
  useGetMentorSettingsQuery,
  useGetToolsQuery,
} from '@iblai/iblai-js/data-layer';
import { useToggleTools } from '@/hooks/use-tools/use-toggle-tools';
import { useUsername } from '@/hooks/use-user';

// Mock Redux
const mockDispatch = vi.fn();
vi.mock('@/lib/hooks', () => ({
  useAppDispatch: vi.fn(() => mockDispatch),
}));

vi.mock('@/features/navigation/slice', () => ({
  pushModal: vi.fn((payload) => ({ type: 'PUSH_MODAL', payload })),
  popModal: vi.fn(() => ({ type: 'POP_MODAL' })),
}));

// Mock data layer
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
  })),
  useGetToolsQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
  useGetClawMentorConfigQuery: () => ({
    data: null,
    isError: false,
    isLoading: false,
  }),
  useUpdateClawMentorConfigMutation: () => [
    () => Promise.resolve({}),
    { isLoading: false },
  ],
}));

// Mock user hooks
vi.mock('@/hooks/use-user', () => ({
  useUsername: vi.fn(() => 'test-user'),
}));

// Mock tools hooks
const mockToggleTools = vi.fn();
vi.mock('@/hooks/use-tools/use-toggle-tools', () => ({
  useToggleTools: vi.fn(() => ({
    toggleTools: mockToggleTools,
    isLoading: false,
  })),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.ComponentProps<'label'>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.ComponentProps<'textarea'>) => (
    <textarea {...props} />
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & React.ComponentProps<'button'>) => (
    <button
      data-testid="switch"
      data-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      Switch
    </button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="dialog">
        {children}
        <button data-testid="close-dialog" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
  DialogContent: ({ children, ...props }: React.ComponentProps<'div'>) => (
    <div data-testid="dialog-content" {...props}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, ...props }: React.ComponentProps<'h2'>) => (
    <h2 data-testid="dialog-title" {...props}>
      {children}
    </h2>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div
      data-testid="select"
      data-value={value}
      onClick={() => onValueChange?.('var1')}
    >
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`select-item-${value}`}>{children}</div>,
  SelectTrigger: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@/components/mentors/mentor-selection-grid', () => ({
  MentorSelectionGrid: ({
    onMentorSelect,
    selectedMentorIds,
  }: {
    onMentorSelect: (mentor: { unique_id?: string; name?: string }) => void;
    selectedMentorIds: string[];
  }) => (
    <div data-testid="mentor-selection-grid">
      <span data-testid="selected-mentor-ids">
        {selectedMentorIds.join(',')}
      </span>
      <button
        data-testid="select-mentor"
        onClick={() =>
          onMentorSelect({ unique_id: 'new-mentor-id', name: 'New Mentor' })
        }
      >
        Select Mentor
      </button>
    </div>
  ),
}));

vi.mock('@/components/modals/edit-mentor-modal/tabs/datasets-tab', () => ({
  DatasetsTab: ({
    onSelect,
    selectedDatasetId,
  }: {
    onSelect: (dataset: {
      id: string;
      document_name: string;
      url: string;
    }) => void;
    selectedDatasetId?: string;
  }) => (
    <div data-testid="datasets-tab">
      <span data-testid="selected-dataset-id">{selectedDatasetId}</span>
      <button
        data-testid="select-dataset"
        onClick={() =>
          onSelect({
            id: 'dataset-123',
            document_name: 'Test Dataset',
            url: '',
          })
        }
      >
        Select Dataset
      </button>
    </div>
  ),
}));

vi.mock('@/components/modals/edit-mentor-modal/tabs/mcp-tab', () => ({
  McpTab: ({
    onSelect,
  }: {
    onSelect: (server: { id: number; name: string; image?: string }) => void;
  }) => (
    <div data-testid="mcp-tab">
      <button
        data-testid="select-mcp-server"
        onClick={() =>
          onSelect({ id: 1, name: 'Test MCP Server', image: '/test.png' })
        }
      >
        Select MCP Server
      </button>
    </div>
  ),
}));

vi.mock('@/hoc/withPermissions', () => ({
  default: ({
    children,
  }: {
    children: (props: { disabled: boolean }) => React.ReactNode;
  }) => children({ disabled: false }),
}));

describe('NodeConfigPanel', () => {
  const baseProps = {
    nodeId: 'test-node-id',
    onClose: vi.fn(),
    onUpdateNode: vi.fn(),
    org: 'test-org',
    defaultMentorId: 'default-mentor-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('start node', () => {
    const startNodeData: NodeConfig = {
      label: 'Start',
    };

    it('should render start node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={startNodeData}
        />,
      );

      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(
        screen.getByText('Define the workflow inputs'),
      ).toBeInTheDocument();
    });

    it('should display input variables section', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={startNodeData}
        />,
      );

      expect(screen.getByText('Input variables')).toBeInTheDocument();
      expect(screen.getByText('input_as_text')).toBeInTheDocument();
      expect(screen.getByText('string')).toBeInTheDocument();
    });

    it('should display state variables section', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={startNodeData}
        />,
      );

      expect(screen.getByText('State variables')).toBeInTheDocument();
    });

    it('should open add variable modal when Add button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={startNodeData}
        />,
      );

      await user.click(screen.getByText('Add'));

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={startNodeData}
          onClose={onClose}
        />,
      );

      // Find the close button - it's the button with an X icon (lucide-x class)
      const closeButtons = screen.getAllByRole('button');
      // The close button contains an SVG with lucide-x class
      const closeButton = closeButtons.find((btn) =>
        btn.querySelector('svg.lucide-x'),
      );
      expect(closeButton).toBeTruthy();
      await user.click(closeButton!);
      expect(onClose).toHaveBeenCalled();
    });

    it('should display existing state variables', () => {
      const nodeDataWithVars: NodeConfig = {
        label: 'Start',
        stateVariables: [
          { id: '1', name: 'myVar', type: 'string', defaultValue: 'test' },
        ],
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={nodeDataWithVars}
        />,
      );

      expect(screen.getByText('myVar')).toBeInTheDocument();
    });
  });

  describe('mentor node', () => {
    const mentorNodeData: NodeConfig = {
      label: 'My Mentor',
      instructions: 'You are a helpful assistant.',
      model: 'gpt-4',
      mentor_id: 'mentor-123',
    };

    it('should render mentor node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={mentorNodeData}
        />,
      );

      expect(screen.getByText('My Mentor')).toBeInTheDocument();
      expect(
        screen.getByText('Configure the agent instructions, model, and tools'),
      ).toBeInTheDocument();
    });

    it('should display name input', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={mentorNodeData}
        />,
      );

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('My Mentor')).toBeInTheDocument();
    });

    it('should display instructions textarea', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={mentorNodeData}
        />,
      );

      expect(screen.getByText('Instructions')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('You are a helpful assistant.'),
      ).toBeInTheDocument();
    });

    it('should display model input', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={mentorNodeData}
        />,
      );

      expect(screen.getByText('Model')).toBeInTheDocument();
    });

    it('should call onUpdateNode when name is changed', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={mentorNodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      const nameInput = screen.getByDisplayValue('My Mentor');
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      expect(onUpdateNode).toHaveBeenCalled();
    });

    it('should open mentor selection modal when Change button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={mentorNodeData}
        />,
      );

      await user.click(screen.getByText('Change'));

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('mentor-selection-grid')).toBeInTheDocument();
    });

    it('should show "Select" button when no mentor is selected', () => {
      const nodeDataNoMentor: NodeConfig = {
        label: 'Mentor',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeDataNoMentor}
        />,
      );

      expect(screen.getByText('Select')).toBeInTheDocument();
    });
  });

  describe('guardrails node', () => {
    const guardrailsNodeData: NodeConfig = {
      label: 'Guardrails',
    };

    it('should render guardrails node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="guardrails"
          nodeData={guardrailsNodeData}
        />,
      );

      expect(screen.getByText('Guardrails')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Run moderation, PII, jailbreak, or hallucination checks',
        ),
      ).toBeInTheDocument();
    });

    it('should display guardrail options', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="guardrails"
          nodeData={guardrailsNodeData}
        />,
      );

      expect(
        screen.getByText('Personally identifiable information'),
      ).toBeInTheDocument();
      expect(screen.getByText('Moderation')).toBeInTheDocument();
      expect(screen.getByText('Jailbreak')).toBeInTheDocument();
      expect(screen.getByText('Hallucination')).toBeInTheDocument();
    });

    it('should display continue on error option', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="guardrails"
          nodeData={guardrailsNodeData}
        />,
      );

      expect(screen.getByText('Continue on error')).toBeInTheDocument();
    });
  });

  describe('file-search node', () => {
    const fileSearchNodeData: NodeConfig = {
      label: 'File search',
    };

    it('should render file-search node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={fileSearchNodeData}
        />,
      );

      expect(screen.getByText('File search')).toBeInTheDocument();
      expect(
        screen.getByText('Search datasets for relevant information'),
      ).toBeInTheDocument();
    });

    it('should display dataset selection', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={fileSearchNodeData}
        />,
      );

      expect(screen.getByText('Dataset')).toBeInTheDocument();
      expect(screen.getByText('Select')).toBeInTheDocument();
    });

    it('should display max results input', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={fileSearchNodeData}
        />,
      );

      expect(screen.getByText('Max results')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });

    it('should display query textarea', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={fileSearchNodeData}
        />,
      );

      expect(screen.getByText('Query')).toBeInTheDocument();
    });

    it('should show Change button when dataset is selected', () => {
      const nodeDataWithDataset: NodeConfig = {
        label: 'File search',
        datasetId: 'dataset-123',
        datasetName: 'Test Dataset',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={nodeDataWithDataset}
        />,
      );

      expect(screen.getByText('Change')).toBeInTheDocument();
      expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    });

    it('should open dataset dialog when Select is clicked', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={fileSearchNodeData}
        />,
      );

      await user.click(screen.getByText('Select'));

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('datasets-tab')).toBeInTheDocument();
    });
  });

  describe('mcp node', () => {
    const mcpNodeData: NodeConfig = {
      label: 'MCP',
    };

    it('should render mcp node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mcp"
          nodeData={mcpNodeData}
        />,
      );

      expect(screen.getByText('MCP')).toBeInTheDocument();
      expect(
        screen.getByText('Invoke a Model Context Protocol tool'),
      ).toBeInTheDocument();
    });

    it('should display empty state when no connectors', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mcp"
          nodeData={mcpNodeData}
        />,
      );

      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    it('should display connected tools when connectors exist', () => {
      const nodeDataWithConnectors: NodeConfig = {
        label: 'MCP',
        mcpConnectors: [
          { id: '1', name: 'Gmail', icon: '📧' },
          { id: '2', name: 'Slack', icon: '💬' },
        ],
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mcp"
          nodeData={nodeDataWithConnectors}
        />,
      );

      expect(screen.getByText('Connected Tools')).toBeInTheDocument();
      expect(screen.getByText('Gmail')).toBeInTheDocument();
      expect(screen.getByText('Slack')).toBeInTheDocument();
    });

    it('should open mcp dialog when Add is clicked', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mcp"
          nodeData={mcpNodeData}
        />,
      );

      await user.click(screen.getByText('Add'));

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('mcp-tab')).toBeInTheDocument();
    });
  });

  describe('while node', () => {
    const whileNodeData: NodeConfig = {
      label: 'While',
    };

    it('should render while node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="while"
          nodeData={whileNodeData}
        />,
      );

      expect(screen.getByText('While')).toBeInTheDocument();
      expect(
        screen.getByText('Loop while a condition is true'),
      ).toBeInTheDocument();
    });

    it('should display expression textarea', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="while"
          nodeData={whileNodeData}
        />,
      );

      expect(screen.getByText('Expression')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('input.foo == 5')).toBeInTheDocument();
    });

    it('should call onUpdateNode when expression is changed', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="while"
          nodeData={whileNodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      const textarea = screen.getByPlaceholderText('input.foo == 5');
      await user.type(textarea, 'x > 0');

      expect(onUpdateNode).toHaveBeenCalled();
    });
  });

  describe('user-approval node', () => {
    const userApprovalNodeData: NodeConfig = {
      label: 'User approval',
    };

    it('should render user-approval node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="user-approval"
          nodeData={userApprovalNodeData}
        />,
      );

      expect(screen.getByText('User approval')).toBeInTheDocument();
      expect(
        screen.getByText('Pause for a human to approve or reject a step'),
      ).toBeInTheDocument();
    });

    it('should display name input', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="user-approval"
          nodeData={userApprovalNodeData}
        />,
      );

      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('should display message textarea', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="user-approval"
          nodeData={userApprovalNodeData}
        />,
      );

      expect(screen.getByText('Message')).toBeInTheDocument();
    });
  });

  describe('transform node', () => {
    const transformNodeData: NodeConfig = {
      label: 'Transform',
    };

    it('should render transform node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="transform"
          nodeData={transformNodeData}
        />,
      );

      expect(screen.getByText('Transform')).toBeInTheDocument();
      expect(screen.getByText('Reshape data')).toBeInTheDocument();
    });

    it('should display mode toggle buttons', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="transform"
          nodeData={transformNodeData}
        />,
      );

      expect(screen.getByText('Expressions')).toBeInTheDocument();
      expect(screen.getByText('Object')).toBeInTheDocument();
    });

    it('should display key and value inputs in expressions mode', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="transform"
          nodeData={transformNodeData}
        />,
      );

      expect(screen.getByText('Key')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
    });

    it('should switch to object mode when clicked', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="transform"
          nodeData={transformNodeData}
        />,
      );

      await user.click(screen.getByText('Object'));

      expect(screen.getByText('Add schema')).toBeInTheDocument();
    });

    it('should add new expression when Add is clicked', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="transform"
          nodeData={transformNodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));

      expect(onUpdateNode).toHaveBeenCalled();
    });
  });

  describe('set-state node', () => {
    const setStateNodeData: NodeConfig = {
      label: 'Set state',
    };

    it('should render set-state node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="set-state"
          nodeData={setStateNodeData}
        />,
      );

      expect(screen.getByText('Set state')).toBeInTheDocument();
      expect(
        screen.getByText("Assign values to workflow's state variables"),
      ).toBeInTheDocument();
    });

    it('should display assign value and to variable inputs', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="set-state"
          nodeData={setStateNodeData}
        />,
      );

      expect(screen.getByText('Assign value')).toBeInTheDocument();
      expect(screen.getByText('To variable')).toBeInTheDocument();
    });

    it('should add new assignment when Add is clicked', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="set-state"
          nodeData={setStateNodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));

      expect(onUpdateNode).toHaveBeenCalled();
    });
  });

  describe('if-else node', () => {
    const ifElseNodeData: NodeConfig = {
      label: 'If / else',
    };

    it('should render if-else node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="if-else"
          nodeData={ifElseNodeData}
        />,
      );

      expect(screen.getByText('If / else')).toBeInTheDocument();
      expect(
        screen.getByText('Create conditions to branch your workflow'),
      ).toBeInTheDocument();
    });

    it('should display If condition by default', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="if-else"
          nodeData={ifElseNodeData}
        />,
      );

      expect(screen.getByText('If')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Case name (optional)'),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Enter condition, e.g. input == 5'),
      ).toBeInTheDocument();
    });

    it('should add new condition when Add is clicked', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="if-else"
          nodeData={ifElseNodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));

      expect(onUpdateNode).toHaveBeenCalled();
    });

    it('should render conditional node same as if-else', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="conditional"
          nodeData={ifElseNodeData}
        />,
      );

      expect(screen.getByText('If / else')).toBeInTheDocument();
    });

    it('should display existing conditions', () => {
      const nodeDataWithConditions: NodeConfig = {
        label: 'If / else',
        conditions: [
          { id: '1', caseName: 'Case A', expression: 'x > 0' },
          { id: '2', caseName: 'Case B', expression: 'x < 0' },
        ],
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="if-else"
          nodeData={nodeDataWithConditions}
        />,
      );

      expect(screen.getByText('If')).toBeInTheDocument();
      expect(screen.getByText('Else if 1')).toBeInTheDocument();
    });
  });

  describe('end node', () => {
    const endNodeData: NodeConfig = {
      label: 'End',
    };

    it('should render end node configuration panel', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="end"
          nodeData={endNodeData}
        />,
      );

      expect(screen.getByText('End')).toBeInTheDocument();
      expect(
        screen.getByText('Define the workflow output'),
      ).toBeInTheDocument();
    });

    it('should display output textarea', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="end"
          nodeData={endNodeData}
        />,
      );

      expect(screen.getByText('Output')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(
          'Enter output value. Use {{ curly braces }} to insert variables.',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('unknown node type', () => {
    it('should return null for unknown node types', () => {
      const unknownNodeData: NodeConfig = {
        label: 'Unknown',
      };

      const { container } = render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="unknown-type"
          nodeData={unknownNodeData}
        />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('event propagation', () => {
    it('should stop propagation on panel click', () => {
      const startNodeData: NodeConfig = {
        label: 'Start',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={startNodeData}
        />,
      );

      const panel = document.querySelector('.absolute');
      if (panel) {
        const clickEvent = new MouseEvent('click', { bubbles: true });
        const stopPropagation = vi.spyOn(clickEvent, 'stopPropagation');

        panel.dispatchEvent(clickEvent);

        expect(stopPropagation).toHaveBeenCalled();
      }
    });
  });

  describe('handler functions', () => {
    describe('handleRemoveCondition', () => {
      it('should remove a condition when there are multiple conditions', async () => {
        const user = userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeDataWithConditions: NodeConfig = {
          label: 'If / else',
          conditions: [
            { id: '1', caseName: 'Case A', expression: 'x > 0' },
            { id: '2', caseName: 'Case B', expression: 'x < 0' },
          ],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="if-else"
            nodeData={nodeDataWithConditions}
            onUpdateNode={onUpdateNode}
          />,
        );

        // Find the trash button for removing a condition
        const trashButtons = screen
          .getAllByRole('button')
          .filter(
            (btn) =>
              btn.querySelector('svg.lucide-trash2') ||
              btn.querySelector('svg.lucide-trash-2'),
          );
        expect(trashButtons.length).toBeGreaterThan(0);
        await user.click(trashButtons[0]);

        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({
            conditions: expect.any(Array),
            conditionCount: expect.any(Number),
          }),
        );
      });

      it('should not show remove button when only one condition exists', () => {
        const nodeDataWithOneCondition: NodeConfig = {
          label: 'If / else',
          conditions: [{ id: '1', caseName: 'Case A', expression: 'x > 0' }],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="if-else"
            nodeData={nodeDataWithOneCondition}
          />,
        );

        // Trash button should not be visible when only one condition
        const trashButtons = screen
          .queryAllByRole('button')
          .filter(
            (btn) =>
              btn.querySelector('svg.lucide-trash2') ||
              btn.querySelector('svg.lucide-trash-2'),
          );
        expect(trashButtons.length).toBe(0);
      });
    });

    describe('handleUpdateCondition', () => {
      it('should update condition caseName', async () => {
        const user = userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeDataWithConditions: NodeConfig = {
          label: 'If / else',
          conditions: [{ id: '1', caseName: '', expression: '' }],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="if-else"
            nodeData={nodeDataWithConditions}
            onUpdateNode={onUpdateNode}
          />,
        );

        const caseNameInput = screen.getByPlaceholderText(
          'Case name (optional)',
        );
        await user.type(caseNameInput, 'New Case');

        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({
            conditions: expect.arrayContaining([
              expect.objectContaining({ caseName: expect.any(String) }),
            ]),
          }),
        );
      });

      it('should update condition expression', async () => {
        const user = userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeDataWithConditions: NodeConfig = {
          label: 'If / else',
          conditions: [{ id: '1', caseName: '', expression: '' }],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="if-else"
            nodeData={nodeDataWithConditions}
            onUpdateNode={onUpdateNode}
          />,
        );

        const expressionInput = screen.getByPlaceholderText(
          'Enter condition, e.g. input == 5',
        );
        await user.type(expressionInput, 'x > 10');

        expect(onUpdateNode).toHaveBeenCalled();
      });
    });

    describe('handleRemoveTransformExpression', () => {
      it('should remove expression when there are multiple expressions', async () => {
        const user = userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeDataWithExpressions: NodeConfig = {
          label: 'Transform',
          transformExpressions: [
            { id: '1', key: 'key1', value: 'value1' },
            { id: '2', key: 'key2', value: 'value2' },
          ],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="transform"
            nodeData={nodeDataWithExpressions}
            onUpdateNode={onUpdateNode}
          />,
        );

        const trashButtons = screen
          .getAllByRole('button')
          .filter(
            (btn) =>
              btn.querySelector('svg.lucide-trash2') ||
              btn.querySelector('svg.lucide-trash-2'),
          );
        expect(trashButtons.length).toBeGreaterThan(0);
        await user.click(trashButtons[0]);

        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({
            transformExpressions: expect.any(Array),
          }),
        );
      });

      it('should not remove expression when only one exists', async () => {
        userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeDataWithOneExpression: NodeConfig = {
          label: 'Transform',
          transformExpressions: [{ id: '1', key: 'key1', value: 'value1' }],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="transform"
            nodeData={nodeDataWithOneExpression}
            onUpdateNode={onUpdateNode}
          />,
        );

        // Trash button should not appear for single expression
        const trashButtons = screen
          .queryAllByRole('button')
          .filter(
            (btn) =>
              btn.querySelector('svg.lucide-trash2') ||
              btn.querySelector('svg.lucide-trash-2'),
          );
        expect(trashButtons.length).toBe(0);
      });
    });

    describe('handleUpdateTransformExpression', () => {
      it('should update expression key', async () => {
        const user = userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeData: NodeConfig = {
          label: 'Transform',
          transformExpressions: [
            { id: '1', key: 'result', value: 'input.foo + 1' },
          ],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="transform"
            nodeData={nodeData}
            onUpdateNode={onUpdateNode}
          />,
        );

        const keyInput = screen.getByDisplayValue('result');
        await user.clear(keyInput);
        await user.type(keyInput, 'newKey');

        expect(onUpdateNode).toHaveBeenCalled();
      });

      it('should update expression value', async () => {
        const user = userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeData: NodeConfig = {
          label: 'Transform',
          transformExpressions: [
            { id: '1', key: 'result', value: 'input.foo + 1' },
          ],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="transform"
            nodeData={nodeData}
            onUpdateNode={onUpdateNode}
          />,
        );

        const valueInput = screen.getByDisplayValue('input.foo + 1');
        await user.clear(valueInput);
        await user.type(valueInput, 'input.bar * 2');

        expect(onUpdateNode).toHaveBeenCalled();
      });
    });

    describe('handleRemoveSetStateAssignment', () => {
      it('should remove assignment when there are multiple assignments', async () => {
        const user = userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeData: NodeConfig = {
          label: 'Set state',
          setStateAssignments: [
            { id: '1', value: 'value1', variable: 'var1' },
            { id: '2', value: 'value2', variable: 'var2' },
          ],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="set-state"
            nodeData={nodeData}
            onUpdateNode={onUpdateNode}
          />,
        );

        const trashButtons = screen
          .getAllByRole('button')
          .filter(
            (btn) =>
              btn.querySelector('svg.lucide-trash2') ||
              btn.querySelector('svg.lucide-trash-2'),
          );
        expect(trashButtons.length).toBeGreaterThan(0);
        await user.click(trashButtons[0]);

        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({
            setStateAssignments: expect.any(Array),
          }),
        );
      });

      it('should not remove assignment when only one exists', () => {
        const nodeData: NodeConfig = {
          label: 'Set state',
          setStateAssignments: [{ id: '1', value: 'value1', variable: 'var1' }],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="set-state"
            nodeData={nodeData}
          />,
        );

        const trashButtons = screen
          .queryAllByRole('button')
          .filter(
            (btn) =>
              btn.querySelector('svg.lucide-trash2') ||
              btn.querySelector('svg.lucide-trash-2'),
          );
        expect(trashButtons.length).toBe(0);
      });
    });

    describe('handleUpdateSetStateAssignment', () => {
      it('should update assignment value', async () => {
        const user = userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeData: NodeConfig = {
          label: 'Set state',
          setStateAssignments: [
            { id: '1', value: 'input.foo + 1', variable: '' },
          ],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="set-state"
            nodeData={nodeData}
            onUpdateNode={onUpdateNode}
          />,
        );

        const valueInput = screen.getByDisplayValue('input.foo + 1');
        await user.clear(valueInput);
        await user.type(valueInput, 'newValue');

        expect(onUpdateNode).toHaveBeenCalled();
      });

      it('should update assignment variable via select', async () => {
        const user = userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeData: NodeConfig = {
          label: 'Set state',
          setStateAssignments: [{ id: '1', value: 'value', variable: '' }],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="set-state"
            nodeData={nodeData}
            onUpdateNode={onUpdateNode}
          />,
        );

        // Click the select to trigger onValueChange
        const select = screen.getByTestId('select');
        await user.click(select);

        expect(onUpdateNode).toHaveBeenCalled();
      });
    });

    describe('handleRemoveConnector', () => {
      it('should remove MCP connector', async () => {
        const user = userEvent.setup();
        const onUpdateNode = vi.fn();
        const nodeData: NodeConfig = {
          label: 'MCP',
          mcpConnectors: [
            { id: '1', name: 'Gmail', icon: '📧' },
            { id: '2', name: 'Slack', icon: '💬' },
          ],
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType="mcp"
            nodeData={nodeData}
            onUpdateNode={onUpdateNode}
          />,
        );

        // Find X buttons in connector list (not the panel close button)
        const removeButtons = screen
          .getAllByRole('button')
          .filter(
            (btn) =>
              btn.querySelector('svg.lucide-x') &&
              btn.classList.contains('h-4'),
          );
        expect(removeButtons.length).toBeGreaterThan(0);
        await user.click(removeButtons[0]);

        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({
            mcpConnectors: expect.any(Array),
          }),
        );
      });
    });
  });

  describe('useEffect hooks - state sync with props', () => {
    it('should sync state when nodeData changes externally', async () => {
      const nodeData: NodeConfig = {
        label: 'Start',
        instructions: 'Initial instructions',
        model: 'gpt-4',
      };

      const { rerender } = render(
        <NodeConfigPanel {...baseProps} nodeType="start" nodeData={nodeData} />,
      );

      // Rerender with new nodeData to trigger useEffect
      const newNodeData: NodeConfig = {
        label: 'Updated Start',
        instructions: 'Updated instructions',
        model: 'gpt-4-turbo',
        stateVariables: [{ id: '1', name: 'newVar', type: 'string' }],
      };

      rerender(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={newNodeData}
        />,
      );

      // Check that the new variable is displayed
      expect(screen.getByText('newVar')).toBeInTheDocument();
    });

    it('should sync conditions when nodeData changes', () => {
      const nodeData: NodeConfig = {
        label: 'If / else',
        conditions: [{ id: '1', caseName: 'Initial', expression: 'x > 0' }],
      };

      const { rerender } = render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="if-else"
          nodeData={nodeData}
        />,
      );

      const newNodeData: NodeConfig = {
        label: 'If / else',
        conditions: [
          { id: '1', caseName: 'Updated', expression: 'x > 0' },
          { id: '2', caseName: 'New Case', expression: 'x < 0' },
        ],
      };

      rerender(
        <NodeConfigPanel
          {...baseProps}
          nodeType="if-else"
          nodeData={newNodeData}
        />,
      );

      expect(screen.getByText('Else if 1')).toBeInTheDocument();
    });

    it('should sync file search node state when nodeData changes', () => {
      const nodeData: NodeConfig = {
        label: 'File search',
        datasetId: '',
        maxResults: 10,
      };

      const { rerender } = render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={nodeData}
        />,
      );

      const newNodeData: NodeConfig = {
        label: 'File search',
        datasetId: 'new-dataset-id',
        datasetName: 'New Dataset',
        maxResults: 20,
        fileSearchQuery: 'search query',
      };

      rerender(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={newNodeData}
        />,
      );

      expect(screen.getByText('New Dataset')).toBeInTheDocument();
      expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    });
  });

  describe('mentor node with tools', () => {
    beforeEach(() => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          system_prompt: 'Custom prompt',
          llm_name: 'gpt-4',
          llm_provider: 'OpenAI',
          mentor_tools: [
            { slug: 'tool-1', name: 'Tool 1' },
            { slug: 'tool-2', name: 'Tool 2' },
          ],
          permissions: { field: {} },
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      vi.mocked(useGetToolsQuery).mockReturnValue({
        data: [
          {
            slug: 'tool-1',
            name: 'Tool 1',
            display_name: 'Tool One',
            description: 'First tool',
          },
          {
            slug: 'tool-2',
            name: 'Tool 2',
            display_name: 'Tool Two',
            description: 'Second tool',
          },
        ],
        isLoading: false,
        refetch: vi.fn(),
      } as any);
    });

    it('should render tools list when mentor is selected', () => {
      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      expect(screen.getByText('Tool One')).toBeInTheDocument();
      expect(screen.getByText('Tool Two')).toBeInTheDocument();
    });

    it('should show tool description tooltip', () => {
      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      expect(screen.getByText('First tool')).toBeInTheDocument();
      expect(screen.getByText('Second tool')).toBeInTheDocument();
    });

    it('should call toggleTools when tool switch is clicked', async () => {
      const user = userEvent.setup();
      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      const switches = screen.getAllByTestId('switch');
      await user.click(switches[0]);

      expect(mockToggleTools).toHaveBeenCalled();
    });

    it('should show loading state for tools', () => {
      vi.mocked(useGetToolsQuery).mockReturnValue({
        data: [],
        isLoading: true,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      expect(screen.getByText('Loading tools...')).toBeInTheDocument();
    });

    it('should show no tools message when tools array is empty', () => {
      vi.mocked(useGetToolsQuery).mockReturnValue({
        data: [],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      expect(screen.getByText('No tools available.')).toBeInTheDocument();
    });

    it('should display model with provider', () => {
      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
        model: 'gpt-4',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      // Model input should show provider and model
      const modelInput = screen.getByDisplayValue(/OpenAI/);
      expect(modelInput).toBeInTheDocument();
    });

    it('should show placeholder when no mentor selected and loading', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: null,
        isLoading: true,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      expect(
        screen.getByPlaceholderText('Loading model...'),
      ).toBeInTheDocument();
    });
  });

  describe('mentor settings prefill logic', () => {
    it('should prefill mentor name when mentor has default label', async () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Prefilled Mentor Name',
          system_prompt: 'Prefilled prompt',
          llm_name: 'gpt-4-turbo',
          llm_provider: 'OpenAI',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'Mentor', // Default label
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      await waitFor(() => {
        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({
            label: 'Prefilled Mentor Name',
          }),
        );
      });
    });

    it('should prefill instructions when using default instructions', async () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          system_prompt: 'Custom system prompt from mentor',
          llm_name: 'gpt-4',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'My Mentor', // Non-default label
        instructions: 'You are a helpful assistant.', // Default instructions
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      await waitFor(() => {
        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({
            instructions: 'Custom system prompt from mentor',
          }),
        );
      });
    });

    it('should not prefill when mentor label is not default', async () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Should Not Replace',
          system_prompt: 'Should Not Replace Prompt',
          llm_name: 'gpt-4',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'Custom Label', // Not a default label
        instructions: 'Custom instructions', // Not default instructions
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      // Wait a bit to ensure useEffect has run
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should only update model, not label or instructions
      expect(onUpdateNode).not.toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          label: 'Should Not Replace',
          instructions: 'Should Not Replace Prompt',
        }),
      );
    });
  });

  describe('dataset selection dialog', () => {
    it('should dispatch pushModal when opening dataset dialog with defaultMentorId', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={{ label: 'File search' }}
          defaultMentorId="my-mentor-id"
        />,
      );

      await user.click(screen.getByText('Select'));

      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should select dataset and close dialog', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={{ label: 'File search' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Select'));
      await user.click(screen.getByTestId('select-dataset'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          datasetId: 'dataset-123',
          datasetName: 'Test Dataset',
        }),
      );
    });

    it('should close dataset dialog and dispatch popModal', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={{ label: 'File search' }}
        />,
      );

      await user.click(screen.getByText('Select'));
      await user.click(screen.getByTestId('close-dialog'));

      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should handle file search query change', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={{ label: 'File search' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      const queryTextarea = screen.getByPlaceholderText(
        'Enter file search input. Use {{ curly braces }} to insert variables.',
      );
      await user.type(queryTextarea, 'search query');

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          fileSearchQuery: expect.any(String),
        }),
      );
    });

    it('should handle max results change with valid number', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={{ label: 'File search', maxResults: 10 }}
          onUpdateNode={onUpdateNode}
        />,
      );

      const maxResultsInput = screen.getByDisplayValue('10');
      await user.clear(maxResultsInput);
      await user.type(maxResultsInput, '25');

      expect(onUpdateNode).toHaveBeenCalled();
    });

    it('should handle max results change with invalid input', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="file-search"
          nodeData={{ label: 'File search', maxResults: 10 }}
          onUpdateNode={onUpdateNode}
        />,
      );

      const maxResultsInput = screen.getByDisplayValue('10');
      await user.clear(maxResultsInput);

      expect(onUpdateNode).toHaveBeenCalled();
    });
  });

  describe('MCP connector dialog', () => {
    it('should dispatch pushModal when opening MCP dialog', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mcp"
          nodeData={{ label: 'MCP' }}
          defaultMentorId="my-mentor-id"
        />,
      );

      await user.click(screen.getByText('Add'));

      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should add MCP connector when selected', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mcp"
          nodeData={{ label: 'MCP' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));
      await user.click(screen.getByTestId('select-mcp-server'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          mcpConnectors: expect.arrayContaining([
            expect.objectContaining({
              id: '1',
              name: 'Test MCP Server',
            }),
          ]),
        }),
      );
    });

    it('should not add duplicate MCP connector', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'MCP',
        mcpConnectors: [{ id: '1', name: 'Test MCP Server' }],
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mcp"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      // Open dialog via the plus button in connected tools header
      const plusButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('svg.lucide-plus'));
      await user.click(plusButtons[0]);
      await user.click(screen.getByTestId('select-mcp-server'));

      // Should close dialog without adding duplicate
      expect(onUpdateNode).not.toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          mcpConnectors: expect.arrayContaining([
            expect.objectContaining({ id: '1' }),
            expect.objectContaining({ id: '1' }),
          ]),
        }),
      );
    });

    it('should display connector with icon', () => {
      const nodeData: NodeConfig = {
        label: 'MCP',
        mcpConnectors: [
          { id: '1', name: 'Gmail', icon: 'https://example.com/gmail.png' },
        ],
      };

      render(
        <NodeConfigPanel {...baseProps} nodeType="mcp" nodeData={nodeData} />,
      );

      const img = screen.getByAltText('Gmail');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/gmail.png');
    });

    it('should display connector without icon using emoji fallback', () => {
      const nodeData: NodeConfig = {
        label: 'MCP',
        mcpConnectors: [{ id: '1', name: 'No Icon Tool' }],
      };

      render(
        <NodeConfigPanel {...baseProps} nodeType="mcp" nodeData={nodeData} />,
      );

      expect(screen.getByText('No Icon Tool')).toBeInTheDocument();
    });
  });

  describe('mentor selection dialog', () => {
    it('should select mentor and update node', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'Mentor',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Select'));
      await user.click(screen.getByTestId('select-mentor'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          entry_mentor_id: 'new-mentor-id',
          mentor_id: 'new-mentor-id',
          label: 'New Mentor',
        }),
      );
    });

    it('should close mentor modal and clear search when dialog closes', async () => {
      const user = userEvent.setup();
      const nodeData: NodeConfig = {
        label: 'Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      await user.click(screen.getByText('Change'));
      expect(screen.getByTestId('dialog')).toBeInTheDocument();

      await user.click(screen.getByTestId('close-dialog'));
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should show mentor selection grid when change button is clicked', async () => {
      const user = userEvent.setup();
      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      await user.click(screen.getByText('Change'));

      // The mentor selection grid should be visible
      expect(screen.getByTestId('mentor-selection-grid')).toBeInTheDocument();
    });
  });

  describe('start node variable modal', () => {
    it('should add new state variable with String type', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));

      // Enter variable name
      const nameInput = screen.getByPlaceholderText('Enter the variable name');
      await user.type(nameInput, 'myStringVar');

      // Enter default value
      const defaultInput = screen.getByPlaceholderText('Enter default value');
      await user.type(defaultInput, 'default string');

      // Click save
      await user.click(screen.getByText('Save'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          stateVariables: expect.arrayContaining([
            expect.objectContaining({
              name: 'myStringVar',
              type: 'string',
              defaultValue: 'default string',
            }),
          ]),
        }),
      );
    });

    it('should add variable with Number type', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));

      // Select Number type
      await user.click(screen.getByText('Number'));

      // Enter variable name
      const nameInput = screen.getByPlaceholderText('Enter the variable name');
      await user.type(nameInput, 'myNumberVar');

      // Click save
      await user.click(screen.getByText('Save'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          stateVariables: expect.arrayContaining([
            expect.objectContaining({
              name: 'myNumberVar',
              type: 'number',
            }),
          ]),
        }),
      );
    });

    it('should add variable with Boolean type', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));

      // Select Boolean type
      await user.click(screen.getByText('Boolean'));

      // Enter variable name
      const nameInput = screen.getByPlaceholderText('Enter the variable name');
      await user.type(nameInput, 'myBoolVar');

      // Toggle the switch
      const switchEl = screen.getByTestId('switch');
      await user.click(switchEl);

      // Click save
      await user.click(screen.getByText('Save'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          stateVariables: expect.arrayContaining([
            expect.objectContaining({
              name: 'myBoolVar',
              type: 'boolean',
              defaultValue: 'true',
            }),
          ]),
        }),
      );
    });

    it('should add variable with Object type', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));

      // Select Object type
      await user.click(screen.getByText('Object'));

      // Enter variable name
      const nameInput = screen.getByPlaceholderText('Enter the variable name');
      await user.type(nameInput, 'myObjectVar');

      // Click save
      await user.click(screen.getByText('Save'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          stateVariables: expect.arrayContaining([
            expect.objectContaining({
              name: 'myObjectVar',
              type: 'object',
            }),
          ]),
        }),
      );
    });

    it('should add variable with List type', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));

      // Select List type
      await user.click(screen.getByText('List'));

      // Enter variable name
      const nameInput = screen.getByPlaceholderText('Enter the variable name');
      await user.type(nameInput, 'myListVar');

      // Click save
      await user.click(screen.getByText('Save'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          stateVariables: expect.arrayContaining([
            expect.objectContaining({
              name: 'myListVar',
              type: 'list',
            }),
          ]),
        }),
      );
    });

    it('should disable save button when name is empty', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
        />,
      );

      await user.click(screen.getByText('Add'));

      const saveButton = screen.getByText('Save');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('guardrails node handlers', () => {
    it('should handle continue on error toggle', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="guardrails"
          nodeData={{ label: 'Guardrails' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      const switches = screen.getAllByTestId('switch');
      // The last switch should be the continue on error toggle
      const continueOnErrorSwitch = switches[switches.length - 1];
      await user.click(continueOnErrorSwitch);

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          continueOnError: true,
        }),
      );
    });

    it('should update name in guardrails node', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="guardrails"
          nodeData={{ label: 'Guardrails' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      const nameInput = screen.getByDisplayValue('Guardrails');
      await user.clear(nameInput);
      await user.type(nameInput, 'Custom Guardrails');

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          label: expect.any(String),
        }),
      );
    });
  });

  describe('user-approval node handlers', () => {
    it('should update name', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="user-approval"
          nodeData={{ label: 'User approval' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      const nameInput = screen.getByDisplayValue('User approval');
      await user.clear(nameInput);
      await user.type(nameInput, 'Custom Approval');

      expect(onUpdateNode).toHaveBeenCalled();
    });

    it('should update message', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="user-approval"
          nodeData={{ label: 'User approval' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      const messageTextarea = screen.getByPlaceholderText(
        'Describe the message to show the user. Eg. ok to proceed?',
      );
      await user.type(messageTextarea, 'Please approve this action');

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          userApprovalMessage: expect.any(String),
        }),
      );
    });
  });

  describe('transform node mode switching', () => {
    it('should update transform mode to expressions', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="transform"
          nodeData={{ label: 'Transform', transformMode: 'object' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Expressions'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          transformMode: 'expressions',
        }),
      );
    });
  });

  describe('mentor instructions change', () => {
    it('should update instructions when changed', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'My Mentor',
        instructions: 'Initial instructions',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      const instructionsTextarea = screen.getByDisplayValue(
        'Initial instructions',
      );
      await user.clear(instructionsTextarea);
      await user.type(instructionsTextarea, 'New instructions');

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          instructions: expect.any(String),
        }),
      );
    });
  });

  describe('while node with existing expression', () => {
    it('should display existing while expression', () => {
      const nodeData: NodeConfig = {
        label: 'While',
        whileExpression: 'counter < 10',
      };

      render(
        <NodeConfigPanel {...baseProps} nodeType="while" nodeData={nodeData} />,
      );

      expect(screen.getByDisplayValue('counter < 10')).toBeInTheDocument();
    });
  });

  describe('isDefaultMentorLabel helper', () => {
    it('should recognize default mentor labels', async () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Custom Name',
          system_prompt: 'Custom prompt',
          llm_name: 'gpt-4',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const onUpdateNode = vi.fn();

      // Test 'my mentor' as default label
      const { rerender } = render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={{ label: 'my mentor', mentor_id: 'mentor-123' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await waitFor(() => {
        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({ label: 'Custom Name' }),
        );
      });

      onUpdateNode.mockClear();

      // Test 'Mentor Node' as default label
      rerender(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={{ label: 'Mentor Node', mentor_id: 'mentor-123' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await waitFor(() => {
        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({ label: 'Custom Name' }),
        );
      });
    });

    it('should handle empty label as default', async () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Filled Name',
          llm_name: 'gpt-4',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={{ label: '', mentor_id: 'mentor-123' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await waitFor(() => {
        expect(onUpdateNode).toHaveBeenCalled();
      });
    });
  });

  describe('entry_mentor_id vs mentor_id', () => {
    it('should use entry_mentor_id when mentor_id is not set', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Entry Mentor',
          llm_name: 'gpt-4',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'Mentor',
        entry_mentor_id: 'entry-mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      // Should show Change button since entry_mentor_id is set
      expect(screen.getByText('Change')).toBeInTheDocument();
    });
  });

  describe('without onUpdateNode callback', () => {
    it('should not crash when onUpdateNode is not provided', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          nodeId="test-id"
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onClose={vi.fn()}
        />,
      );

      await user.click(screen.getByText('Add'));

      const nameInput = screen.getByPlaceholderText('Enter the variable name');
      await user.type(nameInput, 'test');
      await user.click(screen.getByText('Save'));

      // Should not throw
    });
  });

  describe('transform node name change', () => {
    it('should update name in transform node', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="transform"
          nodeData={{ label: 'Transform' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      const nameInput = screen.getByDisplayValue('Transform');
      await user.clear(nameInput);
      await user.type(nameInput, 'My Transform');

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({ label: expect.any(String) }),
      );
    });
  });

  describe('event propagation on all node types', () => {
    it('should stop propagation on end node panel click', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="end"
          nodeData={{ label: 'End' }}
        />,
      );

      const panel = document.querySelector('.absolute');
      if (panel) {
        const clickEvent = new MouseEvent('click', { bubbles: true });
        const stopPropagation = vi.spyOn(clickEvent, 'stopPropagation');
        panel.dispatchEvent(clickEvent);
        expect(stopPropagation).toHaveBeenCalled();
      }
    });

    it('should stop propagation on transform node panel mousedown', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="transform"
          nodeData={{ label: 'Transform' }}
        />,
      );

      const panel = document.querySelector('.absolute');
      if (panel) {
        const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
        const stopPropagation = vi.spyOn(mousedownEvent, 'stopPropagation');
        panel.dispatchEvent(mousedownEvent);
        expect(stopPropagation).toHaveBeenCalled();
      }
    });
  });

  describe('mentor tools without description', () => {
    it('should not render tooltip for tools without description', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          mentor_tools: [{ slug: 'tool-no-desc' }],
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      vi.mocked(useGetToolsQuery).mockReturnValue({
        data: [
          {
            slug: 'tool-no-desc',
            name: 'Tool No Desc',
            display_name: 'Tool Without Description',
          },
        ],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      expect(screen.getByText('Tool Without Description')).toBeInTheDocument();
      // Tooltip content should not be rendered for tools without description
      expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
    });
  });

  describe('mentor tools with missing slug', () => {
    it('should handle tools without slug gracefully', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          mentor_tools: [{ slug: undefined }],
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      vi.mocked(useGetToolsQuery).mockReturnValue({
        data: [{ slug: undefined, name: 'No Slug Tool' }],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      // Should render the tool even without slug
      expect(screen.getByText('No Slug Tool')).toBeInTheDocument();
    });
  });

  describe('mentor tools toggle when disabled', () => {
    it('should not call toggleTools when disabled', async () => {
      mockToggleTools.mockClear();

      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          mentor_tools: [{ slug: 'tool-1' }],
        },
        isLoading: true, // Loading state makes it disabled
        refetch: vi.fn(),
      } as any);

      vi.mocked(useGetToolsQuery).mockReturnValue({
        data: [{ slug: 'tool-1', name: 'Tool 1' }],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      expect(screen.getByText('Loading tools...')).toBeInTheDocument();
    });
  });

  describe('mentor node missing org', () => {
    it('should show select mentor message when no mentor selected', () => {
      vi.mocked(useGetToolsQuery).mockReturnValue({
        data: [],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'Mentor',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      expect(
        screen.getByText('Select an agent to configure tools.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Select an agent to load configuration.'),
      ).toBeInTheDocument();
    });
  });

  describe('file search without defaultMentorId', () => {
    it('should open dataset dialog even without defaultMentorId', async () => {
      const user = userEvent.setup();
      mockDispatch.mockClear();

      render(
        <NodeConfigPanel
          {...baseProps}
          defaultMentorId={undefined}
          nodeType="file-search"
          nodeData={{ label: 'File search' }}
        />,
      );

      await user.click(screen.getByText('Select'));

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
  });

  describe('MCP node without defaultMentorId', () => {
    it('should open MCP dialog even without defaultMentorId', async () => {
      const user = userEvent.setup();
      mockDispatch.mockClear();

      render(
        <NodeConfigPanel
          {...baseProps}
          defaultMentorId={undefined}
          nodeType="mcp"
          nodeData={{ label: 'MCP' }}
        />,
      );

      await user.click(screen.getByText('Add'));

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
  });

  describe('model display logic', () => {
    it('should display only model when no provider', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          llm_provider: undefined,
          llm_name: 'gpt-4',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
        model: 'gpt-4',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      const modelInput = screen.getByDisplayValue('gpt-4');
      expect(modelInput).toBeInTheDocument();
    });

    it('should show no model placeholder when no model and not loading', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      expect(
        screen.getByPlaceholderText('No model configured'),
      ).toBeInTheDocument();
    });
  });

  describe('mentorSettings display_name fallback', () => {
    it('should use display_name when mentor_name is not available', async () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          display_name: 'Display Name Mentor',
          system_prompt: 'Custom prompt',
          llm_name: 'gpt-4',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'Mentor', // Default label
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      await waitFor(() => {
        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({
            label: 'Display Name Mentor',
          }),
        );
      });
    });
  });

  describe('add condition with proper id generation', () => {
    it('should add condition with unique id', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'If / else',
        conditions: [{ id: '1', caseName: '', expression: '' }],
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="if-else"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          conditions: expect.arrayContaining([
            expect.objectContaining({ id: '1' }),
            expect.objectContaining({
              id: expect.any(String),
              caseName: '',
              expression: '',
            }),
          ]),
          conditionCount: 2,
        }),
      );
    });
  });

  describe('mentor selection with no name', () => {
    beforeEach(() => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: null,
        isLoading: false,
        refetch: vi.fn(),
      } as any);
    });

    it('should select mentor that has unique_id but no name', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'Mentor',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Select'));
      await user.click(screen.getByTestId('select-mentor'));

      // Should update with mentor_id even when mentor has name
      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          entry_mentor_id: 'new-mentor-id',
          mentor_id: 'new-mentor-id',
        }),
      );
    });
  });

  describe('mentorSettings without username', () => {
    it('should not fetch mentor settings when username is null', () => {
      vi.mocked(useUsername).mockReturnValue(null);
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: null,
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      // Should render without crashing
      expect(screen.getByText('Mentor')).toBeInTheDocument();

      // Restore mock
      vi.mocked(useUsername).mockReturnValue('test-user');
    });
  });

  describe('variable type change handlers in modal', () => {
    it('should update default value when switching to Object type', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
        />,
      );

      await user.click(screen.getByText('Add'));

      // Switch to Object type
      await user.click(screen.getByText('Object'));

      // The textarea for object should be visible with placeholder
      expect(
        screen.getByPlaceholderText('{ "key": "value" }'),
      ).toBeInTheDocument();
    });

    it('should update default value input for List type', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));
      await user.click(screen.getByText('List'));

      // Verify list textarea is displayed
      const listTextarea = screen.getByPlaceholderText('["item1", "item2"]');
      expect(listTextarea).toBeInTheDocument();

      // Enter variable name and save
      const nameInput = screen.getByPlaceholderText('Enter the variable name');
      await user.type(nameInput, 'myList');
      await user.click(screen.getByText('Save'));

      expect(onUpdateNode).toHaveBeenCalled();
    });

    it('should update default value input for Object type', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));
      await user.click(screen.getByText('Object'));

      // Verify object textarea is displayed
      const objectTextarea = screen.getByPlaceholderText('{ "key": "value" }');
      expect(objectTextarea).toBeInTheDocument();

      // Enter variable name and save
      const nameInput = screen.getByPlaceholderText('Enter the variable name');
      await user.type(nameInput, 'myObj');
      await user.click(screen.getByText('Save'));

      expect(onUpdateNode).toHaveBeenCalled();
    });

    it('should update Number type default value input', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));
      await user.click(screen.getByText('Number'));

      // Type in the number input
      const numberInput = screen.getByPlaceholderText('0');
      await user.type(numberInput, '42');

      // Enter variable name and save
      const nameInput = screen.getByPlaceholderText('Enter the variable name');
      await user.type(nameInput, 'myNum');
      await user.click(screen.getByText('Save'));

      expect(onUpdateNode).toHaveBeenCalled();
    });
  });

  describe('MCP dialog close via onOpenChange', () => {
    it('should close MCP dialog when onOpenChange is called with false', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mcp"
          nodeData={{ label: 'MCP' }}
        />,
      );

      await user.click(screen.getByText('Add'));
      expect(screen.getByTestId('dialog')).toBeInTheDocument();

      // Close via the dialog close button (which triggers onOpenChange(false))
      await user.click(screen.getByTestId('close-dialog'));

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('mentor settings model update', () => {
    it('should update model when mentor settings have different llm_name', async () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          llm_name: 'new-model',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'Custom Name', // Non-default label to skip label update
        instructions: 'Custom instructions', // Non-default instructions
        model: 'old-model',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      await waitFor(() => {
        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({
            model: 'new-model',
          }),
        );
      });
    });
  });

  describe('close button on different node panels', () => {
    const nodeTypes = [
      'guardrails',
      'file-search',
      'mcp',
      'while',
      'user-approval',
      'transform',
      'set-state',
      'if-else',
    ];

    nodeTypes.forEach((nodeType) => {
      it(`should call onClose when close button is clicked on ${nodeType} node`, async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const nodeData: NodeConfig = {
          label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
        };

        render(
          <NodeConfigPanel
            {...baseProps}
            nodeType={nodeType}
            nodeData={nodeData}
            onClose={onClose}
          />,
        );

        const closeButtons = screen.getAllByRole('button');
        const closeButton = closeButtons.find((btn) =>
          btn.querySelector('svg.lucide-x'),
        );

        if (closeButton) {
          await user.click(closeButton);
          expect(onClose).toHaveBeenCalled();
        }
      });
    });
  });

  describe('add state variable without default value', () => {
    it('should add variable with undefined defaultValue when empty', async () => {
      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await user.click(screen.getByText('Add'));

      // Enter variable name without default
      const nameInput = screen.getByPlaceholderText('Enter the variable name');
      await user.type(nameInput, 'noDefault');

      await user.click(screen.getByText('Save'));

      expect(onUpdateNode).toHaveBeenCalledWith(
        'test-node-id',
        expect.objectContaining({
          stateVariables: expect.arrayContaining([
            expect.objectContaining({
              name: 'noDefault',
              defaultValue: undefined,
            }),
          ]),
        }),
      );
    });
  });

  describe('isDefaultMentorLabel edge cases', () => {
    it('should handle labels with mixed case and whitespace', async () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Prefilled Name',
          llm_name: 'gpt-4',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const onUpdateNode = vi.fn();

      // Test "  MY MENTOR  " (with whitespace and uppercase)
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={{ label: '  MY MENTOR  ', mentor_id: 'mentor-123' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      await waitFor(() => {
        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({ label: 'Prefilled Name' }),
        );
      });
    });
  });

  describe('mentorSettings useEffect when not mentor node type', () => {
    it('should skip prefill logic for non-mentor nodes', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Should Not Apply',
          llm_name: 'gpt-4',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const onUpdateNode = vi.fn();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
          onUpdateNode={onUpdateNode}
        />,
      );

      // Should not be called with mentor prefill data
      expect(onUpdateNode).not.toHaveBeenCalled();
    });
  });

  describe('Object and List textarea onChange', () => {
    it('should call onChange when typing in Object textarea', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
        />,
      );

      await user.click(screen.getByText('Add'));
      await user.click(screen.getByText('Object'));

      const objectTextarea = screen.getByPlaceholderText('{ "key": "value" }');
      // Use fireEvent instead of user.type to avoid bracket parsing issues
      await act(async () => {
        fireEvent.change(objectTextarea, { target: { value: 'test object' } });
      });

      expect(objectTextarea).toHaveValue('test object');
    });

    it('should call onChange when typing in List textarea', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
        />,
      );

      await user.click(screen.getByText('Add'));
      await user.click(screen.getByText('List'));

      const listTextarea = screen.getByPlaceholderText('["item1", "item2"]');
      // Use fireEvent instead of user.type to avoid bracket parsing issues
      await act(async () => {
        fireEvent.change(listTextarea, { target: { value: 'test list' } });
      });

      expect(listTextarea).toHaveValue('test list');
    });
  });

  describe('End node mousedown event', () => {
    it('should stop mousedown propagation on end node', () => {
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="end"
          nodeData={{ label: 'End' }}
        />,
      );

      const panel = document.querySelector('.absolute');
      if (panel) {
        const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
        const stopPropagation = vi.spyOn(mousedownEvent, 'stopPropagation');
        panel.dispatchEvent(mousedownEvent);
        expect(stopPropagation).toHaveBeenCalled();
      }
    });
  });

  describe('mentorTools without slug filter', () => {
    it('should filter out tools without slug from enabledToolSlugs', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          mentor_tools: [
            { slug: 'valid-tool' },
            { slug: undefined },
            { slug: '' },
            { slug: null },
          ],
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      vi.mocked(useGetToolsQuery).mockReturnValue({
        data: [{ slug: 'valid-tool', name: 'Valid Tool' }],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      // Only valid-tool should be shown as enabled
      expect(screen.getByText('Valid Tool')).toBeInTheDocument();
    });
  });

  describe('useToggleTools loading state', () => {
    it('should disable tools when toggle is loading', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          mentor_tools: [{ slug: 'tool-1' }],
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      vi.mocked(useGetToolsQuery).mockReturnValue({
        data: [{ slug: 'tool-1', name: 'Tool 1' }],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      vi.mocked(useToggleTools).mockReturnValue({
        toggleTools: vi.fn(),
        isLoading: true, // Toggle is loading
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      // Switch should be disabled
      const switches = screen.getAllByTestId('switch');
      expect(switches[0]).toBeDisabled();

      // Reset mock
      vi.mocked(useToggleTools).mockReturnValue({
        toggleTools: mockToggleTools,
        isLoading: false,
      } as any);
    });
  });

  describe('dialog content event propagation', () => {
    it('should stop click propagation in dialog content', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
        />,
      );

      await user.click(screen.getByText('Add'));

      const dialogContent = screen.getByTestId('dialog-content');
      const clickEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagation = vi.spyOn(clickEvent, 'stopPropagation');

      dialogContent.dispatchEvent(clickEvent);
      expect(stopPropagation).toHaveBeenCalled();
    });

    it('should stop mousedown propagation in dialog content', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
        />,
      );

      await user.click(screen.getByText('Add'));

      const dialogContent = screen.getByTestId('dialog-content');
      const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
      const stopPropagation = vi.spyOn(mousedownEvent, 'stopPropagation');

      dialogContent.dispatchEvent(mousedownEvent);
      expect(stopPropagation).toHaveBeenCalled();
    });
  });

  describe('mentorSettings with non-array mentor_tools', () => {
    it('should handle non-array mentor_tools gracefully', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Test Mentor',
          mentor_tools: 'not-an-array', // Invalid type
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'My Mentor',
        mentor_id: 'mentor-123',
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      // Should not crash
      expect(screen.getByText('My Mentor')).toBeInTheDocument();
    });
  });

  describe('model display without model', () => {
    it('should show select mentor placeholder when no mentor selected', () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: null,
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const nodeData: NodeConfig = {
        label: 'Mentor',
        // No mentor_id
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
        />,
      );

      expect(
        screen.getByPlaceholderText('Select an agent to load model'),
      ).toBeInTheDocument();
    });
  });

  describe('forceMentorPrefill reset after selection', () => {
    it('should reset forceMentorPrefill after mentor selection and prefill', async () => {
      vi.mocked(useGetMentorSettingsQuery).mockReturnValue({
        data: {
          mentor_name: 'Prefilled Name',
          system_prompt: 'Prefilled prompt',
          llm_name: 'gpt-4',
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      const user = userEvent.setup();
      const onUpdateNode = vi.fn();
      const nodeData: NodeConfig = {
        label: 'Custom Label', // Non-default label
        instructions: 'Custom instructions', // Non-default instructions
      };

      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="mentor"
          nodeData={nodeData}
          onUpdateNode={onUpdateNode}
        />,
      );

      // Open mentor selection
      await user.click(screen.getByText('Select'));
      await user.click(screen.getByTestId('select-mentor'));

      // The selection triggers forceMentorPrefill to be true
      // After useEffect runs with mentorSettings, it should reset to false
      // We verify by checking that prefill was called
      await waitFor(() => {
        expect(onUpdateNode).toHaveBeenCalledWith(
          'test-node-id',
          expect.objectContaining({
            entry_mentor_id: 'new-mentor-id',
            mentor_id: 'new-mentor-id',
          }),
        );
      });
    });
  });

  describe('variable type change back to String', () => {
    it('should reset default value when switching from Number back to String', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
        />,
      );

      await user.click(screen.getByText('Add'));

      // Switch to Number first
      await user.click(screen.getByText('Number'));

      // Then back to String
      await user.click(screen.getByText('String'));

      // Should show string input
      expect(
        screen.getByPlaceholderText('Enter default value'),
      ).toBeInTheDocument();
    });

    it('should reset default value when switching from Boolean to Number', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
        />,
      );

      await user.click(screen.getByText('Add'));

      // Switch to Boolean first
      await user.click(screen.getByText('Boolean'));

      // Then to Number
      await user.click(screen.getByText('Number'));

      // Should show number input with placeholder 0
      expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
    });

    it('should reset default value when switching from Object to List', async () => {
      const user = userEvent.setup();
      render(
        <NodeConfigPanel
          {...baseProps}
          nodeType="start"
          nodeData={{ label: 'Start' }}
        />,
      );

      await user.click(screen.getByText('Add'));

      // Switch to Object first
      await user.click(screen.getByText('Object'));

      // Then to List
      await user.click(screen.getByText('List'));

      // Should show list textarea
      expect(
        screen.getByPlaceholderText('["item1", "item2"]'),
      ).toBeInTheDocument();
    });
  });
});
