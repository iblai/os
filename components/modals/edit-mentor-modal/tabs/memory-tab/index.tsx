'use client';

import { useParams } from 'next/navigation';

import { Switch } from '@/components/ui/switch';
import {
  useGetMentorUserSettingsQuery,
  useUpdateMentorUserSettingsMutation,
} from '@iblai/iblai-js/data-layer';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useNavigate } from '@/hooks/user-navigate';
import { toast } from 'sonner';
import { ManageMemories } from './manage-memories';

export function MemoryTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;

  const { data: mentorUserSettings, isLoading } = useGetMentorUserSettingsQuery(
    {
      tenantKey,
      username: username ?? '',
      mentorId: activeMentorId,
    },
    {
      skip: !tenantKey || !username || !activeMentorId,
    },
  );

  const [updateMentorUserSettings] = useUpdateMentorUserSettingsMutation();

  const referenceSavedMemories = mentorUserSettings?.reference_saved_memories ?? false;

  const handleToggleReferenceSavedMemories = async (checked: boolean) => {
    if (!tenantKey || !username || !activeMentorId) return;

    try {
      await updateMentorUserSettings({
        tenantKey,
        username,
        mentorId: activeMentorId,
        settings: { reference_saved_memories: checked },
      }).unwrap();
      toast.success('Reference saved memories updated');
    } catch (error) {
      console.error('Failed to update mentor user settings:', error);
      toast.error('Failed to update reference saved memories');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  return (
    <>
      <div className="flex lg:block flex-shrink-0 p-4 border-b border-gray-200 bg-white h-[73px] items-center">
        <div>
          <h3 className="text-base font-medium text-gray-900 mb-1">Memory</h3>
          <p className="text-gray-600 text-xs">Configure memory settings for your mentor.</p>
        </div>
      </div>
      <div className="flex-1 p-3 lg:p-4 space-y-6 overflow-y-auto">
        {/* Memory Section */}
        <div className="space-y-8">
          {/* Reference saved memories */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">Reference saved memories</p>
              <p className="text-xs text-gray-600">Let mentorAI use memories when responding.</p>
            </div>
            <Switch
              checked={referenceSavedMemories}
              onCheckedChange={handleToggleReferenceSavedMemories}
              disabled={isLoading}
            />
          </div>

          {/* Manage memories */}
          <ManageMemories tenantKey={tenantKey} username={username} mentorId={activeMentorId} />

          {/* Learners memories */}
          {/* <LearnersMemories /> */}
        </div>
      </div>
    </>
  );
}
