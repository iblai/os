import { useMentorSettings } from './use-mentors/use-mentor-settings';
import { useEmbedMode } from './use-embed-mode';

export function useShowVoiceRecorder() {
  const { data: mentorSettings } = useMentorSettings();
  const isEmbedMode = useEmbedMode();

  // Use embed setting if in embed mode, otherwise use regular setting
  const showVoiceRecord = isEmbedMode
    ? mentorSettings?.embedShowVoiceRecord
    : mentorSettings?.showVoiceRecord;

  // Default to false if not specified in settings
  if (typeof showVoiceRecord !== 'boolean') {
    return false;
  }

  return showVoiceRecord;
}
