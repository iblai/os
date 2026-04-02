import { useForm, useStore } from '@tanstack/react-form';

import { useUsername } from '@/hooks/use-user';
import { toast } from 'sonner';
import { useTenantKey } from '@/hooks/use-tenants';
import { useNavigate } from '@/hooks/user-navigate';
import { useCreateMentorMutation } from '@iblai/iblai-js/data-layer';
import {
  DEFAULT_PROMPTS,
  MENTOR_VISIBILITY,
  MODEL_AGENTS,
} from '@/lib/constants';
import { config } from '@/lib/config';
import { usePathname } from 'next/navigation';

interface CreateMentorForm {
  name: string;
  description: string;
  category: number | null;
  file: File | null;
  base: string;
  guidedPrompt: string;
  systemPrompt: string;
  proactivePrompt: string;
  moderationPrompt: string;
  mentorVisibility: string;
}

const defaultCreateMentor: CreateMentorForm = {
  name: '',
  description: '',
  category: null,
  file: null,
  base: MODEL_AGENTS[0]?.value || config.iblTemplateMentor(),
  systemPrompt: DEFAULT_PROMPTS.DEFAULT_SYSTEM_PROMPT,
  moderationPrompt: DEFAULT_PROMPTS.DEFAULT_MODERATION_PROMPT,
  proactivePrompt: DEFAULT_PROMPTS.DEFAULT_PROACTIVE_PROMPT,
  guidedPrompt: DEFAULT_PROMPTS.DEFAULT_GUIDED_PROMPT,
  mentorVisibility: MENTOR_VISIBILITY[1].value,
};

export function useCreateMentor() {
  const username = useUsername();
  const { tenant: tenantKey = '' } = useTenantKey();
  const { navigateToMentor } = useNavigate();
  const pathname = usePathname();

  const isCreateMentorPage = pathname?.includes('/create-mentor') ?? false;

  const [createMentorWithSettings, { isLoading: isLoadingCreateMentor }] =
    useCreateMentorMutation();

  const form = useForm({
    defaultValues: defaultCreateMentor,
    onSubmit: async ({ value }) => {
      try {
        const mentor = await createMentorWithSettings({
          org: tenantKey ?? '',
          formData: {
            // @ts-ignore
            uploaded_profile_image: value.file ?? undefined,
            new_mentor_name: value.name,
            display_name: value.name,
            template_name: value.base,
            metadata: {
              category: value.category,
            },
            guided_prompt_instructions: value.guidedPrompt,
            proactive_prompt: value.proactivePrompt,
            moderation_system_prompt: value.moderationPrompt,
            system_prompt: value.systemPrompt,
            description: value.description,
            mentor_visibility: value.mentorVisibility,
            ...(value.category && { categories: [value.category] }),
          },
          // @ts-ignore
          userId: username ?? '',
        }).unwrap();

        toast.success('Mentor created successfully');
        if (mentor?.unique_id) {
          navigateToMentor(
            mentor?.unique_id,
            undefined,
            isCreateMentorPage ? (tenantKey ?? undefined) : undefined,
          );
        }
      } catch (error: any) {
        const errorMessage = error?.error?.error || 'Failed to create mentor';
        toast.error(errorMessage);
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    },
  });

  const name = useStore(form.store, (state) => (state as any).values.name);
  const description = useStore(
    form.store,
    (state) => (state as any).values.description,
  );
  const category = useStore(
    form.store,
    (state) => (state as any).values.category,
  );
  const file = useStore(form.store, (state) => (state as any).values.file);
  const guidedPrompt = useStore(
    form.store,
    (state) => (state as any).values.guidedPrompt,
  );
  const systemPrompt = useStore(
    form.store,
    (state) => (state as any).values.systemPrompt,
  );
  const proactivePrompt = useStore(
    form.store,
    (state) => (state as any).values.proactivePrompt,
  );

  const editPrompt = (
    prompt: string,
    type: 'systemPrompt' | 'proactivePrompt' | 'guidedPrompt',
  ) => {
    form.setFieldValue(type, prompt);
  };

  return {
    form,
    name,
    description,
    category,
    file,
    guidedPrompt,
    systemPrompt,
    proactivePrompt,
    isLoadingCreateMentor,
    editPrompt,
  };
}
