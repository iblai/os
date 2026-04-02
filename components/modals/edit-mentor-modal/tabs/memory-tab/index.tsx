"use client";

import { useParams } from "next/navigation";

import { Switch } from "@/components/ui/switch";
import {
  useGetMentorSettingsQuery,
  useEditMentorMutation,
} from "@iblai/iblai-js/data-layer";
import { useUsername } from "@/hooks/use-user";
import { TenantKeyMentorIdParams } from "@/lib/types";
import { useNavigate } from "@/hooks/user-navigate";
import { toast } from "sonner";
import { ManageMemories } from "./manage-memories";

export function MemoryTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;

  const { data: mentorSettings, isLoading } = useGetMentorSettingsQuery(
    {
      mentor: activeMentorId,
      org: tenantKey,
      // @ts-ignore
      userId: username ?? "",
    },
    {
      skip: !tenantKey || !username || !activeMentorId,
    },
  );

  const [editMentor, { isLoading: isToggling }] = useEditMentorMutation();

  const isMemoryEnabled = mentorSettings?.enable_memory_component ?? false;

  const handleToggleMemory = async (checked: boolean) => {
    if (!tenantKey || !username || !activeMentorId) return;

    try {
      await editMentor({
        mentor: activeMentorId,
        org: tenantKey,
        // @ts-ignore - enable_memory_component exists on API but not typed
        formData: { enable_memory_component: checked },
        // @ts-ignore
        userId: username,
      }).unwrap();
      toast.success(checked ? "Memory enabled" : "Memory disabled");
    } catch (error: any) {
      console.error("Failed to update memory setting:", error);
      const errorMessage =
        error?.data?.error ||
        error?.error?.error ||
        "Failed to update memory setting";
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <div className="flex lg:block flex-shrink-0 p-4 border-b border-gray-200 bg-white h-[73px] items-center">
        <div>
          <h3 className="text-base font-medium text-gray-900 mb-1">Memory</h3>
          <p className="text-gray-600 text-xs">
            Configure memory settings for your mentor.
          </p>
        </div>
      </div>
      <div className="flex-1 p-3 lg:p-4 space-y-6 overflow-y-auto">
        {/* Memory Section */}
        <div className="space-y-8">
          {/* Enable memory */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">Enable Memory</p>
              <p className="text-xs text-gray-600">
                Allow this mentor to remember and reference information from
                past conversations.
              </p>
            </div>
            <Switch
              checked={isMemoryEnabled}
              onCheckedChange={handleToggleMemory}
              disabled={isLoading || isToggling}
            />
          </div>

          {/* Manage memories */}
          <ManageMemories
            tenantKey={tenantKey}
            username={username}
            mentorId={activeMentorId}
          />

          {/* Learners memories */}
          {/* <LearnersMemories /> */}
        </div>
      </div>
    </>
  );
}
