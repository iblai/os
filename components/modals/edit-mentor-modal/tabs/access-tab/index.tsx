'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Pencil, ShieldAlert, UserCog, Users } from 'lucide-react';

import {
  useGetMentorSettingsQuery,
  useGetRbacMentorAccessListQuery,
  useGetRbacPermissionsMutation,
  CustomRbacMentorAccessList,
} from '@iblai/iblai-js/data-layer';

import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { useAppDispatch } from '@/lib/hooks';
import { updateRbacPermissions } from '@/features/rbac/rbac-slice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { AddAccessDialog } from './add-access';
import { RoleAccessPanel } from './update-access';
import {
  DEFAULT_MENTOR_ROLES,
  formatRoleName,
  getErrorMessage,
  roleDescriptions,
  type MentorAccessPolicy,
} from './shared';

export function AccessTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const activeMentorId = mentorId || getMentorId();
  const [editingPolicyKey, setEditingPolicyKey] = useState<string | null>(null);

  const { data: mentorSettings, isLoading: isMentorSettingsLoading } = useGetMentorSettingsQuery(
    {
      mentor: activeMentorId ?? '',
      org: tenantKey,
      // @ts-expect-error userId is not part of the query type definition
      userId: username ?? '',
    },
    {
      skip: !activeMentorId || !tenantKey || !username,
    },
  );

  const mentorDbId =
    mentorSettings?.mentor_id !== undefined && mentorSettings?.mentor_id !== null
      ? mentorSettings.mentor_id
      : undefined;
  const platformKey = tenantKey;

  const {
    data: accessPolicies,
    isLoading: isAccessLoading,
    isFetching: isAccessFetching,
    isError: isAccessError,
    error: accessError,
    refetch: refetchAccess,
  } = useGetRbacMentorAccessListQuery(
    {
      // @ts-expect-error The API expects a numeric mentorId, but the backend can return it as a string.
      mentorId: mentorDbId ?? '',
      platformKey: platformKey ?? '',
    },
    {
      skip: !mentorDbId || !platformKey,
    },
  );

  const sortedPolicies = useMemo<MentorAccessPolicy[]>(() => {
    const policies = Array.isArray(
      (accessPolicies as unknown as CustomRbacMentorAccessList)?.policies,
    )
      ? ((accessPolicies as unknown as CustomRbacMentorAccessList)
          ?.policies as unknown as MentorAccessPolicy[])
      : [];
    return [...policies].sort((a, b) => a.role.localeCompare(b.role));
  }, [accessPolicies]);

  const availableRoles = useMemo(
    () =>
      DEFAULT_MENTOR_ROLES.filter((role) => !sortedPolicies.some((policy) => policy.role === role)),
    [sortedPolicies],
  );

  const editingPolicy = useMemo<MentorAccessPolicy | null>(
    () =>
      editingPolicyKey
        ? (sortedPolicies.find((policy) => String(policy.id ?? policy.role) === editingPolicyKey) ??
          null)
        : null,
    [editingPolicyKey, sortedPolicies],
  );

  const handleRefetch = useCallback(async () => {
    await refetchAccess();
  }, [refetchAccess]);

  const dispatch = useAppDispatch();
  const [getRbacPermissions] = useGetRbacPermissionsMutation();

  // Fetch and dispatch RBAC permissions for platform users resource on load
  useEffect(() => {
    if (!tenantKey) return;
    const loadPlatformPermissions = async () => {
      try {
        const result = await getRbacPermissions({
          requestBody: {
            platform_key: tenantKey,
            resources: [`/users/`],
          },
        }).unwrap();
        dispatch(updateRbacPermissions({ ...result }));
      } catch {
        // silently fail — permission check will default to no access
      }
    };
    loadPlatformPermissions();
  }, [dispatch, getRbacPermissions, tenantKey]);

  const isLoading = isMentorSettingsLoading || isAccessLoading || isAccessFetching;
  const canManageAccess = Boolean(mentorDbId && platformKey);

  return (
    <>
      <div className="hidden h-[73px] shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:flex">
        <div>
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h3 className="text-base font-medium text-gray-900">Access control</h3>
          </div>
          <p className="mt-1 text-xs text-gray-700">
            Manage which users can view or edit this mentor by role.
          </p>
        </div>
      </div>

      <div
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
        style={{
          overflowX: 'hidden',
        }}
      >
        {canManageAccess && availableRoles.length > 0 && (
          <div className="flex items-center justify-end">
            <AddAccessDialog
              availableRoles={availableRoles}
              isLoading={isLoading}
              onAccessCreated={handleRefetch}
            />
          </div>
        )}

        {!canManageAccess && !isLoading && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            <ShieldAlert className="mb-2 h-8 w-8 text-amber-500" aria-hidden="true" />
            <p className="font-medium text-gray-900">Access management is unavailable.</p>
            <p className="mt-1 text-sm text-gray-600">
              We could not determine the mentor context. Close the modal and try again.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[0, 1].map((key) => (
              <div
                key={key}
                className="animate-pulse rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="mt-3 h-3 w-48 rounded bg-gray-100" />
                <div className="mt-4 h-10 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        )}

        {isAccessError && !isLoading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-700">Unable to load mentor access.</p>
                <p className="text-sm text-red-600">
                  {getErrorMessage(
                    accessError,
                    'You may not have permission to manage access for this mentor.',
                  )}
                </p>
                <div>
                  <Button variant="outline" size="sm" onClick={handleRefetch}>
                    Try again
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !isAccessError && sortedPolicies.length === 0 && canManageAccess && (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            <Users className="mx-auto mb-2 h-8 w-8 text-blue-600" aria-hidden="true" />
            <p className="font-medium text-gray-900">No roles available for this mentor.</p>
            <p className="mt-1 text-sm text-gray-600">
              Create a role in the admin console to start managing mentor access.
            </p>
          </div>
        )}

        {!isLoading && !isAccessError && sortedPolicies.length > 0 && canManageAccess && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24 text-center">Users</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPolicies.map((policy) => {
                  const assignedCount = policy.users?.length ?? 0;
                  const policyKey = String(policy.id ?? policy.role);
                  const description =
                    roleDescriptions[policy.role] ??
                    `Manage who has ${formatRoleName(policy.role)} permissions for this mentor.`;

                  return (
                    <TableRow key={policyKey}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserCog className="h-4 w-4 text-blue-600" aria-hidden="true" />
                          <span className="font-medium text-gray-900">
                            {formatRoleName(policy.role)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{description}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {assignedCount}
                        </Badge>
                        <span className="sr-only">
                          {assignedCount === 1
                            ? '1 user assigned to this role'
                            : `${assignedCount} users assigned to this role`}
                        </span>
                      </TableCell>
                      <TableCell className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingPolicyKey(policyKey)}
                          aria-label={`Edit ${formatRoleName(policy.role)} access`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(editingPolicyKey)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPolicyKey(null);
          }
        }}
      >
        {editingPolicy && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage {formatRoleName(editingPolicy.role)} access</DialogTitle>
              <DialogDescription>
                {roleDescriptions[editingPolicy.role] ??
                  `Add or remove users who should have ${formatRoleName(editingPolicy.role)} permissions for this mentor.`}
              </DialogDescription>
            </DialogHeader>
            <RoleAccessPanel policy={editingPolicy} onAccessUpdated={handleRefetch} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
