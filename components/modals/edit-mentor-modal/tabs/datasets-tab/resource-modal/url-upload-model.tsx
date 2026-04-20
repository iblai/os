import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ResourceType } from '../resource-types';
import { useAddTrainingDocumentMutation } from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { useUsername } from '@/hooks/use-user';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useNavigate } from '@/hooks/user-navigate';
import { extractErrorMessage } from './utils';

type Props = {
  resource: ResourceType;
};

export function UrlUploadModal({ resource }: Props) {
  const [url, setUrl] = React.useState('');
  const username = useUsername();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;

  const [addTrainingDocument, { isLoading: isAddTrainingDocumentLoading }] =
    useAddTrainingDocumentMutation();

  const isDisabled = isAddTrainingDocumentLoading;

  function handleUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
    setUrl(event.target.value);
  }

  const handleSubmitUrl = async () => {
    try {
      await addTrainingDocument({
        org: tenantKey,
        formData: {
          type: resource.fileType
            ? resource.fileType.toLocaleLowerCase()
            : resource.type.toLocaleLowerCase(),
          pathway: activeMentorId,
          url,
        },
        // @ts-ignore
        userId: username ?? '',
      }).unwrap();

      setUrl('');
      toast.success('Document has been queued for training');
    } catch (error: unknown) {
      console.error(JSON.stringify(error));
      const errorMessage = extractErrorMessage(
        error,
        'Error adding training document',
      );

      toast.error(errorMessage);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const handleSubmit = () => {
    if (resource.name.toLocaleLowerCase() === 'youtube') {
      const youtubePattern =
        /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=)?([a-zA-Z0-9_-]{11})([?&].*)?$/;
      if (!youtubePattern.test(url)) {
        toast.error('Invalid YouTube URL');
        return;
      }
      handleSubmitUrl();
    }

    if (resource.name.toLocaleLowerCase() === 'blackboard') {
      const blackboardPattern = /\/ultra\/courses\//;
      if (!blackboardPattern.test(url)) {
        toast.error('Invalid Blackboard URL');
        return;
      }
      handleSubmitUrl();
    }

    if (resource.name.toLocaleLowerCase() === 'url') {
      const urlPattern =
        /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})[/\w .-]*\/?$/;
      if (!urlPattern.test(url)) {
        toast.error('Invalid URL');
        return;
      }
      handleSubmitUrl();
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <Input
        type="url"
        placeholder="URL"
        value={url}
        onChange={handleUrlChange}
        autoComplete="url"
      />
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!url || isDisabled}
          className={cn(
            'cursor-pointer hover:opacity-90',
            url
              ? 'bg-gradient-to-r from-blue-600 to-blue-400 text-white'
              : 'bg-gray-100 text-gray-500',
          )}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
