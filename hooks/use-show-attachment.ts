import { useMentorSettings } from './use-mentors/use-mentor-settings';
import { useModelFileUploadCapabilities } from './use-model-file-upload-capabilities';
import { useEmbedMode } from './use-embed-mode';

export function useShowAttachment() {
  const { data: mentorSettings } = useMentorSettings();
  const fileUploadCapabilities = useModelFileUploadCapabilities();
  const isEmbedMode = useEmbedMode();

  // Check if model supports file uploads
  if (!fileUploadCapabilities.supportsFileUpload) {
    return false;
  }

  // Use embed setting if in embed mode, otherwise use regular setting
  const showAttachment = isEmbedMode
    ? mentorSettings?.embedShowAttachment
    : mentorSettings?.showAttachment;

  // Default to false if not specified in settings
  if (typeof showAttachment !== 'boolean') {
    return false;
  }

  return showAttachment;
}
