import { toast } from 'sonner';

import { useEditMentorMutation } from '@iblai/iblai-js/data-layer';

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
    const newMentorTools = mentorTools.includes(toolSlug)
      ? mentorTools.filter((tool: string) => tool !== toolSlug)
      : [...mentorTools, toolSlug];

    try {
      await editMentor({
        mentor: activeMentorId,
        org: tenantKey,
        formData: {
          tool_slugs: newMentorTools,
          can_use_tools: newMentorTools.length > 0 ? true : false,
        },
        // @ts-ignore
        userId: username ?? '',
      }).unwrap();
      toast.success('Agent updated successfully');
      callback?.();
    } catch (error: any) {
      console.error(JSON.stringify(error));
      const errorMessage =
        error?.data?.error || error?.error?.error || 'Failed to update tool';
      toast.error(errorMessage);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  return {
    toggleTools,
    isLoading,
  };
}
