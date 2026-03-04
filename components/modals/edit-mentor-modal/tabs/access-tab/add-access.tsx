import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  usePlatformUsersQuery,
  useUpdateRbacMentorAccessMutation,
  PlatformUsersListResponse,
  isPoliciesResponse,
  useGetMentorSettingsQuery,
} from '@iblai/iblai-js/data-layer';
import type { MentorPolicy } from '@iblai/iblai-api';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { DefaultMentorRole, PlatformUserOption } from './shared';
import { formatRoleName, getErrorMessage } from './shared';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';

type AddAccessDialogProps = {
  availableRoles: DefaultMentorRole[];
  isLoading: boolean;
  onAccessCreated: () => Promise<void>;
};

export function AddAccessDialog({
  availableRoles,
  isLoading,
  onAccessCreated,
}: AddAccessDialogProps) {
  const { mentorId, tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<DefaultMentorRole | ''>('');
  const [selectedUsers, setSelectedUsers] = useState<PlatformUserOption[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserSearchResults, setShowUserSearchResults] = useState(false);
  const [debouncedUserSearchTerm] = useDebounce(userSearchTerm, 300);
  const [createMentorAccess, { isLoading: isCreatingMentorAccess }] =
    useUpdateRbacMentorAccessMutation();

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: mentorId ?? '',
      org: tenantKey,
      // @ts-expect-error userId is not part of the query type definition
      userId: username ?? '',
    },
    {
      skip: !mentorId || !tenantKey || !username,
    },
  );

  const mentorDbId =
    mentorSettings?.mentor_id !== undefined && mentorSettings?.mentor_id !== null
      ? mentorSettings.mentor_id
      : undefined;
  const platformKey = tenantKey;

  const handleCreateDialogChange = useCallback(
    (open: boolean) => {
      setIsCreateDialogOpen(open);
      if (!open) {
        setSelectedRole('');
        setSelectedUsers([]);
        setUserSearchTerm('');
        setShowUserSearchResults(false);
      }
    },
    [setIsCreateDialogOpen],
  );

  const handleCancelCreate = useCallback(() => {
    setIsCreateDialogOpen(false);
    setSelectedRole('');
    setSelectedUsers([]);
    setUserSearchTerm('');
    setShowUserSearchResults(false);
  }, []);

  const shouldFetchCreationUsers = Boolean(
    platformKey && debouncedUserSearchTerm && debouncedUserSearchTerm.length >= 2,
  );

  const {
    data: creationUsersData,
    isFetching: isFetchingCreationUsers,
    isLoading: isLoadingCreationUsers,
  } = usePlatformUsersQuery(
    {
      page: 1,
      page_size: 20,
      platform_key: platformKey,
      platform_org: platformKey,
      query: shouldFetchCreationUsers ? debouncedUserSearchTerm : '',
      return_policies: 'false',
    },
    {
      skip: !shouldFetchCreationUsers,
    },
  );

  const selectedUserIds = useMemo(
    () => new Set(selectedUsers.map((user) => user.id)),
    [selectedUsers],
  );

  const creationAvailableUsers = useMemo<PlatformUserOption[]>(() => {
    if (!creationUsersData) return [];
    const { results } = creationUsersData as PlatformUsersListResponse;

    const candidates: unknown[] = Array.isArray(results)
      ? (results as unknown[])
      : isPoliciesResponse(results)
        ? (results.data as unknown[])
        : [];

    return candidates
      .map<PlatformUserOption | null>((rawCandidate) => {
        if (!rawCandidate || typeof rawCandidate !== 'object') {
          return null;
        }

        const candidate = rawCandidate as Record<string, unknown>;
        const rawId = candidate.user_id ?? candidate.id;
        const id =
          typeof rawId === 'string' ? Number(rawId) : typeof rawId === 'number' ? rawId : undefined;
        const name = (candidate.name as string | null | undefined) ?? '';
        if (!id) {
          return null;
        }
        return {
          id,
          name,
          username: (candidate.username as string | null | undefined) ?? undefined,
          email: (candidate.email as string | undefined) ?? undefined,
        };
      })
      .filter((user): user is PlatformUserOption => user !== null)
      .filter((user) => !selectedUserIds.has(user.id));
  }, [creationUsersData, selectedUserIds]);

  const handleUserSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUserSearchTerm(event.target.value);
    setShowUserSearchResults(true);
  }, []);

  const handleUserSearchFocus = useCallback(() => {
    /* istanbul ignore else -- defensive: focus only shows results if search term exists */
    if (userSearchTerm.length > 0) setShowUserSearchResults(true);
  }, [userSearchTerm]);

  const handleUserSearchBlur = useCallback(() => {
    window.setTimeout(() => {
      setShowUserSearchResults(false);
    }, 100);
  }, []);

  const handleAddUserSelection = useCallback((user: PlatformUserOption) => {
    setSelectedUsers((prev) => {
      /* istanbul ignore next -- defensive: selected users are filtered from search results */
      if (prev.some((existing) => existing.id === user.id)) return prev;
      return [...prev, user];
    });
    setUserSearchTerm('');
    setShowUserSearchResults(false);
  }, []);

  const handleRemoveSelectedUser = useCallback((userId: number) => {
    setSelectedUsers((prev) => prev.filter((user) => user.id !== userId));
  }, []);

  const handleCreateRoleAccess = useCallback(async () => {
    /* istanbul ignore if -- defensive: Create button is disabled when no role selected */
    if (!selectedRole) {
      toast.error('Select a role to create access.');
      return;
    }

    /* istanbul ignore if -- defensive: Create button is disabled when mentor context missing */
    if (!mentorDbId || !tenantKey) {
      toast.error('Mentor context is missing. Close the modal and try again.');
      return;
    }

    /* istanbul ignore if -- defensive: role selection only allows valid availableRoles */
    if (!availableRoles.includes(selectedRole)) {
      toast.error(`${formatRoleName(selectedRole)} already exists for this mentor.`);
      return;
    }

    try {
      await createMentorAccess({
        requestBody: {
          platform_key: platformKey,
          mentor_id: mentorDbId,
          role: selectedRole,
          ...(selectedUsers.length > 0 && { users_to_add: selectedUsers.map((user) => user.id) }),
        },
      } as unknown as { requestBody: MentorPolicy }).unwrap();

      toast.success(`${formatRoleName(selectedRole)} access created.`);
      setSelectedRole('');
      setSelectedUsers([]);
      setUserSearchTerm('');
      setShowUserSearchResults(false);
      setIsCreateDialogOpen(false);
      await onAccessCreated();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to create mentor role access.'));
    }
  }, [
    availableRoles,
    createMentorAccess,
    mentorDbId,
    onAccessCreated,
    platformKey,
    selectedRole,
    selectedUsers,
  ]);

  useEffect(() => {
    if (selectedRole && !availableRoles.includes(selectedRole)) {
      setSelectedRole('');
    }
  }, [availableRoles, selectedRole]);

  useEffect(() => {
    if (availableRoles.length === 0) {
      setIsCreateDialogOpen(false);
    }
  }, [availableRoles]);

  return (
    <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-2"
          disabled={isLoading || !mentorDbId || !platformKey}
        >
          <Plus className="h-4 w-4" />
          Create role access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create mentor role access</DialogTitle>
          <DialogDescription>
            Create a mentor access policy for a new role. You can add users to it afterward.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="select-role">Role</Label>
          <Select
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as DefaultMentorRole)}
            disabled={availableRoles.length === 0}
          >
            <SelectTrigger id="select-role" aria-label="Select role">
              <SelectValue placeholder="Choose a role" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {formatRoleName(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Users</Label>
            {selectedUsers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm"
                  >
                    <span className="font-medium">{user.name || user.email}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-gray-500 hover:text-red-600"
                      onClick={() => handleRemoveSelectedUser(user.id)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">Remove {user.name || user.email}</span>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                No users selected yet.
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-user-search">Add users</Label>
            <div className="relative">
              <Input
                id="create-user-search"
                value={userSearchTerm}
                onChange={handleUserSearchChange}
                onFocus={handleUserSearchFocus}
                onBlur={handleUserSearchBlur}
                placeholder="Search by name, username, or email"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={showUserSearchResults}
              />
              {showUserSearchResults && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {userSearchTerm.trim().length < 2 ? (
                    <div className="px-3 py-2 text-sm text-gray-600">
                      Type at least two characters to search.
                    </div>
                  ) : isLoadingCreationUsers || isFetchingCreationUsers ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Searching users…
                    </div>
                  ) : creationAvailableUsers.length > 0 ? (
                    creationAvailableUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left hover:bg-gray-50"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleAddUserSelection(user)}
                      >
                        <span className="text-sm font-medium text-gray-900">
                          {user.name || user.email}
                        </span>
                        {user.name && (
                          <span className="text-xs text-gray-600">
                            {user.username}
                            {user.username && user.email ? ' • ' : ''}
                            {user.email}
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-600">No matching users found.</div>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Type at least two characters to search and assign users to this role.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleCancelCreate}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreateRoleAccess}
            disabled={isCreatingMentorAccess || !selectedRole}
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
          >
            {isCreatingMentorAccess ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Creating…
              </span>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
