'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { TransportEnum } from '@iblai/iblai-api';

const AUTH_SCOPE = {
  TENANT: 'tenant',
  MENTOR: 'mentor',
  USER: 'user',
} as const;

const KNOWN_TOKEN_TYPES = [
  'Bearer',
  'Basic',
  'API-Key',
  'API-Token',
  'Token',
] as const;
import type { MCPServer } from '@iblai/iblai-js/data-layer';
import {
  useLazyGetMCPServersQuery,
  useOauthFindMutation,
  useLazyStartOAuthFlowQuery,
  useCreateMCPServerMutation,
  usePartialUpdateMCPServerMutation,
  useCreateMCPServerConnectionMutation,
  usePatchMCPServerConnectionMutation,
  useGetConnectedServicesQuery,
} from '@iblai/iblai-js/data-layer';
import { useLocalStorage } from '@/hooks/use-local-storage';

interface ConnectorDialogsProps {
  open: boolean;
  onClose: () => void;
  onAddConnector?: (connector: {
    name: string;
    url?: string;
    description?: string;
    credentials?: string;
    transport?: string;
    image?: File | string;
    authType?: string;
    authScope?: string;
    mentor?: string | null;
  }) => void;
  editingServer?: MCPServer | null;
  editingConnectionId?: number | null;
  tenantKey?: string;
  username?: string;
  mentorId?: string;
  onOAuthComplete?: () => void;
}

const normalizeTransportValue = (value?: string): TransportEnum => {
  const candidate = value?.toLowerCase();
  if (candidate === TransportEnum.SSE) return TransportEnum.SSE;
  if (candidate === TransportEnum.WEBSOCKET) return TransportEnum.WEBSOCKET;
  return TransportEnum.STREAMABLE_HTTP;
};

// Helper to validate if OAuth connection can be created
export const canCreateOAuthConnection = (
  isCreatingConnection: boolean,
  connectedServiceId: number,
): boolean => {
  if (isCreatingConnection) return false;
  if (!connectedServiceId) return false;
  if (!Number.isFinite(connectedServiceId)) return false;
  return true;
};

// Helper to validate connector form fields
export interface ConnectorFormValidation {
  isValid: boolean;
  error: string | null;
}

export const validateConnectorForm = (
  name: string,
  server: string,
): ConnectorFormValidation => {
  const trimmedName = name.trim();
  const trimmedServer = server.trim();

  if (!trimmedName || !trimmedServer) {
    return {
      isValid: false,
      error: 'Please fill in all required fields.',
    };
  }

  try {
    new URL(trimmedServer);
  } catch {
    return {
      isValid: false,
      error: 'Please enter a valid URL.',
    };
  }

  return {
    isValid: true,
    error: null,
  };
};

// Helper to get validation error message with fallback
export const getValidationErrorMessage = (
  error: string | null | undefined,
  fallback: string = 'Validation failed',
): string => {
  return error || fallback;
};

// Helper to extract error message from API error
export const extractApiErrorMessage = (
  error: unknown,
  defaultMessage: string = '',
): string => {
  const err = error as {
    data?: { detail?: string; error?: string };
    message?: string;
  };
  return (
    err?.data?.detail || err?.data?.error || err?.message || defaultMessage
  );
};

// Helper to validate custom token type
export const validateCustomTokenType = (
  value: string,
): { isValid: boolean; error: string | null } => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Custom token type is required.' };
  }
  if (trimmed.length > 50) {
    return {
      isValid: false,
      error: 'Token type must be 50 characters or fewer.',
    };
  }
  if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Token type may only contain letters, numbers, and hyphens.',
    };
  }
  return { isValid: true, error: null };
};

// Type for pending OAuth server data stored in localStorage
interface PendingOAuthServer {
  serverId: number;
  provider: string;
  service: string;
  timestamp: number;
}

export function ConnectorDialogs({
  open,
  onClose,
  onAddConnector,
  editingServer,
  editingConnectionId,
  tenantKey,
  username,
  mentorId,
  onOAuthComplete,
}: ConnectorDialogsProps) {
  // Form state
  const [connectorName, setConnectorName] = useState('');
  const [connectorServer, setConnectorServer] = useState('');
  const [connectorDescription, setConnectorDescription] = useState('');
  const [transport, setTransport] = useState<TransportEnum>(
    TransportEnum.STREAMABLE_HTTP,
  );
  const [authMethod, setAuthMethod] = useState('no-auth');
  const [authScope, setAuthScope] = useState<string>(AUTH_SCOPE.TENANT);
  const [connectorScope, setConnectorScope] = useState<
    'tenant' | 'this-mentor'
  >('tenant');
  const [tokenType, setTokenType] = useState('Bearer');
  const [customTokenType, setCustomTokenType] = useState('');
  const [tokenValue, setTokenValue] = useState('');
  const [connectorImage, setConnectorImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [credentialsMasked, setCredentialsMasked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthUrlError, setOauthUrlError] = useState<string | null>(null);
  const [originalTokenPlaceholder, setOriginalTokenPlaceholder] = useState<
    string | null
  >(null);

  // API hooks
  const [getMCPServers] = useLazyGetMCPServersQuery();
  const [oauthFind] = useOauthFindMutation();
  const [startOAuthFlow] = useLazyStartOAuthFlowQuery();
  const [createMCPServer] = useCreateMCPServerMutation();
  const [updateMCPServer] = usePartialUpdateMCPServerMutation();
  const [createMCPServerConnection] = useCreateMCPServerConnectionMutation();
  const [patchMCPServerConnection] = usePatchMCPServerConnectionMutation();
  const { refetch: refetchConnected } = useGetConnectedServicesQuery(
    { org: tenantKey || '', userId: username || '' },
    { skip: !tenantKey || !username },
  );

  // Use localStorage hook for pending OAuth server data
  const [, setPendingOAuthServer, removePendingOAuthServer] =
    useLocalStorage<PendingOAuthServer | null>('oauth_pending_server', null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  // Reset form helper
  const resetForm = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setConnectorName('');
    setConnectorServer('');
    setConnectorDescription('');
    setTransport(TransportEnum.STREAMABLE_HTTP);
    setAuthMethod('no-auth');
    setAuthScope(AUTH_SCOPE.TENANT);
    setConnectorScope('tenant');
    setTokenType('Bearer');
    setCustomTokenType('');
    setTokenValue('');
    setConnectorImage(null);
    setImageFile(null);
    setCredentialsMasked(false);
    setOauthUrlError(null);
    setOriginalTokenPlaceholder(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Pre-fill form when editing
  useEffect(() => {
    if (!open) return;

    if (editingServer) {
      // Clear previous object URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      setConnectorName(editingServer.name || '');
      setConnectorServer(editingServer.url || '');
      setConnectorDescription(editingServer.description || '');
      setTransport(
        normalizeTransportValue(editingServer.transport?.toString()),
      );
      setConnectorImage(editingServer.image || null);
      setImageFile(null);
      setConnectorScope(editingServer.mentor ? 'this-mentor' : 'tenant');

      // Check auth type and set appropriate method
      const authType = editingServer.auth_type?.toLowerCase();
      if (authType === 'oauth2') {
        setAuthMethod('oauth');
        setAuthScope(editingServer.auth_scope || AUTH_SCOPE.TENANT);
        setTokenType('Bearer');
        setCustomTokenType('');
        setTokenValue('');
        setCredentialsMasked(false);
        setOriginalTokenPlaceholder(null);
      } else {
        // Parse credentials for token/api-key
        const credentials = editingServer.credentials || '';
        if (credentials.trim()) {
          setAuthMethod('api-key');
          const spaceIndex = credentials.indexOf(' ');
          const parsedType =
            spaceIndex > 0 ? credentials.substring(0, spaceIndex) : 'Bearer';

          // Check if parsedType matches a known dropdown option
          if ((KNOWN_TOKEN_TYPES as readonly string[]).includes(parsedType)) {
            setTokenType(parsedType);
            setCustomTokenType('');
          } else {
            setTokenType('Other');
            setCustomTokenType(parsedType);
          }

          // Use a masked placeholder to indicate token exists
          const placeholder = '••••••••••••••••••••';
          setTokenValue(placeholder);
          setOriginalTokenPlaceholder(placeholder);
          setCredentialsMasked(true);
        } else {
          setAuthMethod('no-auth');
          setTokenType('Bearer');
          setCustomTokenType('');
          setTokenValue('');
          setCredentialsMasked(false);
          setOriginalTokenPlaceholder(null);
        }
      }
    } else {
      resetForm();
    }
  }, [editingServer, open, resetForm]);

  // Clear OAuth error when URL changes
  useEffect(() => {
    if (authMethod === 'oauth') {
      setOauthUrlError(null);
    }
  }, [connectorServer, authMethod]);

  const handleImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
        setConnectorImage(null);
        setImageFile(null);
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file.');
        event.target.value = '';
        return;
      }

      const maxSizeInBytes = 2 * 1024 * 1024; // 2 MB
      if (file.size > maxSizeInBytes) {
        toast.error('Image size must be less than 2MB.');
        event.target.value = '';
        return;
      }

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const previewUrl = URL.createObjectURL(file);
      objectUrlRef.current = previewUrl;
      setConnectorImage(previewUrl);
      setImageFile(file);
    },
    [],
  );

  // Handle OAuth flow
  // Note: tenantKey and username are validated in handleSubmit before this is called
  const handleOAuthFlow = useCallback(
    async (server: MCPServer, provider: string, service: string) => {
      const serverId = server.id;

      setPendingOAuthServer({
        serverId,
        provider,
        service,
        timestamp: Date.now(),
      });

      try {
        const result = await startOAuthFlow({
          org: tenantKey!,
          userId: username!,
          provider,
          service,
        }).unwrap();

        if (!result.auth_url) throw new Error('No authorization URL returned');

        const popup = window.open(result.auth_url, '_blank');

        let pollCount = 0;
        const maxPolls = 60;
        let pollInterval: NodeJS.Timeout | null = null;
        let popupCheckInterval: NodeJS.Timeout | null = null;
        let isCreatingConnection = false;

        const cleanup = () => {
          if (pollInterval) clearInterval(pollInterval);
          if (popupCheckInterval) clearInterval(popupCheckInterval);
          window.removeEventListener('focus', handleFocus);
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('message', handleMessage);
          removePendingOAuthServer();
          isCreatingConnection = false;
        };

        const createConnection = async (connectedServiceId: number) => {
          if (
            !canCreateOAuthConnection(isCreatingConnection, connectedServiceId)
          )
            return;
          isCreatingConnection = true;

          try {
            await createMCPServerConnection({
              org: tenantKey!,
              userId: username!,
              server: serverId,
              scope: authScope,
              auth_type: 'oauth2',
              ...(authScope !== AUTH_SCOPE.MENTOR && { user: username! }),
              connected_service: connectedServiceId,
              ...(authScope === AUTH_SCOPE.MENTOR && mentorId
                ? { mentor: mentorId }
                : {}),
            }).unwrap();

            await refetchConnected();
            if (onOAuthComplete) {
              onOAuthComplete();
            }
            toast.success('OAuth connector connected successfully');
            // Modal is closed when OAuth flow starts, so no need to close/reset here
          } catch (error: unknown) {
            const err = error as { data?: { detail?: string } };
            toast.error(
              `Failed to create connection: ${err?.data?.detail || 'Unknown error'}`,
            );
            throw error;
          } finally {
            isCreatingConnection = false;
          }
        };

        const checkConnection = async () => {
          if (isCreatingConnection) return;
          try {
            const updated = await refetchConnected();
            if (updated?.data) {
              const connService = (
                updated.data as Array<{
                  provider: string;
                  service: string;
                  id: number;
                }>
              ).find(
                (cs) => cs.provider === provider && cs.service === service,
              );
              if (connService?.id) {
                await createConnection(connService.id);
                cleanup();
                return;
              }
            }
            pollCount++;
            if (pollCount >= maxPolls) cleanup();
          } catch {
            // Continue polling
          }
        };

        const handleFocus = () => checkConnection();

        const handleMessage = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (
            event.data?.type === 'GOOGLE_AUTH_SUCCESS' &&
            event.data?.connectedServiceId
          ) {
            if (
              event.data.provider === provider &&
              event.data.serviceName === service
            ) {
              cleanup();
              await createConnection(event.data.connectedServiceId);
            }
          }
        };

        const handleStorageChange = async (e: StorageEvent) => {
          if (e.key === 'oauth_connection_complete') {
            try {
              const data = JSON.parse(e.newValue || '{}');
              if (
                data.connectedServiceId &&
                data.provider === provider &&
                data.serviceName === service
              ) {
                cleanup();
                await createConnection(data.connectedServiceId);
              } else {
                await checkConnection();
              }
            } catch {
              await checkConnection();
            }
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
      } catch {
        toast.error(`Failed to start OAuth flow for ${service}`);
        removePendingOAuthServer();
      }
    },
    [
      tenantKey,
      username,
      authScope,
      mentorId,
      startOAuthFlow,
      createMCPServerConnection,
      refetchConnected,
      setPendingOAuthServer,
      removePendingOAuthServer,
      onOAuthComplete,
      resetForm,
      onClose,
    ],
  );

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    const trimmedName = connectorName.trim();
    const trimmedServer = connectorServer.trim();

    const validation = validateConnectorForm(connectorName, connectorServer);
    if (!validation.isValid) {
      toast.error(getValidationErrorMessage(validation.error));
      return;
    }

    // Handle OAuth flow
    if (authMethod === 'oauth') {
      if (!tenantKey || !username) {
        toast.error('Missing required parameters');
        return;
      }

      setIsSubmitting(true);
      setOauthUrlError(null);

      try {
        // Editing an existing OAuth server
        if (editingServer) {
          const urlChanged = editingServer.url !== trimmedServer;

          // Update server metadata (name, description, transport, auth_scope, mentor)
          await updateMCPServer({
            id: editingServer.id,
            org: tenantKey,
            userId: username,
            body: {
              name: trimmedName,
              url: trimmedServer,
              transport: transport,
              description: connectorDescription.trim() || undefined,
              auth_type: 'oauth2',
              auth_scope: authScope,
              mentor:
                connectorScope === 'this-mentor' && mentorId ? mentorId : null,
            },
          }).unwrap();

          // If auth_scope changed, update the connection's mentor field
          const scopeChanged = editingServer.auth_scope !== authScope;
          if (scopeChanged && editingConnectionId) {
            try {
              await patchMCPServerConnection({
                org: tenantKey,
                userId: username,
                id: editingConnectionId,
                scope: authScope,
                mentor:
                  authScope === AUTH_SCOPE.MENTOR && mentorId ? mentorId : '',
                ...(authScope !== AUTH_SCOPE.MENTOR && { user: username }),
              }).unwrap();
            } catch {
              // Non-blocking: server was updated, connection patch is best-effort
            }
          }

          // Only restart OAuth flow if the URL changed
          if (urlChanged) {
            // Re-check featured servers for the new URL
            const existingServersResult = await getMCPServers({
              org: tenantKey,
              userId: username,
              url: trimmedServer,
              isFeatured: true,
            }).unwrap();

            const matchingServer = existingServersResult.results?.find(
              (s) =>
                s.url === trimmedServer &&
                s.auth_type?.toLowerCase() === 'oauth2',
            );

            if (matchingServer?.oauth_service_data) {
              const oauthData = matchingServer.oauth_service_data;
              await handleOAuthFlow(
                matchingServer,
                oauthData.oauth_provider,
                oauthData.name,
              );
            } else {
              const callbackUrl = `${window.location.origin}/google-oauth-callback/`;
              const oauthFindResult = await oauthFind({
                org: tenantKey,
                userId: username,
                url: trimmedServer,
                name: trimmedName,
                callback_url: callbackUrl,
              }).unwrap();

              await handleOAuthFlow(
                { ...editingServer, url: trimmedServer } as MCPServer,
                oauthFindResult.oauth_provider,
                oauthFindResult.name,
              );
            }
          } else {
            toast.success('Connector updated successfully');
            if (onOAuthComplete) onOAuthComplete();
          }

          setIsSubmitting(false);
          resetForm();
          onClose();
          return;
        }

        // Creating a new OAuth server
        // First, check if URL already exists in featured MCP servers
        const existingServersResult = await getMCPServers({
          org: tenantKey,
          userId: username,
          url: trimmedServer,
          isFeatured: true,
        }).unwrap();

        const existingServer = existingServersResult.results?.find(
          (s) =>
            s.url === trimmedServer && s.auth_type?.toLowerCase() === 'oauth2',
        );

        if (existingServer && existingServer.oauth_service_data) {
          // Use existing server
          const oauthData = existingServer.oauth_service_data;
          await handleOAuthFlow(
            existingServer,
            oauthData.oauth_provider,
            oauthData.name,
          );
          setIsSubmitting(false);
          resetForm();
          onClose();
          return;
        }

        // If not found, call oauth-find endpoint
        try {
          const callbackUrl = `${window.location.origin}/google-oauth-callback/`;
          const oauthFindResult = await oauthFind({
            org: tenantKey,
            userId: username,
            url: trimmedServer,
            name: trimmedName,
            callback_url: callbackUrl,
          }).unwrap();

          // Create new MCP server with OAuth
          const newServer = await createMCPServer({
            org: tenantKey,
            userId: username,
            body: {
              name: trimmedName,
              url: trimmedServer,
              transport: transport,
              description: connectorDescription.trim() || undefined,
              auth_type: 'oauth2',
              auth_scope: authScope,
              oauth_service: oauthFindResult.id,
              mentor:
                connectorScope === 'this-mentor' && mentorId ? mentorId : null,
            },
          }).unwrap();

          // Start OAuth flow
          await handleOAuthFlow(
            newServer,
            oauthFindResult.oauth_provider,
            oauthFindResult.name,
          );
          setIsSubmitting(false);
          resetForm();
          onClose();
        } catch (error: unknown) {
          const msg = extractApiErrorMessage(error);
          setOauthUrlError(
            getValidationErrorMessage(
              msg,
              'This MCP server URL cannot be used for OAuth authentication. Please check the URL and try again.',
            ),
          );
          toast.error('Failed to find OAuth configuration for this URL');
        }
      } catch (error: unknown) {
        const msg = extractApiErrorMessage(error);
        setOauthUrlError(
          getValidationErrorMessage(
            msg,
            'This MCP server URL cannot be used for OAuth authentication. Please check the URL and try again.',
          ),
        );
        toast.error('Failed to process OAuth connector');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Handle non-OAuth flows (existing logic)
    if (!onAddConnector) return;

    // Validate custom token type when "Other" is selected
    if (authMethod === 'api-key' && tokenType === 'Other') {
      const tokenTypeValidation = validateCustomTokenType(customTokenType);
      if (!tokenTypeValidation.isValid) {
        toast.error(getValidationErrorMessage(tokenTypeValidation.error));
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const trimmedDescription = connectorDescription.trim();
      const isApiKey = authMethod === 'api-key';
      const trimmedToken = tokenValue.trim();

      // For editing: only send credentials if token was actually changed (not the placeholder)
      let credentials: string | undefined;
      if (isApiKey && trimmedToken) {
        // If editing and token matches placeholder, don't send credentials (user didn't change it)
        if (
          editingServer &&
          originalTokenPlaceholder &&
          trimmedToken === originalTokenPlaceholder
        ) {
          credentials = undefined; // Don't send credentials - keep existing value
        } else {
          const effectiveTokenType =
            tokenType === 'Other' ? customTokenType.trim() : tokenType;
          credentials = `${effectiveTokenType} ${trimmedToken}`;
        }
      }

      const authType = isApiKey ? 'token' : 'none';

      await onAddConnector({
        name: trimmedName,
        url: trimmedServer,
        description: trimmedDescription || undefined,
        transport: transport,
        credentials,
        authType,
        ...(imageFile && { image: imageFile }),
        mentor: connectorScope === 'this-mentor' && mentorId ? mentorId : null,
      });

      resetForm();
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    connectorName,
    connectorServer,
    connectorDescription,
    authMethod,
    authScope,
    connectorScope,
    tokenValue,
    tokenType,
    customTokenType,
    transport,
    imageFile,
    resetForm,
    onClose,
    onAddConnector,
    tenantKey,
    username,
    getMCPServers,
    oauthFind,
    createMCPServer,
    updateMCPServer,
    patchMCPServerConnection,
    mentorId,
    handleOAuthFlow,
    editingServer,
    editingConnectionId,
    originalTokenPlaceholder,
    onOAuthComplete,
  ]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setCredentialsMasked(false);
    resetForm();
    onClose();
  }, [isSubmitting, resetForm, onClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="bg-card flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-[600px]"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <DialogHeader className="border-border flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-foreground text-xl font-semibold">
            {editingServer ? 'Edit MCP Connector' : 'Add MCP Connector'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {/* Thumbnail and Connector Name */}
            <div className="flex items-center gap-4">
              <div className="group relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  aria-label="Upload connector image"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-lg transition-colors"
                >
                  {connectorImage ? (
                    <>
                      <img
                        src={connectorImage}
                        alt="Connector thumbnail"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute right-1 bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#38A1E5] opacity-0 transition-opacity group-hover:opacity-100">
                        <ImageIcon className="h-3 w-3 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#38A1E5]">
                      <ImageIcon className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label className="text-base font-medium">
                  Connector Name<span className="text-red-500">*</span>
                </Label>
                <Input
                  value={connectorName}
                  onChange={(e) => setConnectorName(e.target.value)}
                  placeholder="Enter connector name"
                  className="bg-muted border-border"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Connector Server */}
            <div className="flex flex-col gap-2">
              <Label className="text-base font-medium">
                Connector Server<span className="text-red-500">*</span>
              </Label>
              <Input
                value={connectorServer}
                onChange={(e) => setConnectorServer(e.target.value)}
                placeholder="https://api.example.com/mcp"
                className={`bg-muted border-border ${oauthUrlError ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
              />
              {oauthUrlError && (
                <p className="text-xs text-red-500">{oauthUrlError}</p>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Description</Label>
                <span className="text-muted-foreground text-sm">Optional</span>
              </div>
              <Textarea
                value={connectorDescription}
                onChange={(e) => setConnectorDescription(e.target.value)}
                placeholder="Describe what this connector does..."
                className="bg-muted border-border min-h-[100px]"
                disabled={isSubmitting}
              />
            </div>

            {/* Connector Scope */}
            <div className="flex flex-col gap-2">
              <Label className="text-base font-medium">Connector Scope</Label>
              <RadioGroup
                value={connectorScope}
                onValueChange={(value) =>
                  setConnectorScope(value as 'tenant' | 'this-mentor')
                }
                disabled={isSubmitting}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tenant" id="scope-tenant" />
                  <Label
                    htmlFor="scope-tenant"
                    className="cursor-pointer font-normal"
                  >
                    All Agents
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="this-mentor" id="scope-this-mentor" />
                  <Label
                    htmlFor="scope-this-mentor"
                    className="cursor-pointer font-normal"
                  >
                    This Agent
                  </Label>
                </div>
              </RadioGroup>
              {connectorScope === 'tenant' && (
                <p className="text-muted-foreground text-xs">
                  This MCP will be available for all agents.
                </p>
              )}
              {connectorScope === 'this-mentor' && (
                <p className="text-muted-foreground text-xs">
                  This MCP will only be available for this agent.
                </p>
              )}
            </div>

            {/* Transport */}
            <div className="flex flex-col gap-2">
              <Label className="text-base font-medium">Transport</Label>
              <Select
                value={transport}
                onValueChange={(value) =>
                  setTransport(normalizeTransportValue(value))
                }
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TransportEnum.SSE}>SSE</SelectItem>
                  <SelectItem value={TransportEnum.WEBSOCKET}>
                    Websocket
                  </SelectItem>
                  <SelectItem value={TransportEnum.STREAMABLE_HTTP}>
                    Streamable Http
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Authentication Method */}
            <div className="flex flex-col gap-2">
              <Label className="text-base font-medium">
                Authentication Method
              </Label>
              <Select
                value={authMethod}
                onValueChange={setAuthMethod}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-auth">No Authentication</SelectItem>
                  <SelectItem value="api-key">API Key</SelectItem>
                  <SelectItem value="oauth">OAuth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {authMethod === 'oauth' && (
              <div className="flex flex-col gap-2">
                <Label className="text-base font-medium">
                  Authentication Scope
                </Label>
                <Select
                  value={authScope}
                  onValueChange={setAuthScope}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTH_SCOPE.TENANT}>Tenant</SelectItem>
                    <SelectItem value={AUTH_SCOPE.MENTOR}>Agent</SelectItem>
                    <SelectItem value={AUTH_SCOPE.USER}>User</SelectItem>
                  </SelectContent>
                </Select>
                {authScope === AUTH_SCOPE.TENANT && (
                  <p className="text-muted-foreground text-xs">
                    OAuth connection will be available for all agents in this
                    tenant.
                  </p>
                )}
                {authScope === AUTH_SCOPE.MENTOR && (
                  <div className="flex items-center gap-1.5">
                    <p className="text-muted-foreground text-xs">
                      OAuth connection will only be available for this agent.
                    </p>
                  </div>
                )}
                {authScope === AUTH_SCOPE.USER && (
                  <p className="text-muted-foreground text-xs">
                    Each user will need to authenticate individually when
                    chatting.
                  </p>
                )}
              </div>
            )}

            {authMethod === 'api-key' && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col gap-2">
                  <Label className="text-base font-medium">Token Type</Label>
                  <Select
                    value={tokenType}
                    onValueChange={setTokenType}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bearer">Bearer</SelectItem>
                      <SelectItem value="Basic">Basic</SelectItem>
                      <SelectItem value="API-Key">API-Key</SelectItem>
                      <SelectItem value="API-Token">API-Token</SelectItem>
                      <SelectItem value="Token">Token</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {tokenType === 'Other' && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-base font-medium">
                      Custom Token Type
                    </Label>
                    <Input
                      value={customTokenType}
                      onChange={(e) => setCustomTokenType(e.target.value)}
                      placeholder="e.g. X-Custom-Auth"
                      className="bg-background border-border"
                      disabled={isSubmitting}
                      maxLength={50}
                    />
                    <p className="text-muted-foreground text-xs">
                      Alphanumeric characters and hyphens only. Max 50
                      characters.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label className="text-base font-medium">Token</Label>
                  <div className="relative">
                    <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      value={tokenValue}
                      onChange={(e) => setTokenValue(e.target.value)}
                      placeholder="Enter your token"
                      type="password"
                      className="bg-background border-border pl-10"
                      disabled={isSubmitting}
                    />
                  </div>
                  {credentialsMasked && (
                    <p className="text-muted-foreground text-xs">
                      Existing token is hidden. Enter a new token to replace it,
                      or leave as is to keep the current token.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={
                  !connectorName.trim() ||
                  !connectorServer.trim() ||
                  isSubmitting ||
                  (authMethod === 'oauth' && !!oauthUrlError) ||
                  (authMethod === 'api-key' &&
                    tokenType === 'Other' &&
                    !customTokenType.trim())
                }
                className="ibl-button-primary shrink-0"
              >
                {isSubmitting
                  ? 'Saving...'
                  : editingServer
                    ? 'Update'
                    : 'Connect'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
