import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { useAddTrainingDocumentMutation } from '@iblai/iblai-js/data-layer';
import { useParams } from 'next/navigation';
import { useNavigate } from './user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { ResourceType } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-types';
import { toast } from 'sonner';
import { useUsername } from './use-user';
import { extractErrorMessage } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils';

export function useWebsiteCrawlerResource(resource: ResourceType) {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const activeMentorId = getMentorId() ?? mentorId;
  const [addTrainingDocument] = useAddTrainingDocumentMutation();

  const handleCheckUrlIsValid = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  };

  const [crawlerMatchPatterns, setCrawlerMatchPatterns] = useState<string[]>([]);

  const form = useForm({
    defaultValues: {
      url: '',
      type: 'webcrawler',
      crawler_max_depth: 1,
      crawler_max_pages_limit: 1,
      crawler_match_patterns: [],
      crawler_pattern_type: 'glob',
      temp_crawler_match_patterns: '',
    },
    onSubmit: async ({ value }) => {
      try {
        await addTrainingDocument({
          org: tenantKey,
          formData: {
            type: resource.type.toLocaleLowerCase(),
            pathway: activeMentorId,
            url: value.url,
            crawler_max_depth: value.crawler_max_depth,
            crawler_max_pages_limit: value.crawler_max_pages_limit,
            crawler_match_patterns: crawlerMatchPatterns,
            //@ts-ignore
            crawler_pattern_type: value.crawler_pattern_type,
          },
          // @ts-ignore
          userId: username ?? '',
        }).unwrap();
        form.reset();
        setCrawlerMatchPatterns([]);
        toast.success('Web crawl started and queued for training');
      } catch (error: unknown) {
        console.error(JSON.stringify(error));
        const errorMessage = extractErrorMessage(error, 'Error submitting web crawl data');

        toast.error(errorMessage);
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    },
  });

  return {
    handleCheckUrlIsValid,
    form,
    crawlerMatchPatterns,
    setCrawlerMatchPatterns,
  };
}
