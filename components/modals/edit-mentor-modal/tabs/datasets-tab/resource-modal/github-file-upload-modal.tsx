import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { useAddTrainingDocumentMutation } from '@iblai/iblai-js/data-layer';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useParams } from 'next/navigation';
import React from 'react';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import { extractErrorMessage } from './utils';

function useGithubRepoDetails(url: string) {
  const [branches, setBranches] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();

  const fetchBranches = async (repoUrl: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const repoPath = repoUrl.replace('https://github.com/', '').replace('.git', '');
      const response = await fetch(`https://api.github.com/repos/${repoPath}/branches`);

      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }

      const branches = await response.json();
      setBranches(branches.map((branch: { name: string }) => branch.name));
    } catch (error) {
      console.error(JSON.stringify({ tenant: tenantKey, error }));
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (url) {
      fetchBranches(url);
    }
  }, [url]);

  return { branches, error, isLoading, fetchBranches };
}

export function GithubFileUploadModal() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;
  const username = useUsername();

  const [addTrainingDocument, { isLoading: isAddTrainingDocumentLoading }] =
    useAddTrainingDocumentMutation();

  const [githubUrl, setGithubUrl] = React.useState('');
  const [branch, setBranch] = React.useState('');
  const [debouncedGithubUrl] = useDebounce(githubUrl, 500);

  const handleSubmit = async () => {
    try {
      if (!activeMentorId) {
        toast.error('Mentor not found');
        return;
      }
      await addTrainingDocument({
        org: tenantKey,
        // @ts-ignore
        userId: username ?? '',
        formData: {
          url: githubUrl,
          branch,
          pathway: activeMentorId,
          type: 'github',
        },
      }).unwrap();
      setGithubUrl('');
      setBranch('');
      toast.success('Document has been queued for training');
    } catch (error: unknown) {
      console.error(JSON.stringify(error));
      const errorMessage = extractErrorMessage(error, 'Error adding training document');

      toast.error(errorMessage);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const { branches, error, isLoading } = useGithubRepoDetails(debouncedGithubUrl);

  const isLoadingDisabled = !githubUrl || isLoading || isAddTrainingDocumentLoading;
  const isDisabled = isLoadingDisabled || !branch;

  return (
    <div className="flex flex-col space-y-4">
      <Input
        type="url"
        placeholder="Github Repo URL"
        value={githubUrl}
        onChange={(e) => setGithubUrl(e.target.value)}
        autoComplete="url"
        disabled={isAddTrainingDocumentLoading}
      />
      <p className="text-xs font-light text-red-500">{error}</p>
      <Select
        value={branch}
        onValueChange={(value) => setBranch(value)}
        disabled={isLoadingDisabled}
      >
        <SelectTrigger className="w-full rounded-md border p-2">
          <SelectValue placeholder="Select Branch" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch} value={branch}>
              {branch}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isDisabled}
          className={`${githubUrl ? 'bg-gradient-to-r from-blue-600 to-blue-400 text-white' : 'bg-gray-100 text-gray-500'} hover:opacity-90`}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
