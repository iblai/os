'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft,
  MoreHorizontal,
  Eye,
  X,
  RotateCcw,
  Pencil,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Power,
  Trash2,
} from 'lucide-react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { WorkflowPreviewChat } from '@/components/workflows/workflow-preview-chat';
import {
  WorkflowCanvas,
  type ReactFlowJsonObject,
} from '@/components/workflows';
import {
  WorkflowSidebar,
  DeleteWorkflowModal,
  type NodeTypeSection,
} from '@iblai/iblai-js/web-containers';
import {
  useGetWorkflowQuery,
  usePatchWorkflowMutation,
  usePublishWorkflowMutation,
  useDeactivateWorkflowMutation,
  useDeleteWorkflowMutation,
  useValidateWorkflowMutation,
  useActivateWorkflowMutation,
  useGetNodeTypesQuery,
  useLazyGetMentorSettingsQuery,
  type NodeTypesResponse,
  type WorkflowValidationResponse,
} from '@iblai/iblai-js/data-layer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import { useAppSelector } from '@/lib/hooks';
import { useUsername } from '@/hooks/use-user';

// Category display names and order
const categoryConfig: Record<string, { title: string; order: number }> = {
  core: { title: 'Core', order: 1 },
  tools: { title: 'Tools', order: 2 },
  logic: { title: 'Logic', order: 3 },
  data: { title: 'Data', order: 4 },
};

// Override category mapping for specific nodes to match UI design
const nodeCategoryOverride: Record<string, string> = {
  note: 'core', // API has it in 'visual' but UI shows it in 'Core'
};

// Transform API node types response to sidebar format
function transformNodeTypesToSections(
  nodeTypes: NodeTypesResponse | undefined,
): NodeTypeSection[] | undefined {
  if (!nodeTypes?.node_types) return undefined;

  const categoryMap = new Map<string, NodeTypeSection>();

  // Initialize standard categories
  Object.entries(categoryConfig).forEach(([catId, config]) => {
    categoryMap.set(catId, { title: config.title, items: [] });
  });

  // Add node types to their categories (node_types is an object keyed by node ID)
  Object.entries(nodeTypes.node_types).forEach(([nodeId, nodeInfo]) => {
    // Skip 'start' as it's auto-added by default
    if (nodeId === 'start') return;

    // Use override category if defined, otherwise use the API category
    const targetCategory = nodeCategoryOverride[nodeId] || nodeInfo.category;
    const section = categoryMap.get(targetCategory);
    if (section) {
      section.items.push({
        id: nodeId,
        label: nodeInfo.label,
        category: targetCategory,
      });
    }
  });

  // Sort categories by order and filter out empty ones
  return Array.from(categoryMap.entries())
    .sort(
      ([a], [b]) =>
        (categoryConfig[a]?.order ?? 99) - (categoryConfig[b]?.order ?? 99),
    )
    .map(([, section]) => section)
    .filter((section) => section.items.length > 0);
}

export default function WorkflowDetailPage() {
  const router = useRouter();
  const params = useParams<{
    tenantKey: string;
    mentorId: string;
    id: string;
  }>();
  const searchParams = useSearchParams();
  const listMentorId = searchParams.get('listMentorId') || params.mentorId;
  const workflowId = params.id;
  const username = useUsername();

  const {
    data: workflow,
    isLoading,
    error,
  } = useGetWorkflowQuery(
    { org: params.tenantKey, uniqueId: workflowId },
    { skip: !params.tenantKey || !workflowId },
  );
  const entryMentorId =
    (workflow as { entrymentorid?: string } | undefined)?.entrymentorid ??
    workflow?.entry_mentor_id;

  const { data: nodeTypesData } = useGetNodeTypesQuery(
    { org: params.tenantKey },
    { skip: !params.tenantKey },
  );

  const [mentorSettingsById, setMentorSettingsById] = useState<
    Record<string, Record<string, unknown> | null>
  >({});
  const [isMentorSettingsLoading, setIsMentorSettingsLoading] = useState(false);
  const [fetchMentorSettings] = useLazyGetMentorSettingsQuery();

  const mentorIdsFromDefinition = useMemo(() => {
    const ids = new Set<string>();
    const nodes = (workflow?.definition?.nodes ?? []) as Array<
      Record<string, unknown>
    >;
    nodes.forEach((node) => {
      if (node.type !== 'mentor') return;
      const nodeData = node.data as Record<string, unknown> | undefined;
      const mentorId =
        (nodeData?.mentor_id as string | undefined) ||
        (nodeData?.entry_mentor_id as string | undefined) ||
        entryMentorId;
      if (mentorId) {
        ids.add(mentorId);
      }
    });
    return Array.from(ids);
  }, [workflow?.definition?.nodes, entryMentorId]);

  const missingMentorIds = useMemo(
    () =>
      mentorIdsFromDefinition.filter(
        (mentorId) =>
          !Object.prototype.hasOwnProperty.call(mentorSettingsById, mentorId),
      ),
    [mentorIdsFromDefinition, mentorSettingsById],
  );

  useEffect(() => {
    if (!params.tenantKey || !username || missingMentorIds.length === 0) return;
    let isActive = true;
    setIsMentorSettingsLoading(true);

    Promise.all(
      missingMentorIds.map(async (mentorId) => {
        try {
          const data = (await fetchMentorSettings({
            mentor: mentorId,
            org: params.tenantKey,
          }).unwrap()) as Record<string, unknown>;
          return { mentorId, data };
        } catch {
          return { mentorId, data: null };
        }
      }),
    )
      .then((results) => {
        if (!isActive) return;
        setMentorSettingsById((prev) => {
          const next = { ...prev };
          results.forEach(({ mentorId, data }) => {
            next[mentorId] = data;
          });
          return next;
        });
      })
      .finally(() => {
        if (isActive) {
          setIsMentorSettingsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [missingMentorIds, fetchMentorSettings, params.tenantKey, username]);

  const isWaitingForMentorSettings =
    mentorIdsFromDefinition.length > 0 &&
    (!username || missingMentorIds.length > 0 || isMentorSettingsLoading);

  const [patchWorkflow, { isLoading: isSaving }] = usePatchWorkflowMutation();
  const [publishWorkflow, { isLoading: isPublishing }] =
    usePublishWorkflowMutation();
  const [deactivateWorkflow] = useDeactivateWorkflowMutation();
  const [validateWorkflow] = useValidateWorkflowMutation();
  const [activateWorkflow, { isLoading: isActivating }] =
    useActivateWorkflowMutation();
  const [deleteWorkflow, { isLoading: isDeleting }] =
    useDeleteWorkflowMutation();

  const [workflowName, setWorkflowName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{
    id: string;
    label: string;
    type: string;
  } | null>(null);
  const [clickedItem, setClickedItem] = useState<{
    id: string;
    label: string;
    type: string;
  } | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [workflowData, setWorkflowData] = useState<ReactFlowJsonObject | null>(
    null,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [isValidationBannerOpen, setIsValidationBannerOpen] = useState(true);
  const isInitialLoad = useRef(true);
  const { activeTab: _activeTab, chats: _chats } = useAppSelector(
    (state) => state.chatSliceShared,
  );

  // Debounce workflow data for auto-save
  const [debouncedWorkflowData] = useDebounce(workflowData, 1000);

  // Transform node types for sidebar
  const nodeTypeSections = useMemo(
    () => transformNodeTypesToSections(nodeTypesData),
    [nodeTypesData],
  );

  useEffect(() => {
    if (workflow) {
      setWorkflowName(workflow.name);
    }
  }, [workflow]);

  // Track initial workflow data to compare against for auto-save
  const initialWorkflowDataRef = useRef<string | null>(null);

  // Set initial workflow data reference when workflow loads
  useEffect(() => {
    if (workflow?.definition && initialWorkflowDataRef.current === null) {
      initialWorkflowDataRef.current = JSON.stringify({
        nodes: workflow.definition.nodes,
        edges: workflow.definition.edges,
      });
    }
  }, [workflow]);

  // Auto-save on debounced workflow data change
  useEffect(() => {
    if (!debouncedWorkflowData || !workflow) {
      return;
    }

    // Skip if this is the initial load (data matches what we loaded from server)
    const currentDataStr = JSON.stringify({
      nodes: debouncedWorkflowData.nodes,
      edges: debouncedWorkflowData.edges,
    });

    if (isInitialLoad.current) {
      // Check if current data matches initial data
      if (currentDataStr === initialWorkflowDataRef.current) {
        isInitialLoad.current = false;
        return;
      }
      isInitialLoad.current = false;
    }

    // Skip if data matches the initial loaded data (no real changes)
    if (currentDataStr === initialWorkflowDataRef.current) {
      return;
    }

    const autoSave = async () => {
      try {
        const patchData: Parameters<typeof patchWorkflow>[0]['data'] = {
          definition: {
            nodes: debouncedWorkflowData.nodes,
            edges: debouncedWorkflowData.edges,
          },
        };

        await patchWorkflow({
          org: params.tenantKey,
          uniqueId: workflowId,
          data: patchData,
        }).unwrap();
        setHasUnsavedChanges(false);
        // Update the reference to the saved data
        initialWorkflowDataRef.current = currentDataStr;

        // Validate after successful save
        try {
          const result = await validateWorkflow({
            org: params.tenantKey,
            uniqueId: workflowId,
          }).unwrap();
          if (result.errors.length > 0 || result.warnings.length > 0) {
            setValidationResult({
              errors: result.errors,
              warnings: result.warnings,
            });
            setIsValidationBannerOpen(true);
          } else {
            setValidationResult(null);
          }
        } catch {
          // Silent fail for validation
        }
      } catch {
        // Silent fail for auto-save, user can manually save
      }
    };

    autoSave();
  }, [
    debouncedWorkflowData,
    workflow,
    params.tenantKey,
    workflowId,
    patchWorkflow,
    validateWorkflow,
  ]);

  const handleItemClick = (item: {
    id: string;
    label: string;
    type: string;
  }) => {
    setClickedItem(item);
    setTimeout(() => setClickedItem(null), 100);
  };

  const handlePreviewClick = () => {
    setPreviewKey((k) => k + 1);
    setIsPreviewMode(true);
  };
  const handleClosePreview = () => setIsPreviewMode(false);
  const handleNewChat = () => eventBus.emit(RemoteEvents.newChat);

  const handleWorkflowStateChange = useCallback(
    (state: ReactFlowJsonObject) => {
      setWorkflowData(state);
      setHasUnsavedChanges(true);
    },
    [],
  );

  const handleNameSave = async () => {
    setIsEditingName(false);
    if (workflow && workflowName !== workflow.name) {
      try {
        await patchWorkflow({
          org: params.tenantKey,
          uniqueId: workflowId,
          data: { name: workflowName },
        }).unwrap();
        toast.success('Workflow name updated');
      } catch {
        toast.error('Failed to update name');
        setWorkflowName(workflow.name);
      }
    }
  };

  const handleSave = async () => {
    if (!workflowData) return;
    try {
      const patchData: Parameters<typeof patchWorkflow>[0]['data'] = {
        definition: { nodes: workflowData.nodes, edges: workflowData.edges },
      };

      await patchWorkflow({
        org: params.tenantKey,
        uniqueId: workflowId,
        data: patchData,
      }).unwrap();
      setHasUnsavedChanges(false);
      toast.success('Workflow saved');
    } catch {
      toast.error('Failed to save workflow');
    }
  };

  const handlePublish = async () => {
    const data = workflowData
      ? { definition: { nodes: workflowData.nodes, edges: workflowData.edges } }
      : undefined;
    try {
      await publishWorkflow({
        org: params.tenantKey,
        uniqueId: workflowId,
        data,
      }).unwrap();
      setHasUnsavedChanges(false);
      setValidationResult(null);
      toast.success('Workflow published');
    } catch (err: unknown) {
      const errorData = (err as { data?: unknown })?.data;
      if (
        errorData &&
        typeof errorData === 'object' &&
        'is_valid' in errorData
      ) {
        const validation = errorData as WorkflowValidationResponse;
        setValidationResult({
          errors: validation.errors,
          warnings: validation.warnings,
        });
        setIsValidationBannerOpen(true);
        toast.error('Workflow has validation issues');
      } else {
        toast.error('Failed to publish workflow');
      }
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateWorkflow({
        org: params.tenantKey,
        uniqueId: workflowId,
      }).unwrap();
      toast.success('Workflow deactivated');
    } catch {
      toast.error('Failed to deactivate workflow');
    }
  };

  const handleActivate = async () => {
    try {
      const result = await activateWorkflow({
        org: params.tenantKey,
        uniqueId: workflowId,
      }).unwrap();
      if (result.is_valid) {
        setValidationResult(null);
        toast.success('Workflow activated');
      } else {
        setValidationResult({
          errors: result.errors,
          warnings: result.warnings,
        });
        setIsValidationBannerOpen(true);
        toast.error('Workflow has validation issues');
      }
    } catch (err: unknown) {
      const errorData = (err as { data?: unknown })?.data;
      if (
        errorData &&
        typeof errorData === 'object' &&
        'is_valid' in errorData
      ) {
        const validation = errorData as WorkflowValidationResponse;
        setValidationResult({
          errors: validation.errors,
          warnings: validation.warnings,
        });
        setIsValidationBannerOpen(true);
        toast.error('Workflow has validation issues');
      } else {
        toast.error('Failed to activate workflow');
      }
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteWorkflow({
        org: params.tenantKey,
        uniqueId: workflowId,
      }).unwrap();
      toast.success('Workflow deleted');
      setIsDeleteModalOpen(false);
      router.push(`/platform/${params.tenantKey}/workflows/${listMentorId}`);
    } catch {
      toast.error('Failed to delete workflow');
    }
  };

  // Show loading spinner while workflow is loading OR while mentor details are being fetched
  if (isLoading || isWaitingForMentorSettings) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <p className="mb-4 text-gray-600">Failed to load workflow</p>
          <Button variant="outline" onClick={() => router.back()}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const initialNodes = (
    (workflow.definition?.nodes ?? []) as Array<Record<string, unknown>>
  ).map((n) => {
    const nodeData = n.data as Record<string, unknown>;

    // For mentor nodes, prefill with mentor settings if available
    if (n.type === 'mentor') {
      const mentorId =
        (nodeData?.mentor_id as string | undefined) ||
        (nodeData?.entry_mentor_id as string | undefined) ||
        entryMentorId;
      const mentorData = mentorId ? mentorSettingsById[mentorId] : null;
      return {
        ...n,
        draggable: true,
        selectable: true,
        connectable: true,
        data: {
          ...nodeData,
          ...(mentorId ? { entry_mentor_id: mentorId } : {}),
          // Prefill from mentor settings - prioritize mentor data over default node data
          ...(mentorData && {
            label:
              (mentorData.display_name as string) ||
              (mentorData.mentor_name as string) ||
              nodeData?.label,
            instructions:
              (mentorData.system_prompt as string) || nodeData?.instructions,
            model: (mentorData.llm_name as string) || nodeData?.model,
          }),
        },
      };
    }

    return {
      ...n,
      draggable: true,
      selectable: true,
      connectable: true,
    };
  }) as Parameters<typeof WorkflowCanvas>[0]['initialNodes'];
  const initialEdges = (workflow.definition?.edges ?? []) as Parameters<
    typeof WorkflowCanvas
  >[0]['initialEdges'];

  return (
    <div className="flex h-screen flex-col bg-white">
      <div
        className={`flex items-center justify-between px-4 py-3 ${isPreviewMode ? 'border-b border-gray-200 bg-white' : 'bg-background border-border border-b'}`}
      >
        <div className="flex items-center gap-3">
          {isPreviewMode ? (
            <div className="flex items-center gap-2">
              <h1 className="text-foreground font-medium">{workflowName}</h1>
              <span
                className={`rounded-md px-2 py-0.5 text-xs ${workflow.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}
              >
                {workflow.is_active ? 'Active' : 'Draft'}
              </span>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => router.back()}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <Input
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                    className="text-foreground h-8 w-[200px] font-medium"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-foreground hover:text-foreground/80 flex items-center gap-1 font-medium"
                    aria-label="Edit workflow name"
                  >
                    {workflowName}
                    <Pencil className="h-3 w-3 opacity-50" />
                  </button>
                )}
                <span
                  className={`rounded-md px-2 py-0.5 text-xs ${workflow.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}
                >
                  {workflow.is_active ? 'Active' : 'Draft'}
                </span>
                {hasUnsavedChanges && (
                  <span className="text-muted-foreground text-xs">Unsaved</span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isPreviewMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground hover:text-foreground hover:bg-gray-100"
                onClick={handleClosePreview}
              >
                <X className="mr-2 h-4 w-4" />
                Close preview
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground hover:text-foreground hover:bg-gray-100"
                onClick={handleNewChat}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                New Chat
              </Button>
              <Button
                size="sm"
                className="bg-[#38A1E5] text-white hover:bg-[#38A1E5]/90"
                onClick={handlePublish}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Publish'
                )}
              </Button>
            </>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="More workflow options"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {workflow.is_active ? (
                    <DropdownMenuItem onClick={handleDeactivate}>
                      <Power className="mr-2 h-4 w-4" />
                      Deactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={handleActivate}
                      disabled={isActivating}
                    >
                      <Power className="mr-2 h-4 w-4" />
                      {isActivating ? 'Activating...' : 'Activate'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="text-foreground border-border hover:bg-accent bg-transparent"
                onClick={handlePreviewClick}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button
                size="sm"
                className="bg-[#38A1E5] text-white hover:bg-[#38A1E5]/90"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
              <Button
                size="sm"
                className="bg-[#38A1E5] text-white hover:bg-[#38A1E5]/90"
                onClick={handlePublish}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Publish'
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Validation Banner */}
      {validationResult &&
        (validationResult.errors.length > 0 ||
          validationResult.warnings.length > 0) && (
          <Collapsible
            open={isValidationBannerOpen}
            onOpenChange={setIsValidationBannerOpen}
          >
            <div className="border-border bg-background border-b px-4 py-2">
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {validationResult.errors.length > 0 ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span
                      className={
                        validationResult.errors.length > 0
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }
                    >
                      {validationResult.errors.length > 0 &&
                        `${validationResult.errors.length} error${validationResult.errors.length !== 1 ? 's' : ''}`}
                      {validationResult.errors.length > 0 &&
                        validationResult.warnings.length > 0 &&
                        ', '}
                      {validationResult.warnings.length > 0 &&
                        `${validationResult.warnings.length} warning${validationResult.warnings.length !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isValidationBannerOpen ? (
                      <ChevronUp className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <ChevronDown className="text-muted-foreground h-4 w-4" />
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setValidationResult(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          setValidationResult(null);
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-1 pb-1">
                  {validationResult.errors.map((error, i) => (
                    <div
                      key={`error-${i}`}
                      className="flex items-start gap-2 text-sm text-red-600"
                    >
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ))}
                  {validationResult.warnings.map((warning, i) => (
                    <div
                      key={`warning-${i}`}
                      className="flex items-start gap-2 text-sm text-amber-600"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

      <div className="flex flex-1 overflow-hidden">
        {!isPreviewMode && (
          <WorkflowSidebar
            onDragStart={setDraggedItem}
            onItemClick={handleItemClick}
            nodeTypes={nodeTypeSections}
          />
        )}

        <div
          className={
            isPreviewMode
              ? 'h-full w-[60%] border-r border-gray-200'
              : 'h-full flex-1'
          }
        >
          <WorkflowCanvas
            onDraggedItem={isPreviewMode ? null : draggedItem}
            onClickedItem={isPreviewMode ? null : clickedItem}
            previewMode={isPreviewMode}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onStateChange={handleWorkflowStateChange}
            org={params.tenantKey}
            defaultMentorId={entryMentorId}
          />
        </div>

        {isPreviewMode && (
          <div className="flex h-full w-[40%] flex-col bg-white">
            <WorkflowPreviewChat
              key={previewKey}
              tenantKey={params.tenantKey}
              mentorId={entryMentorId}
            />
          </div>
        )}
      </div>

      <DeleteWorkflowModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        workflowName={workflow.name}
      />
    </div>
  );
}
