import { useSearchParams } from 'next/navigation';
import { useMentorSettings } from './use-mentors/use-mentor-settings';
import { useUsername } from './use-user';
import { useAppSelector } from '@/lib/hooks';
import { selectTokenEnabled } from '@iblai/iblai-js/web-utils';

export function useIsPreviewMode(): boolean {
  const searchParams = useSearchParams();
  const username = useUsername();
  const { data: mentorSettings } = useMentorSettings();
  const tokenEnabled = useAppSelector(selectTokenEnabled);

  const isAnonymousMentor = mentorSettings?.allowAnonymous;
  const userIsNotAllowedToChat: boolean =
    !username && !isAnonymousMentor && !!searchParams.get('token') && !tokenEnabled;

  return searchParams.get('internalPreview') === 'true' || userIsNotAllowedToChat;
}
