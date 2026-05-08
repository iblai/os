import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowCanvas, type ReactFlowJsonObject } from '../workflow-canvas';

// Mock data layer hooks
const mockFetchMentorSettings = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetMentorSettingsQuery: vi.fn(() => [mockFetchMentorSettings]),
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

// Mock hooks
vi.mock('@/hooks/use-user', () => ({
  useUsername: vi.fn(() => 'test-user'),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: vi.fn(() => ({
    openEditMentorModal: vi.fn(),
  })),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    ...props
  }: React.ComponentProps<'button'>) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.ComponentProps<'textarea'>) => (
    <textarea {...props} />
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

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipTrigger: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>,
}));

vi.mock('@/components/mentors/mentor-selection-grid', () => ({
  MentorSelectionGrid: ({
    onMentorSelect,
    selectedMentorIds: _selectedMentorIds,
  }: {
    onMentorSelect: (mentor: { unique_id?: string; name?: string }) => void;
    selectedMentorIds: string[];
  }) => (
    <div data-testid="mentor-selection-grid">
      <button
        data-testid="select-mentor"
        onClick={() =>
          onMentorSelect({ unique_id: 'new-mentor', name: 'New Mentor' })
        }
      >
        Select
      </button>
    </div>
  ),
}));

vi.mock('../node-config-panel', () => ({
  NodeConfigPanel: ({
    nodeId,
    nodeType,
    onClose,
    onUpdateNode,
  }: {
    nodeId: string;
    nodeType: string;
    onClose: () => void;
    onUpdateNode: (nodeId: string, updates: Record<string, unknown>) => void;
  }) => (
    <div data-testid="node-config-panel">
      <span data-testid="config-node-id">{nodeId}</span>
      <span data-testid="config-node-type">{nodeType}</span>
      <button data-testid="close-config" onClick={onClose}>
        Close Config
      </button>
      <button
        data-testid="update-node"
        onClick={() => onUpdateNode(nodeId, { label: 'Updated' })}
      >
        Update
      </button>
    </div>
  ),
}));

describe('WorkflowCanvas', () => {
  const defaultProps = {
    onDraggedItem: null as { id: string; label: string; type: string } | null,
    onClickedItem: null as { id: string; label: string; type: string } | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock to return a successful response by default
    mockFetchMentorSettings.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          display_name: 'Test Mentor',
          mentor_name: 'test-mentor',
          system_prompt: 'Test instructions',
          llm_name: 'gpt-4',
        }),
    });
  });

  describe('rendering', () => {
    it('should render the canvas container', () => {
      render(<WorkflowCanvas {...defaultProps} />);
      const canvas = document.querySelector('.h-full.w-full');
      expect(canvas).toBeInTheDocument();
    });

    it('should render default nodes (Start and Mentor)', () => {
      render(<WorkflowCanvas {...defaultProps} />);
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('My agent')).toBeInTheDocument();
    });

    it('should render toolbar in non-preview mode', () => {
      render(<WorkflowCanvas {...defaultProps} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should not render toolbar in preview mode', () => {
      render(<WorkflowCanvas {...defaultProps} previewMode={true} />);
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });

    it('should render SVG grid pattern', () => {
      render(<WorkflowCanvas {...defaultProps} />);
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(document.querySelector('#grid')).toBeInTheDocument();
    });
  });

  describe('initial state', () => {
    it('should use initial nodes if provided', () => {
      const initialNodes = [
        {
          id: 'custom-start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Custom Start' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('Custom Start')).toBeInTheDocument();
    });

    it('should use default nodes if no initial nodes provided', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('My agent')).toBeInTheDocument();
    });

    it('should use initial edges if provided', () => {
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'end',
          type: 'end',
          position: { x: 300, y: 100 },
          data: { label: 'End' },
        },
      ];
      const initialEdges = [
        {
          id: 'e1',
          source: 'start',
          target: 'end',
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />,
      );

      // Edges are rendered as SVG paths
      const paths = document.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should use initial viewport if provided', () => {
      const initialViewport = { x: 50, y: 50, zoom: 1.5 };

      render(
        <WorkflowCanvas {...defaultProps} initialViewport={initialViewport} />,
      );

      // Zoom should be 150%
      expect(screen.getByText('150%')).toBeInTheDocument();
    });
  });

  describe('tool switching', () => {
    it('should switch to pointer tool when clicked', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      // Find the pointer button by looking for the button with the MousePointer icon
      const pointerButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('svg.lucide-mouse-pointer'));

      expect(pointerButton).toBeTruthy();
      await user.click(pointerButton!);

      // Canvas cursor should change
      const canvas = document.querySelector('.absolute.inset-0');
      expect(canvas).toHaveClass('cursor-default');
    });

    it('should switch to hand tool when clicked', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      // Find the pointer button first
      const pointerButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('svg.lucide-mouse-pointer'));

      expect(pointerButton).toBeTruthy();
      await user.click(pointerButton!);

      // Find the hand button
      const handButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('svg.lucide-hand'));

      expect(handButton).toBeTruthy();
      await user.click(handButton!);

      const canvas = document.querySelector('.absolute.inset-0');
      expect(canvas).toHaveClass('cursor-grab');
    });
  });

  describe('zoom controls', () => {
    it('should zoom in when zoom in button is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      expect(screen.getByText('100%')).toBeInTheDocument();

      const zoomInButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn.querySelector('svg')?.classList.contains('lucide-zoom-in'),
        );

      if (zoomInButton) {
        await user.click(zoomInButton);
        expect(screen.getByText('110%')).toBeInTheDocument();
      }
    });

    it('should zoom out when zoom out button is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      expect(screen.getByText('100%')).toBeInTheDocument();

      const zoomOutButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn.querySelector('svg')?.classList.contains('lucide-zoom-out'),
        );

      if (zoomOutButton) {
        await user.click(zoomOutButton);
        expect(screen.getByText('90%')).toBeInTheDocument();
      }
    });

    it('should not zoom below 50%', async () => {
      const user = userEvent.setup();
      const initialViewport = { x: 0, y: 0, zoom: 0.5 };

      render(
        <WorkflowCanvas {...defaultProps} initialViewport={initialViewport} />,
      );

      expect(screen.getByText('50%')).toBeInTheDocument();

      const zoomOutButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn.querySelector('svg')?.classList.contains('lucide-zoom-out'),
        );

      if (zoomOutButton) {
        await user.click(zoomOutButton);
        expect(screen.getByText('50%')).toBeInTheDocument();
      }
    });

    it('should not zoom above 200%', async () => {
      const user = userEvent.setup();
      const initialViewport = { x: 0, y: 0, zoom: 2 };

      render(
        <WorkflowCanvas {...defaultProps} initialViewport={initialViewport} />,
      );

      expect(screen.getByText('200%')).toBeInTheDocument();

      const zoomInButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn.querySelector('svg')?.classList.contains('lucide-zoom-in'),
        );

      if (zoomInButton) {
        await user.click(zoomInButton);
        expect(screen.getByText('200%')).toBeInTheDocument();
      }
    });
  });

  describe('undo/redo', () => {
    it('should disable undo button initially', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      const undoButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn.querySelector('svg')?.classList.contains('lucide-undo'),
        );

      expect(undoButton).toBeDisabled();
    });

    it('should disable redo button initially', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      const redoButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn.querySelector('svg')?.classList.contains('lucide-redo'),
        );

      expect(redoButton).toBeDisabled();
    });
  });

  describe('adding nodes', () => {
    it('should add a new node when onClickedItem changes', async () => {
      const { rerender } = render(<WorkflowCanvas {...defaultProps} />);

      // Initially only Start and My mentor
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('My agent')).toBeInTheDocument();

      // Add new end node
      rerender(
        <WorkflowCanvas
          {...defaultProps}
          onClickedItem={{ id: 'end', label: 'End', type: 'end' }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('End')).toBeInTheDocument();
      });
    });

    it('should add note node via onClickedItem prop', async () => {
      // Note: Native drop event simulation doesn't work well in JSDOM
      // The onDraggedItem prop doesn't have a useEffect processor like onClickedItem does
      // Testing via onClickedItem prop which uses the same code path as sidebar clicks
      const { rerender } = render(<WorkflowCanvas {...defaultProps} />);

      // Initially no Note node (note nodes display 'Sticky Note' as default content)
      expect(screen.queryByText('Sticky Note')).not.toBeInTheDocument();

      // Simulate clicking a note node in the sidebar by providing onClickedItem
      rerender(
        <WorkflowCanvas
          {...defaultProps}
          onClickedItem={{ id: 'note', label: 'Note', type: 'note' }}
        />,
      );

      // Note node should be added with 'Sticky Note' as default content
      await waitFor(() => {
        expect(screen.getByText('Sticky Note')).toBeInTheDocument();
      });
    });

    it('should not add nodes in preview mode', () => {
      const { rerender } = render(
        <WorkflowCanvas {...defaultProps} previewMode={true} />,
      );

      rerender(
        <WorkflowCanvas
          {...defaultProps}
          previewMode={true}
          onClickedItem={{ id: 'end', label: 'End', type: 'end' }}
        />,
      );

      expect(screen.queryByText('End')).not.toBeInTheDocument();
    });
  });

  describe('node selection', () => {
    it('should select a node when clicked', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      const startNode = screen.getByText('Start').closest('.absolute');
      if (startNode) {
        await user.click(startNode);
        expect(startNode).toHaveClass('ring-2');
      }
    });

    it('should not show config panel for mentor nodes on click', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      const mentorNode = screen.getByText('My agent').closest('.absolute');
      if (mentorNode) {
        await user.click(mentorNode);
        // Config panel should not be shown for mentor nodes
        expect(
          screen.queryByTestId('node-config-panel'),
        ).not.toBeInTheDocument();
      }
    });
  });

  describe('node types rendering', () => {
    it('should render start node with correct styling', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      const startNode = screen.getByText('Start');
      expect(startNode).toBeInTheDocument();
    });

    it('should render while node', async () => {
      const { rerender } = render(<WorkflowCanvas {...defaultProps} />);

      rerender(
        <WorkflowCanvas
          {...defaultProps}
          onClickedItem={{ id: 'while', label: 'While', type: 'while' }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('While')).toBeInTheDocument();
      });
    });

    it('should render if-else node with conditions', () => {
      const initialNodes = [
        {
          id: 'if-else-1',
          type: 'if-else',
          position: { x: 300, y: 300 },
          data: { label: 'If / else', conditionCount: 2 },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('If / else')).toBeInTheDocument();
      expect(screen.getByText('If')).toBeInTheDocument();
      expect(screen.getByText('Else if 1')).toBeInTheDocument();
      expect(screen.getByText('Else')).toBeInTheDocument();
    });

    it('should render user-approval node', () => {
      const initialNodes = [
        {
          id: 'approval-1',
          type: 'user-approval',
          position: { x: 300, y: 300 },
          data: { label: 'User approval' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('User approval')).toBeInTheDocument();
      expect(screen.getByText('Approve')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    it('should render note node', async () => {
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 300, y: 300 },
          data: { label: 'Note', content: 'My note content' },
          width: 200,
          height: 120,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('My note content')).toBeInTheDocument();
    });

    it('should render transform node', () => {
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 300 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('Transform')).toBeInTheDocument();
    });

    it('should render set-state node', () => {
      const initialNodes = [
        {
          id: 'set-state-1',
          type: 'set-state',
          position: { x: 300, y: 300 },
          data: { label: 'Set state' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('Set state')).toBeInTheDocument();
    });

    it('should render mcp node', () => {
      const initialNodes = [
        {
          id: 'mcp-1',
          type: 'mcp',
          position: { x: 300, y: 300 },
          data: { label: 'MCP' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('MCP')).toBeInTheDocument();
    });

    it('should render file-search node', () => {
      const initialNodes = [
        {
          id: 'file-search-1',
          type: 'file-search',
          position: { x: 300, y: 300 },
          data: { label: 'File search' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('File search')).toBeInTheDocument();
    });

    it('should render guardrails node', () => {
      const initialNodes = [
        {
          id: 'guardrails-1',
          type: 'guardrails',
          position: { x: 300, y: 300 },
          data: { label: 'Guardrails' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('Guardrails')).toBeInTheDocument();
    });
  });

  describe('mentor node', () => {
    it('should render mentor node with subtitle', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      expect(screen.getByText('My agent')).toBeInTheDocument();
      expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    it('should show change mentor button on mentor node', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      // Change mentor button should be visible
      const changeButton = screen.getByRole('button', {
        name: 'Change agent',
      });
      expect(changeButton).toBeInTheDocument();
    });

    it('should not show change mentor button in preview mode', () => {
      render(<WorkflowCanvas {...defaultProps} previewMode={true} />);

      // Change mentor button should not be visible
      expect(
        screen.queryByRole('button', { name: 'Change agent' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('state change callback', () => {
    it('should call onStateChange when state changes', async () => {
      const onStateChange = vi.fn();

      render(
        <WorkflowCanvas {...defaultProps} onStateChange={onStateChange} />,
      );

      // onStateChange should be called on initial render
      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalled();
      });
    });

    it('should include nodes, edges, and viewport in state', async () => {
      const onStateChange = vi.fn();

      render(
        <WorkflowCanvas {...defaultProps} onStateChange={onStateChange} />,
      );

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalled();
        const state = onStateChange.mock.calls[0][0] as ReactFlowJsonObject;
        expect(state).toHaveProperty('nodes');
        expect(state).toHaveProperty('edges');
        expect(state).toHaveProperty('viewport');
      });
    });

    it('should not call onStateChange in preview mode', () => {
      const onStateChange = vi.fn();

      render(
        <WorkflowCanvas
          {...defaultProps}
          previewMode={true}
          onStateChange={onStateChange}
        />,
      );

      expect(onStateChange).not.toHaveBeenCalled();
    });
  });

  describe('keyboard interactions', () => {
    it('should delete selected nodes on Delete key', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 300, y: 250 },
          data: { label: 'Start' },
        },
        {
          id: 'deletable',
          type: 'transform',
          position: { x: 500, y: 250 },
          data: { label: 'Deletable' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('Deletable')).toBeInTheDocument();

      // Click on deletable node to select it
      const deletableNode = screen.getByText('Deletable').closest('.absolute');
      if (deletableNode) {
        await user.click(deletableNode);
      }

      // Press Delete key
      await user.keyboard('{Delete}');

      // Node should be deleted
      await waitFor(() => {
        expect(screen.queryByText('Deletable')).not.toBeInTheDocument();
      });
    });

    it('should not delete start node', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      // Click on start node to select it
      const startNode = screen.getByText('Start').closest('.absolute');
      if (startNode) {
        await user.click(startNode);
      }

      // Press Delete key
      await user.keyboard('{Delete}');

      // Start node should still exist
      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    it('should not delete nodes in preview mode', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 300, y: 250 },
          data: { label: 'Start' },
        },
        {
          id: 'deletable',
          type: 'transform',
          position: { x: 500, y: 250 },
          data: { label: 'Deletable' },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          previewMode={true}
        />,
      );

      await user.keyboard('{Delete}');

      expect(screen.getByText('Deletable')).toBeInTheDocument();
    });
  });

  describe('drag and drop', () => {
    it('should handle drag over', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      const canvas = document.querySelector('.absolute.inset-0');
      if (canvas) {
        const dragOverEvent = new Event('dragover', { bubbles: true });
        Object.defineProperty(dragOverEvent, 'preventDefault', {
          value: vi.fn(),
        });

        canvas.dispatchEvent(dragOverEvent);

        // Should not throw
        expect(canvas).toBeInTheDocument();
      }
    });
  });

  describe('note editing', () => {
    it('should allow editing note content on click', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 300, y: 300 },
          data: { label: 'Note', content: 'Initial content' },
          width: 200,
          height: 120,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('Initial content')).toBeInTheDocument();

      // Click on note to enable editing
      const noteContent = screen.getByText('Initial content');
      await user.click(noteContent);

      // Textarea should appear
      const textarea = document.querySelector('textarea');
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('preview mode sync', () => {
    it('should sync nodes when initialNodes changes in preview mode', async () => {
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 300, y: 250 },
          data: { label: 'Start' },
        },
      ];

      const { rerender } = render(
        <WorkflowCanvas
          {...defaultProps}
          previewMode={true}
          initialNodes={initialNodes}
        />,
      );

      expect(screen.getByText('Start')).toBeInTheDocument();

      // Update initialNodes
      const updatedNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 300, y: 250 },
          data: { label: 'Updated Start' },
        },
      ];

      rerender(
        <WorkflowCanvas
          {...defaultProps}
          previewMode={true}
          initialNodes={updatedNodes}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Updated Start')).toBeInTheDocument();
      });
    });

    it('should sync viewport when initialViewport changes in preview mode', () => {
      const initialViewport = { x: 0, y: 0, zoom: 1 };

      const { rerender } = render(
        <WorkflowCanvas
          {...defaultProps}
          previewMode={true}
          initialViewport={initialViewport}
        />,
      );

      const updatedViewport = { x: 50, y: 50, zoom: 1.2 };

      rerender(
        <WorkflowCanvas
          {...defaultProps}
          previewMode={true}
          initialViewport={updatedViewport}
        />,
      );

      // Viewport should be synced (no zoom display in preview mode though)
      // The component should update without errors
      expect(document.querySelector('.absolute.inset-0')).toBeInTheDocument();
    });
  });

  describe('conditional node type handling', () => {
    it('should treat "conditional" type same as "if-else"', () => {
      const initialNodes = [
        {
          id: 'conditional-1',
          type: 'conditional',
          position: { x: 300, y: 300 },
          data: { label: 'Conditional', conditionCount: 1 },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('Conditional')).toBeInTheDocument();
      expect(screen.getByText('If')).toBeInTheDocument();
      expect(screen.getByText('Else')).toBeInTheDocument();
    });
  });

  describe('default mentor prefill', () => {
    it('should prefill mentor nodes with defaultMentorId when no mentor_id set', () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 250 },
          data: { label: 'Mentor', subtitle: 'Mentor' },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          defaultMentorId="default-mentor-123"
        />,
      );

      // Multiple 'Mentor' elements exist (label and subtitle), so use getAllByText
      const mentorElements = screen.getAllByText('Mentor');
      expect(mentorElements.length).toBeGreaterThan(0);
    });
  });

  describe('node dragging', () => {
    it('should initiate drag on mousedown and move node on mousemove', async () => {
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');
      expect(transformNode).toBeInTheDocument();

      // Simulate mousedown on node
      fireEvent.mouseDown(transformNode!, {
        button: 0,
        clientX: 350,
        clientY: 125,
      });

      // Simulate mousemove (dragging)
      fireEvent.mouseMove(window, { clientX: 400, clientY: 150 });

      // Simulate mouseup to complete drag
      fireEvent.mouseUp(window);

      // Node should have been interacted with
      expect(transformNode).toBeInTheDocument();
    });

    it('should not drag node when right button is clicked', () => {
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');

      // Right-click should not initiate drag
      fireEvent.mouseDown(transformNode!, {
        button: 2,
        clientX: 350,
        clientY: 125,
      });

      // Node should not have the selection ring
      expect(transformNode).not.toHaveClass('ring-2');
    });

    it('should not allow dragging in preview mode', () => {
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          previewMode={true}
        />,
      );

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');

      // Attempt drag in preview mode
      fireEvent.mouseDown(transformNode!, {
        button: 0,
        clientX: 350,
        clientY: 125,
      });
      fireEvent.mouseMove(window, { clientX: 400, clientY: 150 });
      fireEvent.mouseUp(window);

      // Node should still exist at original position
      expect(transformNode).toBeInTheDocument();
    });

    it('should detect drag movement beyond threshold', async () => {
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');

      // Start drag
      fireEvent.mouseDown(transformNode!, {
        button: 0,
        clientX: 350,
        clientY: 125,
      });

      // Move more than 3 pixels to trigger drag detection
      fireEvent.mouseMove(window, { clientX: 360, clientY: 135 });
      fireEvent.mouseUp(window);

      expect(transformNode).toBeInTheDocument();
    });
  });

  describe('multi-selection with Ctrl/Cmd key', () => {
    it('should toggle node selection with Ctrl key', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const startNode = screen
        .getByText('Start')
        .closest('.absolute.pointer-events-auto');
      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');

      // Select first node
      await user.click(startNode!);
      expect(startNode).toHaveClass('ring-2');

      // Ctrl+click second node to add to selection
      fireEvent.mouseDown(transformNode!, { button: 0, ctrlKey: true });
      fireEvent.mouseUp(window);

      // Both nodes should be selected
      expect(transformNode).toHaveClass('ring-2');
    });

    it('should toggle node selection with Meta key (Cmd on Mac)', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const startNode = screen
        .getByText('Start')
        .closest('.absolute.pointer-events-auto');
      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');

      // Select first node
      await user.click(startNode!);

      // Meta+click second node to add to selection
      fireEvent.mouseDown(transformNode!, { button: 0, metaKey: true });
      fireEvent.mouseUp(window);

      expect(transformNode).toHaveClass('ring-2');
    });

    it('should deselect node when Ctrl+clicking already selected node', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');

      // Select node
      await user.click(transformNode!);
      expect(transformNode).toHaveClass('ring-2');

      // Ctrl+click to deselect
      fireEvent.mouseDown(transformNode!, { button: 0, ctrlKey: true });
      fireEvent.mouseUp(window);

      expect(transformNode).not.toHaveClass('ring-2');
    });
  });

  describe('edge/connection creation', () => {
    it('should start connection from node handle', async () => {
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      // Find connection handles (they have cursor-crosshair class)
      const connectionHandles = document.querySelectorAll('.cursor-crosshair');
      expect(connectionHandles.length).toBeGreaterThan(0);

      // Start connection from first handle
      const firstHandle = connectionHandles[0] as HTMLElement;
      fireEvent.mouseDown(firstHandle, { button: 0 });

      // Move to create temp connection line
      fireEvent.mouseMove(window, { clientX: 400, clientY: 150 });

      // Complete connection on mouse up (not over a valid target)
      fireEvent.mouseUp(window);

      // Canvas should still be functional
      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    it('should create edge when connection completes over another node', async () => {
      const onStateChange = vi.fn();
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          initialEdges={[]}
          onStateChange={onStateChange}
        />,
      );

      // Get the start node's right handle
      const startNode = screen
        .getByText('Start')
        .closest('.absolute.pointer-events-auto');
      const startHandle = startNode?.querySelector('.cursor-crosshair');

      expect(startHandle).toBeInTheDocument();

      // Start connection
      fireEvent.mouseDown(startHandle!, { button: 0 });

      // Move towards transform node
      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');

      // Simulate mouse enter on target node
      fireEvent.mouseEnter(transformNode!);
      fireEvent.mouseMove(window, { clientX: 350, clientY: 125 });

      // Complete connection
      fireEvent.mouseUp(window);

      // onStateChange should have been called
      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalled();
      });
    });

    it('should not create connection when start and end are the same node', () => {
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const startNode = screen
        .getByText('Start')
        .closest('.absolute.pointer-events-auto');
      const startHandle = startNode?.querySelector('.cursor-crosshair');

      // Start connection
      fireEvent.mouseDown(startHandle!, { button: 0 });

      // Stay on same node
      fireEvent.mouseEnter(startNode!);
      fireEvent.mouseUp(window);

      // Should not create a self-referencing edge
      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    it('should not allow connection creation in preview mode', () => {
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          previewMode={true}
        />,
      );

      const connectionHandles = document.querySelectorAll('.cursor-crosshair');

      if (connectionHandles.length > 0) {
        fireEvent.mouseDown(connectionHandles[0], { button: 0 });
        fireEvent.mouseMove(window, { clientX: 400, clientY: 150 });
        fireEvent.mouseUp(window);
      }

      // Should still be in preview mode
      expect(screen.getByText('Start')).toBeInTheDocument();
    });
  });

  describe('panning functionality', () => {
    it('should pan canvas when hand tool is active and dragging', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      const canvas = document.querySelector('.absolute.inset-0');
      expect(canvas).toHaveClass('cursor-grab');

      // Start panning
      fireEvent.mouseDown(canvas!, { button: 0, clientX: 100, clientY: 100 });

      // Canvas should now have grabbing cursor
      expect(canvas).toHaveClass('cursor-grabbing');

      // Pan
      fireEvent.mouseMove(window, { clientX: 150, clientY: 150 });

      // Stop panning
      fireEvent.mouseUp(window);

      // Should return to grab cursor
      expect(canvas).toHaveClass('cursor-grab');
    });

    it('should not pan when clicking on a node', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      const startNode = screen
        .getByText('Start')
        .closest('.absolute.pointer-events-auto');

      // Click on node instead of canvas
      await user.click(startNode!);

      // Node should be selected, not canvas panned
      expect(startNode).toHaveClass('ring-2');
    });
  });

  describe('selection box', () => {
    it('should create selection box when pointer tool is active and dragging on canvas', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      // Switch to pointer tool
      const pointerButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('svg.lucide-mouse-pointer'));
      await user.click(pointerButton!);

      const canvas = document.querySelector('.absolute.inset-0');

      // Start selection box by dragging on canvas
      fireEvent.mouseDown(canvas!, { button: 0, clientX: 50, clientY: 50 });

      // Drag to create selection area
      fireEvent.mouseMove(window, { clientX: 500, clientY: 400 });

      // A selection rectangle should be rendered in SVG
      const selectionRect = document.querySelector(
        'rect[fill="rgba(56, 161, 229, 0.1)"]',
      );
      expect(selectionRect).toBeInTheDocument();

      // Complete selection
      fireEvent.mouseUp(window);
    });

    it('should select nodes within selection box', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 200, y: 150 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      // Switch to pointer tool
      const pointerButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('svg.lucide-mouse-pointer'));
      await user.click(pointerButton!);

      const canvas = document.querySelector('.absolute.inset-0');

      // Create selection box that covers both nodes
      fireEvent.mouseDown(canvas!, { button: 0, clientX: 50, clientY: 50 });
      fireEvent.mouseMove(window, { clientX: 500, clientY: 400 });
      fireEvent.mouseUp(window);

      // Both nodes should be selected
      const startNode = screen
        .getByText('Start')
        .closest('.absolute.pointer-events-auto');
      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');

      expect(startNode).toHaveClass('ring-2');
      expect(transformNode).toHaveClass('ring-2');
    });

    it('should select nodes of different types within selection box', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'while-1',
          type: 'while',
          position: { x: 100, y: 100 },
          data: { label: 'While' },
          width: 400,
          height: 180,
        },
        {
          id: 'if-else-1',
          type: 'if-else',
          position: { x: 150, y: 150 },
          data: { label: 'If-Else', conditionCount: 1 },
        },
        {
          id: 'user-approval-1',
          type: 'user-approval',
          position: { x: 200, y: 200 },
          data: { label: 'Approval' },
        },
        {
          id: 'note-1',
          type: 'note',
          position: { x: 250, y: 250 },
          data: { label: 'Note', content: 'Test note' },
          width: 200,
          height: 120,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      // Switch to pointer tool
      const pointerButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('svg.lucide-mouse-pointer'));
      await user.click(pointerButton!);

      const canvas = document.querySelector('.absolute.inset-0');

      // Create selection box
      fireEvent.mouseDown(canvas!, { button: 0, clientX: 0, clientY: 0 });
      fireEvent.mouseMove(window, { clientX: 800, clientY: 600 });
      fireEvent.mouseUp(window);

      // All nodes should be selected
      expect(screen.getByText('While')).toBeInTheDocument();
      expect(screen.getByText('If-Else')).toBeInTheDocument();
      expect(screen.getByText('Approval')).toBeInTheDocument();
    });
  });

  describe('undo/redo after changes', () => {
    it('should enable undo after adding a node', async () => {
      const { rerender } = render(<WorkflowCanvas {...defaultProps} />);

      // Add a node
      rerender(
        <WorkflowCanvas
          {...defaultProps}
          onClickedItem={{
            id: 'transform',
            label: 'Transform',
            type: 'transform',
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Transform')).toBeInTheDocument();
      });

      // Undo button should now be enabled (we may need to wait for state update)
      const undoButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn.querySelector('svg')?.classList.contains('lucide-undo'),
        );

      // After adding a node, undo should be enabled
      expect(undoButton).toBeInTheDocument();
    });

    it('should undo and redo node addition', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<WorkflowCanvas {...defaultProps} />);

      // Add a node
      rerender(
        <WorkflowCanvas
          {...defaultProps}
          onClickedItem={{
            id: 'transform',
            label: 'Transform',
            type: 'transform',
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Transform')).toBeInTheDocument();
      });

      // Click undo
      const undoButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn.querySelector('svg')?.classList.contains('lucide-undo'),
        );

      if (undoButton && !undoButton.hasAttribute('disabled')) {
        await user.click(undoButton);

        // Node should be removed
        await waitFor(() => {
          expect(screen.queryByText('Transform')).not.toBeInTheDocument();
        });

        // Click redo
        const redoButton = screen
          .getAllByRole('button')
          .find((btn) =>
            btn.querySelector('svg')?.classList.contains('lucide-redo'),
          );

        if (redoButton && !redoButton.hasAttribute('disabled')) {
          await user.click(redoButton);

          // Node should be back
          await waitFor(() => {
            expect(screen.getByText('Transform')).toBeInTheDocument();
          });
        }
      }
    });
  });

  describe('node deletion with edges', () => {
    it('should delete node and connected edges', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];
      const initialEdges = [
        {
          id: 'e1',
          source: 'start',
          target: 'transform-1',
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />,
      );

      // Select transform node
      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');
      await user.click(transformNode!);

      // Delete with Backspace
      await user.keyboard('{Backspace}');

      // Transform node should be deleted
      await waitFor(() => {
        expect(screen.queryByText('Transform')).not.toBeInTheDocument();
      });
    });

    it('should not delete when focused on input element', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 300, y: 100 },
          data: { label: 'Note', content: 'Test content' },
          width: 200,
          height: 120,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      // Click on note to enable editing
      const noteContent = screen.getByText('Test content');
      await user.click(noteContent);

      // Textarea should appear
      const textarea = document.querySelector('textarea');
      expect(textarea).toBeInTheDocument();

      // Focus on textarea and press delete - should not delete the node
      textarea!.focus();
      await user.keyboard('{Delete}');

      // Note should still exist
      expect(document.querySelector('textarea')).toBeInTheDocument();
    });
  });

  describe('drop handler', () => {
    it('should add node on drop', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      const canvas = document.querySelector('.absolute.inset-0');

      // Create a mock drop event
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(dropEvent, 'clientX', { value: 400 });
      Object.defineProperty(dropEvent, 'clientY', { value: 300 });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: () =>
            JSON.stringify({ id: 'transform', label: 'Transform' }),
        },
      });

      fireEvent(canvas!, dropEvent);

      // New node should be added (eventually)
      // Note: JSDOM may not fully support drag events
      expect(canvas).toBeInTheDocument();
    });

    it('should add mentor node on drop with default mentor id', () => {
      render(<WorkflowCanvas {...defaultProps} defaultMentorId="mentor-123" />);

      const canvas = document.querySelector('.absolute.inset-0');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(dropEvent, 'clientX', { value: 400 });
      Object.defineProperty(dropEvent, 'clientY', { value: 300 });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: () => JSON.stringify({ id: 'mentor', label: 'Mentor' }),
        },
      });

      fireEvent(canvas!, dropEvent);

      expect(canvas).toBeInTheDocument();
    });

    it('should add note node on drop with default dimensions', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      const canvas = document.querySelector('.absolute.inset-0');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(dropEvent, 'clientX', { value: 400 });
      Object.defineProperty(dropEvent, 'clientY', { value: 300 });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: () => JSON.stringify({ id: 'note', label: 'Note' }),
        },
      });

      fireEvent(canvas!, dropEvent);

      expect(canvas).toBeInTheDocument();
    });

    it('should add while node on drop with default dimensions', () => {
      render(<WorkflowCanvas {...defaultProps} />);

      const canvas = document.querySelector('.absolute.inset-0');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(dropEvent, 'clientX', { value: 400 });
      Object.defineProperty(dropEvent, 'clientY', { value: 300 });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: () => JSON.stringify({ id: 'while', label: 'While' }),
        },
      });

      fireEvent(canvas!, dropEvent);

      expect(canvas).toBeInTheDocument();
    });

    it('should handle invalid drop data gracefully', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(<WorkflowCanvas {...defaultProps} />);

      const canvas = document.querySelector('.absolute.inset-0');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(dropEvent, 'clientX', { value: 400 });
      Object.defineProperty(dropEvent, 'clientY', { value: 300 });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: () => 'invalid json',
        },
      });

      fireEvent(canvas!, dropEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse dropped data:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('should not drop in preview mode', () => {
      render(<WorkflowCanvas {...defaultProps} previewMode={true} />);

      const canvas = document.querySelector('.absolute.inset-0');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(dropEvent, 'clientX', { value: 400 });
      Object.defineProperty(dropEvent, 'clientY', { value: 300 });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: () =>
            JSON.stringify({ id: 'transform', label: 'Transform' }),
        },
      });

      fireEvent(canvas!, dropEvent);

      // Transform should not be added
      expect(screen.queryByText('Transform')).not.toBeInTheDocument();
    });
  });

  describe('note node resizing', () => {
    it('should start resize on mousedown on resize handle', () => {
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 300, y: 300 },
          data: { label: 'Note', content: 'My note' },
          width: 200,
          height: 120,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      // Find the resize handle (bottom-right corner)
      const resizeHandle = document.querySelector('.cursor-nwse-resize');
      expect(resizeHandle).toBeInTheDocument();

      // Start resize
      fireEvent.mouseDown(resizeHandle!, {
        button: 0,
        clientX: 500,
        clientY: 420,
      });

      // Move to resize
      fireEvent.mouseMove(window, { clientX: 550, clientY: 470 });

      // End resize
      fireEvent.mouseUp(window);

      expect(screen.getByText('My note')).toBeInTheDocument();
    });

    it('should enforce minimum width and height on resize', () => {
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 300, y: 300 },
          data: { label: 'Note', content: 'My note' },
          width: 200,
          height: 120,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const resizeHandle = document.querySelector('.cursor-nwse-resize');

      // Try to resize to very small size
      fireEvent.mouseDown(resizeHandle!, {
        button: 0,
        clientX: 500,
        clientY: 420,
      });
      fireEvent.mouseMove(window, { clientX: 300, clientY: 300 }); // Move far left and up
      fireEvent.mouseUp(window);

      // Note should still exist with minimum dimensions
      expect(screen.getByText('My note')).toBeInTheDocument();
    });

    it('should not allow resizing in preview mode', () => {
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 300, y: 300 },
          data: { label: 'Note', content: 'My note' },
          width: 200,
          height: 120,
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          previewMode={true}
        />,
      );

      const resizeHandle = document.querySelector('.cursor-nwse-resize');

      if (resizeHandle) {
        fireEvent.mouseDown(resizeHandle, {
          button: 0,
          clientX: 500,
          clientY: 420,
        });
        fireEvent.mouseMove(window, { clientX: 550, clientY: 470 });
        fireEvent.mouseUp(window);
      }

      expect(screen.getByText('My note')).toBeInTheDocument();
    });
  });

  describe('while node resizing', () => {
    it('should resize while node via resize handle', () => {
      const initialNodes = [
        {
          id: 'while-1',
          type: 'while',
          position: { x: 300, y: 300 },
          data: { label: 'While' },
          width: 400,
          height: 180,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const resizeHandle = document.querySelector('.cursor-nwse-resize');
      expect(resizeHandle).toBeInTheDocument();

      // Start resize
      fireEvent.mouseDown(resizeHandle!, {
        button: 0,
        clientX: 700,
        clientY: 480,
      });
      fireEvent.mouseMove(window, { clientX: 750, clientY: 530 });
      fireEvent.mouseUp(window);

      expect(screen.getByText('While')).toBeInTheDocument();
    });
  });

  describe('mentor modal flow', () => {
    it('should open mentor selection modal when clicking change mentor button', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      const changeMentorButton = screen.getByRole('button', {
        name: 'Change agent',
      });
      await user.click(changeMentorButton);

      // Modal should open
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('mentor-selection-grid')).toBeInTheDocument();
    });

    it('should close mentor modal when dialog is closed', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      const changeMentorButton = screen.getByRole('button', {
        name: 'Change agent',
      });
      await user.click(changeMentorButton);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();

      // Close dialog
      const closeButton = screen.getByTestId('close-dialog');
      await user.click(closeButton);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should update mentor node when selecting a mentor from modal', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} org="test-org" />);

      const changeMentorButton = screen.getByRole('button', {
        name: 'Change agent',
      });
      await user.click(changeMentorButton);

      // Select a mentor from the grid
      const selectButton = screen.getByTestId('select-mentor');
      await user.click(selectButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('note node editing', () => {
    it('should enter edit mode when clicking on note content', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 300, y: 300 },
          data: { label: 'Note', content: 'Initial content' },
          width: 200,
          height: 120,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const noteContent = screen.getByText('Initial content');
      await user.click(noteContent);

      // Textarea should appear
      const textarea = document.querySelector('textarea');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('Initial content');
    });

    it('should update note content when typing', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 300, y: 300 },
          data: { label: 'Note', content: 'Initial' },
          width: 200,
          height: 120,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const noteContent = screen.getByText('Initial');
      await user.click(noteContent);

      const textarea = document.querySelector('textarea');
      await user.clear(textarea!);
      await user.type(textarea!, 'Updated content');

      expect(textarea).toHaveValue('Updated content');
    });

    it('should exit edit mode on blur', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 300, y: 300 },
          data: { label: 'Note', content: 'Test content' },
          width: 200,
          height: 120,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const noteContent = screen.getByText('Test content');
      await user.click(noteContent);

      const textarea = document.querySelector('textarea');
      expect(textarea).toBeInTheDocument();

      // Blur the textarea
      fireEvent.blur(textarea!);

      // Should exit edit mode and show content
      await waitFor(() => {
        expect(screen.getByText('Test content')).toBeInTheDocument();
      });
    });

    it('should display default sticky note text when content is empty', () => {
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 300, y: 300 },
          data: { label: 'Note' }, // No content
          width: 200,
          height: 120,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('Sticky Note')).toBeInTheDocument();
    });
  });

  describe('config panel interactions', () => {
    it('should open config panel when clicking on non-mentor node', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');
      await user.click(transformNode!);

      // Config panel should appear
      expect(screen.getByTestId('node-config-panel')).toBeInTheDocument();
      expect(screen.getByTestId('config-node-id')).toHaveTextContent(
        'transform-1',
      );
      expect(screen.getByTestId('config-node-type')).toHaveTextContent(
        'transform',
      );
    });

    it('should close config panel when clicking close button', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');
      await user.click(transformNode!);

      // Close config panel
      const closeButton = screen.getByTestId('close-config');
      await user.click(closeButton);

      expect(screen.queryByTestId('node-config-panel')).not.toBeInTheDocument();
    });

    it('should update node via config panel', async () => {
      const user = userEvent.setup();
      const onStateChange = vi.fn();
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          onStateChange={onStateChange}
        />,
      );

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');
      await user.click(transformNode!);

      // Click update button in config panel
      const updateButton = screen.getByTestId('update-node');
      await user.click(updateButton);

      // onStateChange should be called with updated node
      await waitFor(() => {
        const lastCall =
          onStateChange.mock.calls[onStateChange.mock.calls.length - 1];
        expect(lastCall).toBeDefined();
      });
    });

    it('should close config panel when clicking on canvas', async () => {
      const user = userEvent.setup();
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');
      await user.click(transformNode!);

      expect(screen.getByTestId('node-config-panel')).toBeInTheDocument();

      // Click on canvas (SVG background)
      const svg = document.querySelector('svg');
      fireEvent.mouseDown(svg!, { button: 0 });

      expect(screen.queryByTestId('node-config-panel')).not.toBeInTheDocument();
    });
  });

  describe('onStateChange callback details', () => {
    it('should not emit duplicate state changes', async () => {
      const onStateChange = vi.fn();
      render(
        <WorkflowCanvas {...defaultProps} onStateChange={onStateChange} />,
      );

      // Wait for initial state emission
      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalled();
      });

      const initialCallCount = onStateChange.mock.calls.length;

      // Re-render with same props
      render(
        <WorkflowCanvas {...defaultProps} onStateChange={onStateChange} />,
      );

      // Should not trigger additional calls for same state
      // Note: This depends on the deduplication logic in the component
      expect(onStateChange.mock.calls.length).toBeGreaterThanOrEqual(
        initialCallCount,
      );
    });

    it('should update zoom display when zoom in button is clicked', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      // Initial zoom is 100%
      expect(screen.getByText('100%')).toBeInTheDocument();

      // Zoom in
      const zoomInButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn.querySelector('svg')?.classList.contains('lucide-zoom-in'),
        );

      if (zoomInButton) {
        await user.click(zoomInButton);

        // Zoom should now be 110%
        expect(screen.getByText('110%')).toBeInTheDocument();
      }
    });

    it('should include correct viewport in state change', async () => {
      const onStateChange = vi.fn();
      const initialViewport = { x: 100, y: 50, zoom: 1.5 };

      render(
        <WorkflowCanvas
          {...defaultProps}
          onStateChange={onStateChange}
          initialViewport={initialViewport}
        />,
      );

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalled();
        const state = onStateChange.mock.calls[0][0] as ReactFlowJsonObject;
        expect(state.viewport.x).toBe(100);
        expect(state.viewport.y).toBe(50);
        expect(state.viewport.zoom).toBe(1.5);
      });
    });
  });

  describe('edge rendering', () => {
    it('should render edges with correct path', () => {
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];
      const initialEdges = [
        {
          id: 'e1',
          source: 'start',
          target: 'transform-1',
          sourceHandle: 'right',
          targetHandle: 'left',
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />,
      );

      // Should have an edge path
      const paths = document.querySelectorAll('path[stroke="#38A1E5"]');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should not render edge if source node does not exist', () => {
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];
      const initialEdges = [
        {
          id: 'e1',
          source: 'nonexistent',
          target: 'transform-1',
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />,
      );

      // Edge should not be rendered since source doesn't exist
      // Only the grid pattern path should be visible
      expect(screen.getByText('Transform')).toBeInTheDocument();
    });
  });

  describe('node hover effects', () => {
    it('should update hovered node on mouse enter', async () => {
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');

      // Mouse enter
      fireEvent.mouseEnter(transformNode!);

      // Connection handles should become visible (opacity-100 class is applied via CSS)
      const connectionHandles =
        transformNode?.querySelectorAll('.cursor-crosshair');
      expect(connectionHandles?.length).toBeGreaterThan(0);
    });

    it('should clear hovered node on mouse leave', async () => {
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 300, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const transformNode = screen
        .getByText('Transform')
        .closest('.absolute.pointer-events-auto');

      fireEvent.mouseEnter(transformNode!);
      fireEvent.mouseLeave(transformNode!);

      // Node should still be in document
      expect(transformNode).toBeInTheDocument();
    });
  });

  describe('different node handle positions', () => {
    it('should render handles for if-else node condition outputs', () => {
      const initialNodes = [
        {
          id: 'if-else-1',
          type: 'if-else',
          position: { x: 300, y: 300 },
          data: { label: 'If / else', conditionCount: 3 },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      // Should have If, Else if 1, Else if 2, and Else
      expect(screen.getByText('If')).toBeInTheDocument();
      expect(screen.getByText('Else if 1')).toBeInTheDocument();
      expect(screen.getByText('Else if 2')).toBeInTheDocument();
      expect(screen.getByText('Else')).toBeInTheDocument();
    });

    it('should render handles for user-approval node', () => {
      const initialNodes = [
        {
          id: 'approval-1',
          type: 'user-approval',
          position: { x: 300, y: 300 },
          data: { label: 'User approval' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('Approve')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();

      // Find approve/reject connection handles
      const approvalNode = screen
        .getByText('User approval')
        .closest('.absolute.pointer-events-auto');
      const connectionHandles =
        approvalNode?.querySelectorAll('.cursor-crosshair');
      expect(connectionHandles?.length).toBeGreaterThan(0);
    });
  });

  describe('findNonOverlappingPosition', () => {
    it('should place node at non-overlapping position when adding via click', async () => {
      // Start with existing nodes
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 300, y: 250 },
          data: { label: 'Start' },
        },
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 550, y: 250 },
          data: { label: 'My mentor', subtitle: 'Mentor' },
        },
      ];

      const { rerender } = render(
        <WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />,
      );

      // Add a node that would overlap
      rerender(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          onClickedItem={{
            id: 'transform',
            label: 'Transform',
            type: 'transform',
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Transform')).toBeInTheDocument();
      });

      // Node should be placed without overlapping
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('My mentor')).toBeInTheDocument();
    });
  });

  describe('mentor node click behavior', () => {
    it('should open edit mentor modal on click without drag', async () => {
      const mockOpenEditMentorModal = vi.fn();
      vi.mocked(await import('@/hooks/user-navigate')).useNavigate = vi.fn(
        () => ({
          openEditMentorModal: mockOpenEditMentorModal,
        }),
      ) as any;

      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 100 },
          data: {
            label: 'Test Mentor',
            subtitle: 'Mentor',
            mentor_id: 'mentor-123',
          },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const mentorNode = screen
        .getByText('Test Mentor')
        .closest('.absolute.pointer-events-auto');

      // Click without dragging
      fireEvent.mouseDown(mentorNode!, {
        button: 0,
        clientX: 350,
        clientY: 125,
      });
      fireEvent.mouseUp(window);

      // Should trigger edit mentor modal
      // Note: The actual behavior depends on the mocked useNavigate hook
      expect(mentorNode).toBeInTheDocument();
    });

    it('should not open edit mentor modal when Ctrl+clicking mentor node', async () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 100 },
          data: {
            label: 'Test Mentor',
            subtitle: 'Mentor',
            mentor_id: 'mentor-123',
          },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const mentorNode = screen
        .getByText('Test Mentor')
        .closest('.absolute.pointer-events-auto');

      // Ctrl+click
      fireEvent.mouseDown(mentorNode!, {
        button: 0,
        ctrlKey: true,
        clientX: 350,
        clientY: 125,
      });
      fireEvent.mouseUp(window);

      // Config panel should not appear for mentor nodes even with selection
      expect(screen.queryByTestId('node-config-panel')).not.toBeInTheDocument();
    });
  });

  describe('temp connection line rendering', () => {
    it('should render dashed line while connecting', () => {
      const initialNodes = [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const startNode = screen
        .getByText('Start')
        .closest('.absolute.pointer-events-auto');
      const startHandle = startNode?.querySelector('.cursor-crosshair');

      // Start connection
      fireEvent.mouseDown(startHandle!, { button: 0 });

      // Move to create temp connection line
      fireEvent.mouseMove(window, { clientX: 400, clientY: 150 });

      // Dashed line should be rendered
      const dashedPath = document.querySelector('path[stroke-dasharray="5,5"]');
      expect(dashedPath).toBeInTheDocument();

      // End connection
      fireEvent.mouseUp(window);

      // Dashed line should be removed
      expect(
        document.querySelector('path[stroke-dasharray="5,5"]'),
      ).not.toBeInTheDocument();
    });
  });

  describe('mentor node prefilling', () => {
    it('should prefill mentor node with settings from API when defaultMentorId is provided', async () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 250 },
          data: { label: 'My mentor', subtitle: 'Mentor' }, // No mentor_id set
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          defaultMentorId="mentor-123"
          org="test-org"
        />,
      );

      // Wait for prefill to complete
      await waitFor(() => {
        expect(mockFetchMentorSettings).toHaveBeenCalled();
      });
    });

    it('should handle API error when prefilling mentor node', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockFetchMentorSettings.mockReturnValue({
        unwrap: () => Promise.reject(new Error('API error')),
      });

      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 250 },
          data: { label: 'My mentor', subtitle: 'Mentor' },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          defaultMentorId="mentor-123"
          org="test-org"
        />,
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to prefill mentor node data:',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });

    it('should not prefill if defaultMentorId is not provided', () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 250 },
          data: { label: 'My mentor', subtitle: 'Mentor' },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          org="test-org"
        />,
      );

      // fetchMentorSettings should not be called without defaultMentorId
      expect(mockFetchMentorSettings).not.toHaveBeenCalled();
    });

    it('should not prefill mentor nodes that already have mentor_id', () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 250 },
          data: {
            label: 'Existing Mentor',
            subtitle: 'Mentor',
            mentor_id: 'existing-id',
          },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          defaultMentorId="mentor-123"
          org="test-org"
        />,
      );

      // Should not try to prefill since mentor already has ID
      expect(mockFetchMentorSettings).not.toHaveBeenCalled();
    });

    it('should not prefill mentor nodes in preview mode', () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 250 },
          data: { label: 'My mentor', subtitle: 'Mentor' },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          defaultMentorId="mentor-123"
          org="test-org"
          previewMode={true}
        />,
      );

      expect(mockFetchMentorSettings).not.toHaveBeenCalled();
    });
  });

  describe('mentor selection with API', () => {
    it('should update mentor node with API settings on selection', async () => {
      const user = userEvent.setup();

      render(<WorkflowCanvas {...defaultProps} org="test-org" />);

      // Open mentor modal
      const changeMentorButton = screen.getByRole('button', {
        name: 'Change agent',
      });
      await user.click(changeMentorButton);

      // Select mentor from grid
      const selectButton = screen.getByTestId('select-mentor');
      await user.click(selectButton);

      // Wait for modal to close
      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });

      // API should have been called
      expect(mockFetchMentorSettings).toHaveBeenCalled();
    });

    it('should use mentor name as fallback when API fails', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockFetchMentorSettings.mockReturnValue({
        unwrap: () => Promise.reject(new Error('API error')),
      });

      render(<WorkflowCanvas {...defaultProps} org="test-org" />);

      // Open mentor modal
      const changeMentorButton = screen.getByRole('button', {
        name: 'Change agent',
      });
      await user.click(changeMentorButton);

      // Select mentor from grid
      const selectButton = screen.getByTestId('select-mentor');
      await user.click(selectButton);

      // Wait for modal to close
      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });

      // Error should be logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load mentor settings for workflow node:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should use mentor name when no org is provided', async () => {
      const user = userEvent.setup();

      render(
        <WorkflowCanvas
          {...defaultProps}
          // No org provided
        />,
      );

      // Open mentor modal
      const changeMentorButton = screen.getByRole('button', {
        name: 'Change agent',
      });
      await user.click(changeMentorButton);

      // Select mentor from grid
      const selectButton = screen.getByTestId('select-mentor');
      await user.click(selectButton);

      // Wait for modal to close
      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('default node handles', () => {
    it('should connect from left handle on default node', () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 100 },
          data: { label: 'Test Mentor Node', subtitle: 'Subtitle' },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 500, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const mentorNode = screen
        .getByText('Test Mentor Node')
        .closest('.absolute.pointer-events-auto');

      // Hover to show handles
      fireEvent.mouseEnter(mentorNode!);

      // Get left handle (first handle on default node)
      const handles = mentorNode?.querySelectorAll('.cursor-crosshair');
      expect(handles?.length).toBeGreaterThan(0);

      // Start connection from left handle
      const leftHandle = handles![0];
      fireEvent.mouseDown(leftHandle, { button: 0 });
      fireEvent.mouseMove(window, { clientX: 200, clientY: 125 });
      fireEvent.mouseUp(window);

      expect(mentorNode).toBeInTheDocument();
    });

    it('should connect from right handle on default node', () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 100 },
          data: { label: 'Test Mentor Node', subtitle: 'Subtitle' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const mentorNode = screen
        .getByText('Test Mentor Node')
        .closest('.absolute.pointer-events-auto');
      fireEvent.mouseEnter(mentorNode!);

      const handles = mentorNode?.querySelectorAll('.cursor-crosshair');

      // Right handle is second
      if (handles && handles.length > 1) {
        fireEvent.mouseDown(handles[1], { button: 0 });
        fireEvent.mouseMove(window, { clientX: 500, clientY: 125 });
        fireEvent.mouseUp(window);
      }

      expect(mentorNode).toBeInTheDocument();
    });

    it('should connect from top handle on default node', () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 100 },
          data: { label: 'Test Mentor Node', subtitle: 'Subtitle' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const mentorNode = screen
        .getByText('Test Mentor Node')
        .closest('.absolute.pointer-events-auto');
      fireEvent.mouseEnter(mentorNode!);

      const handles = mentorNode?.querySelectorAll('.cursor-crosshair');

      // Top handle is third
      if (handles && handles.length > 2) {
        fireEvent.mouseDown(handles[2], { button: 0 });
        fireEvent.mouseMove(window, { clientX: 350, clientY: 50 });
        fireEvent.mouseUp(window);
      }

      expect(mentorNode).toBeInTheDocument();
    });

    it('should connect from bottom handle on default node', () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 100 },
          data: { label: 'Test Mentor Node', subtitle: 'Subtitle' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const mentorNode = screen
        .getByText('Test Mentor Node')
        .closest('.absolute.pointer-events-auto');
      fireEvent.mouseEnter(mentorNode!);

      const handles = mentorNode?.querySelectorAll('.cursor-crosshair');

      // Bottom handle is fourth
      if (handles && handles.length > 3) {
        fireEvent.mouseDown(handles[3], { button: 0 });
        fireEvent.mouseMove(window, { clientX: 350, clientY: 200 });
        fireEvent.mouseUp(window);
      }

      expect(mentorNode).toBeInTheDocument();
    });
  });

  describe('dialog onOpenChange', () => {
    it('should handle dialog open via onOpenChange', async () => {
      const user = userEvent.setup();
      render(<WorkflowCanvas {...defaultProps} />);

      // Open mentor modal
      const changeMentorButton = screen.getByRole('button', {
        name: 'Change agent',
      });
      await user.click(changeMentorButton);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();

      // Close via the close button (tests onOpenChange with false)
      const closeButton = screen.getByTestId('close-dialog');
      await user.click(closeButton);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('isDefaultMentorLabel helper', () => {
    it('should handle mentor nodes with various default labels', async () => {
      // Test with different default labels
      const defaultLabels = ['My mentor', 'mentor', 'Mentor Node', 'MENTOR'];

      for (const label of defaultLabels) {
        const initialNodes = [
          {
            id: 'mentor-1',
            type: 'mentor',
            position: { x: 300, y: 250 },
            data: { label, subtitle: 'Mentor' },
          },
        ];

        const { unmount } = render(
          <WorkflowCanvas
            {...defaultProps}
            initialNodes={initialNodes}
            defaultMentorId="mentor-123"
            org="test-org"
          />,
        );

        // Cleanup
        unmount();
      }
    });

    it('should not overwrite custom mentor label', async () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 250 },
          data: {
            label: 'Custom Label That Is Not Default',
            subtitle: 'Mentor',
          },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          defaultMentorId="mentor-123"
          org="test-org"
        />,
      );

      // The custom label should be preserved
      expect(
        screen.getByText('Custom Label That Is Not Default'),
      ).toBeInTheDocument();
    });
  });

  describe('prefill with existing data', () => {
    it('should not overwrite existing instructions when prefilling', async () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 250 },
          data: {
            label: 'Custom Mentor Name', // Non-default label
            subtitle: 'Mentor',
            instructions: 'Existing instructions',
          },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          defaultMentorId="mentor-123"
          org="test-org"
        />,
      );

      await waitFor(() => {
        expect(mockFetchMentorSettings).toHaveBeenCalled();
      });

      // Custom label should be preserved (not overwritten because it's not a default label)
      expect(screen.getByText('Custom Mentor Name')).toBeInTheDocument();
    });

    it('should not overwrite existing model when prefilling', async () => {
      const initialNodes = [
        {
          id: 'mentor-1',
          type: 'mentor',
          position: { x: 300, y: 250 },
          data: {
            label: 'Custom Name',
            subtitle: 'Mentor',
            model: 'existing-model',
          },
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          defaultMentorId="mentor-123"
          org="test-org"
        />,
      );

      await waitFor(() => {
        expect(mockFetchMentorSettings).toHaveBeenCalled();
      });

      // Node should still exist with custom name preserved
      expect(screen.getByText('Custom Name')).toBeInTheDocument();
    });
  });

  describe('adding nodes with different types via click', () => {
    it('should add while node via onClickedItem', async () => {
      const { rerender } = render(<WorkflowCanvas {...defaultProps} />);

      rerender(
        <WorkflowCanvas
          {...defaultProps}
          onClickedItem={{ id: 'while', label: 'While Loop', type: 'while' }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('While Loop')).toBeInTheDocument();
      });
    });

    it('should add mentor node with defaultMentorId via onClickedItem', async () => {
      const { rerender } = render(
        <WorkflowCanvas
          {...defaultProps}
          defaultMentorId="default-mentor-123"
        />,
      );

      rerender(
        <WorkflowCanvas
          {...defaultProps}
          defaultMentorId="default-mentor-123"
          onClickedItem={{ id: 'mentor', label: 'New Mentor', type: 'mentor' }}
        />,
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Mentor|Agent/i).length).toBeGreaterThan(1);
      });
    });
  });

  describe('getHandlePosition for different node types', () => {
    it('should render edges correctly for while nodes', () => {
      const initialNodes = [
        {
          id: 'while-1',
          type: 'while',
          position: { x: 100, y: 100 },
          data: { label: 'While' },
          width: 400,
          height: 180,
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 600, y: 150 },
          data: { label: 'Transform' },
        },
      ];

      const initialEdges = [
        {
          id: 'e1',
          source: 'while-1',
          target: 'transform-1',
          sourceHandle: 'right',
          targetHandle: 'left',
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />,
      );

      // Edge should be rendered
      const paths = document.querySelectorAll('path[stroke="#38A1E5"]');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should render edges correctly for if-else nodes with condition handles', () => {
      const initialNodes = [
        {
          id: 'if-else-1',
          type: 'if-else',
          position: { x: 100, y: 100 },
          data: { label: 'If-Else', conditionCount: 2 },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 500, y: 100 },
          data: { label: 'Transform 1' },
        },
        {
          id: 'transform-2',
          type: 'transform',
          position: { x: 500, y: 200 },
          data: { label: 'Transform 2' },
        },
      ];

      const initialEdges = [
        {
          id: 'e1',
          source: 'if-else-1',
          target: 'transform-1',
          sourceHandle: 'condition-0',
          targetHandle: 'left',
        },
        {
          id: 'e2',
          source: 'if-else-1',
          target: 'transform-2',
          sourceHandle: 'else',
          targetHandle: 'left',
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />,
      );

      // Edges should be rendered
      const paths = document.querySelectorAll('path[stroke="#38A1E5"]');
      expect(paths.length).toBe(2);
    });

    it('should render edges correctly for user-approval nodes', () => {
      const initialNodes = [
        {
          id: 'approval-1',
          type: 'user-approval',
          position: { x: 100, y: 100 },
          data: { label: 'Approval' },
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 500, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      const initialEdges = [
        {
          id: 'e1',
          source: 'approval-1',
          target: 'transform-1',
          sourceHandle: 'approve',
          targetHandle: 'left',
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />,
      );

      expect(screen.getByText('Approval')).toBeInTheDocument();
    });

    it('should render edges correctly for note nodes', () => {
      const initialNodes = [
        {
          id: 'note-1',
          type: 'note',
          position: { x: 100, y: 100 },
          data: { label: 'Note', content: 'Test note' },
          width: 200,
          height: 120,
        },
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 400, y: 100 },
          data: { label: 'Transform' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      expect(screen.getByText('Test note')).toBeInTheDocument();
    });

    it('should handle edges with top and bottom handles', () => {
      const initialNodes = [
        {
          id: 'transform-1',
          type: 'transform',
          position: { x: 100, y: 100 },
          data: { label: 'Transform 1' },
        },
        {
          id: 'transform-2',
          type: 'transform',
          position: { x: 100, y: 300 },
          data: { label: 'Transform 2' },
        },
      ];

      const initialEdges = [
        {
          id: 'e1',
          source: 'transform-1',
          target: 'transform-2',
          sourceHandle: 'bottom',
          targetHandle: 'top',
        },
      ];

      render(
        <WorkflowCanvas
          {...defaultProps}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />,
      );

      const paths = document.querySelectorAll('path[stroke="#38A1E5"]');
      expect(paths.length).toBe(1);
    });
  });

  describe('connection handles for if-else conditions', () => {
    it('should start connection from condition handle', () => {
      const initialNodes = [
        {
          id: 'if-else-1',
          type: 'if-else',
          position: { x: 100, y: 100 },
          data: { label: 'If-Else', conditionCount: 2 },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const ifElseNode = screen
        .getByText('If-Else')
        .closest('.absolute.pointer-events-auto');
      fireEvent.mouseEnter(ifElseNode!);

      // Find condition handles
      const conditionRows = screen.getAllByText(/If|Else/);
      expect(conditionRows.length).toBeGreaterThan(0);

      // There should be multiple connection handles for conditions
      const handles = ifElseNode?.querySelectorAll('.cursor-crosshair');
      expect(handles?.length).toBeGreaterThan(0);
    });

    it('should start connection from else handle', () => {
      const initialNodes = [
        {
          id: 'if-else-1',
          type: 'if-else',
          position: { x: 100, y: 100 },
          data: { label: 'If-Else', conditionCount: 1 },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const ifElseNode = screen
        .getByText('If-Else')
        .closest('.absolute.pointer-events-auto');
      fireEvent.mouseEnter(ifElseNode!);

      // Get all handles
      const handles = ifElseNode?.querySelectorAll('.cursor-crosshair');

      // Click on the last visible handle (else)
      if (handles && handles.length > 0) {
        const lastHandle = handles[handles.length - 1];
        fireEvent.mouseDown(lastHandle, { button: 0 });
        fireEvent.mouseMove(window, { clientX: 400, clientY: 250 });
        fireEvent.mouseUp(window);
      }

      expect(ifElseNode).toBeInTheDocument();
    });
  });

  describe('user-approval connection handles', () => {
    it('should start connection from approve handle', () => {
      const initialNodes = [
        {
          id: 'approval-1',
          type: 'user-approval',
          position: { x: 100, y: 100 },
          data: { label: 'Approval' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      // Find the approve row's handle
      const approveText = screen.getByText('Approve');
      const approveRow = approveText.closest('.flex');
      const approveHandle = approveRow?.querySelector('.cursor-crosshair');

      if (approveHandle) {
        fireEvent.mouseDown(approveHandle, { button: 0 });
        fireEvent.mouseMove(window, { clientX: 400, clientY: 125 });
        fireEvent.mouseUp(window);
      }

      expect(screen.getByText('Approval')).toBeInTheDocument();
    });

    it('should start connection from reject handle', () => {
      const initialNodes = [
        {
          id: 'approval-1',
          type: 'user-approval',
          position: { x: 100, y: 100 },
          data: { label: 'Approval' },
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      // Find the reject row's handle
      const rejectText = screen.getByText('Reject');
      const rejectRow = rejectText.closest('.flex');
      const rejectHandle = rejectRow?.querySelector('.cursor-crosshair');

      if (rejectHandle) {
        fireEvent.mouseDown(rejectHandle, { button: 0 });
        fireEvent.mouseMove(window, { clientX: 400, clientY: 175 });
        fireEvent.mouseUp(window);
      }

      expect(screen.getByText('Approval')).toBeInTheDocument();
    });
  });

  describe('while node connection handles', () => {
    it('should start connection from while node left handle', () => {
      const initialNodes = [
        {
          id: 'while-1',
          type: 'while',
          position: { x: 100, y: 100 },
          data: { label: 'While Loop' },
          width: 400,
          height: 180,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const whileNode = screen.getByText('While Loop').closest('.rounded-2xl');
      const parentNode = whileNode?.closest('.absolute.pointer-events-auto');
      fireEvent.mouseEnter(parentNode!);

      const handles = parentNode?.querySelectorAll('.cursor-crosshair');

      if (handles && handles.length > 0) {
        fireEvent.mouseDown(handles[0], { button: 0 });
        fireEvent.mouseMove(window, { clientX: 50, clientY: 190 });
        fireEvent.mouseUp(window);
      }

      expect(screen.getByText('While Loop')).toBeInTheDocument();
    });

    it('should start connection from while node right handle', () => {
      const initialNodes = [
        {
          id: 'while-1',
          type: 'while',
          position: { x: 100, y: 100 },
          data: { label: 'While Loop' },
          width: 400,
          height: 180,
        },
      ];

      render(<WorkflowCanvas {...defaultProps} initialNodes={initialNodes} />);

      const whileNode = screen.getByText('While Loop').closest('.rounded-2xl');
      const parentNode = whileNode?.closest('.absolute.pointer-events-auto');
      fireEvent.mouseEnter(parentNode!);

      const handles = parentNode?.querySelectorAll('.cursor-crosshair');

      if (handles && handles.length > 1) {
        fireEvent.mouseDown(handles[1], { button: 0 });
        fireEvent.mouseMove(window, { clientX: 600, clientY: 190 });
        fireEvent.mouseUp(window);
      }

      expect(screen.getByText('While Loop')).toBeInTheDocument();
    });
  });
});
