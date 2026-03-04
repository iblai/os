import { useMentorSettings } from './use-mentors/use-mentor-settings';
import { useEmbedMode } from './use-embed-mode';

export function useShowVoiceCall() {
  const { data: mentorSettings } = useMentorSettings();
  const isEmbedMode = useEmbedMode();

  // Use embed setting if in embed mode, otherwise use regular setting
  const showVoiceCall = isEmbedMode
    ? mentorSettings?.embedShowVoiceCall
    : mentorSettings?.showVoiceCall;

  // Default to false if not specified in settings
  if (typeof showVoiceCall !== 'boolean') {
    return false;
  }

  return showVoiceCall;
}
