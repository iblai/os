import { toast } from "sonner";

import { useEditMentorMutation } from "@iblai/iblai-js/data-layer";

type Props = {
  tools: string[];
  activeMentorId: string;
  tenantKey: string;
  username: string;
};

export function useToggleTools({
  activeMentorId,
  tenantKey,
  username,
  tools = [],
}: Props) {
  const [editMentor, { isLoading }] = useEditMentorMutation();

  async function toggleTools(toolSlug: string, callback?: () => void) {
    const mentorTools = tools;
    const isEnabling = !mentorTools.includes(toolSlug);
    const newMentorTools = isEnabling
      ? [...mentorTools, toolSlug]
      : mentorTools.filter((tool: string) => tool !== toolSlug);

    const isMemoryTool = toolSlug.toLowerCase().includes("memory");

    try {
      await editMentor({
        mentor: activeMentorId,
        org: tenantKey,
        formData: (isMemoryTool
          ? { enable_memory_component: isEnabling }
          : {
              tool_slugs: newMentorTools,
              can_use_tools: newMentorTools.length > 0 ? true : false,
            }) as any,
        // @ts-ignore
        userId: username ?? "",
      }).unwrap();
      toast.success("Mentor updated successfully");
      callback?.();
    } catch (error: any) {
      console.error(JSON.stringify(error));
      const errorMessage =
        error?.data?.error || error?.error?.error || "Failed to update tool";
      toast.error(errorMessage);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  return {
    toggleTools,
    isLoading,
  };
}
