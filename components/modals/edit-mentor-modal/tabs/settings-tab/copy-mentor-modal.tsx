'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { MODALS } from '@/lib/constants';
import { useGetUserTenantsQuery } from '@/features/tenants/api-slice';
import {
  useForkMentorMutation,
  useEditMentorMutation,
  useGetMentorSettingsQuery,
} from '@iblai/iblai-js/data-layer';
import { MentorVisibilityEnum } from '@iblai/iblai-api';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { handleTenantSwitch } from '@/lib/utils';
import React from 'react';

interface CopyMentorModalProps {
  onClose: () => void;
}

export function CopyMentorModal({ onClose }: CopyMentorModalProps) {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId, navigateToMentor } = useNavigate();

  const activeMentorId = getMentorId() ?? mentorId;

  const { data: mentor } = useGetMentorSettingsQuery(
    // @ts-ignore
    { mentor: activeMentorId, org: tenantKey, userId: username ?? '' },
    { skip: !activeMentorId || !tenantKey || !username },
  );

  const { data: tenants, isLoading: isLoadingTenants } =
    useGetUserTenantsQuery();

  const [forkMentor, { isLoading: isCopying }] = useForkMentorMutation();
  const [editMentor] = useEditMentorMutation();

  const adminTenants = React.useMemo(
    () => (tenants ?? []).filter((tenant) => tenant.is_admin),
    [tenants],
  );

  const hasMultipleAdminTenants = adminTenants.length > 1;

  const defaultName = `Copy of ${mentor?.mentor_name ?? 'Agent'}`;
  const [newMentorName, setNewMentorName] = React.useState(defaultName);
  const [destinationTenantKey, setDestinationTenantKey] =
    React.useState<string>(tenantKey ?? '');
  // @ts-ignore forkable_with_training_data is not part of the mentor settings type
  const canCloneDocuments = !!mentor?.forkable_with_training_data;
  const [cloneDocuments, setCloneDocuments] = React.useState(canCloneDocuments);

  React.useEffect(() => {
    setNewMentorName(defaultName);
  }, [defaultName]);

  React.useEffect(() => {
    setCloneDocuments(canCloneDocuments);
  }, [canCloneDocuments]);

  const handleCopy = async () => {
    if (
      !tenantKey ||
      !activeMentorId ||
      !username ||
      !destinationTenantKey ||
      !newMentorName.trim()
    ) {
      toast.error('Unable to copy agent. Missing context.');
      return;
    }
    try {
      const forkedMentor = await forkMentor({
        mentor: activeMentorId,
        // @ts-ignore org is not part of the useForkMentorMutation type definition
        org: mentor?.platform_key ?? tenantKey,
        // @ts-ignore userId is not part of the useForkMentorMutation type definition
        userId: username,
        requestBody: {
          new_mentor_name: newMentorName.trim(),
          destination_platform_key: destinationTenantKey,
          clone_documents: canCloneDocuments && cloneDocuments,
        },
      }).unwrap();

      if (
        // @ts-ignore settings is not part of the forkedMentor object
        forkedMentor?.settings?.mentor_visibility ===
        MentorVisibilityEnum.VIEWABLE_BY_ANYONE
      ) {
        await editMentor({
          // @ts-ignore mentor is not part of the useEditMentorMutation Query definition
          mentor: forkedMentor.unique_id,
          org: destinationTenantKey,
          userId: username,
          formData: {
            mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
          },
        }).unwrap();
      }

      toast.success('Agent copied successfully. Switching to new agent');
      onClose();

      const isCrossTenantCopy = destinationTenantKey !== tenantKey;

      const modalStack = [
        {
          name: MODALS.EDIT_MENTOR.name,
          tab: MODALS.EDIT_MENTOR.tabs.settings,
        },
      ];

      if (isCrossTenantCopy) {
        // @ts-ignore unique_id exists on the forked mentor response
        const newMentorId = forkedMentor.unique_id;
        const mentorPath = `/platform/${destinationTenantKey}/${newMentorId}?modal=${encodeURIComponent(JSON.stringify(modalStack))}`;
        await handleTenantSwitch(
          destinationTenantKey,
          false,
          `${window.location.origin}${mentorPath}`,
        );
      } else {
        navigateToMentor(
          // @ts-ignore unique_id exists on the forked mentor response
          forkedMentor.unique_id,
          `modal=${JSON.stringify(modalStack)}`,
        );
      }
    } catch {
      toast.error('Failed to copy agent');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Agent</DialogTitle>
          <DialogDescription>Create a copy of this agent.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center text-sm font-medium text-[#646464]">
              Name
              <span className="ml-1 text-red-500">*</span>
            </Label>
            <Input
              value={newMentorName}
              onChange={(e) => setNewMentorName(e.target.value)}
              placeholder="Agent Name"
              disabled={isCopying}
            />
          </div>

          {hasMultipleAdminTenants && (
            <div className="space-y-2">
              <Label className="flex items-center text-sm font-medium text-[#646464]">
                Destination
              </Label>
              <Select
                value={destinationTenantKey}
                onValueChange={setDestinationTenantKey}
                disabled={isCopying || isLoadingTenants}
              >
                <SelectTrigger aria-label="Select destination tenant">
                  <SelectValue
                    placeholder={
                      isLoadingTenants
                        ? 'Loading tenants...'
                        : 'Select a tenant'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {adminTenants.map((tenant) => (
                    <SelectItem key={tenant.key} value={tenant.key}>
                      {tenant.name || tenant.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-[#646464]">
              Include training data
            </Label>
            <Switch
              checked={canCloneDocuments && cloneDocuments}
              onCheckedChange={setCloneDocuments}
              disabled={isCopying || !canCloneDocuments}
              aria-label={`Include training data ${canCloneDocuments && cloneDocuments ? 'enabled' : 'disabled'}`}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isCopying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCopy}
            disabled={
              isCopying || !destinationTenantKey || !newMentorName.trim()
            }
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
          >
            {isCopying ? 'Copying...' : 'Copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
