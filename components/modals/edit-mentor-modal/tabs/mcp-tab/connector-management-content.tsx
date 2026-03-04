'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Plug,
  Calendar,
  Edit,
  ChevronsUpDown,
  Check,
  Trash2,
  Link2,
  Unlink,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { ConnectorDialogs } from '@/components/modals/edit-mentor-modal/tabs/mcp-tab/connector-dialogs';
import { useLocalStorage } from '@/hooks/use-local-storage';
import {
  useGetMCPServersQuery,
  useCreateMCPServerMutation,
  useUpdateMCPServerMutation,
  useDeleteMCPServerMutation,
  useGetMentorSettingsQuery,
  useEditMentorJsonMutation,
  useLazyStartOAuthFlowQuery,
  useDisconnectServiceMutation,
  useCreateMCPServerConnectionMutation,
  useGetConnectedServicesQuery,
  useGetMCPServerConnectionsQuery,
} from '@iblai/iblai-js/data-layer';
import type {
  MCPServer,
  GetMCPServersParams,
  ConnectedService,
  MCPServerConnection,
} from '@iblai/iblai-js/data-layer';
import { TransportEnum } from '@iblai/iblai-api';
import { toast } from 'sonner';
import { Spinner } from '@/components/spinner';
import { DialogHeader } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import IblPagination from '@/components/ibl-pagination';
import WithFormPermissions, { WithPermissions } from '@/hoc/withPermissions';

interface ConnectorManagementContentProps {
  tenantKey: string;
  username: string;
  mentorId: string;
}

// Type for pending OAuth server data stored in localStorage
interface PendingOAuthServer {
  serverId: number;
  provider: string;
  service: string;
  timestamp: number;
}

export const MCP_SERVER_PERMISSION_NAME = 'server';

export const TRANSPORT_OPTIONS: Array<{ value: '' | TransportEnum; label: string }> = [
  { value: '', label: 'All Transports' },
  { value: TransportEnum.SSE, label: 'SSE' },
  { value: TransportEnum.WEBSOCKET, label: 'WebSocket' },
  { value: TransportEnum.STREAMABLE_HTTP, label: 'Streamable HTTP' },
];

export const getTransportLabel = (transport?: TransportEnum | string | null): string => {
  const normalized = transport?.toString().toLowerCase();
  const option = TRANSPORT_OPTIONS.find((opt) => {
    const optVal = opt.value ? opt.value.toString().toLowerCase() : '';
    return optVal === '' ? !normalized : optVal === normalized;
  });
  return option?.label || transport?.toString() || 'Streamable HTTP';
};

export const normalizeTransportValue = (transport?: string | TransportEnum): TransportEnum => {
  const normalized = transport?.toString().toLowerCase();
  if (normalized === TransportEnum.SSE) return TransportEnum.SSE;
  if (normalized === TransportEnum.WEBSOCKET) return TransportEnum.WEBSOCKET;
  return TransportEnum.STREAMABLE_HTTP;
};

/**
 * Finds the active MCP server connection for a given server, accounting for scope rules.
 * - tenant scope: any connection for this server ID means connected
 * - user scope: connection must match the current user
 * - mentor scope: connection must match the current mentor being edited
 */
export const findMCPServerConnection = (
  connections: MCPServerConnection[] | undefined,
  serverId: number,
  currentUser: string,
  currentMentorId: string,
): MCPServerConnection | null => {
  if (!connections?.length) return null;

  const active = connections.filter((c) => c.server === serverId && c.is_active);

  for (const conn of active) {
    if (conn.scope === 'tenant') return conn;
    if (conn.scope === 'user' && conn.user === currentUser) return conn;
    if (conn.scope === 'mentor' && conn.mentor === currentMentorId) return conn;
  }

  return null;
};

// Helper to create FormData for MCP server
export const createMCPServerFormData = (data: {
  name: string;
  url: string;
  transport: string;
  description?: string;
  credentials?: string;
  auth_type?: string;
  auth_scope?: string;
  image?: File;
  mentor?: string | null;
}): FormData => {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('url', data.url);
  formData.append('transport', data.transport);
  if (data.description) formData.append('description', data.description);
  if (data.auth_type) formData.append('auth_type', data.auth_type);
  if (data.auth_scope) formData.append('auth_scope', data.auth_scope);
  if (data.credentials) formData.append('credentials', data.credentials);
  if (data.image) formData.append('image', data.image);
  if (data.mentor !== undefined) formData.append('mentor', data.mentor ?? '');
  return formData;
};

// OAuth flow helper types
export interface OAuthConnectionParams {
  connectedServiceId: number;
  isCreatingConnection: boolean;
  createMCPServerConnection: (params: {
    org: string;
    userId: string;
    server: number;
    scope: string;
    auth_type: string;
    user?: string;
    connected_service: number;
    mentor?: string | null;
  }) => { unwrap: () => Promise<unknown> };
  tenantKey: string;
  username: string;
  serverId: number;
  authScope?: string;
  mentorId?: string;
  oauthDisplayName: string;
  refetchFeatured: () => Promise<unknown>;
  refetchMy: () => Promise<unknown>;
  refetchConnected: () => Promise<unknown>;
  refetchMCPServerConnections: () => Promise<unknown>;
  refetchMentorSettings: () => Promise<unknown>;
}

// Helper to validate and create OAuth connection
export const createOAuthConnection = async (
  params: OAuthConnectionParams,
  onSuccess: () => void,
  onError: (error: unknown) => void,
): Promise<boolean> => {
  const {
    connectedServiceId,
    isCreatingConnection,
    createMCPServerConnection,
    tenantKey,
    username,
    serverId,
    authScope,
    mentorId,
    oauthDisplayName,
    refetchFeatured,
    refetchMy,
    refetchConnected,
    refetchMCPServerConnections,
    refetchMentorSettings,
  } = params;

  if (isCreatingConnection || !connectedServiceId || !Number.isFinite(connectedServiceId)) {
    return false;
  }

  const scope = authScope || 'user';

  try {
    await createMCPServerConnection({
      org: tenantKey,
      userId: username,
      server: serverId,
      scope,
      auth_type: 'oauth2',
      ...(scope !== 'mentor' ? { user: username } : {}),
      connected_service: connectedServiceId,
      ...(scope === 'mentor' && mentorId ? { mentor: mentorId } : {}),
    }).unwrap();

    await Promise.all([
      refetchFeatured(),
      refetchMy(),
      refetchConnected(),
      refetchMCPServerConnections(),
      refetchMentorSettings(),
    ]);

    toast.success(`${oauthDisplayName} connected successfully`);
    onSuccess();
    return true;
  } catch (error: unknown) {
    const err = error as { data?: { detail?: string } };
    toast.error(`Failed to create connection: ${err?.data?.detail || 'Unknown error'}`);
    onError(error);
    return false;
  }
};

// Helper to process OAuth storage events
export const processOAuthStorageEvent = (
  event: StorageEvent,
  expectedProvider: string,
  expectedServiceName: string,
): { connectedServiceId: number; isMatch: boolean } | null => {
  if (event.key !== 'oauth_connection_complete') {
    return null;
  }

  try {
    const data = JSON.parse(event.newValue || '{}');
    if (data.connectedServiceId) {
      const isMatch =
        data.provider === expectedProvider && data.serviceName === expectedServiceName;
      return { connectedServiceId: data.connectedServiceId, isMatch };
    }
  } catch {
    // Invalid JSON, return null to trigger fallback
  }
  return null;
};

// Helper to process OAuth message events
export const processOAuthMessageEvent = (
  event: MessageEvent,
  expectedOrigin: string,
  expectedProvider: string,
  expectedServiceName: string,
): number | null => {
  if (event.origin !== expectedOrigin) {
    return null;
  }

  if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data?.connectedServiceId) {
    if (
      event.data.provider === expectedProvider &&
      event.data.serviceName === expectedServiceName
    ) {
      return event.data.connectedServiceId;
    }
  }
  return null;
};

// Helper to check if OAuth connection is complete
export const checkOAuthConnectionComplete = async (
  refetchConnected: () => Promise<{ data?: ConnectedService[] }>,
  provider: string,
  serviceName: string,
): Promise<number | null> => {
  try {
    const updated = await refetchConnected();
    if (updated?.data) {
      const connService = updated.data.find(
        (cs) => cs.provider === provider && cs.service === serviceName,
      );
      if (connService?.id) {
        return connService.id;
      }
    }
  } catch {
    // Continue polling on error
  }
  return null;
};

// Helper to handle OAuth message event result and determine if connection should be created
export const handleOAuthMessageResult = (
  event: MessageEvent,
  expectedOrigin: string,
  expectedProvider: string,
  expectedServiceName: string,
): { shouldCreate: boolean; connectedServiceId: number | null } => {
  const connectedServiceId = processOAuthMessageEvent(
    event,
    expectedOrigin,
    expectedProvider,
    expectedServiceName,
  );
  return {
    shouldCreate: connectedServiceId !== null && connectedServiceId > 0,
    connectedServiceId,
  };
};

// Helper to validate OAuth disconnect parameters
export interface DisconnectValidationResult {
  isValid: boolean;
  error: string | null;
  connectedServiceId: number | null;
}

export const validateDisconnectOAuthParams = (
  tenantKey: string | undefined,
  username: string | undefined,
  connectedServiceId: number | null,
): DisconnectValidationResult => {
  if (!tenantKey || !username) {
    return {
      isValid: false,
      error: 'Missing required parameters',
      connectedServiceId: null,
    };
  }

  if (!connectedServiceId) {
    return {
      isValid: false,
      error: 'No connected service to disconnect',
      connectedServiceId: null,
    };
  }

  return {
    isValid: true,
    error: null,
    connectedServiceId,
  };
};

// Helper for checkConnection flow result
export interface CheckConnectionFlowResult {
  action: 'create_and_cleanup' | 'continue_polling' | 'max_polls_cleanup' | 'skip';
  connectedServiceId: number | null;
}

// Determines the action to take in checkConnection based on the current state
export const determineCheckConnectionAction = (
  isCreatingConnection: boolean,
  connectedServiceId: number | null,
  createConnectionSuccess: boolean,
  pollCount: number,
  maxPolls: number,
): CheckConnectionFlowResult => {
  if (isCreatingConnection) {
    return { action: 'skip', connectedServiceId: null };
  }

  if (connectedServiceId && createConnectionSuccess) {
    return { action: 'create_and_cleanup', connectedServiceId };
  }

  if (pollCount >= maxPolls) {
    return { action: 'max_polls_cleanup', connectedServiceId: null };
  }

  return { action: 'continue_polling', connectedServiceId };
};

// Helper for message event flow result
export interface MessageEventFlowResult {
  action: 'create_and_cleanup' | 'ignore';
  connectedServiceId: number | null;
}

// Determines the action to take after processing a message event
export const determineMessageEventAction = (
  shouldCreate: boolean,
  connectedServiceId: number | null,
): MessageEventFlowResult => {
  if (shouldCreate && connectedServiceId) {
    return { action: 'create_and_cleanup', connectedServiceId };
  }
  return { action: 'ignore', connectedServiceId: null };
};

// Helper to check if cleanup should happen after check connection
export const shouldCleanupAfterCheckConnection = (
  actionResult: CheckConnectionFlowResult,
): boolean => {
  return actionResult.action === 'create_and_cleanup';
};

// Helper to check if max polls cleanup should happen
export const shouldCleanupAtMaxPolls = (actionResult: CheckConnectionFlowResult): boolean => {
  return actionResult.action === 'max_polls_cleanup';
};

// Helper to check if message event should trigger cleanup and create
export const shouldExecuteMessageAction = (actionResult: MessageEventFlowResult): boolean => {
  return actionResult.action === 'create_and_cleanup' && actionResult.connectedServiceId !== null;
};

// Flow execution result types
export interface FlowExecutionResult {
  executed: boolean;
  action: string;
  connectedServiceId?: number | null;
}

// Execute the check connection flow logic - returns what action was taken
export const executeCheckConnectionFlowLogic = (
  connectedServiceId: number | null,
  createConnectionSuccess: boolean,
  pollCount: number,
  maxPolls: number,
): FlowExecutionResult => {
  // Determine if we should create and cleanup
  if (connectedServiceId && createConnectionSuccess) {
    return {
      executed: true,
      action: 'create_and_cleanup',
      connectedServiceId,
    };
  }

  // Check if max polls reached
  if (pollCount >= maxPolls) {
    return {
      executed: true,
      action: 'max_polls_cleanup',
      connectedServiceId: null,
    };
  }

  return {
    executed: false,
    action: 'continue_polling',
    connectedServiceId: null,
  };
};

// Execute the message event flow logic - returns what action was taken
export const executeMessageEventFlowLogic = (
  event: MessageEvent,
  expectedOrigin: string,
  expectedProvider: string,
  expectedServiceName: string,
): FlowExecutionResult => {
  const { shouldCreate, connectedServiceId } = handleOAuthMessageResult(
    event,
    expectedOrigin,
    expectedProvider,
    expectedServiceName,
  );

  const actionResult = determineMessageEventAction(shouldCreate, connectedServiceId);

  if (shouldExecuteMessageAction(actionResult)) {
    return {
      executed: true,
      action: 'create_and_cleanup',
      connectedServiceId: actionResult.connectedServiceId,
    };
  }

  return {
    executed: false,
    action: 'ignore',
    connectedServiceId: null,
  };
};

// Helper to handle the message event callback body logic
// This is extracted to be testable separately from the component
export interface HandleMessageCallbackParams {
  event: MessageEvent;
  expectedOrigin: string;
  provider: string;
  serviceName: string;
  cleanup: () => void;
  doCreateConnection: (connectedServiceId: number) => Promise<boolean>;
}

export const executeHandleMessageCallback = async (
  params: HandleMessageCallbackParams,
): Promise<{ executed: boolean; connectedServiceId: number | null }> => {
  const flowResult = executeMessageEventFlowLogic(
    params.event,
    params.expectedOrigin,
    params.provider,
    params.serviceName,
  );
  if (flowResult.executed && flowResult.connectedServiceId) {
    params.cleanup();
    await params.doCreateConnection(flowResult.connectedServiceId);
    return { executed: true, connectedServiceId: flowResult.connectedServiceId };
  }
  return { executed: false, connectedServiceId: null };
};

// Helper to handle max polls cleanup logic
export interface MaxPollsCheckParams {
  pollCount: number;
  maxPolls: number;
  cleanup: () => void;
}

export const executeMaxPollsCleanup = (params: MaxPollsCheckParams): boolean => {
  const maxPollsFlowResult = executeCheckConnectionFlowLogic(
    null,
    false,
    params.pollCount,
    params.maxPolls,
  );
  if (maxPollsFlowResult.executed) {
    params.cleanup();
    return true;
  }
  return false;
};

// Helper to handle the connection found during polling scenario
export interface ConnectionFoundParams {
  connectedServiceId: number;
  doCreateConnection: (id: number) => Promise<boolean>;
  pollCount: number;
  maxPolls: number;
  cleanup: () => void;
}

export const executeConnectionFoundCleanup = async (
  params: ConnectionFoundParams,
): Promise<{ cleaned: boolean; success: boolean }> => {
  const success = await params.doCreateConnection(params.connectedServiceId);
  const flowResult = executeCheckConnectionFlowLogic(
    params.connectedServiceId,
    success,
    params.pollCount,
    params.maxPolls,
  );
  if (flowResult.executed) {
    params.cleanup();
    return { cleaned: true, success };
  }
  return { cleaned: false, success };
};

export function ConnectorManagementContent({
  tenantKey,
  username,
  mentorId,
}: ConnectorManagementContentProps) {
  const itemsPerPage = 12;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedTransport, setSelectedTransport] = useState<'' | TransportEnum>('');

  // Pagination state
  const [featuredPage, setFeaturedPage] = useState(1);
  const [myConnectorsPage, setMyConnectorsPage] = useState(1);

  // Dialog state
  const [showAddConnectorDialog, setShowAddConnectorDialog] = useState(false);
  const [deletingServerId, setDeletingServerId] = useState<number | null>(null);
  const [connectorToDelete, setConnectorToDelete] = useState<{ id: number; name: string } | null>(
    null,
  );
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [togglingServerIds, setTogglingServerIds] = useState<Set<number>>(() => new Set());
  const [connectingServiceIds, setConnectingServiceIds] = useState<Set<string>>(() => new Set());
  const [disconnectingServiceIds, setDisconnectingServiceIds] = useState<Set<number>>(
    () => new Set(),
  );

  // Use localStorage hook for pending OAuth server data
  const [, setPendingOAuthServer, removePendingOAuthServer] =
    useLocalStorage<PendingOAuthServer | null>('oauth_pending_server', null);

  // Reset to first page when filters change
  useEffect(() => {
    setFeaturedPage(1);
    setMyConnectorsPage(1);
  }, [searchQuery, dateRange, selectedTransport]);

  // Build query params
  const buildQueryParams = useCallback(
    (page: number, isFeatured: boolean): GetMCPServersParams => ({
      org: tenantKey,
      userId: username,
      pageSize: itemsPerPage,
      page,
      isFeatured,
      mentorUniqueId: mentorId,
      includeGlobal: true,
      ...(searchQuery && { search: searchQuery }),
      ...(selectedTransport && { transport: selectedTransport }),
    }),
    [tenantKey, username, mentorId, searchQuery, selectedTransport],
  );

  // API hooks
  const {
    data: featuredServers,
    isLoading: isLoadingFeatured,
    error: featuredError,
    refetch: refetchFeatured,
  } = useGetMCPServersQuery(buildQueryParams(featuredPage, true), {
    skip: !tenantKey || !username,
  });

  const {
    data: myServers,
    isLoading: isLoadingMy,
    error: myError,
    refetch: refetchMy,
  } = useGetMCPServersQuery(buildQueryParams(myConnectorsPage, false), {
    skip: !tenantKey || !username,
  });

  const { data: mentorSettings, refetch: refetchMentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-expect-error userId is not part of useGetMentorSettingsQuery Query definition
      userId: username,
    },
    { skip: !username },
  );

  const { refetch: refetchConnected } = useGetConnectedServicesQuery(
    { org: tenantKey, userId: username },
    { skip: !tenantKey || !username },
  );

  const { data: mcpServerConnections, refetch: refetchMCPServerConnections } =
    useGetMCPServerConnectionsQuery(
      { org: tenantKey, userId: username },
      { skip: !tenantKey || !username },
    );

  // Mutations
  const [createMCPServer] = useCreateMCPServerMutation();
  const [updateMCPServer] = useUpdateMCPServerMutation();
  const [deleteMCPServer] = useDeleteMCPServerMutation();
  const [editMentorJson] = useEditMentorJsonMutation();
  const [startOAuthFlow] = useLazyStartOAuthFlowQuery();
  const [disconnectService] = useDisconnectServiceMutation();
  const [createMCPServerConnection] = useCreateMCPServerConnectionMutation();

  // Get active MCP server IDs from mentor settings
  const activeMcpServerIds = useMemo(() => {
    if (!mentorSettings || typeof mentorSettings !== 'object') return [] as number[];
    const maybeServers = (mentorSettings as { mcp_servers?: unknown }).mcp_servers;
    if (!Array.isArray(maybeServers)) return [] as number[];
    return maybeServers
      .map((entry) => {
        if (typeof entry === 'number' && Number.isFinite(entry)) return entry;
        if (typeof entry === 'object' && entry !== null && 'id' in entry) {
          const id = (entry as { id?: unknown }).id;
          if (typeof id === 'number') return id;
        }
        return null;
      })
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
  }, [mentorSettings]);

  // Get current tool_slugs from mentor_tools in mentor settings
  // mentor_tools is an array of objects like: [{ name: "MCP", slug: "mcp", ... }]
  const currentToolSlugs = useMemo(() => {
    if (!mentorSettings || typeof mentorSettings !== 'object') return [] as string[];
    const maybeTools = (mentorSettings as { mentor_tools?: unknown }).mentor_tools;
    if (!Array.isArray(maybeTools)) return [] as string[];
    return maybeTools
      .map((tool) => {
        if (typeof tool === 'object' && tool !== null && 'slug' in tool) {
          const slug = (tool as { slug?: unknown }).slug;
          if (typeof slug === 'string') return slug;
        }
        return null;
      })
      .filter((slug): slug is string => typeof slug === 'string');
  }, [mentorSettings]);

  // Field-level permissions from mentor settings (for mcp_servers write check)
  const fieldPermissions = (
    mentorSettings as {
      permissions?: {
        field?: Record<string, { read?: boolean; write: boolean; delete?: boolean }>;
      };
    }
  )?.permissions?.field;

  // OAuth helpers — use mcp-server-connections endpoint for scope-aware detection
  const isOAuthServerConnected = useCallback(
    (server: MCPServer): boolean => {
      const connection = findMCPServerConnection(
        mcpServerConnections?.results,
        server.id,
        username,
        mentorId,
      );
      return !!connection;
    },
    [mcpServerConnections, username, mentorId],
  );

  const getConnectedServiceId = useCallback(
    (server: MCPServer): number | null => {
      const connection = findMCPServerConnection(
        mcpServerConnections?.results,
        server.id,
        username,
        mentorId,
      );
      return connection?.connected_service ?? null;
    },
    [mcpServerConnections, username, mentorId],
  );

  const getConnectionId = useCallback(
    (server: MCPServer): number | null => {
      const connection = findMCPServerConnection(
        mcpServerConnections?.results,
        server.id,
        username,
        mentorId,
      );
      return connection?.id ?? null;
    },
    [mcpServerConnections, username, mentorId],
  );

  // Filter servers by date range
  const filterByDate = useCallback(
    (servers: MCPServer[]): MCPServer[] => {
      if (!dateRange?.from || !dateRange?.to) return servers;
      /* istanbul ignore next -- @preserve filter callback, tested via filterByDate tests */
      return servers.filter((server) => {
        const created = new Date(server.created_at);
        return created >= dateRange.from! && created <= dateRange.to!;
      });
    },
    [dateRange],
  );

  // Filtered servers
  const filteredFeaturedServers = useMemo(
    () => filterByDate(featuredServers?.results || []),
    [featuredServers, filterByDate],
  );

  const featuredOAuthServers = useMemo(
    () =>
      filteredFeaturedServers.filter((s) => {
        const authType = s.auth_type?.toLowerCase();
        return (authType === 'oauth2' || authType === 'token') && s.oauth_service_data;
      }),
    [filteredFeaturedServers],
  );

  const featuredRegularServers = useMemo(
    () =>
      filteredFeaturedServers.filter((s) => {
        const authType = s.auth_type?.toLowerCase();
        return !((authType === 'oauth2' || authType === 'token') && s.oauth_service_data);
      }),
    [filteredFeaturedServers],
  );

  const filteredMyServers = useMemo(() => {
    const servers = filterByDate(myServers?.results || []);
    return servers.filter((s) => {
      const authType = s.auth_type?.toLowerCase();
      if ((authType === 'oauth2' || authType === 'token') && s.connected_service) return false;
      return true;
    });
  }, [myServers, filterByDate]);

  const featuredTotalPages = featuredServers ? Math.ceil(featuredServers.count / itemsPerPage) : 0;
  const myConnectorsTotalPages = myServers ? Math.ceil(myServers.count / itemsPerPage) : 0;

  // Update MCP servers in mentor settings with optional tool_slugs and can_use_tools
  const updateMCPServers = useCallback(
    async (
      serverIds: number[],
      options?: {
        toolSlugs?: string[];
        canUseTools?: boolean;
      },
    ) => {
      if (!mentorId) throw new Error('Invalid mentor ID');
      const uniqueIds = [...new Set(serverIds.filter((id) => Number.isFinite(id) && id > 0))];

      const requestBody: Record<string, unknown> = { mcp_servers: uniqueIds };

      // Include tool_slugs if provided
      if (options?.toolSlugs !== undefined) {
        requestBody.tool_slugs = options.toolSlugs;
      }

      // Always set can_use_tools to true when enabling MCP connectors
      if (options?.canUseTools !== undefined) {
        requestBody.can_use_tools = options.canUseTools;
      }

      await editMentorJson({
        mentorId,
        org: tenantKey,
        requestBody,
        userId: username,
      }).unwrap();
    },
    [mentorId, tenantKey, username, editMentorJson],
  );

  // Handle toggle for activating/deactivating connectors
  const handleToggleConnector = useCallback(
    async (serverId: number, serverName: string, isActive: boolean) => {
      if (!Number.isFinite(serverId) || serverId <= 0) {
        toast.error('Invalid server ID');
        return;
      }

      setTogglingServerIds((prev) => new Set(prev).add(serverId));

      try {
        const currentIds = Array.isArray(activeMcpServerIds) ? activeMcpServerIds : [];
        const updatedIds = isActive
          ? currentIds.includes(serverId)
            ? currentIds
            : [...currentIds, serverId]
          : currentIds.filter((id) => id !== serverId);

        /* istanbul ignore next -- @preserve optimization path, tested via toggle tests */
        if (updatedIds.length === currentIds.length && isActive && currentIds.includes(serverId)) {
          return; // Already in desired state
        }

        // Prepare options for tool_slugs and can_use_tools updates
        const hasMcpInToolSlugs = currentToolSlugs.includes('mcp');

        if (isActive) {
          // When enabling a connector:
          // - If tool_slugs doesn't have 'mcp', add it
          // - Always set can_use_tools to true
          if (!hasMcpInToolSlugs) {
            const updatedToolSlugs = [...currentToolSlugs, 'mcp'];
            await updateMCPServers(updatedIds, {
              toolSlugs: updatedToolSlugs,
              canUseTools: true,
            });
          } else {
            // mcp already in tool_slugs, just update mcp_servers and can_use_tools
            await updateMCPServers(updatedIds, {
              canUseTools: true,
            });
          }
        } else {
          // When disabling a connector:
          // - If this is the last connector being disabled, remove 'mcp' from tool_slugs
          const isLastConnector = updatedIds.length === 0;

          if (isLastConnector && hasMcpInToolSlugs) {
            const updatedToolSlugs = currentToolSlugs.filter((slug) => slug !== 'mcp');
            await updateMCPServers(updatedIds, {
              toolSlugs: updatedToolSlugs,
              // Set can_use_tools based on whether there are other tools
              canUseTools: updatedToolSlugs.length > 0,
            });
          } else {
            // Not the last connector, just update mcp_servers
            await updateMCPServers(updatedIds);
          }
        }

        await refetchMentorSettings();
        toast.success(`${serverName} ${isActive ? 'activated' : 'deactivated'} successfully`);
      } catch (error: unknown) {
        const err = error as { data?: { detail?: string; error?: string }; message?: string };
        const msg = err?.data?.detail || err?.data?.error || err?.message || '';
        if (msg.includes('does not exist') || msg.includes('not accessible')) {
          toast.error(
            `${serverName} does not exist or is not accessible. Please refresh the page.`,
          );
        } else {
          toast.error(`Failed to ${isActive ? 'activate' : 'deactivate'} ${serverName}. ${msg}`);
        }
      } finally {
        setTogglingServerIds((prev) => {
          const next = new Set(prev);
          next.delete(serverId);
          return next;
        });
      }
    },
    [activeMcpServerIds, currentToolSlugs, updateMCPServers, refetchMentorSettings],
  );

  // Handle add/edit connector
  const handleAddConnectorClick = useCallback(
    async (connector: {
      name: string;
      url?: string;
      description?: string;
      credentials?: string;
      transport?: string;
      image?: File | string;
      authType?: string;
      authScope?: string;
      mentor?: string | null;
    }) => {
      if (!tenantKey || !username) {
        toast.error('Missing required parameters');
        return;
      }

      try {
        const hasFileImage = connector.image instanceof File;
        const trimmedCredentials = connector.credentials?.trim();
        const authType = connector.authType ?? (trimmedCredentials ? 'token' : 'none');
        const resolvedTransport = normalizeTransportValue(connector.transport);

        const basePayload = {
          name: connector.name,
          url: connector.url || `https://api.${connector.name.toLowerCase()}.com/mcp`,
          transport: resolvedTransport,
          auth_type: authType,
          description: connector.description || '',
          // Only include credentials if provided (for edits, undefined means keep existing)
          ...(trimmedCredentials !== undefined && { credentials: trimmedCredentials }),
          ...(connector.authScope && { auth_scope: connector.authScope }),
          ...(connector.mentor !== undefined && { mentor: connector.mentor }),
        };

        /* istanbul ignore next -- @preserve update path tested via ConnectorDialogs integration */
        if (editingServer) {
          // Update existing server
          const args = {
            id: editingServer.id,
            org: tenantKey,
            userId: username,
            ...(hasFileImage
              ? {
                  formData: createMCPServerFormData({
                    ...basePayload,
                    image: connector.image as File,
                  }),
                }
              : { body: basePayload }),
          };
          await updateMCPServer(args).unwrap();
          toast.success(`${connector.name} connector updated successfully`);
        } else {
          // Create new server
          const args = {
            org: tenantKey,
            userId: username,
            ...(hasFileImage
              ? {
                  formData: createMCPServerFormData({
                    ...basePayload,
                    image: connector.image as File,
                  }),
                }
              : { body: basePayload }),
          };
          const newServer = await createMCPServer(args).unwrap();
          toast.success(`${connector.name} connector added successfully`);

          // Auto-activate new connector
          try {
            const newId = Number(newServer.id);
            if (Number.isFinite(newId)) {
              const updatedIds = [...activeMcpServerIds, newId];
              const hasMcpInToolSlugs = currentToolSlugs.includes('mcp');

              // When auto-activating, also add 'mcp' to tool_slugs if not present
              if (!hasMcpInToolSlugs) {
                const updatedToolSlugs = [...currentToolSlugs, 'mcp'];
                await updateMCPServers(updatedIds, {
                  toolSlugs: updatedToolSlugs,
                  canUseTools: true,
                });
              } else {
                await updateMCPServers(updatedIds, {
                  canUseTools: true,
                });
              }
              await refetchMentorSettings();
            }
          } catch {
            toast.warning(`${connector.name} was created but couldn't be activated automatically.`);
          }
        }

        setShowAddConnectorDialog(false);
        setEditingServer(null);
        await Promise.all([refetchFeatured(), refetchMy()]);
      } catch {
        toast.error(`Failed to ${editingServer ? 'update' : 'add'} ${connector.name} connector`);
      }
    },
    [
      tenantKey,
      username,
      editingServer,
      activeMcpServerIds,
      currentToolSlugs,
      createMCPServer,
      updateMCPServer,
      updateMCPServers,
      refetchFeatured,
      refetchMy,
      refetchMentorSettings,
    ],
  );

  // Handle delete connector
  const handleDeleteConnector = useCallback(
    async (serverId: number, serverName: string) => {
      if (!tenantKey || !username) {
        toast.error('Missing required parameters');
        return;
      }

      setDeletingServerId(serverId);

      try {
        await deleteMCPServer({ id: serverId, org: tenantKey, userId: username }).unwrap();
        toast.success(`${serverName} connector removed successfully`);
        await Promise.all([refetchFeatured(), refetchMy()]);

        try {
          const updatedIds = activeMcpServerIds.filter((id) => id !== serverId);
          await updateMCPServers(updatedIds);
          await refetchMentorSettings();
        } catch {
          toast.warning(
            `${serverName} was deleted but may still appear as active. Please refresh.`,
          );
        }
      } catch {
        toast.error(`Failed to remove ${serverName} connector`);
      } finally {
        setDeletingServerId(null);
        setConnectorToDelete(null);
      }
    },
    [
      tenantKey,
      username,
      activeMcpServerIds,
      deleteMCPServer,
      updateMCPServers,
      refetchFeatured,
      refetchMy,
      refetchMentorSettings,
    ],
  );

  // Handle OAuth connect
  const handleConnectOAuth = useCallback(
    async (server: MCPServer) => {
      if (!tenantKey || !username || !server.oauth_service_data) {
        toast.error('Missing required parameters or OAuth data');
        return;
      }

      const oauthData = server.oauth_service_data;
      const { oauth_provider: provider, name } = oauthData;
      const serverId = server.id;
      const serviceKey = `server-${serverId}`;
      const oauthDisplayName = oauthData.display_name || name;

      setPendingOAuthServer({ serverId, provider, service: name, timestamp: Date.now() });

      setConnectingServiceIds((prev) => new Set(prev).add(serviceKey));

      try {
        const result = await startOAuthFlow({
          org: tenantKey,
          userId: username,
          provider,
          service: name,
        }).unwrap();

        if (!result.auth_url) throw new Error('No authorization URL returned');

        const popup = window.open(result.auth_url, '_blank');

        let pollCount = 0;
        const maxPolls = 60;
        let pollInterval: NodeJS.Timeout | null = null;
        let popupCheckInterval: NodeJS.Timeout | null = null;
        let isCreatingConnection = false;

        // Cleanup function to remove listeners and reset state
        const cleanup = () => {
          if (pollInterval) clearInterval(pollInterval);
          if (popupCheckInterval) clearInterval(popupCheckInterval);
          window.removeEventListener('focus', handleFocus);
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('message', handleMessage);
          setConnectingServiceIds((prev) => {
            const next = new Set(prev);
            next.delete(serviceKey);
            return next;
          });
          removePendingOAuthServer();
          isCreatingConnection = false;
        };

        // Create connection using helper function
        const doCreateConnection = async (connectedServiceId: number) => {
          const result = await createOAuthConnection(
            {
              connectedServiceId,
              isCreatingConnection,
              createMCPServerConnection,
              tenantKey,
              username,
              serverId,
              authScope: server.auth_scope,
              mentorId,
              oauthDisplayName,
              refetchFeatured,
              refetchMy,
              refetchConnected,
              refetchMCPServerConnections,
              refetchMentorSettings,
            },
            /* istanbul ignore next -- @preserve success callback, tested via createOAuthConnection */
            () => {
              isCreatingConnection = false;
            },
            /* istanbul ignore next -- @preserve error callback, tested via createOAuthConnection */
            () => {
              isCreatingConnection = false;
            },
          );
          if (result) {
            isCreatingConnection = true;
          }
          return result;
        };

        // Check for OAuth connection using helper
        const checkConnection = async () => {
          // Early check using helper
          const earlyCheck = determineCheckConnectionAction(
            isCreatingConnection,
            null,
            false,
            pollCount,
            maxPolls,
          );
          if (earlyCheck.action === 'skip') return;

          try {
            const connectedServiceId = await checkOAuthConnectionComplete(
              refetchConnected as () => Promise<{ data?: ConnectedService[] }>,
              provider,
              name,
            );

            // If we found a connected service, try to create connection using helper
            // Logic tested via executeConnectionFoundCleanup unit tests
            /* istanbul ignore next -- @preserve callback wrapper, logic tested via helper */
            if (connectedServiceId) {
              const result = await executeConnectionFoundCleanup({
                connectedServiceId,
                doCreateConnection,
                pollCount,
                maxPolls,
                cleanup,
              });
              if (result.cleaned) {
                return;
              }
            }

            await Promise.all([refetchFeatured(), refetchMy()]);
            pollCount++;

            // Check if max polls reached using extracted helper function
            executeMaxPollsCleanup({ pollCount, maxPolls, cleanup });
          } catch {
            // Continue polling
          }
        };

        const handleFocus = () => checkConnection();

        // Handle OAuth message events using extracted helper function
        // Logic tested via executeHandleMessageCallback unit tests
        /* istanbul ignore next -- @preserve callback wrapper, logic tested via helper */
        const handleMessage = async (event: MessageEvent) => {
          await executeHandleMessageCallback({
            event,
            expectedOrigin: window.location.origin,
            provider,
            serviceName: name,
            cleanup,
            doCreateConnection,
          });
        };

        // Handle OAuth storage events using helper
        const handleStorageChange = async (e: StorageEvent) => {
          const result = processOAuthStorageEvent(e, provider, name);
          if (result) {
            if (result.isMatch) {
              cleanup();
              await doCreateConnection(result.connectedServiceId);
            } else {
              await checkConnection();
            }
          } else if (e.key === 'oauth_connection_complete') {
            /* istanbul ignore next */ // Fallback for parse errors or missing data
            await checkConnection();
          }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('message', handleMessage);
        window.addEventListener('focus', handleFocus);

        pollInterval = setInterval(checkConnection, 5000);
        setTimeout(cleanup, 5 * 60 * 1000);

        // Detect if user closed the OAuth popup without completing
        if (popup) {
          popupCheckInterval = setInterval(() => {
            if (popup.closed) {
              if (popupCheckInterval) clearInterval(popupCheckInterval);
              popupCheckInterval = null;
              // Grace period for OAuth callback/redirect to complete
              setTimeout(() => {
                if (!isCreatingConnection) {
                  cleanup();
                }
              }, 10000);
            }
          }, 2000);
        }
      } /* istanbul ignore next */ catch {
        toast.error(`Failed to connect ${oauthData.display_name || name}`);
        setConnectingServiceIds((prev) => {
          const next = new Set(prev);
          next.delete(serviceKey);
          return next;
        });
        removePendingOAuthServer();
      }
    },
    [
      tenantKey,
      username,
      startOAuthFlow,
      createMCPServerConnection,
      refetchFeatured,
      refetchMy,
      refetchConnected,
      refetchMCPServerConnections,
      refetchMentorSettings,
      mentorId,
      setPendingOAuthServer,
      removePendingOAuthServer,
    ],
  );

  // Handle OAuth disconnect
  const handleDisconnectOAuth = useCallback(
    async (server: MCPServer) => {
      const serverConnectedServiceId = getConnectedServiceId(server);
      const validation = validateDisconnectOAuthParams(
        tenantKey,
        username,
        serverConnectedServiceId,
      );

      /* istanbul ignore next -- @preserve validation error branch */
      if (!validation.isValid) {
        toast.error(validation.error || 'Validation failed');
        return;
      }

      const connectedServiceId = validation.connectedServiceId!;
      setDisconnectingServiceIds((prev) => new Set(prev).add(server.id));

      try {
        const updatedIds = activeMcpServerIds.filter((id) => id !== server.id);
        await updateMCPServers(updatedIds);
        await disconnectService({
          org: tenantKey,
          userId: username,
          id: connectedServiceId,
        }).unwrap();
        await Promise.all([
          refetchFeatured(),
          refetchMy(),
          refetchConnected(),
          refetchMCPServerConnections(),
          refetchMentorSettings(),
        ]);
        toast.success('Service disconnected successfully');
      } catch {
        toast.error('Failed to disconnect service');
      } finally {
        setDisconnectingServiceIds((prev) => {
          const next = new Set(prev);
          next.delete(server.id);
          return next;
        });
      }
    },
    [
      tenantKey,
      username,
      activeMcpServerIds,
      getConnectedServiceId,
      updateMCPServers,
      disconnectService,
      refetchFeatured,
      refetchMy,
      refetchConnected,
      refetchMCPServerConnections,
      refetchMentorSettings,
    ],
  );

  // Handle OAuth completion from ConnectorDialogs
  const handleOAuthComplete = useCallback(async () => {
    await Promise.all([
      refetchFeatured(),
      refetchMy(),
      refetchMCPServerConnections(),
      refetchMentorSettings(),
    ]);
  }, [refetchFeatured, refetchMy, refetchMCPServerConnections, refetchMentorSettings]);

  // Render server card
  const renderServerCard = (server: MCPServer, isFeatured: boolean) => {
    const oauthData = server.oauth_service_data;
    const displayName = server.name || oauthData?.display_name || 'Unknown Connector';
    const authType = server.auth_type?.toLowerCase();
    const isOAuth2 = authType === 'oauth2';
    const isToken = authType === 'token';
    const isConnected = isOAuth2 && isOAuthServerConnected(server);
    const connectedServiceId = getConnectedServiceId(server);
    const serviceKey = `server-${server.id}`;
    const isConnecting = connectingServiceIds.has(serviceKey);
    const isDisconnecting = disconnectingServiceIds.has(server.id);
    const isActive = activeMcpServerIds.includes(server.id);
    // Only OAuth2 needs connection flow - token auth works without connection
    const needsOAuthConnection = isOAuth2 && !isConnected;
    const objectPermissions = {
      write: server.permissions?.object?.write ?? true,
      delete: server.permissions?.object?.delete ?? true,
    };

    return (
      <div
        key={server.id}
        className="overflow-hidden rounded-lg bg-gray-50 border border-gray-200 flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-gray-100">
              {oauthData?.image || server.image ? (
                <img
                  src={oauthData?.image || server.image}
                  alt={displayName}
                  className="w-6 h-6 object-contain"
                />
              ) : (
                <Plug className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <h4 className="text-sm font-medium text-gray-900">{displayName}</h4>
          </div>
          <div className="flex items-center gap-2">
            {needsOAuthConnection ? (
              <span className="text-xs text-gray-600">Not Connected</span>
            ) : (
              <WithFormPermissions name="mcp_servers" permissions={fieldPermissions ?? {}}>
                {({ disabled }) =>
                  disabled ? null : (
                    <>
                      <span className="text-xs text-gray-600">
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) =>
                          handleToggleConnector(server.id, displayName, checked)
                        }
                        disabled={togglingServerIds.has(server.id)}
                        aria-label={`${displayName} ${isActive ? 'enabled' : 'disabled'}`}
                      />
                    </>
                  )
                }
              </WithFormPermissions>
            )}
          </div>
        </div>
        <div className="p-4 flex flex-col flex-1">
          <div className="text-sm text-gray-600 mb-3 max-h-20 overflow-y-auto">
            {oauthData?.description || server.description || server.url}
          </div>
          <div className="flex items-center gap-2 mb-3">
            {isOAuth2 && (
              <span className="text-xs px-2 py-1 bg-blue-100 rounded text-blue-600">OAuth</span>
            )}
            {isOAuth2 && server.auth_scope && (
              <span className="text-xs px-2 py-1 bg-amber-100 rounded text-amber-700">
                {server.auth_scope === 'user'
                  ? 'User'
                  : server.auth_scope === 'mentor'
                    ? 'Mentor'
                    : 'Tenant'}
              </span>
            )}
            {isToken && (
              <span className="text-xs px-2 py-1 bg-purple-100 rounded text-purple-600">Token</span>
            )}
            {isFeatured && oauthData?.oauth_provider && (
              <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                {oauthData.oauth_provider}
              </span>
            )}
            {!isFeatured && (
              <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                {getTransportLabel(server.transport)}
              </span>
            )}
          </div>
          <div className="mt-auto">
            {!isFeatured ? (
              // Custom (non-featured) servers: Show Edit/Delete based on object permissions, and Connect/Disconnect if OAuth
              <div className="space-y-2">
                {isOAuth2 && (
                  <>
                    {isConnected && connectedServiceId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDisconnectOAuth(server)}
                        disabled={isDisconnecting}
                      >
                        {isDisconnecting ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            Disconnecting...
                          </>
                        ) : (
                          <>
                            <Unlink className="mr-2 h-4 w-4" />
                            Disconnect
                          </>
                        )}
                      </Button>
                    ) : /* istanbul ignore next -- @preserve JSX branch */ needsOAuthConnection ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 bg-[#38A1E5] text-white border-[#38A1E5] hover:bg-[#2d8bc7] hover:text-white"
                        onClick={() => handleConnectOAuth(server)}
                        disabled={isConnecting}
                      >
                        {isConnecting ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Link2 className="mr-2 h-4 w-4" />
                            Connect
                          </>
                        )}
                      </Button>
                    ) : null}
                  </>
                )}
                <div className="flex gap-2">
                  <WithFormPermissions
                    name={MCP_SERVER_PERMISSION_NAME}
                    permissions={{ [MCP_SERVER_PERMISSION_NAME]: objectPermissions }}
                  >
                    {({ disabled }) =>
                      !disabled ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 flex-1"
                          onClick={() => {
                            setEditingServer(server);
                            setShowAddConnectorDialog(true);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      ) : null
                    }
                  </WithFormPermissions>
                  <WithFormPermissions
                    name={MCP_SERVER_PERMISSION_NAME}
                    permissions={{ [MCP_SERVER_PERMISSION_NAME]: objectPermissions }}
                  >
                    {({ canDelete }) =>
                      canDelete ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setConnectorToDelete({ id: server.id, name: server.name })}
                          disabled={deletingServerId === server.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      ) : null
                    }
                  </WithFormPermissions>
                </div>
              </div>
            ) : (
              // Featured servers: Only show Connect/Disconnect for OAuth
              <>
                {isConnected && connectedServiceId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDisconnectOAuth(server)}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <Unlink className="mr-2 h-4 w-4" />
                        Disconnect
                      </>
                    )}
                  </Button>
                ) : needsOAuthConnection ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 bg-[#38A1E5] text-white border-[#38A1E5] hover:bg-[#2d8bc7] hover:text-white"
                    onClick={() => handleConnectOAuth(server)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link2 className="mr-2 h-4 w-4" />
                        Connect
                      </>
                    )}
                  </Button>
                ) : null}
              </>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Created {new Date(server.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Filters Section */}
        <div className="border rounded-lg p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 whitespace-nowrap font-normal bg-transparent w-full lg:w-auto"
                >
                  <Calendar className="h-4 w-4" />
                  {
                    /* istanbul ignore next */ dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd')}`
                      : 'Pick a Date Range'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-label="Select Transport"
                  className="w-full lg:w-[200px] justify-between font-normal bg-transparent"
                >
                  {selectedTransport
                    ? TRANSPORT_OPTIONS.find((opt) => opt.value === selectedTransport)?.label
                    : 'All Transports'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search transport..." />
                  <CommandList>
                    <CommandEmpty>No transport found.</CommandEmpty>
                    <CommandGroup>
                      {TRANSPORT_OPTIONS.map((option) => (
                        <CommandItem
                          key={option.value || 'all'}
                          value={String(option.value)}
                          onSelect={() => setSelectedTransport(option.value)}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedTransport === option.value ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Featured Connectors Section */}
        {(featuredOAuthServers.length > 0 || featuredRegularServers.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Featured Connectors</h3>
            </div>
            {/* c8 ignore next 5 */}
            {isLoadingFeatured ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner className="w-8 h-8 mb-4" />
                <p className="text-sm text-gray-500">Loading featured connectors...</p>
              </div>
            ) : featuredError ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <Plug className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-sm text-red-600 mb-2">Failed to load featured connectors</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchFeatured()}
                  className="text-sm"
                >
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featuredOAuthServers.map((server) => renderServerCard(server, true))}
                  {featuredRegularServers.map((server) => renderServerCard(server, true))}
                </div>
                {featuredTotalPages > 1 && (
                  <div className="flex justify-center pt-4">
                    <IblPagination
                      currentPage={featuredPage}
                      totalPages={featuredTotalPages}
                      onPageChange={setFeaturedPage}
                      disabled={isLoadingFeatured}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Connectors Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Connectors</h3>
            <WithPermissions rbacResource="/mcpservers/#create">
              {({ hasPermission }) =>
                hasPermission ? (
                  <Button
                    onClick={() => setShowAddConnectorDialog(true)}
                    variant="outline"
                    className="ibl-button-primary shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Connector
                  </Button>
                ) : null
              }
            </WithPermissions>
          </div>
          {isLoadingMy ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner className="w-8 h-8 mb-4" />
              <p className="text-sm text-gray-500">Loading connectors...</p>
            </div>
          ) : myError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Plug className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-sm text-red-600 mb-2">Failed to load connectors</p>
              <Button variant="outline" size="sm" onClick={() => refetchMy()} className="text-sm">
                Retry
              </Button>
            </div>
          ) : !filteredMyServers.length ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                <Plug className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">No connectors configured</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMyServers.map((server) => renderServerCard(server, false))}
              </div>
              {myConnectorsTotalPages > 1 && (
                <div className="flex justify-center pt-4">
                  <IblPagination
                    currentPage={myConnectorsPage}
                    totalPages={myConnectorsTotalPages}
                    onPageChange={setMyConnectorsPage}
                    disabled={isLoadingMy}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Connector Dialog */}
      <ConnectorDialogs
        open={showAddConnectorDialog}
        onClose={() => {
          setShowAddConnectorDialog(false);
          setEditingServer(null);
        }}
        onAddConnector={handleAddConnectorClick}
        editingServer={editingServer}
        editingConnectionId={editingServer ? getConnectionId(editingServer) : null}
        tenantKey={tenantKey}
        username={username}
        mentorId={mentorId}
        onOAuthComplete={handleOAuthComplete}
      />

      {/* Confirmation Dialog for Removing Connector */}
      {connectorToDelete && (
        <Dialog open={true} onOpenChange={() => setConnectorToDelete(null)}>
          <DialogContent
            className="sm:max-w-[425px] bg-white"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-semibold text-gray-700">
                Remove Connector
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to remove <strong>{connectorToDelete.name}</strong>? This
                action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setConnectorToDelete(null)}
                  disabled={deletingServerId !== null}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    handleDeleteConnector(connectorToDelete.id, connectorToDelete.name)
                  }
                  disabled={deletingServerId !== null}
                  className="ibl-button-primary"
                >
                  {deletingServerId === connectorToDelete.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
