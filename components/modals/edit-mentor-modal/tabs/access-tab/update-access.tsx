import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  useGetMentorSettingsQuery,
  usePlatformUsersQuery,
  useUpdateRbacMentorAccessMutation,
  PlatformUsersListResponse,
  isPoliciesResponse,
  useGetRbacGroupsQuery,
} from "@iblai/iblai-js/data-layer";
import type { MentorPolicy, RbacUser } from "@iblai/iblai-api";
import { useParams } from "next/navigation";

import { TenantKeyMentorIdParams } from "@/lib/types";
import { useUsername } from "@/hooks/use-user";
import { useAppSelector } from "@/lib/hooks";
import { selectRbacPermissions } from "@/features/rbac/rbac-slice";
import { checkRbacPermission } from "@/hoc/withPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  GroupOption,
  MentorAccessPolicy,
  PlatformUserOption,
  UpdateAction,
} from "./shared";
import { formatRoleName, getErrorMessage } from "./shared";

type RoleAccessPanelProps = {
  policy: MentorAccessPolicy;
  onAccessUpdated: () => Promise<void>;
};

export function RoleAccessPanel({
  policy,
  onAccessUpdated,
}: RoleAccessPanelProps) {
  const { mentorId, tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const hasUsersPermission = checkRbacPermission(
    rbacPermissions,
    `/users/#list`,
  );
  const hasGroupsPermission = checkRbacPermission(
    rbacPermissions,
    `/groups/#list`,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [showUserSearchResults, setShowUserSearchResults] = useState(false);
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<UpdateAction | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [manualInputType, setManualInputType] = useState<"username" | "email">(
    "email",
  );
  const [manualInputValue, setManualInputValue] = useState("");
  const [manualEntries, setManualEntries] = useState<string[]>([]);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [showGroupSearchResults, setShowGroupSearchResults] = useState(false);
  const [debouncedGroupSearch] = useDebounce(groupSearchTerm, 300);
  const [pendingGroupId, setPendingGroupId] = useState<number | null>(null);
  const [pendingGroupAction, setPendingGroupAction] =
    useState<UpdateAction | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const [updateMentorAccess] = useUpdateRbacMentorAccessMutation();

  const assignedUserIds = useMemo(
    () => new Set((policy.users ?? []).map((user) => user.id)),
    [policy.users],
  );

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: mentorId ?? "",
      org: tenantKey,
      // @ts-expect-error userId is not part of the query type definition
      userId: username ?? "",
    },
    {
      skip: !mentorId || !tenantKey || !username,
    },
  );

  const {
    data: usersData,
    isFetching: isFetchingUsers,
    isLoading: isLoadingUsers,
  } = usePlatformUsersQuery(
    {
      page: 1,
      page_size: 20,
      platform_key: tenantKey,
      platform_org: tenantKey,
      query:
        debouncedSearch && debouncedSearch.trim().length >= 2
          ? debouncedSearch
          : "",
      return_policies: "false",
    },
    {
      skip:
        !tenantKey ||
        !mentorId ||
        !showUserSearchResults ||
        !debouncedSearch ||
        debouncedSearch.trim().length < 2,
    },
  );

  const availableUsers = useMemo<PlatformUserOption[]>(() => {
    if (!usersData) return [];
    const { results } = usersData as PlatformUsersListResponse;

    const candidates: unknown[] = Array.isArray(results)
      ? (results as unknown[])
      : isPoliciesResponse(results)
        ? (results.data as unknown[])
        : [];

    return candidates
      .map<PlatformUserOption | null>((rawCandidate) => {
        if (!rawCandidate || typeof rawCandidate !== "object") {
          return null;
        }

        const candidate = rawCandidate as Record<string, unknown>;
        const rawId = candidate.user_id ?? candidate.id;
        const id =
          typeof rawId === "string"
            ? Number(rawId)
            : typeof rawId === "number"
              ? rawId
              : undefined;
        const name = (candidate.name as string | null | undefined) ?? "";

        if (!id) {
          return null;
        }

        return {
          id,
          name,
          username:
            (candidate.username as string | null | undefined) ?? undefined,
          email: (candidate.email as string | undefined) ?? undefined,
        };
      })
      .filter((user): user is PlatformUserOption => user !== null)
      .filter((user) => !assignedUserIds.has(user.id));
  }, [assignedUserIds, usersData]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && availableUsers[highlightedIndex]) {
      const optionId = `user-option-${availableUsers[highlightedIndex].id}`;
      const optionElement = document.getElementById(optionId);
      optionElement?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, availableUsers]);

  const resetPendingState = useCallback(() => {
    setPendingUserId(null);
    setPendingAction(null);
    setPendingGroupId(null);
    setPendingGroupAction(null);
  }, []);

  const handleMutation = useCallback(
    async (
      payload: {
        users_to_add?: number[];
        users_to_remove?: number[];
        groups_to_add?: number[];
        groups_to_remove?: number[];
      },
      successMessage: string,
    ) => {
      if (!tenantKey || !mentorSettings?.mentor_id) {
        toast.error(
          "Mentor context is missing. Close the modal and try again.",
        );
        resetPendingState();
        return;
      }

      const mentorIdForRequest = mentorSettings.mentor_id;
      const tenantKeyForRequest: string = tenantKey;

      try {
        // @ts-expect-error The API expects a numeric mentor_id but the route param is a string.
        await updateMentorAccess({
          requestBody: {
            platform_key: tenantKeyForRequest,
            mentor_id: mentorIdForRequest,
            role: policy.role,
            ...payload,
          },
        } as unknown as { requestBody: Partial<MentorPolicy> }).unwrap();
        toast.success(successMessage);
        await onAccessUpdated();
      } catch (error) {
        toast.error(getErrorMessage(error, "Unable to update mentor access."));
      } finally {
        resetPendingState();
      }
    },
    [
      tenantKey,
      mentorId,
      policy.role,
      updateMentorAccess,
      onAccessUpdated,
      resetPendingState,
      mentorSettings,
    ],
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
      setShowUserSearchResults(true);
      setHighlightedIndex(-1);
    },
    [],
  );

  const handleSearchFocus = useCallback(() => {
    if (searchTerm.trim().length >= 2) {
      setShowUserSearchResults(true);
    }
  }, [searchTerm]);

  const handleContainerBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      // Only close if focus moves outside the container (input + listbox)
      if (!containerRef.current?.contains(event.relatedTarget as Node)) {
        setShowUserSearchResults(false);
        setHighlightedIndex(-1);
      }
    },
    [],
  );

  const handleAddUser = useCallback(
    async (user: PlatformUserOption) => {
      /* istanbul ignore next -- defensive: buttons are disabled during pending operations */
      if (pendingUserId !== null) return;
      setPendingUserId(user.id);
      setPendingAction("add");
      await handleMutation(
        { users_to_add: [user.id] },
        `${user.name || user.email} now has ${formatRoleName(policy.role)} access.`,
      );
      setSearchTerm("");
      setShowUserSearchResults(false);
      setHighlightedIndex(-1);
    },
    [handleMutation, pendingUserId, policy.role],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showUserSearchResults || availableUsers.length === 0) {
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev < availableUsers.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : availableUsers.length - 1,
          );
          break;
        case "Enter":
          event.preventDefault();
          if (
            highlightedIndex >= 0 &&
            highlightedIndex < availableUsers.length
          ) {
            handleAddUser(availableUsers[highlightedIndex]);
          }
          break;
        case "Escape":
          event.preventDefault();
          setShowUserSearchResults(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [showUserSearchResults, availableUsers, highlightedIndex, handleAddUser],
  );

  const handleRemoveUser = useCallback(
    async (user: RbacUser) => {
      /* istanbul ignore next -- defensive: buttons are disabled during pending operations */
      if (pendingUserId !== null) return;
      setPendingUserId(user.id);
      setPendingAction("remove");
      await handleMutation(
        { users_to_remove: [user.id] },
        `${user.username ?? `User ${user.id}`} was removed from ${formatRoleName(policy.role)} access.`,
      );
    },
    [handleMutation, pendingUserId, policy.role],
  );

  const handleStageManualEntry = useCallback(() => {
    const value = manualInputValue.trim();
    if (!value) return;
    setManualEntries((prev) =>
      prev.includes(value) ? prev : [...prev, value],
    );
    setManualInputValue("");
  }, [manualInputValue]);

  const handleRemoveManualEntry = useCallback((entry: string) => {
    setManualEntries((prev) => prev.filter((e) => e !== entry));
  }, []);

  const handleManualAdd = useCallback(async () => {
    // Also stage any remaining input
    const remaining = manualInputValue.trim();
    const allEntries =
      remaining && !manualEntries.includes(remaining)
        ? [...manualEntries, remaining]
        : [...manualEntries];
    if (allEntries.length === 0) return;
    if (!tenantKey || !mentorSettings?.mentor_id) {
      toast.error("Mentor context is missing. Close the modal and try again.");
      return;
    }
    setIsAddingManual(true);
    try {
      const payload =
        manualInputType === "email"
          ? { emails_to_add: allEntries }
          : { usernames_to_add: allEntries };
      // @ts-expect-error The API expects a numeric mentor_id but the route param is a string.
      await updateMentorAccess({
        requestBody: {
          platform_key: tenantKey,
          mentor_id: mentorSettings.mentor_id,
          role: policy.role,
          ...payload,
        },
      } as unknown as { requestBody: Partial<MentorPolicy> }).unwrap();
      toast.success(
        allEntries.length === 1
          ? `User added to ${formatRoleName(policy.role)} access.`
          : `${allEntries.length} users added to ${formatRoleName(policy.role)} access.`,
      );
      setManualInputValue("");
      setManualEntries([]);
      await onAccessUpdated();
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to add user(s)."));
    } finally {
      setIsAddingManual(false);
    }
  }, [
    manualInputValue,
    manualEntries,
    manualInputType,
    tenantKey,
    mentorSettings,
    policy.role,
    updateMentorAccess,
    onAccessUpdated,
  ]);

  // Groups query and handlers
  const assignedGroupIds = useMemo(
    () => new Set((policy.groups ?? []).map((g) => g.id)),
    [policy.groups],
  );

  const shouldFetchGroups = Boolean(
    tenantKey &&
      hasGroupsPermission &&
      showGroupSearchResults &&
      debouncedGroupSearch &&
      debouncedGroupSearch.trim().length >= 2,
  );

  const {
    data: groupsData,
    isFetching: isFetchingGroups,
    isLoading: isLoadingGroups,
  } = useGetRbacGroupsQuery(
    {
      platformKey: tenantKey,
      name: shouldFetchGroups ? debouncedGroupSearch : undefined,
      page: 1,
      pageSize: 20,
    },
    {
      skip: !shouldFetchGroups,
    },
  );

  const availableGroupOptions = useMemo<GroupOption[]>(() => {
    if (!groupsData) return [];
    const results = (groupsData as { results?: unknown[] })?.results;
    if (!Array.isArray(results)) return [];
    return results
      .filter(
        (g): g is { id: number; name?: string } =>
          !!g &&
          typeof g === "object" &&
          typeof (g as Record<string, unknown>).id === "number",
      )
      .map((g) => ({ id: g.id, name: g.name ?? `Group ${g.id}` }))
      .filter((g) => !assignedGroupIds.has(g.id));
  }, [groupsData, assignedGroupIds]);

  const handleGroupSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setGroupSearchTerm(event.target.value);
      setShowGroupSearchResults(true);
    },
    [],
  );

  const handleGroupSearchFocus = useCallback(() => {
    if (groupSearchTerm.trim().length >= 2) {
      setShowGroupSearchResults(true);
    }
  }, [groupSearchTerm]);

  const handleGroupSearchBlur = useCallback(() => {
    window.setTimeout(() => {
      setShowGroupSearchResults(false);
    }, 100);
  }, []);

  const handleAddGroup = useCallback(
    async (group: GroupOption) => {
      if (pendingGroupId !== null) return;
      setPendingGroupId(group.id);
      setPendingGroupAction("add");
      await handleMutation(
        { groups_to_add: [group.id] },
        `${group.name} now has ${formatRoleName(policy.role)} access.`,
      );
      setGroupSearchTerm("");
      setShowGroupSearchResults(false);
    },
    [handleMutation, pendingGroupId, policy.role],
  );

  const handleRemoveGroup = useCallback(
    async (group: { id: number; name?: string }) => {
      if (pendingGroupId !== null) return;
      setPendingGroupId(group.id);
      setPendingGroupAction("remove");
      await handleMutation(
        { groups_to_remove: [group.id] },
        `${group.name ?? `Group ${group.id}`} was removed from ${formatRoleName(policy.role)} access.`,
      );
    },
    [handleMutation, pendingGroupId, policy.role],
  );

  const isPending = (userId: number, action: UpdateAction) =>
    pendingUserId === userId && pendingAction === action;

  const isGroupPending = (groupId: number, action: UpdateAction) =>
    pendingGroupId === groupId && pendingGroupAction === action;

  const renderAssignedUsers = () => {
    const users = policy.users ?? [];

    if (users.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          No users have this role yet.
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <span className="font-medium">{user.email || user.username}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-gray-500 hover:text-red-600"
              onClick={() => handleRemoveUser(user)}
              disabled={pendingUserId !== null}
            >
              {isPending(user.id, "remove") ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="sr-only">
                Remove {user.username ?? `user ${user.id}`}
              </span>
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-900">Assigned users</h4>
        <p className="text-xs text-gray-600">
          Remove users who should no longer have this role.
        </p>
        <div className="mt-3">{renderAssignedUsers()}</div>
      </div>

      <div>
        <div className="mt-3 space-y-1.5">
          {hasUsersPermission ? (
            <>
              <Label htmlFor="user-search">Add users</Label>
              <div
                ref={containerRef}
                className="relative"
                onBlur={handleContainerBlur}
              >
                <Input
                  id="user-search"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                  onKeyDown={handleKeyDown}
                  placeholder="Search by name, username, or email"
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="user-search-listbox"
                  aria-expanded={showUserSearchResults}
                  aria-activedescendant={
                    highlightedIndex >= 0
                      ? `user-option-${availableUsers[highlightedIndex]?.id}`
                      : undefined
                  }
                />
                {showUserSearchResults && (
                  <div
                    ref={listboxRef}
                    id="user-search-listbox"
                    role="listbox"
                    aria-label="Available users"
                    className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
                  >
                    {searchTerm.trim().length < 2 ? (
                      <div
                        className="px-3 py-2 text-sm text-gray-600"
                        role="status"
                      >
                        Type at least two characters to search.
                      </div>
                    ) : isLoadingUsers ||
                      isFetchingUsers ||
                      searchTerm.trim() !== debouncedSearch.trim() ? (
                      <div
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600"
                        role="status"
                      >
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                        Searching users…
                      </div>
                    ) : availableUsers.length > 0 ? (
                      availableUsers.map((user, index) => (
                        <button
                          key={user.id}
                          id={`user-option-${user.id}`}
                          type="button"
                          role="option"
                          aria-selected={highlightedIndex === index}
                          className={`flex w-full flex-col items-start gap-1 px-3 py-2 text-left disabled:opacity-50 ${
                            highlightedIndex === index
                              ? "bg-gray-100"
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() => handleAddUser(user)}
                          disabled={pendingUserId !== null}
                        >
                          <span className="text-sm font-medium text-gray-900">
                            {user.name || user.email}
                          </span>
                          {user.name && (
                            <span className="text-xs text-gray-600">
                              {user.username}
                              {user.username && user.email ? " • " : ""}
                              {user.email}
                            </span>
                          )}
                          {isPending(user.id, "add") && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                              <Loader2
                                className="h-3 w-3 animate-spin"
                                aria-hidden="true"
                              />
                              Adding…
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div
                        className="px-3 py-2 text-sm text-gray-600"
                        role="status"
                      >
                        No matching users found.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Type at least two characters to search and assign users to this
                role.
              </p>
            </>
          ) : (
            <>
              <Label htmlFor="manual-user-input">Add by</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={manualInputType}
                    onValueChange={(value) =>
                      setManualInputType(value as "username" | "email")
                    }
                  >
                    <SelectTrigger
                      className="w-[130px]"
                      aria-label="Select input type"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="username">Username</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="manual-user-input"
                    value={manualInputValue}
                    onChange={(e) => setManualInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleStageManualEntry();
                      }
                    }}
                    placeholder={
                      manualInputType === "email"
                        ? "user@example.com"
                        : "username"
                    }
                    autoComplete="off"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleStageManualEntry}
                    disabled={!manualInputValue.trim()}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Add entry</span>
                  </Button>
                </div>
                {manualEntries.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {manualEntries.map((entry) => (
                      <div
                        key={entry}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm"
                      >
                        <span>{entry}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveManualEntry(entry)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove {entry}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  onClick={handleManualAdd}
                  disabled={
                    isAddingManual ||
                    (manualEntries.length === 0 && !manualInputValue.trim())
                  }
                  className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
                  size="sm"
                >
                  {isAddingManual ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Adding…
                    </span>
                  ) : (
                    `Add ${manualEntries.length > 0 ? `${manualEntries.length} user${manualEntries.length > 1 ? "s" : ""}` : ""}`
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Press Enter or click + to stage {manualInputType}s, then click
                Add to assign them.
              </p>
            </>
          )}
        </div>
      </div>

      {hasGroupsPermission && (
        <>
          <div>
            <h4 className="text-sm font-medium text-gray-900">
              Assigned groups
            </h4>
            <p className="text-xs text-gray-600">
              Remove groups who should no longer have this role.
            </p>
            <div className="mt-3">
              {(policy.groups ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  No groups have this role yet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(policy.groups ?? []).map((group) => (
                    <div
                      key={group.id}
                      className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm transition hover:bg-gray-50"
                    >
                      <span className="font-medium">
                        {group.name || group.unique_id}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-gray-500 hover:text-red-600"
                        onClick={() => handleRemoveGroup(group)}
                        disabled={pendingGroupId !== null}
                      >
                        {isGroupPending(group.id, "remove") ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span className="sr-only">
                          Remove {group.name ?? `group ${group.id}`}
                        </span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="group-search">Add groups</Label>
              <div className="relative">
                <Input
                  id="group-search"
                  value={groupSearchTerm}
                  onChange={handleGroupSearchChange}
                  onFocus={handleGroupSearchFocus}
                  onBlur={handleGroupSearchBlur}
                  placeholder="Search groups by name"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={showGroupSearchResults}
                />
                {showGroupSearchResults && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {groupSearchTerm.trim().length < 2 ? (
                      <div
                        className="px-3 py-2 text-sm text-gray-600"
                        role="status"
                      >
                        Type at least two characters to search.
                      </div>
                    ) : isLoadingGroups ||
                      isFetchingGroups ||
                      groupSearchTerm.trim() !== debouncedGroupSearch.trim() ? (
                      <div
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600"
                        role="status"
                      >
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                        Searching groups…
                      </div>
                    ) : availableGroupOptions.length > 0 ? (
                      availableGroupOptions.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          className="flex w-full items-start gap-1 px-3 py-2 text-left hover:bg-gray-50"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleAddGroup(group)}
                          disabled={pendingGroupId !== null}
                        >
                          <span className="text-sm font-medium text-gray-900">
                            {group.name}
                          </span>
                          {isGroupPending(group.id, "add") && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                              <Loader2
                                className="h-3 w-3 animate-spin"
                                aria-hidden="true"
                              />
                              Adding…
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div
                        className="px-3 py-2 text-sm text-gray-600"
                        role="status"
                      >
                        No matching groups found.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Type at least two characters to search and assign groups to this
                role.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
