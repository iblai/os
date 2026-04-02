import React from 'react';

import { advancedTabsProperties } from '@iblai/iblai-js/web-utils';
import type { SendMessageOptions, Message } from '@iblai/iblai-js/web-utils';

type Props = {
  messages: Message[];
  sendMessage: (text: string, options?: SendMessageOptions) => Promise<void>;
  isPreviewMode: boolean;
};

export function ExpandTab({ messages, sendMessage, isPreviewMode }: Props) {
  React.useEffect(() => {
    if (messages.length === 0 && !isPreviewMode) {
      for (const message of advancedTabsProperties.expand.prompts) {
        if (message.type === 'human') {
          sendMessage(message.content, { visible: !message.hide });
        }
      }
    }
  }, [messages.length, sendMessage, isPreviewMode]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex bg-blue-50 p-0 py-2 pl-2 text-blue-700">
        <h2 className="mb-4 text-sm font-medium">Expand</h2>
      </div>
    </div>
  );
}
