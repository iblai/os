import { useSearchParams } from 'next/navigation';

import { useEmbedMode } from '@/hooks/use-embed-mode';
import { isMentorSelectionAllowed } from '@/lib/allow-mentor-selection';
import { isLoggedIn } from '@/lib/utils';

// Anonymous embed viewers never get agent switching, whatever the host URL says.
export function useAllowMentorSelection(): boolean {
  const embedMode = useEmbedMode();
  const searchParams = useSearchParams();
  return embedMode && isLoggedIn() && isMentorSelectionAllowed(searchParams);
}
