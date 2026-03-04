import { EMBED_MESSAGE_TYPES } from '@/lib/constants';

export type CloseEmbedMessage = {
  type: typeof EMBED_MESSAGE_TYPES.MENTOR_CLOSE_EMBED;
  payload: {
    closeEmbed: boolean;
    collapseSidebarCopilot: boolean;
  };
};
