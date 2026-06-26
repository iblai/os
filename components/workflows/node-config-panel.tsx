'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Copy,
  Plus,
  X,
  Trash2,
  Settings,
  Info,
  Plug,
  Cable,
} from 'lucide-react';
import {
  useGetMentorSettingsQuery,
  useGetToolsQuery,
} from '@iblai/iblai-js/data-layer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MentorSelectionGrid } from '@/components/mentors/mentor-selection-grid';
import { DatasetsTab } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab';
import WithFormPermissions from '@/hoc/withPermissions';
import { pushModal, popModal } from '@/features/navigation/slice';
import { useUsername } from '@/hooks/use-user';
import { useToggleTools } from '@/hooks/use-tools/use-toggle-tools';
import { useAppDispatch } from '@/lib/hooks';
import { McpTab } from '@/components/modals/edit-mentor-modal/tabs/mcp-tab';
import type { MCPServer } from '@iblai/iblai-js/data-layer';
import type { NodeConfig } from './workflow-canvas';

interface Variable {
  id: string;
  name: string;
  type: string;
  defaultValue?: string;
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

interface NodeConfigPanelProps {
  nodeId: string;
  nodeType: string;
  nodeData: NodeConfig;
  onClose: () => void;
  onUpdateNode?: (nodeId: string, updates: Partial<NodeConfig>) => void;
  org?: string;
  defaultMentorId?: string;
}

const DEFAULT_INSTRUCTIONS = 'You are a helpful assistant.';
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

export function NodeConfigPanel({
  nodeId,
  nodeType,
  nodeData,
  onClose,
  onUpdateNode,
  org,
  defaultMentorId,
}: NodeConfigPanelProps) {
  const t = useTranslations('workflowsNodeConfigPanel');
  const dispatch = useAppDispatch();

  // Initialize state from nodeData
  const [nodeName, setNodeName] = useState(nodeData.label);
  const [instructions, setInstructions] = useState(
    nodeData.instructions ?? DEFAULT_INSTRUCTIONS,
  );
  const [model, setModel] = useState(nodeData.model ?? '');
  const [continueOnError, setContinueOnError] = useState(
    nodeData.continueOnError ?? false,
  );

  const [inputVariables] = useState<Variable[]>([
    { id: '1', name: 'input_as_text', type: 'string' },
  ]);
  const [stateVariables, setStateVariables] = useState<Variable[]>(
    nodeData.stateVariables ?? [],
  );

  // Track if we're in the middle of a local update to avoid sync loops
  const isLocalUpdate = useRef(false);

  // Sync state with props when nodeData changes from external source
  // This handles cases where the workflow is reloaded from API
  useEffect(() => {
    // Skip if this update originated from our own local changes
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }

    // Sync all state values with incoming nodeData
    setNodeName(nodeData.label);
    setInstructions(nodeData.instructions ?? DEFAULT_INSTRUCTIONS);
    setModel(nodeData.model ?? '');
    setContinueOnError(nodeData.continueOnError ?? false);
    setStateVariables(nodeData.stateVariables ?? []);
    setConditions(
      nodeData.conditions ?? [{ id: '1', caseName: '', expression: '' }],
    );
    setWhileExpression(nodeData.whileExpression ?? '');
    setUserApprovalMessage(nodeData.userApprovalMessage ?? '');
    setTransformMode(nodeData.transformMode ?? 'expressions');
    setTransformExpressions(
      nodeData.transformExpressions ?? [
        { id: '1', key: 'result', value: 'input.foo + 1' },
      ],
    );
    setSetStateAssignments(
      nodeData.setStateAssignments ?? [
        { id: '1', value: 'input.foo + 1', variable: '' },
      ],
    );
    setMcpConnectors(nodeData.mcpConnectors ?? []);
    setDatasetId(nodeData.datasetId ?? '');
    setDatasetName(nodeData.datasetName ?? '');
    setMaxResults(nodeData.maxResults ?? 10);
    setFileSearchQuery(nodeData.fileSearchQuery ?? '');
  }, [nodeData]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<
    'String' | 'Number' | 'Boolean' | 'Object' | 'List'
  >('String');
  const [newVarName, setNewVarName] = useState('');
  const [newVarDefault, setNewVarDefault] = useState('');

  const [showMentorModal, setShowMentorModal] = useState(false);
  const [mentorSearchQuery, setMentorSearchQuery] = useState('');
  const [conditions, setConditions] = useState<Condition[]>(
    nodeData.conditions ?? [{ id: '1', caseName: '', expression: '' }],
  );

  const [whileExpression, setWhileExpression] = useState(
    nodeData.whileExpression ?? '',
  );
  const [userApprovalMessage, setUserApprovalMessage] = useState(
    nodeData.userApprovalMessage ?? '',
  );
  const [transformMode, setTransformMode] = useState<'expressions' | 'object'>(
    nodeData.transformMode ?? 'expressions',
  );
  const [transformExpressions, setTransformExpressions] = useState<
    TransformExpression[]
  >(
    nodeData.transformExpressions ?? [
      { id: '1', key: 'result', value: 'input.foo + 1' },
    ],
  );
  const [setStateAssignments, setSetStateAssignments] = useState<
    SetStateAssignment[]
  >(
    nodeData.setStateAssignments ?? [
      { id: '1', value: 'input.foo + 1', variable: '' },
    ],
  );

  const [showConnectorManagement, setShowConnectorManagement] = useState(false);
  const [mcpConnectors, setMcpConnectors] = useState<McpConnector[]>(
    nodeData.mcpConnectors ?? [],
  );

  // File-search node state
  const [datasetId, setDatasetId] = useState(nodeData.datasetId ?? '');
  const [datasetName, setDatasetName] = useState(nodeData.datasetName ?? '');
  const [maxResults, setMaxResults] = useState(nodeData.maxResults ?? 10);
  const [fileSearchQuery, setFileSearchQuery] = useState(
    nodeData.fileSearchQuery ?? '',
  );
  const [showDatasetDialog, setShowDatasetDialog] = useState(false);

  const username = useUsername();

  const selectedMentorId = nodeData.mentor_id ?? nodeData.entry_mentor_id;
  const shouldFetchMentorSettings = Boolean(
    nodeType === 'mentor' && selectedMentorId && org && username,
  );

  const { data: mentorSettings, isLoading: isMentorSettingsLoading } =
    useGetMentorSettingsQuery(
      {
        mentor: selectedMentorId ?? '',
        org: org ?? '',
      },
      { skip: !shouldFetchMentorSettings },
    );

  const { data: tools, isLoading: isToolsLoading } = useGetToolsQuery(
    {
      mentor: selectedMentorId ?? '',
      org: org ?? '',
    },
    { skip: !shouldFetchMentorSettings },
  );

  const mentorToolSlugs = Array.isArray(mentorSettings?.mentor_tools)
    ? mentorSettings?.mentor_tools
        .map((tool: { slug?: string }) => tool?.slug)
        .filter((slug: string | undefined): slug is string => Boolean(slug))
    : [];

  const { toggleTools, isLoading: isToggleToolsLoading } = useToggleTools({
    tools: mentorToolSlugs,
    activeMentorId: selectedMentorId ?? '',
    tenantKey: org ?? '',
    username: username ?? '',
  });

  const isToolsDisabled =
    !selectedMentorId ||
    !org ||
    !username ||
    isMentorSettingsLoading ||
    isToolsLoading ||
    isToggleToolsLoading;

  const forceMentorPrefill = useRef(false);

  // Helper to update node with new config
  const updateNodeConfig = useCallback(
    (updates: Partial<NodeConfig>) => {
      if (onUpdateNode) {
        // Mark that this is a local update to prevent sync effect from resetting state
        isLocalUpdate.current = true;
        onUpdateNode(nodeId, updates);
      }
    },
    [nodeId, onUpdateNode],
  );

  useEffect(() => {
    if (nodeType !== 'mentor' || !mentorSettings) return;

    const mentorName =
      mentorSettings.mentor_name ||
      mentorSettings.display_name ||
      nodeData.label;
    const mentorPrompt = (mentorSettings as Record<string, unknown>)
      .system_prompt as string | undefined;
    const mentorModel = mentorSettings.llm_name;
    const forcePrefill = forceMentorPrefill.current;

    const updates: Partial<NodeConfig> = {};

    if (mentorName && (forcePrefill || isDefaultMentorLabel(nodeData.label))) {
      if (mentorName !== nodeData.label) {
        setNodeName(mentorName);
        updates.label = mentorName;
      }
    }

    if (
      mentorPrompt &&
      (forcePrefill ||
        !nodeData.instructions ||
        nodeData.instructions === DEFAULT_INSTRUCTIONS)
    ) {
      if (mentorPrompt !== nodeData.instructions) {
        setInstructions(mentorPrompt);
        updates.instructions = mentorPrompt;
      }
    }

    if (mentorModel && mentorModel !== nodeData.model) {
      setModel(mentorModel);
      updates.model = mentorModel;
    }

    if (Object.keys(updates).length > 0) {
      updateNodeConfig(updates);
    }

    if (forcePrefill) {
      forceMentorPrefill.current = false;
    }
  }, [
    mentorSettings,
    nodeType,
    nodeData.label,
    nodeData.instructions,
    nodeData.model,
    updateNodeConfig,
  ]);

  const handleSaveVariable = () => {
    const newVar: Variable = {
      id: Date.now().toString(),
      name: newVarName,
      type: selectedType.toLowerCase(),
      defaultValue: newVarDefault || undefined,
    };
    const newStateVariables = [...stateVariables, newVar];
    setStateVariables(newStateVariables);
    updateNodeConfig({ stateVariables: newStateVariables });
    setShowAddModal(false);
    setNewVarName('');
    setNewVarDefault('');
    setSelectedType('String');
  };

  const handleNameChange = (newName: string) => {
    setNodeName(newName);
    updateNodeConfig({ label: newName });
  };

  const handleMentorSelect = (mentor: {
    unique_id?: string;
    name?: string;
  }) => {
    const mentorId = mentor.unique_id;
    if (!mentorId) return;

    forceMentorPrefill.current = true;
    const updates: Partial<NodeConfig> = {
      entry_mentor_id: mentorId,
      mentor_id: mentorId,
    };

    if (mentor.name) {
      setNodeName(mentor.name);
      updates.label = mentor.name;
    }

    updateNodeConfig(updates);
    setShowMentorModal(false);
    setMentorSearchQuery('');
  };

  const handleAddCondition = () => {
    const newCondition = {
      id: Date.now().toString(),
      caseName: '',
      expression: '',
    };
    const newConditions = [...conditions, newCondition];
    setConditions(newConditions);
    updateNodeConfig({
      conditions: newConditions,
      conditionCount: newConditions.length,
    });
  };

  const handleRemoveCondition = (id: string) => {
    const newConditions = conditions.filter((c) => c.id !== id);
    setConditions(newConditions);
    updateNodeConfig({
      conditions: newConditions,
      conditionCount: newConditions.length,
    });
  };

  const handleUpdateCondition = (id: string, updates: Partial<Condition>) => {
    const newConditions = conditions.map((c) =>
      c.id === id ? { ...c, ...updates } : c,
    );
    setConditions(newConditions);
    updateNodeConfig({ conditions: newConditions });
  };

  const handleAddTransformExpression = () => {
    const newExpressions = [
      ...transformExpressions,
      { id: Date.now().toString(), key: '', value: '' },
    ];
    setTransformExpressions(newExpressions);
    updateNodeConfig({ transformExpressions: newExpressions });
  };

  const handleRemoveTransformExpression = (id: string) => {
    if (transformExpressions.length > 1) {
      const newExpressions = transformExpressions.filter((e) => e.id !== id);
      setTransformExpressions(newExpressions);
      updateNodeConfig({ transformExpressions: newExpressions });
    }
  };

  const handleUpdateTransformExpression = (
    id: string,
    updates: Partial<TransformExpression>,
  ) => {
    const newExpressions = transformExpressions.map((e) =>
      e.id === id ? { ...e, ...updates } : e,
    );
    setTransformExpressions(newExpressions);
    updateNodeConfig({ transformExpressions: newExpressions });
  };

  const handleAddSetStateAssignment = () => {
    const newAssignments = [
      ...setStateAssignments,
      { id: Date.now().toString(), value: '', variable: '' },
    ];
    setSetStateAssignments(newAssignments);
    updateNodeConfig({ setStateAssignments: newAssignments });
  };

  const handleRemoveSetStateAssignment = (id: string) => {
    if (setStateAssignments.length > 1) {
      const newAssignments = setStateAssignments.filter((a) => a.id !== id);
      setSetStateAssignments(newAssignments);
      updateNodeConfig({ setStateAssignments: newAssignments });
    }
  };

  const handleUpdateSetStateAssignment = (
    id: string,
    updates: Partial<SetStateAssignment>,
  ) => {
    const newAssignments = setStateAssignments.map((a) =>
      a.id === id ? { ...a, ...updates } : a,
    );
    setSetStateAssignments(newAssignments);
    updateNodeConfig({ setStateAssignments: newAssignments });
  };

  const handleRemoveConnector = (connectorId: string) => {
    const newConnectors = mcpConnectors.filter((c) => c.id !== connectorId);
    setMcpConnectors(newConnectors);
    updateNodeConfig({ mcpConnectors: newConnectors });
  };

  // Handlers for mentor node config changes
  const handleInstructionsChange = (value: string) => {
    setInstructions(value);
    updateNodeConfig({ instructions: value });
  };

  const handleContinueOnErrorChange = (value: boolean) => {
    setContinueOnError(value);
    updateNodeConfig({ continueOnError: value });
  };

  const handleWhileExpressionChange = (value: string) => {
    setWhileExpression(value);
    updateNodeConfig({ whileExpression: value });
  };

  const handleUserApprovalMessageChange = (value: string) => {
    setUserApprovalMessage(value);
    updateNodeConfig({ userApprovalMessage: value });
  };

  const handleTransformModeChange = (value: 'expressions' | 'object') => {
    setTransformMode(value);
    updateNodeConfig({ transformMode: value });
  };

  if (nodeType === 'start') {
    return (
      <>
        <div
          className="bg-card border-border absolute top-4 right-4 z-20 flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <h3 className="text-foreground text-base font-semibold">
                    {t('startTitle')}
                  </h3>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Copy className="text-muted-foreground h-3 w-3" />
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  {t('startDescription')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Input Variables */}
            <div className="space-y-1.5">
              <h4 className="text-foreground text-xs font-medium">
                {t('inputVariables')}
              </h4>
              <div className="space-y-1">
                {inputVariables.map((variable) => (
                  <div
                    key={variable.id}
                    className="bg-muted/50 border-border flex items-center justify-between rounded-lg border p-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-3.5 w-3.5 items-center justify-center rounded bg-green-500/20">
                        <span className="font-mono text-[10px] text-green-500">
                          =
                        </span>
                      </div>
                      <span className="text-foreground font-mono text-xs">
                        {variable.name}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {variable.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* State Variables */}
            <div className="space-y-1.5">
              <h4 className="text-foreground text-xs font-medium">
                {t('stateVariables')}
              </h4>
              <div className="space-y-1">
                {stateVariables.map((variable) => (
                  <div
                    key={variable.id}
                    className="bg-muted/50 border-border flex items-center justify-between rounded-lg border p-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-3.5 w-3.5 items-center justify-center rounded bg-purple-500/20">
                        <span className="font-mono text-[10px] text-purple-500">
                          $
                        </span>
                      </div>
                      <span className="text-foreground font-mono text-xs">
                        {variable.name}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {variable.type}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 w-full text-xs"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                {t('addButton')}
              </Button>
            </div>
          </div>
        </div>

        {/* Add Variable Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent
            className="bg-card sm:max-w-[500px]"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle className="sr-only">
                {t('addStateVariableDialogTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              {/* Type Selection */}
              <div className="bg-muted flex gap-2 rounded-lg p-1">
                {(
                  ['String', 'Number', 'Boolean', 'Object', 'List'] as const
                ).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type);
                      // Reset default value when type changes to avoid invalid data
                      if (type === 'Boolean') {
                        setNewVarDefault('false');
                      } else if (type === 'Number') {
                        setNewVarDefault('');
                      } else if (type === 'Object') {
                        setNewVarDefault('{}');
                      } else if (type === 'List') {
                        setNewVarDefault('[]');
                      } else {
                        setNewVarDefault('');
                      }
                    }}
                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      selectedType === type
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Name Input */}
              <div className="space-y-2">
                <Label htmlFor="var-name" className="text-sm font-medium">
                  {t('nameLabel')}
                </Label>
                <Input
                  id="var-name"
                  placeholder={t('variableNamePlaceholder')}
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>

              {/* Default Value Input - Dynamic based on type */}
              <div className="space-y-2">
                <Label htmlFor="var-default" className="text-sm font-medium">
                  {t('defaultValueLabel')}{' '}
                  <span className="text-muted-foreground font-normal">
                    {t('defaultValueOptional')}
                  </span>
                </Label>
                {selectedType === 'Boolean' ? (
                  <div className="bg-muted border-border flex items-center gap-3 rounded-lg border p-3">
                    <Switch
                      id="var-default"
                      checked={newVarDefault === 'true'}
                      onCheckedChange={(checked) =>
                        setNewVarDefault(checked ? 'true' : 'false')
                      }
                    />
                    <span className="text-muted-foreground text-sm">
                      {newVarDefault === 'true'
                        ? t('booleanTrue')
                        : t('booleanFalse')}
                    </span>
                  </div>
                ) : selectedType === 'Number' ? (
                  <Input
                    id="var-default"
                    type="number"
                    placeholder="0"
                    value={newVarDefault}
                    onChange={(e) => setNewVarDefault(e.target.value)}
                    className="bg-muted border-border"
                  />
                ) : selectedType === 'Object' ? (
                  <Textarea
                    id="var-default"
                    placeholder='{ "key": "value" }'
                    value={newVarDefault}
                    onChange={(e) => setNewVarDefault(e.target.value)}
                    className="bg-muted border-border min-h-[100px] font-mono text-sm"
                  />
                ) : selectedType === 'List' ? (
                  <Textarea
                    id="var-default"
                    placeholder='["item1", "item2"]'
                    value={newVarDefault}
                    onChange={(e) => setNewVarDefault(e.target.value)}
                    className="bg-muted border-border min-h-[100px] font-mono text-sm"
                  />
                ) : (
                  <Input
                    id="var-default"
                    placeholder={t('defaultValueStringPlaceholder')}
                    value={newVarDefault}
                    onChange={(e) => setNewVarDefault(e.target.value)}
                    className="bg-muted border-border"
                  />
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveVariable}
                  disabled={!newVarName}
                  className="bg-background hover:bg-muted text-foreground border-border border"
                >
                  {t('saveButton')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (nodeType === 'mentor') {
    const modelDisplay = mentorSettings?.llm_provider
      ? `${mentorSettings.llm_provider}${model ? ` · ${model}` : ''}`
      : model;
    const enabledToolSlugs = new Set(mentorToolSlugs);

    return (
      <>
        <div
          className="bg-card border-border absolute top-4 right-4 z-[22] flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-foreground mb-0.5 text-base font-semibold">
                  {nodeData.label}
                </h3>
                <p className="text-muted-foreground text-[11px]">
                  {t('mentorDescription')}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Copy className="text-muted-foreground h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onClose}
                >
                  <X className="text-muted-foreground h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Name Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-[11px] font-medium">
                  {t('nameLabel')}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setShowMentorModal(true)}
                >
                  {selectedMentorId ? t('changeButton') : t('selectButton')}
                </Button>
              </div>
              <Input
                value={nodeName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="bg-muted border-border h-8 text-sm"
              />
              {!selectedMentorId && (
                <p className="text-muted-foreground text-[10px]">
                  {t('selectAgentHint')}
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="space-y-1">
              <Label className="text-foreground text-[11px] font-medium">
                {t('instructionsLabel')}
              </Label>
              <Textarea
                value={instructions}
                onChange={(e) => handleInstructionsChange(e.target.value)}
                className="bg-muted border-border min-h-[80px] resize-none text-xs"
              />
            </div>

            {/* Model */}
            <div className="space-y-1">
              <Label className="text-foreground text-[11px] font-medium">
                {t('modelLabel')}
              </Label>
              <Input
                value={modelDisplay}
                readOnly
                placeholder={
                  selectedMentorId
                    ? isMentorSettingsLoading
                      ? t('loadingModelPlaceholder')
                      : t('noModelConfiguredPlaceholder')
                    : t('selectAgentModelPlaceholder')
                }
                className="bg-muted border-border h-8 text-sm"
              />
            </div>

            {/* Tools */}
            <div className="space-y-1">
              <Label className="text-foreground text-[11px] font-medium">
                {t('toolsLabel')}
              </Label>
              {!selectedMentorId && (
                <p className="text-muted-foreground text-[10px]">
                  {t('selectAgentToolsHint')}
                </p>
              )}
              {selectedMentorId &&
                (isToolsLoading || isMentorSettingsLoading) && (
                  <p className="text-muted-foreground text-[10px]">
                    {t('loadingTools')}
                  </p>
                )}
              {selectedMentorId && !isToolsLoading && tools?.length === 0 && (
                <p className="text-muted-foreground text-[10px]">
                  {t('noToolsAvailable')}
                </p>
              )}
              {selectedMentorId && !isToolsLoading && tools?.length ? (
                <WithFormPermissions
                  name="mentor_tools"
                  // @ts-ignore
                  permissions={mentorSettings?.permissions?.field}
                >
                  {({ disabled }) => (
                    <div className="space-y-1">
                      {tools?.map((tool) => {
                        const slug = tool?.slug ?? '';
                        const toolLabel =
                          tool?.display_name || tool?.name || 'Tool';
                        const isEnabled = enabledToolSlugs.has(slug);
                        const isDisabled = isToolsDisabled || disabled || !slug;

                        return (
                          <div
                            key={slug || toolLabel}
                            className="bg-muted/50 border-border flex items-center justify-between rounded-lg border p-1.5"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-foreground text-xs">
                                {toolLabel}
                              </span>
                              {tool?.description ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger
                                      aria-label={t('toolInfoAriaLabel', {
                                        toolLabel,
                                      })}
                                    >
                                      <Info className="text-muted-foreground h-3 w-3" />
                                    </TooltipTrigger>
                                    <TooltipContent className="ibl-tooltip-content">
                                      <p>{tool?.description}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : null}
                            </div>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={() => {
                                if (!slug || isDisabled) return;
                                toggleTools(slug);
                              }}
                              disabled={isDisabled}
                              aria-label={t('toolSwitchAriaLabel', {
                                toolLabel,
                                status: isEnabled
                                  ? t('toolEnabled')
                                  : t('toolDisabled'),
                              })}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </WithFormPermissions>
              ) : null}
            </div>
          </div>
        </div>

        <Dialog
          open={showMentorModal}
          onOpenChange={(open) => {
            setShowMentorModal(open);
            if (!open) {
              setMentorSearchQuery('');
            }
          }}
        >
          <DialogContent
            className="w-[95vw] max-w-7xl gap-0 overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DialogHeader className="border-b border-gray-200 bg-white px-6 py-4">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {t('selectAgentDialogTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 py-4">
              <MentorSelectionGrid
                selectedMentorIds={selectedMentorId ? [selectedMentorId] : []}
                onMentorSelect={handleMentorSelect}
                searchQuery={mentorSearchQuery}
                onSearchChange={setMentorSearchQuery}
                itemsPerPage={8}
                showSearch={true}
                minHeight="400px"
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (nodeType === 'guardrails') {
    return (
      <div
        className="bg-card border-border absolute top-4 right-4 z-[22] flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-foreground mb-0.5 text-base font-semibold">
                {nodeData.label}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {t('guardrailsDescription')}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Copy className="text-muted-foreground h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Name Field */}
          <div className="space-y-1">
            <Label className="text-foreground text-[11px] font-medium">
              {t('nameLabel')}
            </Label>
            <Input
              value={nodeName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="bg-muted border-border h-8 text-sm"
            />
          </div>

          {/* Input Field */}
          <div className="space-y-1">
            <Label className="text-foreground text-[11px] font-medium">
              {t('inputLabel')}
            </Label>
            <div className="bg-muted border-border flex items-center gap-2 rounded-lg border p-2">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-green-500/20">
                <span className="font-mono text-[10px] text-green-500">=</span>
              </div>
              <span className="text-foreground font-mono text-xs">
                input_as_text
              </span>
              <Select defaultValue="STRING">
                <SelectTrigger className="bg-background border-border ml-auto h-6 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STRING">STRING</SelectItem>
                  <SelectItem value="NUMBER">NUMBER</SelectItem>
                  <SelectItem value="BOOLEAN">BOOLEAN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Guardrail Options */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-1">
                <Label className="text-foreground text-[11px] font-medium">
                  {t('piiLabel')}
                </Label>
                <Info className="text-muted-foreground h-3 w-3" />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Settings className="text-muted-foreground h-3 w-3" />
                </Button>
                <Switch />
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-1">
                <Label className="text-foreground text-[11px] font-medium">
                  {t('moderationLabel')}
                </Label>
                <Info className="text-muted-foreground h-3 w-3" />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Settings className="text-muted-foreground h-3 w-3" />
                </Button>
                <Switch />
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-1">
                <Label className="text-foreground text-[11px] font-medium">
                  {t('jailbreakLabel')}
                </Label>
                <Info className="text-muted-foreground h-3 w-3" />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Settings className="text-muted-foreground h-3 w-3" />
                </Button>
                <Switch />
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-1">
                <Label className="text-foreground text-[11px] font-medium">
                  {t('hallucinationLabel')}
                </Label>
                <Info className="text-muted-foreground h-3 w-3" />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Settings className="text-muted-foreground h-3 w-3" />
                </Button>
                <Switch />
              </div>
            </div>
          </div>

          {/* Continue on error */}
          <div className="border-border flex items-center justify-between border-t py-1 pt-2">
            <Label className="text-foreground text-[11px] font-medium">
              {t('continueOnErrorLabel')}
            </Label>
            <Switch
              checked={continueOnError}
              onCheckedChange={handleContinueOnErrorChange}
            />
          </div>
        </div>
      </div>
    );
  }

  if (nodeType === 'file-search') {
    const handleDatasetSelect = (dataset: {
      id: string;
      document_name: string;
      url: string;
    }) => {
      const name = dataset.document_name || dataset.url;
      setDatasetId(dataset.id);
      setDatasetName(name);
      updateNodeConfig({ datasetId: dataset.id, datasetName: name });
      setShowDatasetDialog(false);
    };

    const handleMaxResultsChange = (value: string) => {
      const num = parseInt(value, 10);
      const val = isNaN(num) ? 10 : num;
      setMaxResults(val);
      updateNodeConfig({ maxResults: val });
    };

    const handleFileSearchQueryChange = (value: string) => {
      setFileSearchQuery(value);
      updateNodeConfig({ fileSearchQuery: value });
    };

    const openDatasetDialog = () => {
      // Push mentor context so DatasetsTab (via useDatasetsWithPagination -> getMentorId())
      // and its AddResourceModal both use the entry_mentor_id
      if (defaultMentorId) {
        dispatch(
          pushModal({ name: 'SELECT_DATASET', mentorId: defaultMentorId }),
        );
      }
      setShowDatasetDialog(true);
    };

    const closeDatasetDialog = () => {
      setShowDatasetDialog(false);
      // Clean up the mentor context we pushed
      dispatch(popModal(undefined));
    };

    return (
      <>
        <div
          className="bg-card border-border absolute top-4 right-4 z-[22] flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-foreground mb-0.5 text-base font-semibold">
                  {nodeData.label}
                </h3>
                <p className="text-muted-foreground text-[11px]">
                  {t('fileSearchDescription')}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Copy className="text-muted-foreground h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onClose}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Dataset */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-[11px] font-medium">
                  {t('datasetLabel')}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={openDatasetDialog}
                >
                  {datasetId ? t('changeButton') : t('selectButton')}
                </Button>
              </div>
              {datasetId ? (
                <p className="text-foreground bg-muted truncate rounded-md px-2 py-1.5 text-xs">
                  {datasetName}
                </p>
              ) : (
                <p className="text-muted-foreground text-[10px]">
                  {t('selectDatasetHint')}
                </p>
              )}
            </div>

            {/* Max results */}
            <div className="space-y-1">
              <Label className="text-foreground text-[11px] font-medium">
                {t('maxResultsLabel')}
              </Label>
              <Input
                type="number"
                value={maxResults}
                onChange={(e) => handleMaxResultsChange(e.target.value)}
                className="bg-muted border-border h-8 text-sm"
              />
            </div>

            {/* Query */}
            <div className="space-y-1">
              <Label className="text-foreground text-[11px] font-medium">
                {t('queryLabel')}
              </Label>
              <Textarea
                value={fileSearchQuery}
                onChange={(e) => handleFileSearchQueryChange(e.target.value)}
                placeholder={t('fileSearchQueryPlaceholder')}
                className="bg-muted border-border min-h-[100px] resize-none text-xs"
              />
            </div>
          </div>
        </div>

        {/* Dataset Selection Dialog - reuses existing DatasetsTab component */}
        <Dialog
          open={showDatasetDialog}
          onOpenChange={(open) => {
            if (!open) closeDatasetDialog();
          }}
        >
          <DialogContent
            className="flex max-h-[80vh] w-[90vw] max-w-3xl flex-col gap-0 overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{t('selectDatasetDialogTitle')}</DialogTitle>
            </DialogHeader>
            <DatasetsTab
              onSelect={handleDatasetSelect}
              selectedDatasetId={datasetId}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (nodeType === 'mcp') {
    const openMcpDialog = () => {
      if (defaultMentorId) {
        dispatch(pushModal({ name: 'SELECT_MCP', mentorId: defaultMentorId }));
      }
      setShowConnectorManagement(true);
    };

    const closeMcpDialog = () => {
      setShowConnectorManagement(false);
      dispatch(popModal(undefined));
    };

    const handleMcpSelect = (server: MCPServer) => {
      const serverId = String(server.id);
      if (mcpConnectors.some((c) => c.id === serverId)) {
        closeMcpDialog();
        return;
      }
      const newConnector: McpConnector = {
        id: serverId,
        name: server.name,
        icon: server.image || undefined,
      };
      const newConnectors = [...mcpConnectors, newConnector];
      setMcpConnectors(newConnectors);
      updateNodeConfig({ mcpConnectors: newConnectors });
      closeMcpDialog();
    };

    return (
      <>
        <div
          className="bg-card border-border absolute top-4 right-4 z-[22] flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-foreground mb-0.5 text-base font-semibold">
                  {nodeData.label}
                </h3>
                <p className="text-muted-foreground text-[11px]">
                  {t('mcpDescription')}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Copy className="text-muted-foreground h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onClose}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {mcpConnectors.length === 0 ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="flex items-center gap-3">
                  <div className="border-border flex h-16 w-16 items-center justify-center rounded-2xl border bg-white shadow-sm">
                    <Plug className="h-8 w-8 text-[#38A1E5]" />
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#38A1E5] shadow-sm">
                    <Cable className="h-8 w-8 text-white" />
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={openMcpDialog}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {t('addButton')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground text-[11px] font-medium">
                    {t('connectedToolsLabel')}
                  </Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={openMcpDialog}
                  >
                    <Plus className="text-muted-foreground h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {mcpConnectors.map((connector) => (
                    <div
                      key={connector.id}
                      className="bg-muted/50 border-border flex items-center justify-between rounded-lg border p-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="bg-background flex h-6 w-6 items-center justify-center rounded">
                          {connector.icon ? (
                            <img
                              src={connector.icon}
                              alt={connector.name}
                              className="h-4 w-4 object-contain"
                            />
                          ) : (
                            <span className="text-sm">🔌</span>
                          )}
                        </div>
                        <span className="text-foreground text-xs">
                          {connector.name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={() => handleRemoveConnector(connector.id)}
                      >
                        <X className="text-muted-foreground h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Dialog
          open={showConnectorManagement}
          onOpenChange={(open) => {
            if (!open) closeMcpDialog();
          }}
        >
          <DialogContent
            className="flex max-h-[80vh] w-[90vw] max-w-4xl flex-col gap-0 overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{t('selectMcpDialogTitle')}</DialogTitle>
            </DialogHeader>
            <McpTab onSelect={handleMcpSelect} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // While node configuration panel
  if (nodeType === 'while') {
    return (
      <div
        className="bg-card border-border absolute top-4 right-4 z-[22] flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-foreground mb-0.5 text-base font-semibold">
                {nodeData.label}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {t('whileDescription')}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Copy className="text-muted-foreground h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-foreground text-[11px] font-medium">
              {t('expressionLabel')}
            </Label>
            <Textarea
              value={whileExpression}
              onChange={(e) => handleWhileExpressionChange(e.target.value)}
              placeholder="input.foo == 5"
              className="bg-muted border-border min-h-[100px] resize-none font-mono text-xs"
            />
            <p className="text-muted-foreground text-[10px]">
              {t('celHintFull')}{' '}
              <a href="#" className="underline">
                {t('learnMore')}
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // User Approval node configuration panel
  if (nodeType === 'user-approval') {
    return (
      <div
        className="bg-card border-border absolute top-4 right-4 z-[22] flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-foreground mb-0.5 text-base font-semibold">
                {nodeData.label}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {t('userApprovalDescription')}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Copy className="text-muted-foreground h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-foreground text-[11px] font-medium">
              {t('nameLabel')}
            </Label>
            <Input
              value={nodeName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="bg-muted border-border h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-foreground text-[11px] font-medium">
              {t('messageLabel')}
            </Label>
            <Textarea
              value={userApprovalMessage}
              onChange={(e) => handleUserApprovalMessageChange(e.target.value)}
              placeholder={t('approvalMessagePlaceholder')}
              className="bg-muted border-border min-h-[120px] resize-none text-xs"
            />
          </div>
        </div>
      </div>
    );
  }

  // Transform node configuration panel
  if (nodeType === 'transform') {
    return (
      <div
        className="bg-card border-border absolute top-4 right-4 z-[22] flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-foreground mb-0.5 text-base font-semibold">
                {nodeData.label}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {t('transformDescription')}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Copy className="text-muted-foreground h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-foreground text-[11px] font-medium">
              {t('nameLabel')}
            </Label>
            <Input
              value={nodeName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="bg-muted border-border h-8 text-sm"
            />
          </div>

          {/* Mode Toggle */}
          <div className="bg-muted flex gap-1 rounded-lg p-0.5">
            <button
              onClick={() => handleTransformModeChange('expressions')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                transformMode === 'expressions'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('expressionsMode')}
            </button>
            <button
              onClick={() => handleTransformModeChange('object')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                transformMode === 'object'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('objectMode')}
            </button>
          </div>

          {transformMode === 'expressions' ? (
            <div className="space-y-2">
              {transformExpressions.map((expr) => (
                <div
                  key={expr.id}
                  className="border-border bg-muted/30 space-y-1.5 rounded-lg border p-2"
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground text-[10px] font-medium">
                      {t('keyLabel')}
                    </Label>
                    {transformExpressions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={() => handleRemoveTransformExpression(expr.id)}
                      >
                        <Trash2 className="text-muted-foreground h-2.5 w-2.5" />
                      </Button>
                    )}
                  </div>
                  <Input
                    value={expr.key}
                    onChange={(e) =>
                      handleUpdateTransformExpression(expr.id, {
                        key: e.target.value,
                      })
                    }
                    placeholder="result"
                    className="bg-background border-border h-7 text-xs"
                  />
                  <Label className="text-foreground text-[10px] font-medium">
                    {t('valueLabel')}
                  </Label>
                  <Textarea
                    value={expr.value}
                    onChange={(e) =>
                      handleUpdateTransformExpression(expr.id, {
                        value: e.target.value,
                      })
                    }
                    placeholder="input.foo + 1"
                    className="bg-background border-border min-h-[60px] font-mono text-xs"
                  />
                  <p className="text-muted-foreground text-[9px]">
                    {t('celHintShort')}{' '}
                    <a href="#" className="underline">
                      {t('learnMore')}
                    </a>
                  </p>
                </div>
              ))}

              <Button
                variant="secondary"
                size="sm"
                className="h-7 w-full text-xs"
                onClick={handleAddTransformExpression}
              >
                <Plus className="mr-1 h-3 w-3" />
                {t('addButton')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-7 w-full text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                {t('addSchemaButton')}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Set State node configuration panel
  if (nodeType === 'set-state') {
    return (
      <div
        className="bg-card border-border absolute top-4 right-4 z-[22] flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-foreground mb-0.5 text-base font-semibold">
                {nodeData.label}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {t('setStateDescription')}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Copy className="text-muted-foreground h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {setStateAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="border-border bg-muted/30 space-y-1.5 rounded-lg border p-2"
              >
                <div className="flex items-center justify-between">
                  <Label className="text-foreground text-[10px] font-medium">
                    {t('assignValueLabel')}
                  </Label>
                  {setStateAssignments.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={() =>
                        handleRemoveSetStateAssignment(assignment.id)
                      }
                    >
                      <Trash2 className="text-muted-foreground h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={assignment.value}
                  onChange={(e) =>
                    handleUpdateSetStateAssignment(assignment.id, {
                      value: e.target.value,
                    })
                  }
                  placeholder="input.foo + 1"
                  className="bg-background border-border min-h-[60px] font-mono text-xs"
                />
                <p className="text-muted-foreground text-[9px]">
                  {t('celHintShort')}{' '}
                  <a href="#" className="underline">
                    {t('learnMore')}
                  </a>
                </p>
                <Label className="text-foreground text-[10px] font-medium">
                  {t('toVariableLabel')}
                </Label>
                <div className="flex gap-1">
                  <Select
                    value={assignment.variable}
                    onValueChange={(value) =>
                      handleUpdateSetStateAssignment(assignment.id, {
                        variable: value,
                      })
                    }
                  >
                    <SelectTrigger className="bg-background border-border h-7 flex-1 text-xs">
                      <SelectValue placeholder={t('selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="var1">{t('variable1')}</SelectItem>
                      <SelectItem value="var2">{t('variable2')}</SelectItem>
                      <SelectItem value="var3">{t('variable3')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 bg-transparent px-2 text-xs"
                  >
                    <Plus className="mr-0.5 h-2.5 w-2.5" />
                    {t('newButton')}
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={handleAddSetStateAssignment}
            >
              <Plus className="mr-1 h-3 w-3" />
              {t('addButton')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (nodeType === 'if-else' || nodeType === 'conditional') {
    return (
      <div
        className="bg-card border-border absolute top-4 right-4 z-[22] flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-foreground mb-0.5 text-base font-semibold">
                {nodeData.label}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {t('ifElseDescription')}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Copy className="text-muted-foreground h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Conditions */}
          {conditions.map((condition, index) => (
            <div
              key={condition.id}
              className="bg-muted/30 border-border space-y-2 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-[11px] font-medium">
                  {index === 0
                    ? t('conditionIf')
                    : t('conditionElseIf', { index })}
                </Label>
                {conditions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => handleRemoveCondition(condition.id)}
                  >
                    <Trash2 className="text-muted-foreground h-3 w-3" />
                  </Button>
                )}
              </div>
              <Input
                placeholder={t('caseNamePlaceholder')}
                className="bg-background border-border h-8 text-sm"
                value={condition.caseName}
                onChange={(e) =>
                  handleUpdateCondition(condition.id, {
                    caseName: e.target.value,
                  })
                }
              />
              <Textarea
                placeholder={t('conditionPlaceholder')}
                className="bg-background border-border min-h-[60px] resize-none text-xs"
                value={condition.expression}
                onChange={(e) =>
                  handleUpdateCondition(condition.id, {
                    expression: e.target.value,
                  })
                }
              />
            </div>
          ))}

          <p className="text-muted-foreground text-[10px]">
            {t('celHintFull')}{' '}
            <a href="#" className="underline">
              {t('learnMore')}
            </a>
          </p>

          <Button
            variant="secondary"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={handleAddCondition}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('addButton')}
          </Button>
        </div>
      </div>
    );
  }

  if (nodeType === 'end') {
    return (
      <div
        className="bg-card border-border absolute top-4 right-4 z-[22] flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-foreground mb-0.5 text-base font-semibold">
                {nodeData.label}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {t('endDescription')}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Copy className="text-muted-foreground h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Output */}
          <div className="space-y-1">
            <Label className="text-foreground text-[11px] font-medium">
              {t('outputLabel')}
            </Label>
            <Textarea
              placeholder={t('outputPlaceholder')}
              className="bg-muted border-border min-h-[100px] resize-none text-xs"
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
