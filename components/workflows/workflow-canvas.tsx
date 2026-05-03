'use client';

import type React from 'react';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Play,
  MousePointer,
  Undo,
  Redo,
  Hand,
  Bot,
  GitBranch,
  RefreshCw,
  ThumbsUp,
  Pencil,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useLazyGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';
import { MentorSelectionGrid } from '@/components/mentors/mentor-selection-grid';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { NodeConfigPanel } from './node-config-panel';

interface Variable {
  id: string;
  name: string;
  type: string;
  defaultValue?: string;
}

interface Tool {
  id: string;
  type: string;
  name: string;
  config?: Record<string, unknown>;
}

interface Condition {
  id: string;
  caseName: string;
  expression: string;
}

interface TransformExpression {
  id: string;
  key: string;
  value: string;
}

interface SetStateAssignment {
  id: string;
  value: string;
  variable: string;
}

interface McpConnector {
  id: string;
  name: string;
  icon?: string;
}

const DEFAULT_MENTOR_LABELS = new Set([
  'my agent',
  'agent',
  'agent node',
  'my mentor',
  'mentor',
  'mentor node',
]);

const isDefaultMentorLabel = (label?: string) => {
  if (!label) return true;
  return DEFAULT_MENTOR_LABELS.has(label.trim().toLowerCase());
};

// API may use 'conditional' as the node type key for if-else nodes
const isConditionalType = (type?: string) =>
  type === 'if-else' || type === 'conditional';

export interface NodeConfig {
  // Common
  label: string;
  subtitle?: string;
  color?: string;
  content?: string;
  // Start node
  stateVariables?: Variable[];
  // Mentor node
  entry_mentor_id?: string;
  mentor_id?: string;
  instructions?: string;
  includeChatHistory?: boolean;
  model?: string;
  reasoningEffort?: string;
  tools?: Tool[];
  outputFormat?: string;
  verbosity?: string;
  displayResponseInChat?: boolean;
  showSearchSources?: boolean;
  continueOnError?: boolean;
  writeToHistory?: boolean;
  // If-else node
  conditionCount?: number;
  conditions?: Condition[];
  // While node
  whileExpression?: string;
  // User approval node
  userApprovalMessage?: string;
  // Transform node
  transformMode?: 'expressions' | 'object';
  transformExpressions?: TransformExpression[];
  // Set state node
  setStateAssignments?: SetStateAssignment[];
  // MCP node
  mcpConnectors?: McpConnector[];
  // File-search node
  datasetId?: string;
  datasetName?: string;
  maxResults?: number;
  fileSearchQuery?: string;
}

interface Node {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: NodeConfig;
  width?: number;
  height?: number;
  selected?: boolean;
  dragging?: boolean;
  draggable?: boolean;
  selectable?: boolean;
  connectable?: boolean;
  deletable?: boolean;
  parentId?: string;
  zIndex?: number;
  hidden?: boolean;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
  hidden?: boolean;
  selected?: boolean;
  data?: Record<string, unknown>;
}

export interface ReactFlowJsonObject {
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
}

// Helper to strip UI-only properties from nodes for comparison/saving
function stripUiProperties(nodes: Node[]): Node[] {
  return nodes.map(({ selected, dragging, hidden, ...rest }) => rest);
}

// Helper to strip UI-only properties from edges for comparison/saving
function stripEdgeUiProperties(edges: Edge[]): Edge[] {
  return edges.map(({ selected, hidden, ...rest }) => rest);
}

interface WorkflowCanvasProps {
  onDraggedItem: { id: string; label: string; type: string } | null;
  onClickedItem: { id: string; label: string; type: string } | null;
  previewMode?: boolean;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  initialViewport?: { x: number; y: number; zoom: number };
  onStateChange?: (state: ReactFlowJsonObject) => void;
  org?: string;
  defaultMentorId?: string;
}

// Default nodes for new workflows
const DEFAULT_NODES: Node[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 300, y: 250 },
    data: { label: 'Start' },
    draggable: true,
    selectable: true,
    connectable: true,
  },
  {
    id: 'mentor-1',
    type: 'mentor',
    position: { x: 550, y: 250 },
    data: { label: 'My agent', subtitle: 'Agent', color: 'chart-1' },
    draggable: true,
    selectable: true,
    connectable: true,
  },
];

const DEFAULT_EDGES: Edge[] = [
  {
    id: 'e-start-mentor-1',
    source: 'start',
    target: 'mentor-1',
    sourceHandle: 'right',
    targetHandle: 'left',
  },
];

export function WorkflowCanvas({
  onDraggedItem: _onDraggedItem,
  onClickedItem,
  previewMode = false,
  initialNodes,
  initialEdges,
  initialViewport,
  onStateChange,
  org,
  defaultMentorId,
}: WorkflowCanvasProps) {
  // Use initialNodes if provided (from API), otherwise use defaults for new workflows
  const [nodes, setNodes] = useState<Node[]>(
    initialNodes && initialNodes.length > 0 ? initialNodes : DEFAULT_NODES,
  );

  const [edges, setEdges] = useState<Edge[]>(
    initialEdges ? initialEdges : DEFAULT_EDGES,
  );
  const [tool, setTool] = useState<'hand' | 'pointer'>('hand');
  const [zoom, setZoom] = useState(initialViewport?.zoom || 1);
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([
    { nodes: [...nodes], edges: [...edges] },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState(
    initialViewport
      ? { x: initialViewport.x, y: initialViewport.y }
      : { x: 0, y: 0 },
  );
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    handle: string;
  } | null>(null);
  const [tempConnectionPos, setTempConnectionPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [resizingNote, setResizingNote] = useState<{
    nodeId: string;
    corner: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [selectedNodeForConfig, setSelectedNodeForConfig] = useState<
    string | null
  >(null);
  const processedClickRef = useRef<typeof onClickedItem>(null);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [mentorSearchQuery, setMentorSearchQuery] = useState('');
  const [activeMentorNodeId, setActiveMentorNodeId] = useState<string | null>(
    null,
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const suppressMentorClickRef = useRef(false);

  // Track if we've loaded initial data from props
  const hasLoadedInitialData = useRef(false);

  // Track last emitted state to avoid duplicate onStateChange calls
  const lastEmittedStateRef = useRef<string | null>(null);

  const username = useUsername();
  const { openEditMentorModal } = useNavigate();
  const [fetchMentorSettings] = useLazyGetMentorSettingsQuery();

  // Sync nodes and edges when initialNodes/initialEdges change
  // This handles both preview mode updates and initial data load
  useEffect(() => {
    // In preview mode, always sync when props change
    if (previewMode) {
      if (initialNodes && initialNodes.length > 0) {
        setNodes(initialNodes);
      }
      if (initialEdges) {
        setEdges(initialEdges);
      }
      return;
    }

    // In edit mode, only sync on first load (when data comes from API)
    if (
      !hasLoadedInitialData.current &&
      initialNodes &&
      initialNodes.length > 0
    ) {
      setNodes(initialNodes);
      if (initialEdges) {
        setEdges(initialEdges);
      }
      // Reset history with loaded data
      setHistory([{ nodes: initialNodes, edges: initialEdges || [] }]);
      setHistoryIndex(0);
      hasLoadedInitialData.current = true;
    }
  }, [previewMode, initialNodes, initialEdges]);

  useEffect(() => {
    if (previewMode && initialViewport) {
      setZoom(initialViewport.zoom);
      setPanOffset({ x: initialViewport.x, y: initialViewport.y });
    }
  }, [previewMode, initialViewport]);

  const saveToHistory = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push({ nodes: [...newNodes], edges: [...newEdges] });
        return newHistory.slice(-50); // Keep last 50 states
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    },
    [historyIndex],
  );

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setNodes(history[newIndex].nodes);
      setEdges(history[newIndex].edges);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setNodes(history[newIndex].nodes);
      setEdges(history[newIndex].edges);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.5));
  };

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<NodeConfig>) => {
      setNodes((prev) => {
        const newNodes = prev.map((node) => {
          if (node.id !== nodeId) return node;
          const shouldSyncMentorId =
            node.type === 'mentor' &&
            updates.entry_mentor_id !== undefined &&
            updates.mentor_id === undefined;
          const normalizedUpdates = shouldSyncMentorId
            ? { ...updates, mentor_id: updates.entry_mentor_id }
            : updates;
          return {
            ...node,
            data: {
              ...node.data,
              ...normalizedUpdates,
            },
          };
        });
        // Save to history when config changes
        saveToHistory(newNodes, edges);
        return newNodes;
      });
    },
    [edges, saveToHistory],
  );

  const prefillMentorNode = useCallback(
    async (nodeId: string, mentorId?: string, existingData?: NodeConfig) => {
      if (!mentorId || !org || !username) return;
      try {
        const settings = (await fetchMentorSettings({
          mentor: mentorId,
          org,
        }).unwrap()) as Record<string, unknown>;

        const mentorLabel =
          (settings.display_name as string) || (settings.mentor_name as string);
        const mentorInstructions = settings.system_prompt as string | undefined;
        const mentorModel = settings.llm_name as string | undefined;

        const updates: Partial<NodeConfig> = {};

        if (mentorLabel && isDefaultMentorLabel(existingData?.label)) {
          updates.label = mentorLabel;
        }

        if (mentorInstructions && !existingData?.instructions) {
          updates.instructions = mentorInstructions;
        }

        if (mentorModel && !existingData?.model) {
          updates.model = mentorModel;
        }

        if (Object.keys(updates).length > 0) {
          handleUpdateNode(nodeId, updates);
        }
      } catch (error) {
        console.error('Failed to prefill mentor node data:', error);
      }
    },
    [fetchMentorSettings, handleUpdateNode, org, username],
  );

  useEffect(() => {
    if (!defaultMentorId || previewMode) return;
    const mentorNodesMissingId = nodes.filter(
      (node) =>
        node.type === 'mentor' &&
        !node.data.entry_mentor_id &&
        !node.data.mentor_id,
    );
    if (mentorNodesMissingId.length === 0) return;

    setNodes((prev) =>
      prev.map((node) => {
        if (node.type !== 'mentor') return node;
        if (node.data.entry_mentor_id || node.data.mentor_id) return node;
        return {
          ...node,
          data: {
            ...node.data,
            entry_mentor_id: defaultMentorId,
            mentor_id: defaultMentorId,
          },
        };
      }),
    );

    mentorNodesMissingId.forEach((node) => {
      prefillMentorNode(node.id, defaultMentorId, node.data);
    });
  }, [defaultMentorId, previewMode, nodes, prefillMentorNode]);

  const closeMentorModal = useCallback(() => {
    setShowMentorModal(false);
    setMentorSearchQuery('');
    setActiveMentorNodeId(null);
  }, []);

  const handleMentorSelect = useCallback(
    async (mentor: { unique_id?: string; name?: string }) => {
      if (!activeMentorNodeId) return;
      const mentorId = mentor.unique_id;
      if (!mentorId) return;

      const activeNode = nodes.find((node) => node.id === activeMentorNodeId);
      const currentData = activeNode?.data;

      let updates: Partial<NodeConfig> = {
        entry_mentor_id: mentorId,
        mentor_id: mentorId,
        subtitle: currentData?.subtitle ?? 'Agent',
      };

      try {
        if (org && username) {
          const settings = (await fetchMentorSettings({
            mentor: mentorId,
            org,
          }).unwrap()) as Record<string, unknown>;

          updates = {
            ...updates,
            label:
              (settings.display_name as string) ||
              (settings.mentor_name as string) ||
              mentor.name ||
              currentData?.label ||
              'Agent',
            instructions:
              (settings.system_prompt as string) || currentData?.instructions,
            model: (settings.llm_name as string) || currentData?.model,
          };
        } else if (mentor.name) {
          updates = { ...updates, label: mentor.name };
        }
      } catch (error) {
        console.error(
          'Failed to load mentor settings for workflow node:',
          error,
        );
        if (mentor.name) {
          updates = { ...updates, label: mentor.name };
        }
      }

      handleUpdateNode(activeMentorNodeId, updates);
      closeMentorModal();
    },
    [
      activeMentorNodeId,
      closeMentorModal,
      fetchMentorSettings,
      handleUpdateNode,
      nodes,
      org,
      username,
    ],
  );

  const handleMentorChangeClick = useCallback(
    (nodeId: string) => {
      if (previewMode) return;
      setActiveMentorNodeId(nodeId);
      setMentorSearchQuery('');
      setShowMentorModal(true);
    },
    [previewMode],
  );

  const findNonOverlappingPosition = useCallback(
    (baseX: number, baseY: number, nodeType: string) => {
      const nodeWidth =
        nodeType === 'while'
          ? 400
          : isConditionalType(nodeType) || nodeType === 'user-approval'
            ? 280
            : nodeType === 'note'
              ? 200
              : 140;
      const nodeHeight =
        nodeType === 'while'
          ? 180
          : isConditionalType(nodeType) || nodeType === 'user-approval'
            ? 140
            : nodeType === 'note'
              ? 120
              : 50;

      const SPACING = 20; // Minimum spacing between nodes

      // Check if position overlaps with any existing node
      const hasOverlap = (x: number, y: number) => {
        return nodes.some((node) => {
          const existingWidth =
            node.type === 'while'
              ? node.width || 400
              : isConditionalType(node.type) || node.type === 'user-approval'
                ? 280
                : node.type === 'note'
                  ? node.width || 200
                  : 140;
          const existingHeight =
            node.type === 'while'
              ? node.height || 180
              : isConditionalType(node.type) || node.type === 'user-approval'
                ? 140
                : node.type === 'note'
                  ? node.height || 120
                  : 50;

          return !(
            x + nodeWidth + SPACING < node.position.x ||
            x > node.position.x + existingWidth + SPACING ||
            y + nodeHeight + SPACING < node.position.y ||
            y > node.position.y + existingHeight + SPACING
          );
        });
      };

      // Try original position first
      if (!hasOverlap(baseX, baseY)) {
        return { x: baseX, y: baseY };
      }

      // Try positions in a spiral pattern
      const attempts = [
        { x: baseX + nodeWidth + SPACING * 2, y: baseY }, // Right
        { x: baseX, y: baseY + nodeHeight + SPACING * 2 }, // Below
        { x: baseX - nodeWidth - SPACING * 2, y: baseY }, // Left
        { x: baseX, y: baseY - nodeHeight - SPACING * 2 }, // Above
        {
          x: baseX + nodeWidth + SPACING * 2,
          y: baseY + nodeHeight + SPACING * 2,
        }, // Bottom-right
        {
          x: baseX - nodeWidth - SPACING * 2,
          y: baseY + nodeHeight + SPACING * 2,
        }, // Bottom-left
        {
          x: baseX + nodeWidth + SPACING * 2,
          y: baseY - nodeHeight - SPACING * 2,
        }, // Top-right
        {
          x: baseX - nodeWidth - SPACING * 2,
          y: baseY - nodeHeight - SPACING * 2,
        }, // Top-left
      ];

      for (const pos of attempts) {
        if (!hasOverlap(pos.x, pos.y)) {
          return pos;
        }
      }

      // If all attempts fail, offset further to the right and down
      return {
        x: baseX + (nodeWidth + SPACING) * 2,
        y: baseY + (nodeHeight + SPACING) * 2,
      };
    },
    [nodes],
  );

  useEffect(() => {
    if (previewMode) return; // Don't add nodes in preview mode
    if (onClickedItem && canvasRef.current) {
      // Prevent duplicate additions - skip if we already processed this exact click object
      if (processedClickRef.current === onClickedItem) {
        return;
      }
      processedClickRef.current = onClickedItem;

      const rect = canvasRef.current.getBoundingClientRect();
      const centerX = (rect.width / 2 - panOffset.x) / zoom;
      const centerY = (rect.height / 2 - panOffset.y) / zoom;

      const baseX = centerX - 70;
      const baseY = centerY - 25;
      const { x, y } = findNonOverlappingPosition(
        baseX,
        baseY,
        onClickedItem.id,
      );

      const newNode: Node = {
        id: `${onClickedItem.id}-${Date.now()}`,
        type: onClickedItem.id,
        position: { x, y },
        data: {
          label: onClickedItem.label,
          ...(onClickedItem.id === 'mentor' && {
            subtitle: 'Agent',
            color: 'chart-1',
            entry_mentor_id: defaultMentorId,
            mentor_id: defaultMentorId,
          }),
          ...(onClickedItem.id === 'note' && { content: 'Sticky Note' }),
        },
        ...(onClickedItem.id === 'note' && { width: 200, height: 120 }),
        ...(onClickedItem.id === 'while' && { width: 400, height: 180 }),
        draggable: true,
        selectable: true,
        connectable: true,
      };
      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      saveToHistory(newNodes, edges);

      if (onClickedItem.id === 'mentor' && defaultMentorId) {
        prefillMentorNode(newNode.id, defaultMentorId, newNode.data);
      }
    }
  }, [onClickedItem, defaultMentorId, edges, prefillMentorNode]);

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (previewMode) return; // Prevent node dragging in preview mode
    if (e.button !== 0) return;
    e.stopPropagation();

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (e.ctrlKey || e.metaKey) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, selected: !n.selected } : n,
        ),
      );
      if (node.type === 'mentor') {
        setSelectedNodeForConfig(null);
      }
      suppressMentorClickRef.current = true;
    } else {
      setNodes((prev) =>
        prev.map((n) => ({ ...n, selected: n.id === nodeId })),
      );
      if (node.type !== 'mentor') {
        setSelectedNodeForConfig(nodeId);
      } else {
        setSelectedNodeForConfig(null);
      }
      suppressMentorClickRef.current = false;
    }

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragMovedRef.current = false;
    setDraggedNode(nodeId);
    setDragOffset({
      x: e.clientX / zoom - node.position.x,
      y: e.clientY / zoom - node.position.y,
    });
  };

  const handleConnectionStart = (
    e: React.MouseEvent,
    nodeId: string,
    handle: string,
  ) => {
    if (previewMode) return; // Prevent connection creation in preview mode
    e.stopPropagation();
    setConnectingFrom({ nodeId, handle });
  };

  const handleResizeStart = (
    e: React.MouseEvent,
    nodeId: string,
    corner: string,
  ) => {
    if (previewMode) return; // Prevent resizing in preview mode
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setResizingNote({
      nodeId,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: node.width || 200,
      startHeight: node.height || 120,
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || draggedNode || connectingFrom) return;

    const target = e.target as HTMLElement;
    const isCanvasClick =
      target === e.currentTarget ||
      target.tagName === 'svg' ||
      target.tagName === 'rect';

    if (isCanvasClick && !previewMode) {
      setSelectedNodeForConfig(null);
    }

    if (tool === 'hand') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    } else if (tool === 'pointer' && !previewMode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - panOffset.x) / zoom;
      const y = (e.clientY - rect.top - panOffset.y) / zoom;
      setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
      setNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggedNode) {
        if (dragStartRef.current) {
          const movedX = Math.abs(e.clientX - dragStartRef.current.x);
          const movedY = Math.abs(e.clientY - dragStartRef.current.y);
          if (movedX > 3 || movedY > 3) {
            dragMovedRef.current = true;
          }
        }

        const draggedNodeData = nodes.find((n) => n.id === draggedNode);
        if (!draggedNodeData) return;

        const deltaX =
          e.clientX / zoom - dragOffset.x - draggedNodeData.position.x;
        const deltaY =
          e.clientY / zoom - dragOffset.y - draggedNodeData.position.y;

        setNodes((prev) =>
          prev.map((node) => {
            if (node.selected) {
              return {
                ...node,
                position: {
                  x: node.position.x + deltaX,
                  y: node.position.y + deltaY,
                },
                dragging: true,
              };
            }
            return node;
          }),
        );
      } else if (isPanning) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else if (connectingFrom && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setTempConnectionPos({
          x: (e.clientX - rect.left - panOffset.x) / zoom,
          y: (e.clientY - rect.top - panOffset.y) / zoom,
        });
      } else if (resizingNote) {
        const deltaX = (e.clientX - resizingNote.startX) / zoom;
        const deltaY = (e.clientY - resizingNote.startY) / zoom;

        setNodes((prev) =>
          prev.map((node) => {
            if (node.id === resizingNote.nodeId) {
              let newWidth = resizingNote.startWidth;
              let newHeight = resizingNote.startHeight;

              if (resizingNote.corner.includes('right')) {
                newWidth = Math.max(150, resizingNote.startWidth + deltaX);
              }
              if (resizingNote.corner.includes('bottom')) {
                newHeight = Math.max(80, resizingNote.startHeight + deltaY);
              }

              return { ...node, width: newWidth, height: newHeight };
            }
            return node;
          }),
        );
      } else if (selectionBox && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const currentX = (e.clientX - rect.left - panOffset.x) / zoom;
        const currentY = (e.clientY - rect.top - panOffset.y) / zoom;
        setSelectionBox((prev) =>
          prev ? { ...prev, currentX, currentY } : null,
        );

        const minX = Math.min(selectionBox.startX, currentX);
        const maxX = Math.max(selectionBox.startX, currentX);
        const minY = Math.min(selectionBox.startY, currentY);
        const maxY = Math.max(selectionBox.startY, currentY);

        const nodeWidth = (node: Node) =>
          node.type === 'while'
            ? node.width || 400
            : isConditionalType(node.type) || node.type === 'user-approval'
              ? 280
              : node.type === 'note'
                ? node.width || 200
                : 140;
        const nodeHeight = (node: Node) =>
          node.type === 'while'
            ? node.height || 180
            : isConditionalType(node.type) || node.type === 'user-approval'
              ? 140
              : node.type === 'note'
                ? node.height || 120
                : 50;

        setNodes((prev) =>
          prev.map((node) => {
            const nodeInBox =
              node.position.x + nodeWidth(node) > minX &&
              node.position.x < maxX &&
              node.position.y + nodeHeight(node) > minY &&
              node.position.y < maxY;
            return { ...node, selected: nodeInBox };
          }),
        );
      }
    },
    [
      draggedNode,
      dragOffset,
      isPanning,
      panStart,
      connectingFrom,
      panOffset,
      resizingNote,
      selectionBox,
      nodes,
      zoom,
    ],
  );

  const handleMouseUp = useCallback(() => {
    if (
      connectingFrom &&
      hoveredNode &&
      connectingFrom.nodeId !== hoveredNode
    ) {
      const newEdge: Edge = {
        id: `e-${connectingFrom.nodeId}-${hoveredNode}`,
        source: connectingFrom.nodeId,
        target: hoveredNode,
        sourceHandle: connectingFrom.handle,
        targetHandle: 'left',
      };
      const newEdges = [...edges, newEdge];
      setEdges(newEdges);
      saveToHistory(nodes, newEdges);
    }
    if (draggedNode) {
      setNodes((prev) => prev.map((n) => ({ ...n, dragging: false })));
      saveToHistory(nodes, edges);

      if (
        !previewMode &&
        !dragMovedRef.current &&
        !suppressMentorClickRef.current
      ) {
        const clickedNode = nodes.find((node) => node.id === draggedNode);
        if (clickedNode?.type === 'mentor') {
          openEditMentorModal(
            undefined,
            clickedNode.data.mentor_id ?? clickedNode.data.entry_mentor_id,
          );
        }
      }
    }
    dragMovedRef.current = false;
    dragStartRef.current = null;
    suppressMentorClickRef.current = false;
    setDraggedNode(null);
    setIsPanning(false);
    setConnectingFrom(null);
    setTempConnectionPos(null);
    setResizingNote(null);
    setSelectionBox(null);
  }, [
    connectingFrom,
    hoveredNode,
    draggedNode,
    nodes,
    edges,
    saveToHistory,
    openEditMentorModal,
    previewMode,
    defaultMentorId,
  ]);

  useEffect(() => {
    if (
      draggedNode ||
      isPanning ||
      connectingFrom ||
      resizingNote ||
      selectionBox
    ) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [
    draggedNode,
    isPanning,
    connectingFrom,
    resizingNote,
    selectionBox,
    handleMouseMove,
    handleMouseUp,
  ]);

  const handleDrop = (e: React.DragEvent) => {
    if (previewMode) return; // Prevent dropping in preview mode
    e.preventDefault();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const baseX = (e.clientX - rect.left - panOffset.x) / zoom;
    const baseY = (e.clientY - rect.top - panOffset.y) / zoom;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));

      const { x, y } = findNonOverlappingPosition(baseX, baseY, data.id);

      const newNode: Node = {
        id: `${data.id}-${Date.now()}`,
        type: data.id,
        position: { x, y },
        data: {
          label: data.label,
          ...(data.id === 'mentor' && {
            subtitle: 'Agent',
            color: 'chart-1',
            entry_mentor_id: defaultMentorId,
            mentor_id: defaultMentorId,
          }),
          ...(data.id === 'note' && { content: 'Sticky Note' }),
        },
        ...(data.id === 'note' && { width: 200, height: 120 }),
        ...(data.id === 'while' && { width: 400, height: 180 }),
        draggable: true,
        selectable: true,
        connectable: true,
      };
      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      saveToHistory(newNodes, edges);

      if (data.id === 'mentor' && defaultMentorId) {
        prefillMentorNode(newNode.id, defaultMentorId, newNode.data);
      }
    } catch (error) {
      console.error('Failed to parse dropped data:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getHandlePosition = (node: Node, handle: string) => {
    let nodeWidth = 140;
    let nodeHeight = 50;

    if (node.type === 'start') {
      nodeWidth = 100;
      nodeHeight = 50;
    } else if (node.type === 'while') {
      nodeWidth = node.width || 400;
      nodeHeight = node.height || 180;
    } else if (isConditionalType(node.type)) {
      nodeWidth = 280;
      const conditionCount = node.data.conditionCount || 1;
      nodeHeight = 80 + conditionCount * 50;
    } else if (node.type === 'user-approval') {
      nodeWidth = 280;
      nodeHeight = 140;
    } else if (node.type === 'note') {
      nodeWidth = node.width || 200;
      nodeHeight = node.height || 120;
    }

    const HANDLE_OFFSET = 8;

    switch (handle) {
      case 'left':
        return {
          x: node.position.x - HANDLE_OFFSET,
          y: node.position.y + nodeHeight / 2,
        };
      case 'right':
        return {
          x: node.position.x + nodeWidth + HANDLE_OFFSET,
          y: node.position.y + nodeHeight / 2,
        };
      case 'top':
        return {
          x: node.position.x + nodeWidth / 2,
          y: node.position.y - HANDLE_OFFSET,
        };
      case 'bottom':
        return {
          x: node.position.x + nodeWidth / 2,
          y: node.position.y + nodeHeight + HANDLE_OFFSET,
        };
      case 'else':
        return {
          x: node.position.x + nodeWidth + HANDLE_OFFSET,
          y: node.position.y + nodeHeight - 25,
        };
      default:
        if (handle.startsWith('condition-')) {
          const index = Number.parseInt(handle.split('-')[1]);
          return {
            x: node.position.x + nodeWidth + HANDLE_OFFSET,
            y: node.position.y + 55 + index * 50,
          };
        }
        return { x: node.position.x, y: node.position.y };
    }
  };

  const getConnectionPath = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const controlPointOffset = Math.min(distance * 0.5, 100);

    return `M ${from.x} ${from.y} C ${from.x + controlPointOffset} ${from.y}, ${to.x - controlPointOffset} ${to.y}, ${to.x} ${to.y}`;
  };

  // Handle deleting selected nodes
  const handleDeleteSelectedNodes = useCallback(() => {
    // Get IDs of selected nodes (excluding 'start' node which cannot be deleted)
    const selectedNodeIds = nodes
      .filter((node) => node.selected && node.type !== 'start')
      .map((node) => node.id);

    if (selectedNodeIds.length === 0) return;

    // Remove selected nodes
    const newNodes = nodes.filter((node) => !selectedNodeIds.includes(node.id));

    // Remove edges connected to deleted nodes
    const newEdges = edges.filter(
      (edge) =>
        !selectedNodeIds.includes(edge.source) &&
        !selectedNodeIds.includes(edge.target),
    );

    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNodeForConfig(null);
    saveToHistory(newNodes, newEdges);
  }, [nodes, edges, saveToHistory]);

  // Keyboard event handler for delete/backspace
  useEffect(() => {
    if (previewMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Delete or Backspace is pressed
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing in an input or textarea
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }

        e.preventDefault();
        handleDeleteSelectedNodes();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewMode, handleDeleteSelectedNodes]);

  useEffect(() => {
    if (onStateChange && !previewMode) {
      // Strip UI-only properties for comparison to avoid triggering on selection changes
      const strippedNodes = stripUiProperties(nodes);
      const strippedEdges = stripEdgeUiProperties(edges);
      const stateKey = JSON.stringify({
        nodes: strippedNodes,
        edges: strippedEdges,
      });

      // Only trigger onStateChange if actual data changed (not just selection/dragging)
      if (stateKey !== lastEmittedStateRef.current) {
        lastEmittedStateRef.current = stateKey;
        const reactFlowData: ReactFlowJsonObject = {
          nodes: strippedNodes,
          edges: strippedEdges,
          viewport: { x: panOffset.x, y: panOffset.y, zoom },
        };
        onStateChange(reactFlowData);
      }
    }
  }, [nodes, edges, zoom, panOffset, previewMode, onStateChange]);

  const activeMentorNode = activeMentorNodeId
    ? nodes.find((node) => node.id === activeMentorNodeId)
    : undefined;
  const activeMentorId =
    activeMentorNode?.data.mentor_id ?? activeMentorNode?.data.entry_mentor_id;
  const selectedMentorIds = activeMentorId ? [activeMentorId] : [];

  return (
    <div
      data-testid="workflow-canvas"
      className="bg-background relative h-full w-full overflow-hidden select-none"
    >
      <div
        ref={canvasRef}
        className={`absolute inset-0 ${tool === 'hand' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
        onMouseDown={handleCanvasMouseDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <svg className="pointer-events-none h-full w-full">
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="1"
                cy="1"
                r="0.5"
                fill="hsl(var(--muted-foreground) / 0.2)"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <g
            transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}
          >
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.source);
              const toNode = nodes.find((n) => n.id === edge.target);
              if (!fromNode || !toNode) return null;

              const fromPos = getHandlePosition(
                fromNode,
                edge.sourceHandle || 'right',
              );
              const toPos = getHandlePosition(
                toNode,
                edge.targetHandle || 'left',
              );

              return (
                <path
                  key={edge.id}
                  d={getConnectionPath(fromPos, toPos)}
                  stroke="#38A1E5"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}

            {connectingFrom &&
              tempConnectionPos &&
              (() => {
                const fromNode = nodes.find(
                  (n) => n.id === connectingFrom.nodeId,
                );
                if (!fromNode) return null;
                const fromPos = getHandlePosition(
                  fromNode,
                  connectingFrom.handle,
                );
                return (
                  <path
                    d={getConnectionPath(fromPos, tempConnectionPos)}
                    stroke="#38A1E5"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    fill="none"
                    strokeLinecap="round"
                  />
                );
              })()}

            {selectionBox && (
              <rect
                x={Math.min(selectionBox.startX, selectionBox.currentX)}
                y={Math.min(selectionBox.startY, selectionBox.currentY)}
                width={Math.abs(selectionBox.currentX - selectionBox.startX)}
                height={Math.abs(selectionBox.currentY - selectionBox.startY)}
                fill="rgba(56, 161, 229, 0.1)"
                stroke="#38A1E5"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            )}
          </g>
        </svg>

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`group pointer-events-auto absolute ${node.selected ? 'ring-offset-background rounded-xl ring-2 ring-[#38A1E5] ring-offset-2' : ''}`}
              style={{
                left: `${node.position.x}px`,
                top: `${node.position.y}px`,
              }}
              onMouseDown={(e) => {
                if (node.type !== 'note' || !editingNote) {
                  handleNodeMouseDown(e, node.id);
                }
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {node.type === 'start' ? (
                <div className="bg-card border-border relative flex cursor-grab items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-[#38A1E5] active:cursor-grabbing">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded"
                    style={{ backgroundColor: 'rgba(56, 161, 229, 0.2)' }}
                  >
                    <Play className="h-4 w-4" style={{ color: '#38A1E5' }} />
                  </div>
                  <span className="text-foreground font-medium">
                    {node.data.label}
                  </span>

                  <div
                    className="border-background absolute top-1/2 -right-2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'right')
                    }
                  />
                </div>
              ) : node.type === 'while' ? (
                <div
                  className="border-border bg-card/50 relative cursor-grab rounded-2xl border-2 border-dashed transition-colors hover:border-[#38A1E5] active:cursor-grabbing"
                  style={{
                    width: `${node.width || 400}px`,
                    height: `${node.height || 180}px`,
                  }}
                >
                  <div className="flex items-center gap-2 p-4">
                    <RefreshCw
                      className="h-5 w-5"
                      style={{ color: '#38A1E5' }}
                    />
                    <span className="text-foreground font-medium">
                      {node.data.label}
                    </span>
                  </div>

                  <div
                    className="border-background absolute top-1/2 -left-2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'left')
                    }
                  />
                  <div
                    className="border-background absolute top-1/2 -right-2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'right')
                    }
                  />

                  <div
                    className="border-background absolute -right-1 -bottom-1 h-4 w-4 cursor-nwse-resize rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleResizeStart(e, node.id, 'bottom-right')
                    }
                  />
                </div>
              ) : isConditionalType(node.type) ? (
                (() => {
                  const conditionCount = node.data.conditionCount || 1;
                  const nodeHeight = 80 + conditionCount * 50;

                  return (
                    <div
                      className="border-border bg-card relative cursor-grab rounded-2xl border transition-colors hover:border-[#38A1E5] active:cursor-grabbing"
                      style={{ width: '280px', minHeight: `${nodeHeight}px` }}
                    >
                      <div className="flex items-center gap-3 p-4 pb-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg"
                          style={{ backgroundColor: 'rgba(56, 161, 229, 0.2)' }}
                        >
                          <GitBranch
                            className="h-5 w-5"
                            style={{ color: '#38A1E5' }}
                          />
                        </div>
                        <span className="text-foreground font-medium">
                          {node.data.label}
                        </span>
                      </div>
                      <div className="space-y-2 px-4 pb-4">
                        {/* Render each condition */}
                        {Array.from({ length: conditionCount }).map(
                          (_, index) => (
                            <div
                              key={index}
                              className="bg-muted/50 relative flex items-center justify-between rounded-lg px-4 py-3"
                            >
                              <span className="text-muted-foreground text-sm">
                                {index === 0 ? 'If' : `Else if ${index}`}
                              </span>
                              <div
                                className="border-background absolute top-1/2 -right-[18px] h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                                style={{ backgroundColor: '#38A1E5' }}
                                onMouseDown={(e) =>
                                  handleConnectionStart(
                                    e,
                                    node.id,
                                    `condition-${index}`,
                                  )
                                }
                              />
                            </div>
                          ),
                        )}
                        {/* Else condition */}
                        <div className="bg-muted/50 relative flex items-center justify-between rounded-lg px-4 py-3">
                          <span className="text-muted-foreground text-sm">
                            Else
                          </span>
                          <div
                            className="border-background absolute top-1/2 -right-[18px] h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                            style={{ backgroundColor: '#38A1E5' }}
                            onMouseDown={(e) =>
                              handleConnectionStart(e, node.id, 'else')
                            }
                          />
                        </div>
                      </div>

                      <div
                        className="border-background absolute top-1/2 -left-2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ backgroundColor: '#38A1E5' }}
                        onMouseDown={(e) =>
                          handleConnectionStart(e, node.id, 'left')
                        }
                      />
                    </div>
                  );
                })()
              ) : node.type === 'user-approval' ? (
                <div
                  className="border-border bg-card relative cursor-grab rounded-2xl border transition-colors hover:border-[#38A1E5] active:cursor-grabbing"
                  style={{ width: '280px' }}
                >
                  <div className="flex items-center gap-3 p-4 pb-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: 'rgba(56, 161, 229, 0.2)' }}
                    >
                      <ThumbsUp
                        className="h-5 w-5"
                        style={{ color: '#38A1E5' }}
                      />
                    </div>
                    <span className="text-foreground font-medium">
                      {node.data.label}
                    </span>
                  </div>
                  <div className="space-y-2 px-4 pb-4">
                    <div className="bg-muted/50 flex items-center justify-between rounded-lg px-4 py-3">
                      <span className="text-muted-foreground">Approve</span>
                      <div
                        className="border-background h-3 w-3 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ backgroundColor: '#38A1E5' }}
                        onMouseDown={(e) =>
                          handleConnectionStart(e, node.id, 'approve')
                        }
                      />
                    </div>
                    <div className="bg-muted/50 flex items-center justify-between rounded-lg px-4 py-3">
                      <span className="text-muted-foreground">Reject</span>
                      <div
                        className="border-background h-3 w-3 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ backgroundColor: '#38A1E5' }}
                        onMouseDown={(e) =>
                          handleConnectionStart(e, node.id, 'reject')
                        }
                      />
                    </div>
                  </div>

                  <div
                    className="border-background absolute top-1/2 -left-2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'left')
                    }
                  />
                </div>
              ) : node.type === 'transform' ||
                node.type === 'set-state' ||
                node.type === 'guardrails' ||
                node.type === 'file-search' ||
                node.type === 'mcp' ? (
                <div className="bg-card border-border relative min-w-[140px] cursor-grab rounded-xl border px-4 py-3 transition-colors hover:border-[#38A1E5] active:cursor-grabbing">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded"
                      style={{ backgroundColor: 'rgba(56, 161, 229, 0.2)' }}
                    >
                      <Bot className="h-3 w-3" style={{ color: '#38A1E5' }} />
                    </div>
                    <span className="text-foreground text-sm font-medium">
                      {node.data.label}
                    </span>
                  </div>

                  <div
                    className="border-background absolute top-1/2 -left-2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'left')
                    }
                  />
                  <div
                    className="border-background absolute top-1/2 -right-2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'right')
                    }
                  />
                  <div
                    className="border-background absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'top')
                    }
                  />
                  <div
                    className="border-background absolute -bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'bottom')
                    }
                  />
                </div>
              ) : node.type === 'note' ? (
                <div
                  className="border-border relative cursor-grab rounded-lg border bg-amber-50 transition-colors hover:border-[#38A1E5] active:cursor-grabbing dark:bg-amber-950/20"
                  style={{
                    width: `${node.width || 200}px`,
                    height: `${node.height || 120}px`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingNote(node.id);
                  }}
                >
                  {editingNote === node.id ? (
                    <Textarea
                      autoFocus
                      className="h-full w-full resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
                      value={node.data.content || ''}
                      onChange={(e) => {
                        setNodes((prev) =>
                          prev.map((n) =>
                            n.id === node.id
                              ? {
                                  ...n,
                                  data: { ...n.data, content: e.target.value },
                                }
                              : n,
                          ),
                        );
                      }}
                      onBlur={() => setEditingNote(null)}
                    />
                  ) : (
                    <div className="text-foreground p-3 text-sm whitespace-pre-wrap">
                      {node.data.content || 'Sticky Note'}
                    </div>
                  )}

                  <div
                    className="border-background absolute -right-1 -bottom-1 h-4 w-4 cursor-nwse-resize rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleResizeStart(e, node.id, 'bottom-right')
                    }
                  />
                </div>
              ) : (
                <div className="bg-card border-border relative min-w-[140px] cursor-grab rounded-xl border px-4 py-3 transition-colors hover:border-[#38A1E5] active:cursor-grabbing">
                  <div className="mb-1 flex items-center gap-2">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded"
                      style={{ backgroundColor: 'rgba(56, 161, 229, 0.2)' }}
                    >
                      <Bot className="h-3 w-3" style={{ color: '#38A1E5' }} />
                    </div>
                    <span className="text-foreground text-sm font-medium">
                      {node.data.label}
                    </span>
                    {node.type === 'mentor' && !previewMode && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="Change agent"
                              className="text-muted-foreground hover:text-foreground hover:bg-muted/60 ml-auto cursor-pointer rounded-full p-1 transition-colors"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMentorChangeClick(node.id);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Change agent</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  {node.data.subtitle && (
                    <p className="text-muted-foreground ml-7 text-xs">
                      {node.data.subtitle}
                    </p>
                  )}

                  <div
                    className="border-background absolute top-1/2 -left-2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'left')
                    }
                  />
                  <div
                    className="border-background absolute top-1/2 -right-2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'right')
                    }
                  />
                  <div
                    className="border-background absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'top')
                    }
                  />
                  <div
                    className="border-background absolute -bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 cursor-crosshair rounded-full border-2 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: '#38A1E5' }}
                    onMouseDown={(e) =>
                      handleConnectionStart(e, node.id, 'bottom')
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {!previewMode &&
          selectedNodeForConfig &&
          (() => {
            const node = nodes.find((n) => n.id === selectedNodeForConfig);
            return node && node.type !== 'mentor' ? (
              <NodeConfigPanel
                nodeId={node.id}
                nodeType={node.type || ''}
                nodeData={node.data}
                onClose={() => setSelectedNodeForConfig(null)}
                onUpdateNode={handleUpdateNode}
                org={org}
                defaultMentorId={defaultMentorId}
              />
            ) : null;
          })()}

        {!previewMode && (
          <Dialog
            open={showMentorModal}
            onOpenChange={(open) => {
              if (open) {
                setShowMentorModal(true);
              } else {
                closeMentorModal();
              }
            }}
          >
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Change agent</DialogTitle>
              </DialogHeader>
              <MentorSelectionGrid
                selectedMentorIds={selectedMentorIds}
                onMentorSelect={handleMentorSelect}
                searchQuery={mentorSearchQuery}
                onSearchChange={setMentorSearchQuery}
                minHeight="360px"
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!previewMode && (
        <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 transform">
          <div className="bg-card border-border flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg">
            <Button
              variant={tool === 'hand' ? 'default' : 'ghost'}
              size="icon"
              className={`h-8 w-8 ${tool === 'hand' ? 'bg-[#38A1E5] text-white hover:bg-[#38A1E5]' : ''}`}
              onClick={() => setTool('hand')}
            >
              <Hand className="h-4 w-4" />
            </Button>

            <Button
              variant={tool === 'pointer' ? 'default' : 'ghost'}
              size="icon"
              className={`h-8 w-8 ${tool === 'pointer' ? 'bg-[#38A1E5] text-white hover:bg-[#38A1E5]' : ''}`}
              onClick={() => setTool('pointer')}
            >
              <MousePointer className="h-4 w-4" />
            </Button>
            <div className="bg-border mx-1 h-6 w-px" />
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-8 w-8 disabled:opacity-30"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-8 w-8 disabled:opacity-30"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
              <Redo className="h-4 w-4" />
            </Button>
            <div className="bg-border mx-1 h-6 w-px" />
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-8 w-8"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground min-w-[3ch] text-center text-xs">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-8 w-8"
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
